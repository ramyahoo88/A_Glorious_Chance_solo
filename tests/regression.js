// Regression tests for the v0.2.1 rules fixes (audit of v0.2.0, Nov 2026). node tests/regression.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'files.json'))).engine;
const src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n;\n') + '\n;installResume();';
const ctx = { console, Math, JSON, Object, Array, String, Number, Error };
vm.createContext(ctx); vm.runInContext(src, ctx);
const X = e => vm.runInContext(e, ctx);
let pass = 0, fail = 0;
const eq = (n, g, w) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++; else { fail++; console.log('FAIL', n, JSON.stringify(g), 'want', JSON.stringify(w)); } };
const ok = (n, cond, info) => eq(n + (info ? ` (${info})` : ''), !!cond, true);
const base = `s.lossesThisTurn=[]; s.troopsReturning={US:0,BR:0}; s.coastal={raids:[],battles:[],cutouts:[]}; s.targetRow=[]; s.pe=[]; s.convoyDeployed={US:null,BR:null}; s.eventsDrawn=[]; s.turnFlags={};`;
const drain = n => X(`run(${n}); var __g=0; while(${n}.prompt && __g++<80){ if(${n}.prompt.kind==='info') act(${n},'ok'); else break; }`);
const enc = (zone, ids) => `s.encounter={zone:'${zone}',kind:'normal',segment:'patrol',ships:{},side:{},struckBy:{},withdrawn:{US:false,BR:false},log:[]}; ${JSON.stringify(ids)}.forEach(id=>encAdd(s,id));`;

// F1 – 7.1 Upgrade Checks when the A.I. British break out (U.S. campaign); none under OA1
let up = 0, upOA1 = 0;
for (let seed = 1; seed <= 40; seed++) {
  for (const oa1 of [false, true]) {
    X(`var s=newGame('US',${seed},{oa1Upgrades:${oa1}}); s.turn=2; ${base} s.zones.KIN.blockade='US'; s.zones.KIN.control='US';
       newForce(s,'US','KIN','Patrol',['madison','oneida','tompkins','fairam','conquest']);
       s.calls=[{proc:'encounter',pc:'start',A:{zone:'KIN',kind:'breakout',breakoutSide:'BR',startAt:'event'},L:{}}]; run(s);`);
    const n = X(`['wolfe','rg','moira','beres'].filter(id=>s.ships[id].ver==='B').length`);
    if (oa1) upOA1 += n; else up += n;
  }
}
ok('F1 breakout Upgrade Checks happen', up > 40 && up < 120, `${up} of 160`);
eq('F1 no breakout Upgrade Checks under OA1', upOA1, 0);

// F2 – a Withdrawal takes ships that Disengaged in an earlier round
X(`var s=newGame('US',3); s.turn=2; ${base}
   newForce(s,'BR','NOR','Patrol',['wolfe','rg','moira']); newForce(s,'US','NOR','Patrol',['madison','oneida']);
   ${enc('NOR', ['wolfe', 'rg', 'moira', 'madison', 'oneida'])}
   s.ships.moira.steps=1; s.encounter.ships.moira='dis'; s.ships.rg.steps=2;
   doWithdrawal(s,'BR',['rg'],['rg']); resolveEncounterEnd(s);`);
eq('F2 earlier-Disengaged ship withdraws', X(`[s.ships.moira.box, s.ships.moira.zone]`), ['transit', null]);
eq('F2 ship that just failed its check stays', X(`[s.ships.rg.box, s.ships.rg.zone]`), ['lake', 'NOR']);
eq('F2 Engaged ship withdraws', X(`s.ships.wolfe.box`), 'transit');

// F3 – the human attacker gets the largest number of 2:1 matchups
X(`var s=newGame('BR',4); s.turn=2; ${base} newForce(s,'BR','NOR','Patrol',['wolfe','sss']); newForce(s,'US','NOR','Patrol',['tompkins','oneida']);
   ${enc('NOR', ['wolfe', 'sss', 'tompkins', 'oneida'])}`);
eq('F3 Wolfe(8)+Sir Sidney Smith(4) vs Tompkins(2)+Oneida(3)', X(`closeActionMatchups(s,['wolfe','sss'],['tompkins','oneida'],false).map(p=>p.join('-')).sort()`), ['sss-tompkins', 'wolfe-oneida']);
eq('F3 A.I. still picks by capture VP first (LC7c)', X(`closeActionMatchups(s,['wolfe','sss'],['tompkins','oneida'],true).map(p=>p.join('-'))`), ['wolfe-oneida', 'sss-tompkins']);

