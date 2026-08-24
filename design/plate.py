"""Continuous Deposition — Plate I.  One continuous line, no seam."""
import math, random
from reportlab.pdfgen import canvas as rl
from reportlab.lib.colors import Color, HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

W, H = 1190.55, 1683.78          # A2 portrait, points
M    = 92.0                       # outer margin
OUT  = "D:/Development/OneWall/design/continuous-deposition.pdf"
FD   = "D:/Development/OneWall/design/fonts"

for n, w in [("Archivo", 300), ("Archivo", 400), ("Archivo", 600), ("Archivo", 800),
             ("PublicSans", 300), ("PublicSans", 400), ("PublicSans", 600)]:
    pdfmetrics.registerFont(TTFont(f"{n}-{w}", f"{FD}/{n}-{w}.ttf"))

GROUND  = HexColor("#F4EFE7")
INK     = HexColor("#221E1A")
INK2    = HexColor("#6E6357")
EMBER   = HexColor("#E4632D")
EMBERINK= HexColor("#B8431A")
BRASS   = HexColor("#C9A227")

def mix(a, b, t):
    return Color(a.red + (b.red - a.red) * t,
                 a.green + (b.green - a.green) * t,
                 a.blue + (b.blue - a.blue) * t)

def alpha(c, a):
    return Color(c.red, c.green, c.blue, alpha=a)

def txt(c, x, y, s, font, size, col, tracking=0, align="l"):
    c.setFont(font, size)
    c.setFillColor(col)
    w = pdfmetrics.stringWidth(s, font, size) + tracking * max(0, len(s) - 1)
    if align == "r": x -= w
    elif align == "c": x -= w / 2
    to = c.beginText(x, y)
    to.setFont(font, size)
    to.setFillColor(col)
    to.setCharSpace(tracking)
    to.textOut(s)
    c.drawText(to)
    return w

# ─────────────────────────────────────────────────── the vessel: one path
CX      = W / 2
BASE_Y  = 452.0
TOP_Y   = 1322.0
RX      = 268.0        # horizontal radius at r = 1
RY      = 74.0         # ellipse squash (viewing angle)
TURNS   = 232          # deposited layers
STEPS   = 168          # samples per layer
FLUTES  = 22

def profile(t):
    """radius multiplier along normalised height — LOW / MID / HIGH sections."""
    if t < 0.11:                                   # bottom → wall transition
        u = t / 0.11
        return 0.50 + 0.50 * math.sin(u * math.pi / 2) ** 1.15
    if t < 0.87:                                   # wall
        u = (t - 0.11) / 0.76
        return 1.0 + 0.052 * math.sin(u * math.pi) - 0.030 * u
    u = (t - 0.87) / 0.13                          # wall → upper lip
    return 0.992 + 0.088 * (u ** 1.7)

def texture(t, th):
    if t < 0.10 or t > 0.90:
        return 0.0
    env = min(1.0, (t - 0.10) / 0.10, (0.90 - t) / 0.10)
    return 0.0295 * env * math.sin(FLUTES * th + t * 5.6)

def point(i, n):
    t  = i / n
    th = 2 * math.pi * TURNS * t
    r  = profile(t) + texture(t, th)
    return (CX + r * RX * math.cos(th),
            BASE_Y + t * (TOP_Y - BASE_Y) + r * RY * math.sin(th),
            t, th)

def draw_vessel(c):
    n = TURNS * STEPS
    px, py, _, _ = point(0, n)
    for i in range(1, n + 1):
        x, y, t, th = point(i, n)
        s     = math.sin(th)
        front = max(0.0, -s)                       # 1 = nearest the viewer
        edge  = abs(math.cos(th)) ** 10            # the silhouette, seen edge-on
        if s > 0.02:                               # back of the wall — cooled
            col, lw, a = INK2, 0.28, 0.09 + 0.20 * (1 - s)
        else:
            heat = front ** 2.6
            col  = mix(INK, EMBER, heat * 0.70)
            lw   = 0.30 + 0.42 * heat
            a    = 0.34 + 0.60 * heat
        a  = min(0.96, a + 0.34 * edge)            # crisp the profile
        lw = lw + 0.16 * edge
        if t > 0.965:                              # the rim: where rising stops
            col, a, lw = mix(col, BRASS, 0.80), min(0.96, a + 0.30), lw + 0.14
        c.setStrokeColor(alpha(col, a))
        c.setLineWidth(lw)
        c.line(px, py, x, y)
        px, py = x, y

