# Printables upload walk-through

About 15 minutes. Open `listings/printables.md` in another tab.

## 0. Pre-flight

- [ ] `bundle/onewall-default.3mf` ready
- [ ] An `.stl` exported from OpenSCAD (use the live preview's
      "Download STL (engraved)" button or run OpenSCAD)
- [ ] Photos in `photos/`
- [ ] Logged in to <https://www.printables.com> as `amitkuzi`

## 1. Open the new-model page

<https://www.printables.com/model/add>

## 2. Upload files (in this order)

1. **STL**: drag the `.stl` file → this is the primary print file
2. **3MF**: drag `bundle/onewall-default.3mf` → it auto-attaches as
   the recommended slicer profile
3. **OpenSCAD source**: drag `../onewall.scad`
4. **Photos**: drag `photos/hero-kitchen-bin-vase.png` first (cover)

## 3. Mark the `.scad` as Customizer-enabled

In the file list, find `onewall.scad` → click the gear icon → check
**"Customizer source"**. Printables will render the customizer UI
from the file's `// [...]` annotations.

## 4. Fill the form

| Field | Source block |
|-------|--------------|
| Name | "Name" block |
| Summary | "Summary" block |
| Description | "Description" block (paste as markdown) |
| Tags | "Tags" block |
| Category | "Category" block |
| License | "License" block — **CC BY 4.0** |

## 5. Print profile section

| Field | Source |
|-------|--------|
| Printer family | leave blank or pick your test printer |
| Material | PLA |
| Quality | 0.2 mm |
| Supports | No |
| Infill | n/a (vase mode) |

In **Print settings notes**, paste this — it's the critical hint:

```
This model prints in vase / spiral mode. CRITICAL: in PrusaSlicer set
"Solid layers / Bottom" to AT LEAST 2 (3 is ideal). The @Amitkuzi
signature is engraved 0.2 mm into the first layer. With 1 bottom
solid layer the engraving punches through; with 2+ it's hidden inside
the floor and visible only when you flip the print over.
```

## 6. Cross-promotion links

Add to the **External links** section:

```
Live preview:  https://amitkuzi.github.io/OneWall/
Source:        https://github.com/amitkuzi/OneWall
MakerWorld:    (paste your MakerWorld URL after publishing there)
```

## 7. Submit

Click **Publish**. Printables doesn't gate on review for most users —
it goes live immediately or after a quick scan.

## 8. After it goes live

- Copy the URL (`printables.com/model/...`)
- Paste into `publish/published-urls.md`
- I'll add the Printables badge to the main repo README

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Customizer doesn't show on `.scad` | Re-check the "Customizer source" gear → checkbox |
| `.3mf` size warning | Printables limit is 100 MB; vase-mode bins are ~5–10 MB so this shouldn't fire |
| Image too low res | Printables wants ≥ 1200×800 |