// F4 – 5.1 sudden death counts only ships that will really be Deployable on Sept II
const sd = (setup) => { X(`var s=newGame('US',5); s.turn=6; ${base} Object.values(s.ships).forEach(sh=>{ if(sh.owner==='BR'){ sh.box='sunk'; sh.zone=null; } }); ${setup} s.calls=[{proc:'turn',pc:'next',A:{},L:{}}]; run(s);`); return !!X('s.over'); };
eq('F4 Reduced ship In Transit only → game ends', sd(`s.ships.sss.box='transit'; s.ships.sss.steps=1;`), true);
eq('F4 repair-delayed ship only → game ends', sd(`s.ships.sss.box='repairing'; s.ships.sss.steps=1; s.ships.sss.delay=1;`), true);
eq('F4 ship repairing without delay → game continues', sd(`s.ships.sss.box='repairing'; s.ships.sss.steps=1;`), false);
eq('F4 laid-up ship (A.I. recommissions) → game continues', sd(`s.ships.sss.box='ordinary';`), false);
eq('F4 full-strength ship In Transit → game continues', sd(`s.ships.sss.box='transit';`), false);

// F5 – 14.2 Dual Blockade uses the A.I. Breakout test (Carronade in port vs blockaders)
const dual = (inPort) => {
  X(`var s=newGame('US',21); s.turn=3; ${base} s.troops.US.available=0;
     Object.values(s.ships).forEach(sh=>{ if(sh.owner==='BR' && ${JSON.stringify(inPort)}.indexOf(sh.id)<0) sh.box='sunk'; });
     s.ships.sss.owner='US'; s.ships.sss.box='deployable'; s.ships.pike.box='deployable'; s.ships.sylph.box='deployable';
     newForce(s,'US','KIN','Patrol',['madison','oneida','tompkins','fairam']); newForce(s,'US','YOR','Patrol',['pike','sylph','conquest','sss']);
     s.zones.KIN.control='US'; s.zones.YOR.control='US'; s.zones.KIN.blockade='US'; s.zones.YOR.blockade='US';
     s.calls=[{proc:'tally',pc:'start',A:{},L:{}}];`);
  drain('s'); return X('s.suddenDeath || null');
};
eq('F5 Wolfe alone (Car 4 vs 7) → U.S. Decisive Victory', dual(['wolfe']), 'US');
eq('F5 Wolfe + Royal George (Car 8 vs 7) → game goes on', dual(['wolfe', 'rg']), null);

// F6 – Commanding Breeze affects only its own Encounter
X(`var s=newGame('US',22); s.turn=2; ${base} newForce(s,'US','NOR','Patrol',['madison']); newForce(s,'BR','NOR','Patrol',['wolfe']);
   ${enc('NOR', ['madison', 'wolfe'])} applyLakeEvent(s,EVENTS[37],'NOR'); var during=!!s.zones.NOR.flags.breeze; resolveEncounterEnd(s); s.encounter=null;`);
eq('F6 Breeze active during, gone after', X(`[during, !!s.zones.NOR.flags.breeze]`), [true, false]);

// F7 – Close Action (Wolfe CA 8 vs Oneida CA 3): a hit defender that stays Engaged goes on to a Melee; a Disengaged one does not
let stayedN = 0, meleeOk = 0, disN = 0, disMelee = 0, hits = 0;
for (let seed = 1; seed <= 400; seed++) {
  X(`var s=newGame('US',${seed}); s.turn=2; ${base} newForce(s,'BR','NOR','Patrol',['wolfe']); newForce(s,'US','NOR','Patrol',['oneida','madison']);
     ${enc('NOR', ['wolfe', 'oneida', 'madison'])}
     s.combat={att:'BR',def:'US',seq:'B',pos:4,segment:'patrol',col:{US:['oneida','madison'],BR:['wolfe']},tows:{},tac:{att:null,def:null},gr:2,newSeq:false,roundAttackers:['wolfe'],openGaps:false};
     s.log=[]; s.calls=[{proc:'combat',pc:'ca2',A:{},L:{caAtt:['wolfe']},answer:'attack'}]; run(s); var L=s.log.map(x=>x.text);`);
  if (!X(`L.some(t=>/– HIT/.test(t))`)) continue;
  hits++;
  const st = X(`s.encounter.ships.oneida`), melee = X(`L.some(t=>/MELEE/.test(t))`);
  if (st === 'in' || st === 'cap') { stayedN++; if (melee) meleeOk++; }
  if (st === 'dis') { disN++; if (melee) disMelee++; }
}
ok('F7 sample has hits that stay Engaged', stayedN > 5 && disN > 5);
console.log(`  F7 sample: ${hits} hits, ${stayedN} stayed Engaged (all Meleed), ${disN} Disengaged`);
eq('F7 every hit-and-still-Engaged defender is Meleed', meleeOk, stayedN);
eq('F7 no Melee after a successful Disengagement', disMelee, 0);

