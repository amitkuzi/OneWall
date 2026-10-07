// ════════════════════════════════════════════════════════════
//  Bayonet Designer — geometry + sizing math module
//  Dependency-free ES module: runs in the browser (index.html does
//  the CSG and wraps the buffers into THREE geometry) and in Node
//  for the test suite (tests/bayonet.test.mjs).
//
//  Two connector kinds, each in a ROUND (twist) and a RECTANGULAR
//  (slide) family:
//
//    twin        two IDENTICAL halves. Each has L-shaped teeth (a
//                post plus a foot). The second half is the first one
//                flipped, so its teeth are the mirror image; the feet
//                hook over each other. Print the same part twice.
//    malefemale  a plug with radial pins and a socket with L-slots.
//
//  Embedded magnets sit in the faces that meet at the end of the
//  twist/slide. They only keep the teeth together — the hook does
//  the holding.
//
//  UNROLLED COORDINATES. Every tooth is described in (u, z):
//    u = distance along the travel direction, mm
//        round: arc length at the reference radius rRef (angle = u/rRef)
//        rect : x
//    v = distance from the centre line (radius, or |y|)
//    z = axis height, 0 = top face of the base
//  A tooth is a polygon in (u, z) swept over a v range. The same
//  description therefore drives both families.
// ════════════════════════════════════════════════════════════

export const BAYONET_DEFAULTS = {
  family: 'round',          // round | rect
  kind: 'twin',             // twin | malefemale
  direction: 'right',       // right = clockwise twist / slide +X
  size_mode: 'outer',       // outer | inner
  dia: 50,                  // round: diameter, mm
  size_w: 60, size_d: 40,   // rect: width (X) and depth (Y), mm
  slide_axis: 'x',          // rect: slide along the width (x) or depth (y)
  sleeve: false,            // add a tube behind the connector to join an object
  sleeve_len: 12,
  magnet_d: 6, magnet_h: 2, // disc magnet, mm
  fit: 0.4,                 // pocket oversize over the magnet (diameter), mm — it drops in
  ribs: 4,                  // crush ribs inside the pocket that grip the magnet (0 = none)
  crush: 0.15,              // how far each rib bites into the magnet, mm — press fit
  recess: 0,                // magnet sits this far below the face, mm
  clearance: 0.2,           // print tolerance between moving parts, mm
  wall: 1.2,                // plastic left around each magnet, mm
  teeth: 0,                 // 0 = auto
  tooth_w: 0,               // 0 = auto — width of a tooth post along travel
  tooth_t: 0,               // 0 = auto — strength: radial thickness of a tooth
  back_slope: -1,           // 45° ramp on the back of each post, mm of run (-1 auto, 0 off)
  fillet: 1,                // radius on every corner of the tooth profile, mm (0 = sharp)
  chamfer: 0.8,             // 45° chamfer on the bottom edges of the ring, mm (0 = none)
  base_t: 0,                // 0 = auto — base plate thickness
  ring_t: 0,                // 0 = auto — wall of the base ring / frame
};

// Everything that changes the solid. view / engage only move meshes.
export const GEOMETRY_KEYS = Object.keys(BAYONET_DEFAULTS);

export const EPS_INSET = 0.4;   // teeth sit this far inside the outer face
export const MAX_TEETH = 8;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (Number.isFinite(+v) ? +v : d);

// ── Sizing ──────────────────────────────────────────────────
// Returns every number the builder needs plus the auto values the
// UI shows next to the override sliders. Never throws: nonsense input
// comes back with `warnings` so the sliders can pass through bad
// intermediate values while dragging.
export function planBayonet(bp = {}) {
  const o = { ...BAYONET_DEFAULTS, ...bp };
  const round = o.family === 'round';
  const mf = o.kind === 'malefemale';
  const warnings = [];

  const d = Math.max(0.5, num(o.magnet_d, 6));
  const h = Math.max(0.3, num(o.magnet_h, 2));
  const wall = Math.max(0.4, num(o.wall, 1.2));
  const c = Math.max(0, num(o.clearance, 0.2));
  const fit = Math.max(0, num(o.fit, 0.4));
  const ribs = Math.max(0, Math.round(num(o.ribs, 4)));
  const crush = Math.max(0, num(o.crush, 0.15));
  const recess = Math.max(0, num(o.recess, 0));

  const magMin = d + fit + 2 * wall;     // smallest tooth section holding a magnet in its (oversize) pocket
  const pocketD = d + fit;
  const Dp = h + fit + recess;           // pocket depth, measured from its face

  // Slide length L (along u) and lateral width Wd (rect only).
  let L = 0, Wd = 0;
  if (!round) {
    const alongY = o.slide_axis === 'y';
    L = alongY ? num(o.size_d, 40) : num(o.size_w, 60);
    Wd = alongY ? num(o.size_w, 60) : num(o.size_d, 40);
  }
  const size = round ? num(o.dia, 50) : Math.min(L, Wd);
  const refLen = round ? Math.PI * size : L;

  // — strength (tooth thickness) and width, auto from size —
  const toothT_auto = Math.max(magMin, Math.min(8, 0.08 * size));
  const toothT = o.tooth_t > 0 ? +o.tooth_t : toothT_auto;
  const F = Math.max(magMin, 0.6 * toothT);          // foot / pin height
  const w_auto = clamp(0.05 * refLen, Dp + wall + 0.8, 14);
  const w = o.tooth_w > 0 ? +o.tooth_w : w_auto;
  if (w < Dp + wall - 1e-9)
    warnings.push('Tooth width is too narrow for the magnet pocket.');
  if (toothT < magMin - 1e-9)
    warnings.push('Tooth thickness is too thin for the magnet diameter.');

  const dir = round ? (o.direction === 'right' ? -1 : 1)
                    : (o.direction === 'right' ? 1 : -1);

  const T = o.sleeve ? Math.max(1, num(o.sleeve_len, 12))
          : (o.base_t > 0 ? +o.base_t : clamp(0.04 * size, 2.4, 4));

  const plan = {
    family: o.family, kind: o.kind, round, dir,
    magMin, pocketD, Dp, fit, wall, c, ribs, crush,
    // rib tips sit INSIDE the magnet radius by `crush`: the magnet is
    // pressed past them, the plastic gives, and it stays put
    ribTip: d / 2 - crush,
    toothT, toothT_auto, F, w, w_auto, T,
    fillet: Math.max(0, num(o.fillet, 1)), chamfer: Math.max(0, num(o.chamfer, 0.8)),
    L, Wd, size, warnings,
    magnet: { d, h },
  };

  const sizing = mf ? planMaleFemale(o, plan) : planTwin(o, plan);
  const { warnings: more, ...rest } = sizing;
  Object.assign(plan, rest);
  plan.warnings.push(...more);
  plan.strength = strengthChecks(plan);
  for (const k of plan.strength)
    if (k.level === 'weak') plan.warnings.push(`Weak point: ${k.label} is ${k.value.toFixed(2)}${k.unit} (needs ${k.limit}${k.unit}).`);
  return plan;
}

