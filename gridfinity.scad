// ════════════════════════════════════════════════════════════
//  Gridfinity Creator — LITE bins & baseplates
//  Vase-mode (spiral) printable bins + thin-wall open-bottom
//  baseplates. Footprints in multiples of 0.5 / 1 / 2 / 4 units.
//
//  Customizer-ready for MakerWorld / Printables / Thangs.
//  Companion of the OneWall web preview (index.html → Gridfinity).
//
//  Bin: print with Spiral vase ON, bottom shell layers ≥ 26
//  (≈ 5.2 mm at 0.2 mm layers — keeps the per-cell feet solid).
//  Baseplate: normal mode, 2 perimeters, no infill needed.
//
//  License: CC BY 4.0 — @Amitkuzi
// ════════════════════════════════════════════════════════════

/* [What to generate] */
// bin = vase-mode bin, baseplate = socket grid
part = "bin"; // [bin, baseplate]

/* [Bin size — Gridfinity units] */
// width in grid units
units_x = 1; // [0.5:0.5:8]
// depth in grid units
units_y = 1; // [0.5:0.5:8]
// height in 7 mm units (above the 4.75 mm base)
height_units = 3; // [1:0.5:12]
// leg size: 0.5 = 21 mm, 1 = 42 mm, 2 = 84 mm. Must divide the bin
// size on both axes; otherwise 0.5 legs are used (always valid).
leg_mult = 1; // [0.5, 1, 2]

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

// Does leg size m tile bin size u exactly?
function leg_fits(u, m) = abs(u / m - round(u / m)) < 1e-6;
// Requested leg size when it tiles both axes, else 0.5 (always valid)
function eff_leg(ux, uy, m) =
  (leg_fits(ux, m) && leg_fits(uy, m)) ? m : 0.5;

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

// ── Bin — spiral body on per-cell feet ──────────────────────
// The base is one standard Gridfinity foot PER 42 mm CELL (a 2x2
// bin gets 4 feet), so any size seats on a normal baseplate.
// Sub-unit (0.5) bins get a single small foot for 21 mm plates.
// Above the feet: one continuous wall for spiral/vase printing.
//
// PRINT: Spiral vase ON + bottom shell layers ≥ 26 (≈ 5.2 mm at
// 0.2 mm layers) so the feet and deck are solid before the spiral
// wall starts.
module gridfinity_foot(fw, fd) {
  hull() { slice(fw, fd, corner_r, 0,                BASE_INSET);
           slice(fw, fd, corner_r, BASE_C1,          BASE_C2); }
  hull() { slice(fw, fd, corner_r, BASE_C1,          BASE_C2);
           slice(fw, fd, corner_r, BASE_C1 + BASE_S, BASE_C2); }
  hull() { slice(fw, fd, corner_r, BASE_C1 + BASE_S, BASE_C2);
           slice(fw, fd, corner_r, BASE_H + 0.1,     0); }
}

module gridfinity_bin(ux = units_x, uy = units_y, hu = height_units,
                      lm = leg_mult) {
  w  = footprint(ux);
  d  = footprint(uy);
  m  = eff_leg(ux, uy, lm);   // leg size in grid units (0.5 / 1 / 2)
  lp = m * PITCH;             // leg pitch: 21 / 42 / 84 mm
  nx = round(ux / m);
  ny = round(uy / m);
  fw = footprint(m);
  fd = footprint(m);
  union() {
    // feet tiling the footprint on the leg-pitch grid
    translate([-(nx - 1) * lp / 2, -(ny - 1) * lp / 2, 0])
      for (ix = [0 : nx - 1], iy = [0 : ny - 1])
        translate([ix * lp, iy * lp, 0])
          gridfinity_foot(fw, fd);
    // continuous spiral body
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
