import json
from PIL import Image
import numpy as np
COLS=[(142,237),(238,332),(333,427),(428,522),(523,617),(618,712),(713,810)]
ROWS=[(318,364),(370,416),(421,468),(473,519)]
meta=json.load(open('data/target_meta.json'))
cells=[]
for k,c in meta.items():
    if k[0]!='B': continue
    im=np.asarray(Image.open('vmod/images/'+c['img']).convert('L')).astype(int)
    for ri,(y0,y1) in enumerate(ROWS):
        for ci,(x0,x1) in enumerate(COLS):
            a=im[y0+3:y1-3,x0+4:x1-4]
            m=a<100
            ys,xs=np.where(m)
            if len(ys)==0: sig=None
            else:
                bb=m[ys.min():ys.max()+1, xs.min():xs.max()+1]
                h,w=bb.shape
                sig=(w,h,np.asarray(Image.fromarray((bb*255).astype('uint8')).resize((24,24))).astype(float)/255)
            cells.append((k,ri,ci,sig))
# cluster
clusters=[]
for idx,(k,ri,ci,sig) in enumerate(cells):
    if sig is None: continue
    w,h,v=sig
    best=None
    for cl in clusters:
        w2,h2,v2=cl['rep']
        if abs(w-w2)<=3 and abs(h-h2)<=3:
            d=np.abs(v-v2).mean()
            if d<0.12 and (best is None or d<best[0]): best=(d,cl)
    if best: best[1]['members'].append(idx)
    else: clusters.append({'rep':sig,'members':[idx]})
print(len(clusters))
for i,cl in enumerate(clusters):
    w,h,_=cl['rep']; print(i,len(cl['members']),w,h, [cells[m][:3] for m in cl['members'][:3]])
# save representative images
reps=[]
for i,cl in enumerate(clusters):
    k,ri,ci,_=cells[cl['members'][0]]
    c=meta[k]; im=Image.open('vmod/images/'+c['img']).convert('RGB')
    x0,x1=COLS[ci]; y0,y1=ROWS[ri]
    reps.append(im.crop((x0,y0,x1,y1)))
W=95; H=47
can=Image.new('RGB',(W*8,(H+14)*((len(reps)+7)//8)),'white')
from PIL import ImageDraw
d=ImageDraw.Draw(can)
for i,r in enumerate(reps):
    x=(i%8)*W; y=(i//8)*(H+14)
    d.text((x+2,y),str(i),fill='red'); can.paste(r.resize((W,H)),(x,y+12))
can.save('work/bclusters.png')
json.dump({'cells':[(k,ri,ci) for k,ri,ci,_ in cells],'clusters':[cl['members'] for cl in clusters]},open('work/bclusters.json','w'))
