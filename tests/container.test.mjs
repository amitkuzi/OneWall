// Container + magnet-bayonet lid — sizing and geometry validation
// Run: node tests/container.test.mjs
import {
  PATTERNS, buildContainer, solveDims, filletVolume, capacityMm3,
  revolve, patternValue, knurlValue,
} from '../assets/container.js';
import { meshVolume } from '../assets/bayonet.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✗', msg); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// every directed edge once, with its reverse once (degenerate triangles ignored)
function manifold({ i }) {
  const dir = new Map();
  for (let t = 0; t < i.length; t += 3) {
    if (i[t] === i[t + 1] || i[t + 1] === i[t + 2] || i[t] === i[t + 2]) continue;
    for (let e = 0; e < 3; e++) {
      const k = i[t + e] + '>' + i[t + (e + 1) % 3];
      dir.set(k, (dir.get(k) || 0) + 1);
    }
  }
  let bad = 0;
  for (const [k, n] of dir) {
    const [a, b] = k.split('>');
    if (n !== 1 || dir.get(b + '>' + a) !== 1) bad++;
  }
  return bad;
}

// ── 1. capacity maths ───────────────────────────────────────
console.log('1. volume / radius / height');
{
  // fillet of radius rf on a cylinder of radius R: cross-check by numeric integration
  const R = 30, rf = 6;
  let v = 0;
  const N = 200000;
  for (let k = 0; k < N; k++) {
    const x = R - rf + rf * (k + 0.5) / N;
    const hgt = rf - Math.sqrt(rf * rf - (x - (R - rf)) ** 2);
    v += 2 * Math.PI * x * hgt * (rf / N);
  }
  ok(near(filletVolume(R, rf) / v, 1, 2e-3), `fillet volume matches numeric integration (${filletVolume(R, rf).toFixed(1)} mm³)`);
  ok(filletVolume(30, 0) === 0, 'no fillet → no fillet volume');

  const a = solveDims({ solve: 'height', volume: 500, radius: 35 });
  ok(near(capacityMm3(a.radius, a.height, 6) / 1000, 500, 0.01), `height from volume round-trips (${a.height.toFixed(1)} mm)`);
  const b = solveDims({ solve: 'radius', volume: 500, height: 90 });
  ok(near(capacityMm3(b.radius, 90, 6) / 1000, 500, 0.01), `radius from volume round-trips (${b.radius.toFixed(1)} mm)`);
  const c = solveDims({ solve: 'volume', radius: 35, height: 90 });
  ok(near(c.volume, capacityMm3(35, 90, 6) / 1000, 1e-9), `volume from radius + height (${c.volume.toFixed(0)} mL)`);
  ok(solveDims({ solve: 'height', volume: 500, radius: 50 }).height < a.height, 'wider jar is shorter for the same volume');
  ok(solveDims({ solve: 'height', volume: 500, radius: 35, fillet: 0 }).height < a.height,
     'the fillet costs height: without it the same volume is shorter');
}

