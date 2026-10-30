import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd
X0,Y0,X1,Y1,S = 180,385,580,515,4
im = Image.open(sys.argv[1]).convert("RGB").crop((X0,Y0,X1,Y1)).resize(((X1-X0)*S,(Y1-Y0)*S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.0))
a = np.asarray(im).astype(float)/255
lum = a@[0.2126,0.7152,0.0722]; sat = (a.max(-1)-a.min(-1))/(a.max(-1)+1e-6)
letters = (lum>0.5)&(sat<0.35)
dot = (sat>0.4)&(lum>0.35)
for n,m in (("letters",letters),("dot",dot)):
    lab,k = nd.label(m); sz = nd.sum(m,lab,range(1,k+1)); m = np.isin(lab,1+np.nonzero(sz>3000)[0])
    ys,xs = np.nonzero(m); print(n,"bbox up",xs.min(),ys.min(),xs.max(),ys.max(),"comps",(sz>3000).sum())
    Image.fromarray((~m*255).astype(np.uint8)).convert('1').save(f'{n}.pbm')
    if n=="dot":
        cy,cx = ys.mean(), xs.mean(); r = np.sqrt(m.sum()/np.pi); print(f"dot cx={cx:.1f} cy={cy:.1f} r={r:.1f}")
        open('dot.txt','w').write(f"{cx} {cy} {r}")
    print(n, "median", "#%02X%02X%02X"%tuple((np.median(a[nd.binary_erosion(m,iterations=6)],0)*255).astype(int)))
