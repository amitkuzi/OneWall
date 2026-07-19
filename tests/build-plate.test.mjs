// Build-plate fitting checks — verifies that an oversized baseplate
// splits into tiles that (a) each fit the named printer, (b) reassemble
// into exactly the plate the user asked for, and (c) are themselves
// valid, buildable baseplates.
// Run: node tests/build-plate.test.mjs
import {
  GF, BUILD_PLATES, PLATE_MARGIN, packRuns, planPlateTiles,
  packBuildPlates, cellSizes, buildBaseplate, meshVolume, manifoldReport,
} from '../assets/gridfinity.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✗', msg); }
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

// ── 1. The two printers we ship ─────────────────────────────
console.log('\nbuilt-in build plates');
const byId = Object.fromEntries(BUILD_PLATES.map(p => [p.id, p]));
ok(byId.elegoo_centauri_carbon &&
   byId.elegoo_centauri_carbon.w === 250 &&
   byId.elegoo_centauri_carbon.d === 250,
   'Elegoo Centauri Carbon is 250×250');
ok(byId.bambu_a1_mini &&
   byId.bambu_a1_mini.w === 180 && byId.bambu_a1_mini.d === 180,
   'Bambu Lab A1 mini is 180×180');
ok(BUILD_PLATES.every(p => p.id && p.name && p.w > 0 && p.d > 0),
   'every built-in has id, name and positive bed size');

// ── 2. packRuns ─────────────────────────────────────────────
console.log('\npackRuns');
const cells = n => Array.from({ length: n }, () => ({ u: 1, socket: true }));

const r4 = packRuns(cells(8), 170);         // 4 × 42 = 168 fits, 5 does not
ok(r4.length === 2 && r4.every(r => r.cells.length === 4),
   '8 unit cells at 170 mm pack into 2 runs of 4');
ok(r4.every(r => near(r.mm, 168)), 'each run reports its own span in mm');
ok(r4.every(r => !r.oversized), 'runs within the limit are not flagged');

ok(packRuns(cells(3), 500).length === 1, 'a list that already fits stays one run');
ok(packRuns([], 200).length === 0, 'an empty cell list yields no runs');

// A cell wider than the bed cannot be cut — splitting it would slice
// through a socket — so it goes out alone and flagged.
const big = packRuns([{ u: 4, socket: true }], 140);
ok(big.length === 1 && big[0].oversized,
   'a single cell wider than the bed is emitted alone and flagged oversized');

// Mixed sizes: the greedy fill must not overshoot.
const mixed = packRuns(
  [{ u: 1 }, { u: 1 }, { u: 0.5 }, { u: 1 }, { u: 1 }].map(c => ({ ...c, socket: true })),
  100);   // 100 mm ≈ 2.38 cells
ok(mixed.every(r => r.mm <= 100 + 1e-9), 'no run exceeds the limit');
ok(mixed.reduce((s, r) => s + r.cells.length, 0) === 5,
   'every cell lands in exactly one run');

// ── 3. planPlateTiles ───────────────────────────────────────
console.log('\nplanPlateTiles');

// Plan against the real registry entries rather than repeating their
// dimensions here — a hardcoded bed size silently goes stale the next
// time a printer's specs are corrected.
const planFor = (id, cells_x, cells_y, mult = 1) => planPlateTiles({
  cells_x, cells_y, mult,
  build_w: byId[id].w, build_d: byId[id].d, margin: PLATE_MARGIN,
});

const mini = planFor('bambu_a1_mini', 8, 8);
ok(mini.cols === 2 && mini.rows === 2, '8×8 plate → 2×2 tiles on the A1 mini');
ok(mini.tiles.length === 4, 'tile count is cols × rows');
ok(!mini.single, 'a split plate is not reported as a single piece');
ok(near(mini.width, 8 * GF.PITCH) && near(mini.depth, 8 * GF.PITCH),
   'plan reports the full plate size, not a tile size');

const centauri = planFor('elegoo_centauri_carbon', 8, 8);
ok(centauri.cols === 2 && centauri.rows === 2,
   '8×8 plate → 2×2 tiles on the Centauri Carbon (5+3 cells per axis)');
ok(centauri.tiles.some(t => near(t.width, 5 * GF.PITCH)) &&
   centauri.tiles.some(t => near(t.width, 3 * GF.PITCH)),
   'runs fill greedily — a 5-cell tile then the 3-cell remainder');

const fits = planFor('elegoo_centauri_carbon', 3, 3);
ok(fits.single && fits.tiles.length === 1,
   'a plate that already fits comes back as one tile');