def draw_seat(c):
    """the cooled air the object sits in"""
    for k in range(26):
        u = k / 25
        c.setStrokeColor(alpha(INK2, 0.085 * (1 - u) ** 2))
        c.setLineWidth(0.4)
        rx, ry = 0.50 * RX + u * 62, 0.50 * RY + u * 17
        c.ellipse(CX - rx, BASE_Y - ry, CX + rx, BASE_Y + ry)

# ─────────────────────────────────────────────────── margin instrumentation
def ladder(c):
    x0, x1 = M, M + 26
    c.setLineWidth(0.4)
    c.setStrokeColor(alpha(INK2, 0.55))
    c.line(x0, BASE_Y, x0, TOP_Y)
    for k in range(0, TURNS + 1, 4):
        y = BASE_Y + (k / TURNS) * (TOP_Y - BASE_Y)
        major = (k % 40 == 0)
        c.setStrokeColor(alpha(INK2, 0.62 if major else 0.24))
        c.line(x0, y, x0 + (18 if major else 7), y)
        if major:
            txt(c, x0 + 24, y - 2.6, f"{k:03d}", "PublicSans-400", 6.4, alpha(INK2, .85), .8)
    txt(c, x0, TOP_Y + 16, "LAYER", "PublicSans-600", 6.6, alpha(INK, .8), 2.2)
    txt(c, x0, BASE_Y - 22, "0.20 mm", "PublicSans-400", 6.6, alpha(INK2, .9), 1.6)

def gauge(c):
    """right margin: the two frequencies, fast and slow"""
    x = W - M
    c.setLineWidth(0.4)
    c.setStrokeColor(alpha(INK2, 0.55))
    c.line(x, BASE_Y, x, TOP_Y)
    for k in range(0, 233):
        t = k / 232
        y = BASE_Y + t * (TOP_Y - BASE_Y)
        L = 4 + 22 * min(1.0, abs(profile(t) - 0.985) / 0.11)
        c.setStrokeColor(alpha(EMBER if k % 22 == 0 else INK2, 0.60 if k % 22 == 0 else 0.30))
        c.line(x, y, x - L, y)
    txt(c, x, TOP_Y + 16, "Ø PROFILE", "PublicSans-600", 6.6, alpha(INK, .8), 2.2, "r")

def grain(c, seed=7):
    rnd = random.Random(seed)
    for _ in range(26000):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        c.setFillColor(alpha(INK, rnd.uniform(0.012, 0.045)))
        s = rnd.uniform(0.35, 0.9)
        c.rect(x, y, s, s, stroke=0, fill=1)

# ─────────────────────────────────────────────────── identity
def mark(c, x, y, s):
    """the deposited-layers 'A' — brand mark, redrawn as vector"""
    bars = [(2, 30, 44, EMBER, 1.0), (6, 22, 36, EMBER, .8),
            (10, 14, 28, BRASS, 1.0), (16, 6, 16, BRASS, .65)]
    for bx, by, bw, col, a in bars:
        c.setFillColor(alpha(col, a))
        c.roundRect(x + bx * s, y + (42 - by - 6) * s, bw * s, 6 * s, 2 * s, stroke=0, fill=1)

def rule(c, y, x0=M, x1=W - M, a=0.35, lw=0.5):
    c.setStrokeColor(alpha(INK, a))
    c.setLineWidth(lw)
    c.line(x0, y, x1, y)

