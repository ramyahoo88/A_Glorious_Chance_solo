"""Render the audit Markdown to a readable PDF; no app files are changed."""
from pathlib import Path
import re
from html import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

root=Path(__file__).resolve().parent.parent
base=root/'A_Glorious_Chance_v0.2.16_Comprehensive_Reaudit'
fonts=Path('/usr/share/fonts/truetype/dejavu')
for name,file in [('Audit','DejaVuSans.ttf'),('Audit-Bold','DejaVuSans-Bold.ttf'),('Audit-Italic','DejaVuSans-Oblique.ttf'),('AuditMono','DejaVuSansMono.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(fonts/file)))
pdfmetrics.registerFontFamily('Audit',normal='Audit',bold='Audit-Bold',italic='Audit-Italic',boldItalic='Audit-Bold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyAudit',fontName='Audit',fontSize=9.3,leading=13.8,spaceAfter=7,textColor=colors.HexColor('#253444')))
styles.add(ParagraphStyle(name='TitleAudit',fontName='Audit-Bold',fontSize=20,leading=25,spaceAfter=14,textColor=colors.HexColor('#153854')))
styles.add(ParagraphStyle(name='H2Audit',fontName='Audit-Bold',fontSize=13,leading=18,spaceBefore=13,spaceAfter=7,keepWithNext=True,textColor=colors.HexColor('#153854')))
styles.add(ParagraphStyle(name='H3Audit',fontName='Audit-Bold',fontSize=10.8,leading=15,spaceBefore=10,spaceAfter=6,keepWithNext=True,textColor=colors.HexColor('#153854')))
styles.add(ParagraphStyle(name='CellAudit',parent=styles['BodyAudit'],fontSize=8.1,leading=11.4,spaceAfter=0))
styles.add(ParagraphStyle(name='BulletAudit',parent=styles['BodyAudit'],leftIndent=12,firstLineIndent=-8))
def inline(s):
    s=escape(s)
    s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',lambda m:'<link href="'+m[2]+'" color="#21618c">'+m[1]+'</link>',s)
    s=re.sub(r'`([^`]+)`',r'<font name="AuditMono" size="7.8">\1</font>',s)
    return re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',s)
lines=Path(str(base)+'.md').read_text().splitlines();story=[];i=0
while i<len(lines):
    s=lines[i].strip()
    if not s:i+=1;continue
    if s.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            cells=[v.strip() for v in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r'[-: ]+',v) for v in cells):rows.append([Paragraph(inline(v),styles['CellAudit']) for v in cells])
            i+=1
        n=len(rows[0]);widths={2:[124,380],3:[165,129,210],4:[29,48,211,216]}[n]
        table=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e5edf3')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),0.7,colors.HexColor('#7b99ac')),('LINEBELOW',(0,1),(-1,-1),0.3,colors.HexColor('#d0dce4')),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
        story.extend([table,Spacer(1,8)]);continue
    if s.startswith('# '):style='TitleAudit';s=s[2:]
    elif s.startswith('## '):style='H2Audit';s=s[3:]
    elif s.startswith('### '):style='H3Audit';s=s[4:]
    elif s.startswith('- '):style='BulletAudit';s='- '+s[2:]
    else:style='BodyAudit'
    story.append(Paragraph(inline(s),styles[style]));i+=1
    if style=='H2Audit':story.append(Spacer(1,0.1))
def page(c,doc):
    c.saveState();w,h=doc.pagesize
    c.setStrokeColor(colors.HexColor('#c6d4df'));c.line(48,43,w-48,43)
    c.setFont('Audit',7.5);c.setFillColor(colors.HexColor('#5b7081'))
    c.drawString(48,30,'A Glorious Chance | v0.2.16 re-audit | 19 November 2026')
    c.drawRightString(w-48,30,str(doc.page));c.restoreState()
doc=SimpleDocTemplate(str(Path(str(base)+'.pdf')),pagesize=(600,792),leftMargin=48,rightMargin=48,topMargin=43,bottomMargin=58,title='A Glorious Chance v0.2.16 - Comprehensive Re-audit',author='OpenAI - Codex audit')
doc.build(story,onFirstPage=page,onLaterPages=page)
print(Path(str(base)+'.pdf'))
