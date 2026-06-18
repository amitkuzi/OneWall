# OneWall — Publish Bundle

Everything you need to manually upload OneWall to MakerWorld and
Printables. Open each file, copy/paste the relevant content into the
upload form, drag the photos and files in.

## What's in here

| Folder / file | What it is |
|---------------|------------|
| `photos/` | Hero shots — drag these into the upload forms |
| `listings/makerworld.md` | MakerWorld listing copy (title, description, tags, license, print settings) |
| `listings/printables.md` | Printables listing copy (same content, slightly re-shaped) |
| `upload/makerworld-steps.md` | Step-by-step walk-through for uploading to MakerWorld |
| `upload/printables-steps.md` | Step-by-step walk-through for uploading to Printables |
| `bundle/checklist.md` | Pre-flight checklist: files to attach, settings to verify before clicking Upload |
| `bundle/slicer-profile-notes.md` | What to set in Bambu Studio before slicing the default `.3mf` |

## You need to slice ONE default `.3mf` before uploading

1. Open `../onewall.scad` in OpenSCAD → press **F6** → **File → Export → STL**
   (or use the live preview's `Download STL (engraved)` button)
2. Open the STL in Bambu Studio
3. Apply the slicer settings from `bundle/slicer-profile-notes.md`:
   - Spiral vase ON
   - Wall loops = 1
   - **Bottom shell layers = 3** ← critical
   - Layer height 0.2 mm, 0.4 mm nozzle, PLA
4. Slice → **File → Export as 3MF** → save to `bundle/onewall-default.3mf`
5. Then proceed to upload (`upload/*-steps.md`)

## Order of publishing

Recommended: **MakerWorld first → Printables second.**

MakerWorld's parametric customizer is the primary value prop (users
can tweak sliders right on the page). Printables is the secondary
audience but doubles your reach.

## After publishing

- Add MakerWorld + Printables URLs to the repo's main README badges
- Bump the stamp via `tools/stamp.ps1` and commit
- Wait for first user comments — respond fast in the first 48h, it
  bumps you in the algorithm
