// Unit tests for data tables and core rules arithmetic (node tests/unit.js)
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'files.json'))).engine;
const src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n;\n') + '\n;installResume();';
const ctx = { console, Math, JSON, Object, Array, String, Number, Error };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const X = (expr) => vm.runInContext(expr, ctx);

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
}

// --- Data integrity
eq('ship count', X('SHIP_DEFS.length'), 26);
eq('A deck size', X("Object.values(TARGET_CARDS).filter(c=>c.deck==='A').length"), 54);
eq('B deck size', X("Object.values(TARGET_CARDS).filter(c=>c.deck==='B').length"), 50);
eq('A deck final-turn symbols (rule A9: 15)', X("Object.values(TARGET_CARDS).filter(c=>c.deck==='A'&&c.lastTurn).length"), 15);
eq('A deck hourglass symbols (rule A9: 11)', X("Object.values(TARGET_CARDS).filter(c=>c.deck==='A'&&c.isolated).length"), 11);
eq('events', X('Object.keys(EVENTS).length'), 38);
eq('spyglass cards', X('Object.values(EVENTS).filter(e=>e.spy).length'), 20);
eq('tactics', X('TACTICS.length'), 20);
eq('hit table sums', X('Object.keys(HIT_DIST).every(k=>HIT_DIST[k].reduce((a,b)=>a+b,0)===36 && HIT_DIST[k].length===+k)'), true);
eq('CRT shape', X('CRT.length===10 && CRT.every(r=>r.length===7)'), true);
eq('Grid shapes', X("Object.values(TARGET_CARDS).every(c=>c.grid.length===4 && c.grid.every(r=>r.length===7))"), true);
eq('B grid values are packages 0..11', X("Object.values(TARGET_CARDS).filter(c=>c.deck==='B').every(c=>c.grid.every(r=>r.every(v=>v>=0&&v<=11)))"), true);

// --- Hit distribution examples (rulebook p.32, playbook p.14)
eq('3 ships roll 16', X('hitPosition(3,1,6)'), 1);
eq('3 ships roll 23', X('hitPosition(3,2,3)'), 1);
eq('3 ships roll 44', X('hitPosition(3,4,4)'), 2);
eq('8 ships roll 12', X('hitPosition(8,1,2)'), 1);
eq('8 ships roll 46', X('hitPosition(8,4,6)'), 6);
eq('4 ships roll 11', X('hitPosition(4,1,1)'), 1);
eq('11 ships roll 66', X('hitPosition(11,6,6)'), 11);

// --- CRT columns (rounding down)
eq('2.47 → 2:1', X('CRT_COLS[crtColumnForRatio(18.5/7.5)]'), '2:1');
eq('1.0 → 1:1', X('CRT_COLS[crtColumnForRatio(1)]'), '1:1');
eq('0.66 → 1:2-', X('CRT_COLS[crtColumnForRatio(0.66)]'), '1:2-');
eq('2/3 → 1:1.5', X('CRT_COLS[crtColumnForRatio(2/3)]'), '1:1.5');
eq('5 → 3:1+', X('CRT_COLS[crtColumnForRatio(5)]'), '3:1+');
eq('parse A1/D3W', X("parseCrt('A1/D3W')"), { aHits: 1, dHits: 3, aW: false, dW: true, end: false, code: 'A1/D3W' });

// --- Gunnery strengths (rulebook p.30 and playbook p.13 examples)
X("var s0 = newGame('US', 7); ");
eq('British attack, Wolfe A + RG A + SSS', X("sideStrength(s0,['wolfe','rg','sss'],'BR',false)"), 18.5);
eq('…vs Oneida, Hamilton, Conquest', X("sideStrength(s0,['oneida','hamilton','conquest'],'BR',false)"), 7.5);
X("s0.ships.wolfe.ver='B'; s0.ships.rg.ver='B'; s0.ships.moira.ver='B'; s0.ships.beres.ver='B';");
eq('Playbook: Wolfe B, RG B, Moira B, Beresford B attack = 28', X("sideStrength(s0,['wolfe','rg','moira','beres'],'BR',false)"), 28);
eq('Playbook: 8 U.S. ships defend = 23', X("sideStrength(s0,['madison','oneida','tompkins','conquest','fairam','scourge','ontario','pert'],'BR',false)"), 23);