// ── Weak-point checks ───────────────────────────────────────
// Analytic, from the sizing: the thinnest plastic around each magnet,
// how slender the post is, and how far the foot overhangs its thickness.
// level: ok | warn | weak. (The mesh-based thickness map in the UI is the
// visual counterpart — it measures the finished solid.)
export function strengthChecks(p) {
  const out = [];
  const wallLimit = p.wall;                       // plastic around a magnet
  const wall = (id, label, value) => out.push({
    id, label, value, unit: ' mm', limit: wallLimit.toFixed(1),
    level: value >= wallLimit - 1e-9 ? 'ok' : value >= 0.8 ? 'warn' : 'weak' });
  const ratio = (id, label, value, warn, weak) => out.push({
    id, label, value, unit: '×', limit: `≤ ${warn}`,
    level: value <= warn ? 'ok' : value <= weak ? 'warn' : 'weak' });
  const radial = (p.toothT - p.pocketD) / 2;
  const axial = (p.F - p.pocketD) / 2;
  if (p.kind === 'malefemale') {
    wall('pin_back', 'wall behind the pin magnet', p.w - p.Dp);
    wall('pin_radial', 'wall around the pin magnet (radial)', (p.pl - p.pocketD) / 2);
    wall('pin_axial', 'wall around the pin magnet (axial)', axial);
    wall('slot_wall', 'wall behind the slot magnet', p.P - p.uEnd - p.Dp - p.a);
    out.push({ id: 'skin', label: 'outer skin over the slot', value: p.skin, unit: ' mm',
      limit: '1.2', level: p.skin >= 1.2 ? 'ok' : p.skin >= 0.8 ? 'warn' : 'weak' });
    out.push({ id: 'lip', label: 'lip over the pin', value: p.lipT, unit: ' mm', limit: '2.0',
      level: p.lipT >= 2 ? 'ok' : p.lipT >= 1.2 ? 'warn' : 'weak' });
    ratio('pin_cantilever', 'pin overhang ÷ pin thickness', p.pl / Math.min(p.w, p.F), 1.5, 2.5);
  } else {
    wall('foot_back', 'wall behind the foot-tip magnet', p.e - p.Dp);
    wall('post_back', 'wall behind the post magnet', p.w - p.Dp);
    wall('tooth_radial', 'wall around the magnet (radial)', radial);
    wall('foot_axial', 'wall around the magnet (axial)', axial);
    ratio('post_slender', 'post height ÷ post thickness', (p.G - p.c) / Math.min(p.w, p.toothT), 4, 6);
    ratio('foot_cantilever', 'foot reach ÷ foot thickness', p.e / p.F, 1.5, 2.5);
  }
  out.push({ id: 'ring', label: 'ring / frame wall', value: p.ringT, unit: ' mm', limit: '2.0',
    level: p.ringT >= 2 ? 'ok' : p.ringT >= 1.2 ? 'warn' : 'weak' });
  out.push({ id: 'base', label: 'base plate thickness', value: p.T, unit: ' mm', limit: '2.0',
    level: p.T >= 2 ? 'ok' : p.T >= 1.2 ? 'warn' : 'weak' });
  return out;
}

