import numpy as np, itertools, subprocess, os
from PIL import Image
m=(np.asarray(Image.open('letters.pbm').convert('L'))<128)[15:460,114:1490][:, :380]
best=(0,)
for s,b,R,irx,iry in itertools.product((81,82,83),(74,76,78,80),(135,140,145),(60,70,80,90),(65,75,85,95)):
    top=6
    d=(f"M0 17A11 11 0 0 1 11 {top}H{s-11}A11 11 0 0 1 {s} 17V{445-b-iry}A{irx} {iry} 0 0 0 {s+irx} {445-b}"
       f"H343A11 11 0 0 1 354 {445-b+11}V434A11 11 0 0 1 343 445H{R}A{R} {R} 0 0 1 0 {445-R}Z")
    open('t.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 445"><path d="{d}"/></svg>')
    subprocess.run(['rsvg-convert','-w','380','-h','445','t.svg','-o','t.png'],check=True)
    r=np.asarray(Image.open('t.png').convert('RGBA'))[...,3]>127
    iou=(m&r).sum()/(m|r).sum()
    if iou>best[0]: best=(iou,s,b,R,irx,iry,d)
print(best[:6]); open('L.d','w').write(best[6])
