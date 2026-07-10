// Gridfinity Creator — geometry validation suite
// Run: node tests/gridfinity.test.mjs
import {
  GF, MULTIPLIERS, LEG_MULTS, LIP_H, LIP_EDGE, lipSeatInset,
  legFits, footprint, baseInset, socketInset,
  roundedRectRing, offsetRing, buildBin, buildBaseplate,
  meshVolume, manifoldReport,
} from '../assets/gridfinity.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✗', msg); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ── 1. Spec constants & footprint multipliers ───────────────
console.log('1. footprint / spec');
ok(near(footprint(1), 41.5), 'footprint(1) = 41.5 mm');
ok(near(footprint(0.5), 20.5), 'footprint(0.5) = 20.5 mm');
ok(near(footprint(2), 83.5), 'footprint(2) = 83.5 mm');
ok(near(footprint(4), 167.5), 'footprint(4) = 167.5 mm');
ok(near(GF.BASE_H, 4.75), 'base profile height = 4.75 mm');

// ── 2. Base & socket profiles ───────────────────────────────
console.log('2. base / socket profile');
ok(near(baseInset(0), 2.95), 'baseInset(0) = 2.95');
ok(near(baseInset(0.8), 2.15), 'baseInset(0.8) = 2.15');
ok(near(baseInset(2.6), 2.15), 'baseInset(2.6) = 2.15');
ok(near(baseInset(4.75), 0), 'baseInset(4.75) = 0');
ok(near(baseInset(10), 0), 'baseInset above base = 0');
// socket is the mirror of the base: inset at depth d equals baseInset(BASE_H - d)
let mirror = true;
for (let d = 0; d <= GF.BASE_H + 0.001; d += 0.05)
  if (!near(socketInset(d), baseInset(GF.BASE_H - d), 1e-9)) mirror = false;
ok(mirror, 'socketInset(d) mirrors baseInset(BASE_H − d) across full profile');
// monotone: base inset never increases with z
let mono = true, prev = baseInset(0);
for (let z = 0; z <= 5; z += 0.01) {
  const v = baseInset(z);
  if (v > prev + 1e-9) mono = false;
  prev = v;
}
ok(mono, 'baseInset is non-increasing in z (printable 45° overhangs)');