// ── Twin: two identical hook halves ─────────────────────────
function planTwin(o, p) {
  const { round, w, toothT, F, c, Dp, wall } = p;
  const warnings = [];
  const e = Math.max(Dp + wall + 1, w);        // foot reach beyond the post
  const G = 2 * F + 3 * c;                     // base-to-base gap when locked
  // 45° ramp on the BACK of the post, from the top edge down to the base
  // (auto) or over a shorter run. It braces the post, prints without
  // support and lets the mating tooth ride into place. Both halves carry
  // it. Where it flares out at the base it takes room from the gap the
  // mating tooth drops into, so the period grows by the same amount.
  const zTopFull = G - c + 0.2;                // post height incl. the 0.2 overlap into the base
  // The ring wall must carry the whole tooth footprint; thinner would
  // leave the teeth hanging over the bore.
  const ringMin = toothT + EPS_INSET + (o.ring_t > 0 ? 0 : wall);
  const ringT = o.ring_t > ringMin ? +o.ring_t : ringMin;
  if (o.ring_t > 0 && o.ring_t < ringMin - 1e-9)
    warnings.push(`Ring wall ${(+o.ring_t).toFixed(1)} mm is thinner than the teeth (${ringMin.toFixed(1)} mm) — using ${ringMin.toFixed(1)} mm.`);

  let ro, rb, hx = 0;
  if (round) {
    if (o.size_mode === 'inner') { rb = o.dia / 2; ro = rb + ringT; }
    else { ro = o.dia / 2; rb = ro - ringT; }
  } else if (o.size_mode === 'inner') {
    ro = p.Wd / 2 + ringT; rb = p.Wd / 2; hx = p.L / 2 + ringT;
  } else {
    ro = p.Wd / 2; rb = ro - ringT; hx = p.L / 2;
  }
  if (rb < 2) warnings.push('Bore is smaller than 4 mm — the object is too small for these magnets.');
  if (!round && hx - ringT < 1) warnings.push('Frame is wider than the part — enlarge the size.');

  const rm = ro - EPS_INSET - toothT / 2;      // mean tooth radius / row offset
  const C = 2 * Math.PI * Math.max(rm, 1);
  // Rect: the row is shifted so that, once locked, the two plates sit
  // exactly on top of each other (beta1 = 0) — that costs room on one side.
  const Lu = 2 * hx - 6 - 2 * w - e - c;
  const shift = round ? 0 : -(w + e + c) / 2;

  // Tooth count and period for a given ramp run. The period must leave the
  // mating tooth room to drop in: window [w + 2e, P − w − bs] ≥ slack.
  const layout = bsTry => {
    const Pmin = 2 * (w + e) + bsTry + 2;
    const raw = round ? Math.floor(C / Pmin) : Math.floor(Math.max(Lu, 0) / Pmin) + 1;
    const Nauto = clamp(raw, round ? 2 : 1, MAX_TEETH);
    const N = o.teeth > 0 ? Math.round(o.teeth) : Nauto;
    const P = round ? C / N : (N > 1 ? Lu / (N - 1) : Pmin);
    return { Pmin, raw, Nauto, N, P, travel: P / 2 - w - c - bsTry / 2 };
  };
  // Auto ramp: the full post height (top edge → base) when the object is
  // big enough to keep two teeth and a usable twist, else as long as fits.
  let bs;
  if (o.back_slope >= 0) bs = Math.min(+o.back_slope, zTopFull);
  else {
    bs = zTopFull;
    while (bs > 0) {
      const t = layout(bs);
      if ((round ? t.raw >= 2 : true) && t.travel >= 3) break;
      bs = Math.max(0, bs - 1);
    }
  }
  const { Pmin, Nauto, N, P } = layout(bs);
  if (!round && Lu < 0) warnings.push('Row is shorter than one tooth — enlarge the size or use smaller magnets.');
  if (N > 1 && P < Pmin - 1e-6)
    warnings.push(`Too many teeth — they would collide. Maximum here is ${Nauto}.`);
  const travel = P / 2 - w - c - bs / 2;
  if (travel < 0.5) warnings.push('Almost no twist/slide travel — use fewer or narrower teeth.');

  return {
    e, G, bs, Pmin, ringT, ro, rb, hx, rm, rRef: round ? rm : 1,
    N, Nauto, P, shift, travel,
    // Offsets of the flipped half (mm along travel). Flipping maps a
    // tooth at u to β − u; the lattice is symmetric about `shift`, so
    // the two lattices meet with an extra 2·shift.
    // The drop-in window is [w + 2e, P − w − bs] (the mating foot must clear
    // this foot on the way down; the ramp flares into the other side);
    // sit in its middle.
    beta0: P / 2 + e - bs / 2 + 2 * shift,   // dropped in, teeth in the gaps
    beta1: w + e + c + 2 * shift,   // locked, hooks overlapped
    zFlip: G,                    // 2nd half sits flipped, base at z = G
    stack: 2 * p.T + G,          // total connector height when locked
    warnings,
  };
}

