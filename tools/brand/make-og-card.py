"""Render the social card served as og:image.

    python3 tools/brand/make-og-card.py

1200x630 is the size every platform agrees on, and the one already declared in
`og:image:width`/`height`. Content stays inside a 72px margin because several
platforms crop toward a squarer ratio for small unfurls.

The card exists to answer "what is this" to somebody who has never heard of
Loci and is looking at a link in a chat window. So it carries the promise, not
just the logo — the earlier version was the wordmark and the mascot alone, which
is decoration.

The wordmark comes from logo.svg rather than a font, so the mark is identical to
every other surface. Only the tagline needs type, and it is set in Charter: the
brand's Fraunces is loaded from Google Fonts at runtime and is not installed
locally, and a card is baked once rather than rendered per view. Charter is a
transitional serif with the same warmth, ships with macOS, and holds up at the
size a unfurl is actually viewed at.
"""

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "public" / "images" / "brand"

W, H = 1200, 630
MARGIN = 72
CREAM = "#FDF5EA"
INK = "#323B42"
CORAL = "#E2664A"  # the day-zero coral: 3.4:1 on cream, fine for display type
MUTED = "#5F6469"

SERIF = "/System/Library/Fonts/Supplemental/Charter.ttc"
SANS = "/System/Library/Fonts/Supplemental/Futura.ttc"


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size, index=index)
    except OSError:
        print(f"warning: {path} unavailable, falling back", file=sys.stderr)
        return ImageFont.load_default(size)


def svg_to_image(svg: Path, width: int) -> Image.Image:
    out = Path("/tmp") / (svg.stem + f"-{width}.png")
    subprocess.run(
        ["rsvg-convert", "-w", str(width), str(svg), "-o", str(out)],
        check=True, capture_output=True,
    )
    return Image.open(out).convert("RGBA")


def main() -> None:
    card = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(card)

    # Mascot first, on the right, bottom-aligned to the margin so it stands on
    # the card rather than floating in it.
    mascot = Image.open(BRAND / "mascot.webp")
    mh = 452
    mascot = mascot.resize((round(mascot.width * mh / mascot.height), mh), Image.LANCZOS)
    card.paste(mascot, (W - MARGIN - mascot.width, H - MARGIN - mh), mascot)

    # Vertical rhythm is laid out explicitly rather than by nudging: the logo is
    # a fixed ratio (1093:500) so its height follows from its width, and every
    # block below starts from where the previous one ends.
    logo_w = 330
    logo_h = round(logo_w * 500 / 1093)
    logo = svg_to_image(BRAND / "logo.svg", logo_w)
    card.paste(logo, (MARGIN, 72), logo)

    # The landing page's own headline, and it colours "route" the same way.
    head = font(SERIF, 60, index=3)  # 3 is Charter Bold; 1 is Italic
    y = 72 + logo_h + 34
    draw.text((MARGIN, y), "Turn a vibe", font=head, fill=INK)
    y += 72
    x = MARGIN
    for word, colour in (("into a ", INK), ("route", CORAL), (".", INK)):
        draw.text((x, y), word, font=head, fill=colour)
        x += round(draw.textlength(word, font=head))

    body = font(SERIF, 25)
    draw.text(
        (MARGIN, y + 104),
        "Tell it a city and a mood. Get a real itinerary\nof real places — mapped and ordered.",
        font=body, fill=MUTED, spacing=9,
    )

    host = font(SANS, 19, index=0)
    draw.text((MARGIN, H - MARGIN - 26), "L O C I A I . F Y I", font=host, fill=CORAL)

    png = BRAND / "og-image.png"
    card.save(png, optimize=True)
    subprocess.run(
        ["cwebp", "-q", "90", "-m", "6", "-quiet", str(png), "-o", str(BRAND / "og-image.webp")],
        check=True,
    )
    print(f"{png.relative_to(ROOT)}  {W}x{H}  {png.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
