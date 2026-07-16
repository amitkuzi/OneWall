// ════════════════════════════════════════════════════════════
//  Gridfinity Creator — bins & baseplates
//  NORMAL style (default): bins with real walls + floor, optional
//  stacking lip and X/Y dividers; baseplates with a closed floor.
//  Prints in regular slicer mode — no special settings.
//  LITE style: solid bin body for Spiral vase mode (bottom shell
//  layers ≥ 26 ≈ 5.2 mm at 0.2 mm) + open-bottom baseplate frames.
//  Footprints in multiples of 0.5 / 1 / 2 / 4 units.
//
//  Customizer-ready for MakerWorld / Printables / Thangs.
//  Companion of the OneWall web preview (index.html → Gridfinity).
//
//  License: CC BY 4.0 — @Amitkuzi
// ════════════════════════════════════════════════════════════

/* [What to generate] */
// bin = storage bin, baseplate = socket grid
part = "bin"; // [bin, baseplate]
// normal = walls + floor (regular slicing); lite = solid body for Spiral vase mode / open-bottom plate
style = "normal"; // [normal, lite]

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

/* [Bin — normal style] */
// stacking lip on top — the feet of another bin seat into it
lip = true;
// wall thickness
wall_t = 1.2; // [0.8:0.1:3]
// floor thickness above the 4.75 mm base
floor_t = 1.0; // [0.6:0.2:3]
// divider walls across the width (splits X into div_x+1 compartments)
div_x = 0; // [0:1:8]
// divider walls across the depth (splits Y into div_y+1 compartments)
div_y = 0; // [0:1:8]

/* [Baseplate] */
// cells along X — fractional is fine (3.5 = three cells + a half)
cells_x = 3; // [0.5:0.05:8]
// cells along Y — fractional is fine (3.5 = three cells + a half)
cells_y = 3; // [0.5:0.05:8]
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
LIP_H     = 4.4;   // stacking lip height (0.35 less than the foot)
LIP_EDGE  = 0.6;   // thinnest printable edge at the lip top
MIN_SOCKET = 0.5;  // smallest bin step — thinner leftovers are filler
$fn = 48;

function footprint(u) = u * PITCH - FOOT_GAP;

// ── Fractional baseplate cells ──────────────────────────────
// Split a (possibly fractional) cell count into the cells actually
// built along one axis. Each entry is [size_in_grid_units, is_socket]:
// full cells of `m`, then the largest 0.5-step socket the remainder
// can hold, then a solid filler strip for any sliver too narrow for
// even a half-unit bin. The plate always spans count * m * 42 mm.
function snap_socket(u) = floor(u / MIN_SOCKET + 1e-9) * MIN_SOCKET;

function cell_sizes(count, m) =
  let (full = floor(count + 1e-9),
       rem  = (count - full) * m,
       snap = snap_socket(rem),
       left = rem - (snap >= MIN_SOCKET ? snap : 0))
  concat(
    full > 0 ? [for (i = [1 : full]) [m, true]] : [],
    snap >= MIN_SOCKET ? [[snap, true]] : [],
    left > 1e-6 ? [[left, false]] : []
  );

// Span of the first n entries, in grid units
function span_u(lst, n) = n <= 0 ? 0 : lst[n - 1][0] + span_u(lst, n - 1);
function total_u(lst) = span_u(lst, len(lst));
// Centre of cell i in mm, for a run centred on the origin
function cell_pos(lst, i) =
  -total_u(lst) * PITCH / 2 + span_u(lst, i) * PITCH + lst[i][0] * PITCH / 2;

// Socket wall inset at depth d below the opening (mirror of the foot)
function socket_inset(d) =
  d <= 0 ? 0 :
  d < BASE_C2 ? d :
  d < BASE_C2 + BASE_S ? BASE_C2 :
  d < BASE_H ? d - BASE_S : BASE_INSET;

