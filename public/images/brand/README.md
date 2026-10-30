# Loci brand assets

Everything the product, the web, and the iOS and Android apps draw the brand
from. If you are here to add an app icon or a splash screen to a native target,
read [Which file do I use?](#which-file-do-i-use) and stop there.

This is the **"Explore your way"** set (2026-10), approved by the owner on
2026-10-30. The previous set (cream tile, traced "oci", 3D wordmark renders) was
removed then; it is in git history before this change.

## Brand values

Measured from the approved art, not picked. Dark is the flagship appearance.

| Token | Dark | Light | Where it goes |
|---|---|---|---|
| Obsidian / cream ground | `#11161D` | `#FBF6EF` | App ground, icon tile, splash |
| Graphite / card | `#1B222D` | `#FFFFFF` | Surfaces |
| Foreground | `#F7F2EA` | `#151B23` | Text, the wordmark's letters |
| Signal coral (primary) | `#F47B5E` | `#B8452E` | Actions, selection, the i-dot |
| Lantern (warm) | `#FBB97D` | `#9B5B17` | Discovery, in-season, achievements |
| Holo (cool) | `#7A9CC2` | `#3F6A93` | Info, spatial data, routes |
| Brand gradient | `#F9A47C → #F68667 → #E8735D → #D2645A → #C25A52` | same | The mark only — never text |

**Bright coral is never text on a light ground** (`#F47B5E` on cream is ~2.5:1).
In light mode actions and coral text take the deep coral `#B8452E` (~5.0:1 on
cream, white label on it 5.3:1). In dark mode coral `#F47B5E` is 6.8:1 on
obsidian and takes an obsidian label. The full pairing table is in
`src/styles/themes.css`.

Type: **Outfit** for display (the wordmark's rounded geometry), **DM Sans** for
UI, **Space Mono** for coordinates and kickers.

## Which file do I use?

| Surface | File |
|---|---|
| iOS app icon (App Store, 1024) | `icon-1024.png` (light/any), plus `icon-dark.svg` and `icon-tinted.svg` for the dark and tinted variants |
| iOS home screen / `apple-touch-icon` | `icon-180.png` |
| Android adaptive icon foreground+background | `mark.svg` on `#11161D` (see note) |
| Android / PWA launcher | `icon-512.png`, `icon-192.png` |
| Web favicon | `../../favicon.svg`, `../../favicon.ico` |
| Browser tab PNG fallback | `icon-32.png`, `icon-16.png` |
| In-app header, buttons, avatars | `src/components/brand/Logo.tsx` (`LociMark`, `LociLogo`), `Lockup.tsx` (`LociLockup`) |
| Horizontal logo, dark ground | `logo-on-dark.svg` (cream letters) |
| Horizontal logo, light ground | `logo-on-light.svg` (ink letters) |
| One-colour print, embossing, stamps | `logo-mono.svg`, `mark-mono.svg` (`currentColor`) |
| Vertical lockup with "EXPLORE YOUR WAY" | `lockup-on-dark.svg`, `lockup-on-light.svg` |
| Mark alone | `mark.svg` |
| Social card (Open Graph / Twitter) | `og-image.png` (1200×630) — built by `tools/brand/make-og-card.py` |
| Empty states, onboarding | `src/components/brand/Mascot.tsx` (web), `mascot.png` (native) |
| Landing hero scene | `../hero/explore-scene-{640,936}.{avif,webp}` — a crop of the approved art |

### Format rules

- **iOS app icons must be opaque, square PNG.** No alpha, no webp. Every
  `icon-*.png` here is RGB with no alpha channel; App Store validation rejects
  an icon that has one, and it does so at upload, not at build.
- **webp is for the web only.** `icon-*.webp` exist so browsers pull fewer
  bytes. Do not put one in an Xcode asset catalogue.
- **Marks stay SVG.** The SVGs are the masters for every raster here. Do not
  rasterise a mark and check the raster in as a new master.
- **The mascot is the one genuinely raster asset** — it is a 3D clay render, not
  geometry, so there is no vector version and there will not be one.
- **The favicon drops the road.** Below 32px the winding road through the pin is
  a smudge, so `favicon.svg` and the 16/32 icons are the pin and its head hole
  only.

### Android adaptive icons

Android composites a foreground over a background and masks the result, so a
full-bleed `icon-512.png` gets its edges cropped. Use two layers instead:

- background: a solid `#11161D` colour, not an image
- foreground: `mark.svg` as a VectorDrawable, scaled so the mark is **~64% of
  the canvas height** — the same proportion `icon.svg` uses, and inside
  Android's 66% safe zone

## Provenance

One piece of approved art came in: `Loci Mascot Exploring a Futuristic City.png`,
**1536×1024, a single composite scene** — logo, wordmark, tagline and mascot all
in one raster, none of it separable as files. It is kept untracked at
`tools/brand/source/loci-scene-2026-10.png`.

### The logo is a trace, and says so

Every shape in the logo set is traced from that raster. They are close, measured
approximations of the approved art — **not** the designer's master files, and not
identical to them. If a vector master turns up, it replaces these.

| Shape | Method | IoU vs the art |
|---|---|---|
| Pin silhouette | potrace on a binary colour mask, 4× upsample; head hole fitted as a true `<circle>` | **0.998** |
| Dunes / road | colour mask (rows ≥ 700, dilated into the silhouette), potrace, clipped to the pin | **0.995** |
| "Loci" letters | rebuilt from geometric primitives with parameters found by IoU search | **0.983** |
| i-dot | fitted circle | — |
| "EXPLORE YOUR WAY" | set in Outfit wght 300 and outlined (fonttools), tracked to match | not measured |

The letters are geometric on purpose: the raw potrace of the wordmark measured
0.994 but wobbled along every straight edge; the geometric rebuild gives up 1%
of overlap for strokes that are actually straight and bowls that are actually
round. The pin's gradient stops are sampled from the art (top `#F9A47C` to
bottom `#C25A52`).

Scripts, traced path data and a step table are in `tools/brand/trace-2026-10/`;
`build.py` there reproduces all 11 SVGs byte for byte.

### The icons are rendered, not cropped

`icon-*.png` and `icon-*.webp` all come from `icon.svg` (obsidian tile, gradient
mark at 64% height) via `rsvg-convert`, so they cannot drift apart. `icon-16`
and `icon-32` come from the simplified favicon geometry.

### The mascot

The new art shows the **same character, evolved**: the coral teardrop body, dot
eyes, belly hole and held map are unchanged; it now wears a tech backpack with
glowing rings and sneakers, and the map is holographic. The landing hero uses the
approved scene itself rather than a cut-out, because it is the approved art.

Standalone poses for the new character have **not been made yet** (they are to
be generated from the art as reference and approved one by one). Until then,
every state falls back to the existing standing figure, `mascot.webp`, which is
the same character in its earlier outfit:

| State | Used for | Asset today |
|---|---|---|
| `idle` | default | `mascot.webp` |
| `welcome` | sign-in, onboarding | `mascot.webp` (fallback) |
| `searching` | route loading | `mascot.webp` (fallback) — `PageLoading` keeps its spinner until this pose exists |
| `thinking` | chat working | `mascot.webp` (fallback) |
| `discovering` | new place found | `mascot.webp` (fallback) |
| `navigating` | walking a day | `mascot.webp` (fallback) |
| `success` | saved, completed | `mascot.webp` (fallback) |
| `empty` | empty lists, saved, trips | `mascot.webp` (fallback) |
| `error` | 404, error boundary | `mascot.webp` (fallback) |
| `offline` | offline route | `mascot.webp` (fallback) |

Adding a pose is one line in `POSES` in `src/components/brand/Mascot.tsx`. New
poses go in `mascot/{state}.webp` (+ `-sm`), matted with
`tools/brand/matte-mascot.py` under the shadow rule below.

### The mascot's shadow is gone on purpose

`tools/brand/matte-mascot.py` mattes the figure onto transparency. The render's
cast shadow is **not** carried into the alpha channel: it is cream-coloured, so
as partial alpha it turns into a pale halo the moment the mascot lands on a dark
surface. Surfaces that want a shadow draw their own — the three.js hero does.

Separating the figure from that shadow needed the **chroma ratio**, not
saturation: a cast shadow is the cream ground scaled toward black, so it keeps
the ground's low chroma-to-luminance ratio (~0.24) while its absolute saturation
(~47) sits *above* the mascot's dimmest parts. Boots read 0.55 and the lit head
0.51, so the ratio splits them where saturation cannot. The held map is
grey-blue paper with lower chroma still, so it is reclaimed separately from a
background-residual mask, cut through the empty band that happens to sit between
the map's bottom corner and where the shadow meets the ground.

## Regenerating

```sh
# SVGs — from the checked-in trace data
(cd tools/brand/trace-2026-10 && mkdir -p out && python3 build.py)

# icons — every PNG/webp icon comes from icon.svg; then strip alpha
for s in 1024 512 192 180 144; do
  rsvg-convert -w $s -h $s public/images/brand/icon.svg -o /tmp/icon-$s.png
done
python3 -c "from PIL import Image; [Image.open(f'/tmp/icon-{s}.png').convert('RGB').save(f'public/images/brand/icon-{s}.png') for s in (1024,512,192,180,144)]"

# mascot
python3 tools/brand/matte-mascot.py <mascot-render> public/images/brand/mascot.png
cwebp -q 90 -m 6 -alpha_q 100 public/images/brand/mascot.png -o public/images/brand/mascot.webp

# social card — logo-on-dark.svg + the hero scene + the headline, in Outfit
uv run --with pillow python3 tools/brand/make-og-card.py
```

### The social card

`og-image.png` is what a link to Loci looks like in a chat window, and it has to
answer "what is this" to somebody who has never heard of it. So it carries the
headline ("Explore your way."), one functional line, and the approved scene.

The logo is rendered from `logo-on-dark.svg`, so it is identical to every other
surface. The type is **Outfit**, vendored with its OFL in `tools/brand/fonts/`,
because the site loads it from Google Fonts at runtime and the card is baked
once. Content stays inside a 72px margin: several platforms crop toward a
squarer ratio for small previews.

Tools used: `rsvg-convert`, `cwebp`, `potrace`, Pillow, NumPy, SciPy, fonttools.

## Where these are wired

- `src/components/brand/Logo.tsx` — `LociMark` and `LociLogo`, inline SVG so the
  letters inherit `currentColor`. Same geometry as `mark.svg` / `logo-*.svg`; if
  one changes, change both (the path data comes from the trace folder).
- `src/components/brand/Lockup.tsx` — `LociLockup`
- `src/components/brand/Mascot.tsx` — `Mascot` with a `state`
- `public/manifest.json` and the VitePWA block in `vite.config.ts` — PWA icons,
  `theme_color` (kept identical)
- `src/entry-server.tsx` — favicons, `apple-touch-icon`, `theme-color`
- `src/app.tsx` — Open Graph and Twitter card
- `public/browserconfig.xml` — Windows tiles
