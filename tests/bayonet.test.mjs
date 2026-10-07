// Bayonet Designer — sizing + geometry validation suite
// Run: node tests/bayonet.test.mjs
import {
  planBayonet, buildBayonet, magnetCount,
  meshVolume, triangulate, prism, sweep, cylinder, pocketCutter, roundPolygon,
} from '../assets/bayonet.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✗', msg); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// every undirected edge shared by exactly two triangles, once per direction
function manifold({ i }) {
  const dir = new Map();
  for (let t = 0; t < i.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const k = i[t + e] + '>' + i[t + (e + 1) % 3];
      dir.set(k, (dir.get(k) || 0) + 1);
    }
  let bad = 0;
  for (const [k, n] of dir) {
    const [a, b] = k.split('>');
    if (n !== 1 || dir.get(b + '>' + a) !== 1) bad++;
  }
  return bad;
}

// ── 1. triangulation ────────────────────────────────────────
console.log('1. ear clipping');
{
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  ok(triangulate(sq).length === 2, 'square → 2 triangles');
  const L = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 3], [0, 3]];
  const tris = triangulate(L);
  const area = tris.reduce((s, [a, b, c]) =>
    s + ((L[b][0] - L[a][0]) * (L[c][1] - L[a][1]) - (L[b][1] - L[a][1]) * (L[c][0] - L[a][0])) / 2, 0);
  ok(tris.length === 4 && near(area, 4), 'L-shape → 4 triangles, area 4');
  // collinear points along an edge (what subdivision creates)
  const col = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [0, 1]];
  ok(triangulate(col).length === 4, 'collinear boundary points all used (4 triangles)');
}

// ── 2. primitives are closed solids ─────────────────────────
console.log('2. primitives');
{
  const Fr = { round: true, rRef: 20, stepU: (4 * Math.PI / 180) * 20,
    map: (u, v, z) => [v * Math.cos(u / 20), v * Math.sin(u / 20), z] };
  const L = [[-3, 0], [3, 0], [3, 5], [12, 5], [12, 8], [-3, 8]];
  const pr = prism(Fr, L, 10, 14);
  ok(manifold(pr) === 0, 'round L-prism is watertight');
  ok(meshVolume(pr) > 0, 'round L-prism has positive volume');
  // a round tooth must stay ON its cylinder: no triangle may span more
  // than one 4° grid step, or a flat chord cuts the wall inside its radius
  {
    let worst = 0;
    for (let t = 0; t < pr.i.length; t += 3) {
      const ang = [0, 1, 2].map(k => Math.atan2(pr.p[pr.i[t + k] * 3 + 1], pr.p[pr.i[t + k] * 3]));
      let span = Math.max(...ang) - Math.min(...ang);
      if (span > Math.PI) span = 2 * Math.PI - span;
      worst = Math.max(worst, span);
    }
    ok(worst <= 4.05 * Math.PI / 180, `round prism triangles span ≤ 4° (worst ${(worst * 180 / Math.PI).toFixed(2)}°)`);
    // volume of a 12 mm × … L-section swept over radius 10–14 at rRef 20: area × arc-weighted radius
    const area = 6 * 8 + 9 * 3;                   // post + foot extension, mm²  (u × z)
    const expect = area * (14 ** 2 - 10 ** 2) / 2 / 20;   // ∫ r dr dθ with u = 20·θ
    ok(near(meshVolume(pr) / expect, 1, 0.01), 'round L-prism volume matches the exact annular-sector value');
  }
  const Fx = { round: false, rRef: 1, stepU: Infinity, map: (u, v, z) => [u, v, z] };
  const px = prism(Fx, L, 10, 14);
  ok(manifold(px) === 0 && meshVolume(px) > 0, 'rect L-prism is closed, positive volume');
  ok(near(meshVolume(px), (6 * 5 + 15 * 3) * 4, 1e-6), 'rect L-prism volume = area × depth');
  const cy = cylinder([0, 0, 0], [1, 0, 0], 3, 4);
  ok(manifold(cy) === 0 && meshVolume(cy) > 0, 'cylinder is closed, positive volume');
  ok(near(meshVolume(cy) / (Math.PI * 9 * 4), 1, 0.02), 'cylinder volume ≈ πr²L');
  const sw = sweep({ round: true, hx: 0, ro: 25 }, [[10, -3], [25, -3], [25, 0], [10, 0]]);
  ok(manifold(sw) === 0, 'revolved ring is watertight');
  ok(near(meshVolume(sw) / (Math.PI * (625 - 100) * 3), 1, 0.01), 'ring volume ≈ π(R²−r²)h');
  const sr = sweep({ round: false, hx: 30, ro: 20 }, [[10, -3], [20, -3], [20, 0], [10, 0]]);
  ok(manifold(sr) === 0, 'rect frame is watertight');
  const frame = (2 * 30) * (2 * 20) - (2 * 20) * (2 * 10);
  ok(near(meshVolume(sr), frame * 3, 1e-6), 'rect frame volume = (outer − inner) × h');
}

