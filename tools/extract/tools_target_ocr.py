import json, subprocess, re
from PIL import Image
meta=json.load(open('data/target_meta.json'))
out={}
for k,c in meta.items():
    im=Image.open('vmod/images/'+c['img']).convert('RGB')
    hdr=im.crop((70,60,840,270)); hdr=hdr.resize((hdr.width*2,hdr.height*2))
    hdr.save('/tmp/h.png')
    t=subprocess.run(['tesseract','/tmp/h.png','-','--psm','6'],capture_output=True,text=True).stdout
    out[k]=re.sub(r'\s+',' ',t).strip()
json.dump(out,open('data/target_ocr.json','w'),indent=1)
for k in sorted(out,key=lambda k:(k[0],int(k[1:]))): print(k,'|',out[k])
