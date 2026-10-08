// ════════════════════════════════════════════════════════════
//  Container with a magnet-bayonet lid — sizing + geometry module
//  Dependency-free ES module (apart from bayonet.js): runs in the
//  browser — index.html does the CSG and wraps the buffers into THREE
//  geometry — and in Node for tests/container.test.mjs.
//
//  A round jar. The lid is the PLUG of a male + female bayonet
//  (assets/bayonet.js) and the body carries the matching SOCKET, so the
//  connector is closed: the plug sits inside the socket wall, the pins
//  hide in slots under an outer skin. Magnets only keep the pins at
//  the end of the twist; the hooks hold the lid.
//
//  CAPACITY. `volume` (mL = cm³) is the sealed capacity: inner radius ×
//  the height from the inside of the floor up to the underside of the
//  closed lid, minus the material of the inside bottom fillet. Give any
//  two of volume / radius / height and the third is calculated
//  (`solve`). Pins, the plug tube and the c-gaps are ignored (< 1 %).
//
//  FOOD COATING. The inside is smooth and rounded: one fillet at the
//  floor, one in the lid, no corner sharper than that. The pattern and
//  the knurl live on the OUTSIDE only, as outward bumps, so they never
//  thin the wall.
//
//  COORDINATES. The bayonet frame: z = 0 is the floor of the socket
//  (its top face), the socket rim is at z = Hf, the closed lid's
//  underside is at z = zFlip = Hf + c. The container hangs below z = 0.
// ════════════════════════════════════════════════════════════

import { BAYONET_DEFAULTS, buildBayonet, planBayonet, mergeMeshes, orient } from './bayonet.js';

export const CONTAINER_DEFAULTS = {
  // — size: any two of volume / radius / height, the third is calculated —
  solve: 'height',          // height | radius | volume — the one that is calculated
  volume: 300,              // mL (cm³), sealed capacity
  radius: 30,               // inner radius, mm
  height: 100,              // inner height, floor → lid underside, mm
  wall: 2.4,                // body wall, mm
  floor_t: 3,               // floor, mm
  lid_t: 6,                 // lid top plate, mm
  fillet: 6,                // inside fillet radius (floor and lid), mm — for resin coating
  // — outside pattern —
  pattern: 'flutes',        // smooth | flutes | rings | diamond | hex | spiral
  pattern_amp: 0.8,         // bump height, mm
  pattern_count: 24,        // repeats around the circumference
  pattern_pitch: 10,        // vertical repeat (rings, diamond, spiral), mm
  pattern_fade: 8,          // the pattern eases in/out over this height, mm
  // — knurl —
  knurl: 'both',            // off | lid | body | both
  knurl_pitch: 2.2,         // mm between ridges (coarser on big jars: see MAX_KNURL)
  knurl_depth: 0.5,         // mm
  knurl_h: 14,              // height of the grip band on the body, mm
  // — text on the lid's outer face —
  lid_text: '',             // empty = none
  lid_text_size: 10,        // letter height, mm (shrinks to fit the lid)
  lid_text_depth: 0.6,      // mm
  lid_text_mode: 'engrave', // engrave | recess (raised letters inside a shallow recessed disc)
  // — closure: how the lid joins the jar —
  closure: 'plug',          // plug = male+female, closed | twin = two identical hook halves + skirt
  // — bayonet (magnet) —
  magnet_d: 6, magnet_h: 2,
  fit: 0.4, ribs: 4, crush: 0.15,
  clearance: 0.2,
  mwall: 1.2,               // plastic around each magnet
  teeth: 0,                 // pins / slots, 0 = auto
  direction: 'right',
  chamfer: 0.8,             // bottom edge chamfer, mm
};

export const CONTAINER_KEYS = Object.keys(CONTAINER_DEFAULTS);
export const PATTERNS = ['smooth', 'flutes', 'rings', 'diamond', 'hex', 'spiral'];
export const SKIRT_T = 2.2;      // twin closure: wall of the lid skirt that hides the hooks, mm
export const MAX_KNURL = 120;     // ridges around — keeps the mesh printable-size and CSG-able

const TAU = 2 * Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (Number.isFinite(+v) ? +v : d);
// ramp from 0 at a to 1 at b (a > b ramps down); smooth at both ends
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const tri = x => 1 - 2 * Math.abs(x - Math.round(x));      // 1 on integers, 0 halfway