// ── 2b. press-fit magnet pocket ─────────────────────────────
console.log('2b. magnet pocket');
{
  const plan = planBayonet({ magnet_d: 6, fit: 0.4, ribs: 4, crush: 0.15 });
  const cut = pocketCutter(plan, [0, 0, 0], [1, 0, 0], 4);
  ok(manifold(cut) === 0 && meshVolume(cut) > 0, 'ribbed pocket cutter is closed, positive volume');
  const radii = [];
  for (let k = 0; k < cut.p.length; k += 3) radii.push(Math.hypot(cut.p[k + 1], cut.p[k + 2]));
  const nz = radii.filter(r => r > 1e-6);
  ok(near(Math.max(...nz), 3.2, 1e-6), 'bore is oversize: radius = magnet radius + fit/2 (drops in)');
  ok(near(Math.min(...nz), 3 - 0.15, 1e-6), 'rib tips stand 0.15 mm inside the magnet radius (press fit)');
  const plain = planBayonet({ magnet_d: 6, fit: 0.4, ribs: 0 });
  const pc = pocketCutter(plain, [0, 0, 0], [1, 0, 0], 4);
  ok(meshVolume(cut) < meshVolume(pc), 'ribs remove cutter volume (they are plastic left in the hole)');
  ok(near(meshVolume(pc) / (Math.PI * 3.2 * 3.2 * 4), 1, 0.02), 'ribs = 0 gives a plain round bore');
  ok(planBayonet({ ribs: 4 }).ribTip < 3, 'rib tip is inside the magnet');
}

