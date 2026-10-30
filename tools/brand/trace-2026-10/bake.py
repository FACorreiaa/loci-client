import re, sys
def bake(d, sx=.1, sy=-.1, tx=-168, ty=1023):
    toks = re.findall(r'[MmLlCcZz]|-?\d+\.?\d*', d)
    out, cmd, nums = [], None, []
    def flush():
        if cmd is None: return
        if cmd in 'zZ': out.append('Z'); return
        rel = cmd.islower(); v = []
        for i,n in enumerate(nums):
            n = float(n)
            if i%2==0: n = n*sx + (0 if rel else tx)
            else:      n = n*sy + (0 if rel else ty)
            v.append(f"{n:.1f}".rstrip('0').rstrip('.') if '.' in f"{n:.1f}" else f"{n:.1f}")
        out.append(cmd + " ".join(v))
    for t in toks:
        if re.match(r'[A-Za-z]', t):
            flush(); cmd, nums = t, []
        else: nums.append(t)
    flush()
    s = "".join(out)
    return re.sub(r' -', '-', s)
d = lambda f: re.search(r'<path d="([^"]+)"', open(f).read(), re.S).group(1).replace("\n"," ")
fg, sand = bake(d("fg2.svg")), bake(d("sand.svg"))
open("fg.d","w").write(fg); open("sand.d","w").write(sand)
grad = '''    <linearGradient id="loci-pin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F9A47C"/>
      <stop offset=".3" stop-color="#F68667"/>
      <stop offset=".5" stop-color="#E8735D"/>
      <stop offset=".7" stop-color="#D2645A"/>
      <stop offset="1" stop-color="#C25A52"/>
    </linearGradient>
    <linearGradient id="loci-sand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F6D8BC"/>
      <stop offset="1" stop-color="#E9B597"/>
    </linearGradient>'''
open("mark.svg","w").write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 714 940" role="img" aria-label="Loci">
  <defs>
{grad}
  </defs>
  <path fill="url(#loci-pin)" d="{fg}"/>
  <path fill="url(#loci-sand)" d="{sand}"/>
</svg>
''')
open("mark-mono.svg","w").write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 714 940" role="img" aria-label="Loci">
  <path fill="currentColor" d="{fg}"/>
</svg>
''')
