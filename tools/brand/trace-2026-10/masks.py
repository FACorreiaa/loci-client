import sys, numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
X0,Y0,X1,Y1 = 250,130,490,410
S = 4
im = Image.open(src).convert("RGB").crop((X0,Y0,X1,Y1)).resize(((X1-X0)*S,(Y1-Y0)*S), Image.LANCZOS)
im = im.filter(ImageFilter.GaussianBlur(2.0))
a = np.asarray(im).astype(float)/255
r,g,b = a[...,0],a[...,1],a[...,2]
mx, mn = a.max(-1), a.min(-1)
lum = 0.2126*r+0.7152*g+0.0722*b
sat = (mx-mn)/(mx+1e-6)
fg = lum > 0.16                      # anything not the dark ground/knockout
sand = fg & (lum > 0.55) & (sat < 0.33)   # cream dunes
coral = fg & ~sand
im.save(f"{out}/pin_up.png")
for n,m in (("fg",fg),("sand",sand),("coral",coral)):
    Image.fromarray((~m*255).astype(np.uint8)).convert("1").save(f"{out}/{n}.pbm")
ys,xs = np.nonzero(fg); print("fg bbox up:", xs.min(),ys.min(),xs.max(),ys.max(), "orig:", X0+xs.min()/S, Y0+ys.min()/S, X0+xs.max()/S, Y0+ys.max()/S)
print("frac sand of fg", sand.sum()/fg.sum())