// Every tile must actually fit the bed it was planned for.
for (const plate of BUILD_PLATES) {
  const plan = planPlateTiles({
    cells_x: 7.5, cells_y: 6, mult: 1,
    build_w: plate.w, build_d: plate.d, margin: PLATE_MARGIN,
  });
  ok(plan.tiles.every(t => t.width <= plan.usableW + 1e-9 &&
                           t.depth <= plan.usableD + 1e-9),
     `every tile fits inside the usable bed of the ${plate.name}`);
}

// ── 4. Tiles reassemble into the original plate ─────────────
console.log('\ntiles reassemble the plate');
const plan = planPlateTiles({
  cells_x: 7.5, cells_y: 5, mult: 1,
  build_w: 180, build_d: 180, margin: PLATE_MARGIN,
});

// Cells conserved: the tile grid holds every cell of the whole plate,
// once. This is what guarantees no socket was cut in half.
const wholeX = cellSizes(7.5, 1), wholeY = cellSizes(5, 1);
const row0 = plan.tiles.filter(t => t.iy === 0).sort((a, b) => a.ix - b.ix);
const col0 = plan.tiles.filter(t => t.ix === 0).sort((a, b) => a.iy - b.iy);
ok(JSON.stringify(row0.flatMap(t => t.xs)) === JSON.stringify(wholeX),
   'X cells across a tile row match the undivided plate, in order');
ok(JSON.stringify(col0.flatMap(t => t.ys)) === JSON.stringify(wholeY),
   'Y cells down a tile column match the undivided plate, in order');
ok(near(row0.reduce((s, t) => s + t.width, 0), plan.width),
   'tile widths sum to the plate width — no material lost or added');
ok(near(col0.reduce((s, t) => s + t.depth, 0), plan.depth),
   'tile depths sum to the plate depth');

// Placed at their reported centres, tiles butt edge to edge.
let cursor = -plan.width / 2;
let contiguous = true;
for (const t of row0) {
  if (!near(t.x - t.width / 2, cursor, 1e-6)) contiguous = false;
  cursor += t.width;
}
ok(contiguous, 'tile centres place them edge to edge with no gap or overlap');

// ── 5. Oversize and height warnings ─────────────────────────
console.log('\nwarnings');
const over = planPlateTiles({
  cells_x: 2, cells_y: 2, mult: 4,          // 168 mm cells
  build_w: 180, build_d: 180, margin: 20,   // 140 mm usable
});
ok(over.oversized, 'a cell wider than the usable bed sets the oversized flag');
ok(!planPlateTiles({
  cells_x: 2, cells_y: 2, mult: 4,
  build_w: 180, build_d: 180, margin: PLATE_MARGIN,   // 170 mm usable
}).oversized, 'the same cell inside the usable bed is not flagged');
ok(planPlateTiles({ cells_x: 2, cells_y: 2, plate_h: 300, build_h: 256 }).tooTall,
   'a plate taller than the build height sets tooTall');
ok(!planPlateTiles({ cells_x: 2, cells_y: 2, plate_h: 5, build_h: 256 }).tooTall,
   'a normal plate height does not');

// ── 6. Tiles build as real baseplates ───────────────────────
console.log('\nbuilding a tile');
const tile = plan.tiles[0];
const mesh = buildBaseplate({ xs: tile.xs, ys: tile.ys, style: 'normal' });
ok(near(mesh.width, tile.width, 1e-6) && near(mesh.depth, tile.depth, 1e-6),
   'a tile built from its cell lists has the size the plan promised');
ok(mesh.tris > 0 && meshVolume(mesh) > 0,
   'the tile mesh has positive volume (outward winding)');
// Gridfinity plates are watertight but not fully manifold (the socket
// rings stitch three faces at some edges). A tile must be no worse
// than the undivided plate it came from, per triangle.
const whole   = buildBaseplate({ cells_x: 7.5, cells_y: 5, mult: 1 });
const tRatio  = manifoldReport(mesh).badEdges  / mesh.tris;
const wRatio  = manifoldReport(whole).badEdges / whole.tris;
ok(tRatio <= wRatio + 1e-9,
   `splitting adds no non-manifold edges (tile ${tRatio.toFixed(4)} ≤ `
   + `whole ${wRatio.toFixed(4)} per triangle)`);

// A one-tile plan must build byte-identically to the plain plate —
// otherwise turning the fit toggle on would silently change geometry.
const viaTiles = buildBaseplate({ xs: fits.tiles[0].xs, ys: fits.tiles[0].ys });
const direct   = buildBaseplate({ cells_x: 3, cells_y: 3, mult: 1 });
ok(viaTiles.tris === direct.tris && near(viaTiles.width, direct.width),
   'a plate that needs no split builds identically with or without the planner');

