import numpy as np
from PIL import Image
from scipy import ndimage as nd
fg = np.asarray(Image.open('fg.pbm').convert('L'))<128
bg = ~fg
lab,_ = nd.label(bg)
# hole+road+outside are one component (road reaches outside); isolate hole by cutting at the hole's lower edge
seed = (430, 524)
print("seed is bg:", bg[seed])
# boundary of bg component pixels adjacent to fg, within a window around the seed
H,W = fg.shape
yy,xx = np.mgrid[0:H,0:W]
edge = bg & nd.binary_dilation(fg) 
win = (abs(yy-seed[0])<200)&(abs(xx-seed[1])<200)
pts = np.argwhere(edge & win)
# iterative fit, dropping the bottom sector where the road leaves
def fit(p):
    y,x = p[:,0].astype(float), p[:,1].astype(float)
    A = np.c_[2*x,2*y,np.ones_like(x)]; c,*_ = np.linalg.lstsq(A, x*x+y*y, rcond=None)
    cx,cy = c[0],c[1]; r = np.sqrt(c[2]+cx*cx+cy*cy); return cx,cy,r
cx,cy,r = fit(pts)
for _ in range(5):
    d = np.hypot(pts[:,1]-cx, pts[:,0]-cy)
    ang = np.degrees(np.arctan2(pts[:,0]-cy, pts[:,1]-cx))  # +90 = straight down
    keep = (abs(d-r)<6) & ~((ang>45)&(ang<135))
    cx,cy,r = fit(pts[keep])
    print(f"cx={cx:.1f} cy={cy:.1f} r={r:.1f} n={keep.sum()} resid={np.std(d[keep]-r):.2f}")
disk = np.hypot(xx-cx, yy-cy) <= r
fg2 = (fg | (np.hypot(xx-cx,yy-cy) <= r+4)) & ~disk
Image.fromarray((~fg2*255).astype(np.uint8)).convert('1').save('fg2.pbm')
open('circle.txt','w').write(f"{cx} {cy} {r}")