// F8 – British campaign: "Attack British Convoy" only in Enemy Operations; U.S. campaign unchanged
X(`var s=newGame('BR',23); s.turn=0; ${base} s.convoys.BR[0]={real:true,revealed:true,delay:false,deployed:false,result:null}; s.convoys.BR[1]={real:false,revealed:true};`);
eq('F8 British campaign, Lake Action', X(`effectiveMission(s,TARGET_CARDS['B21'],'lake').mission`), 'Patrol');
eq('F8 British campaign, Enemy Operations', X(`effectiveMission(s,TARGET_CARDS['B21'],'enemy').mission`), 'AttackConvoy');
X(`var s=newGame('US',23); s.turn=0; ${base} s.convoys.US[0]={real:true,revealed:true,delay:false,deployed:false,result:null}; s.convoys.US[1]={real:false,revealed:true};`);
eq('F8 U.S. campaign, Lake Action unchanged', X(`effectiveMission(s,TARGET_CARDS['A31'],'lake').mission`), 'AttackConvoy');

// F9 – 9.1.2: no Convoy Encounter while the Sacket's Lake Zone is Blockaded
X(`var s=newGame('BR',24); s.turn=1; ${base} s.convoys.US[1]={real:true,revealed:false,delay:false,deployed:false,result:null};`);
eq('F9 Escort card, no Blockade', X(`effectiveMission(s,TARGET_CARDS['B2'],'lake').mission`), 'Escort');
X(`s.zones.SAC.blockade='BR'; s.zones.SAC.control='BR';`);
eq("F9 Escort card, Sacket's Blockaded", X(`effectiveMission(s,TARGET_CARDS['B2'],'lake').mission`), 'Patrol');

// R1 – unmaintained Blockade: no blockaders on station → the Convoy runs on schedule (player ruling)
X(`var s=newGame('US',11); s.turn=2; ${base} s.troops.US.available=0; s.zones.SAC.blockade='BR'; s.zones.SAC.control='BR';
   s.convoys.US[2]={real:true,revealed:true,delay:false,deployed:false,result:null}; s.convoys.US[3]={real:false,revealed:true};
   s.calls=[{proc:'turn',pc:'D1',A:{},L:{}}];`); drain('s');
eq('R1 no blockaders: Blockade lapses, Convoy +2 this turn', X(`[s.zones.SAC.blockade, s.supply.US, s.pendingConvoy.US.length]`), [null, 3, 0]);
X(`var s=newGame('US',12); s.turn=2; ${base} s.troops.US.available=0; s.zones.SAC.blockade='BR'; s.zones.SAC.control='BR';
   newForce(s,'BR','SAC','Patrol',['wolfe']);
   s.convoys.US[2]={real:true,revealed:true,delay:false,deployed:false,result:null}; s.convoys.US[3]={real:false,revealed:true};
   s.calls=[{proc:'turn',pc:'D1',A:{},L:{}}]; run(s);`);
eq('R1 blockader present: you are asked to break out', X(`s.prompt && s.prompt.title`), 'D Breakout Attack?');
X(`act(s,'pass');`);
eq('R1 …and passing delays the Convoy', X(`s.convoys.US[2].delay`), true);
X(`var s=newGame('BR',13); s.turn=2; ${base} s.troops.BR.available=0; s.zones.SAC.blockade='BR'; s.zones.SAC.control='BR';
   s.convoys.US[2]={real:true,revealed:false,delay:false,deployed:false,result:null}; s.convoys.US[3]={real:false,revealed:false};
   s.calls=[{proc:'turn',pc:'D1',A:{},L:{}}]; run(s);`);
eq('R1 A.I. side: no blockaders → A.I. Convoy not delayed', X(`!!s.convoys.US[2].delay`), false);

