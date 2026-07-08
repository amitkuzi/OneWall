// ════════════════════════════════════════════════════════════
//  Gridfinity Creator — LITE bins & baseplates
//  Vase-mode (spiral) printable bins + thin-wall open-bottom
//  baseplates. Footprints in multiples of 0.5 / 1 / 2 / 4 units.
//
//  Customizer-ready for MakerWorld / Printables / Thangs.
//  Companion of the OneWall web preview (index.html → Gridfinity).
//
//  Bin: print with Spiral vase ON, bottom shell layers ≥ 3.
//  Baseplate: normal mode, 2 perimeters, no infill needed.
//
//  License: CC BY 4.0 — @Amitkuzi
// ════════════════════════════════════════════════════════════

/* [What to generate] */
// bin = vase-mode bin, baseplate = socket grid
part = "bin"; // [bin, baseplate]

/* [Bin size — Gridfinity units] */
// width in grid units
units_x = 1; // [0.5, 1, 2, 4]
// depth in grid units
units_y = 1; // [0.5, 1, 2, 4]
// height in 7 mm units (above the 4.75 mm base)
height_units = 3; // [1:0.5:12]

/* [Baseplate] */
// cells along X
cells_x = 3; // [1:1:8]
// cells along Y
cells_y = 3; // [1:1:8]
// cell size multiplier (0.5 = 21 mm half-pitch grid)
cell_mult = 1; // [0.5, 1, 2, 4]
// total plate height (socket profile is the top 4.75 mm)
plate_h = 5; // [4.75:0.25:8]

/* [Fit & style] */
// corner radius of bins / sockets
corner_r = 4; // [1:0.5:8]
// socket-to-bin clearance per side
clearance = 0.25; // [0.1:0.05:0.5]

/* [Hidden] */
PITCH     = 42;    // Gridfinity XY unit
HU        = 7;     // Gridfinity Z unit
FOOT_GAP  = 0.5;   // bin outer = units*42 - 0.5
BASE_C1   = 0.8;   // bottom 45° chamfer
BASE_S    = 1.8;   // straight section
BASE_C2   = 2.15;  // top 45° chamfer
BASE_H    = BASE_C1 + BASE_S + BASE_C2;   // 4.75
BASE_INSET = BASE_C1 + BASE_C2;           // 2.95
$fn = 48;

function footprint(u) = u * PITCH - FOOT_GAP;

// ── 2D rounded rectangle, centred ───────────────────────────
module rrect(w, d, r) {
  rr = max(0.05, min(r, w/2 - 0.05, d/2 - 0.05));
  offset(r = rr) square([w - 2*rr, d - 2*rr], center = true);
}

// One infinitely-thin slice of the profile at height z, inset `in`
module slice(w, d, r, z, in) {
  translate([0, 0, z])
    linear_extrude(0.001)
      rrect(w - 2*in, d - 2*in, max(r - in, 0.3));
}

// ── Bin — solid body, slicer spiralizes the outer wall ──────
// Base profile bottom-up: chamfer 0.8, straight 1.8, chamfer 2.15,
// then a straight wall of height_units * 7 mm.
module gridfinity_bin(ux = units_x, uy = units_y, hu = height_units) {
  w = footprint(ux);
  d = footprint(uy);
  union() {
    hull() { slice(w, d, corner_r, 0,                 BASE_INSET);
             slice(w, d, corner_r, BASE_C1,           BASE_C2); }
    hull() { slice(w, d, corner_r, BASE_C1,           BASE_C2);
             slice(w, d, corner_r, BASE_C1 + BASE_S,  BASE_C2); }
    hull() { slice(w, d, corner_r, BASE_C1 + BASE_S,  BASE_C2);
             slice(w, d, corner_r, BASE_H,            0); }
    translate([0, 0, BASE_H])
      linear_extrude(hu * HU)
        rrect(w, d, corner_r);
  }
}

// ── Baseplate — lite, open bottom (no floor) ────────────────
// Each cell is a frame whose inner wall is the socket: the
// negative of the bin base plus clearance. Bins drop in from the
// top; the open bottom saves material and print time.
module socket_negative(m = cell_mult) {
  ow = footprint(m) + 2 * clearance;   // top opening
  r  = corner_r + clearance;
  eps = 0.1;
  top = plate_h;
  union() {
    hull() { slice(ow, ow, r, top - BASE_C2,          BASE_C2);
             slice(ow, ow, r, top + eps,              -eps); }
    hull() { slice(ow, ow, r, top - BASE_C2 - BASE_S, BASE_C2);
             slice(ow, ow, r, top - BASE_C2,          BASE_C2); }
    hull() { slice(ow, ow, r, top - BASE_H,           BASE_INSET);
             slice(ow, ow, r, top - BASE_C2 - BASE_S, BASE_C2); }
    // straight shaft through the floor → open bottom
    translate([0, 0, -eps])
      linear_extrude(top - BASE_H + 2*eps)
        rrect(ow - 2*BASE_INSET, ow - 2*BASE_INSET, max(r - BASE_INSET, 0.3));
  }
}

module gridfinity_baseplate(cx = cells_x, cy = cells_y, m = cell_mult) {
  cell = m * PITCH;
  translate([-(cx - 1) * cell / 2, -(cy - 1) * cell / 2, 0])
    for (ix = [0 : cx - 1], iy = [0 : cy - 1])
      translate([ix * cell, iy * cell, 0])
        difference() {
          linear_extrude(plate_h) rrect(cell, cell, 2);
          socket_negative(m);
        }
}

// ── Entry point ─────────────────────────────────────────────
if (part == "bin")       gridfinity_bin();
if (part == "baseplate") gridfinity_baseplate();
