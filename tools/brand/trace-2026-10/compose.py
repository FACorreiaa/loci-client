import re
d = lambda f: re.search(r'<path d="([^"]+)"', open(f).read(), re.S).group(1).replace("\n"," ")
fg, sand = d("fg.svg"), d("sand.svg")
T = 'transform="translate(-168 1023) scale(.1 -.1)"'
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 714 940" role="img" aria-label="Loci">
  <defs>
    <linearGradient id="loci-pin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F9A47C"/>
      <stop offset=".3" stop-color="#F68667"/>
      <stop offset=".5" stop-color="#E8735D"/>
      <stop offset=".7" stop-color="#D2645A"/>
      <stop offset="1" stop-color="#C25A52"/>
    </linearGradient>
    <linearGradient id="loci-sand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F6D8BC"/>
      <stop offset="1" stop-color="#E9B597"/>
    </linearGradient>
  </defs>
  <g {T}>
    <path fill="url(#loci-pin)" d="{fg}"/>
    <path fill="url(#loci-sand)" d="{sand}"/>
  </g>
</svg>
'''
open("mark.svg","w").write(svg)
mono = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 714 940" role="img" aria-label="Loci">
  <path fill="currentColor" {T} d="{fg}"/>
</svg>
'''
open("mark-mono.svg","w").write(mono)