// ===== v0.2.2: findings from the independent audit of v0.2.1 (G01–G10) =====
const sayNull = `function(){}`;

// G01 – a Scattered Convoy is delayed, not lost (Living Playbook p.16-17)
X(`var s=newGame('US',1); ${base} s.supply.US=1; s.turn=0; s.convoys.US[0]={real:true,revealed:true,delay:false,deployed:true,result:'S'}; s.convoys.US[1]={real:false,revealed:true};
   convoySupply(s,'US',${sayNull}); var g1a=s.supply.US; s.pendingConvoy.US.forEach(p=>{ if(p.status==='delayed' && !isBlockaded(s,'US')) p.status='arrived'; });
   s.turn=1; convoySupply(s,'US',${sayNull});`);
eq('G01 Scattered Convoy: no advance that turn, +2 the next', X(`[g1a, s.supply.US, s.pendingConvoy.US.length]`), [1, 3, 0]);
X(`var s=newGame('US',1); ${base} s.supply.US=1; s.turn=0; s.convoys.US[0]={real:true,revealed:true,result:'D'}; convoySupply(s,'US',${sayNull});`);
eq('G01 Destroyed Convoy stays lost', X(`[s.supply.US, s.pendingConvoy.US.length]`), [1, 0]);

// G02 – return fire on the attacker only hits ships attacking in this Round (Reduced Wolfe stays behind)
let g2wolfe = 0, g2rg = 0, g2col = 0;
for (let seed = 1; seed <= 30; seed++) {
  X(`var s=newGame('BR',${seed}); s.turn=2; ${base} newForce(s,'BR','NOR','Patrol',['wolfe','rg']); newForce(s,'US','NOR','Patrol',['pike']); s.ships.wolfe.steps=2;
     ${enc('NOR', ['wolfe', 'rg', 'pike'])}
     s.combat={att:'BR',def:'US',seq:'B',pos:1,segment:'patrol',col:{BR:['wolfe','rg'],US:['pike']},tows:{},tac:{att:null,def:null},gr:1,newSeq:false,roundAttackers:['rg']};
     s.log=[]; s.calls=[{proc:'combat',pc:'grApply',A:{},L:{st:'GR2',txt:'test',res:{aHits:1,dHits:0}}}]; run(s);`);
  if (X(`s.ships.wolfe.steps`) !== 2) g2wolfe++;
  if (X(`s.ships.rg.steps`) < 3) g2rg++;
  if (X(`s.log.some(l=>l.text.indexOf('hit distribution (1-ship column')>=0)`)) g2col++;
}
eq('G02 Reduced Wolfe (not attacking) never hit; Royal George always hit; 1-ship column', [g2wolfe, g2rg, g2col], [0, 30, 30]);

// G03 – printed Hit Distribution columns 13-18 (British Living Rulebook p.32)
eq('G03 13 ships, roll 12 → #2', X(`hitPosition(13,1,2)`), 2);
eq('G03 13 ships, roll 11 → #1; 66 → #13', X(`[hitPosition(13,1,1),hitPosition(13,6,6)]`), [1, 13]);
eq('G03 14 ships, rolls 65/66 → #13/#14', X(`[hitPosition(14,6,5),hitPosition(14,6,6)]`), [13, 14]);
eq('G03 15 ships, roll 31 → #7 (four-roll block)', X(`hitPosition(15,3,1)`), 7);
eq('G03 18 ships, rolls 11/12/66 → #1/#1/#18', X(`[hitPosition(18,1,1),hitPosition(18,1,2),hitPosition(18,6,6)]`), [1, 1, 18]);

// G04 – Intelligence benefits one Encounter with the enemy Flagship, then is used up
X(`var s=newGame('US',1); s.turn=2; ${base} s.intelligence.US={card:29,until:2};
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['rg']); ${enc('NOR', ['oneida', 'rg'])}
   var g4a=intelligenceApplies(s,'US'); resolveEncounterEnd(s); s.encounter=null; var g4b=!!s.intelligence.US;`);
eq('G04 Encounter without the enemy Flagship: not used, still held', X(`[g4a, g4b]`), [false, true]);
X(`newForce(s,'BR','YOR','Patrol',['wolfe']); newForce(s,'US','YOR','Patrol',['madison']); ${enc('YOR', ['wolfe', 'madison'])}
   var g4c=intelligenceApplies(s,'US'); resolveEncounterEnd(s); s.encounter=null;
   newForce(s,'BR','SOU','Patrol',['moira']); newForce(s,'US','SOU','Patrol',['tompkins']); s.flagship.BR='moira'; ${enc('SOU', ['moira', 'tompkins'])}`);
