import numpy as np
from PIL import Image
from scipy import ndimage as nd
im = np.asarray(Image.open('pin_up.png')).astype(float)/255
lum = im@[0.2126,0.7152,0.0722]
fg = np.asarray(Image.open('fg.pbm').convert('L'))<128
for t in (0.58,0.62,0.66):
    s = fg & (lum>t)
    s = nd.binary_closing(nd.binary_opening(s, iterations=3), iterations=6)
    lab,n = nd.label(s); sizes = nd.sum(s,lab,range(1,n+1))
    keep = np.isin(lab, 1+np.nonzero(sizes>4000)[0]); s=keep&fg
    print(t, n, sorted(sizes.astype(int))[-4:])
    o=np.zeros(fg.shape+(3,),np.uint8); o[fg]=(240,120,90); o[s]=(250,230,200)
    Image.fromarray(o[700:1100,150:900]).save(f'sand_{t}.png')
    Image.fromarray((~s*255).astype(np.uint8)).convert('1').save(f'sand_{t}.pbm')