// ── 2c. fillets and chamfer ─────────────────────────────────
console.log('2c. fillet / chamfer');
{
  const area = P => Math.abs(P.reduce((s, a, k) => { const b = P[(k + 1) % P.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const rr = roundPolygon(sq, 2);
  ok(rr.length > sq.length, 'rounding adds arc points');
  ok(near(area(rr), 100 - (4 - Math.PI) * 4, 0.4), 'four convex corners of r=2 remove (4−π)·r² each');
  const kept = roundPolygon(sq, 2, p => p[1] === 0);
  ok(kept.filter(p => p[1] === 0).length === 2 && area(kept) > area(rr), 'skipped corners stay sharp');
  const L = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
  ok(area(roundPolygon(L, 1)) > 0 && roundPolygon(L, 1).length > L.length * 3, 'concave corner is rounded too');
  ok(near(area(roundPolygon(L, 1)), area(L) - 5 * (1 - Math.PI / 4) + (1 - Math.PI / 4), 0.1),
     'five convex corners lose material, the concave one gains it');
  ok(roundPolygon(sq, 0) === sq, 'r = 0 leaves the polygon alone');
  const tight = roundPolygon([[0, 0], [2, 0], [2, 2], [0, 2]], 5);
  ok(tight.every(p => p[0] >= -1e-9 && p[0] <= 2 + 1e-9 && p[1] >= -1e-9 && p[1] <= 2 + 1e-9),
     'an oversize radius shrinks to fit instead of overshooting');

  const sharp = buildBayonet({ fillet: 0, chamfer: 0 }), soft = buildBayonet({});
  ok(meshVolume(soft.parts[0].body) < meshVolume(sharp.parts[0].body), 'chamfer removes volume from the ring');
  const T = soft.plan.T, ch = Math.min(0.8, T / 2, (soft.plan.ro - soft.plan.rb) / 3);
  const lost = meshVolume(sharp.parts[0].body) - meshVolume(soft.parts[0].body);
  const expect = (ch * ch / 2) * 2 * Math.PI * ((soft.plan.ro - ch / 3) + (soft.plan.rb + ch / 3));
  ok(near(lost / expect, 1, 0.03), 'chamfer volume = two 45° triangles swept round the ring');
  ok(meshVolume(soft.parts[0].add) < meshVolume(sharp.parts[0].add), 'fillets take material off the tooth corners');
  ok(planBayonet({}).fillet === 1 && planBayonet({}).chamfer === 0.8, 'defaults: 1 mm fillet, 0.8 mm chamfer');
}

// ── 3. auto sizing ──────────────────────────────────────────
console.log('3. auto sizing');
{
  const p = planBayonet({});
  ok(p.N === p.Nauto && p.N >= 2, `default round 50 mm → ${p.N} teeth`);
  ok(p.toothT >= p.magMin, 'tooth thickness holds the magnet');
  ok(p.F >= p.magMin, 'foot is tall enough for the magnet');
  ok(p.w >= p.Dp + p.wall, 'tooth is wide enough for the pocket');
  ok(p.warnings.length === 0, `default config raises no warnings (${p.warnings.join('; ')})`);
  ok(p.travel > 0.5, `positive travel (${p.travel.toFixed(1)} mm)`);
  ok(near(p.G, 2 * p.F + 3 * p.c), 'stack gap = 2 feet + 3 clearances');

  const small = planBayonet({ dia: 30 });
  const big = planBayonet({ dia: 120 });
  ok(big.N >= small.N, `bigger object → at least as many teeth (${small.N} → ${big.N})`);
  ok(planBayonet({ magnet_d: 10 }).N <= planBayonet({ magnet_d: 4 }).N,
     'bigger magnet → no more teeth than a smaller one');
  ok(big.toothT >= small.toothT, 'strength grows with size');

  const ov = planBayonet({ teeth: 2, tooth_w: 9, tooth_t: 10 });
  ok(ov.N === 2 && ov.w === 9 && ov.toothT === 10, 'teeth / width / strength overrides win');
  ok(ov.Nauto >= 2, 'auto value stays reported next to an override');
  ok(planBayonet({ teeth: 8 }).warnings.some(w => /collide/.test(w)), 'too many teeth warns');
  ok(planBayonet({ tooth_w: 2 }).warnings.some(w => /narrow/.test(w)), 'too narrow a tooth warns');

  const o = planBayonet({ size_mode: 'outer', dia: 50 });
  const i = planBayonet({ size_mode: 'inner', dia: 50 });
  ok(near(o.ro, 25) && near(o.rb, 25 - o.ringT), 'outer mode: dia is the outside');
  ok(near(i.rb, 25) && near(i.ro, 25 + i.ringT), 'inner mode: dia is the bore');

  const r = planBayonet({ family: 'rect', size_w: 100, size_d: 60 });
  ok(r.N >= 1 && r.warnings.length === 0, `rect 100×60 → ${r.N} teeth per row (${r.warnings.join('; ')})`);
  ok(planBayonet({ family: 'rect', size_w: 200, size_d: 60 }).N >= r.N, 'longer rect → at least as many teeth');
  const sx = planBayonet({ family: 'rect', size_w: 100, size_d: 60, slide_axis: 'x' });
  const sy = planBayonet({ family: 'rect', size_w: 100, size_d: 60, slide_axis: 'y' });
  ok(sx.L === 100 && sy.L === 60, 'slide axis picks the travel length');
  ok(planBayonet({ family: 'rect', size_w: 20, size_d: 20 }).warnings.length > 0,
     'rect too small for the magnets warns');

  ok(planBayonet({ direction: 'right' }).dir === -planBayonet({ direction: 'left' }).dir, 'direction mirrors');
  ok(planBayonet({ sleeve: true, sleeve_len: 20 }).T === 20, 'sleeve sets base length');
}

// ── 3b. 45° back ramp ───────────────────────────────────────
console.log('3b. back ramp');
{
  const full = planBayonet({});
  ok(near(full.bs, full.G - full.c + 0.2), 'default ramp runs the full post height (top edge → base)');
  ok(planBayonet({ back_slope: 0 }).bs === 0, 'back_slope = 0 turns the ramp off');
  ok(near(planBayonet({ back_slope: 3 }).bs, 3), 'a shorter ramp can be set');
  ok(full.Pmin > planBayonet({ back_slope: 0 }).Pmin, 'the ramp takes room from the tooth gap');
  ok(full.N <= planBayonet({ back_slope: 0 }).N, 'so it never allows more teeth');
  // one rect tooth spans ramp + post + foot along u, and the ramp is 45°:
  // its run equals the post height it climbs
  const { parts, plan } = buildBayonet({ family: 'rect', size_w: 100, size_d: 60, back_slope: 4, teeth: 1 });
  const p = parts[0].add.p;
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < p.length; k += 3) { lo = Math.min(lo, p[k]); hi = Math.max(hi, p[k]); }
  ok(near(hi - lo, plan.bs + plan.w + plan.e, 1e-6), 'tooth length = ramp run + post + foot reach');
  ok(near(plan.bs, 4), 'ramp run of 4 mm climbs 4 mm (45°)');
}

// ── 3c. weak-point checks ───────────────────────────────────
console.log('3c. weak points');
{
  for (const bp of [{}, { family: 'rect', size_w: 100, size_d: 60 }, { kind: 'malefemale', dia: 70 },
                    { family: 'rect', kind: 'malefemale', size_w: 120, size_d: 70 }]) {
    const p = planBayonet(bp);
    const weak = p.strength.filter(k => k.level === 'weak');
    ok(p.strength.length >= 6 && weak.length === 0,
       `${bp.family || 'round'}/${bp.kind || 'twin'}: ${p.strength.length} checks, no weak points`);
  }
  const thin = planBayonet({ tooth_t: 6.8, magnet_d: 6.5 });
  ok(thin.strength.some(k => k.id === 'tooth_radial' && k.level === 'weak'),
     'a tooth barely thicker than the magnet is flagged weak');
  ok(thin.warnings.some(w => /Weak point/.test(w)), 'weak points surface as warnings');
  ok(planBayonet({ tooth_w: 3 }).strength.some(k => k.id === 'post_back' && k.level !== 'ok'),
     'a post too narrow for its magnet pocket is flagged');
  const stubby = planBayonet({ tooth_t: 14, tooth_w: 14 });
  ok(stubby.strength.find(k => k.id === 'post_slender').level === 'ok', 'a thick post is not slender');
  ok(planBayonet({ base_t: 1 }).strength.find(k => k.id === 'base').level === 'weak', 'thin base is weak');
}

// the real default tooth (with its 45° back ramp) must also stay on its
// cylinder: no triangle wider than one grid step
{
  const { parts } = buildBayonet({});
  const m = parts[0].add;
  let worst = 0;
  for (let k = 0; k < m.i.length; k += 3) {
    const ang = [0, 1, 2].map(j => Math.atan2(m.p[m.i[k + j] * 3 + 1], m.p[m.i[k + j] * 3]));
    let span = Math.max(...ang) - Math.min(...ang);
    if (span > Math.PI) span = 2 * Math.PI - span;
    worst = Math.max(worst, span);
  }
  ok(worst <= 4.05 * Math.PI / 180, 'ramped tooth triangles span ≤ 4° (worst ' + (worst * 180 / Math.PI).toFixed(2) + '°)');
}

// ── 3d. overrides that used to leave teeth in the air ───────
console.log('3d. bad overrides');
{
  const mf = planBayonet({ family: 'rect', kind: 'malefemale', ring_t: 3.5, size_w: 60, size_d: 40, slide_axis: 'y' });
  ok(mf.ringT > 3.5 && mf.plugT >= 2.39, 'a too-thin ring wall cannot invert the male+female plug');
  ok(mf.warnings.some(w => /too thin/.test(w)), 'and says so');
  ok(mf.warnings.some(w => /at least [0-9]+ mm/.test(w)), 'a part too short for one slot says how long it must be');
  const tw = planBayonet({ ring_t: 3 });
  ok(tw.ringT >= tw.toothT + 0.4 && tw.warnings.some(w => /thinner than the teeth/.test(w)),
     'twin: a ring thinner than the teeth is corrected with a warning');
  ok(planBayonet({ ring_t: 12 }).ringT === 12, 'a thicker ring wall is honoured');
  // the short rect still builds a closed, sane plug
  const { parts } = buildBayonet({ family: 'rect', kind: 'malefemale', ring_t: 3.5, size_w: 60, size_d: 40, slide_axis: 'y' });
  ok(parts.every(p => meshVolume(p.body) > 0), 'short parts still build positive-volume bodies');
}

// the retaining lip above the pin is a real wall, not a sliver
{
  const p = planBayonet({ kind: 'malefemale', dia: 70 });
  const ceiling = p.Hf - (p.zcb + p.Fs);        // plastic above the circumferential slot
  ok(ceiling >= 2 - 1e-9, `lip over the pin is ${ceiling.toFixed(2)} mm (≥ 2)`);
  ok(p.strength.some(k => k.id === 'lip' && k.level === 'ok'), 'lip is part of the strength checks');
}

// ── 4. whole parts: every piece closed ──────────────────────
console.log('4. parts');
const CASES = [
  { family: 'round', kind: 'twin' },
  { family: 'round', kind: 'twin', direction: 'left', size_mode: 'inner', dia: 40 },
  { family: 'round', kind: 'malefemale', dia: 70 },
  { family: 'rect', kind: 'twin', size_w: 100, size_d: 60 },
  { family: 'rect', kind: 'twin', size_w: 100, size_d: 60, direction: 'left', teeth: 2 },
  { family: 'rect', kind: 'malefemale', size_w: 120, size_d: 70 },
];
for (const bp of CASES) {
  const label = `${bp.family}/${bp.kind}${bp.direction ? '/' + bp.direction : ''}`;
  const { plan, parts } = buildBayonet(bp);
  ok(plan.warnings.length === 0, `${label}: no warnings (${plan.warnings.join('; ') || 'ok'})`);
  const exp = plan.kind === 'malefemale' ? 2 : 1;
  ok(parts.length === exp, `${label}: ${exp} distinct part(s)`);
  let closed = true, positive = true;
  for (const part of parts)
    for (const m of [part.body, part.add, ...part.cuts].filter(Boolean)) {
      if (manifold(m) !== 0) closed = false;
      if (meshVolume(m) <= 0) positive = false;
    }
  ok(closed, `${label}: body, teeth and cutters are all watertight`);
  ok(positive, `${label}: every piece has positive volume`);
  ok(magnetCount(plan).total > 0, `${label}: ${magnetCount(plan).total} magnets in total`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
