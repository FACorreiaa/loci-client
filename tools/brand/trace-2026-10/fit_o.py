import numpy as np, itertools
from PIL import Image
m=(np.asarray(Image.open('letters.pbm').convert('L'))<128)[15:460,114:1490]
o=m[:, 395:810]; ox=395
yy,xx=np.mgrid[0:o.shape[0],0:o.shape[1]]+0.5
def rr(x0,y0,x1,y1,rx,ry,n=2.0):
    # rounded rect with superellipse corners of exponent n
    cx=np.clip(xx,x0+rx,x1-rx); cy=np.clip(yy,y0+ry,y1-ry)
    return (np.abs((xx-cx)/rx)**n+np.abs((yy-cy)/ry)**n)<=1
X0,Y0,X1,Y1=404-ox,136,801-ox,445
best=(0,)
for rx,ry,sx,sy,n in itertools.product(range(130,200,6),range(120,156,4),(76,78,80),(68,70,72),(2.0,2.4,2.8)):
    ry2=min(ry,(Y1-Y0)/2)
    s=rr(X0,Y0,X1,Y1,rx,ry2,n)&~rr(X0+sx,Y0+sy,X1-sx,Y1-sy,max(rx-sx,4),max(ry2-sy,4),n)
    iou=(s&o).sum()/(s|o).sum()
    if iou>best[0]: best=(iou,rx,ry2,sx,sy,n)
print("best o", best)
best2=(0,)
for rx,ry,irx,iry,sx,sy in itertools.product((142,146,150,154),(144,148,152),range(50,110,8),range(50,90,6),(76,78,80),(68,70,72)):
    s=rr(X0,Y0,X1,Y1,rx,ry)&~rr(X0+sx,Y0+sy,X1-sx,Y1-sy,irx,min(iry,(Y1-Y0-2*sy)/2))
    iou=(s&o).sum()/(s|o).sum()
    if iou>best2[0]: best2=(iou,rx,ry,irx,iry,sx,sy)
print("best o independent inner", best2)
