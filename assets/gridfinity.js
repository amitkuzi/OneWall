// ════════════════════════════════════════════════════════════
//  Gridfinity Creator — geometry math module
//  Dependency-free ES module: runs both in the browser (index.html
//  wraps the buffers into THREE.BufferGeometry) and in Node for the
//  test suite (tests/gridfinity.test.mjs).
//
//  Bins print in normal slicer mode (real walls + floor, optional
//  stacking lip and X/Y dividers); a LITE style keeps the solid
//  body for spiral/vase printing. Baseplates come closed-floor
//  (normal) or open-bottom (lite). Footprints in multiples of
//  0.5 / 1 / 2 / 4 units.
// ════════════════════════════════════════════════════════════

export const GF = {
  PITCH: 42,          // Gridfinity XY unit, mm
  HU: 7,              // Gridfinity Z unit, mm
  CLEAR: 0.25,        // socket-to-bin clearance per side, mm
  FOOT_GAP: 0.5,      // total XY gap: bin outer = units*42 - 0.5
  // Base profile, bottom-up: 45° chamfer, straight, 45° chamfer
  BASE: { C1: 0.8, S: 1.8, C2: 2.15 },
  BASE_H: 0.8 + 1.8 + 2.15,   // 4.75
  BASE_INSET: 0.8 + 2.15,     // 2.95 — bottom is inset this much
};

export const MULTIPLIERS = [0.5, 1, 2, 4];
export const LEG_MULTS = [0.5, 1, 2];

// Stacking lip: extra rim height on top of a bin whose inner
// profile is the socket shape, so the foot of another bin seats
// into it. 4.4 mm per the Gridfinity spec (0.35 less than the
// 4.75 foot — stacked bins rest on the chamfers, not the floor).
export const LIP_H = 4.4;
// Thinnest printable edge at the very top of the lip, mm.
export const LIP_EDGE = 0.6;

// Lip seat inset at depth d below the bin top: the socket profile
// shifted out by the clearance (the lip lives inside the bin's own
// footprint), clamped so the top edge stays printable.
export const lipSeatInset = d =>
  Math.max(LIP_EDGE, socketInset(d) - GF.CLEAR);

// Does leg size m tile bin size u exactly? (both in grid units)
export const legFits = (u, m) =>
  Math.abs(u / m - Math.round(u / m)) < 1e-9;

// The leg size actually used for a bin: the requested one when it
// tiles both axes, otherwise 0.5 — which always works, since bin
// sizes come in 0.5-unit steps.
export const effectiveLegMult = (ux, uy, m) =>
  (legFits(ux, m) && legFits(uy, m)) ? m : 0.5;

// Outer XY size of a bin spanning `units` grid cells.
export const footprint = units => units * GF.PITCH - GF.FOOT_GAP;

// Smallest bin step, grid units — nothing narrower has a bin to
// drop into it, so a leftover thinner than this becomes filler.
export const MIN_SOCKET = 0.5;

// Split a (possibly fractional) baseplate cell count into the cells
// that actually get built along one axis, sized in GRID UNITS:
//
//   full cells of `mult`, then the largest 0.5-step socket the
//   remainder can hold, then a solid filler strip for any sliver
//   left over (too narrow for even a half-unit bin).
//
// So 3.5 cells → [1, 1, 1, 0.5-socket]; 3.3 → [1, 1, 1, 0.3-filler];
// 3.7 → [1, 1, 1, 0.5-socket, 0.2-filler]. The plate always spans
// exactly count × mult × 42 mm, so it fills the space it was sized
// for, and every socket in it fits a real bin.
export function cellSizes(count, mult = 1) {
  const EPS = 1e-9;
  const out = [];
  const full = Math.floor(count + EPS);
  for (let i = 0; i < full; i++) out.push({ u: mult, socket: true });

  let left = (count - full) * mult;               // remainder, grid units
  const snapped = Math.floor(left / MIN_SOCKET + EPS) * MIN_SOCKET;
  if (snapped >= MIN_SOCKET) {
    out.push({ u: snapped, socket: true });
    left -= snapped;
  }
  if (left > 1e-6) out.push({ u: left, socket: false });
  return out;
}

