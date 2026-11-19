const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Observational instrumentation around an action already chosen at a real prompt.
// No extra random draws, no generated positions, and no hidden information sent to the policy.
module.exports = function observations({report, E, ctx, x, out, label, repo}) {
  const counts = report.observed = {};
  const exemplars = report.examples = {};
  let game, originalState, display, pending, ordinal;
  function count(key) { counts[key] = (counts[key] || 0) + 1; game.seen.add(key); }
  function fixture(key, board) {
    if (exemplars[key]) return;
    const file = label + '-' + key + '.json';
    exemplars[key] = {file, human: originalState.human, seed: game.seed, policy: game.style,
      prompt: display.p.title, action: display.a, promptNumber: ordinal, position: board};
    fs.writeFileSync(path.join(out, file), pending);
  }
  function checkBalance(s) {
    const value = {US:0, BR:0}, home = {US:'SAC',BR:'KIN'};
    if (s.turn > 0) for(const sh of Object.values(s.ships)) {
      if(sh.box !== 'deployable' || sh.port === 'home' && s.zones[home[sh.owner]].blockade) continue;
      value[sh.owner] += E.def(sh).vp[1];
    }
    const number = value.US - value.BR;
    const band = number<=-70?0:number<=-26?1:number<=-16?2:number<16?3:number<26?4:number<60?5:6;
    assert.equal(s.nb,number,'A6 balance at assignment');
    assert.equal(s.nbBand,band,'A6 balance column at assignment');
    count('A6 signed balance and band');
  }
  function checkScore(s) {
    // F1, F2.5, F3.2.1, F3.3, F4 and 5.4. Reconstruct the award from
    // scoring components and resolved map, using the actual displayed militia die as input.
    // F3.1 shipyard includes immediate VP for destroyed enemy ships, audited separately.
    const turn=s.turn, sides=['US','BR'], opp={US:'BR',BR:'US'};
    const own=s.human, delta={US:0,BR:0}, reasons=s.vpLog.filter(r=>r.turn===turn);
    for(const loss of s.lossesThisTurn) if(loss.by)
      delta[loss.by] += E.def(s.ships[loss.id]).vp[loss.how==='sunk'?0:1];
    for(const raid of s.coastal.cutouts) if(raid.result==='repulsed')delta[opp[raid.side]]++;
    const home={US:'SAC',BR:'KIN'};
    for(const zone of Object.values(s.zones)) if(zone.control) delta[zone.control]++;
    if(turn===7&&s.niagara===6&&s.zones.NIA.control==='BR'&&!game.preF6BRBlockaded)delta.BR+=10;
    if(turn===7&&s.niagara===0&&s.zones.NIA.control!=='BR')delta.US+=10;
    delta[own]-=s.troops[own].available;

    let militiaLines=Array.from(s.prompt.text.matchAll(/Local Militia – 1d6 (\d+) [^:]+: [^\n]+/g)).map(m=>m[0]);
    for(const r of s.coastal.raids) {
      let value=({KIN:2,SAC:2,YOR:1,NIA:1,NOR:1,SOU:1})[r.zone];
      if(r.events.includes('suppliesMoved')) value=0;
      if(r.events.includes('suddenStorm')) value=value===2?1:0;
      if(r.events.includes('localMilitia')){
        const msg=militiaLines.shift();assert(msg,'Militia die must be shown');
        if(+msg.match(/1d6 (\d+)/)[1]>r.guns)value=0;
      }
      delta[r.side]+=value;
    }
    if(game.fallBefore===null&&s.fallOffensive&&s.fallOffensive!=='both')delta[s.fallOffensive]+=5;
    // Other VP awarded outside the above components during this turn (e.g. before Tally)
    // were in the snapshot at entry; shipyard hits awarded *during* F3.1 are accounted from its row.
    for(const side of sides){
      const actual=s.vp[side]-game.beforeTally[side];
      // ordinary and shipyard damage may score when the physical component is destroyed.
      const extra=game.stocks.filter(sh=>sh.owner!==side&&s.ships[sh.id].box==='sunk').reduce((n,sh)=>n+sh.vp,0);
      assert.equal(delta[side]+extra, actual,'Tally recomputation '+side+' turn '+turn+'; '+JSON.stringify({delta,extra,reasons}) );
    }
    count('Tally independent VP components');
    if(game.trace)game.trace.turns.at(-1).tally={supply:{...s.supply},niagara:s.niagara,gross:{...s.vp},score:s.vp.US-s.vp.BR,independentDelta:delta,awards:reasons.map(r=>[r.side,r.n,r.why]),text:s.prompt.text};

  }
  function boardFields(s) {
    return Object.fromEntries(Object.entries(s.ships).map(([id,sh])=>[id,[sh.owner,sh.steps,sh.box,sh.zone,sh.forceId,sh.port,sh.ver].join('|')]));
  }
  ctx.watchEventBefore = (s,ev,z) => {
    if (s!==originalState || !pending) return null;
    if(ev.lake==='gale'&&s.phase!=='lake'){
      count('Gale drawn outside Lake Action');
      const board={turn:s.turn+1,phase:s.phase,zone:z,kind:s.encounter.kind,participating:Object.keys(s.encounter.ships)};
      fixture('gale-outside-lake',board);
      return {gale:board};
    }
    if(!['separated','separatedBoth'].includes(ev.lake))return null;
    const forces={};
    for(const [id,status] of Object.entries(s.encounter.ships)){
      const sh=s.ships[id];if(sh.owner!==ev.lakeSide||status!=='in')continue;
      (forces[sh.forceId]||=[]).push(id);
    }
    return {event:ev.id, kind:ev.lake,zone:z,affected:ev.lakeSide,forces,encounter:s.encounter.kind};
  };
  ctx.watchEventAfter = (s,before) => {
    if(!before) return;
    if(before.gale)return;
    count('Separated Ships draws');
    const ids=Object.keys(before.forces);
    const movedByForce=Object.fromEntries(ids.map(fid=>[fid,before.forces[fid].filter(id=>s.ships[id].zone!==before.zone)]));
    const board={...before,movedByForce};
    const moved=Object.values(movedByForce).flat();
    if(moved.length)game.displaced.set(s.encounter,new Set(moved));
    if(ids.length<2)return;
    count('Separated Ships with multiple affected Forces');
    fixture('separated-multiple-forces',board);
    const eligible=ids.filter(fid=>before.forces[fid].length>1);
    const changed=ids.filter(fid=>movedByForce[fid].length);
    if(eligible.length>1)count('Separated Ships with two or more eligible Forces (printed tie not specified)');
    if(eligible.length===0 && changed.length>0 || eligible.length===1 && (changed.length!==1||changed[0]!==eligible[0]||movedByForce[eligible[0]].length!==Math.floor(before.forces[eligible[0]].length/2)) || eligible.length>1 && (changed.some(id=>!eligible.includes(id))||changed.length===0)){
      count('Separated Ships inconsistent with any eligible Force');
      fixture('separated-different-distribution',board);
    }
  };
  ctx.watchTally = s=>{
    if(s!==originalState || !pending)return;
    game.beforeTally = {...s.vp};
    game.stocks=Object.values(s.ships).filter(sh=>['repairing','construction'].includes(sh.box)).map(sh=>({id:sh.id,owner:sh.owner,vp:E.def(sh).vp[0]}));
    game.fallBefore=s.fallOffensive;
    // F2.3 removes an existing invalid blockade before F3.2.1; F6 may put a new one on.
    const z=s.zones.KIN;const mine=Object.values(s.ships).filter(sh=>sh.box==='lake'&&sh.zone==='KIN');
    game.preF6BRBlockaded=z.blockade==='US'&&mine.filter(sh=>sh.owner==='US'&&E.def(sh).main&&sh.steps===E.def(sh).full[4]).length>=4&&!mine.some(sh=>sh.owner==='BR');
  };
  x(`const originalApplyLakeEvent=applyLakeEvent;applyLakeEvent=function(s,ev,z){const b=watchEventBefore(s,ev,z);const result=originalApplyLakeEvent(s,ev,z);watchEventAfter(s,b);return result;};
  const originalTally=PROCS.tally.start;PROCS.tally.start=function(s,f){watchTally(s);return originalTally(s,f);};`);
  return {
    begin(s,style,seed){originalState=s;pending=null;game={style,seed,seen:new Set(),changedShipRows:0,displaced:new WeakMap()};if(seed===report.start&&s.human==='US'&&style==='coast')game.trace={human:s.human,seed,style,options:s.options,turns:[],actions:[]};},
    before(s,p,a,snapshot,n){
      display={p,a};ordinal=n;pending=snapshot;game.beforeShips=boardFields(s);
      if(s.encounter&&p.title==='Reaction Segment – declare Reaction Checks'){
        const moved=game.displaced.get(s.encounter);
        if(moved&&[...moved].some(id=>p.items.some(i=>i.id===id))){count('Separated human ship offered for same-Encounter Reaction');fixture('displaced-react',{zone:s.encounter.zone,moved:[...moved],offered:p.items.map(i=>i.id)});}
      }
      if(game.trace){
        game.trace.actions.push({n:n+1,turn:s.turn+1,title:p.title,answer:a});
        if(p.kind==='assign')game.trace.turns.push({turn:s.turn+1,navalBalance:s.nb,shipsInPort:p.ships.length,troops:p.troops,assign:a});
      }
      if(p.kind==='assign')checkBalance(s);
      if(p.pkg===8){count('Manual Package 8 prompts');if(a.length){count('Manual Package 8 with selected ships');fixture('manual-package8-first',{zone:p.targetCard,selected:a});}}
      if(/Package #8.*second stack/i.test(p.title)){count('Manual Package 8 second stack');fixture('manual-package8-second',{second:a});}
      if(p.kind==='assign'&&!p.ships.length)count('No human ship available at A7');
      if(p.kind==='assign'&&!p.troops)count('No human Troops available at A7');
      if(p.kind==='assign'&&!s.aiTroops.box.some(m=>m.revealed&&m.troops))count('No revealed AI Troops available at A7');
      if(p.kind==='assign'&&s.nb===0&&s.turn>0)count('Tied naval balance after June I');
    },
    after(s){
      if(s.prompt?.title.startsWith('Tally – '))checkScore(s);
      if(s.encounter&&game.displaced.has(s.encounter)){
        const moved=game.displaced.get(s.encounter), back=[...moved].filter(id=>s.encounter.ships[id]==='in');
        if(back.length){count('Separated ship rejoined same Encounter');fixture('displaced-returned',{zone:s.encounter.zone,side:s.ships[back[0]].owner,back});for(const id of back)moved.delete(id);}
      }
      if(s.prompt?.title==='Weather Gage changes!'&&s.prompt.text.includes('Defender Outmaneuver')){
        count('Defender Outmaneuver gained Weather Gage');
        fixture('defender-outmaneuver',{turn:s.turn+1,encounter:s.encounter?.zone,promptAfter:s.prompt.title,message:s.prompt.text});
      }
      for(const sd of ['US','BR']){
        if(s.supply[sd]===-1)game.seen.add(sd+' supply at -1');if(s.supply[sd]===12)game.seen.add(sd+' supply at 12');
      }
      if(s.fallOffensive==='both')game.seen.add('Simultaneous Fall Offensive');
      if(s.over&&s.turn<8&&!s.suddenDeath)fixture('5-1-early',{turn:s.turn+1,score:s.result.score,log:s.log.slice(-4).map(r=>r.text)});
      if(s.suddenDeath){
        game.seen.add('Dual Blockade ending');
        const zones=Object.fromEntries(Object.entries(s.zones).filter(([z,v])=>v.blockade).map(([z,v])=>[z,{blockade:v.blockade,ships:Object.values(s.ships).filter(sh=>sh.box==='lake'&&sh.zone===z).map(sh=>[sh.id,sh.owner,sh.steps])}]));
        fixture('dual-blockade',{turn:s.turn+1,zones,winner:s.suddenDeath});
      }
      if(s.prompt?.title==='Gale!')game.seen.add('Gale');
      if(s.encounter?.kind==='breakout')game.seen.add('Breakout');
      const now=boardFields(s);
      for(const id of Object.keys(now))if(now[id]!==game.beforeShips[id])game.changedShipRows++;
      pending=null;
    },
    finish(s){
      if(game.trace){
        game.trace.result=s.result;game.trace.endScore=s.vp.US-s.vp.BR;
        fs.writeFileSync(path.join(out,label+'-trace.json'),JSON.stringify(game.trace,null,2)+'\n');
      }
      const playable = JSON.parse(JSON.stringify(s));
      for(const k of ['app','build','promptSeq'])delete playable[k];
      delete playable.options.confirmAiSteps;
      const digest=crypto.createHash('sha256').update(JSON.stringify(playable)).digest('hex');
      return {outcome:digest,changedShipRows:game.changedShipRows,seen:[...game.seen].sort()};
    },
  };
};