eq('G04 used in the Encounter with Wolfe, gone for the next', X(`[g4c, s.intelligence.US, intelligenceApplies(s,'US')]`), [true, null, false]);

// G05 – Intelligence cancels the negative distance DRM but keeps Fair Wind
eq('G05 reactionDRM(distance 2, wind +2, Intelligence) = +3', X(`reactionDRM(2,2,true)`), 3);
eq('G05 without Intelligence = 0; same zone with Intelligence = +2', X(`[reactionDRM(2,2,false), reactionDRM(0,0,true), reactionDRM(1,0,true)]`), [0, 2, 1]);
X(`var s=newGame('BR',1); s.turn=2; ${base} s.intelligence.BR={card:29,until:2}; s.flagship.US='oneida'; s.zones.NOR.event=8;
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']); ${enc('NOR', ['oneida', 'wolfe'])}
   var g5=humanReactionCandidates(s).find(c=>c.key==='home');`);
eq('G05 Kingston ships reacting into North Lake with Fair Wind + Intelligence: DRM', X(`g5 && g5.drm`), 3);

// G07 – a Reduced Flagship that has just Disengaged can still shift the flag (Playbook p.19)
X(`var s=newGame('BR',1); s.turn=2; ${base} newForce(s,'BR','NOR','Patrol',['wolfe','rg']); newForce(s,'US','NOR','Patrol',['madison']);
   ${enc('NOR', ['wolfe', 'rg', 'madison'])} s.ships.wolfe.steps=2; s.encounter.ships.wolfe='dis';
   s.combat={att:'US',def:'BR',seq:'A',pos:0,col:{BR:['wolfe','rg'],US:['madison']},tows:{},tac:{att:null,def:null},gr:1};`);
eq('G07 just-Disengaged Flagship may transfer to adjacent Royal George', X(`flagTransferOptions(s,'BR')`), ['rg']);
X(`s.leader.BR.wounded=true;`);
eq('G07 …but not if the Leader is wounded', X(`flagTransferOptions(s,'BR')`), []);

// G08 – Troops are whole markers
X(`var s=newGame('BR',2); s.turn=1; ${base} s.troops.BR.available=2; var pa=buildAssignPrompt(s);`);
eq('G08 1.5 Troops refused', X(`validateAssignment(s,pa,{flagship:'wolfe',forces:[{zone:'NIA',mission:'ArmySupport',ships:['wolfe'],troops:1.5}]})`), 'Troops must be a whole number of markers');
eq('G08 2 Troops accepted', X(`validateAssignment(s,pa,{flagship:'wolfe',forces:[{zone:'NIA',mission:'ArmySupport',ships:['wolfe'],troops:2}]})`), null);
eq('G08 Land Battle lookup survives a stray fraction', X(`lbLookup(0,1.5,0,35).troops`), 1);

// G09 – a W result still lets a human Force whose ships have all Disengaged withdraw
X(`var s=newGame('US',1); s.turn=2; ${base} newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']);
   ${enc('NOR', ['oneida', 'wolfe'])} s.ships.oneida.steps=1; s.encounter.ships.oneida='dis';
   s.combat={att:'BR',def:'US',seq:'B',pos:1,col:{BR:['wolfe'],US:[]},tows:{},tac:{att:null,def:null},gr:1};
   s.calls=[{proc:'combat',pc:'withdraw',A:{},L:{wQueue:['US'],lines:['test'],failedDis:{US:[],BR:[]},hit:{US:['oneida'],BR:[]}}}]; run(s);`);
eq('G09 Withdrawal choice offered', X(`s.prompt && s.prompt.title`), 'Withdrawal result against you');
X(`act(s,'withdraw'); resolveEncounterEnd(s);`);
eq('G09 …and Oneida goes to In Transit', X(`s.ships.oneida.box`), 'transit');

// G10 – the lineup preview and the first Round use the same ships (Missed Signal)
X(`var s=newGame('US',1); s.turn=2; ${base} newForce(s,'US','NOR','Patrol',['madison','oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']);
   ${enc('NOR', ['madison', 'oneida', 'wolfe'])} s.zones.NOR.flags.missedSignal='madison';`);
