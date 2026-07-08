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