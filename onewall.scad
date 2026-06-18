// ============================================================
//  onewall.scad — Parametric Vase-Mode Bin & Container
//  OneWall — https://github.com/amitkuzi/OneWall
//  Customizer-ready for MakerWorld / Printables / Thangs
// ============================================================
//
//  VASE MODE — HOW IT WORKS:
//    The slicer receives a SOLID object and spiralizes its
//    OUTER perimeter into one continuous nozzle-wide wall.
//    Wall thickness & floor layers are set in the SLICER.
//
//  Slicer setup:
//    Bambu Studio : Strength -> Wall loops = 1, enable "Spiral vase"
//    PrusaSlicer  : Print Settings -> Layers -> Spiral vase = ON
//    Cura         : Special Modes -> Spiralize Outer Contour = ON
//
//  Recommended slicer settings:
//    • Solid bottom layers : 3–5
//    • Layer height         : 0.2 mm
//    • Line / nozzle width  : 0.4 mm (matches a single wall)
//
// ============================================================
//  HEIGHT IS DIVIDED INTO 3 SECTIONS:
//
//    HIGH  ───────────  wall -> upper lip transition
//          │ ~~~~~~~~ │
//    MID   │ ~~~~~~~~ │  wall: vertical profile + texture
//          │ ~~~~~~~~ │
//    LOW   ＼________／  bottom -> wall transition
//          ‾‾‾‾‾‾‾‾‾‾
// ============================================================


/* [Outer Dimensions] */

// Outer width — X (mm)
outer_w     = 265;  // [40:1:300]
// Outer depth — Y (mm)
outer_d     = 135;  // [40:1:300]
// Total height — Z (mm)
height      = 130;  // [20:1:400]
// Corner radius (mm) — 0 = sharp corners
corner_r    = 60;   // [0:0.5:120]


/* [Section Heights] */

// Height of the LOW (base) section (mm)
low_h       = 12;   // [3:1:60]
// Height of the HIGH (lip) section (mm)
high_h      = 5;    // [3:1:60]


/* [Low — Base Transition] */

// Footprint at the very bottom, relative to wall (1 = none, <1 = tucked foot)
base_scale  = 0.99; // [0.6:0.01:1.2]
// Transition curve: + = concave foot, - = flared skirt, 0 = straight
low_curve   = 0.1;  // [-3:0.1:3]


/* [Mid — Vertical Wall Profile] */

// Wall top scale vs. bottom of MID (1 = straight cylinder)
mid_top_scale     = 1.04; // [0.7:0.01:1.4]
// Profile curve shape
mid_profile       = "linear"; // [linear, barrel, hourglass, ogee, bell, doubleBulge, custom]
// Profile deviation magnitude (mm) — peak radial offset
mid_profile_amt   = 4;    // [0:0.1:25]
// CUSTOM only — oscillation cycles over MID height
mid_custom_freq   = 1.5;  // [0.25:0.25:8]
// CUSTOM only — phase shift (deg)
mid_custom_phase  = 0;    // [0:5:360]


/* [Mid — Wall Texture] */

// Pattern preset — crossed patterns (grid/fabric/diamond/knurl) add stiffness
wall_texture = "grid"; // [smooth, ribs, rings, grid, fabric, basket, diamond, diagonal, knurl, wave]
// Texture depth amplitude (mm)
tex_amp     = 0.9;  // [0:0.05:3]
// Cycles around the perimeter (vertical features)
tex_x       = 90;   // [4:1:200]
// Cycles up the height (horizontal features)
tex_z       = 28;   // [2:1:120]
// Texture fade-in/out at section borders (mm)
fade_len    = 3;    // [0:0.5:30]


/* [Mid — Decorative Wave Overlay] */

// Large lobe depth on top of texture (mm) — 0 = off
wave_amp    = 3;    // [0:0.1:8]
// Number of large lobes around perimeter
wave_lobes  = 6;    // [2:1:24]
// Helical twist over full height (deg)
wave_twist  = 45;   // [-360:5:360]


/* [High — Lip / Top Rim] */

// In vase mode the wall is a single nozzle-width spiral —
// you cannot literally print a "thick" wall. These styles give
// the top a stiff cross-section instead.
//
//   smooth   — gentle flare (uses lip_scale + high_curve)
//   rolled   — wall swells outward then curls back in (curved beam)
//   flange   — wide horizontal ledge at the top (very stiff)
//   bead     — short bulge near top (decorative + some stiffness)
//   ribbed   — adds Z-corrugation rings on top of any style
lip_style   = "rolled"; // [smooth, rolled, flange, bead, ribbed]

