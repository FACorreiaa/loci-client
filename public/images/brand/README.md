# Loci brand assets

Everything the product, the web, and the eventual iOS and Android apps draw the
brand from. If you are here to add an app icon or a splash screen to a native
target, read [Which file do I use?](#which-file-do-i-use) and stop there.

## Brand values

| Token | Hex | HSL | Where it goes |
|---|---|---|---|
| Paper / cream | `#FDF5EA` | `35 83% 96%` | App ground, icon tile, splash |
| Ink / slate | `#323B42` | `206 14% 23%` | Body text, the wordmark's letters |
| Coral | `#FA7862` | `9 94% 68%` | The mark, accents, fills |

**Coral on cream measures ~2.1:1.** That fails WCAG AA for text at every size.
Coral is for the mark, accents and fills; text and buttons take ink. This is not
a preference — it is the reason the wordmark's letters are ink and only the "L"
is coral.

## Which file do I use?

| Surface | File |
|---|---|
| iOS app icon (App Store, 1024) | `icon-1024.png` |
| iOS home screen / `apple-touch-icon` | `icon-180.png` |
| Android adaptive icon foreground+background | `icon.svg` at 1024 (see note) |
| Android / PWA launcher | `icon-512.png`, `icon-192.png` |
| Web favicon | `../../favicon.svg`, `../../favicon.ico` |
| Browser tab PNG fallback | `icon-32.png`, `icon-16.png` |
| In-app header, buttons, avatars | `src/components/brand/Logo.tsx` |
| Marketing page, README, docs | `logo.svg`, `mark.svg` |
| Social card (Open Graph / Twitter) | `og-image.png` (1200×630) — built by `tools/brand/make-og-card.py` |
| Empty states, onboarding | `mascot.webp` / `mascot-sm.webp` |
| Native empty states | `mascot.png` |
| Marketing surfaces wanting the 3D treatment | `icon-tile.webp`, `icon-wordmark.webp`, `wordmark.webp` |

### Format rules

- **iOS app icons must be opaque, square PNG.** No alpha, no webp. Every
  `icon-*.png` here is RGB with no alpha channel; App Store validation rejects
  an icon that has one, and it does so at upload, not at build.
- **webp is for the web only.** `icon-*.webp` exist so browsers pull fewer
  bytes. Do not put one in an Xcode asset catalogue.
- **Marks stay SVG.** `mark.svg`, `logo.svg` and `icon.svg` are the sources of
  truth. Android takes them as VectorDrawable; iOS takes them as a PDF/SVG
  symbol. Do not rasterise a mark and check the raster in as a new master.
- **The mascot is the one genuinely raster asset** — it is a 3D clay render, not
  geometry, so there is no vector version and there will not be one.

### Android adaptive icons

Android composites a foreground over a background and masks the result, so a
full-bleed `icon-512.png` gets its edges cropped. Use two layers instead:

- background: a solid `#FDF5EA` colour, not an image
- foreground: `mark.svg` as a VectorDrawable, scaled so the mark is **~64% of
  the canvas height** — the same proportion `icon.svg` uses, and inside
  Android's 66% safe zone

## Provenance

Four pieces of approved art came in as **JPEG, RGB, no alpha**. Everything here
derives from them; the art itself is not in the repo.

| Source | Became |
|---|---|
| square icon tile, 784×1168 | `mark.svg` geometry, `icon-tile.webp` |
| horizontal wordmark, 1792×1008 | `logo.svg` letterforms, `wordmark.webp` |
| icon + wordmark tile, 1152×1712 | `icon-wordmark.webp` |
| mascot render, 784×1168 | `mascot.png`, `mascot*.webp` |

### The marks are traced, and that was a decision

Hand-authoring the mark from measured geometry plateaued at **91.8% IoU** against
the approved render — the stem's taper and the foot's bevel are not the straight
edges they look like. So:

- **`mark.svg`** — the head is a real `<circle>` at (97,97) r97, because the art's
  head *is* a circle and a primitive stays round where a polygon of it shows
  facets at 1024px. The body is a Douglas-Peucker simplification of the coral
  mask's contour at a 1.2px tolerance, 24 points, measured at **99.06% IoU**.
- **`logo.svg`** — the same mark, plus "oci" traced with potrace from the ink
  mask, smoothed first (2× upsample, Gaussian r=5) so the JPEG's compression
  noise did not become corners. **99.27% IoU** in 1.1KB of path. Traced rather
  than set in a typeface because the brand has no licensed font, and a lockup
  that depends on one installed locally renders differently wherever it is not.
- Both trace a **binary colour mask**, never the JPEG's pixels, which is what
  keeps the antialiasing out of the geometry.

Placement in `logo.svg` is measured, not eyeballed: in the source art the mark
occupies x 427..742 / y 258..690 and the letters x 774..1378 / y 343..693, and
both are mapped into the viewBox by the same scale. The optical spacing and the
baseline offset are the designer's.

### The icons are rendered, not cropped

`icon-*.png` and `icon-*.webp` all come from `icon.svg` via `rsvg-convert`, so
they cannot drift apart. The approved icon JPEG is **not** the source: it has
rounded corners and a soft drop shadow baked into its pixels, and both stores
apply their own mask on top — a crop would show a shadow inside the rounded
corner and a corner inside a corner. `icon-tile.webp` is that original art,
kept deliberately for marketing surfaces that want the dimensional look.

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
# marks and icons — every PNG/webp icon comes from icon.svg
for s in 1024 512 192 180 144 32 16; do
  rsvg-convert -w $s -h $s public/images/brand/icon.svg -o /tmp/icon-$s.png
done
# then strip alpha: the stores reject an icon that has one
python3 -c "from PIL import Image; [Image.open(f'/tmp/icon-{s}.png').convert('RGB').save(f'public/images/brand/icon-{s}.png') for s in (1024,512,192,180,144,32,16)]"

# mascot
python3 tools/brand/matte-mascot.py <mascot-render>.jpg public/images/brand/mascot.png
cwebp -q 90 -m 6 -alpha_q 100 public/images/brand/mascot.png -o public/images/brand/mascot.webp

# social card — composes logo.svg + mascot.webp + the tagline
python3 tools/brand/make-og-card.py
```

### The social card

`og-image.png` is what a link to Loci looks like in a chat window, and it has to
answer "what is this" to somebody who has never heard of it. So it carries the
promise, not just the logo — an earlier version was the wordmark and the mascot
alone, which is decoration.

The wordmark is rendered from `logo.svg`, so the mark is identical to every
other surface. Only the tagline needs type, and it is set in **Charter**: the
brand's Fraunces is loaded from Google Fonts at runtime and is not installed
locally, and this card is baked once rather than rendered per view. Charter is a
transitional serif with the same warmth, ships with macOS, and holds up at the
size an unfurl is actually viewed at. On a machine without it the script says so
and falls back rather than silently substituting.

Content stays inside a 72px margin: several platforms crop toward a squarer
ratio for small previews.

Tools used: `rsvg-convert`, `cwebp`, `potrace`, Pillow, SciPy.

## Where these are wired

- `src/components/brand/Logo.tsx` — `LociMark` and `LociLogo`, inline SVG so the
  mark inherits `currentColor`. Same geometry as `mark.svg` / `logo.svg`; if one
  changes, change both.
- `public/manifest.json` — PWA icons, `theme_color`
- `src/entry-server.tsx` — favicons, `apple-touch-icon`, Open Graph, Twitter
- `public/browserconfig.xml` — Windows tiles