// Horizontal inset of the bin wall at height z (0 = bottom).
// 0 → 0.8      chamfer:  2.95 → 2.15
// 0.8 → 2.6    straight: 2.15
// 2.6 → 4.75   chamfer:  2.15 → 0
export function baseInset(z) {
  if (z <= 0) return GF.BASE_INSET;
  if (z < GF.BASE.C1) return GF.BASE_INSET - z;
  if (z < GF.BASE.C1 + GF.BASE.S) return GF.BASE.C2;
  if (z < GF.BASE_H) return GF.BASE_H - z;
  return 0;
}

// Socket wall inset at depth d measured DOWN from the baseplate top.
// Mirror image of baseInset: widest at the top opening.
export function socketInset(d) {
  if (d <= 0) return 0;
  if (d < GF.BASE.C2) return d;
  if (d < GF.BASE.C2 + GF.BASE.S) return GF.BASE.C2;
  if (d < GF.BASE_H) return d - GF.BASE.S;
  return GF.BASE_INSET;
}

// ── Rounded-rectangle cross-section ring (CCW) ──────────────
export function roundedRectRing(w, d, r, spacing = 2) {
  const cr = Math.max(0.05, Math.min(r, w / 2 - 0.05, d / 2 - 0.05));
  const a = w / 2 - cr;
  const b = d / 2 - cr;
  const D2R = Math.PI / 180;

  const ecount = len => len < spacing * 0.5 ? 0
                      : Math.max(1, Math.round(len / spacing));
  const acount = rr => Math.max(2, Math.ceil((Math.PI * rr / 2) / spacing));

  const edge = (p0, p1, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / n;
      out.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
    }
    return out;
  };
  const arc = (cx, cy, rr, a0, a1, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const ang = (a0 + (a1 - a0) * i / n) * D2R;
      out.push([cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)]);
    }
    return out;
  };

  return [
    ...edge([a + cr, -b], [a + cr, b], ecount(2 * b)),
    ...arc(a, b, cr, 0, 90, acount(cr)),
    ...edge([a, b + cr], [-a, b + cr], ecount(2 * a)),
    ...arc(-a, b, cr, 90, 180, acount(cr)),
    ...edge([-a - cr, b], [-a - cr, -b], ecount(2 * b)),
    ...arc(-a, -b, cr, 180, 270, acount(cr)),
    ...edge([-a, -b - cr], [a, -b - cr], ecount(2 * a)),
    ...arc(a, -b, cr, 270, 360, acount(cr)),
  ];
}

// Offset a CCW ring inward by `inset` (negative = outward) along
// per-point outward normals estimated from neighbours.
export function offsetRing(ring, inset) {
  const M = ring.length;
  const out = new Array(M);
  for (let i = 0; i < M; i++) {
    const p = ring[i], q = ring[(i + 1) % M], o = ring[(i - 1 + M) % M];
    let tx = q[0] - o[0], ty = q[1] - o[1];
    const tl = Math.hypot(tx, ty) || 1;
    // CCW ring → outward normal = (ty, -tx)
    const nx = ty / tl, ny = -tx / tl;
    out[i] = [p[0] - nx * inset, p[1] - ny * inset];
  }
  return out;
}

// ── Mesh assembly helpers ───────────────────────────────────
// Build a closed shell from stacked rings (equal point counts):
// side quads + bottom fan + top fan. Convention: rings are CCW
// viewed from +z, faces wound CCW from OUTSIDE (positive volume).
function shellFromLayers(layers, zs) {
  const L = layers.length, M = layers[0].length;
  const positions = new Float32Array(L * M * 3);
  for (let l = 0; l < L; l++)
    for (let k = 0; k < M; k++) {
      const i = (l * M + k) * 3;
      positions[i] = layers[l][k][0];
      positions[i + 1] = layers[l][k][1];
      positions[i + 2] = zs[l];
    }

  const indices = new Uint32Array(((L - 1) * M * 2 + 2 * (M - 2)) * 3);
  let ii = 0;
  const I = (l, k) => l * M + (k % M);
  for (let l = 0; l < L - 1; l++)
    for (let k = 0; k < M; k++) {
      indices[ii++] = I(l, k);
      indices[ii++] = I(l, k + 1);
      indices[ii++] = I(l + 1, k + 1);
      indices[ii++] = I(l, k);
      indices[ii++] = I(l + 1, k + 1);
      indices[ii++] = I(l + 1, k);
    }
  for (let k = 1; k < M - 1; k++) {           // bottom (viewed from below)
    indices[ii++] = 0;
    indices[ii++] = k + 1;
    indices[ii++] = k;
  }
  const top = (L - 1) * M;
  for (let k = 1; k < M - 1; k++) {           // top
    indices[ii++] = top;
    indices[ii++] = top + k;
    indices[ii++] = top + k + 1;
  }
  return { positions, indices };
}