// SMOOTH only — top footprint, relative to wall (>1 = flared)
lip_scale   = 1.02; // [0.7:0.01:1.4]
// SMOOTH only — transition shape (+ = concave, - = convex)
high_curve  = 0.1;  // [-3:0.1:3]

// ROLLED / FLANGE / BEAD — peak outward scale (max swell)
lip_peak_scale = 1.18; // [0.9:0.01:1.6]
// ROLLED / FLANGE / BEAD — final scale at the very top
lip_top_scale  = 1.04; // [0.7:0.01:1.4]

// RIBBED — Z-corrugation rings count over the HIGH section
lip_ribs     = 4;   // [0:1:12]
// RIBBED — corrugation depth (mm)
lip_rib_amp  = 0.9; // [0:0.05:3]


/* [Optional — Label Recess] */

// Add a flat recess on the front face for a printed label
label_slot  = false;
// Label width (mm)
label_w     = 46;   // [10:1:200]
// Label height (mm)
label_h     = 16;   // [5:1:80]
// Label center height from floor (mm)
label_z     = 40;   // [5:1:300]
// Label recess depth (mm)
label_d     = 1.2;  // [0.2:0.1:3]


/* [Signature — Bottom Engraving] */

// Engrave a small text on the bottom of the bin (visible after print)
sig_enabled = true;
// Text to engrave
sig_text    = "@Amitkuzi";
// Text height (mm)
sig_size    = 6;    // [2:0.5:20]
// Engrave depth (mm) — keep at one layer height (0.2 mm) for the
// cleanest "carved watermark" look. Must be < (bottom_layers × layer_height).
sig_depth   = 0.2;  // [0.2:0.1:2]
// Font (any installed OpenSCAD font; Liberation Sans is bundled)
sig_font    = "Liberation Sans:style=Bold";


/* [Resolution] */

// Spacing of perimeter points (mm) — smaller = smoother, slower
point_spacing = 2.0; // [0.8:0.1:5]
// Vertical mesh slice height (mm) — smaller = smoother, slower
mesh_layer    = 1.2; // [0.4:0.1:4]


// ════════════════════════════════════════════════════════════
//  Customizer boundary — anything below is hidden from the UI.
//  Do NOT edit the code below unless you understand the math.
// ════════════════════════════════════════════════════════════

module __end_customizer__() {}

mid_h = height - low_h - high_h;

// Clamp corner radius so straight edges keep a positive length
cr = min(corner_r, outer_w / 2 - 0.5, outer_d / 2 - 0.5);
a  = outer_w / 2 - cr;
b  = outer_d / 2 - cr;

// ── MATH HELPERS ─────────────────────────────────────────────
function clampf(x, lo, hi) = max(lo, min(hi, x));
function lerp(x0, x1, t)   = x0 + (x1 - x0) * t;

// Smoothstep 0..1
function sstep(e0, e1, x) =
    let (t = clampf((x - e0) / (e1 - e0), 0, 1))
        t * t * (3 - 2 * t);

// Eased 0..1 ramp. e>0 = ease-in (concave), e<0 = ease-out, 0 = linear
function ease(t, e) =
    e == 0 ? t :
    e  > 0 ? pow(t, 1 + e)
           : 1 - pow(1 - t, 1 - e);

// ── CROSS-SECTION RING (rounded rectangle) ───────────────────
function ecount(len, sp) = len < sp * 0.5 ? 0 : max(1, round(len / sp));
function acount(r,   sp) = max(2, ceil((PI * r / 2) / sp));

function edge_pts(p0, p1, n) =
    n <= 0 ? [] :
    [ for (i = [0:n-1]) let (t = i / n)
        [ p0[0] + (p1[0]-p0[0]) * t, p0[1] + (p1[1]-p0[1]) * t ] ];

function arc_pts(cx, cy, r, a0, a1, n) =
    [ for (i = [0:n-1]) let (ang = a0 + (a1 - a0) * i / n)
        [ cx + r * cos(ang), cy + r * sin(ang) ] ];

