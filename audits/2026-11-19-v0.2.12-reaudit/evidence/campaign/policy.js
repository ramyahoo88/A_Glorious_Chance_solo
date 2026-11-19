// Deterministic policies use ships, missions and choices visible to the human.
// Diagnostics inspect state and ledger only AFTER actions; hidden decks never guide play.
const path=require('node:path');const repo=path.resolve(process.argv[2]);
const E=require(path.join(repo,'tools/bundle_engine.js'))();
function policy(s,p,style){
 if(p.kind==='info')return 'ok';
 if(p.kind==='choice'){
  const opts=p.options.filter(o=>!o.disabled);
  const prefs=style==='coast'?['A_rake','A_pursuit','D_escape','bypass','withdraw']:['A_pursuit','A_rake','D_rof','confront','attack','withdraw'];
  const pick=prefs.map(id=>opts.find(o=>o.id===id)).find(Boolean)||opts.find(o=>o.primary)||opts[0];return pick.id;
 }
 if(p.kind==='select'){
  if(/eaction/i.test(p.title)){const a=p.items.map(i=>i.id).slice(0,p.max);if(!E.validateAnswer(s,p,a))return a;}
  if(/pgrade/.test(p.title)&&p.max&&p.items.length){const a=[p.items[0].id];if(!E.validateAnswer(s,p,a))return a;}
  const a=(p.initial||[]).slice();for(const it of [...p.items].reverse()){if(!E.validateAnswer(s,p,a))break;if(!a.includes(it.id))a.push(it.id);}
  return a;
 }
 if(p.kind==='lineup')return {attackers:p.candidates,tows:p.defaultTows||{}};
 if(p.kind==='assign'){
   const ids=p.ships.slice(),enemy=s.human==='BR'?'SAC':'KIN',home=s.human==='BR'?'KIN':'SAC',f=[];
   function take(m,z,ships,t=0){if(!ships.length)return;f.push({mission:m,zone:z,ships,troops:t});for(const id of ships)ids.splice(ids.indexOf(id),1);}
   if(style==='screen'){
    // Keep several independent screens in the same waters. Two independent, single-ship
    // escorts make the distinction between one Encounter and several Forces observable.
    if(p.missions.Escort&&ids.length>=4){
      take('Escort',p.missions.Escort[0],[ids.at(-1)]);
      take('Escort',p.missions.Escort[0],[ids.at(-1)]);
    }
    if(ids.length>=3){take('Patrol',enemy,[ids[0]]);take('Patrol',enemy,[ids[0]]);}
    if(ids.length>1)take('Patrol',enemy,ids.slice(0,-1));
   }else if(style==='blockade'){
    // Once the opponent's regular port is blockaded, operate a second substantial
    // patrol at their temporary port. Start the blockade again if it fails.
    const temp=s.human==='US'?'YOR':'SOU';
    if(s.zones[enemy].blockade===s.human&&ids.length>=3){
     const full=ids.filter(id=>s.ships[id].steps===E.def(s.ships[id]).full[4]&&E.def(s.ships[id]).main);
     // Four undamaged Main Ships per port, maintaining the first blockade before attempting the second.
     function drawBlockadePool(){return full.filter(i=>ids.includes(i)).slice(0,4);}
     const maintain=drawBlockadePool();if(maintain.length)take('Patrol',enemy,maintain);
     const second=drawBlockadePool();if(second.length)take('Patrol',temp,second);
    }else if(ids.length)take('Patrol',enemy,ids.slice());
   }else if(style==='coast'){
    const raidZones=p.missions.Raid||[];for(const z of raidZones){const id=ids.find(i=>!E.def(s.ships[i]).main)||ids.at(-1);if(id&&ids.length>2)take('Raid',z,[id]);}
    if(p.troops>0&&p.missions.ArmySupport){const squad=[];for(const id of ids){squad.push(id);if(E.troopCapacity(s,squad)>=p.troops)break;}const t=Math.min(p.troops,E.troopCapacity(s,squad));if(t)take('ArmySupport',s.turn%2?'NIA':enemy,squad,t);}
    const target=Object.values(s.ships).some(sh=>sh.owner!==s.human&&sh.port==='home'&&['makeReady','deployable'].includes(sh.box));
    if(p.missions.CuttingOut&&ids.length&&target)take('CuttingOut',enemy,[ids[0]]);
    if(ids.length>1)take('Patrol',enemy,ids.slice(0,-1));
   }else{
    if(p.missions.Escort&&ids.length>3)take('Escort',p.missions.Escort[0],[ids.at(-1)]);
    if(p.troops&&p.missions.ArmySupport&&ids.length>2){
     const ships=ids.slice(0,2),t=Math.min(p.troops,E.troopCapacity(s,ships));if(t)take('ArmySupport','NIA',ships,t);
    }
    if(ids.length)take('Patrol',s.turn%3===0?home:enemy,ids.slice(0,Math.max(1,ids.length-1)));
   }
   return {forces:f,flagship:p.flagship};
 }
 throw Error('Unknown prompt '+p.kind);
}

module.exports = {policy};
