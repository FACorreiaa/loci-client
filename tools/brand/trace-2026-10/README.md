# 2026-10 logo trace

The working scripts that produced the "Explore your way" logo set in
`public/images/brand/` from the approved art
(`Loci Mascot Exploring a Futuristic City.png`, 1536×1024, kept untracked at
`tools/brand/source/loci-scene-2026-10.png`). They are the scripts as run, not a
polished pipeline: each reads and writes files in the current directory.

The source is one raster scene, so every shape here is a **trace** — an
approximation with a measured overlap, not the master artwork. See
`public/images/brand/README.md` for the IoU of each shape.

## Rebuilding the shipped SVGs

The traced path data is checked in (`*.d`, `*.txt`), so the final step runs on
its own and reproduces the 11 SVGs byte for byte:

```sh
cd tools/brand/trace-2026-10
mkdir -p out && python3 build.py
cp out/favicon.svg ../../../public/favicon.svg
cp out/{mark,mark-mono,logo-*,lockup-*,icon,icon-dark,icon-tinted}.svg ../../../public/images/brand/
```

Raster icons are then rendered from `icon.svg` with `rsvg-convert` and
flattened to opaque RGB (no alpha; App Store and maskable icons reject it). The
16 and 32 px icons and `favicon.ico` come from the simplified favicon (pin and
hole, no road: the road is illegible below 32 px).

## Re-tracing from the source

Needs `potrace` and `uv run --with pillow --with numpy --with scipy`.

| Step | Script | Produces |
|---|---|---|
| Crop the logo, 4× upsample, binary masks | `masks.py <src> <outdir>` | `pin_up.png`, `fg.pbm` |
| Fit the head hole as a true circle, re-cut | `circle.py` | `circle.txt`, `fg2.pbm` |
| Dunes (rows ≥ 700, dilate 4 ∩ silhouette) | `sand.py`, `stops.py` | `sand.pbm`, gradient stops |
| Trace | `potrace -t 80 -a 1.1 -O 0.6 -u 10 --flat -b svg` | `fg.svg`, `sand.svg`, `coral.svg` |
| Bake coordinates (x' = .1x − 168, y' = −.1y + 1023) | `bake.py` | `fg.d`, `sand.d` |
| Wordmark masks, i-dot circle | `word.py <src>`, `word2.py` | `letters.pbm`, `dot.txt`, `dotc.txt` |
| Geometric letters by IoU search (o, L) | `measure.py`, `fit_o.py`, `fit_L.py` | `L.d` |
| Assemble the letters | `geo.py` | `letters-geo.d` |
| Favicon silhouette (convex hull + hole) | `pinfit.py` | `pin.txt`, `hull.d` |
| Tagline outlined from Outfit wght 300 | `tagline.py <Outfit-VF.ttf> 300` | `tagline.d` |
| Write every SVG | `build.py` | `out/*.svg` |

The coral layer excludes the dune interior (dilated 6 px into it) and the dunes
are clipped to the silhouette, so anti-aliased edges never show a seam where the
two meet.
