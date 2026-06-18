# svase — Publish Plan & Tasklist (for approval)

This document is the master plan to bring the parametric vase-mode
bin/container customizer from a working SCAD + preview to a public,
multi-channel product. Each phase has a numbered tasklist. The user
approves a phase → the implementer executes that phase only.

The two real-print photos (pink woven bin + pink spiral vase on the
kitchen table) are the **hero shots** for every listing — they
already prove the printer/material work and look great.

---

## ✦ DECISIONS LOG (2026-06-18)

| Decision | Value |
|----------|-------|
| Product name | **OneWall** |
| Hosting | **GitHub Pages** |
| Repo owner | `amitkuzi` |
| GitHub URL | <https://github.com/amitkuzi> |
| LinkedIn URL | <https://www.linkedin.com/in/amitkuzi/> |
| Signature handle | `@Amitkuzi` (matches bottom engraving) |
| Avatar in About | _text only for now_ |
| Bio for About | _user to send before Phase 2_ |

---

## ✦ Step 0 — Pick a product name (DECISION)

Top candidates (recommendation marked):

| # | Name             | Pros | Cons |
|---|------------------|------|------|
| 1 | **Svase Studio** ★ | Continuation of existing project id; short; vase/case overtones; unique on MakerWorld | Made-up word |
| 2 | SpiralBin Studio | Very descriptive; matches search terms ("spiral", "bin") | Generic |
| 3 | WeaveVase        | Calls out the signature fabric texture | Less obvious it makes bins too |
| 4 | OneWall          | Clever — vase mode = one wall | Risky search-wise |
| 5 | VaseForge        | Pro/maker feel | Crowded namespace (many "Forge" tools) |

★ **Recommended: "Svase Studio"** — keeps existing repo/branch
naming, sticks with one identity across SCAD, GitHub, MakerWorld and
Printables.

> Decision needed: pick a name OR propose your own. Everything else
> depends on it.

---

## ✦ Hosting recommendation

For the `preview.html` live customizer page:

| Option        | Cost | Setup | Custom domain | CDN | Verdict |
|---------------|------|-------|---------------|-----|---------|
| **GitHub Pages** ★ | Free | 1-click on existing repo | Yes | Yes | Best fit — repo already on GitHub |
| Cloudflare Pages | Free | 5 min | Yes | Yes | Great too, slightly more setup |
| Netlify       | Free | 5 min | Yes | Yes | Same |
| Vercel        | Free | 5 min | Yes | Yes | Same |

★ **Recommended: GitHub Pages** — preview.html is fully static (all
CDN deps via importmap), zero build step, deploys straight from the
repo. URL pattern: `https://amitkuzi.github.io/<repo>/preview.html`,
upgradeable to a custom domain (e.g. `svase.studio`) any time.

---

# Phase 1 — Identity & UI scaffolding

Goal: pick the name, wire it into the preview, prepare the page for
the docs and translation work coming in Phase 2.

| # | Task | Output |
|---|------|--------|
| 1.1 | User picks the product name | Decision recorded in `projects/svase.md` |
| 1.2 | Add a header bar to `preview.html` (logo text + version + Help / About buttons) | UI shell |
| 1.3 | Create an in-page modal system (Help and About will reuse it) | Reusable `<dialog>` modal |
| 1.4 | Add a `lang` switcher stub in the header (en / he) — wires through i18n in Phase 2 | Dropdown bound to `setLang()` |

---

# Phase 2 — Help, About, Tooltips, i18n

Goal: make the page self-documenting in two languages.