// ── Male / female: plug with pins, socket with L-slots ──────
function planMaleFemale(o, p) {
  const { round, w, toothT, F, c, Dp, wall } = p;
  const warnings = [];
  const pl = toothT;                           // pin length = slot depth (radial)
  const skin = Math.max(1.5, wall + 0.3);      // plastic left outside the slot
  const wallF = pl + skin;
  // The ring wall holds the socket wall, the clearance and the plug wall.
  // An override may make it thicker (a thicker plug); thinner would turn
  // the plug inside out, so it is ignored with a warning.
  const ringMin = wallF + c + Math.max(2.4, 2 * wall);
  const ringT = o.ring_t > ringMin ? +o.ring_t : ringMin;
  const plugT = ringT - wallF - c;
  if (o.ring_t > 0 && o.ring_t < ringMin - 1e-9)
    warnings.push(`Ring wall ${(+o.ring_t).toFixed(1)} mm is too thin for male+female — using ${ringMin.toFixed(1)} mm.`);
  // The lip over the pin is what holds the connector together; it was a
  // 0.6 mm sliver (zp − 2c). Make it a proper wall: at least 2 mm / 2 walls.
  const lipT = Math.max(2, 2 * wall);
  const floorT = 1.5, zp = lipT + 2 * c;
  const Hf = floorT + F + zp;                  // socket depth
  const Hm = zp + F + 0.8;                     // plug length
  const zcb = floorT;                          // circumferential slot bottom
  const Lt = w + 2 * c + 2;                    // pin travel to the stop
  const a = w / 2 + c;                         // axial slot half-width
  const uEnd = Lt + w / 2 + c;                 // slot end wall
  const span = uEnd + Dp + wall + a;           // one slot incl. magnet wall
  const Pmin = span + 1;

  let ro, rb, hx = 0;
  if (round) {
    if (o.size_mode === 'inner') { rb = o.dia / 2; ro = rb + ringT; }
    else { ro = o.dia / 2; rb = ro - ringT; }
  } else if (o.size_mode === 'inner') {
    ro = p.Wd / 2 + ringT; rb = p.Wd / 2; hx = p.L / 2 + ringT;
  } else {
    ro = p.Wd / 2; rb = ro - ringT; hx = p.L / 2;
  }
  const rfb = ro - wallF, rmo = rfb - c;
  if (rb < 2) warnings.push('Bore is smaller than 4 mm — the object is too small for these magnets.');
  if (!round && hx - ringT < 1) warnings.push('Frame is wider than the part — enlarge the size.');

  let N, Nauto, P, shift = 0, xInset = 0;
  if (round) {
    const C = 2 * Math.PI * Math.max(rfb, 1);
    Nauto = clamp(Math.floor(C / Pmin), 2, MAX_TEETH);
    N = o.teeth > 0 ? Math.round(o.teeth) : Nauto;
    P = C / N;
  } else {
    // The plug slides Lt along x inside the socket, so it is shorter than
    // the socket interior by Lt + c. Its pins must stay inside it.
    shift = -(uEnd + Dp + wall - a) / 2;
    xInset = c + Lt;
    const Xp = hx - wallF - xInset;
    const Lu = 2 * (Xp - 1.5 - w / 2 - Math.abs(shift));
    // shortest part that still fits one slot, for the warning below
    const hxMin = wallF + xInset + 1.5 + w / 2 + Math.abs(shift);
    const lenMin = 2 * (o.size_mode === 'inner' ? hxMin - ringT : hxMin);
    // never let the plug's bore turn inside out on a too-short part
    xInset = Math.min(xInset, Math.max(0, rb + (hx - ro) - 1));
    Nauto = clamp(Math.floor(Math.max(Lu, 0) / Pmin) + 1, 1, MAX_TEETH);
    N = o.teeth > 0 ? Math.round(o.teeth) : Nauto;
    P = N > 1 ? Lu / (N - 1) : Pmin;
    if (Lu < 0) warnings.push(`Too short along the slide axis for even one slot — needs at least ${lenMin.toFixed(0)} mm (or smaller magnets).`);
  }
  if (N > 1 && P < Pmin - 1e-6)
    warnings.push(`Too many pins — the slots would collide. Maximum here is ${Nauto}.`);

  return {
    e: 0, G: Hf + c, Pmin, ringT, ro, rb, hx, rRef: round ? rfb : 1,
    rm: rmo + pl / 2,
    pl, skin, wallF, plugT, floorT, lipT, zp, Hf, Hm, zcb, Lt, a, uEnd, span,
    rfb, rmo, Fs: F + 2 * c, xInset,
    N, Nauto, P, shift, travel: Lt,
    beta0: 0, beta1: Lt,
    zFlip: Hf + c,
    stack: 2 * p.T + Hf + c,
    warnings,
  };
}

// ════════════════════════════════════════════════════════════
//  Mesh primitives — { p: flat xyz, i: flat triangle indices }
// ════════════════════════════════════════════════════════════

export function meshVolume(m) {
  let v = 0;
  const { p, i } = m;
  for (let t = 0; t < i.length; t += 3) {
    const a = i[t] * 3, b = i[t + 1] * 3, c = i[t + 2] * 3;
    v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
        - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
        + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return v;
}

// Outward-facing triangles ⇒ positive signed volume. Every primitive
// is built with consistent winding, so one global flip is enough.
function orient(m) {
  if (meshVolume(m) < 0)
    for (let t = 0; t < m.i.length; t += 3) {
      const x = m.i[t + 1]; m.i[t + 1] = m.i[t + 2]; m.i[t + 2] = x;
    }
  return m;
}

export function mergeMeshes(list) {
  const out = { p: [], i: [] };
  for (const m of list) {
    const off = out.p.length / 3;
    for (let k = 0; k < m.p.length; k++) out.p.push(m.p[k]);
    for (let k = 0; k < m.i.length; k++) out.i.push(m.i[k] + off);
  }
  return out;
}

// Ear clipping for a simple CCW polygon in the (u, z) plane. Handles
// collinear vertices (the subdivided straight edges of a round tooth),
// and always uses every input vertex so the caps share their boundary
// vertices with the side strips — that is what keeps the prism closed.
export function triangulate(poly) {
  const n = poly.length;
  const idx = Array.from({ length: n }, (_, k) => k);
  const tris = [];
  const cr = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const TOL = 1e-10;
  while (idx.length > 3) {
    let done = false, best = -1, bestCross = Infinity;
    for (let k = 0; k < idx.length && !done; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length];
      const ib = idx[k];
      const ic = idx[(k + 1) % idx.length];
      const a = poly[ia], b = poly[ib], c = poly[ic];
      const x = cr(a, b, c);
      if (Math.abs(x) < bestCross) { bestCross = Math.abs(x); best = k; }
      if (x <= TOL) continue;
      let blocked = false;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        const q = poly[j];
        if (same(q, a) || same(q, b) || same(q, c)) continue;
        if (cr(a, b, q) >= -TOL && cr(b, c, q) >= -TOL && cr(c, a, q) >= -TOL) {
          blocked = true; break;
        }
      }
      if (!blocked) { tris.push([ia, ib, ic]); idx.splice(k, 1); done = true; }
    }
    if (!done) {                       // numerically stuck: drop the flattest vertex
      const k = best;
      tris.push([idx[(k + idx.length - 1) % idx.length], idx[k], idx[(k + 1) % idx.length]]);
      idx.splice(k, 1);
    }
  }
  tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