// Merge several {positions, indices} parts into one buffer set.
function mergeParts(parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.positions.length; ni += p.indices.length; }
  const positions = new Float32Array(nv);
  const indices = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const p of parts) {
    positions.set(p.positions, vo * 3);
    for (let i = 0; i < p.indices.length; i++)
      indices[io + i] = p.indices[i] + vo;
    vo += p.positions.length / 3;
    io += p.indices.length;
  }
  return { positions, indices };
}

// Axis-aligned closed box solid (used for divider walls).
function boxMesh(x0, x1, y0, y1, z0, z1) {
  const positions = new Float32Array([
    x0, y0, z0,  x1, y0, z0,  x1, y1, z0,  x0, y1, z0,
    x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1,
  ]);
  const indices = new Uint32Array([
    0, 2, 1,  0, 3, 2,      // bottom (−z)
    4, 5, 6,  4, 6, 7,      // top (+z)
    0, 1, 5,  0, 5, 4,      // −y
    1, 2, 6,  1, 6, 5,      // +x
    2, 3, 7,  2, 7, 6,      // +y
    3, 0, 4,  3, 4, 7,      // −x
  ]);
  return { positions, indices };
}

// ── Bin (hollow body on per-cell feet) ──────────────────────
// The base is a grid of standard Gridfinity feet — one per 42 mm
// cell (or a single sub-unit foot for 0.5 bins) — so any bin size
// drops onto a normal baseplate.
//
// style = 'normal' (default): real walls + floor, prints in normal
//   slicer mode; supports the stacking lip and divider walls.
// style = 'lite': solid body for the slicer's Spiral vase mode —
//   print with bottom shell layers ≥ 26 (≈ 5.2 mm at 0.2 mm) so the
//   feet and deck are solid before the spiral wall starts. Lip and
//   dividers are ignored (a single spiral wall can't print them).
export function buildBin(params = {}) {
  const {
    units_x = 1, units_y = 1, height_units = 3, leg_mult = 1,
    corner_r = 4, spacing = 2, layer_step = 1.5,
    style = 'normal',
    wall_t = 1.2, floor_t = 1.0,
    lip = false,               // stackable top rim (normal style)
    div_x = 0, div_y = 0,      // divider walls across X / Y (normal style)
    // optional spiral rib texture on the wall above the base
    ribs = 0, rib_amp = 0, rib_twist = 0,
  } = params;

  const w = footprint(units_x);
  const d = footprint(units_y);
  const lite = style === 'lite';
  const lipH = (!lite && lip) ? LIP_H : 0;
  const height = GF.BASE_H + height_units * GF.HU + lipH;
  const OVERLAP = 0.1;   // feet poke into the body so the union fuses

  const parts = [];

  // Feet — legs of leg_mult grid units (21/42/84 mm) tiling the
  // footprint exactly; falls back to 0.5 when the size doesn't
  // divide (the UI blocks those combos, this is the safety net).
  const m = effectiveLegMult(units_x, units_y, leg_mult);
  const pitch = m * GF.PITCH;
  const nx = Math.round(units_x / m);
  const ny = Math.round(units_y / m);
  const fw = footprint(m);
  const fd = footprint(m);
  const footRing = roundedRectRing(fw, fd, corner_r, spacing);
  const footZs = [0, GF.BASE.C1, GF.BASE.C1 + GF.BASE.S,
                  GF.BASE_H, GF.BASE_H + OVERLAP];
  const x0 = -(nx - 1) * pitch / 2;
  const y0 = -(ny - 1) * pitch / 2;
  for (let ix = 0; ix < nx; ix++)
    for (let iy = 0; iy < ny; iy++) {
      const cx = x0 + ix * pitch, cy = y0 + iy * pitch;
      const layers = footZs.map(z =>
        offsetRing(footRing, baseInset(z)).map(p => [p[0] + cx, p[1] + cy]));
      parts.push(shellFromLayers(layers, footZs));
    }

  // Body — outer wall from the top of the feet up
  const ring = roundedRectRing(w, d, corner_r, spacing);
  const M = ring.length;
  const zs = [GF.BASE_H];
  const wallSteps = Math.max(1, Math.ceil((height - GF.BASE_H) / layer_step));
  for (let i = 1; i <= wallSteps; i++)
    zs.push(GF.BASE_H + (height - GF.BASE_H) * i / wallSteps);

  const ribbedRing = z => {
    if (!ribs || !rib_amp) return ring;
    const tz = (z - GF.BASE_H) / Math.max(height - GF.BASE_H, 0.001);
    return ring.map((p, k) => {
      const off = rib_amp *
        Math.cos(2 * Math.PI * (ribs * (k / M) + rib_twist * tz));
      const q = ring[(k + 1) % M], o = ring[(k - 1 + M) % M];
      const tx = q[0] - o[0], ty = q[1] - o[1];
      const tl = Math.hypot(tx, ty) || 1;
      return [p[0] + (ty / tl) * off, p[1] + (-tx / tl) * off];
    });
  };
  const layers = zs.map(ribbedRing);

  if (lite) {
    // solid block — the spiral/vase slicer turns it into one wall
    parts.push(shellFromLayers(layers, zs));
  } else {
    // Hollow tub as ONE closed shell: continue the layer sweep from
    // the outer top across the rim and down the inner wall to the
    // cavity floor. shellFromLayers caps the two ends: the deck
    // bottom (z = BASE_H) and the cavity floor disc.
    const floorZ = GF.BASE_H + floor_t;
    const inner = (inset, z) => { layers.push(offsetRing(ring, inset)); zs.push(z); };

    if (lipH) {
      // seat profile top-down: vertical edge, 45° chamfer, straight,
      // 45° chamfer — the mirror of the foot, at LIP_EDGE minimum
      const dks = [0, LIP_EDGE + GF.CLEAR, GF.BASE.C2,
                   GF.BASE.C2 + GF.BASE.S, LIP_H];
      for (const dd of dks) inner(lipSeatInset(dd), height - dd);
      // transition from the seat bottom to the cavity wall: a 45°
      // taper in either direction stays printable
      const span = Math.abs(lipSeatInset(LIP_H) - wall_t);
      if (span > 0.01) inner(wall_t, height - LIP_H - span);
    } else {
      inner(wall_t, height);
    }
    inner(wall_t, floorZ);
    parts.push(shellFromLayers(layers, zs));

    // Divider walls — closed boxes overlapping the floor and side
    // walls slightly so the slicer unions them into the bin. They
    // stop at the nominal top, below the stacking lip.
    const innerW = w - 2 * wall_t, innerD = d - 2 * wall_t;
    const bite = Math.min(0.6, wall_t / 2);   // penetration into the walls
    const divTop = height - lipH;
    const divZ0 = floorZ - OVERLAP;
    for (let i = 1; i <= div_x; i++) {
      const x = -innerW / 2 + innerW * i / (div_x + 1);
      parts.push(boxMesh(x - wall_t / 2, x + wall_t / 2,
                         -(innerD / 2 + bite), innerD / 2 + bite,
                         divZ0, divTop));
    }
    for (let i = 1; i <= div_y; i++) {
      const y = -innerD / 2 + innerD * i / (div_y + 1);
      parts.push(boxMesh(-(innerW / 2 + bite), innerW / 2 + bite,
                         y - wall_t / 2, y + wall_t / 2,
                         divZ0, divTop));
    }
  }

  const { positions, indices } = mergeParts(parts);
  return {
    positions, indices,
    width: w, depth: d, height, feet: nx * ny, leg_mult: m,
    style, lip: lipH > 0, div_x: lite ? 0 : div_x, div_y: lite ? 0 : div_y,
    verts: positions.length / 3, tris: indices.length / 3,
  };
}

