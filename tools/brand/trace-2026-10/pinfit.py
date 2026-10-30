import numpy as np
from PIL import Image
from scipy import ndimage as nd
fg=(np.asarray(Image.open('fg.pbm').convert('L'))<128)[97:1037,168:882]   # mark frame 714x940
filled = nd.binary_fill_holes(nd.binary_closing(fg, iterations=25))
edge = filled & ~nd.binary_erosion(filled)
pts = np.argwhere(edge)
y,x = pts[:,0].astype(float), pts[:,1].astype(float)
top = y < 380                                     # head arc only
A=np.c_[2*x[top],2*y[top],np.ones(top.sum())]; c,*_=np.linalg.lstsq(A,x[top]**2+y[top]**2,rcond=None)
cx,cy=c[0],c[1]; R=np.sqrt(c[2]+cx*cx+cy*cy)
res=np.hypot(x[top]-cx,y[top]-cy)-R
print(f"head cx={cx:.1f} cy={cy:.1f} R={R:.1f} resid={res.std():.2f}")
ty=y.max(); tx=x[y>ty-3].mean(); print(f"tip ({tx:.1f},{ty:.1f})")
# tangent points from tip to circle
d=np.hypot(tx-cx,ty-cy); a=np.arccos(R/d); base=np.arctan2(ty-cy,tx-cx)
for s in (+1,-1):
    t=base+s*a; print("tangent pt", round(cx+R*np.cos(t),1), round(cy+R*np.sin(t),1))
open('pin.txt','w').write(f"{cx} {cy} {R} {tx} {ty}")
cc=np.loadtxt('circle.txt'); print("hole (mark frame)", cc[0]-168, cc[1]-97, cc[2])
Image.fromarray((filled*255).astype(np.uint8)).save('filled.png')
