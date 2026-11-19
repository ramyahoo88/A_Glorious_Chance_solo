from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

here=Path(__file__).resolve().parent
out=here.parent/'A_Glorious_Chance_v0.2.14_Comprehensive_Reaudit.pdf'
fonts=Path('/usr/share/fonts/truetype/dejavu')
pdfmetrics.registerFont(TTFont('Audit',str(fonts/'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('AuditBold',str(fonts/'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFontFamily('Audit',normal='Audit',bold='AuditBold',italic='Audit',boldItalic='AuditBold')
styles={
 'title':ParagraphStyle('title',fontName='AuditBold',fontSize=21,leading=26,textColor=colors.HexColor('#173c55'),spaceAfter=12),
 'head':ParagraphStyle('head',fontName='AuditBold',fontSize=13,leading=17,textColor=colors.HexColor('#173c55'),spaceBefore=10,spaceAfter=7),
 'body':ParagraphStyle('body',fontName='Audit',fontSize=9.3,leading=13.1,spaceAfter=8),
 'small':ParagraphStyle('small',fontName='Audit',fontSize=8,leading=11,spaceAfter=6),
 'cell':ParagraphStyle('cell',fontName='Audit',fontSize=8.2,leading=11),
 'caption':ParagraphStyle('caption',fontName='Audit',fontSize=8,leading=11,textColor=colors.HexColor('#425563'),spaceAfter=7),
}
story=[]
def p(text,kind='body'):return Paragraph(text,styles[kind])
def add(text,kind='body'):story.append(p(text,kind))
def table(rows,widths,header=True):
 t=Table([[p(str(c),'cell') for c in row] for row in rows],colWidths=widths,hAlign='LEFT')
 cmds=[('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#cfdae1'))]
 if header:cmds += [('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e7eff4'))]
 t.setStyle(TableStyle(cmds));story.append(t);story.append(Spacer(1,9))
def screenshot(name,width):
 from PIL import Image as PILImage
 src=here/'browser'/name
 with PILImage.open(src) as img:w,h=img.size
 return Image(str(src),width=width,height=width*h/w)

add('A Glorious Chance<br/>v0.2.14 re-audit','title')
add('19 November 2026 | main c8073ddd7d639b0f0c68b64f6d319a711c5c2bea','small')
add('<b>Gameplay and persistence checks pass.</b> Recommend a corrective release for four display defects: <b>one Medium, three Low</b>. No Critical or High defect was confirmed. This audit changes no application code.','body')
table([
 ['ID / severity','Confirmed issue','Recommended correction'],
 ['A01 - Medium','Port dialogs show headings but omit all ships.','Append the ship grids and verify each displayed count.'],
 ['A02 - Low','Automatic sequences can skip intermediate movement in the report.','Record public movement at each completed movement boundary.'],
 ['A03 - Low','Shared badges overlap and crowded labels hide arrowheads.','Use actual label bounds and space badges/parallel routes.'],
 ['A04 - Low','Tracks overflow at a narrow desktop width.','Adapt the track layout to its available panel width.'],
 ],[86,218,208])
add('Verification','head')
add('<b>768 fresh gameplay campaigns</b> completed: 640 primary games across both sides and five purposeful policies, plus 128 option-grid games. All 6,144 Tallies matched independently reconstructed scoring. There were 3,549 exact saved-checkpoint continuations and 48 full save-to-end continuations.','body')
add('<b>128 additional paired map campaigns</b> preserved the entire game state after 12,381 actions; 892 map-save checks passed. Separate transition observation found the reporting defect in A02.','body')
add('<b>Two complete Chromium campaigns</b> passed through the visible controls: 207 actions, six Undo/replays, four reloads and ten map/focus checks. All 861 existing engine assertions, 200 smoke campaigns and ten DOM suites also passed.','body')
add('Live build and app download','head')
add('The live response, independent assembly and actual downloaded HTML match exactly: <b>394,415 bytes</b>. Engine and card/table data are unchanged from v0.2.13 apart from the version stamp.','body')
add('SHA-256: e8ad1b71f9a30710de520dec11c640b064e53768b3f7d3d52b8cdaa99a650f4e','small')

story.append(PageBreak())
add('A01 - port inspection omits ships','title')
add('<b>Medium.</b> Start a U.S. campaign with seed <b>973000</b> and tap Sacket\'s Harbor. The map reports <b>16 ships, 14 Deployable</b>; the dialog shows Deployable and Construction headings, with zero ship buttons. Kingston reports six ships and also displays none. Both Chromium and a separate DOM reproduction confirm it.','body')
story.append(screenshot('empty-port-390.png',250));story.append(Spacer(1,9))
add('Actual occupied-port dialog at 390 px. Existing full homeport lists on the board remain a usable workaround.','caption')
add('<b>Cause and correction:</b> ui_map.js line 49 passes two nodes to appendChild, which appends only the first. Use append or separate appendChild calls. The optional beached branch at line 41 has the same pattern. Add assertions for the actual ship buttons, not just headings.','body')
add('A02 - intermediate movement is omitted','head')
add('<b>Low.</b> In the natural seed <b>971000</b> position before action 38, notices are disabled. Oneida is assigned from Sacket\'s Harbor to <b>Niagara</b> for Army Support. The Separated Ships event then moves it from <b>Niagara to York</b> as a Patrol.','body')
add('The map records only <b>Sacket\'s Harbor to York, Patrol</b>. Final position and game logic are correct. Replaying the saved assignment through Chromium reproduces this exact omission; the log records the displacement.','body')
add('<b>Cause:</b> ui_table.js lines 119-122 snapshot around an entire act() call. Multiple internal procedure steps can happen before the next prompt. <b>28 actions</b> in the 128-game map sample lost intermediate steps. This is a test-sample count, not a forecast for human play.','body')
add('<b>Correction:</b> record ordered public movements at completed movement boundaries. Preserve them through grouping, saves and Undo. Test the exact path and mission changes as well as final-state equality.','body')

story.append(PageBreak())
add('A03 - route readability','title')
add('<b>Low.</b> Seed 971000 sends Patrol and Escort forces along the same route; badges 2 and 3 overlap. Seed 971012 has a crowded York panel that covers the incoming Escort arrowhead. Both examples also occur in the expanded map.','body')
t=Table([[screenshot('shared-routes-after-390.png',205),screenshot('crowded-390.png',205)]],colWidths=[256,256])
t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('ALIGN',(0,0),(-1,-1),'CENTER')]))
story.append(t)
add('Left: badges 2 and 3 share the short route above Sacket\'s Harbor. Right: the red incoming route disappears beneath York; its badge also crosses the Niagara label.','caption')
add('<b>Correction:</b> clip routes against rendered label rectangles, including wrapped text and status rows. Give shared routes and badges enough space. The current fixed height estimate and three repeating bend values cannot guarantee readability.','small')

