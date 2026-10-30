import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
f = instantiateVariableFont(TTFont(sys.argv[1]), {"wght": float(sys.argv[2])})
cap = f["OS/2"].sCapHeight
gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
text = "EXPLORE YOUR WAY"
CAP_U, WIDTH_U = 79.0, 1532.0          # target cap height and ink width, in lockup units (4x source px)
k = CAP_U / cap
names = [cmap[ord(c)] for c in text]
adv = [hmtx[n][0] for n in names]
# ink width = sum(adv[:-1]) + rsb-trimmed last glyph + tracking*(n-1); approximate with bounds
from fontTools.pens.boundsPen import BoundsPen
def bounds(n):
    bp = BoundsPen(gs); gs[n].draw(bp); return bp.bounds
first_lsb = bounds(names[0])[0]; last = bounds(names[-1])
ink_no_track = sum(adv[:-1]) + last[2] - first_lsb
track = (WIDTH_U / k - ink_no_track) / (len(text) - 1)
pen = SVGPathPen(gs)
x = -first_lsb
for n, a in zip(names, adv):
    tp = TransformPen(pen, (k, 0, 0, -k, x * k, 0))   # flip y: baseline at 0
    gs[n].draw(tp); x += a + track
print(f"track={track:.1f} font units ({track/1000:.3f}em)", file=sys.stderr)
print(pen.getCommands())