const signedArea = poly => {
  let s = 0;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};

// Frame: maps unrolled (u, v, z) to xyz for one family.
function makeFrame(plan) {
  const { round, rRef } = plan;
  return {
    round, rRef,
    // 4° steps keep a round tooth within 0.3 % of the true arc
    stepU: round ? (4 * Math.PI / 180) * rRef : Infinity,
    map: round
      ? (u, v, z) => [v * Math.cos(u / rRef), v * Math.sin(u / rRef), z]
      : (u, v, z) => [u, v, z],
    // unit vector along travel at u
    axis: round
      ? u => [-Math.sin(u / rRef), Math.cos(u / rRef), 0]
      : () => [1, 0, 0],
  };
}

// Subdivide polygon edges that run along u so curved faces stay round.
function subdivide(poly, stepU) {
  if (!Number.isFinite(stepU)) return poly;
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    const n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / stepU - 1e-9));
    for (let s = 0; s < n; s++)
      out.push([a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n]);
  }
  return out;
}

// Triangulate a CCW polygon in vertical slabs on a common u grid. A
// round tooth's outer wall is a CYLINDER, so a cap triangle may only join
// vertices that are one grid step apart in u — an ear clipper happily
// draws a long chord across the face and cuts the tooth inside its true
// radius. Slabs cannot: every triangle lives inside one [u_k, u_k+1]
// column. Works for any simple polygon whose edges are straight, so the
// 45° back ramp is fine: the ramp edge just gets grid vertices too.
// Returns the outline first (indices 0..n−1, in loop order, grid points
// inserted on every non-vertical edge), then any interior vertices the
// slab seams need.
export function slabTriangulate(poly, stepU) {
  const q = v => Math.round(v * 1e6) / 1e6;
  // distinct u values, keeping the exact input numbers (rounding them
  // would put a grid point a hair off the polygon corner it sits next to)
  const us = [];
  for (const u of poly.map(p => p[0]).sort((x, y) => x - y))
    if (!us.length || u - us[us.length - 1] > 1e-7) us.push(u);
  const grid = [];
  for (let k = 0; k < us.length - 1; k++) {
    const n = Math.max(1, Math.ceil((us[k + 1] - us[k]) / stepU - 1e-9));
    for (let t = 0; t < n; t++) grid.push(us[k] + (us[k + 1] - us[k]) * t / n);
  }
  grid.push(us[us.length - 1]);

  const edges = poly.map((p0, k) => [p0, poly[(k + 1) % poly.length]]);
  const slopeEdges = edges.filter(([p0, p1]) => Math.abs(p0[0] - p1[0]) > 1e-9);
  const zOn = ([p0, p1], u) => p0[1] + (p1[1] - p0[1]) * (u - p0[0]) / (p1[0] - p0[0]);

  const outline = [];
  for (const [p0, p1] of edges) {
    outline.push(p0);
    if (Math.abs(p0[0] - p1[0]) > 1e-9) {
      const inner = grid.filter(g => g > Math.min(p0[0], p1[0]) + 1e-9 && g < Math.max(p0[0], p1[0]) - 1e-9);
      if (p1[0] < p0[0]) inner.reverse();
      for (const g of inner) outline.push([g, zOn([p0, p1], g)]);
    }
  }

  const pts = [], ids = new Map();
  const vid = (u, z) => {
    const key = q(u) + '|' + q(z);
    if (!ids.has(key)) { ids.set(key, pts.length); pts.push([u, z]); }
    return ids.get(key);
  };
  for (const [u, z] of outline) vid(u, z);

  // each slab: pairs of edges (lower, upper) the polygon lies between
  const slabs = [];
  for (let k = 0; k < grid.length - 1; k++) {
    const mid = (grid[k] + grid[k + 1]) / 2;
    const cross = slopeEdges
      .filter(([p0, p1]) => Math.min(p0[0], p1[0]) < mid && mid < Math.max(p0[0], p1[0]))
      .map(e => ({ e, zm: zOn(e, mid) }))
      .sort((x, y) => x.zm - y.zm);
    const iv = [];
    for (let t = 0; t + 1 < cross.length; t += 2) iv.push([cross[t].e, cross[t + 1].e]);
    slabs.push(iv);
  }
  // every z where the outline meets grid line k (either neighbouring slab)
  const lineZ = k => {
    const set = new Set();
    for (const iv of [slabs[k - 1], slabs[k]])
      if (iv) for (const [lo, hi] of iv) { set.add(q(zOn(lo, grid[k]))); set.add(q(zOn(hi, grid[k]))); }
    return [...set].sort((x, y) => x - y);
  };
  const tris = [];
  for (let k = 0; k < slabs.length; k++) {
    const zl = lineZ(k), zr = lineZ(k + 1);
    for (const [lo, hi] of slabs[k]) {
      const lL = q(zOn(lo, grid[k])), hL = q(zOn(hi, grid[k]));
      const lR = q(zOn(lo, grid[k + 1])), hR = q(zOn(hi, grid[k + 1]));
      const L = zl.filter(z => z >= lL - 1e-9 && z <= hL + 1e-9).map(z => vid(grid[k], z));
      const R = zr.filter(z => z >= lR - 1e-9 && z <= hR + 1e-9).map(z => vid(grid[k + 1], z));
      const zOf = id => pts[id][1];
      let i = 0, j = 0;
      while (i < L.length - 1 || j < R.length - 1) {
        const advI = j >= R.length - 1 ? true
          : i >= L.length - 1 ? false
          : zOf(L[i + 1]) <= zOf(R[j + 1]);
        if (advI) { tris.push([L[i], R[j], L[i + 1]]); i++; }
        else { tris.push([L[i], R[j], R[j + 1]]); j++; }
      }
    }
  }
  return { pts, n: outline.length, tris };
}

