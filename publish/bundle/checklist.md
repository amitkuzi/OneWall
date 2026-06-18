# Pre-upload checklist

Print and tick before pressing Publish on either platform.

## Files

- [ ] `../../onewall.scad` — the latest version (run `tools/stamp.ps1`
      first and commit so the embedded version stamp matches what
      you're publishing)
- [ ] `bundle/onewall-default.3mf` — sliced with the settings in
      `slicer-profile-notes.md`
- [ ] An `.stl` exported from OpenSCAD or the live preview
- [ ] `photos/hero-kitchen-bin-vase.png` — minimum 1200×800
- [ ] (optional) 1–3 more in-use photos
- [ ] (optional) a clean screenshot of the live preview UI

## Slicer settings verified

- [ ] Spiral vase **ON**
- [ ] Wall loops = **1**
- [ ] **Bottom shell layers = 3** (the signature breaks at 1)
- [ ] Top shell layers = 0
- [ ] Layer height = 0.2 mm
- [ ] Layer scrub confirms: layer 1 has text voids, layer 2 is
      solid (engraving hidden), layer 4+ is wall only (vase mode)

## Listings

- [ ] `listings/makerworld.md` — title, description, tags
      ready to paste
- [ ] `listings/printables.md` — title, description, tags
      ready to paste

## Licensing & credit

- [ ] License: **CC BY 4.0**
- [ ] Designer credit: `amitkuzi`
- [ ] Origin: original design (not a remix)

## Cross-promotion

- [ ] Live preview URL ready to paste:
      `https://amitkuzi.github.io/OneWall/`
- [ ] Repo URL ready to paste:
      `https://github.com/amitkuzi/OneWall`

## After publishing

- [ ] Paste the MakerWorld URL into `publish/published-urls.md`
- [ ] Paste the Printables URL into `publish/published-urls.md`
- [ ] Run `tools/stamp.ps1` again and commit the new stamp
- [ ] Add badges to the repo root README