def page_frame(c, plate, specimen, phrase, note, fig, footer_left):
    """the fixed apparatus every plate is built inside"""
    ty = H - M
    c.setFillColor(GROUND); c.rect(0, 0, W, H, stroke=0, fill=1)
    grain(c, seed=7 + 13 * len(plate))
    rule(c, ty, a=.55, lw=0.8)
    txt(c, M, ty + 13, "CONTINUOUS DEPOSITION", "Archivo-600", 8.4, INK, 3.6)
    txt(c, W - M, ty + 13, f"PLATE  {plate}  ·  SPECIMEN  {specimen}",
        "PublicSans-400", 8.4, alpha(INK2, .95), 2.4, "r")

    txt(c, M, ty - 108, phrase[0], "Archivo-300", 92, alpha(INK, .92), -1.2)
    txt(c, M, ty - 190, phrase[1], "Archivo-300", 92, alpha(INK2, .78), -1.2)
    c.setStrokeColor(alpha(EMBER, .9)); c.setLineWidth(2.2)
    c.line(M, ty - 224, M + 86, ty - 224)

    nx, ny = W - M, ty - 116
    for i, line in enumerate(note):
        txt(c, nx, ny - i * 13.2, line, "PublicSans-300", 8.6, alpha(INK2, .95), 0, "r")
    txt(c, nx, ny - 58, fig, "PublicSans-600", 6.8, alpha(INK, .75), 2.4, "r")

    rule(c, M + 34, a=.3, lw=0.5)
    txt(c, M, M + 18, footer_left, "PublicSans-400", 7.0, alpha(INK2, .9), 2.2)
    txt(c, W - M, M + 18, f"CONTINUOUS DEPOSITION  /  {plate}",
        "PublicSans-400", 7.0, alpha(INK2, .9), 2.2, "r")

def caption(c, cx, y, head, sub):
    txt(c, cx, y, head, "PublicSans-600", 7.2, alpha(INK, .78), 3.0, "c")
    txt(c, cx, y - 15, sub, "PublicSans-300", 7.6, alpha(INK2, .9), .6, "c")

def compose(c):
    ty = H - M
    page_frame(c, "I", "ONEWALL", ("ONE WALL.", "NO SEAM."),
               ["A single nozzle-wide path, spiralised,",
                "rising 232 layers without lifting.",
                "The body is the record of the path."],
               "FIG. 01  ·  VASE MODE",
               "ONEWALL  ·  PARAMETRIC VASE-MODE VESSEL")

    # the object
    draw_seat(c)
    draw_vessel(c)
    ladder(c)
    gauge(c)

    # caption under the object
    caption(c, CX, BASE_Y - 62, "OBSERVED  ·  ONE CONTINUOUS EXTRUSION",
            "22 flutes · lip flare 8.8% · wall 0.42 mm")

    # ── identity block
    by = M + 178
    rule(c, by, a=.5, lw=0.8)
    mark(c, M, by - 58, 1.18)

    ix = M + 84
    txt(c, ix, by - 30, "AMIT KUZI", "Archivo-600", 20, INK, 2.0)
    txt(c, ix, by - 48, "@Amitkuzi", "PublicSans-400", 10.5, alpha(EMBERINK, 1), 1.0)
    txt(c, ix, by - 64, "ISRAEL", "PublicSans-600", 7.2, alpha(INK2, .95), 2.6)

    bx = M + 400
    for i, line in enumerate(["Software architect and engineering leader.",
                              "Backend systems by day,",
                              "parametric prints by night."]):
        txt(c, bx, by - 30 - i * 15, line, "PublicSans-300", 10.2, alpha(INK, .88))

    lx = W - M
    txt(c, lx, by - 30, "linkedin.com/in/amitkuzi", "PublicSans-400", 9.4, alpha(INK2, .95), .3, "r")
    txt(c, lx, by - 45, "github.com/amitkuzi", "PublicSans-400", 9.4, alpha(INK2, .95), .3, "r")
    txt(c, lx, by - 60, "github.com/amitkuzi/OneWall", "PublicSans-400", 9.4, alpha(INK, .9), .3, "r")


# ════════════════════════════════════════════════════════════
#  PLATE II — the module.  One pitch, obeyed.
# ════════════════════════════════════════════════════════════
U    = 42.0        # the pitch, in millimetres
HU   = 7.0         # height unit
LAYER = 0.2