base_ring = concat(
    edge_pts([ a+cr, -b], [ a+cr,  b], ecount(2*b, point_spacing)),
    arc_pts (  a,  b, cr,   0,  90,      acount(cr, point_spacing)),
    edge_pts([ a,  b+cr], [-a,  b+cr], ecount(2*a, point_spacing)),
    arc_pts ( -a,  b, cr,  90, 180,      acount(cr, point_spacing)),
    edge_pts([-a-cr,  b], [-a-cr, -b], ecount(2*b, point_spacing)),
    arc_pts ( -a, -b, cr, 180, 270,      acount(cr, point_spacing)),
    edge_pts([-a, -b-cr], [ a, -b-cr], ecount(2*a, point_spacing)),
    arc_pts (  a, -b, cr, 270, 360,      acount(cr, point_spacing))
);
M = len(base_ring);

// ── HIGH (LIP) SHAPE — scale as a function of t in [0,1] ─────
// t = 0 at the bottom of HIGH, t = 1 at the very top.
function high_lip_scale(t) =
    lip_style == "smooth"
        ? lerp(mid_top_scale, lip_scale, ease(t, high_curve))
    : lip_style == "rolled"
        ? (t < 0.5
            ? lerp(mid_top_scale, lip_peak_scale, sstep(0, 1, t * 2))
            : lerp(lip_peak_scale, lip_top_scale, sstep(0, 1, (t - 0.5) * 2)))
    : lip_style == "flange"
        ? (t < 0.18
            ? lerp(mid_top_scale, lip_peak_scale, sstep(0, 1, t / 0.18))
          : t < 0.82
            ? lip_peak_scale
            : lerp(lip_peak_scale, lip_top_scale, sstep(0, 1, (t - 0.82) / 0.18)))
    : lip_style == "bead"
        ? (t < 0.25
            ? lerp(mid_top_scale, mid_top_scale, t)
          : t < 0.65
            ? lerp(mid_top_scale, lip_peak_scale, sstep(0, 1, (t - 0.25) / 0.40))
          : lerp(lip_peak_scale, lip_top_scale, sstep(0, 1, (t - 0.65) / 0.35)))
    : lip_style == "ribbed"
        ? lerp(mid_top_scale, lip_top_scale, ease(t, high_curve))
    : mid_top_scale;

// Ribbed lip corrugation — radial offset (mm), HIGH section only
function lip_rib_offset(z) =
    lip_style == "ribbed" && lip_ribs > 0 && z >= height - high_h
        ? lip_rib_amp * cos(360 * lip_ribs *
                            (z - (height - high_h)) / high_h)
        : 0;

// ── VERTICAL SCALE — basic 3-section taper ───────────────────
function section_scale(z) =
    z <= low_h
        ? lerp(base_scale, 1, ease(z / low_h, low_curve))
    : z >= height - high_h
        ? high_lip_scale((z - (height - high_h)) / high_h)
        : lerp(1, mid_top_scale, (z - low_h) / mid_h);

// ── FADE in/out at MID borders ───────────────────────────────
function fade(z) =
    sstep(low_h, low_h + fade_len, z)
    * (1 - sstep(height - high_h - fade_len, height - high_h, z));

// ── VERTICAL PROFILE — signed radial offset (mm) along height
function profile_curve(t) =
    mid_profile == "linear"      ? 0 :
    mid_profile == "barrel"      ?  sin(180 * t) :
    mid_profile == "hourglass"   ? -sin(180 * t) :
    mid_profile == "ogee"        ?  sin(360 * t) :
    mid_profile == "bell"        ?  pow(1 - pow(2*t - 1, 2), 2) :
    mid_profile == "doubleBulge" ?  sin(180 * t) * sin(360 * t) :
    mid_profile == "custom"      ?  sin(360 * mid_custom_freq * t + mid_custom_phase) :
    0;

function vprofile_offset(z) =
    z < low_h || z > height - high_h ? 0 :
    let (t  = (z - low_h) / mid_h,
         fz = fade(z))
        fz * mid_profile_amt * profile_curve(t);