// Lip seat inset at depth d below the bin top: the socket profile
// shifted out by the clearance, clamped to a printable edge
function seat_inset(d) = max(LIP_EDGE, socket_inset(d) - clearance);

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
//
// PRINT (style = normal): regular slicer settings — walls, floor,
// optional stacking lip and dividers are real geometry.
// PRINT (style = lite): Spiral vase ON + bottom shell layers ≥ 26
// (≈ 5.2 mm at 0.2 mm layers) so the feet and deck are solid
// before the spiral wall starts.
module gridfinity_foot(fw, fd) {
  hull() { slice(fw, fd, corner_r, 0,                BASE_INSET);
           slice(fw, fd, corner_r, BASE_C1,          BASE_C2); }
  hull() { slice(fw, fd, corner_r, BASE_C1,          BASE_C2);
           slice(fw, fd, corner_r, BASE_C1 + BASE_S, BASE_C2); }
  hull() { slice(fw, fd, corner_r, BASE_C1 + BASE_S, BASE_C2);
           slice(fw, fd, corner_r, BASE_H + 0.1,     0); }
}

// Cavity + lip-seat negative for a normal-style bin. Stacked hulls
// between profile slices; every transition is a 45° chamfer or a
// vertical wall, so the inside prints without supports.
module bin_negative(w, d, top) {
  fz  = BASE_H + floor_t;      // cavity floor
  eps = 0.1;
  if (lip) {
    sb   = seat_inset(LIP_H);              // seat bottom inset
    span = abs(sb - wall_t);               // 45° seat→wall transition
    hull() { slice(w, d, corner_r, fz,                     wall_t);
             slice(w, d, corner_r, top - LIP_H - span,     wall_t); }
    hull() { slice(w, d, corner_r, top - LIP_H - span,     wall_t);
             slice(w, d, corner_r, top - LIP_H,            sb); }
    hull() { slice(w, d, corner_r, top - LIP_H,            sb);
             slice(w, d, corner_r, top - BASE_C2 - BASE_S, seat_inset(BASE_C2 + BASE_S)); }
    hull() { slice(w, d, corner_r, top - BASE_C2 - BASE_S, seat_inset(BASE_C2 + BASE_S));
             slice(w, d, corner_r, top - BASE_C2,          seat_inset(BASE_C2)); }
    hull() { slice(w, d, corner_r, top - BASE_C2,          seat_inset(BASE_C2));
             slice(w, d, corner_r, top - LIP_EDGE - clearance, LIP_EDGE); }
    hull() { slice(w, d, corner_r, top - LIP_EDGE - clearance, LIP_EDGE);
             slice(w, d, corner_r, top + eps,              LIP_EDGE); }
  } else {
    hull() { slice(w, d, corner_r, fz,        wall_t);
             slice(w, d, corner_r, top + eps, wall_t); }
  }
}

// Divider walls: thin boxes overlapping the floor and side walls so
// they fuse into the bin. They stop below the stacking lip.
module bin_dividers(w, d, top) {
  iw   = w - 2 * wall_t;
  dep  = d - 2 * wall_t;
  bite = min(0.6, wall_t / 2);   // penetration into the walls
  fz   = BASE_H + floor_t;
  dtop = top - (lip ? LIP_H : 0);
  if (div_x >= 1)
    for (i = [1 : div_x])
      translate([-iw/2 + iw * i / (div_x + 1) - wall_t/2,
                 -(dep/2 + bite), fz - 0.1])
        cube([wall_t, dep + 2*bite, dtop - fz + 0.1]);
  if (div_y >= 1)
    for (i = [1 : div_y])
      translate([-(iw/2 + bite),
                 -dep/2 + dep * i / (div_y + 1) - wall_t/2, fz - 0.1])
        cube([iw + 2*bite, wall_t, dtop - fz + 0.1]);
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
  lip_h = (style == "normal" && lip) ? LIP_H : 0;
  top   = BASE_H + hu * HU + lip_h;
  union() {
    // feet tiling the footprint on the leg-pitch grid
    translate([-(nx - 1) * lp / 2, -(ny - 1) * lp / 2, 0])
      for (ix = [0 : nx - 1], iy = [0 : ny - 1])
        translate([ix * lp, iy * lp, 0])
          gridfinity_foot(fw, fd);
    if (style == "lite") {
      // solid body — the spiral/vase slicer turns it into one wall
      translate([0, 0, BASE_H])
        linear_extrude(hu * HU)
          rrect(w, d, corner_r);
    } else {
      difference() {
        translate([0, 0, BASE_H])
          linear_extrude(top - BASE_H)
            rrect(w, d, corner_r);
        bin_negative(w, d, top);
      }
      bin_dividers(w, d, top);
    }
  }
}