story.append(PageBreak())
add('A04 - narrow desktop overflow','title')
add('<b>Low.</b> At a <b>1,024 px</b> viewport, the document is <b>1,057 px</b> wide. The British supply track extends to x=1,057.125; spaces 11 and 12 start beyond the visible right edge. This reproduces in all five tested natural positions at that width.','body')
add('The Tracks panel uses two columns with intrinsic minimum widths while the main page still uses its two-column desktop layout. Each supply row requires 236 px. This CSS predates the map release.','body')
add('<b>Correction:</b> switch Tracks to one column when its panel is too narrow, or use a panel-width rule. Test immediately above and below the 1,000 px main-layout breakpoint. Preserve the complete scale rather than hiding overflow.','body')
add('Q01 - make inspection easier to navigate','head')
add('From Map, a fleet opens its zone; a ship then opens its details. Close returns all the way to the board. Add <b>Back to map</b> / <b>Back to fleet</b>, retaining scroll position and keyboard focus. This is an optional usability improvement, not a game-state defect.','body')
add('Browser and scope details','head')
table([
 ['Case','Result'],
 ['U.S. 973001, fleet, 1440 px','110 actions; -22, British Victory.'],
 ['British 973002, coastal, 390 px, grouped','97 actions; +15, U.S. Marginal Victory.'],
 ['Map layouts','70 checks: five positions, seven widths, board and dialog.'],
 ['Privacy','Changing hidden markers or future decks leaves map HTML unchanged.'],
 ['Printed reference replay','648 hit-distribution checks, 70 combat cells, 60 scatter results, balance bands and 20 Tactic metadata records pass.'],
 ],[242,270])
add('These are rules and regression checks with purposeful legal policies, not optimal play or a balance study. Established printed-reference values were reused; this pass did not repeat full artwork transcription. Project rulings remain as documented in RULES_NOTES.md. Chromium viewport tests do not establish physical Android, Safari, Firefox or screen-reader speech behavior.','small')
add('Evidence and sources','head')
add('The accompanying evidence directory contains scripts, importable before/after saves, full measurements, browser traces and screenshots. See evidence/README.md for commands. The Markdown report has detailed file/line references and the complete verification totals.','small')
add('Publisher support: <link href="https://www.legionwargames.com/legion_AGC_GS.html" color="#215c80">legionwargames.com/legion_AGC_GS.html</link><br/>Audited source: <link href="https://github.com/ramyahoo88/A_Glorious_Chance_solo/commit/c8073ddd7d639b0f0c68b64f6d319a711c5c2bea" color="#215c80">ramyahoo88/A_Glorious_Chance_solo - c8073dd</link>','small')

def footer(c,doc):
 c.saveState();c.setStrokeColor(colors.HexColor('#ccd9e1'));c.line(50,40,562,40);c.setFont('Audit',8);c.setFillColor(colors.HexColor('#526674'));c.drawString(50,27,'A Glorious Chance | v0.2.14 re-audit | 19 November 2026');c.drawRightString(562,27,str(doc.page));c.restoreState()
doc=SimpleDocTemplate(str(out),pagesize=(612,792),rightMargin=50,leftMargin=50,topMargin=42,bottomMargin=53,title='A Glorious Chance v0.2.14 Comprehensive Re-audit',author='Codex')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(out)