// Sweep a (u, z) polygon over the v range [vlo, vhi]; `side` = −1
// mirrors a rect row to the −y wall.
export function prism(F, poly, vlo, vhi, side = 1) {
  let base = poly;
  if (signedArea(base) < 0) base = base.slice().reverse();
  let pts, n, tris;
  if (Number.isFinite(F.stepU)) {
    ({ pts, n, tris } = slabTriangulate(base, F.stepU));
  } else {
    pts = subdivide(base, F.stepU);
    n = pts.length;
    tris = triangulate(pts);
  }
  const m = pts.length;
  const p = [];
  for (const [u, z] of pts) p.push(...F.map(u, side * vlo, z));
  for (const [u, z] of pts) p.push(...F.map(u, side * vhi, z));
  const i = [];
  for (const [a, b, c] of tris) {
    i.push(m + a, m + b, m + c);       // outer cap
    i.push(a, c, b);                   // inner cap
  }
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    i.push(k, k2, m + k2, k, m + k2, m + k);
  }
  return orient({ p, i });
}

// A closed solid of revolution (round) or mitred rectangular sweep
// (rect) of a CCW profile in (s, z): s = radius / |y|.
export function sweep(plan, profile) {
  const { round, hx, ro } = plan;
  const M = round ? 120 : 4;
  const loop = (s, dx) => {
    const pts = [];
    if (round) {
      for (let j = 0; j < M; j++) {
        const a = (2 * Math.PI * j) / M;
        pts.push([s * Math.cos(a), s * Math.sin(a)]);
      }
    } else {
      const X = s + (hx - ro) - dx, Y = s;
      pts.push([X, Y], [-X, Y], [-X, -Y], [X, -Y]);
    }
    return pts;
  };
  const p = [];
  // profile points are [s, z] or [s, z, dx]; dx shortens a rect sweep
  // along x only (the plug of a rect male/female must be shorter than
  // its socket by the slide travel)
  for (const [s, z, dx = 0] of profile)
    for (const [x, y] of loop(s, dx)) p.push(x, y, z);
  const i = [];
  const np = profile.length;
  for (let a = 0; a < np; a++) {
    const b = (a + 1) % np;
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M;
      const A = a * M + j, B = a * M + j2, C = b * M + j2, D = b * M + j;
      i.push(A, B, C, A, C, D);
    }
  }
  return orient({ p, i });
}

// A cylinder lying along the travel axis — a magnet pocket cutter.
export function cylinder(center, ax, r, len, seg = 28, rAt = null) {
  const e1 = [0, 0, 1];
  const e2 = [ax[1] * e1[2] - ax[2] * e1[1],
              ax[2] * e1[0] - ax[0] * e1[2],
              ax[0] * e1[1] - ax[1] * e1[0]];
  const p = [], i = [];
  for (const t of [-len / 2, len / 2])
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg, rr = rAt ? rAt(k) : r;
      const ca = Math.cos(a) * rr, sa = Math.sin(a) * rr;
      p.push(center[0] + ax[0] * t + e1[0] * ca + e2[0] * sa,
             center[1] + ax[1] * t + e1[1] * ca + e2[1] * sa,
             center[2] + ax[2] * t + e1[2] * ca + e2[2] * sa);
    }
  const c0 = 2 * seg, c1 = 2 * seg + 1;
  p.push(center[0] - ax[0] * len / 2, center[1] - ax[1] * len / 2, center[2] - ax[2] * len / 2);
  p.push(center[0] + ax[0] * len / 2, center[1] + ax[1] * len / 2, center[2] + ax[2] * len / 2);
  for (let k = 0; k < seg; k++) {
    const k2 = (k + 1) % seg;
    i.push(k, k2, seg + k2, k, seg + k2, seg + k);       // side
    i.push(c0, k2, k);                                   // cap −
    i.push(c1, seg + k, seg + k2);                       // cap +
  }
  return orient({ p, i });
}

// The magnet pocket: an oversize bore (the magnet drops in after the
// print) with small crush ribs along its wall that stand proud of the
// magnet's own radius — press the magnet in and the ribs deform and
// hold it. ribs = 0 gives a plain round bore.
export function pocketCutter(plan, center, ax, len) {
  const R = plan.pocketD / 2, tip = plan.ribTip, n = plan.ribs;
  if (!n || tip >= R) return cylinder(center, ax, R, len);
  const seg = n * 12;                       // rib tips land on grid points
  const half = 2;                           // rib half-width, in grid steps
  const rAt = k => {
    const g = k % 12;                       // steps from the nearest rib centre
    const d = Math.min(g, 12 - g);
    return d >= half ? R : R - (R - tip) * (1 - d / half);
  };
  return cylinder(center, ax, R, len, seg, rAt);
}

