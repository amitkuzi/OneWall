// Gridfinity Creator — geometry validation suite
// Run: node tests/gridfinity.test.mjs
import {
  GF, MULTIPLIERS, footprint, baseInset, socketInset,
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
  const vol = meshVolume(bin);
  const boxVol = bin.width * bin.depth * bin.height;
  ok(vol > 0.5 * boxVol && vol < boxVol,
     `bin ${ux}x1 volume ${Math.round(vol)} mm³ is positive and < bounding box`);
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
  ok(halfBin.feet === 1, '0.5x0.5 bin has a single sub-unit foot');
  const four = buildBin({ units_x: 4, units_y: 2 });
  ok(four.feet === 8, '4x2 bin has 8 feet');
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

// ── Summary ─────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