eq('G10 Missed Signal ship known before the attack', X(`missedSignalShip(s)`), 'madison');
X(`s.combat={att:'US',def:'BR',seq:'A',pos:0,segment:'patrol',col:{US:[],BR:[]},tows:{},tac:{att:null,def:null},gr:0,newSeq:false,roundAttackers:[]};
   s.calls=[{proc:'combat',pc:'assemble2',A:{},L:{},answer:{attackers:['madison','oneida'],tows:{}}}]; run(s);`);
eq('G10 …and she is the one left out of the first Round', X(`[s.combat.col.US, s.combat.sitting && s.combat.sitting.id, missedSignalShip(s)]`), [['oneida'], 'madison', null]);

// ===== v0.2.3: re-audit of v0.2.2 (R01 save validation, R02 Intelligence lifetime) =====
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8'), ctx);   // checkSaveState
const refused = code => X(`(function(){ try { checkSaveState(${code}); return 'accepted'; } catch (e) { return 'refused'; } })()`);
X(`var g=newGame('US',181123); run(g); var __n=0; while(g.prompt && g.prompt.kind==='info' && __n++<20) act(g,'ok'); var gtxt=JSON.stringify(g);`);
eq('R01 a valid mid-game save is accepted', refused(`JSON.parse(gtxt)`), 'accepted');
eq('R01 unknown procedure step refused', refused(`(function(){ var x=JSON.parse(gtxt); x.calls[x.calls.length-1].pc='__audit_missing_handler__'; return x; })()`), 'refused');
eq('R01 Madison with 999 steps refused', refused(`(function(){ var x=JSON.parse(gtxt); x.ships.madison.steps=999; return x; })()`), 'refused');
eq('R01 Convoy Supply 13 refused', refused(`(function(){ var x=JSON.parse(gtxt); x.supply.US=13; return x; })()`), 'refused');
eq('R01 unknown ship box refused', refused(`(function(){ var x=JSON.parse(gtxt); x.ships.oneida.box='attic'; return x; })()`), 'refused');
eq('R01 unknown ship refused', refused(`(function(){ var x=JSON.parse(gtxt); x.ships.nautilus=Object.assign({},x.ships.oneida,{id:'nautilus'}); return x; })()`), 'refused');
eq('R01 fractional VP refused', refused(`(function(){ var x=JSON.parse(gtxt); x.vp.US=1.5; return x; })()`), 'refused');

// R02a – Pursuit starts a new Encounter: the one that just ended uses up Intelligence first
X(`var s=newGame('US',1); s.turn=2; ${base} s.intelligence.US={card:29,until:2};
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']); ${enc('NOR', ['oneida', 'wolfe'])}
   s.zones.NOR.flags.breeze=true; var r2a=intelligenceApplies(s,'US');
   s.calls=[{proc:'encounter',pc:'afterCombat',A:{zone:'NOR',kind:'normal'},L:{},ret:{outcome:'pursuit'}}]; run(s);`);
eq('R02a Intelligence used by the pursued Encounter; Breeze ended; new Encounter under way', X(`[r2a, s.intelligence.US, !!s.zones.NOR.flags.breeze, !!s.encounter]`), [true, null, false, true]);
// R02b – an Encounter saved by 0.2.1 (no flagIn record) still uses Intelligence up
X(`var s=newGame('US',1); s.turn=2; ${base} s.intelligence.US={card:29,until:2};
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']); ${enc('NOR', ['oneida', 'wolfe'])}
   delete s.encounter.flagIn; var old=JSON.parse(JSON.stringify(s)); old.calls=[]; old.prompt=null; checkSaveState(old); var mig=old.encounter.flagIn;
   resolveEncounterEnd(s);`);
eq('R02b old save: flag record rebuilt on load, and Intelligence used at the end', X(`[mig && mig.BR, s.intelligence.US]`), [true, null]);
// R02c – drawn this turn (Coastal Action Phase): neither applies to nor is used by an Encounter until next turn
X(`var s=newGame('US',1); s.turn=2; ${base} s.intelligence.US={card:29,until:3};
   newForce(s,'US','NOR','Patrol',['oneida']); newForce(s,'BR','NOR','Patrol',['wolfe']); ${enc('NOR', ['oneida', 'wolfe'])}
   var r2c=intelligenceApplies(s,'US'); resolveEncounterEnd(s);`);
eq('R02c same-turn Encounter: not applied, still held for next turn', X(`[r2c, s.intelligence.US && s.intelligence.US.until]`), [false, 3]);

console.log(`regression tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