// ── WALL TEXTURE — chosen preset ─────────────────────────────
// s ∈ [0,1) around the perimeter,  tz ∈ [0,1] up the height.
function tex(s, tz) =
    wall_texture == "smooth"   ? 0 :
    wall_texture == "ribs"     ? cos(360 * tex_x * s) :
    wall_texture == "rings"    ? cos(360 * tex_z * tz) :
    wall_texture == "grid"     ? 0.5 * (cos(360 * tex_x * s)
                                      + cos(360 * tex_z * tz)) :
    wall_texture == "fabric"   ? sin(360 * tex_x * s)
                               * sin(360 * tex_z * tz) :
    wall_texture == "basket"   ? 0.5 * (sin(360 * tex_x * s)
                                      + sin(360 * tex_z * tz)
                                      + sin(360 * tex_x * s)
                                      * sin(360 * tex_z * tz)) :
    wall_texture == "diamond"  ? cos(360 * (tex_x * s + tex_z * tz)) :
    wall_texture == "diagonal" ? cos(360 * tex_x * (s + 0.5 * tz)) :
    wall_texture == "knurl"    ? 0.5 * (cos(360 * tex_x * (s + 0.5 * tz))
                                      + cos(360 * tex_x * (s - 0.5 * tz))) :
    wall_texture == "wave"     ? cos(360 * wave_lobes * s + wave_twist * tz) :
    0;

// ── TOTAL RADIAL DISPLACEMENT (along outward normal) ─────────
function modul(s, z) =
    let (tz = z / height, fz = fade(z))
        vprofile_offset(z)
      + fz * tex_amp * tex(s, tz)
      + fz * wave_amp * cos(360 * wave_lobes * s + wave_twist * tz)
      + lip_rib_offset(z);

// ── BUILD POLYHEDRON ─────────────────────────────────────────
L     = max(2, round(height / mesh_layer) + 1);
zstep = height / (L - 1);

verts = [
    for (l = [0:L-1])
        let (z = l * zstep, S = section_scale(z))
        for (k = [0:M-1])
            let (p   = base_ring[k],
                 rad = max(sqrt(p[0]*p[0] + p[1]*p[1]), 0.0001),
                 nx  = p[0] / rad,
                 ny  = p[1] / rad,
                 d   = modul(k / M, z))
            [ p[0]*S + nx*d, p[1]*S + ny*d, z ]
];

function I(l, k) = l * M + (k % M);

side_faces = [
    for (l = [0:L-2]) for (k = [0:M-1])
        each [
            [ I(l, k), I(l+1, k+1), I(l,   k+1) ],
            [ I(l, k), I(l+1, k),   I(l+1, k+1) ]
        ]
];

bottom_face = [ [ for (k = [0:M-1])     k             ] ];
top_face    = [ [ for (k = [M-1:-1:0]) (L-1)*M + k    ] ];

module bin_body() {
    polyhedron(points = verts,
               faces  = concat(side_faces, bottom_face, top_face),
               convexity = 12);
}

// ── LABEL RECESS (optional) ──────────────────────────────────
module label_cutter() {
    Sz      = section_scale(label_z);
    front_y = -(outer_d / 2) * Sz;
    translate([0, front_y - label_d / 2 + 0.01, label_z])
        cube([label_w, label_d + 2, label_h], center = true);
}

// ── SIGNATURE (engraved on the bottom) ───────────────────────
// Mirror in X so the engraving reads correctly when the printed
// bin is flipped over to view its underside.
module signature_cutter() {
    if (sig_enabled && sig_text != "") {
        translate([0, 0, -0.01])
            linear_extrude(height = sig_depth + 0.02)
                mirror([1, 0, 0])
                    text(sig_text,
                         size   = sig_size,
                         font   = sig_font,
                         halign = "center",
                         valign = "center");
    }
}

// ── RENDER ───────────────────────────────────────────────────
module svase() {
    difference() {
        bin_body();
        if (label_slot) label_cutter();
        signature_cutter();
    }
}

svase();


// ============================================================
//  CUSTOMIZER NOTES
//
//  Texture presets and stiffness:
//   • grid / fabric / diamond / knurl — crossed ribs, strongest
//   • ribs / rings — single-direction stiffening
//   • wave / smooth — decorative, lowest stiffness
//   • Higher tex_amp and tighter spacing = stiffer wall
//
//  Vertical profiles:
//   • linear      — straight wall (only taper applies)
//   • barrel      — bulges outward at the middle
//   • hourglass   — pinches inward at the middle
//   • ogee        — S-curve
//   • bell        — soft fat middle
//   • doubleBulge — two stacked bulges
//   • custom      — sin(freq, phase)
//
//  Print: enable Spiral/Vase mode, 1 wall, 3–5 solid bottom layers.
// ============================================================
