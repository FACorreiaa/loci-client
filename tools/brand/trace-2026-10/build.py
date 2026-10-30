FG=open('fg.d').read(); CORAL=open('coral.d').read(); SAND=open('sand.d').read(); HULL=open('hull.d').read()
LET=open('letters-geo.d').read(); TAG=open('tagline.d').read().strip()
HOLE=(355.9,352.2,140.9)
PIN_STOPS=[("0","#F9A47C"),(".3","#F68667"),(".5","#E8735D"),(".7","#D2645A"),("1","#C25A52")]
SAND_STOPS=[("0","#F6D8BC"),("1","#E9B597")]
def grad(id_, stops): return f'<linearGradient id="{id_}" x1="0" y1="0" x2="0" y2="1">'+"".join(f'<stop offset="{o}" stop-color="{c}"/>' for o,c in stops)+'</linearGradient>'
CLIP=f'<clipPath id="loci-clip"><path d="{FG}"/></clipPath>'
DEFS=f'<defs>{grad("loci-pin",PIN_STOPS)}{grad("loci-sand",SAND_STOPS)}{CLIP}</defs>'
def mark_g(mono=None):
    if mono: return f'<path fill="{mono}" d="{FG}"/>'
    return f'<path fill="url(#loci-pin)" d="{CORAL}"/><path fill="url(#loci-sand)" clip-path="url(#loci-clip)" d="{SAND}"/>'
def word_g(ink, dot): return f'<path fill="{ink}" d="{LET}"/><circle cx="1329.5" cy="47" r="47" fill="{dot}"/>'
def svg(vb, body, comment, defs=True):
    return f'<!--\n{comment.strip()}\n-->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Loci">\n  {DEFS if defs else ""}\n  {body}\n</svg>\n'
INK_DARK, DOT_DARK = "#F9E7D6", "#F6825F"     # wordmark on dark ground (measured from the art)
INK_LIGHT, DOT_LIGHT = "#151B23", "#E8684C"   # wordmark on light ground
TAG_DARK, TAG_LIGHT = "#8A7B74", "#6B625D"
W = {}
W["mark.svg"] = svg("0 0 714 940", mark_g(), """
  The Loci mark: a map pin with a road winding out of its head and down
  through the dunes. Traced from the approved 2026-10 art (see README):
  silhouette 99.8% IoU, dunes 99.5% IoU. The head hole is part of the traced
  outline but was cut from a fitted true circle first (residual 0.58px), so it
  stays round at any size. Gradient stops are medians sampled down the art.
""")
W["mark-mono.svg"] = svg("0 0 714 940", mark_g("currentColor"), """
  Single-colour mark: the silhouette only, road and head knocked out.
  currentColor, so it serves tab bars, mono contexts and print.
""", defs=False)
W["favicon.svg"] = svg("-113 0 940 940", f'<path fill="url(#loci-pin)" fill-rule="evenodd" d="{HULL}M{HOLE[0]-HOLE[2]:.1f} {HOLE[1]}a{HOLE[2]} {HOLE[2]} 0 1 0 {2*HOLE[2]:.1f} 0a{HOLE[2]} {HOLE[2]} 0 1 0 {-2*HOLE[2]:.1f} 0Z"/>', """
  Small-size mark (favicons, <=32px): pin and head hole only. The road and
  dunes are illegible below ~40px and turn to noise, so they are dropped here.
""")
# horizontal logo: mark at 580 tall, wordmark centred on it
MH=720; S=MH/940; MW=714*S; GAP=96; WX=MW+GAP; WY=(MH-445)/2+24; HW=WX+1376
def logo(ink,dot,mono=None):
    m = mark_g(mono)
    w = f'<path fill="{mono or ink}" d="{LET}"/><circle cx="1329.5" cy="47" r="47" fill="{mono or dot}"/>'
    return f'<g transform="scale({S:.5f})">{m}</g><g transform="translate({WX:.1f} {WY:.1f})">{w}</g>'
W["logo-on-dark.svg"] = svg(f"0 0 {HW:.1f} {MH}", logo(INK_DARK,DOT_DARK), "Horizontal logo for dark grounds. Mark traced, letters drawn geometrically (98.3% IoU vs the art).")
W["logo-on-light.svg"] = svg(f"0 0 {HW:.1f} {MH}", logo(INK_LIGHT,DOT_LIGHT), "Horizontal logo for light grounds: ink letters, deeper coral dot.")
W["logo-mono.svg"] = svg(f"0 0 {HW:.1f} {MH}", logo(None,None,"currentColor"), "Horizontal logo, single colour (currentColor).", defs=False)
# vertical lockup: positions measured from the art, everything centred on one axis
def lockup(ink,dot,tag):
    return (f'<g transform="translate(409 0)">{mark_g()}</g>'
            f'<g transform="translate(78 938)">{word_g(ink,dot)}</g>'
            f'<g transform="translate(0 1603.8)"><path fill="{tag}" d="{TAG}"/></g>')
W["lockup-on-dark.svg"] = svg("0 0 1532 1604", lockup(INK_DARK,DOT_DARK,TAG_DARK), "Vertical lockup as in the approved art: mark, wordmark, EXPLORE YOUR WAY (Outfit Light, 0.233em tracking, outlined).")
W["lockup-on-light.svg"] = svg("0 0 1532 1604", lockup(INK_LIGHT,DOT_LIGHT,TAG_LIGHT), "Vertical lockup for light grounds.")
# app icon: obsidian full-bleed, mark 64% of canvas height, centred
IS=655/940; IX=(1024-714*IS)/2; IY=(1024-655)/2
icon_bg='<linearGradient id="loci-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18202A"/><stop offset="1" stop-color="#0D1117"/></linearGradient>'
W["icon.svg"] = f'''<!--
  Source of truth for every square app icon (store PNGs, PWA, apple-touch).
  Full-bleed, no corner radius: both stores apply their own mask. Obsidian
  ground with a faint top-down falloff; mark 64% of the canvas height, inside
  Android's 66% adaptive safe zone.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Loci">
  <defs>{grad("loci-pin",PIN_STOPS)}{grad("loci-sand",SAND_STOPS)}{CLIP}{icon_bg}</defs>
  <rect width="1024" height="1024" fill="url(#loci-ground)"/>
  <g transform="translate({IX:.1f} {IY:.1f}) scale({IS:.5f})">{mark_g()}</g>
</svg>
'''
W["icon-dark.svg"] = W["icon.svg"].replace('<rect width="1024" height="1024" fill="url(#loci-ground)"/>','')
W["icon-tinted.svg"] = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#B8B8B8"/></linearGradient></defs>
  <rect width="1024" height="1024" fill="#000"/>
  <g transform="translate({IX:.1f} {IY:.1f}) scale({IS:.5f})"><path fill="url(#g)" d="{FG}"/></g>
</svg>
'''
for k,v in W.items(): open('out/'+k,'w').write(v)
print({k:len(v) for k,v in W.items()})