// ── Baseplate ───────────────────────────────────────────────
// A grid of cells whose inner wall is the socket (negative of the
// bin base + clearance).
//
// cells_x / cells_y may be fractional — see cellSizes(): the plate
// spans exactly count × mult × 42 mm, a leftover that can hold a
// bin becomes a smaller socket, and anything narrower becomes a
// solid filler strip.
//
// style = 'normal' (default): closed floor under each socket — a
//   rigid plate for normal slicing. The socket depth is clamped so
//   at least 0.6 mm of floor remains (bins may sit a hair proud on
//   thin plates, resting on the chamfers — same as the lip).
// style = 'lite': open-bottom frames — minimal material.
export function buildBaseplate(params = {}) {
  const {
    cells_x = 3, cells_y = 3, mult = 1,
    corner_r = 4, spacing = 2, plate_h = 5, clear = GF.CLEAR,
    style = 'normal',
    // Explicit cell lists (as returned by cellSizes) override the
    // count+mult pair — that is how planPlateTiles() hands a single
    // tile of a split plate back to be built.
    xs: xsIn = null, ys: ysIn = null,
  } = params;

  const xs = xsIn || cellSizes(cells_x, mult);
  const ys = ysIn || cellSizes(cells_y, mult);
  const span = list => list.reduce((s, c) => s + c.u, 0) * GF.PITCH;
  const width = span(xs);
  const depth = span(ys);

  // Wall between a socket opening (footprint(u) + 2·clear) and its
  // cell boundary (u · PITCH). The u terms cancel, so this is the
  // same for every cell size — one uniform offset turns any socket
  // ring into its own cell outline, whatever that cell's size.
  const t = (GF.FOOT_GAP - 2 * clear) / 2;

  // z levels top-down through the socket profile, then to the bottom
  const zsSet = [0, plate_h - GF.BASE_H, plate_h - GF.BASE.C2 - GF.BASE.S,
                 plate_h - GF.BASE.C2, plate_h]
    .filter(z => z >= 0);
  const zs = [...new Set(zsSet)].sort((a, b) => a - b);

  // Socket ring + matching cell outline for a cell of uw × ud grid
  // units. Cached: a plate has at most a handful of distinct sizes.
  const ringCache = new Map();
  const ringsFor = (uw, ud) => {
    const key = uw + '×' + ud;
    let r = ringCache.get(key);
    if (!r) {
      const inner = roundedRectRing(footprint(uw) + 2 * clear,
                                    footprint(ud) + 2 * clear,
                                    corner_r + clear, spacing);
      r = { inner, outer: offsetRing(inner, -t) };
      ringCache.set(key, r);
    }
    return r;
  };

  // One cell solid: outer wall + inner (socket) wall + top/bottom annuli
  function cellMesh(cx, cy, uw, ud) {
    const { inner: innerBase, outer: outerRing } = ringsFor(uw, ud);
    const M = innerBase.length;
    const Lz = zs.length;
    // vertex layout: [inner layer 0..Lz-1][outer layer 0..Lz-1]
    const positions = new Float32Array(2 * Lz * M * 3);
    for (let l = 0; l < Lz; l++) {
      const inset = socketInset(plate_h - zs[l]);
      const inner = offsetRing(innerBase, inset);
      for (let k = 0; k < M; k++) {
        const i = (l * M + k) * 3;
        positions[i] = inner[k][0] + cx;
        positions[i + 1] = inner[k][1] + cy;
        positions[i + 2] = zs[l];
      }
    }
    const OUT = Lz * M;
    for (let l = 0; l < Lz; l++)
      for (let k = 0; k < M; k++) {
        const i = (OUT + l * M + k) * 3;
        positions[i] = outerRing[k][0] + cx;
        positions[i + 1] = outerRing[k][1] + cy;
        positions[i + 2] = zs[l];
      }

    const quads = (Lz - 1) * M * 2 + 2 * M;           // walls + 2 annuli
    const indices = new Uint32Array(quads * 2 * 3);
    let ii = 0;
    const IN = (l, k) => l * M + (k % M);
    const OU = (l, k) => OUT + l * M + (k % M);
    const quad = (a, b, c, d) => {                    // CCW from outside
      indices[ii++] = a; indices[ii++] = b; indices[ii++] = c;
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = d;
    };
    for (let l = 0; l < Lz - 1; l++)
      for (let k = 0; k < M; k++) {
        quad(OU(l, k), OU(l, k + 1), OU(l + 1, k + 1), OU(l + 1, k)); // outer
        quad(IN(l, k), IN(l + 1, k), IN(l + 1, k + 1), IN(l, k + 1)); // inner (reversed)
      }
    const T = Lz - 1;
    for (let k = 0; k < M; k++) {
      quad(IN(T, k + 1), IN(T, k), OU(T, k), OU(T, k + 1));           // top annulus (+z)
      quad(IN(0, k), IN(0, k + 1), OU(0, k + 1), OU(0, k));           // bottom annulus (−z)
    }
    return { positions, indices };
  }

  // Solid cell with a closed floor: one layer sweep — outer wall up,
  // rim annulus, socket profile down — capped by shellFromLayers with
  // the plate bottom and the socket floor disc.
  const socketDepth = Math.min(GF.BASE_H, plate_h - 0.6);
  function cellMeshSolid(cx, cy, uw, ud) {
    const { inner: innerBase, outer: outerRing } = ringsFor(uw, ud);
    const dks = [...new Set(
      [0, GF.BASE.C2, GF.BASE.C2 + GF.BASE.S, socketDepth]
        .filter(dd => dd <= socketDepth + 1e-9)
    )].sort((a, b) => a - b);
    const layers = [outerRing, outerRing];
    const zl = [0, plate_h];
    for (const dd of dks) {
      layers.push(offsetRing(innerBase, socketInset(dd)));
      zl.push(plate_h - dd);
    }
    const moved = layers.map(r => r.map(p => [p[0] + cx, p[1] + cy]));
    return shellFromLayers(moved, zl);
  }

  // Leftover too narrow for a bin — a plain solid strip. Square
  // corners on purpose: this is the edge that butts against a
  // drawer wall.
  function fillerMesh(cx, cy, uw, ud) {
    const w = uw * GF.PITCH, d = ud * GF.PITCH;
    return boxMesh(cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2, 0, plate_h);
  }

  // Tile cells left-to-right / front-to-back, plate centred on origin
  const parts = [];
  let xoff = -width / 2;
  for (const cellX of xs) {
    const cx = xoff + cellX.u * GF.PITCH / 2;
    let yoff = -depth / 2;
    for (const cellY of ys) {
      const cy = yoff + cellY.u * GF.PITCH / 2;
      const socket = cellX.socket && cellY.socket;
      parts.push(
        !socket            ? fillerMesh(cx, cy, cellX.u, cellY.u) :
        style === 'lite'   ? cellMesh(cx, cy, cellX.u, cellY.u)
                           : cellMeshSolid(cx, cy, cellX.u, cellY.u));
      yoff += cellY.u * GF.PITCH;
    }
    xoff += cellX.u * GF.PITCH;
  }

  const { positions, indices } = mergeParts(parts);
  return {
    positions, indices,
    width, depth, height: plate_h, style,
    cells_x: xs.length, cells_y: ys.length,
    sockets: xs.filter(c => c.socket).length * ys.filter(c => c.socket).length,
    verts: positions.length / 3, tris: indices.length / 3,
  };
}

