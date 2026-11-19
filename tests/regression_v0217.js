// Original audit saves plus corruptions of the saved Event callers. Also check
// that validation is read-only and valid entry/reload follows the same dice.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'audits/2026-11-19-v0.2.16-reaudit/evidence');
const {ctx,x}=require(path.join(dir,'campaign/load'))(root);
vm.runInContext(fs.readFileSync(path.join(root,'src/ui.js'),'utf8'),ctx);
const E=x('({checkSaveState,act,recordEventUndo,eventRestoreText,eventDrawText,removeShipFromForce})');
const plain=s=>JSON.parse(JSON.stringify(s)),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json'))).state;
const meta=JSON.parse(fs.readFileSync(path.join(dir,'probes.json')));let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(plain(actual),expected,label);checks++;};
const refuse=(name,mutate)=>{
 const s=read(name);mutate(s);assert.throws(()=>E.checkSaveState(s),/damaged or incomplete/,'refuse '+name);checks++;
};
for(const n of ['corrupt-coastal-raidEvent','corrupt-encounter-reactionEvent','corrupt-coastal-asBattleEvent'])refuse(n,()=>{});
const cases=['turn-B2event','encounter-eventEntered','encounter-reactionEvent','combat-wgEvent','coastal-raidEvent','coastal-asBattleEvent'];
let entries=0;
for(const name of cases){
 const s=E.checkSaveState(read(name));check(E.checkSaveState(plain(s)),plain(s),name+' saves without mutation');
 for(const id of s.deck.event){
  const direct=plain(s),restored=E.checkSaveState(plain(s));E.act(direct,id);E.act(restored,id);
  check(restored,plain(direct),name+' exact entry '+id);entries++;
 }
 for(const change of [s=>s.calls.pop(),s=>s.calls.splice(-2,1),s=>s.calls.at(-2).pc='__ret',s=>s.calls.at(-1).L.gale='yes',s=>s.calls.at(-1).A.allowGale=!s.calls.at(-1).A.allowGale,s=>{s.prompt.kind='info';s.prompt.options=[{id:'ok'}];}])refuse(name,change);
}
for(const change of [s=>s.pe=[],s=>s.pe[0].idx=999,s=>s.pe[0].idx='3',s=>s.pe[0].forceId='missing',s=>s.pe[0].zone='SOU'])refuse('turn-B2event',change);
for(const name of ['encounter-eventEntered','encounter-reactionEvent','combat-wgEvent']){
 for(const change of [s=>s.encounter=null,s=>s.encounter.side=null,s=>s.encounter.withdrawn=null,s=>s.encounter.zone='wrong'])refuse(name,change);
}
for(const change of [s=>delete s.calls.at(-2).L.reactionLines,s=>s.calls.at(-2).L.reactionLines={},s=>s.calls.at(-2).L.reactionLines=[null]])refuse('encounter-reactionEvent',change);
for(const change of [s=>s.combat=null,s=>s.combat.pos=0,s=>s.combat.col.US=['missing'],s=>s.combat.tac=null,s=>s.combat.seq='wrong'])refuse('combat-wgEvent',change);
for(const change of [s=>s.calls.at(-2).L.side='wrong',s=>s.calls.at(-2).L.raidForce='missing',s=>s.forces[s.calls.at(-2).L.raidForce].side='BR'])refuse('coastal-raidEvent',change);
for(const change of [s=>delete s.calls.at(-2).L.cur,s=>s.calls.at(-2).L.cur.forces=null,s=>s.calls.at(-2).L.cur.forces=[],s=>s.calls.at(-2).L.cur.z='wrong',s=>s.calls.at(-2).L.troops=999])refuse('coastal-asBattleEvent',change);
// A legitimate Harbor loss can remove all supporting ships, while the launched
// Troops and saved zone still resolve their Land Battle without naval support.
{
 const s=read('coastal-asBattleEvent'),cur=s.calls.at(-2).L.cur;
 for(const fid of cur.forces)for(const id of [...s.forces[fid].ships]){E.removeShipFromForce(s,id);s.ships[id].box='sunk';s.ships[id].zone=null;}
 const direct=E.checkSaveState(s),restored=E.checkSaveState(plain(direct));E.act(direct,23);E.act(restored,23);
 check(restored,plain(direct),'launched Troops survive a missing supporting Force');
}
// The original Intelligence example changes its instruction, not its card pool.
{
 const s=E.checkSaveState(read('intelligence-return-before')),cards=plain(s.deck.event);E.act(s,'ok');
 check(s.intelligence.US,null,'Intelligence consumed');check(s.deck.event,cards,'Intelligence remains used until reshuffle');
 check(s.log.at(-1).text.includes('place the card with the used Event cards'),true,'used-card disposition is explicit');
 check(s.log.at(-1).text.includes('next Event-deck reshuffle'),true,'return timing is explicit');
}
// Consecutive Undos preserve the order of several physical cards; re-entry
// clears only the restoration metadata, and preserves the resumed game/RNG.
{
 const first=E.checkSaveState(read('turn-B2event'));first.deck.event=[30,3,4];first.prompt.remaining=3;
 const redraw=plain(first);E.act(redraw,30);const after=plain(redraw);E.act(after,3);
 const skipped=plain(first);E.recordEventUndo(after,skipped);check(skipped.eventRestore.cards,[30,3],'skipping an unreadable Undo frame retains chronological top order');
 E.recordEventUndo(after,redraw);check(redraw.eventRestore.cards,[3],'first Undo returns card 3');
 E.recordEventUndo(redraw,first);check(first.eventRestore.cards,[30,3],'second Undo restores top-first order');
 check(E.eventRestoreText(first).includes('Do not shuffle'),true,'ordinary Undo preserves physical order');
 check(E.eventDrawText(first,first.prompt.purpose,false,true).includes('Shuffle your physical Event deck'),false,'first-entry restoration suppresses preparation');
 check(E.checkSaveState(plain(first)),plain(first),'restoration metadata survives save validation');
 const replay=plain(first);E.act(replay,30);check('eventRestore' in replay,false,'next valid entry clears restoration note');
 for(const change of [s=>s.eventRestore.cards=[999],s=>s.eventRestore.cards=[3,3],s=>s.eventRestore.reshuffled='yes']){
  const bad=plain(first);change(bad);assert.throws(()=>E.checkSaveState(bad),/physical Event restoration/);checks++;
 }
}
console.log(`v0.2.17 Event recovery: ${checks} assertions passed; ${entries} valid card continuations across all six callers.`);
