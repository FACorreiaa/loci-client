L = "M0 17A11 11 0 0 1 11 6H71A11 11 0 0 1 82 17V286A80 85 0 0 0 162 371H343A11 11 0 0 1 354 382V434A11 11 0 0 1 343 445H145A145 145 0 0 1 0 300Z"
O = ("M552 136H653A148 148 0 0 1 801 284V297A148 148 0 0 1 653 445H552A148 148 0 0 1 404 297V284A148 148 0 0 1 552 136Z"
     "M552 207A69 77 0 0 0 483 284V297A69 77 0 0 0 552 374H653A69 77 0 0 0 722 297V284A69 77 0 0 0 653 207Z")
C = ("M1195 136A11 11 0 0 1 1206 147V196A11 11 0 0 1 1195 207H1011A69 77 0 0 0 942 284V297A69 77 0 0 0 1011 374"
     "H1195A11 11 0 0 1 1206 385V434A11 11 0 0 1 1195 445H1011A148 148 0 0 1 863 297V284A148 148 0 0 1 1011 136Z")
I = "M1290 173A39.5 34 0 0 1 1369 173V434A11 11 0 0 1 1358 445H1301A11 11 0 0 1 1290 434Z"
LETTERS = L+O+C+I
DOT = (1329.5, 47, 47)
open('letters-geo.d','w').write(LETTERS)
def svg(ink, dot, extra=""):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1376 445" role="img" aria-label="Loci">
  <path fill="{ink}" d="{LETTERS}"/>
  <circle cx="{DOT[0]}" cy="{DOT[1]}" r="{DOT[2]}" fill="{dot}"/>
</svg>
'''
open('wg-dark.svg','w').write(svg('#F9E7D6','#F6825F'))
open('wg-light.svg','w').write(svg('#151B23','#E8684C'))
open('wg-black.svg','w').write(svg('#000','none'))