// Round every corner of a polygon with radius r — convex and concave
// alike (a concave corner gets a fillet that adds material). Corners for
// which skip(point) is true stay sharp: the ones buried inside the base
// or sticking out through the mouth of a slot. Where two corners are too
// close for the full radius, the radius shrinks to fit.
export function roundPolygon(poly, r, skip = () => false, perQuarter = 4) {
  if (!(r > 0)) return poly;
  const n = poly.length, out = [];
  for (let k = 0; k < n; k++) {
    const p = poly[k];
    if (skip(p)) { out.push(p); continue; }
    const a = poly[(k + n - 1) % n], b = poly[(k + 1) % n];
    const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    if (l1 < 1e-9 || l2 < 1e-9) { out.push(p); continue; }
    const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2];
    const theta = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    if (theta < 1e-3 || Math.PI - theta < 1e-3) { out.push(p); continue; }   // straight through
    let d = r / Math.tan(theta / 2), rr = r;
    const dmax = 0.5 * Math.min(l1, l2);
    if (d > dmax) { d = dmax; rr = d * Math.tan(theta / 2); }
    const t1 = [p[0] + u1[0] * d, p[1] + u1[1] * d];
    const t2 = [p[0] + u2[0] * d, p[1] + u2[1] * d];
    const bis = [u1[0] + u2[0], u1[1] + u2[1]];
    const bl = Math.hypot(...bis);
    const cd = rr / Math.sin(theta / 2);
    const c = [p[0] + bis[0] / bl * cd, p[1] + bis[1] / bl * cd];
    const a1 = Math.atan2(t1[1] - c[1], t1[0] - c[0]);
    let da = Math.atan2(t2[1] - c[1], t2[0] - c[0]) - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const steps = Math.max(2, Math.ceil(Math.abs(da) / (Math.PI / 2) * perQuarter));
    for (let i = 0; i <= steps; i++) {
      const an = a1 + da * i / steps;
      out.push([c[0] + rr * Math.cos(an), c[1] + rr * Math.sin(an)]);
    }
  }
  return out;
}

// bottom edge chamfer of the ring, kept inside what the ring can spare
const ringChamfer = plan =>
  Math.max(0, Math.min(plan.chamfer, plan.T / 2, (plan.ro - plan.rb) / 3));

// ════════════════════════════════════════════════════════════
//  Part builders
// ════════════════════════════════════════════════════════════
// Each part is { name, role, body, add, cuts }:
//   body  closed solid (base + tubes)
//   add   disjoint solids to UNION onto the body   (null if none)
//   cuts  solids to SUBTRACT, in order             (each internally disjoint)
// The CSG itself (union/subtract) is done by index.html with
// three-bvh-csg; unit tests check every piece for watertightness.

// A magnet disc for the preview (never exported): where it sits, which
// way its axis points, and which pole faces the mating part.
function magnet(F, u, v, z, plan, pole) {
  return { c: F.map(u, v, z), ax: F.axis(u), r: plan.magnet.d / 2,
           len: plan.magnet.h, pole };
}

// Round: teeth every P around the ring. Rect: a row symmetric about
// `shift` — symmetric, so the flipped half's row lands on the same
// lattice instead of a mirrored one.
// The male part uses the mirrored shift so that, flipped over the
// socket, its pins land exactly on the slots with no net offset.
function toothCentres(plan, role = 'twin') {
  const out = [];
  const sh = plan.dir * plan.shift * (role === 'male' ? -1 : 1);
  for (let k = 0; k < plan.N; k++)
    out.push(plan.round ? k * plan.P : (k - (plan.N - 1) / 2) * plan.P + sh);
  return out;
}

const tracks = plan => (plan.round ? [1] : [1, -1]);

// Polygon in du/z offsets → (u, z) points, mirrored by `dir`.
const poly = (u0, dir, pts) => pts.map(([du, z]) => [u0 + dir * du, z]);

function twinPart(plan) {
  const F = makeFrame(plan);
  const { ro, rb, T, w, e, c, G, toothT, dir, Dp, pocketD, bs } = plan;
  const Ff = plan.F;
  const ch = ringChamfer(plan);
  const body = sweep(plan, ch > 0
    ? [[rb + ch, -T], [ro - ch, -T], [ro, -T + ch], [ro, 0], [rb, 0], [rb, -T + ch]]
    : [[rb, -T], [ro, -T], [ro, 0], [rb, 0]]);

  const vHi = ro - EPS_INSET, vLo = vHi - toothT, vMid = (vHi + vLo) / 2;
  const zb = -0.2, zTop = G - c, zUnder = G - c - Ff;
  const adds = [], pockets = [], magnets = [];
  const r = pocketD / 2, Lc = Dp + 0.3, mh = plan.magnet.h;
  for (const s of tracks(plan))
    for (const u0 of toothCentres(plan)) {
      // corners buried in the base (z = zb) stay sharp; all others are rounded
      adds.push(prism(F, roundPolygon(poly(u0, dir, [
        [-w / 2 - bs, zb], [w / 2, zb], [w / 2, zUnder], [w / 2 + e, zUnder],
        [w / 2 + e, zTop], [-w / 2, zTop],
        // back face: a 45° ramp from the top edge to bs below it
        ...(bs > 0 && bs < zTop - zb - 1e-6 ? [[-w / 2, zb + bs]] : []),
      ]), plan.fillet, pt => pt[1] <= zb + 1e-6), vLo, vHi, s));
      // pocket centred at du, magnet disc resting on the pocket floor at dm
      const mk = (du, dm, z, pole) => {
        const u = u0 + dir * du;
        const [x, y, zz] = F.map(u, s * vMid, z);
        pockets.push(pocketCutter(plan, [x, y, zz], F.axis(u), Lc));
        magnets.push(magnet(F, u0 + dir * dm, s * vMid, z, plan, pole));
      };
      mk(w / 2 + e - Dp / 2 + 0.15, w / 2 + e - Dp + mh / 2, zTop - Ff / 2, 'N');   // foot tip
      mk(w / 2 - Dp / 2 + 0.15, w / 2 - Dp + mh / 2, c + Ff / 2, 'S');              // post face
    }
  return { name: 'half', role: 'twin', body, add: mergeMeshes(adds),
           cuts: [mergeMeshes(pockets)], magnets };
}

