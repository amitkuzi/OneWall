# MakerWorld listing — OneWall

Copy each block into the matching field on the MakerWorld upload page.

---

## Title

```
OneWall — Parametric Vase-Mode Bin & Container Customizer
```

## Tagline / Short description (160 chars max)

```
A fully parametric vase-mode bin and container. Tune dimensions, wall texture, lip shape and base — print in one continuous spiral, signed @Amitkuzi.
```

## Long description (paste as Markdown)

```markdown
**OneWall** is a parametric customizer for vase-mode 3D-printed bins
and containers. Open the Customizer, move the sliders, and the
geometry rebuilds live — every print comes out as a single
continuous spiral wall with the **@Amitkuzi** signature engraved
into the bottom.

## What you can tune

- **Outer dimensions** — width, depth, height, corner radius
- **Three-section height** — base transition, mid-wall, top lip
- **Vertical profile** — linear, barrel, hourglass, ogee, bell,
  double-bulge, or a custom sin curve
- **Wall texture** — smooth, ribs, rings, grid, woven fabric,
  basket, diamond, helical flutes, knurl, or large wave
- **Top lip styles** — rolled, flange, bead or ribbed (each gives
  the rim a different stiffness)
- **Decorative wave overlay** with helical twist
- **Optional label recess** on the front wall

## Why vase mode?

The whole bin prints as **one nozzle-wide perimeter** spiralling up
from a few solid bottom layers. Fast, gorgeous surface finish, and
the woven / fabric textures act as **stiffeners** — the wall is
thin (single line width) but the surface geometry makes it strong.

## Critical slicer setting

> **Bottom shell layers = 3** (Bambu Studio: Strength → Bottom
> shell layers).
>
> The `@Amitkuzi` signature is engraved 0.2 mm deep into the bin's
> first layer. With **2 or more bottom shell layers** the engraving
> is hidden inside the solid floor and visible **only when you flip
> the print over** — exactly the maker's mark you want.
> With only 1 bottom shell layer the engraving punches through.

## Recommended settings

| Setting | Value |
|---------|-------|
| Spiral vase | ON |
| Wall loops | 1 |
| Bottom shell layers | **3** |
| Layer height | 0.2 mm |
| Nozzle / line width | 0.4 mm |
| Material | PLA or PETG |
| Brim | helpful for tall, slim shapes |

## Live web preview

Try every parameter combination instantly in your browser, with
real-time lighting and Save / Load session JSON:

👉 **<https://amitkuzi.github.io/OneWall/>**

(GitHub Pages, no install, mobile-friendly.)

## Source & license

- Repo: <https://github.com/amitkuzi/OneWall>
- License: **CC BY 4.0**
- Built with OpenSCAD, Three.js, lil-gui and three-bvh-csg.

— @Amitkuzi
```

## Tags (MakerWorld allows ~10)

```
vase mode
bin
container
parametric
customizer
spiral vase
storage
organizer
openscad
bambu
```

## Category

```
Household → Storage → Boxes
```
(or `Organizers / Office`)

## License

```
Creative Commons — Attribution (CC BY 4.0)
```

## Print profile (.3mf) — slicer settings to verify before upload

| Setting | Value |
|---------|-------|
| Spiral vase | ON |
| Wall loops | 1 |
| Bottom shell layers | **3** |
| Top shell layers | 0 |
| Layer height | 0.2 mm |
| Line width | 0.4 mm |
| Filament | PLA Basic |
| Print speed | 50–80 mm/s outer wall |

## Photos to attach (in this order)

1. `photos/hero-kitchen-bin-vase.png` — the kitchen scene with the
   pink woven bin holding clothes + the pink twisted vase
2. *(add 2–3 more from your in-use shots if you have them)*
3. *(optional)* a clean screenshot of the live preview UI

## Notes for the upload form

- **Designer credit** field: `amitkuzi`
- **Origin**: original design
- **Make it a Parametric model**: yes — upload `onewall.scad` in the
  parametric source field
- **Cross-promote**: under "Other links" add the GitHub Pages URL
