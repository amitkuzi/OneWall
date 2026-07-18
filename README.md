# OneWall — Parametric Vase-Mode Bin & Container

> Standalone repo: <https://github.com/amitkuzi/OneWall>
> Live preview: served from the repo's GitHub Pages

A single-file OpenSCAD script that generates printable bins and
containers for **vase / spiral mode** 3D printing. Fully
parameterized, Customizer-ready for **MakerWorld**, **Printables**
and **Thangs**.

---

## What it makes

A solid tapered shell with three controllable height sections and
a textured wall pattern:

```
HIGH  ───────────  wall → upper lip transition
      │ ~~~~~~~~ │
MID   │ ~~~~~~~~ │  wall: vertical profile + texture
      │ ~~~~~~~~ │
LOW   ＼________／  bottom → wall transition
      ‾‾‾‾‾‾‾‾‾‾
```

The slicer spiralizes the outer perimeter into one nozzle-wide
continuous wall — the model is delivered as a solid body.

---

## Files

| File | Purpose |
|------|---------|
| `onewall.scad` | Main parametric script (Customizer-ready) |
| `index.html`   | Instant browser preview — same math in Three.js, with lighting controls + STL / STEP export |
| `assets/step-exporter.js` | Faceted STEP (AP214) writer used by the preview's STEP button |
| `README.md`      | This file |

## Live Web Preview

🌐 **Hosted on GitHub Pages:**
<https://amitkuzi.github.io/OneWall/>

Or open `index.html` directly in any modern desktop browser (Chrome,
Edge, Firefox, Safari 16.4+). Everything is self-contained — Three.js,
OrbitControls, lil-gui and three-bvh-csg load from CDN.

What you get:
- The exact same geometry math as the `.scad` file, recomputed on
  every parameter change (~10–50 ms — feels instant)
- Right-side panel with all SCAD parameter groups
- Material panel: color, roughness, metalness, clearcoat, background
- Three controllable directional lights (key / fill / rim) plus
  ambient, each with color, intensity, azimuth, altitude
- Renderer exposure slider
- **Save session (JSON)** — downloads a single JSON file with every
  parameter, material, light and camera position
- **Load session (JSON)** — picks any saved JSON and instantly
  restores the whole preview state (sliders refresh and the mesh
  rebuilds)
- **Download STL** button (binary STL of the current preview)
- **Download STEP** button — the same geometry as an ISO-10303-21
  AP214 solid, for importing into Fusion / SolidWorks / FreeCAD

> The STEP export is **faceted**: the preview is a triangle mesh, so
> every triangle ships as its own planar face. It imports as a solid
> body, not as an editable feature tree, and the file is large
> (~10 MB for a 2×2×3 gridfinity bin, ~30 MB for 4×4×6). Use it for
> assembly reference and fitting checks — not as a CAD starting
> point. For printing, prefer the STL.

> The `.scad` file remains the source of truth for printing. The
> preview is a fast iteration tool — when you like a shape, replicate
> the parameters in OpenSCAD or in the MakerWorld Customizer.

If your browser blocks the `file://` ES-module imports (rare), just
serve the folder: `python -m http.server` from the repo root,
then open <http://localhost:8000/>.



---

## Quick Start

1. Open `onewall.scad` in **OpenSCAD 2021.01** or newer.
2. Open the Customizer panel (`Window → Customizer`).
3. Tweak parameters in the grouped panels.
4. Press **F6** to render, then **File → Export → STL** (or 3MF).
5. Slice with **Vase / Spiral mode** enabled.

---

## Print Settings (Vase Mode)

> ### ⚠ Critical setting for the `@Amitkuzi` signature
>
> **Bottom shell layers must be ≥ 2** (3 is ideal).
>
> The signature is engraved into the **first layer** of the print
> (0.2 mm deep). If your slicer is set to only 1 bottom shell layer,
> the engraving punches all the way through the floor and is
> visible from inside the bin. With 2+ bottom layers, the upper
> layers cover the engraving so it's visible **only from below** —
> exactly what we want.
>
> | Slicer | Where to set it |
> |--------|-----------------|
> | Bambu Studio | Strength → **Bottom shell layers = 3** |
> | PrusaSlicer  | Print Settings → Layers and perimeters → **Solid layers / Bottom = 3** |
> | Cura         | Shell → **Bottom Layers = 3** |

| Slicer        | Vase-mode toggle |
|---------------|------------------|
| Bambu Studio  | Strength → Wall loops = **1**, enable **Spiral vase** |
| PrusaSlicer   | Print Settings → Layers → **Spiral vase = ON** |
| Cura          | Special Modes → **Spiralize Outer Contour = ON** |

Other recommended settings:
- **Bottom shell layers: 3** (= 0.6 mm with 0.2 mm layer height — see warning above)
- Layer height: **0.2 mm**
- Line / nozzle width: **0.4 mm** (matches a single wall)
- Material: PLA or PETG works well; brim helps tall slim shapes.

---

## Parameter Groups

| Group | Key controls |
|-------|--------------|
| **Outer Dimensions**     | `outer_w`, `outer_d`, `height`, `corner_r` |
| **Section Heights**      | `low_h`, `high_h` (MID = remainder) |
| **Low — Base Transition**| `base_scale`, `low_curve` |
| **Mid — Vertical Profile**| `mid_top_scale`, `mid_profile` (linear / barrel / hourglass / ogee / bell / doubleBulge / custom), `mid_profile_amt` |
| **Mid — Wall Texture**   | `wall_texture` (smooth / ribs / rings / grid / fabric / basket / diamond / diagonal / knurl / wave / kumikoKaku / kumikoDiamond / kumikoTriangle / kumikoAsanoha), `tex_amp`, `tex_x`, `tex_z` |
| **Mid — Decorative Wave**| `wave_amp`, `wave_lobes`, `wave_twist` |
| **High — Lip / Top Rim**| `lip_style` (smooth / rolled / flange / bead / ribbed), `lip_peak_scale`, `lip_top_scale`, `lip_ribs`, `lip_rib_amp` |
| **Optional — Label**     | `label_slot`, `label_w`, `label_h`, `label_z`, `label_d` |
| **Resolution**           | `point_spacing`, `mesh_layer` |

