// Runs the unmodified shipped inline script and its actual DOM click handlers
// in jsdom. This is NOT a real-browser or visual-layout test.
const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require(process.env.AGC_JSDOM_PATH||'jsdom');
const repo=path.resolve(process.argv[2]||process.cwd());
const html=fs.readFileSync(path.join(repo,'dist/index.html'),'utf8');
const out=__dirname,results={};
async function launch(saved,htmlSource=html) {
  const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(htmlSource,{url:'https://offline-audit.invalid/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){if(saved)w.localStorage.setItem('agc_solo_companion_v1',saved)}});
  await new Promise(r=>dom.window.addEventListener('load',r));
  return {dom,w:dom.window,doc:dom.window.document,errors};
}
const ev=(t,c)=>t.w.eval(c), st=t=>JSON.parse(ev(t,'JSON.stringify(G_STATE)'));
function button(t,label,root=t.doc){const a=[...root.querySelectorAll('button')].find(e=>e.textContent===label);assert(a,'Missing button '+label);assert(!a.disabled,'Disabled '+label);a.click();}
function change(t,element,value){assert(element);element.value=value;element.dispatchEvent(new t.w.Event('change',{bubbles:true}));}
function loadText(t,text){button(t,'Load');change(t,t.doc.querySelector('#modal textarea'),text);button(t,'Load pasted text',t.doc.querySelector('#modal'));}
function start(t,side,seed){if(side==='BR')button(t,'British Solo CampaignYou are Cdre. Yeo; the A.I. runs the American squadron.');change(t,t.doc.querySelector('input[type=number]'),String(seed));button(t,'Start campaign');}
function pickShips(t,ids){
  ids.forEach(id=>{const name=ev(t,`def(G_STATE.ships[${JSON.stringify(id)}]).name+(def(G_STATE.ships[${JSON.stringify(id)}]).ver?' '+def(G_STATE.ships[${JSON.stringify(id)}]).ver:'')`);const chip=[...t.doc.querySelectorAll('.asg-force')[t.doc.querySelectorAll('.asg-force').length-1].querySelectorAll('.asg-ship')].find(e=>e.textContent.replace(' (Isolated)','')===name);assert(chip,'Missing ship '+name);chip.click();});
}
function step(t){
  const s=st(t),p=s.prompt;assert(p,'No prompt');const root=t.doc.querySelector('#proc');
  if(p.kind==='info')button(t,'Continue',root);
  else if(p.kind==='choice'){const e=p.tactic?root.querySelector('.optcard'):root.querySelector('.opts button.primary')||root.querySelector('.opts button');assert(e);e.click();}
  else if(p.kind==='select'){
    let b=root.querySelector('button.primary');
    if(b.disabled){for(const item of p.items){const name=item.label;const lab=[...root.querySelectorAll('label')].find(e=>e.textContent===name);if(lab)lab.querySelector('input').click();b=root.querySelector('button.primary');if(!b.disabled)break;}}
    assert(!b.disabled,'No legal selection');b.click();
  } else if(p.kind==='lineup')button(t,'Attack with these ships',root);
  else if(p.kind==='assign'){
    if(p.ships.length){
      const mainNames=['pike','sylph','madison','oneida','tompkins','fairam','conquest','wolfe','rg','sss','moira','beres','melville'];
      let main=p.ships.filter(id=>mainNames.includes(id));if(!main.length)main=p.ships.slice(0,1);
      button(t,'+ Add Force',root);pickShips(t,main);
      const capacity=ev(t,`troopCapacity(G_STATE,${JSON.stringify(main)})`);
      if(p.troops&&capacity&&p.missions.ArmySupport){change(t,t.doc.querySelector('.asg-force select'), 'ArmySupport');change(t,t.doc.querySelectorAll('.asg-force select')[1],'NIA');change(t,t.doc.querySelector('.asg-force input[type=number]'),String(Math.min(p.troops,capacity)));}
      else change(t,t.doc.querySelectorAll('.asg-force select')[1],s.turn%2?'NOR':'SAC');
      const sec=p.ships.filter(id=>!main.includes(id));
      if(sec.length){button(t,'+ Add Force',root);change(t,[...t.doc.querySelectorAll('.asg-force')].at(-1).querySelector('select'),'Raid');pickShips(t,sec.slice(0,1));}
    }
    button(t,'Confirm assignments',root);
  } else throw Error(p.kind);
  assert.equal(ev(t,'UI.err'),'');return {kind:p.kind,title:p.title};
}

module.exports={fs,path,assert,repo,html,out,launch,ev,st,button,change,loadText,start,pickShips,step};