// ── Capacity ────────────────────────────────────────────────
// Material of a concave fillet of radius rf in the floor/wall corner of
// a cylinder of radius r (Pappus: 2π · ∫ x dA over the corner region).
export function filletVolume(r, rf) {
  if (!(rf > 0)) return 0;
  const sq = rf * rf * (r - rf / 2);
  const qd = (Math.PI * rf * rf / 4) * (r - rf + 4 * rf / (3 * Math.PI));
  return TAU * (sq - qd);
}
const rfFor = (o, r, h) => Math.max(0, Math.min(num(o.fillet, 6), 0.8 * r, 0.5 * h));
export const capacityMm3 = (r, h, rf, loss = 0) => Math.PI * r * r * h - filletVolume(r, rf) - loss;

// Tallest bump the outside can carry (pattern or knurl band). The wall is
// thickened so the valleys keep at least 0.8 mm.
function ampMax(o) {
  const pat = PATTERNS.includes(o.pattern) && o.pattern !== 'smooth' ? Math.max(0, num(o.pattern_amp, 0.8)) : 0;
  const kn = o.knurl === 'body' || o.knurl === 'both' ? Math.max(0, num(o.knurl_depth, 0.5)) : 0;
  return Math.max(pat, kn);
}
// Twin closure: the lid carries a skirt that hides the hooks, so the hook ring is
// narrower than the jar by the skirt and one clearance.
const twinOff = o => (o.closure === 'twin' ? SKIRT_T + Math.max(0, num(o.clearance, 0.2)) : 0);
// wall = outside radius (bump peaks) − inside radius
const wallFor = o => Math.max(num(o.wall, 2.4), ampMax(o) + 0.8);

const bayParams = (o, rb) => ({
  ...BAYONET_DEFAULTS,
  family: 'round', kind: o.closure === 'twin' ? 'twin' : 'malefemale', size_mode: 'inner',
  dia: 2 * rb, base_t: Math.max(3, num(o.lid_t, 6)),
  magnet_d: o.magnet_d, magnet_h: o.magnet_h, fit: o.fit, ribs: o.ribs, crush: o.crush,
  clearance: o.clearance, wall: o.mwall, teeth: o.teeth,
  direction: o.direction, chamfer: o.chamfer,
});

// The jar is as wide outside as the lid: the socket's outer radius `ro` is
// the jar's outer radius. The opening (the bayonet bore rb) is therefore
// narrower than the cavity by ringT − wall, and the cavity widens below
// the neck at 45° (prints without support). Find the bore for which
// ro = r + wall.
export function connectorPlan(o, r) {
  const wall = wallFor(o);
  let rb = Math.max(5, r);
  for (let k = 0; k < 6; k++) {
    const t = Math.max(5, r + wall - twinOff(o) - planBayonet(bayParams(o, rb)).ringT);
    if (Math.abs(t - rb) < 1e-7) break;
    rb = t;
  }
  return planBayonet(bayParams(o, rb));
}

// What the narrow neck takes away from the plain r × h cylinder: the 45°
// shoulder plus the bore above it, up to the underside of the closed lid.
export function neckLoss(plan, r) {
  const { rb, T, zFlip } = plan, d = Math.max(0, r - rb);
  return Math.PI * r * r * d - Math.PI * d / 3 * (r * r + r * rb + rb * rb)
       + Math.PI * (r * r - rb * rb) * (zFlip + T);
}
const capOf = (o, r, h) => capacityMm3(r, h, rfFor(o, r, h), neckLoss(connectorPlan(o, r), r));

// Solve the one quantity named by `solve` from the other two.
export function solveDims(bp = {}) {
  const o = { ...CONTAINER_DEFAULTS, ...bp };
  let V = Math.max(1, num(o.volume, 300)) * 1000;      // mm³
  let r = Math.max(8, num(o.radius, 30));
  let h = Math.max(5, num(o.height, 100));
  if (o.solve === 'volume') {
    V = capOf(o, r, h);
  } else if (o.solve === 'radius') {
    let lo = 8, hi = 600;                              // capacity grows with r
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (capOf(o, mid, h) < V) lo = mid; else hi = mid;
    }
    r = (lo + hi) / 2;
  } else {
    const loss = neckLoss(connectorPlan(o, r), r);
    for (let k = 0; k < 20; k++)                       // the fillet clamp depends on h
      h = (V + filletVolume(r, rfFor(o, r, h)) + loss) / (Math.PI * r * r);
  }
  return { volume: V / 1000, radius: r, height: h, loss: neckLoss(connectorPlan(o, r), r) };
}

