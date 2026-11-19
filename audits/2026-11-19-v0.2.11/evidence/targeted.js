const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const repo=path.resolve(process.argv[2]),out=path.join(__dirname,'targeted');
const html=fs.readFileSync(path.join(repo,'dist/index.html'),'utf8');
const rows=[];
async function page(){
 const errors=[],vc=new VirtualConsole().on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://audit.invalid/',runScripts:'dangerously',virtualConsole:vc});
 const w=dom.window,d=w.document;await new Promise(r=>w.addEventListener('load',r,{once:true}));
 const click=(label,scope=d)=>{const e=[...scope.querySelectorAll('button')].find(b=>b.textContent===label);assert(e&&!e.disabled,label);e.click();};
 const change=(e,v)=>{assert(e);e.value=String(v);e.dispatchEvent(new w.Event('input',{bubbles:true}));e.dispatchEvent(new w.Event('change',{bubbles:true}));};
 const state=()=>JSON.parse(w.eval('JSON.stringify(G_STATE)'));
 const load=s=>{click('Load a saved game');change(d.querySelector('#modal textarea'),JSON.stringify(s));click('Load pasted text');assert(!d.querySelector('#modal').classList.contains('open'),'import refused');};
 const select=value=>[...d.querySelectorAll('#modal select')].find(e=>[...e.options].some(o=>o.value===value));
 return{dom,w,d,errors,click,change,state,load,select};
}
(async()=>{
 for(const key of ['command','tactics','gunnery','lineup']){
  const t=await page(),s=JSON.parse(fs.readFileSync(path.join(out,key+'.json')));t.load(s);
  const ids=Object.keys(s.encounter.ships).filter(id=>s.encounter.side[id]===s.human&&s.encounter.ships[id]==='in');
  const id=ids.find(id=>s.ships[id].steps>0&&id!==s.flagship[s.human])||ids[0];assert(id);
  const before=JSON.stringify(t.state());t.click('Adjust');t.change(t.select('pike'),id);t.change(t.select('outOfPlay'),'outOfPlay');t.click('Apply');
  const message=t.d.querySelector('#modal .err')?.textContent;
  t.click('Close');const changed=t.state(),r={key,id,message,accepted:changed.ships[id].box==='outOfPlay',encounterStatus:changed.encounter.ships[id],beforeTitle:s.prompt.title};
  if(key==='command'){
   const pr=changed.prompt,opt=pr.options.find(o=>o.id==='attack');assert(opt);t.click(opt.label,t.d.querySelector('#proc'));
   const next=t.state();r.nextTitle=next.prompt.title;r.stillCandidate=next.prompt.candidates?.includes(id);r.shipBox=next.ships[id].box;
   fs.writeFileSync(path.join(out,'adjust-ghost-after.json'),JSON.stringify(next,null,2));
   t.click('Attack with these ships',t.d.querySelector('#proc'));
   const after=t.state();r.stillInAttack=after.combat.col[after.human].includes(id);r.attackColumn=after.combat.col[after.human];
  }
  if(key==='tactics'){
   const opt=changed.prompt.options.find(o=>!o.disabled),btn=[...t.d.querySelectorAll('#proc .optcard')].find(e=>e.querySelector('.t').textContent===opt.label);btn.click();
   t.click('Continue',t.d.querySelector('#proc'));
   r.round=t.state().prompt.text;r.col=t.state().combat?.col;
  }
  r.errors=t.errors;rows.push(r);t.dom.window.close();
 }
 // A structurally complete save can carry an unknown next Event ID.
 const t=await page();const original=JSON.parse(fs.readFileSync(path.join(out,'command.json')));t.load(original);const validBefore=JSON.stringify(t.state());
 const corrupted=JSON.parse(fs.readFileSync(path.join(out,'encounter.json')));corrupted.deck.event[0]=999;
 t.click('Load');t.change(t.d.querySelector('#modal textarea'),JSON.stringify(corrupted));t.click('Load pasted text');
 const accepted=!t.d.querySelector('#modal').classList.contains('open');let actions=0;
 if(accepted){for(;actions<100&&!t.state().over;actions++){const s=t.state(),p=s.prompt;
  try{t.w.__answer=require('./campaign/policy').policy(s,p,'fleet');t.w.eval('doAct(window.__answer)');}catch(e){break;}
  if(t.w.eval('UI.err'))break;
 }}
 const error=t.w.eval('UI.err');let undos=0;
 while(JSON.stringify(t.state())!==validBefore&&t.w.eval('UNDO.length')&&undos<20){t.click('↶ Undo');undos++;}
 const priorGameRecovered=JSON.stringify(t.state())===validBefore;
 rows.push({key:'unknown-event-save',accepted,actions,error,pageErrors:t.errors,undosToPriorGame:undos,priorGameRecovered});
 assert(priorGameRecovered,'The valid prior game must remain recoverable');
 fs.writeFileSync(path.join(out,'unknown-event-save.json'),JSON.stringify(corrupted,null,2));t.dom.window.close();
 fs.writeFileSync(path.join(out,'targeted-results.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
