from pathlib import Path
import html, re, sys
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether

src=Path(sys.argv[1]); dest=src.with_suffix('.pdf')
fonts=Path('/usr/share/fonts/truetype/dejavu')
for name,file in [('Body','DejaVuSans.ttf'),('BodyBold','DejaVuSans-Bold.ttf'),('BodyItalic','DejaVuSans-Oblique.ttf'),('Code','DejaVuSansMono.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(fonts/file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyBold',italic='BodyItalic',boldItalic='BodyBold')
navy=colors.HexColor('#213b50'); gold=colors.HexColor('#a77e2a'); ink=colors.HexColor('#21313d'); gray=colors.HexColor('#60717c')
width=letter[0]-88
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=9,leading=12.6,textColor=ink,spaceAfter=7),
 'title':ParagraphStyle('title',fontName='BodyBold',fontSize=23,leading=28,textColor=navy,spaceAfter=10),
 'h2':ParagraphStyle('h2',fontName='BodyBold',fontSize=13.3,leading=18,textColor=navy,spaceBefore=16,spaceAfter=8,keepWithNext=True),
 'h3':ParagraphStyle('h3',fontName='BodyBold',fontSize=10.3,leading=14,textColor=navy,spaceBefore=10,spaceAfter=7,keepWithNext=True),
 'cell':ParagraphStyle('cell',fontName='Body',fontSize=8,leading=11,textColor=ink),
 'head':ParagraphStyle('head',fontName='BodyBold',fontSize=8,leading=11,textColor=colors.white),
 'caption':ParagraphStyle('caption',fontName='Body',fontSize=8,leading=11,textColor=gray,spaceAfter=8),
 'bullet':ParagraphStyle('bullet',fontName='Body',fontSize=9.1,leading=13.1,textColor=ink,spaceAfter=7,leftIndent=13,firstLineIndent=0,bulletIndent=0),
}
token=re.compile(r'(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|<(https?://[^>]+)>)')
def inline(s):
    result=[];last=0
    for m in token.finditer(s):
        result.append(html.escape(s[last:m.start()]))
        if m.group(2):
            url=m.group(3)
            if not url.startswith('http'):
                url='https://github.com/ramyahoo88/A_Glorious_Chance_solo/tree/main/audits/2026-11-19-v0.2.11/'+url
            result.append('<link color="#275e8a" href="'+html.escape(url,quote=True)+'">'+html.escape(m.group(2))+'</link>')
        elif m.group(4): result.append('<font name="Code" size="8">'+html.escape(m.group(4))+'</font>')
        elif m.group(5): result.append('<b>'+html.escape(m.group(5))+'</b>')
        else: result.append('<link color="#275e8a" href="'+m.group(6)+'">'+html.escape(m.group(6))+'</link>')
        last=m.end()
    result.append(html.escape(s[last:]));return ''.join(result)
def paragraph(s,style='body',**kw):return Paragraph(inline(s),styles[style],**kw)
story=[];lines=src.read_text().splitlines();i=0
while i<len(lines):
    line=lines[i].strip()
    if not line:i+=1;continue
    if line.startswith('# '):story.append(paragraph(line[2:],'title'));i+=1;continue
    if line.startswith('## '):
        title=line[3:]
        if title.startswith(('A01','A02','A03','Two new rules','Browser and')):story.append(PageBreak())
        story.append(paragraph(title,'h2'));i+=1;continue
    if line.startswith('### '):story.append(paragraph(line[4:],'h3'));i+=1;continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?',c) for c in cells):rows.append(cells)
            i+=1
        n=len(rows[0]); widths=[width/n]*n
        if n==2:widths=[156,width-156]
        elif n==3:widths=[39,55,width-94]
        elif n==4:widths=[218,70,65,width-353]
        table=Table([[paragraph(c,'head' if j==0 else 'cell') for c in row] for j,row in enumerate(rows)],colWidths=widths,repeatRows=1,hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),navy),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#f1f5f7'),colors.white]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,-1),(-1,-1),0.5,colors.HexColor('#d0dbe1'))]))
        story.extend([table,Spacer(1,9)]);continue
    bullet=re.match(r'^(?:- |(\d+)\. )(.*)',line)
    if bullet:
        story.append(paragraph(bullet.group(2),'bullet',bulletText=(bullet.group(1)+'.') if bullet.group(1) else '•'));i+=1;continue
    texts=[line];i+=1
    while i<len(lines) and lines[i].strip() and not lines[i].strip().startswith(('#','|','- ')):
        texts.append(lines[i].strip());i+=1
    story.append(paragraph(' '.join(texts)))

story.append(PageBreak());story.append(paragraph('Browser result captures','h2'))
for side,seed,score in [('US',941119,-23),('BR',941120,8)]:
    p=src.parent/'evidence/browser'/f'chrome-{side}-result.jpg'
    if p.exists():
        from PIL import Image as PILImage
        with PILImage.open(p) as im:w,h=im.size
        image_width=425
        story.append(KeepTogether([paragraph(f'{side} campaign · seed {seed} · score {score:+d} · exported state matched exactly','caption'),Image(str(p),width=image_width,height=h*image_width/w),Spacer(1,9)]))

def furniture(c,doc):
    c.saveState();w,h=letter
    c.setStrokeColor(gold);c.setLineWidth(1.3);c.line(44,h-30,w-44,h-30)
    c.setFont('Body',7.5);c.setFillColor(gray)
    c.drawString(44,24,'A Glorious Chance Solo · v0.2.11 · 19 November 2026')
    c.drawRightString(w-44,24,str(doc.page));c.restoreState()
doc=SimpleDocTemplate(str(dest),pagesize=letter,rightMargin=44,leftMargin=44,topMargin=44,bottomMargin=42,title='A Glorious Chance Solo v0.2.11 — Comprehensive audit, 19 November 2026',author='Codex',subject='One Medium and two Low findings; reproducible campaign and browser evidence')
doc.build(story,onFirstPage=furniture,onLaterPages=furniture)
print(dest)