function malePart(plan) {
  const F = makeFrame(plan);
  const { ro, rb, T, w, c, rmo, pl, zp, Hm, dir, Dp, pocketD } = plan;
  const Ff = plan.F;
  const dx = plan.xInset || 0;
  const ch = ringChamfer(plan);
  const body = sweep(plan, ch > 0
    ? [[rb + ch, -T, dx], [ro - ch, -T], [ro, -T + ch], [ro, 0], [rmo, 0, dx], [rmo, Hm, dx],
       [rb, Hm, dx], [rb, -T + ch, dx]]
    : [[rb, -T, dx], [ro, -T], [ro, 0], [rmo, 0, dx], [rmo, Hm, dx], [rb, Hm, dx]]);
  const adds = [], pockets = [], magnets = [];
  const vMid = rmo + pl / 2, r = pocketD / 2, Lc = Dp + 0.3, mh = plan.magnet.h;
  for (const s of tracks(plan))
    for (const u0 of toothCentres(plan, 'male')) {
      adds.push(prism(F, roundPolygon(poly(u0, dir, [
        [-w / 2, zp], [w / 2, zp], [w / 2, zp + Ff], [-w / 2, zp + Ff],
      ]), plan.fillet), rmo - 0.3, rmo + pl, s));
      const u = u0 + dir * (-w / 2 + Dp / 2 - 0.15);
      const [x, y, zz] = F.map(u, s * vMid, zp + Ff / 2);
      pockets.push(pocketCutter(plan, [x, y, zz], F.axis(u), Lc));
      magnets.push(magnet(F, u0 + dir * (-w / 2 + Dp - mh / 2), s * vMid, zp + Ff / 2, plan, 'N'));
    }
  return { name: 'male', role: 'male', body, add: mergeMeshes(adds),
           cuts: [mergeMeshes(pockets)], magnets };
}

function femalePart(plan) {
  const F = makeFrame(plan);
  const { ro, rb, T, c, rfb, rmo, pl, Hf, zcb, Fs, a, uEnd, dir, Dp, pocketD } = plan;
  const ch = ringChamfer(plan);
  const body = sweep(plan, ch > 0
    ? [[rb + ch, -T], [ro - ch, -T], [ro, -T + ch], [ro, Hf], [rfb, Hf], [rfb, 0], [rb, 0], [rb, -T + ch]]
    : [[rb, -T], [ro, -T], [ro, Hf], [rfb, Hf], [rfb, 0], [rb, 0]]);
  const slots = [], pockets = [], magnets = [];
  const vMid = rmo + pl / 2, r = pocketD / 2, Lc = Dp + 0.3, mh = plan.magnet.h;
  for (const s of tracks(plan))
    for (const u0 of toothCentres(plan)) {
      // the slot's corners at the mouth lie outside the part: keep those sharp
      slots.push(prism(F, roundPolygon(poly(u0, dir, [
        [-a, zcb], [uEnd, zcb], [uEnd, zcb + Fs], [a, zcb + Fs],
        [a, Hf + 0.3], [-a, Hf + 0.3],
      ]), plan.fillet, pt => pt[1] >= Hf), rfb - 0.3, rfb + pl, s));
      const u = u0 + dir * (uEnd + Dp / 2 - 0.15);
      const [x, y, zz] = F.map(u, s * vMid, zcb + Fs / 2);
      pockets.push(pocketCutter(plan, [x, y, zz], F.axis(u), Lc));
      magnets.push(magnet(F, u0 + dir * (uEnd + Dp - mh / 2), s * vMid, zcb + Fs / 2, plan, 'S'));
    }
  return { name: 'female', role: 'female', body, add: null,
           cuts: [mergeMeshes(slots), mergeMeshes(pockets)], magnets };
}

// Public entry: sizing + the part list. `parts` is what gets printed:
// twin → the same half twice; malefemale → one plug, one socket.
export function buildBayonet(bp = {}) {
  const plan = planBayonet(bp);
  const parts = plan.kind === 'malefemale'
    ? [malePart(plan), femalePart(plan)]
    : [twinPart(plan)];
  return { plan, parts };
}

// Magnet bookkeeping for the UI / docs: how many discs to buy and
// which way round they go. Each tooth takes two (twin and male/female
// alike), so the count is exact for the chosen teeth × rows.
export function magnetCount(plan) {
  const rows = plan.round ? 1 : 2;
  // twin: a foot-tip and a post-face magnet per tooth, on both halves.
  // male/female: one per pin (plug) and one per slot end wall (socket).
  const perPart = plan.N * rows * (plan.kind === 'malefemale' ? 1 : 2);
  return { perPart, total: perPart * 2 };
}
