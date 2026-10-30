import numpy as np
from PIL import Image
from scipy import ndimage as nd
im = np.asarray(Image.open('pin_up.png')).astype(float)
fg = np.asarray(Image.open('fg.pbm').convert('L'))<128
sand = np.asarray(Image.open('sand_0.62.pbm').convert('L'))<128
sand[:700] = False
sand = nd.binary_dilation(sand, iterations=4) & fg     # swallow the thin coral rim at the pin edge
Image.fromarray((~sand*255).astype(np.uint8)).convert('1').save('sand.pbm')
core = nd.binary_erosion(fg & ~sand, iterations=8)
ys = np.nonzero(fg.any(1))[0]; y0,y1 = ys.min(), ys.max()
for f in np.linspace(0,1,11):
    y = int(y0+f*(y1-y0)); band = core[max(y-8,0):y+8]
    px = im[max(y-8,0):y+8][band]
    if len(px)>200: print(f"{f:.2f}", "#%02X%02X%02X"%tuple(np.median(px,0).astype(int)), len(px))
c = nd.binary_erosion(sand, iterations=6); print("sand median", "#%02X%02X%02X"%tuple(np.median(im[c],0).astype(int)))
lum = im@[0.2126,0.7152,0.0722]/255
print("sand light/dark quartiles", ["#%02X%02X%02X"%tuple(np.median(im[c & (lum>q0) & (lum<=q1)],0).astype(int)) for q0,q1 in ((0,0.75),(0.75,0.85),(0.85,1))])
