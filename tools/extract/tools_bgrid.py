import json, subprocess
from PIL import Image, ImageOps
import numpy as np
COLS=[(142,237),(238,332),(333,427),(428,522),(523,617),(618,712),(713,810)]
ROWS=[(318,364),(370,416),(421,468),(473,519)]
meta=json.load(open('data/target_meta.json'))
res={}
for k,c in meta.items():
    if k[0]!='B': continue
    im=Image.open('vmod/images/'+c['img']).convert('L')
    grid=[]
    for (y0,y1) in ROWS:
        row=[]
        for (x0,x1) in COLS:
            cell=im.crop((x0+8,y0+4,x1-8,y1-4))
            a=np.asarray(cell)
            dark=(a<80)
            frac=dark.mean()
            if frac<0.05: row.append('-'); continue
            # binarize and upscale
            b=Image.fromarray(np.where(a<110,0,255).astype('uint8')).resize((cell.width*3,cell.height*3))
            b=ImageOps.expand(b,border=20,fill=255)
            b.save('/tmp/c.png')
            t=subprocess.run(['tesseract','/tmp/c.png','-','--psm','8','-c','tessedit_char_whitelist=0123456789'],capture_output=True,text=True).stdout.strip()
            row.append(t if t else '?')
        grid.append(row)
    res[k]=grid
json.dump(res,open('data/target_bgrid_ocr.json','w'))
for k in sorted(res,key=lambda k:int(k[1:])): print(k, ' | '.join(' '.join(f'{x:>2}' for x in r) for r in res[k]))
