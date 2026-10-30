import re
exec(open('bake.py').read().split("d = lambda")[0])
H = 130*4
d = re.search(r'<path d="([^"]+)"', open('letters.svg').read(), re.S).group(1).replace("\n"," ")
# letters bbox up (114,21)-(1482,460); dot (1396,15)-(1490,109). origin = (114,15)
ox, oy = 114, 15
L = bake(d, tx=-ox, ty=H-oy)
cx,cy,r = map(float, open('dot.txt').read().split())
cx,cy = cx-ox, cy-oy
W, Hh = 1490-ox, 460-oy
open('letters.d','w').write(L); open('dotc.txt','w').write(f"{cx:.1f} {cy:.1f} {r:.1f}")
for name, ink in (("wordmark-on-dark","#F9E8D7"),("wordmark-on-light","#151B23")):
    open(name+".svg","w").write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {Hh}" role="img" aria-label="Loci">
  <path fill="{ink}" d="{L}"/>
  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{'#F6825F' if ink!='#151B23' else '#C24E34'}"/>
</svg>
''')
print(W,Hh)
