// Command odds use the actual A.I. attack selection, including omitted untowed schooners.
// Independent arithmetic: Pike 19 + Tompkins 4 = 23; Fair American adds 3.
// Wolfe B 10 + Royal George B 8 defend against the American attack.
// node tests/regression_v029_preview.js [checkout-to-test]
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const order=JSON.parse(fs.readFileSync(path.join(root,'tools/files.json'))).engine;
const ctx=vm.createContext({console,Math,JSON,Object,Array,String,Number,Error,Date});
vm.runInContext(order.map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n;\n')+'\ninstallResume();',ctx);
const X=code=>vm.runInContext(code,ctx);let passed=0,failed=0;
function check(name,actual,expected){try{assert.deepEqual(actual,expected);passed++;}catch(e){failed++;console.error('FAIL',name,'\n actual:',actual,'\n expected:',expected);}}
X(`function board(defenders=['wolfe','rg']) {
 const s=newGame('BR',612056);s.turn=5;s.lossesThisTurn=[];s.troopsReturning={US:0,BR:0};
 s.ships.wolfe.ver='B';s.ships.rg.ver='B';
 const h=newForce(s,'BR','NIA','Patrol',defenders),a=newForce(s,'US','NIA','Patrol',['pike','tompkins','fairam']);
 s.encounter={zone:'NIA',kind:'normal',segment:'patrol',ships:{},side:{},struckBy:{},withdrawn:{US:false,BR:false},leaderFate:{},humanForce:h.id,aiForce:a.id,wg:'US',wgCard:1,firstAttack:false};
 [...defenders,'pike','tompkins','fairam'].forEach(id=>encAdd(s,id));
 s.calls=[{proc:'encounter',pc:'command',L:{}}];s.prompt=null;return s;
}
var s=board(),before=JSON.stringify(s),summary=encSummary(s);`);
check('selected AI squadron preview uses 23 rather than all-ships 26',X("summary.includes('Odds if the A.I. attacks: 23 vs 18 = 1.28:1')"),true);
check('human all-full-strength preview stays 19.5 vs 17.5',X("summary.includes('Odds if you attack with all full-strength ships: 19.5 vs 17.5 = 1.11:1')"),true);
check('preview is pure including saved dice',X('JSON.stringify(s)===before'),true);
X('encSummary(s);encSummary(s);');
check('repeated preview leaves game/dice untouched',X('JSON.stringify(s)===before'),true);
X(`run(s);act(s,'confront');act(s,'ok');
for(let i=0;i<8&&!s.log.some(row=>row.text.startsWith('Gunnery Round 1:'));i++){
 if(!s.prompt)throw Error('Missing first round prompt');
 act(s,s.prompt.kind==='info'?'ok':s.prompt.options.find(o=>!o.disabled).id);
}`);
check('applied first round matches the independently calculated preview',X("s.log.some(row=>row.text.startsWith('Gunnery Round 1: U.S. 23 vs British 18 = 1.28:1'))"),true);
check('Fair American stays out of that attacking round',X("s.combat.roundAttackers.includes('fairam')"),false);
X("var sufficient=board(['wolfe']);var ample=encSummary(sufficient);");
check('adjacent sufficient-odds case keeps all three ships',X("ample.includes('Odds if the A.I. attacks: 26 vs 10 = 2.6:1')"),true);
X("var missed=board();missed.zones.NIA.flags.missedSignal='tompkins';var missing=encSummary(missed);");
check('Missed Signal replans Pike towing Fair American: 19 + 3 vs 18',X("missing.includes('Odds if the A.I. attacks: 22 vs 18 = 1.22:1')"),true);
check('Missed Signal selected tow omits the absent Tompkins',X("aiAttackDecision(missed,false).tows.pike"),'fairam');
check('Missed Signal first-round reminder remains',X("missing.includes('Gov. Tompkins missed the signal')"),true);
X("var haze=board(['sss']);haze.zones.NIA.flags.haze=true;var hazy=encSummary(haze);");
check('Haze still removes Long Guns from both preview forces',X("hazy.includes('Odds if the A.I. attacks: 9 vs 2 = 4.5:1')"),true);
check('Haze reminder remains',X("hazy.includes('Haze: no Long Guns')"),true);
X("var denied=board();denied.ships.pike.steps=2;var deniedBefore=JSON.stringify(denied),none=encSummary(denied);");
check('failed AI attack states that it would Pass',X("none.includes('the A.I. would Pass (attack preconditions not met)')"),true);
check('failed-plan preview leaves state and RNG unchanged',X('JSON.stringify(denied)===deniedBefore'),true);
X("denied.encounter.kind='breakout';denied.encounter.firstAttack=true;var breakout=encSummary(denied);");
check('first AI Breakout uses the granted precondition waiver',X("breakout.includes('Odds if the A.I. attacks: 7 vs 18 = 0.39:1')"),true);
// Events 19–21: a Patrol goes straight to Close Action, so Gunnery odds are not a Round preview.
// Printed counters: Wolfe B CA 8, Oneida CA 3 -> legal 2:1 matchup, hit on d10 <=5.
X(`var rain=newGame('BR',54);rain.turn=2;rain.calls=[];rain.prompt=null;rain.lossesThisTurn=[];rain.troopsReturning={US:0,BR:0};
rain.ships.wolfe.ver='B';newForce(rain,'BR','KIN','Patrol',['wolfe']);newForce(rain,'US','KIN','Patrol',['oneida']);
rain.encounter={zone:'KIN',kind:'normal',segment:'patrol',ships:{},side:{},struckBy:{},withdrawn:{US:false,BR:false},leaderFate:{},wg:'BR',wgCard:19};
['wolfe','oneida'].forEach(id=>encAdd(rain,id));rain.zones.KIN.flags.rainy=true;
var rainyBefore=JSON.stringify(rain),rainyText=encSummary(rain);`);
check('Rainy command preview explicitly skips Gunnery',X("rainyText.includes('no Gunnery') && rainyText.includes('straight to Close Action')"),true);
check('Rainy command preview shows independent printed Close Action strengths',X("rainyText.includes('Wolfe (B) CA 8') && rainyText.includes('Oneida CA 3') && rainyText.includes('Wolfe (B) vs Oneida')"),true);
check('Rainy preview omits unused Gunnery odds and columns',X("rainyText.includes('Odds if') || rainyText.includes('(1:1')"),false);
check('Rainy matchup preview does not mutate state or consume dice',X('JSON.stringify(rain)===rainyBefore'),true);
X("var reaction=JSON.parse(rainyBefore);reaction.encounter.segment='reaction';var reactionText=encSummary(reaction);");
check('nearby Reaction control still previews Gunnery',X("reactionText.includes('Odds if you attack') && !reactionText.includes('straight to Close Action')"),true);
X(`var decksBefore=JSON.stringify(rain.deck);rain.calls=[{proc:'combat',pc:'start',A:{attacker:'BR',segment:'patrol'},L:{}}];run(rain);
act(rain,{attackers:['wolfe'],tows:{}});`);
check('actual Rainy first round is Close Action with the previewed strengths',X("rain.prompt.title==='Close Action Round' && rain.prompt.text.includes('Wolfe (B) (CA 8) vs Oneida (CA 3)')"),true);
check('Rainy skips Tactics and additional Weather Gage draws',X('JSON.stringify(rain.deck)===decksBefore'),true);
console.log(`${passed} preview regressions passed; ${failed} failed.`);process.exitCode=failed?1:0;
