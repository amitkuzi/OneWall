# MakerWorld upload walk-through

About 15 minutes total. Open `listings/makerworld.md` in another
tab so you can copy / paste fields.

## 0. Pre-flight

- [ ] `bundle/onewall-default.3mf` exists (see `publish/README.md`
      for how to slice it)
- [ ] `../onewall.scad` is the latest version (run `tools/stamp.ps1`
      first and commit so the embedded version stamp is fresh)
- [ ] `photos/hero-kitchen-bin-vase.png` is in place
- [ ] You are logged in to <https://makerworld.com> as `amitkuzi`

## 1. Open the upload page

<https://makerworld.com/en/upload/new>

Click **+ Publish**.

## 2. Type — pick `Parametric Model`

This unlocks the Customizer page on MakerWorld where users can move
sliders. It's the whole point — don't pick "Regular Model".

## 3. Upload files (in this order)

1. **Parametric source**: drag `../onewall.scad`
2. **Default 3MF**: drag `bundle/onewall-default.3mf`
3. **Photos**: drag `photos/hero-kitchen-bin-vase.png` first (it
   becomes the cover), then any extras

## 4. Fill the fields

Copy each field from `listings/makerworld.md`:

| Field | Source block |
|-------|--------------|
| Title | "Title" block |
| Short description / subtitle | "Tagline" block |
| Description (markdown) | "Long description" block |
| Tags | "Tags" block (one tag per chip) |
| Category | "Category" block |
| License | "License" block — pick **CC BY 4.0** |

## 5. Print settings panel

MakerWorld auto-reads most of these from the `.3mf`. Just verify
the values match `listings/makerworld.md → Print profile`. Pay
attention to:

- ✅ Spiral vase = ON
- ✅ Wall loops = 1
- ✅ **Bottom shell layers = 3** (don't ship a profile with 1)
- ✅ Top shell layers = 0

## 6. Credits / origin

- Designer credit: `amitkuzi`
- Origin: **Original design**
- Remix of: leave empty
- License: CC BY 4.0

## 7. Cross-promotion links

In the "Other links" or external URLs section, add:

```
https://amitkuzi.github.io/OneWall/   ← live preview
https://github.com/amitkuzi/OneWall   ← source
```

## 8. Submit for review

Click **Publish**. MakerWorld will review (a few hours to a day).
You'll see a "Pending review" badge — that's normal.

## 9. After it goes live

- Copy the model URL (looks like `makerworld.com/en/models/XXXXXX`)
- Send it to me OR paste it into `publish/published-urls.md` so I
  can add the badge to the main repo README
- Reply to the first 3–5 comments quickly — early engagement helps
  the recommendation algorithm

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `.scad` rejected as "non-parametric" | Make sure the file has `// [min:step:max]` annotations on numeric vars and `// [opt1, opt2]` on string vars. It already does — the file is `onewall.scad`. |
| Customizer renders too slowly | MakerWorld has a render timeout (~5 min). Lower default `point_spacing` (in the SCAD) before upload if needed — already set to a sane 2.0. |
| 3MF rejected | Re-slice with Bambu Studio's vanilla profile, not a remixed one. |
| Photos too small | Minimum 1200×1200. The kitchen shot is well above that. |