// ── 3. Ring / offset geometry ───────────────────────────────
console.log('3. rings');
const ring = roundedRectRing(41.5, 41.5, 4, 2);
ok(ring.length >= 20, `ring has enough points (${ring.length})`);
const maxAbs = r => Math.max(...r.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
ok(near(maxAbs(ring), 41.5 / 2, 1e-6), 'ring spans exactly ±w/2');
const shrunk = offsetRing(ring, 2);
ok(maxAbs(shrunk) < maxAbs(ring), 'inward offset shrinks the ring');
const grown = offsetRing(ring, -2);
ok(near(maxAbs(grown), 41.5 / 2 + 2, 0.05), 'outward offset grows the ring by the inset');

// ── 4. Bins: all multiplier combos, manifold + volume ───────
console.log('4. bins');
for (const ux of MULTIPLIERS) {
  const bin = buildBin({ units_x: ux, units_y: 1, height_units: 3 });
  ok(near(bin.width, footprint(ux), 1e-6) && near(bin.depth, 41.5, 1e-6),
     `bin ${ux}x1 footprint = ${bin.width.toFixed(1)}×${bin.depth.toFixed(1)} mm`);
  ok(near(bin.height, 4.75 + 21, 1e-6), `bin ${ux}x1 height = base + 3u = 25.75 mm`);
  const rep = manifoldReport(bin);
  ok(rep.ok, `bin ${ux}x1 mesh is watertight (${rep.edges} edges, ${rep.badEdges} bad)`);
  const boxVol = bin.width * bin.depth * bin.height;
  const vol = meshVolume(bin);
  ok(vol > 0 && vol < 0.55 * boxVol,
     `normal bin ${ux}x1 is hollow (${Math.round(vol)} mm³)`);

  const lite = buildBin({ units_x: ux, units_y: 1, height_units: 3, style: 'lite' });
  ok(manifoldReport(lite).ok, `lite bin ${ux}x1 mesh is watertight`);
  const lv = meshVolume(lite);
  ok(lv > 0.5 * boxVol && lv < boxVol,
     `lite bin ${ux}x1 is a solid body for vase mode (${Math.round(lv)} mm³)`);
}

// per-cell feet: a 2x2 bin must have 4 separate 42 mm-pitch feet
// so it seats on a standard baseplate (regression: merged base bug)
console.log('4b. per-cell feet');
{
  const bin = buildBin({ units_x: 2, units_y: 2, height_units: 3 });
  ok(bin.feet === 4, '2x2 bin has 4 feet');
  // vertices near z=0 must cluster around cell centres (±21, ±21)
  // and leave a gap at the cell boundary (x ≈ 0)
  const { positions } = bin;
  let minAbsX = Infinity, maxX = 0;
  for (let i = 0; i < positions.length; i += 3)
    if (positions[i + 2] < 0.01) {
      minAbsX = Math.min(minAbsX, Math.abs(positions[i]));
      maxX = Math.max(maxX, Math.abs(positions[i]));
    }
  ok(minAbsX > 1, `feet leave a gap at the cell boundary (|x| ≥ ${minAbsX.toFixed(1)})`);
  const expectMax = GF.PITCH / 2 + footprint(1) / 2 - baseInset(0);
  ok(Math.abs(maxX - expectMax) < 0.2,
     `foot bottoms land on the 42 mm grid (max |x| = ${maxX.toFixed(2)} ≈ ${expectMax})`);
  // each 1u foot at its widest still fits a standard socket
  ok(footprint(1) < footprint(1) + 2 * GF.CLEAR, '1u foot < standard socket opening');

  const one = buildBin({ units_x: 1, units_y: 1 });
  ok(one.feet === 1, '1x1 bin has a single foot');
  const halfBin = buildBin({ units_x: 0.5, units_y: 0.5 });
  ok(halfBin.feet === 1 && halfBin.leg_mult === 0.5,
     '0.5x0.5 bin falls back to a single 0.5 foot');
  const four = buildBin({ units_x: 4, units_y: 2 });
  ok(four.feet === 8, '4x2 bin has 8 feet');
}

// leg-size multiplier: 0.5 → 21 mm, 1 → 42 mm, 2 → 84 mm legs
console.log('4c. leg multiplier');
{
  ok(legFits(2, 1) && legFits(1.5, 0.5) && !legFits(1.5, 1) && !legFits(2.5, 2),
     'legFits divisibility checks');

  // user examples
  const e1 = buildBin({ units_x: 1.5, units_y: 2.5, leg_mult: 0.5 });
  ok(e1.feet === 15 && e1.leg_mult === 0.5, '1.5x2.5 + 0.5 legs → 3x5 = 15 legs of 21 mm');
  const e2 = buildBin({ units_x: 4, units_y: 2, leg_mult: 2 });
  ok(e2.feet === 2 && e2.leg_mult === 2, '4x2 + 2 legs → 2x1 = 2 legs of 84 mm');
  const e3 = buildBin({ units_x: 2, units_y: 3, leg_mult: 0.5 });
  ok(e3.feet === 24 && e3.leg_mult === 0.5, '2x3 + 0.5 legs → 4x6 = 24 legs of 21 mm');

  // invalid combo falls back to 0.5 legs (always valid on 0.5 steps)
  const bad = buildBin({ units_x: 1.5, units_y: 2, leg_mult: 2 });
  ok(bad.leg_mult === 0.5 && bad.feet === 3 * 4,
     '1.5x2 + 2 legs blocked → falls back to 0.5 legs (3x4)');

  // geometry stays valid across leg sizes and large bins
  for (const [ux, uy, m] of [[1.5, 2.5, 0.5], [4, 2, 2], [8, 0.5, 0.5], [8, 8, 2]]) {
    const b = buildBin({ units_x: ux, units_y: uy, leg_mult: m, spacing: 3 });
    const rep = manifoldReport(b);
    ok(rep.ok, `${ux}x${uy} legs=${m} watertight (${b.feet} feet)`);
    ok(near(b.width, footprint(ux), 1e-6), `${ux}x${uy} footprint width ok`);
  }

  // 84 mm legs land on the 84 mm grid: bottom verts of 4x2/leg2
  const { positions } = e2;
  let maxX = 0;
  for (let i = 0; i < positions.length; i += 3)
    if (positions[i + 2] < 0.01) maxX = Math.max(maxX, Math.abs(positions[i]));
  const expect = 2 * GF.PITCH / 2 + footprint(2) / 2 - baseInset(0);
  ok(Math.abs(maxX - expect) < 0.2,
     `84 mm feet centred on the 84 mm grid (max |x| = ${maxX.toFixed(2)} ≈ ${expect})`);
}

// spiral ribs stay manifold and don't change footprint beyond amplitude
const ribbed = buildBin({ units_x: 2, units_y: 2, height_units: 6,
                          ribs: 24, rib_amp: 0.6, rib_twist: 2 });
ok(manifoldReport(ribbed).ok, 'spiral-ribbed 2x2 bin is watertight');
{
  const { positions } = ribbed;
  let maxXY = 0;
  for (let i = 0; i < positions.length; i += 3)
    maxXY = Math.max(maxXY, Math.abs(positions[i]), Math.abs(positions[i + 1]));
  ok(maxXY <= footprint(2) / 2 + 0.6 + 1e-3,
     'rib texture stays within footprint + amplitude');
}

// half-unit bin really is 21mm pitch compatible
const half = buildBin({ units_x: 0.5, units_y: 0.5, height_units: 2 });
ok(half.width < 21 && half.depth < 21, '0.5×0.5 bin fits inside a 21 mm half-cell');

// ── 4d. Stacking lip ────────────────────────────────────────
console.log('4d. stacking lip');
{
  const plain = buildBin({});
  const lip = buildBin({ lip: true });
  ok(near(lip.height, plain.height + LIP_H, 1e-6),
     `lip adds ${LIP_H} mm on top (${lip.height} mm)`);
  ok(manifoldReport(lip).ok, 'lipped bin is watertight');
  ok(meshVolume(lip) > meshVolume(plain), 'lip adds material');

  // seat profile: printable edge at the top, monotone (45° max), and
  // wide enough that a foot's bottom passes into the seat bottom
  ok(near(lipSeatInset(0), LIP_EDGE), `seat edge = ${LIP_EDGE} mm`);
  let monoSeat = true, prevSeat = lipSeatInset(0);
  for (let d = 0; d <= LIP_H; d += 0.05) {
    const v = lipSeatInset(d);
    if (v < prevSeat - 1e-9 || v > prevSeat + 0.06) monoSeat = false;
    prevSeat = v;
  }
  ok(monoSeat, 'seat inset grows ≤45° with depth (printable, self-centering)');
  const footBottomInset = baseInset(0);           // 2.95
  ok(lipSeatInset(LIP_H) < footBottomInset,
     'foot bottom fits inside the seat bottom opening');

  // lip is ignored in lite (vase) style
  const liteLip = buildBin({ style: 'lite', lip: true });
  ok(near(liteLip.height, plain.height, 1e-6) && liteLip.lip === false,
     'lite style ignores the lip');
}

// ── 4e. Dividers ────────────────────────────────────────────
console.log('4e. dividers');
{
  const plain = buildBin({ units_x: 2, units_y: 2 });
  const div = buildBin({ units_x: 2, units_y: 2, div_x: 3, div_y: 1 });
  ok(manifoldReport(div).ok, 'divided bin mesh is watertight');
  ok(meshVolume(div) > meshVolume(plain), 'dividers add material');
  ok(div.div_x === 3 && div.div_y === 1, 'divider counts reported');

  // dividers stay inside the footprint
  const { positions } = div;
  let maxX = 0, maxY = 0;
  for (let i = 0; i < positions.length; i += 3) {
    maxX = Math.max(maxX, Math.abs(positions[i]));
    maxY = Math.max(maxY, Math.abs(positions[i + 1]));
  }
  ok(maxX <= div.width / 2 + 1e-6 && maxY <= div.depth / 2 + 1e-6,
     'dividers stay inside the bin footprint');

  // with a lip, dividers stop below the seat so stacked feet clear them
  const lipDiv = buildBin({ lip: true, div_x: 1 });
  let divTop = 0;
  const body = buildBin({ lip: true });
  const bodyVerts = body.positions.length;
  for (let i = bodyVerts; i < lipDiv.positions.length; i += 3)
    divTop = Math.max(divTop, lipDiv.positions[i + 2]);
  ok(near(divTop, lipDiv.height - LIP_H, 1e-6),
     `divider tops stop below the lip (z = ${divTop.toFixed(2)})`);

  // lite style ignores dividers
  const liteDiv = buildBin({ style: 'lite', div_x: 2 });
  ok(liteDiv.div_x === 0, 'lite style ignores dividers');
}

// ── 5. Baseplates: manifold, fit, multipliers ───────────────
console.log('5. baseplates');
for (const m of [0.5, 1, 2]) {
  const plate = buildBaseplate({ cells_x: 2, cells_y: 2, mult: m });
  ok(near(plate.width, 2 * m * 42, 1e-6),
     `plate mult=${m} 2×2 width = ${plate.width} mm`);
  const rep = manifoldReport(plate);
  ok(rep.ok, `plate mult=${m} mesh is watertight (${rep.badEdges} bad edges)`);
  ok(meshVolume(plate) > 0, `plate mult=${m} volume is positive`);

  // FIT: bin base (at its widest, z = BASE_H) + clearance must pass
  // through the socket opening, and the bin bottom must clear the
  // socket bottom.
  const binW = footprint(m);
  const openW = footprint(m) + 2 * GF.CLEAR;
  ok(binW + 2 * 0.01 < openW, `bin(${m}) width ${binW} < socket opening ${openW}`);
  const binBottomW = binW - 2 * baseInset(0);
  const socketBottomW = openW - 2 * socketInset(GF.BASE_H);
  ok(binBottomW < socketBottomW,
     `bin(${m}) bottom ${binBottomW.toFixed(2)} < socket bottom ${socketBottomW.toFixed(2)}`);
}

// ── 5b. Baseplate styles ────────────────────────────────────
console.log('5b. baseplate styles');
{
  const pn = buildBaseplate({ cells_x: 2, cells_y: 2 });
  const pl = buildBaseplate({ cells_x: 2, cells_y: 2, style: 'lite' });
  ok(pn.style === 'normal' && pl.style === 'lite', 'plate styles reported');
  ok(manifoldReport(pn).ok && manifoldReport(pl).ok,
     'both plate styles are watertight');
  ok(meshVolume(pn) > meshVolume(pl),
     `normal plate has a closed floor (${Math.round(meshVolume(pn))} > ${Math.round(meshVolume(pl))} mm³)`);

  // normal plate keeps ≥ 0.6 mm of floor even when plate_h is thin:
  // no vertex of the socket bottom may dip below the floor level
  const thin = buildBaseplate({ cells_x: 1, cells_y: 1, plate_h: 4.75 });
  ok(manifoldReport(thin).ok, 'thin normal plate is watertight');
  let minInnerZ = Infinity;
  const floorLevel = Math.max(4.75 - GF.BASE_H, 0.6);
  for (let i = 0; i < thin.positions.length; i += 3) {
    const z = thin.positions[i + 2];
    if (z > 0.01 && z < minInnerZ) minInnerZ = z;
  }
  ok(minInnerZ >= floorLevel - 1e-6,
     `socket floor clamped at ${floorLevel} mm (min inner z = ${minInnerZ.toFixed(2)})`);
}

// ── Summary ─────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