// ── Outside texture ─────────────────────────────────────────
// 0..1 bump height at angle theta and height z. `ctx` = { count, pitch, R }.
export function patternValue(kind, theta, z, ctx) {
  const n = ctx.count, a = n * theta / TAU;
  switch (kind) {
    case 'flutes': return 0.5 + 0.5 * Math.cos(TAU * a);
    case 'rings':  return 0.5 + 0.5 * Math.cos(TAU * z / ctx.pitch);
    case 'spiral': return 0.5 + 0.5 * Math.cos(TAU * (a + z / ctx.pitch));
    case 'diamond': return Math.min(tri(a + z / ctx.pitch), tri(a - z / ctx.pitch));
    case 'hex': {
      // domes on a honeycomb lattice; one cell is `w` mm wide
      const w = TAU * ctx.R / n, b = z / w, rowH = Math.sqrt(3) / 2;
      const j0 = Math.round(b / rowH);
      let best = 9;
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        const off = (j & 1) ? 0.5 : 0;
        const i = Math.round(a - off);
        best = Math.min(best, Math.hypot(a - (i + off), b - j * rowH));
      }
      return ss(0.5, 0.12, best);
    }
    default: return 0;
  }
}

// Diamond knurl: crossed 45° ridges, K of them around.
export const knurlValue = (K, theta, z, pitchZ) =>
  Math.min(tri(K * theta / TAU + z / pitchZ), tri(K * theta / TAU - z / pitchZ));

// ── Revolve ─────────────────────────────────────────────────
// profile: CCW loop of { s, z, f } in (radius, height); s = 0 is a point
// on the axis (one shared vertex). f != 0 marks wall points whose
// radius is pushed out by disp(f, theta, z) at every angle. Rings are
// M segments; the loop is closed, so the result is watertight.
export function revolve(profile, M, disp) {
  const np = profile.length;
  const pole = profile.map(q => q.s === 0 && !q.f);
  const p = [], start = [];
  for (let k = 0; k < np; k++) {
    const q = profile[k];
    start.push(p.length / 3);
    if (pole[k]) { p.push(0, 0, q.z); continue; }
    for (let j = 0; j < M; j++) {
      const th = TAU * j / M;
      const rad = q.s + (q.f ? disp(q.f, th, q.z) : 0);
      p.push(rad * Math.cos(th), rad * Math.sin(th), q.z);
    }
  }
  const i = [];
  for (let a = 0; a < np; a++) {
    const b = (a + 1) % np;
    if (pole[a] && pole[b]) continue;
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M;
      if (pole[a]) {
        i.push(start[a], start[b] + j2, start[b] + j);
      } else if (pole[b]) {
        i.push(start[a] + j, start[a] + j2, start[b]);
      } else {
        const A = start[a] + j, B = start[a] + j2, C = start[b] + j2, D = start[b] + j;
        i.push(A, B, C, A, C, D);
      }
    }
  }
  return orient({ p, i });
}

// z values from a to b, no further apart than step (both ends included)
function zRange(a, b, step) {
  const n = Math.max(1, Math.ceil((b - a) / step - 1e-9));
  return Array.from({ length: n + 1 }, (_, k) => a + (b - a) * k / n);
}
// merge several z lists, dropping near-duplicates
function zMerge(...lists) {
  const all = lists.flat().sort((x, y) => x - y), out = [];
  for (const z of all) if (!out.length || z - out[out.length - 1] > 1e-6) out.push(z);
  return out;
}
// concave fillet: arc from (s, z0 + rf) to (s − rf, z0), centre (s − rf, z0 + rf)
function filletArc(s, z0, rf, steps = 10) {
  const pts = [];
  for (let k = 1; k <= steps; k++) {
    const phi = -Math.PI / 2 * k / steps;
    pts.push({ s: s - rf + rf * Math.cos(phi), z: z0 + rf + rf * Math.sin(phi) });
  }
  return pts;
}
// drop zero-length edges; where two points coincide keep the one that carries a wall flag
const dedupe = prof => {
  const out = [];
  for (const q of prof) {
    const last = out[out.length - 1];
    if (last && Math.abs(q.s - last.s) < 1e-7 && Math.abs(q.z - last.z) < 1e-7) {
      if (q.f && !last.f) out[out.length - 1] = q;
    } else out.push(q);
  }
  return out;
};

