"""Matte the mascot render onto transparency.

    python3 tools/brand/matte-mascot.py RUfSG.jpg out.png

The approved art is a JPEG with no alpha: a clay figure on a warm cream vignette
with a soft cast shadow at its feet. The shadow cannot go into the alpha channel
— it is cream-coloured, so as partial alpha it becomes a pale halo the moment the
mascot lands on a dark surface. The figure is matted; the shadow is dropped, and
surfaces that want one draw their own.
"""

import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def background_residual(src):
    """How far each pixel departs from a smooth fit of the vignette.

    Fitted from a border ring the figure does not reach, so the vignette is
    subtracted rather than thresholded around.
    """
    h, w, _ = src.shape
    ring = np.zeros((h, w), bool)
    ring[:60, :] = ring[-60:, :] = ring[:, :40] = ring[:, -40:] = True
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    basis = np.stack(
        [np.ones(xx.shape), xx / w, yy / h, (xx / w) ** 2, xx * yy / (w * h), (yy / h) ** 2], -1
    )
    fit = np.empty_like(src)
    for ch in range(3):
        coef, *_ = np.linalg.lstsq(basis[ring], src[ring][:, ch], rcond=None)
        fit[:, :, ch] = basis @ coef
    return np.abs(src - fit).max(2)


def largest_blob(mask, kernel=7):
    """The one biggest blob, with the vignetted frame edge excluded first."""
    m = mask.copy()
    m[:100, :] = m[-120:, :] = m[:, :60] = m[:, -60:] = False
    m = ndimage.binary_opening(m, np.ones((kernel, kernel)))
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


def reclaim_cut(extra, top, sole):
    """The row that separates the held map from the cast shadow.

    Both are low-chroma additions to the figure and at this threshold they are one
    connected component, so no per-blob rule can tell them apart — but they are
    vertically disjoint, with an empty band between the map's bottom corner and
    where the shadow meets the ground. Cut through the middle of the widest empty
    band in the lower half rather than at a guessed fraction of the height.
    """
    mid = top + (sole - top) // 2
    occupied = extra[mid:sole].any(1)
    best = run = 0
    end = None
    for i, filled in enumerate(occupied):
        run = 0 if filled else run + 1
        if run > best:
            best, end = run, i
    if end is None:
        return sole
    return mid + end - best // 2


def matte(path):
    src = np.asarray(Image.open(path).convert("RGB")).astype(float)
    ratio = (src.max(2) - src.min(2)) / np.maximum(src.mean(2), 1.0)

    # Chroma RATIO, not saturation. The cast shadow is the cream ground scaled
    # toward black, so it keeps the ground's low chroma-to-luminance ratio (~0.24)
    # while its absolute saturation (~47) sits above the mascot's dimmest parts.
    # The ratio separates them where saturation cannot: boots 0.55, lit head 0.51.
    seed = largest_blob(ratio > 0.35)
    # A stricter pass finds the soles. The loose seed bleeds a few rows into the
    # shadow it touches, and the sole is the only honest place to end the figure.
    sole = int(np.where(largest_blob(ratio > 0.48).any(1))[0].max())
    top = int(np.where(seed.any(1))[0].min())

    # The map is grey-blue paper: low chroma, so the seed misses it. Reclaim it
    # from a loose residual mask above the shadow, keeping only what touches the
    # figure.
    loose = ndimage.binary_opening(background_residual(src) > 12, np.ones((5, 5)))
    extra = loose & ~ndimage.binary_dilation(seed, np.ones((5, 5)))
    loose[reclaim_cut(extra, top, sole):, :] = False
    lab, _ = ndimage.label(loose)
    touching = [i for i in np.unique(lab[ndimage.binary_dilation(seed, np.ones((9, 9)))]) if i]

    core = ndimage.binary_fill_holes(seed | np.isin(lab, touching))
    core[sole + 1:, :] = False

    alpha = np.clip((ndimage.gaussian_filter(core.astype(float), 1.1) - 0.35) / 0.4, 0, 1)
    out = Image.fromarray(np.dstack([src, alpha * 255]).astype(np.uint8), "RGBA")
    return out.crop(Image.fromarray((alpha * 255).astype(np.uint8)).getbbox())


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    im = matte(src)
    im.save(dst)
    print(f"{dst} {im.width}x{im.height}")