// --- Starting Naval Balance would be +12 (U.S. 106 vs British 94 if-captured VP)
X("var s1 = newGame('US', 9);");
eq('initial naval balance', X('computeNavalBalance(s1)'), 12);
eq('initial deployable CA US', X("sumBy(deployable(s1,'US'),ca)"), 13);
eq('initial deployable CA BR', X("sumBy(deployable(s1,'BR'),ca)"), 26);
eq('victory levels', X("[victoryLevel(-33),victoryLevel(-22),victoryLevel(-11),victoryLevel(0),victoryLevel(11),victoryLevel(22),victoryLevel(33)]"),
  ['British Decisive Victory', 'British Victory', 'British Marginal Victory', 'Draw', 'U.S. Marginal Victory', 'U.S. Victory', 'U.S. Decisive Victory']);
eq('zone distances', X("[zoneDistance('NOR','SAC'), zoneDistance('NOR','SOU'), zoneDistance('YOR','SAC')]"), [2, 1, 3]);
eq('clockwise', X("[clockwiseOf('SAC'), clockwiseOf('NOR'), counterClockwiseOf('YOR')]"), ['SOU', 'KIN', 'NIA']);
eq('naval balance bands', X('[-70,-69,-26,-25,-16,-15,15,16,25,26,59,60].map(navalBalanceBand)'), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
eq('AI troops markers 3 of 8', X("s1.aiTroops.track.filter(m=>m.troops).length + s1.aiTroops.box.filter(m=>m.troops).length"), 3);
eq('AI convoys one per month', X("[0,1,2,3].map(m=>(s1.convoys.BR[m*2].real?1:0)+(s1.convoys.BR[m*2+1].real?1:0))"), [1, 1, 1, 1]);

// --- Hits: a Fast ship passes its first Disengagement Check automatically; 3 hits on a 2-step ship → Strike check +1
X(`var s2 = newGame('BR', 11);
s2.encounter = { zone:'NOR', kind:'normal', ships:{}, side:{}, withdrawn:{US:false,BR:false} };
['sylph','oneida'].forEach(id=>{ s2.ships[id].box='lake'; s2.ships[id].zone='NOR'; s2.ships[id].steps=SHIP_BY_ID[id].full[4]; encAdd(s2,id); });
var lines2=[]; var r2 = applyHits(s2,'US',{sylph:1},{round:'GR'},lines2);`);
eq('fast ship auto-disengages', X("s2.encounter.ships.sylph"), 'dis');
eq('sylph reduced to 2 steps', X("s2.ships.sylph.steps"), 2);
X("var lines3=[]; applyHits(s2,'US',{oneida:3},{round:'GR'},lines3);");
eq('3 hits on 2-step ship → strike check with +1', X("lines3.some(l=>/Strike Check \\d+\\+1/.test(l))"), true);

// --- Target card spot checks (from card images)
eq('A1 grid', X("TARGET_CARDS.A1.grid"), ['0111010', '0011000', '1000101', '0000100']);
eq('B46 grid', X("TARGET_CARDS.B46.grid"), [[0, 0, 0, 0, 0, 0, 0], [0, 7, 0, 7, 0, 8, 0], [0, 7, 0, 8, 0, 7, 7], [8, 7, 0, 0, 7, 0, 7]]);
eq('A31 mission', X("[TARGET_CARDS.A31.zone, TARGET_CARDS.A31.mission, TARGET_CARDS.A31.secondary]"), ['SAC', 'Patrol', 'AttackConvoy']);
eq('B12 mission', X("[TARGET_CARDS.B12.zone, TARGET_CARDS.B12.mission, TARGET_CARDS.B12.secondary, TARGET_CARDS.B12.cond]"), ['YOR', 'Patrol', 'CuttingOut', 'secondaryIfBRTempHomeport']);


// --- Player Aid VII Land Battle Table: every column partitions 11-66 with no gaps or overlaps
X(`var D66 = []; for (let a=1;a<=6;a++) for (let b=1;b<=6;b++) D66.push(a*10+b);
var lbBad = [];
for (let band=0; band<5; band++) for (let tr=1; tr<=3; tr++) D66.forEach(v => {
  const hits = LB_TABLE[band][tr-1].filter(rg => rg && v>=rg[0] && v<=rg[1]).length;
  if (hits !== 1) lbBad.push(band+'/'+tr+'/'+v+':'+hits);
});`);
eq('land battle table partitions 11-66', X('lbBad'), []);
eq('LB 0 LG/1 Troops roll 44 = AS', X('lbLookup(0,1,0,44).result'), 'AS');
eq('LB 7-15/3 roll 64 = AF', X('lbLookup(10,3,0,64).result'), 'AF');
eq('LB 25+/1 roll 11 = DS', X('lbLookup(30,1,0,11).result'), 'DS');
eq('LB 16-24/1 shifted 1 left = 7-15/1 (rule example)', X('lbLookup(20,1,-1,56).colLabel'), '7 to 15 Long Gun / 1 Troops');
eq('LB shift below 0 stays at 0', X('lbLookup(3,2,-2,11).band'), 0);
eq('LB troops capped at 3', X('lbLookup(30,5,0,66).result'), 'AF');
eq('LB 0/3 misprint resolved: 62 = AS', X('lbLookup(0,3,0,62).result'), 'AS');

// --- Player Aid V Force Packages
X("var fp = newGame('BR', 21); var poolStart = deployable(fp,'US');");
eq('pkg 1 = all Main ships', X("forcePackageSelect(fp,1,poolStart).ships.sort()"), ['conquest', 'fairam', 'madison', 'oneida', 'tompkins']);
X("var p4 = forcePackageSelect(fp,4,poolStart); var p4s = p4.ships.map(id=>fp.ships[id]);");
eq('pkg 4 (16 LG): all 5 Mains (13 LG) + 2 Secondaries', X("[p4.ok, p4s.filter(isMain).length, p4s.filter(sh=>!isMain(sh)).length, sumBy(p4s,lg) >= 16]"), [true, 5, 2, true]);
eq('pkg 2 (28 LG) cannot be met at start (22 LG total)', X("forcePackageSelect(fp,2,poolStart).ok"), false);
eq('pkg 3 (22 LG) takes every ship with Long Gun', X("(function(){const r=forcePackageSelect(fp,3,poolStart); return [r.ok, sumBy(r.ships.map(id=>fp.ships[id]),lg)];})()"), [true, 22]);
eq('pkg 7 excludes Asp and Lady (no LG/CA)', X("forcePackageSelect(fp,7,poolStart).ships.filter(id=>id==='asp'||id==='lady').length"), 0);
eq('pkg 9 = Lady + Asp (0 CA, lowest LG)', X("forcePackageSelect(fp,9,poolStart).ships.sort()"), ['asp', 'lady']);
eq('pkg 10 = two Secondaries', X("(function(){const r=forcePackageSelect(fp,10,poolStart); return [r.ships.length, r.ships.every(id=>!isMain(fp.ships[id]))];})()"), [2, true]);
eq('pkg 11 = five steps of Secondaries', X("(function(){const r=forcePackageSelect(fp,11,poolStart); return sumBy(r.ships.map(id=>fp.ships[id]),sh=>sh.steps) >= 5 && r.ships.every(id=>!isMain(fp.ships[id]));})()"), true);
eq('pkg 8 needs AI Troops available', X("forcePackageSelect(fp,8,poolStart).ok"), false);
X("fp.aiTroops.box=[{troops:true,revealed:true}]; fp.ships.pike.box='deployable'; fp.ships.sylph.box='deployable'; var pool8 = deployable(fp,'US'); var p8 = forcePackageSelect(fp,8,pool8);");
eq('pkg 8 with Pike + Sylph: 1st Force is Gen. Pike alone (fewest Main ships for 8 CA)', X("p8.ships"), ['pike']);
eq('pkg 8 2nd Force ≥ 22 LG, disjoint', X("[sumBy(p8.ships2.map(id=>fp.ships[id]),lg)>=22, p8.ships2.indexOf('pike')<0]"), [true, true]);
X("fp.ships.lady.box='sunk'; var p9 = forcePackageSelect(fp,9,deployable(fp,'US'));");
eq('pkg 9 without Lady: two lowest-LG 0-CA Secondaries', X("p9.ships.map(id=>lg(fp.ships[id])).sort()"), [0, 1]);

console.log(`unit tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