def rrect_path(w, d, r, n=340):
    """closed rounded-rectangle outline, sampled at roughly even spacing"""
    hw, hd = w / 2, d / 2
    r = max(0.0, min(r, hw, hd))
    # (kind, data) walked counter-clockwise from the +x edge
    segs = [("l", (hw, -hd + r, hw, hd - r)),
            ("a", (hw - r, hd - r, 0.0)),
            ("l", (hw - r, hd, -hw + r, hd)),
            ("a", (-hw + r, hd - r, math.pi / 2)),
            ("l", (-hw, hd - r, -hw, -hd + r)),
            ("a", (-hw + r, -hd + r, math.pi)),
            ("l", (-hw + r, -hd, hw - r, -hd)),
            ("a", (hw - r, -hd + r, 3 * math.pi / 2))]
    lens = [math.hypot(v[2] - v[0], v[3] - v[1]) if k == "l" else math.pi * r / 2
            for k, v in segs]
    total = sum(lens) or 1.0
    pts = []
    for (k, v), L in zip(segs, lens):
        m = max(1, int(round(n * L / total)))
        for i in range(m):
            u = i / m
            if k == "l":
                pts.append((v[0] + (v[2] - v[0]) * u, v[1] + (v[3] - v[1]) * u))
            else:
                a = v[2] + u * math.pi / 2
                pts.append((v[0] + r * math.cos(a), v[1] + r * math.sin(a)))
    return pts

def iso(x, y, z, ox, oy, s):
    return (ox + (x - y) * 0.866 * s,
            oy + (x + y) * 0.5 * s + z * s)

def draw_bin(c, ux, uy, hu, ox, oy, s):
    """a gridfinity bin, accumulated one 0.2 mm contour at a time"""
    w, d, h = ux * U, uy * U, hu * HU
    nz  = int(h / LAYER)
    dmax = (w + d) / 2
    for k in range(nz + 1):
        z = k * LAYER
        # feet: below 4.75 mm the body is not one outline but one per module.
        # Drawn sparsely — they belong under the body, not in front of it.
        if z < 4.75:
            if k % 4:
                continue
            inset = 2.6 if z < 0.8 else (2.6 - 2.0 * min(1, (z - 0.8) / 1.8))
            cells = [(i, j) for i in range(int(ux)) for j in range(int(uy))]
            paths = [(rrect_path(U - 2 * inset - 0.5, U - 2 * inset - 0.5, 3.6, 150),
                      (i + .5) * U - w / 2, (j + .5) * U - d / 2) for i, j in cells]
        else:
            lip = max(0.0, (z - (h - 4.4)) / 4.4)
            g   = 0.25 * (1 - lip)
            paths = [(rrect_path(w - 2 * g, d - 2 * g, 7.5, 420), 0, 0)]
        top = k > nz - 3
        for pts, cx0, cy0 in paths:
            prev = None
            for (px, py) in pts + pts[:1]:
                X, Y = iso(px + cx0, py + cy0, z, ox, oy, s)
                dep  = -(px + cx0 + py + cy0) / (2 * dmax)     # +1 = nearest the viewer
                if prev:
                    heat = max(0.0, dep) ** 1.35
                    col  = mix(INK, EMBER, heat * 0.88)
                    a    = (0.20 + 0.66 * dep) if dep > 0 else (0.09 + 0.10 * (1 + dep))
                    lw   = 0.28 + 0.30 * heat
                    if z < 4.75:
                        a *= 0.30                      # the feet sit under
                    if top:
                        col, a, lw = mix(col, BRASS, .8), min(.95, a + .3), lw + .12
                    c.setStrokeColor(alpha(col, a)); c.setLineWidth(lw)
                    c.line(prev[0], prev[1], X, Y)
                prev = (X, Y)
    # the opening: inner rim, one wall thickness in
    rim = rrect_path(w - 2.4, d - 2.4, 6.6, 420)
    c.setStrokeColor(alpha(BRASS, .55)); c.setLineWidth(0.5)
    prev = None
    for (px, py) in rim + rim[:1]:
        X, Y = iso(px, py, h, ox, oy, s)
        if prev:
            c.line(prev[0], prev[1], X, Y)
        prev = (X, Y)

def plan(c, ux, uy, ox, oy, s, rings=3, divisions=True):
    """top view of a footprint: nested contours + module division"""
    w, d = ux * U, uy * U
    for k in range(rings):
        g = k * 1.6
        pts = rrect_path(w - 2 * g, d - 2 * g, max(1.5, 7.5 - g), 260)
        c.setStrokeColor(alpha(INK if k == 0 else INK2, .70 if k == 0 else .28))
        c.setLineWidth(0.55 if k == 0 else 0.34)
        p = c.beginPath(); p.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
        for (px, py) in pts[1:]:
            p.lineTo(ox + px * s, oy + py * s)
        p.close(); c.drawPath(p)
    if divisions:
        c.setStrokeColor(alpha(EMBER, .40)); c.setLineWidth(0.4)
        for i in range(1, int(math.ceil(ux))):
            x = -w / 2 + i * U
            if x < w / 2 - .1:
                c.line(ox + x * s, oy - d / 2 * s + 2, ox + x * s, oy + d / 2 * s - 2)
        for j in range(1, int(math.ceil(uy))):
            y = -d / 2 + j * U
            if y < d / 2 - .1:
                c.line(ox - w / 2 * s + 2, oy + y * s, ox + w / 2 * s - 2, oy + y * s)

