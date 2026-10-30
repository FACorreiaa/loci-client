import numpy as np
from PIL import Image
from scipy import ndimage as nd
m=(np.asarray(Image.open('letters.pbm').convert('L'))<128)[15:460,114:1490]
lab,k=nd.label(m); objs=nd.find_objects(lab)
order=sorted(range(k),key=lambda i:objs[i][1].start)
for name,i in zip("Loci",order):
    sl=objs[i]; c=(lab[sl]==i+1); y0,x0=sl[0].start,sl[1].start; h,w=c.shape
    print(f"{name}: x {x0}-{x0+w} y {y0}-{y0+h} (w{w} h{h})")
    if name=="L":
        print("  stem width @mid", c[h//2].sum(), " base thickness @x=60%", c[:,int(w*.6)].sum())
        # outer corner: bottom-left; distance along diagonal from bbox corner to shape
        for t in range(0,200):
            if c[h-1-t,t]: print("  outer corner diag inset", t); break
        # inner corner
        sw=c[h//2].sum(); bt=c[:,int(w*.6)].sum()
        for t in range(0,200):
            if c[h-1-bt-t, sw+t]==False: pass
        col=c[:, sw+5]; print("  just right of stem: filled rows from bottom", col[::-1].argmin())
    if name in "oc":
        row=c[h//2]; print("  ring thickness L", np.argmin(row), " mid row filled", row.sum())
        col=c[:,w//2]; print("  ring thickness top", np.argmin(col), "bottom", np.argmin(col[::-1]))
        # flat-top length: top row extent
        for yy in (0,2,5,10):
            r=np.nonzero(c[yy])[0]; print(f"   row{yy} x {r.min()}-{r.max()}")
        for xx in (0,2,5,10):
            r=np.nonzero(c[:,xx])[0]; print(f"   col{xx} y {r.min()}-{r.max()}")
        if name=="c":
            r=np.nonzero(~c[:,w-3])[0]; print("  c opening at right edge rows", r.min(), r.max())
    if name=="i":
        print("  stem width", c[h//2].sum())
        for yy in (0,3,8,15): r=np.nonzero(c[yy])[0]; print(f"   row{yy} x {r.min()}-{r.max()}")
