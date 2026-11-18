import json, glob, re, subprocess, os, sys
from PIL import Image
import numpy as np
def ocr(img, psm=6):
    p='/tmp/ocr_tmp.png'; img.save(p)
    r=subprocess.run(['tesseract',p,'-','--psm',str(psm)],capture_output=True,text=True)
    return re.sub(r'\s+',' ',r.stdout).strip()
out={}
files=sorted(glob.glob('vmod/images/_00*_Event *.jpg'))
for f in files:
    n=int(re.search(r'Event (\d+)',f).group(1))
    im=Image.open(f).convert('RGB'); a=np.asarray(im).astype(int)
    # upscale for OCR
    top=im.crop((20,20,580,425)); bot=im.crop((20,480,580,800))
    # spyglass: yellow pixels in top-right box
    box=a[30:95,375:575]
    yellow=((box[:,:,0]>200)&(box[:,:,1]>190)&(box[:,:,2]<90)).mean()
    # weather: cloud icon area
    wg=a[425:478,495:585]
    blue=((wg[:,:,2]>150)&(wg[:,:,0]<120)).mean(); red=((wg[:,:,0]>150)&(wg[:,:,1]<90)&(wg[:,:,2]<90)).mean()
    # symbols band
    band=a[430:475,90:480].mean(axis=2)
    dark=(band<130).mean(axis=0)
    out[n]=dict(file=os.path.basename(f), top=ocr(top.resize((top.width*2,top.height*2))), bottom=ocr(bot.resize((bot.width*2,bot.height*2))),
       yellow=round(float(yellow),3), blue=round(float(blue),3), red=round(float(red),3), dark=[round(float(x),2) for x in dark[::10]])
json.dump(out,open('data/event_ocr.json','w'),indent=1)
for n in sorted(out):
    o=out[n]; print(n, o['yellow'], o['blue'], o['red'], ''.join('#' if x>0.15 else '.' for x in o['dark']))
