import sys, json
from PIL import Image
import numpy as np
COLS=[(142,237),(238,332),(333,427),(428,522),(523,617),(618,712),(713,810)]
ROWS=[(318,364),(370,416),(421,468),(473,519)]
def analyze(path):
    im=np.asarray(Image.open(path).convert('L')).astype(int)
    grid=[]
    for (y0,y1) in ROWS:
        row=[]
        for (x0,x1) in COLS:
            cell=im[y0+6:y1-6, x0+6:x1-6]
            dark=(cell<90).mean()
            row.append(round(float(dark),3))
        grid.append(row)
    return grid
if __name__=='__main__':
    for p in sys.argv[1:]:
        print(p, analyze(p))
