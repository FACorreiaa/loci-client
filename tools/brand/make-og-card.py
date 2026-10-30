"""Render the social card served as og:image.

    uv run --with pillow python3 tools/brand/make-og-card.py

1200x630 is the size every platform agrees on, and the one already declared in
`og:image:width`/`height`. Content stays inside a 72px margin because several
platforms crop toward a squarer ratio for small unfurls.

The card exists to answer "what is this" to somebody who has never heard of
Loci and is looking at a link in a chat window. So it carries the promise, not
just the logo: the hero headline, one functional line, and the approved scene.

Obsidian ground, like the landing hero and the dark-first app. The logo comes
from logo-on-dark.svg rather than a font, so the mark is identical to every
other surface. The type is Outfit, the brand's display face, vendored under
tools/brand/fonts (OFL) because the site loads it from Google Fonts at runtime
and a card is baked once rather than rendered per view.

The scene is the shipped hero crop (public/images/hero/explore-scene-936.webp),
not the source PNG, so the card and the landing page show the same pixels.
"""

import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "public" / "images" / "brand"
SCENE = ROOT / "public" / "images" / "hero" / "explore-scene-936.webp"
OUTFIT = Path(__file__).resolve().parent / "fonts" / "Outfit-VF.ttf"

W, H = 1200, 630
MARGIN = 72
OBSIDIAN = "#11161D"
CREAM = "#F7F2EA"
CORAL = "#F47B5E"  # 6.8:1 on obsidian
MUTED = "#A3ACB7"  # 7.9:1 on obsidian
HAIRLINE = (247, 242, 234, 26)


def outfit(size: int, weight: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(OUTFIT), size)
    f.set_variation_by_name(weight)
    return f


def svg_to_image(svg: Path, width: int) -> Image.Image:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "logo.png"
        subprocess.run(
            ["rsvg-convert", "-w", str(width), str(svg), "-o", str(out)],
            check=True, capture_output=True,
        )
        return Image.open(out).convert("RGBA").copy()


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def main() -> None:
    card = Image.new("RGB", (W, H), OBSIDIAN)

    # The scene on the right, full height inside the margin, with the same
    # rounded corners and hairline edge the landing hero gives it.
    sh = H - 2 * MARGIN
    scene = Image.open(SCENE).convert("RGB")
    scene = scene.resize((round(scene.width * sh / scene.height), sh), Image.LANCZOS)
    sx = W - MARGIN - scene.width
    card.paste(rounded(scene, 22), (sx, MARGIN), rounded(scene, 22))
    edge = Image.new("RGBA", card.size, (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(
        (sx, MARGIN, sx + scene.width - 1, MARGIN + sh - 1), 22, outline=HAIRLINE, width=1
    )
    card.paste(edge, (0, 0), edge)

    draw = ImageDraw.Draw(card)

    # logo-on-dark.svg is 2018.9 x 720, so its height follows from its width.
    logo_w = 230
    logo_h = round(logo_w * 720 / 2018.9)
    logo = svg_to_image(BRAND / "logo-on-dark.svg", logo_w)
    card.paste(logo, (MARGIN, MARGIN), logo)

    # The landing page's own headline, with "way" in coral as it is there.
    head = outfit(78, "SemiBold")
    y = MARGIN + logo_h + 64
    draw.text((MARGIN, y), "Explore your", font=head, fill=CREAM)
    y += 86
    x = MARGIN
    for word, colour in (("way", CORAL), (".", CREAM)):
        draw.text((x, y), word, font=head, fill=colour)
        x += round(draw.textlength(word, font=head))

    body = outfit(26, "Light")
    draw.text(
        (MARGIN, y + 118),
        "Plan a trip in one sentence,\nwalk it stop by stop.",
        font=body, fill=MUTED, spacing=10,
    )

    host = outfit(18, "Medium")
    draw.text((MARGIN, H - MARGIN - 22), "L O C I A I . F Y I", font=host, fill=CORAL)

    png = BRAND / "og-image.png"
    card.save(png, optimize=True)
    subprocess.run(
        ["cwebp", "-q", "90", "-m", "6", "-quiet", str(png), "-o", str(BRAND / "og-image.webp")],
        check=True,
    )
    print(f"{png.relative_to(ROOT)}  {W}x{H}  {png.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