def compose_two(c):
    page_frame(c, "II", "GRIDFINITY BIN", ("ONE PITCH.", "42 mm."),
               ["Every bin is a whole number of the same",
                "distance. Choose it once; obey it after.",
                "The fit is the only place to be excellent."],
               "FIG. 02  ·  BIN, 3 × 2 × 6",
               "ONEWALL  ·  GRIDFINITY CREATOR  ·  BIN")

    # the object
    draw_bin(c, 3, 2, 6, CX + 14, 980, 3.05)
    caption(c, CX, 762, "OBSERVED  ·  210 CONTOURS AT 0.20 mm",
            "126 × 84 × 42 mm · leg pitch 42 mm · stacking lip 4.4 mm")

    # specimen row — the field of legal footprints
    sy = 470
    rule(c, sy + 226, a=.28, lw=0.5)
    txt(c, M, sy + 234, "LEGAL FOOTPRINTS  ·  0.5 UNIT STEPS", "PublicSans-600", 6.8, alpha(INK, .8), 2.6)
    txt(c, W - M, sy + 234, "1 UNIT = 42 mm", "PublicSans-400", 6.8, alpha(INK2, .9), 2.0, "r")
    specimens = [(0.5, 1), (1, 1), (1, 2), (1.5, 1.5), (2, 2), (2, 3), (3, 2), (4, 2)]
    sc = 1.15
    span = sum(ux * U * sc for ux, _ in specimens)
    gap  = (W - 2 * M - span) / (len(specimens) - 1)
    x = M
    for ux, uy in specimens:
        w, d = ux * U * sc, uy * U * sc
        plan(c, ux, uy, x + w / 2, sy + d / 2, sc)          # common baseline
        txt(c, x + w / 2, sy - 18, f"{ux:g} × {uy:g}", "PublicSans-400", 7.4, alpha(INK, .85), .8, "c")
        txt(c, x + w / 2, sy - 29, f"{ux * U:g} × {uy * U:g} mm", "PublicSans-300", 6.2, alpha(INK2, .85), .3, "c")
        x += w + gap

    rule(c, 340, a=.5, lw=0.8)
    txt(c, M, 316, "HEIGHT IS COUNTED IN 7 mm UNITS  ·  1 – 12", "PublicSans-400", 7.6, alpha(INK, .85), 2.2)
    txt(c, W - M, 316, "LEG SIZE  0.5 / 1 / 2  ×  42 mm", "PublicSans-400", 7.6, alpha(INK2, .95), 2.2, "r")

# ════════════════════════════════════════════════════════════
#  PLATE III — the field meets the machine.
# ════════════════════════════════════════════════════════════
BED = 250.0        # Elegoo Centauri Carbon, mm