// ════════════════════════════════════════════════════════════
//  BUILD-PLATE FITTING
// ════════════════════════════════════════════════════════════
// A drawer-sized baseplate is routinely bigger than the printer it
// has to come off. Rather than making the user do the arithmetic and
// build each piece by hand, we cut the plate into tiles that each fit
// a named build plate, and build every tile as a baseplate in its own
// right.
//
// The cut always lands on a CELL boundary. Splitting through a socket
// would leave two halves that no bin can sit in, so a tile boundary is
// only ever placed between cells — which also means the tiles butt
// together with no seam inside a socket when laid back down.

// Built-in printers, dimensions in mm (usable bed X × Y, max Z).
// Users add their own via addBuildPlate() — those are cached in
// localStorage by the app so they survive a reload.
export const BUILD_PLATES = [
  { id: 'elegoo_centauri_carbon', name: 'Elegoo Centauri Carbon', w: 250, d: 250, h: 250 },
  { id: 'bambu_a1_mini',          name: 'Bambu Lab A1 mini',      w: 180, d: 180, h: 180 },
];

// Default edge clearance, mm per side — brim/skirt room plus the
// couple of mm most beds lose to clips and the purge line.
export const PLATE_MARGIN = 5;

// Greedily group consecutive cells into runs no longer than maxMM.
// Greedy is optimal here: the cells are laid out in a fixed order, so
// packing each run as full as it goes minimises the number of runs.
//
// A single cell wider than maxMM cannot be split (that would cut a
// socket), so it goes out alone and is flagged `oversized` — the
// caller surfaces that rather than silently shipping an unprintable
// tile.
export function packRuns(cells, maxMM) {
  const runs = [];
  let cur = [], curMM = 0;
  for (const c of cells) {
    const mm = c.u * GF.PITCH;
    if (cur.length && curMM + mm > maxMM + 1e-9) {
      runs.push({ cells: cur, mm: curMM });
      cur = []; curMM = 0;
    }
    cur.push(c); curMM += mm;
  }
  if (cur.length) runs.push({ cells: cur, mm: curMM });
  for (const r of runs) r.oversized = r.mm > maxMM + 1e-9;
  return runs;
}

