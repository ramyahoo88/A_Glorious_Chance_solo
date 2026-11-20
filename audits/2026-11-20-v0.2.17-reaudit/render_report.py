"""Render the audit's Markdown report as a readable, linked PDF."""
from pathlib import Path
import re,html,textwrap
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,LongTable,TableStyle,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT
root=Path(__file__).resolve().parent
name='A_Glorious_Chance_v0.2.17_Comprehensive_Reaudit'
pdfmetrics.registerFont(TTFont('Audit','/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf'))
pdfmetrics.registerFont(TTFont('Audit-Bold','/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf'))
pdfmetrics.registerFont(TTFont('Audit-Italic','/usr/share/fonts/truetype/ubuntu/Ubuntu-RI.ttf'))
pdfmetrics.registerFont(TTFont('Audit-Mono','/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf'))
pdfmetrics.registerFontFamily('Audit',normal='Audit',bold='Audit-Bold',italic='Audit-Italic',boldItalic='Audit-Bold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyAudit',fontName='Audit',fontSize=9.6,leading=13.5,spaceAfter=7.5,textColor=colors.HexColor('#253247')))
styles.add(ParagraphStyle(name='TitleAudit',fontName='Audit-Bold',fontSize=21,leading=25,spaceAfter=15,textColor=colors.HexColor('#173d5e')))
styles.add(ParagraphStyle(name='HeadAudit',fontName='Audit-Bold',fontSize=13,leading=17,spaceBefore=14,spaceAfter=7,keepWithNext=True,textColor=colors.HexColor('#173d5e')))
styles.add(ParagraphStyle(name='TableAudit',parent=styles['BodyAudit'],fontSize=8.3,leading=11.1,spaceAfter=0))
styles.add(ParagraphStyle(name='CodeAudit',fontName='Audit-Mono',fontSize=8,leading=10,spaceAfter=3,backColor=colors.HexColor('#f3f5f8')))
def inline(t):
 t=html.escape(t)
 t=re.sub(r'`([^`]+)`',r'<font name="Audit-Mono">\1</font>',t)
 t=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',t)
 t=re.sub(r'(https://[^\s<>]+)',lambda m:'<link href="'+m.group(1)+'" color="#245b86">'+m.group(1)+'</link>',t)
 return t
story=[];lines=(root/(name+'.md')).read_text().splitlines();i=0
while i<len(lines):
 line=lines[i];i+=1
 if not line.strip():continue
 if line.startswith('# '):story.append(Paragraph(inline(line[2:]),styles['TitleAudit']));continue
 if line.startswith('## '):story.append(Paragraph(inline(line[3:]),styles['HeadAudit']));continue
 if line.startswith('```'):
  while i<len(lines) and not lines[i].startswith('```'):
   for row in textwrap.wrap(lines[i],width=112,break_long_words=True,break_on_hyphens=False) or [' ']:story.append(Paragraph(html.escape(row),styles['CodeAudit']))
   i+=1
  i+=1;story.append(Spacer(1,5));continue
 if line.startswith('|'):
  rows=[line]
  while i<len(lines) and lines[i].startswith('|'):rows.append(lines[i]);i+=1
  rows=[r for r in rows if not re.match(r'^\|[\s:|-]+\|$',r)]
  cells=[[Paragraph(inline(c.strip()),styles['TableAudit']) for c in r.strip('|').split('|')]for r in rows]
  widths=[34,53,207,210] if len(cells[0])==4 else [121,383]
  table=LongTable(cells,colWidths=widths,repeatRows=1,hAlign='LEFT',splitInRow=True)
  table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e5edf4')),('BACKGROUND',(0,1),(-1,-1),colors.HexColor('#fafbfc')),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,0),0.7,colors.HexColor('#8aa1b5')),('LINEBELOW',(0,1),(-1,-1),0.25,colors.HexColor('#dce3e9'))]))
  story.extend([table,Spacer(1,8)]);continue
 if line.startswith('- '):story.append(Paragraph(inline(line[2:]),styles['BodyAudit'],bulletText='-'));continue
 para=[line]
 while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','|','```','- ')):para.append(lines[i]);i+=1
 story.append(Paragraph(inline(' '.join(para)),styles['BodyAudit']))
def page(canvas,doc):
 canvas.saveState();canvas.setStrokeColor(colors.HexColor('#bdcbd6'));canvas.line(54,752,558,752)
 canvas.setFont('Audit',8);canvas.setFillColor(colors.HexColor('#52647a'));canvas.drawString(54,762,'A GLORIOUS CHANCE  /  v0.2.17 RE-AUDIT');canvas.drawRightString(558,762,'20 NOVEMBER 2026')
 canvas.drawString(54,28,'Audited 4980c08 | Application unchanged');canvas.drawRightString(558,28,f'{doc.page}');canvas.restoreState()
SimpleDocTemplate(str(root/(name+'.pdf')),pagesize=(612,792),rightMargin=54,leftMargin=54,topMargin=56,bottomMargin=48,title='A Glorious Chance v0.2.17 - Comprehensive Re-audit',author='Astra / Codex').build(story,onFirstPage=page,onLaterPages=page)
print(root/(name+'.pdf'))