| # | Task | Output |
|---|------|--------|
| 2.1 | Add **tooltips** to every lil-gui controller (hover description in the user's chosen language) | Param dictionary |
| 2.2 | Build a **Help** modal — table of every parameter group with its parameters, ranges, what they do, and a tiny illustration where useful | Modal content + assets |
| 2.3 | Build an **About** modal — your name, photo (optional), short bio, LinkedIn + GitHub buttons, license, version, credits | Modal content |
| 2.4 | Add an **i18n engine** — JSON dictionaries `i18n/en.json` and `i18n/he.json`, key-based lookups, RTL flip when `he` selected | Working en/he switching |
| 2.5 | Add a **bottom-right credit** badge: `crafted by @Amitkuzi · LinkedIn · GitHub` (sticky link, opens new tab) | Badge |

> Inputs needed from the user before Phase 2 starts:
> - LinkedIn URL
> - GitHub profile URL (presumably `https://github.com/amitkuzi`)
> - One-line bio (e.g. "Mechanical engineer · maker · Bambu lover")
> - Optional avatar PNG/JPG

---

# Phase 3 — SCAD documentation polish

Goal: the SCAD file should read like documentation for someone
landing on it via MakerWorld Customizer.

| # | Task | Output |
|---|------|--------|
| 3.1 | Re-write every `// description` line as a complete tooltip (action + units + range hints) | Cleaner Customizer UI |
| 3.2 | Add a top-of-file ASCII diagram showing the 3 sections and the texture grid | Improved header comment |
| 3.3 | Optional: split into `svase_bin.scad` + `svase_lib.scad` so power users can `use` the texture functions on their own shapes | Reusable library |

---

# Phase 4 — Publishing assets

Goal: produce one bundle of copy + images that gets reused across
every platform.

| # | Task | Output |
|---|------|--------|
| 4.1 | Write **product description (EN)** — short tagline, what it is, what it makes, why vase mode | `inbox/svase_listing_en.md` |
| 4.2 | Write **product description (HE)** — same, Hebrew copy | `inbox/svase_listing_he.md` |
| 4.3 | Prepare **photos** — pick 4–6 from the existing in-use shots (kitchen woven bin + spiral vase), crop, light-correct, export at 1600px and 800px | `inbox/svase_photos/` |
| 4.4 | Create **a single recommended `.3mf` profile** for Bambu Studio (vase mode, 1 wall, 4 bottom layers, PLA) so MakerWorld users get one-click print | `inbox/svase_default.3mf` |
| 4.5 | Write the **publish process document** (steps, screenshots, account requirements, gotchas) | `inbox/svase_publish_process.md` |

---

# Phase 5 — Publishing

Goal: live on three channels.

| # | Task | Output |
|---|------|--------|
| 5.1 | Enable **GitHub Pages** on the repo → live URL for `preview.html` | Public URL |
| 5.2 | Add a `LICENSE` file (recommended: CC BY 4.0 — required by MakerWorld) | License at repo root |
| 5.3 | Publish on **MakerWorld** — type: Parametric. Upload `svase_bin.scad`, the `.3mf`, photos, copy. Cross-link the live preview URL. | MakerWorld URL |
| 5.4 | Publish on **Printables** — same assets, Customizer-enabled. Cross-link. | Printables URL |
| 5.5 | Add a `README.md` at the repo root with badges (MakerWorld / Printables / GitHub Pages) | Repo root README |

---

# Phase 6 — Iteration & community

Goal: keep it alive.

| # | Task | Output |
|---|------|--------|
| 6.1 | Set up GitHub Issues template for "shape request" / "texture request" / "bug" | Templates |
| 6.2 | Wire `analytics` to the preview page (Plausible or Cloudflare — privacy-friendly, no cookies) | Stats dashboard |
| 6.3 | Schedule a monthly check-in: respond to MakerWorld comments, ship one new preset | `/loop` cadence |

---

## Approval flow

1. User picks a name + answers the personal-info questions for the About modal.
2. Approve **Phase 1** → I implement, push, you review the live preview.
3. Approve **Phase 2**, etc.

Each phase is a self-contained PR / commit on `scad-Customizer-ready`
(or a new `publish` branch if you prefer keeping `Customizer-ready`
frozen for the parametric script alone).