---

## Bottom Signature (`@Amitkuzi`)

A small text is engraved into the floor of every bin. Parameters
(both in OpenSCAD Customizer and in the live preview):

| Param         | Meaning |
|---------------|---------|
| `sig_enabled` | Toggle the engraving on/off |
| `sig_text`    | The text — defaults to `@Amitkuzi` |
| `sig_size`    | Letter height in mm (4–8 mm is a good range) |
| `sig_depth`   | Engrave depth in mm — must be **less than** `bottom_layers × layer_height` (e.g. 0.6 mm with 4 layers × 0.2 mm = 0.8 mm of solid floor) |

In **OpenSCAD / MakerWorld Customizer** the signature is a true
`difference()` against the bin body → single solid, **fully
vase-mode compatible**, and visible as a recessed text on the
underside of the print.

In the **web preview** the same text appears as a small extruded
solid sitting under the bin's bottom face (so you can rotate the
camera and see what it will look like). The preview's STL export
includes the stamp as a separate solid touching the bottom.

> Vase-mode printing requires a single solid — when you intend to
> print in spiral / vase mode, use the STL coming out of OpenSCAD
> or the MakerWorld Customizer page, not the preview STL.

---

## Making a Sturdy Top Lip (FDM Vase Mode)

In true spiral / vase mode the wall is **one nozzle width** — you
cannot literally print a thick rim. Instead, the script gives the
top a **stiff cross-section** that resists bending and ovalization
just as well. Pick `lip_style`:

| Style    | Cross-section (r/z)         | When to use |
|----------|-----------------------------|-------------|
| smooth   | gentle flare outward        | minimal rim, lightest |
| **rolled** | swells out then curls back | most stiffness for least material — works like a curved beam |
| **flange** | sharp wide horizontal ledge | maximum stiffness; nests/stacks well |
| bead     | small bulge near top        | decorative, modest stiffness |
| ribbed   | adds Z-corrugation rings    | extra stiffness on top of any base flare |

Tuning:
- `lip_peak_scale` — how far outward it swells (1.1–1.3 is typical)
- `lip_top_scale`  — where the curl ends (set < `lip_peak_scale` for a real curl)
- Increase `high_h` to give the rolled / flange shape more room
  (10–25 mm works well; 18 mm is a good start)
- For `ribbed`: 3–6 ribs at 0.6–1.2 mm amp is plenty

If you really need a multi-perimeter solid rim, you must **disable
vase mode for the top N mm** using a slicer Height-Range Modifier
(Bambu Studio: Per-Object → Height range; PrusaSlicer: Modifiers →
Height range). That trades the speed/finish of vase mode for true
solid material — the geometry in this script does not need to change.

---

## Stiffness Notes

The wall is a single nozzle-wide spiral, so geometry — not material
— provides stiffness. Best results with crossed textures:

- **grid**, **fabric**, **diamond**, **knurl** — crossed ribs, highest stiffness
- **kumikoKaku**, **kumikoDiamond**, **kumikoTriangle**, **kumikoAsanoha** — Japanese 組子 lattice motifs; crossed strips add stiffness while looking decorative
- **ribs**, **rings** — single-direction stiffening
- **wave**, **smooth** — decorative, lowest stiffness
- Higher `tex_amp` and tighter spacing (`tex_x`, `tex_z`) → stiffer wall
- Combine with `mid_profile = "barrel"` to add hoop strength

---

## Uploading to MakerWorld

1. Print one sample with default parameters; photograph it (real
   prints are **mandatory** for MakerWorld approval).
2. Slice and export a `.3mf` from your sample with vase mode pre-set.
3. Go to <https://makerworld.com/en/upload>:
   - Click **Upload Model**.
   - Choose model type **Parametric** (so the SCAD becomes a
     Customizer page).
   - Upload `onewall.scad` as the parametric source.
   - Upload the `.3mf` you sliced as the default print profile.
   - Add the real photo(s).
4. Fill in description, materials used, recommended print
   settings, and license.
5. Submit for review.

> Render budget on MakerWorld is limited (~5 min). Defaults in this
> script (`point_spacing = 2.0`, `mesh_layer = 1.2`) are tuned for
> that. Users can crank to higher resolution for their own STL.

---

## Uploading to Printables

1. Slice a `.3mf` of one sample and print it.
2. Go to <https://printables.com/model/add>.
3. Upload `.3mf`, `.stl`, photos, and `onewall.scad`.
4. In the editor, mark `onewall.scad` as the **Customizer file**
   — Printables will expose the same UI.

---

## Local Customizer Tips (OpenSCAD)

- Each `/* [Group Name] */` becomes a collapsible panel.
- `// [min:step:max]` makes a slider.
- `// [option1, option2, ...]` makes a dropdown.
- The line `module __end_customizer__() {}` hides everything
  underneath from the UI — keep it as the boundary.

---

## License

Add your preferred license here before publishing
(MakerWorld defaults to **CC BY 4.0**; Printables lets you pick).

---

## Project metadata

- Project: **OneWall**
- Standalone repo: <https://github.com/amitkuzi/OneWall>
- Origin: spun off from the `LLMShared / svase` workspace project,
  2026-06-18.
- Publish plan & roadmap: [PUBLISH_PLAN.md](PUBLISH_PLAN.md)