// ── Build ───────────────────────────────────────────────────
// Returns { plan, parts }: parts = [lid, body], each in the bayonet part
// shape { name, role, body, add, cuts, magnets } so index.html can run
// the same CSG on them as for the Bayonet tab. plan = the bayonet plan
// plus `box`: every number the UI shows.
export function buildContainer(bp = {}) {
  const o = { ...CONTAINER_DEFAULTS, ...bp };
  const dims = solveDims(o);
  const r = dims.radius;
  const warnings = [];

  const lidT = Math.max(3, num(o.lid_t, 6));
  const cp = connectorPlan(o, r);
  const { plan, parts } = buildBayonet(bayParams(o, cp.rb));
  warnings.push(...plan.warnings);

  const { ro, rb, rfb, rmo, Hf, Hm, T, zFlip } = plan;
  const ch = Math.max(0, Math.min(plan.chamfer, T / 2, (ro - rb) / 3));
  const twin = o.closure === 'twin';
  const off = twinOff(o);
  const Rout = ro + off;                             // outside radius of the jar AND of the lid (bump peaks)
  const wall = Rout - r;                             // outside (bump peaks) − inside
  const floorT = Math.max(0.8, num(o.floor_t, 3));
  const neckD = Math.max(0, r - rb);                 // the shoulder from the opening out to the cavity
  const zc0 = -T - neckD;                            // where the cavity reaches its full radius
  const loss = neckLoss(plan, r);

  // floor level, floor → lid underside is `height`
  let zfl = zFlip - dims.height;
  const zflMax = zc0 - 1;
  if (zfl > zflMax) {
    zfl = zflMax;
    const minV = capacityMm3(r, zFlip - zfl, rfFor(o, r, zFlip - zfl), loss) / 1000;
    warnings.push(`Too small for this connector at radius ${r.toFixed(1)} mm — the smallest jar here holds ${minV.toFixed(0)} mL. Raise the volume, widen the jar or use smaller magnets.`);
  }
  const hIn = zFlip - zfl;
  const rf = rfFor(o, r, hIn);
  const rfl = Math.max(0, Math.min(rf, zc0 - zfl - 0.5));  // fillet that fits under the shoulder
  const capacity = capacityMm3(r, hIn, rf, loss) / 1000;
  const zBot = zfl - floorT;

  // — wall texture —
  const kind = PATTERNS.includes(o.pattern) ? o.pattern : 'smooth';
  const nPat = Math.max(2, Math.round(num(o.pattern_count, 24)));
  const amp = Math.max(0, num(o.pattern_amp, 0.8));
  const pPitch = Math.max(2, num(o.pattern_pitch, 10));
  const fade = Math.max(0.5, num(o.pattern_fade, 8));
  const useKnurl = o.knurl !== 'off';
  const kBody = o.knurl === 'body' || o.knurl === 'both';
  const kLid = o.knurl === 'lid' || o.knurl === 'both';
  const kDepth = Math.max(0, num(o.knurl_depth, 0.5));
  // ridge count: a multiple of the pattern count, so every ring has samples on both grids
  let K = 0;
  if (useKnurl) {
    const want = Math.round(TAU * Rout / Math.max(1, num(o.knurl_pitch, 2.2)));
    K = nPat * Math.max(2, Math.round(want / nPat));
    while (K > MAX_KNURL && K > 2 * nPat) K -= nPat;
  }
  const M = useKnurl && (kBody || kLid) ? Math.max(4 * K, 8 * nPat)
          : kind !== 'smooth' ? Math.max(120, 8 * nPat) : 120;
  // bump PEAKS sit on the socket's outer radius, so the jar is exactly as wide as the lid
  const Rw = Rout - ampMax(o);
  const Rl = Rout - (kLid ? kDepth : 0);            // lid edge base
  const kPitchBody = TAU * Rw / Math.max(K, 1);
  const kPitchLid = TAU * Rout / Math.max(K, 1);

  const zw0 = zBot + ch, zw1 = twin ? -(Rout - Rw) : -T;
  const lidTop = twin ? plan.G - plan.c : 0;         // top of the lid's edge (twin: the skirt)
  const kh = kBody ? clamp(num(o.knurl_h, 14), 2, Math.max(2, zw1 - zw0 - 1)) : 0;
  const patLo = zw0 + kh;
  const bodyDisp = (f, th, z) => {
    let d = 0;
    if (kind !== 'smooth' && amp > 0)
      d = amp * patternValue(kind, th, z, { count: nPat, pitch: pPitch, R: Rw })
        * ss(patLo, patLo + fade, z) * ss(zw1, zw1 - fade, z);
    if (kBody) {
      const dk = kDepth * knurlValue(K, th, z, kPitchBody)
        * ss(zw0, zw0 + 0.8, z) * ss(zw0 + kh, zw0 + kh - 1.5, z);
      if (dk > d) d = dk;
    }
    return d;
  };
  const lidDisp = (f, th, z) => kDepth * knurlValue(K, th, z, kPitchLid)
    * ss(-T + ch, -T + ch + 0.8, z) * ss(lidTop, lidTop - 0.8, z);

  // — body: socket + flange + patterned wall + rounded inside —
  const dzPat = kind === 'rings' || kind === 'diamond' || kind === 'spiral'
    ? clamp(pPitch / 8, 0.5, 1.5)
    : kind === 'hex' ? clamp(TAU * Rw / nPat * 0.87 / 8, 0.5, 1.5) : 6;   // flutes / smooth: only the fades need rings
  const wallZ = zMerge(
    zRange(zw0, zw1, kind === 'smooth' ? Math.max(zw1 - zw0, 1) : dzPat),
    zRange(zw1 - fade, zw1, 1), zRange(patLo, patLo + fade, 1),
    kBody ? zRange(zw0, zw0 + kh, Math.max(0.3, kPitchBody / 4)) : [],
  ).filter(z => z >= zw0 - 1e-9 && z <= zw1 + 1e-9);
  const bodyProf = [
    { s: 0, z: zBot }, { s: Rw - ch, z: zBot },
    ...wallZ.map(z => ({ s: Rw, z, f: 1 })),
    ...(twin
      ? [{ s: Rout, z: 0 }, { s: rb, z: 0 }]       // flat top: the hooks stand on it, the lid skirt lands beside them
      : [{ s: Rout, z: zw1 + (Rout - Rw) }, { s: Rout, z: Hf }, { s: rfb, z: Hf }, { s: rfb, z: 0 }, { s: rb, z: 0 }]),
    { s: rb, z: -T }, { s: r, z: zc0 }, { s: r, z: zfl + rfl },
    ...(rfl > 0.05 ? filletArc(r, zfl, rfl) : [{ s: r, z: zfl }]),
    { s: 0, z: zfl },
  ];
  const bodyMesh = revolve(dedupe(bodyProf), M, bodyDisp);

  // — lid: plate (knurled edge), bore capped. plug: hollow plug with a rounded inside;
  //   twin: a skirt around the hooks —
  const rflLid = twin ? 0 : Math.max(0, Math.min(rf, Hm - 0.6));
  const lidEdgeZ = kLid ? zRange(-T + ch, lidTop, Math.max(0.3, kPitchLid / 4)) : [-T + ch, lidTop];
  const lidProf = [
    { s: 0, z: -T }, { s: Rl - ch, z: -T },
    ...lidEdgeZ.map(z => ({ s: Rl, z, f: kLid ? 2 : 0 })),
    ...(twin
      ? [{ s: Rout - SKIRT_T, z: lidTop }, { s: Rout - SKIRT_T, z: 0 }, { s: 0, z: 0 }]
      : [{ s: rmo, z: 0 }, { s: rmo, z: Hm }, { s: rb, z: Hm }, { s: rb, z: rflLid },
         ...(rflLid > 0.05 ? filletArc(rb, 0, rflLid) : [{ s: rb, z: 0 }]),
         { s: 0, z: 0 }]),
  ];
  const lidMesh = revolve(dedupe(lidProf), M, lidDisp);

  // plug: [plug, socket]; twin: the same hook set on both (the lid is the body's hooks, flipped)
  const [male, female] = twin ? [parts[0], parts[0]] : parts;
  const lid = { ...male, name: 'lid', body: lidMesh };
  const body = { ...female, name: 'body', body: bodyMesh };

  const box = {
    ...dims, volume: capacity, radius: r, height: hIn, solved: o.solve,
    wall, Rw, floorT, lidT: T, rf, rfl, rflLid, neckD, zfl, zBot, zc0, loss,
    outerD: 2 * Rout, flangeD: 2 * Rout, lidD: 2 * Rout, openD: 2 * rb, closure: twin ? 'twin' : 'plug',
    bodyH: (twin ? 0 : Hf) - zBot, totalH: zFlip + T - zBot,
    pattern: kind, M, K,
    wallVolume: 0,
  };
  plan.warnings = warnings;
  plan.box = box;
  plan.distinct = true;     // lid and body are two different solids even for a twin hook set
  plan.bedZ = -zBot;        // lifts the connector frame so the container stands on the bed
  return { plan, parts: [lid, body] };
}

export { mergeMeshes };