// Plan the split of a baseplate across a build plate.
//
// Returns the tile grid: each tile carries the cell lists to build it
// with, its own size, and the offset of its centre from the centre of
// the whole plate — so laying every tile at `x, y` reassembles exactly
// the plate the user asked for.
export function planPlateTiles(params = {}) {
  const {
    cells_x = 3, cells_y = 3, mult = 1,
    build_w = 250, build_d = 250, margin = PLATE_MARGIN,
    plate_h = 5, build_h = Infinity,
  } = params;

  const usableW = Math.max(GF.PITCH * MIN_SOCKET, build_w - 2 * margin);
  const usableD = Math.max(GF.PITCH * MIN_SOCKET, build_d - 2 * margin);

  const xs = cellSizes(cells_x, mult);
  const ys = cellSizes(cells_y, mult);
  const cols = packRuns(xs, usableW);
  const rows = packRuns(ys, usableD);

  const width = xs.reduce((s, c) => s + c.u, 0) * GF.PITCH;
  const depth = ys.reduce((s, c) => s + c.u, 0) * GF.PITCH;

  const tiles = [];
  let yoff = -depth / 2;
  for (let iy = 0; iy < rows.length; iy++) {
    const row = rows[iy];
    let xoff = -width / 2;
    for (let ix = 0; ix < cols.length; ix++) {
      const col = cols[ix];
      tiles.push({
        ix, iy,
        xs: col.cells, ys: row.cells,
        width: col.mm, depth: row.mm,
        x: xoff + col.mm / 2,
        y: yoff + row.mm / 2,
        oversized: col.oversized || row.oversized,
      });
      xoff += col.mm;
    }
    yoff += row.mm;
  }

  return {
    tiles, cols: cols.length, rows: rows.length,
    width, depth, usableW, usableD,
    // True when the plate already fits — the caller can then skip the
    // whole split and build it as one piece.
    single: cols.length === 1 && rows.length === 1,
    oversized: tiles.some(t => t.oversized),
    tooTall: plate_h > build_h + 1e-9,
  };
}

// ── Analysis helpers (used by tests) ────────────────────────
export function meshVolume({ positions, indices }) {
  let v = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    v += (ax * (by * cz - bz * cy)
        - ay * (bx * cz - bz * cx)
        + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}

// Every undirected edge must be shared by exactly 2 triangles,
// traversed once in each direction (watertight, consistent winding).
export function manifoldReport({ indices }) {
  const directed = new Map();
  for (let i = 0; i < indices.length; i += 3) {
    const t = [indices[i], indices[i + 1], indices[i + 2]];
    for (let e = 0; e < 3; e++) {
      const key = t[e] + '>' + t[(e + 1) % 3];
      directed.set(key, (directed.get(key) || 0) + 1);
    }
  }
  let bad = 0;
  for (const [key, n] of directed) {
    const [a, b] = key.split('>');
    if (n !== 1 || (directed.get(b + '>' + a) || 0) !== 1) bad++;
  }
  return { edges: directed.size, badEdges: bad, ok: bad === 0 };
}