// ── Baseplate ───────────────────────────────────────────────
// Each cell's inner wall is the socket: the negative of the bin
// base plus clearance. Style normal keeps a closed floor under the
// socket (≥ 0.6 mm — on thin plates bins rest on the chamfers a
// hair proud, like the stacking lip). Style lite cuts a shaft
// through the floor → open-bottom frame, minimal material.
//
// Cells are sized per-axis by cell_sizes(), so cells_x / cells_y
// may be fractional: a leftover that can hold a bin becomes a
// smaller socket, a thinner sliver becomes a solid filler strip.
module socket_profile(uw = cell_mult, ud = cell_mult) {
  ow = footprint(uw) + 2 * clearance;   // top opening
  od = footprint(ud) + 2 * clearance;
  r  = corner_r + clearance;
  eps = 0.1;
  top = plate_h;
  union() {
    hull() { slice(ow, od, r, top - BASE_C2,          BASE_C2);
             slice(ow, od, r, top + eps,              -eps); }
    hull() { slice(ow, od, r, top - BASE_C2 - BASE_S, BASE_C2);
             slice(ow, od, r, top - BASE_C2,          BASE_C2); }
    hull() { slice(ow, od, r, top - BASE_H,           BASE_INSET);
             slice(ow, od, r, top - BASE_C2 - BASE_S, BASE_C2); }
  }
}

module socket_negative(uw = cell_mult, ud = cell_mult) {
  ow = footprint(uw) + 2 * clearance;
  od = footprint(ud) + 2 * clearance;
  r  = corner_r + clearance;
  eps = 0.1;
  union() {
    socket_profile(uw, ud);
    // straight shaft through the floor → open bottom
    translate([0, 0, -eps])
      linear_extrude(plate_h - BASE_H + 2*eps)
        rrect(ow - 2*BASE_INSET, od - 2*BASE_INSET, max(r - BASE_INSET, 0.3));
  }
}

// One cell: socket frame, or a plain solid strip when the cell is
// too narrow on either axis to hold a bin.
module baseplate_cell(uw, ud, is_socket) {
  cw = uw * PITCH;
  cd = ud * PITCH;
  floor_z = max(plate_h - BASE_H, 0.6);   // normal-style floor level
  if (!is_socket) {
    // filler — square corners: this edge butts against a drawer wall
    linear_extrude(plate_h) square([cw, cd], center = true);
  } else {
    difference() {
      linear_extrude(plate_h) rrect(cw, cd, 2);
      if (style == "lite") {
        socket_negative(uw, ud);
      } else {
        // truncate the socket at the floor level
        intersection() {
          socket_profile(uw, ud);
          translate([-cw/2, -cd/2, floor_z]) cube([cw, cd, plate_h]);
        }
      }
    }
  }
}

module gridfinity_baseplate(cx = cells_x, cy = cells_y, m = cell_mult) {
  xs = cell_sizes(cx, m);
  ys = cell_sizes(cy, m);
  for (i = [0 : len(xs) - 1], j = [0 : len(ys) - 1])
    translate([cell_pos(xs, i), cell_pos(ys, j), 0])
      baseplate_cell(xs[i][0], ys[j][0], xs[i][1] && ys[j][1]);
}

// ── Entry point ─────────────────────────────────────────────
if (part == "bin")       gridfinity_bin();
if (part == "baseplate") gridfinity_baseplate();