def compose_three(c):
    page_frame(c, "III", "BASEPLATE / PACKING", ("CUT ON THE", "CELL LINE."),
               ["A drawer is not a multiple of a build plate.",
                "The grid is split where a bin would never sit —",
                "on the boundary, never through a socket."],
               "FIG. 03  ·  BASEPLATE 7 × 5, TILED",
               "ONEWALL  ·  GRIDFINITY CREATOR  ·  BASEPLATE")

    # ── the plan
    nx, ny, s = 7, 5, 2.05
    pw, pd = nx * U * s, ny * U * s
    ox, oy = CX, 1108
    x0, y0 = ox - pw / 2, oy - pd / 2

    c.setStrokeColor(alpha(INK, .55)); c.setLineWidth(0.7)
    c.roundRect(x0, y0, pw, pd, 4 * s, stroke=1, fill=0)
    for i in range(nx):
        for j in range(ny):
            plan(c, 1, 1, x0 + (i + .5) * U * s, y0 + (j + .5) * U * s, s,
                 rings=3, divisions=False)

    # the cut — on cell boundaries only
    cut_x = x0 + 4 * U * s
    cut_y = y0 + 3 * U * s
    c.setStrokeColor(alpha(BRASS, .95)); c.setLineWidth(1.5)
    c.setDash(7, 5)
    c.line(cut_x, y0 - 16, cut_x, y0 + pd + 16)
    c.line(x0 - 16, cut_y, x0 + pw + 16, cut_y)
    c.setDash()
    for lab, lx, ly in [("A", x0 + 2 * U * s, y0 + 4.5 * U * s),
                        ("B", x0 + 5.5 * U * s, y0 + 4.5 * U * s),
                        ("C", x0 + 2 * U * s, y0 + 1.5 * U * s),
                        ("D", x0 + 5.5 * U * s, y0 + 1.5 * U * s)]:
        txt(c, lx, ly - 4, lab, "Archivo-300", 26, alpha(INK2, .30), 0, "c")

    txt(c, x0, y0 + pd + 24, "ASSEMBLED  ·  294 × 210 mm", "PublicSans-600", 6.8, alpha(INK, .8), 2.6)
    txt(c, x0 + pw, y0 + pd + 24, "4 TILES  ·  CUT 4 / 3", "PublicSans-400", 6.8, alpha(INK2, .9), 2.0, "r")
    caption(c, ox, y0 - 42, "OBSERVED  ·  35 SOCKETS ON ONE PITCH",
            "cuts land on cell boundaries — a split socket holds nothing")

    # ── the machine: what the grid costs in prints
    bs   = 1.72
    bw   = BED * bs
    m    = 6 * bs                                  # edge margin
    gap  = 4 * bs                                  # part spacing
    by   = 296
    beds = [("BUILD PLATE 1", CX - bw - 34, [("C", 4, 3, 0), ("A", 4, 2, 1)]),
            ("BUILD PLATE 2", CX + 34,      [("D", 3, 3, 0), ("B", 3, 2, 1)])]
    for name, bx, tiles in beds:
        c.setStrokeColor(alpha(INK, .45)); c.setLineWidth(0.9)
        c.rect(bx, by, bw, bw, stroke=1, fill=0)
        c.setStrokeColor(alpha(INK2, .16)); c.setLineWidth(0.3)
        for k in range(1, 10):                     # bed graticule, 25 mm
            c.line(bx + k * 25 * bs, by, bx + k * 25 * bs, by + bw)
            c.line(bx, by + k * 25 * bs, bx + bw, by + k * 25 * bs)
        c.setStrokeColor(alpha(INK2, .45)); c.setLineWidth(0.4)
        c.setDash(3, 3)
        c.rect(bx + m, by + m, bw - 2 * m, bw - 2 * m, stroke=1, fill=0)
        c.setDash()

        stack = 0.0
        for lab, tx_u, ty_u, row in tiles:
            tw, td = tx_u * U * bs, ty_u * U * bs
            px, py = bx + m + 2, by + m + 2 + stack
            stack += td + gap
            c.setStrokeColor(alpha(EMBER, .85)); c.setLineWidth(0.9)
            c.roundRect(px, py, tw, td, 4 * bs, stroke=1, fill=0)
            for i in range(tx_u):
                for j in range(ty_u):
                    plan(c, 1, 1, px + (i + .5) * U * bs, py + (j + .5) * U * bs, bs,
                         rings=2, divisions=False)
            txt(c, px + 8, py + td - 15, lab, "PublicSans-600", 9.0, alpha(EMBERINK, .95), 1.4)
        sizes = " + ".join(f"{a}  {x*42:g}×{y*42:g}" for a, x, y, _ in tiles)
        txt(c, bx, by + bw + 22, name, "PublicSans-600", 6.8, alpha(INK, .8), 2.6)
        txt(c, bx + bw, by + bw + 22, sizes, "PublicSans-400", 6.8, alpha(INK2, .9), 1.4, "r")

    caption(c, CX, by - 40, "PROVED  ·  THE DRAWER FITS THE MACHINE",
            "250 × 250 bed · 6 mm edge margin · 4 mm part spacing · 3MF, one object per tile")

c = rl.Canvas(OUT, pagesize=(W, H))
c.setTitle("Continuous Deposition — Plates I–III")
c.setAuthor("Amit Kuzi")
for page in (compose, compose_two, compose_three):
    page(c)
    c.showPage()
c.save()
print("wrote", OUT)