// ── 2. texture functions ────────────────────────────────────
console.log('2. patterns');
{
  const ctx = { count: 24, pitch: 10, R: 30 };
  for (const kind of PATTERNS) {
    let lo = 9, hi = -9, seam = 0;
    for (let k = 0; k < 4000; k++) {
      const v = patternValue(kind, (k * 0.0137) % (2 * Math.PI), (k * 0.29) % 50, ctx);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    for (let k = 0; k < 40; k++)
      seam = Math.max(seam, Math.abs(patternValue(kind, 0, k * 1.7, ctx) -
                                     patternValue(kind, 2 * Math.PI - 1e-9, k * 1.7, ctx)));
    ok(lo >= -1e-9 && hi <= 1 + 1e-9, `${kind}: stays in 0..1 (${lo.toFixed(2)}…${hi.toFixed(2)})`);
    ok(seam < 1e-6, `${kind}: no seam at 360°`);
    if (kind !== 'smooth') ok(hi - lo > 0.5, `${kind}: actually varies`);
  }
  let seam = 0;
  for (let k = 0; k < 40; k++)
    seam = Math.max(seam, Math.abs(knurlValue(96, 0, k * 0.37, 2) - knurlValue(96, 2 * Math.PI - 1e-9, k * 0.37, 2)));
  ok(seam < 1e-6, 'knurl: no seam at 360°');
}

// ── 3. revolve primitive ────────────────────────────────────
console.log('3. revolve');
{
  const prof = [{ s: 0, z: 0 }, { s: 10, z: 0 }, { s: 10, z: 20 }, { s: 0, z: 20 }];
  const m = revolve(prof, 360, () => 0);
  ok(manifold(m) === 0, 'disc-ended cylinder is watertight');
  ok(near(meshVolume(m) / (Math.PI * 100 * 20), 1, 5e-4), 'cylinder volume matches π r² h');
  const bumpy = [{ s: 0, z: 0 }, { s: 10, z: 0 }, { s: 10, z: 5, f: 1 }, { s: 10, z: 10, f: 1 }, { s: 0, z: 10 }];
  ok(manifold(revolve(bumpy, 90, (f, th) => 1 + Math.cos(th * 6))) === 0, 'displaced wall stays watertight');
}

// ── 4. whole containers ─────────────────────────────────────
console.log('4. containers');
const CASES = [
  {},
  { pattern: 'smooth', knurl: 'off' },
  { pattern: 'rings', knurl: 'lid' },
  { pattern: 'diamond', knurl: 'body' },
  { pattern: 'hex', pattern_count: 18, knurl: 'both' },
  { pattern: 'spiral', pattern_count: 12, knurl: 'off', fillet: 0 },
  { solve: 'radius', volume: 800, height: 120, radius: 40, magnet_d: 8, magnet_h: 3 },
  { solve: 'volume', radius: 22, height: 70, magnet_d: 4, magnet_h: 1.5, direction: 'left', teeth: 3 },
];
for (const bp of CASES) {
  const label = JSON.stringify(bp);
  const t0 = Date.now();
  const { plan, parts } = buildContainer(bp);
  const [lid, body] = parts;
  ok(parts.length === 2 && lid.name === 'lid' && body.name === 'body', `${label}: lid + body`);
  ok(plan.warnings.length === 0, `${label}: no warnings (${plan.warnings.join('; ') || 'ok'})`);
  let closed = true, positive = true;
  for (const part of parts)
    for (const m of [part.body, part.add, ...part.cuts].filter(Boolean)) {
      if (manifold(m) !== 0) closed = false;
      if (meshVolume(m) <= 0) positive = false;
    }
  ok(closed, `${label}: body, lid, pins and cutters are watertight`);
  ok(positive, `${label}: every piece has positive volume`);
  ok(plan.box.zBot < plan.box.zfl, `${label}: floor has thickness`);
  ok(Date.now() - t0 < 4000, `${label}: built in ${Date.now() - t0} ms, M=${plan.box.M}, ${(body.body.i.length / 3) | 0} body tris`);
}

// ── 5. the size that was asked for is the size that comes out ──
console.log('5. size honoured');
{
  const { plan } = buildContainer({ solve: 'height', volume: 400, radius: 32 });
  ok(near(plan.box.volume, 400, 0.01), `capacity ${plan.box.volume.toFixed(1)} mL = 400 mL asked`);
  ok(near(plan.box.height, plan.zFlip - plan.box.zfl, 1e-9), 'inner height = floor → lid underside');
  ok(near(plan.rb, 32, 1e-9), 'connector bore = inner radius (the opening is as wide as the jar)');
  ok(plan.box.flangeD > plan.box.outerD, 'socket flange is wider than the wall');
  const sm = buildContainer({ volume: 20, radius: 30 });
  ok(sm.plan.warnings.some(w => /smallest jar/.test(w)), 'a volume that cannot fit the connector is flagged');
  ok(sm.plan.box.volume > 20, 'and the jar grows to the smallest that works instead of breaking');

  const flat = buildContainer({ pattern: 'smooth', knurl: 'off' }).parts[1].body;
  const fl = buildContainer({ pattern: 'flutes', knurl: 'off', pattern_amp: 1.2 }).parts[1].body;
  ok(meshVolume(fl) > meshVolume(flat), 'pattern only adds plastic outside');
  // the inside never moves: smallest radius of any vertex above the floor fillet is the bore
  const inner = m => { let v = 1e9; for (let k = 0; k < m.p.length; k += 3) if (m.p[k + 2] > -1) v = Math.min(v, Math.hypot(m.p[k], m.p[k + 1])); return v; };
  ok(near(inner(fl), inner(flat), 1e-6), 'inner wall is identical with and without the pattern');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
