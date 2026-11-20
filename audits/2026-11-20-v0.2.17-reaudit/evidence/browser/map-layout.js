const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium:pw}=require('playwright'), chromium=require('@sparticuz/chromium').default;
const root=path.resolve(process.argv[2]||'.'),out=__dirname;
const getState=pg=>pg.evaluate('JSON.stringify(G_STATE)');
async function load(pg,file){
 const menu=pg.locator('#hdr'); await menu.getByRole('button',{name:/^Load( game)?$/}).click();
 await pg.locator('#modal textarea').fill(fs.readFileSync(file,'utf8'));
 await pg.getByRole('button',{name:'Load pasted text',exact:true}).click();
 assert.equal(await pg.locator('#modal.open').count(),0);
}
function metrics(){
 const stage=document.querySelector('#modal.open .map-stage')||document.querySelector('#board .map-stage');
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
 const inside=(p,r)=>p.x>r.x+1&&p.x<r.right-1&&p.y>r.y+1&&p.y<r.bottom-1;
 const nodes=[...stage.querySelectorAll('[data-place]')].map(e=>({place:e.dataset.place,rect:rect(e),text:e.textContent}));
 const badges=[...stage.querySelectorAll('.map-route-badge')].map(e=>({num:e.textContent,rect:rect(e)}));
 const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));
 const routes=[...stage.querySelectorAll('.map-route')].map(e=>{
  const point=t=>{const p=e.getPointAtLength(e.getTotalLength()*t),v=new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM());return {x:v.x,y:v.y};};
  const end=point(1),start=point(0),mid=point(.5);
  return {num:e.dataset.move,start,end,mid,hiddenStart:nodes.filter(n=>inside(start,n.rect)).map(n=>n.place),hiddenEnd:nodes.filter(n=>inside(end,n.rect)).map(n=>n.place),hiddenMid:nodes.filter(n=>inside(mid,n.rect)).map(n=>n.place)};
 });
 const clashes=[];for(let i=0;i<badges.length;i++)for(let j=i+1;j<badges.length;j++){const area=overlap(badges[i].rect,badges[j].rect);if(area>10)clashes.push([badges[i].num,badges[j].num,Math.round(area)]);}
 const nodeClashes=[];for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const area=overlap(nodes[i].rect,nodes[j].rect);if(area>10)nodeClashes.push([nodes[i].place,nodes[j].place,Math.round(area)]);}
 return {stage:rect(stage),documentOverflow:document.documentElement.scrollWidth>innerWidth+1,routes,badgeNodeClashes:badges.flatMap(b=>nodes.filter(n=>overlap(b.rect,n.rect)>1).map(n=>[b.num,n.place])),badgeClashes:clashes,nodeClashes,nodes};
}
(async()=>{
 const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const pg=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];pg.on('pageerror',e=>errors.push(e.message));
 await pg.goto('file://'+path.join(root,'dist/index.html'));
 const report={browser:await browser.version(),cases:[],errors};
 for(const name of ['crowded','shared-routes-after','withdrawal-after','intermediate-omitted-after','home-to-sackets-after','busy']){
  await load(pg,name==='busy'?path.join(root,'audits/2026-11-19-v0.2.15/evidence/busy.json'):path.join(root,'audits/2026-11-19-v0.2.14-reaudit/evidence',name+'.json'));
  const saved=await getState(pg);
  for(const width of [1440,1024,768,412,390,360,320]){
   await pg.setViewportSize({width,height:1000});
   await pg.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
   await pg.locator('#board .map-stage').scrollIntoViewIfNeeded();
   const m=await pg.evaluate(metrics);report.cases.push({name,width,scope:'board',...m});
   if((width===390||width===1440)&&['crowded','shared-routes-after','withdrawal-after'].includes(name))await pg.locator('#board .campaign-map').screenshot({path:path.join(out,name+'-'+width+'.png')});
   await pg.locator('#hdr').getByRole('button',{name:'Map',exact:true}).click();
   report.cases.push({name,width,scope:'dialog',...await pg.evaluate(metrics)});
   await pg.getByRole('button',{name:'Close',exact:true}).click();
   assert.equal(await getState(pg),saved,'Map open/close changes no game state');
  }
 }
 fs.writeFileSync(path.join(out,'map-layout.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({browser:report.browser,cases:report.cases.length,errors,problems:report.cases.filter(c=>c.badgeClashes.length||c.nodeClashes.length||c.routes.some(r=>r.hiddenEnd.length)).map(c=>({name:c.name,width:c.width,scope:c.scope,badges:c.badgeClashes,nodes:c.nodeClashes,hiddenHeads:c.routes.filter(r=>r.hiddenEnd.length).map(r=>[r.num,r.hiddenEnd])}))},null,2));
 assert.deepEqual(errors,[]);
 for(const c of report.cases){assert(!c.documentOverflow, c.name+' '+c.width+' overflow');assert.equal(c.badgeClashes.length,0,c.name+' '+c.width+' badge collisions');assert.equal(c.nodeClashes.length,0,c.name+' '+c.width+' label collisions');assert.equal(c.badgeNodeClashes.length,0,c.name+' '+c.width+' badge covers label');for(const r of c.routes){assert.equal(r.hiddenEnd.length,0,c.name+' '+c.width+' hidden endpoint');assert.notDeepEqual(r.start,r.end,'Non-empty route');}}
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
