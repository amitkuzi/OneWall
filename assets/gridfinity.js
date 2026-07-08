// ════════════════════════════════════════════════════════════
//  Gridfinity Creator — geometry math module
//  Dependency-free ES module: runs both in the browser (index.html
//  wraps the buffers into THREE.BufferGeometry) and in Node for the
//  test suite (tests/gridfinity.test.mjs).
//
//  Focus: LITE, vase-mode (spiral) printable bins + thin-wall
//  baseplates, footprints in multiples of 0.5 / 1 / 2 / 4 units.
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

// ── Bin (spiral body on per-cell feet) ──────────────────────
// The base is a grid of standard Gridfinity feet — one per 42 mm
// cell (or a single sub-unit foot for 0.5 bins) — so any bin size
// drops onto a normal baseplate. Above the feet sits one continuous
// wall body for the slicer's spiral/vase mode.
//
// Print: bottom shell layers ≥ 26 (≈ 5.2 mm at 0.2 mm) so the feet
// and the deck above them are solid before the spiral wall starts.
export function buildBin(params = {}) {
  const {
    units_x = 1, units_y = 1, height_units = 3, leg_mult = 1,
    corner_r = 4, spacing = 2, layer_step = 1.5,
    // optional spiral rib texture on the wall above the base
    ribs = 0, rib_amp = 0, rib_twist = 0,
  } = params;

  const w = footprint(units_x);
  const d = footprint(units_y);
  const height = GF.BASE_H + height_units * GF.HU;
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

  // Body — one continuous outline from the top of the feet up
  const ring = roundedRectRing(w, d, corner_r, spacing);
  const M = ring.length;
  const zs = [GF.BASE_H];
  const wallSteps = Math.max(1, Math.ceil((height - GF.BASE_H) / layer_step));
  for (let i = 1; i <= wallSteps; i++)
    zs.push(GF.BASE_H + (height - GF.BASE_H) * i / wallSteps);

  const layers = zs.map(z => {
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
  });
  parts.push(shellFromLayers(layers, zs));

  const { positions, indices } = mergeParts(parts);
  return {
    positions, indices,
    width: w, depth: d, height, feet: nx * ny, leg_mult: m,
    verts: positions.length / 3, tris: indices.length / 3,
  };
}

// ── Baseplate (lite: open-bottom socket frames) ─────────────
// A grid of cells; each cell is a closed "donut" solid whose inner
// wall is the socket (negative of the bin base + clearance) and
// whose outer wall is the cell boundary. No floor → minimal
// material. Cells overlap nothing; adjacent walls touch.
export function buildBaseplate(params = {}) {
  const {
    cells_x = 3, cells_y = 3, mult = 1,
    corner_r = 4, spacing = 2, plate_h = 5, clear = GF.CLEAR,
  } = params;

  const cell = mult * GF.PITCH;                       // cell pitch
  const openW = footprint(mult) + 2 * clear;          // top opening
  const openD = openW;
  const t = (cell - openW) / 2;                       // top wall thickness

  // z levels top-down through the socket profile, then to the bottom
  const zsSet = [0, plate_h - GF.BASE_H, plate_h - GF.BASE.C2 - GF.BASE.S,
                 plate_h - GF.BASE.C2, plate_h]
    .filter(z => z >= 0);
  const zs = [...new Set(zsSet)].sort((a, b) => a - b);

  const innerBase = roundedRectRing(openW, openD, corner_r + clear, spacing);
  const M = innerBase.length;
  const outerRing = offsetRing(innerBase, -t);        // cell boundary

  // One cell solid: outer wall + inner (socket) wall + top/bottom annuli
  function cellMesh(cx, cy) {
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

  // Tile cells, centred on the origin
  const parts = [];
  const x0 = -(cells_x - 1) * cell / 2;
  const y0 = -(cells_y - 1) * cell / 2;
  for (let ix = 0; ix < cells_x; ix++)
    for (let iy = 0; iy < cells_y; iy++)
      parts.push(cellMesh(x0 + ix * cell, y0 + iy * cell));

  const { positions, indices } = mergeParts(parts);
  return {
    positions, indices,
    width: cells_x * cell, depth: cells_y * cell, height: plate_h,
    verts: positions.length / 3, tris: indices.length / 3,
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