// ── 7. Packing tiles onto build plates ──────────────────────
// This is where saved prints come from: splitting says how many
// PIECES, packing says how many PRINT JOBS, and they are not the
// same number.
console.log('\npackBuildPlates');
const A1 = { build_w: 180, build_d: 180, margin: PLATE_MARGIN, gap: 3 };

// Two 168×80 tiles are two rectangles but they stack on one bed:
// 80 + 3 gap + 80 = 163, inside the 170 usable depth.
const stacked = packBuildPlates(
  [{ width: 168, depth: 80 }, { width: 168, depth: 80 }], A1);
ok(stacked.jobs === 1, 'two 168×80 tiles share a single 180×180 bed — one print');
ok(stacked.plates[0].placements.length === 2, 'both land on the same plate');
ok(!stacked.unplaced.length, 'nothing left over');

// …and three of them do not (3×80 + 2 gaps = 246 > 170).
ok(packBuildPlates(
  [{ width: 168, depth: 80 }, { width: 168, depth: 80 }, { width: 168, depth: 80 }],
  A1).jobs === 2, 'a third 168×80 tile needs a second print');

// Part spacing is real bed space, not decoration: two 84-deep tiles
// sum to exactly 168 but need 171 with the gap, so they do not fit —
// and do fit once the gap is removed.
ok(packBuildPlates([{ width: 168, depth: 84 }, { width: 168, depth: 84 }],
     { ...A1, gap: 3 }).jobs === 2,
   'part spacing is charged against the bed (2×84 + 3 > 170)');
ok(packBuildPlates([{ width: 168, depth: 84 }, { width: 168, depth: 84 }],
     { ...A1, gap: 0 }).jobs === 1,
   'the same two tiles fit when spacing is set to zero');

// Placements must stay inside the usable bed and not overlap.
const check = pack => {
  const W = pack.usableW, D = pack.usableD;
  for (const plate of pack.plates) {
    for (const p of plate.placements) {
      if (p.x - p.w / 2 < -W / 2 - 1e-6 || p.x + p.w / 2 > W / 2 + 1e-6) return 'out of bed X';
      if (p.y - p.d / 2 < -D / 2 - 1e-6 || p.y + p.d / 2 > D / 2 + 1e-6) return 'out of bed Y';
    }
    for (let i = 0; i < plate.placements.length; i++)
      for (let j = i + 1; j < plate.placements.length; j++) {
        const a = plate.placements[i], b = plate.placements[j];
        const ox = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6;
        const oy = Math.abs(a.y - b.y) < (a.d + b.d) / 2 - 1e-6;
        if (ox && oy) return 'overlap';
      }
  }
  return null;
};
ok(check(stacked) === null, 'placements sit inside the bed and do not overlap');

// The real case: a 5×5 plate on an A1 mini splits into 4 uneven tiles
// that pack onto 2 beds rather than needing 4 separate prints.
const p55 = planPlateTiles({ cells_x: 5, cells_y: 5, mult: 1, ...A1 });
const k55 = packBuildPlates(p55.tiles, A1);
ok(p55.tiles.length === 4, '5×5 plate splits into 4 tiles');
ok(k55.jobs < p55.tiles.length,
   `packing beats one-print-per-tile (${k55.jobs} jobs for ${p55.tiles.length} tiles)`);
ok(check(k55) === null, 'the 5×5 packing is valid');
ok(!k55.unplaced.length, 'every tile of a correctly-planned split is placeable');

// Rotation: a 40×160 tile only fits a 170×60 usable bed sideways.
const rot = packBuildPlates([{ width: 40, depth: 160 }],
  { build_w: 180, build_d: 70, margin: 5, gap: 3 });
ok(rot.jobs === 1 && rot.plates[0].placements[0].rotated,
   'a tile that only fits sideways is rotated rather than declared unprintable');
ok(packBuildPlates([{ width: 40, depth: 160 }],
     { build_w: 180, build_d: 70, margin: 5, rotate: false }).unplaced.length === 1,
   'with rotation off the same tile is reported unplaced');

// A tile larger than the bed in both orientations cannot be printed.
ok(packBuildPlates([{ width: 400, depth: 400 }], A1).unplaced.length === 1,
   'an oversized tile is reported, not silently placed off the bed');

ok(packBuildPlates([], A1).jobs === 0, 'no tiles means no print jobs');

// Every tile must appear exactly once across the plan.
const total = k55.plates.reduce((s, p) => s + p.placements.length, 0)
            + k55.unplaced.length;
ok(total === p55.tiles.length, 'every tile is placed exactly once');
ok(k55.plates.every(p => p.utilization > 0 && p.utilization <= 1),
   'reported bed utilization is a sane fraction');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
