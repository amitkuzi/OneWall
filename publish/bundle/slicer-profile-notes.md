# Default `.3mf` — settings to lock before slicing

Open the latest OneWall STL in **Bambu Studio**, set these, then
`File → Export as 3MF` and save to `bundle/onewall-default.3mf`.
This is the file every MakerWorld user will get with one click.

## Printer profile

- **Printer**: Bambu Lab X1 / P1S / A1 — pick the most common one
  you actually own (X1C is the safest default audience-wise)
- **Plate**: Smooth or Textured PEI (textured pairs nicely with the
  woven wall textures)
- **Filament**: PLA Basic (Bambu PLA Basic is fine)

## Strength tab

| Setting | Value |
|---------|-------|
| **Spiral vase** | ON ✅ |
| **Wall loops** | 1 |
| Top shell layers | 0 |
| **Bottom shell layers** | **3** ← the signature requires this |
| Infill | n/a (vase mode) |

## Quality tab

| Setting | Value |
|---------|-------|
| Layer height | 0.2 mm |
| First layer height | 0.2 mm (match — keeps the engraving exactly one layer) |
| Line width | 0.4 mm |
| Initial layer line width | 0.42 mm (matches Bambu default) |

## Speed tab

| Setting | Value |
|---------|-------|
| Outer wall | 60–80 mm/s |
| First layer | 30 mm/s |
| Travel | 200 mm/s |

## Other

- **No** supports, **no** brim by default (you can offer brim as an
  alt in a remix). Tall slim shapes might want a brim — note this
  in the listing.
- Adhesion: skirt 1 line is plenty.

## Verify before exporting

After slicing, scrub the layer slider:

- **Layer 1**: should show the bin's bottom cross-section with
  text-shaped voids in `@Amitkuzi`
- **Layer 2**: should show the bin's bottom cross-section SOLID
  (no text voids — the engraving is buried)
- **Layer 3**: same as layer 2 (solid)
- **Layer 4+**: outer perimeter only (vase mode kicked in)

If layer 2 still shows the text → you have `Bottom shell layers = 1`.
Bump it to 3 and re-slice.

## Export

`File → Export → Export as 3MF` → save to:

```
publish/bundle/onewall-default.3mf
```

Then `git add publish/bundle/onewall-default.3mf` and commit:

```powershell
$s = & .\tools\stamp.ps1
git add publish/bundle/onewall-default.3mf
git commit -m "publish: add default slicer-ready 3MF (Bambu, vase, bottom shell 3) [$s]"
git push
```
