const fs=require('fs'),path=require('path'),assert=require('assert');const {x}=require('./load')(path.resolve(process.argv[2]));
// Counts read down each position in the full British p.32 reproduction. One ship is automatic.
const counts=[
[36],[18,18],[12,12,12],[9,9,9,9],[7,7,8,7,7],[6,6,6,6,6,6],[5,5,5,6,5,5,5],[3,5,5,5,5,5,5,3],
[4,4,4,4,4,4,4,4,4],[2,4,4,4,4,4,4,4,4,2],[1,4,4,4,5,4,4,4,4,1,1],Array(12).fill(3),
[1,3,3,3,3,3,3,3,3,3,3,3,2],[2,3,3,3,3,3,3,3,3,3,3,2,1,1],
[2,2,2,2,2,2,4,4,4,2,2,2,2,2,2],[2,2,2,2,2,2,2,4,4,2,2,2,2,2,2,2],
[2,2,2,2,2,2,2,3,3,2,2,2,2,2,2,2,2],Array(18).fill(2)];
const mismatches=[];for(const [col,countsPerShip] of counts.entries()){
 const sequence=countsPerShip.flatMap((n,i)=>Array(n).fill(i+1));assert.equal(sequence.length,36,'column '+(col+1));
 for(let i=0;i<36;i++){const red=1+Math.floor(i/6),blue=1+i%6;const got=x('hitPosition('+(col+1)+','+red+','+blue+')');if(got!==sequence[i])mismatches.push([col+1,red*10+blue,sequence[i],got]);}
}
const pkg8=x(`(()=>{const s=newGame('BR',1);s.aiTroops.box=[{troops:true,revealed:true}];s.ships.sylph.box='deployable';const pool=sideShips(s,'US').filter(sh=>sh.box==='deployable');return [1,7].map(i=>{s.rng=i;const r=forcePackageSelect(s,8,pool);return {rng:i,first:r.ships,second:r.ships2,ok:r.ok,why:r.why};});})()`);
const data={aidVI:{columns:18,rolls:648,automaticSingleShip:36,mismatches},pkg8};fs.writeFileSync(path.join(__dirname,'paper-results.json'),JSON.stringify(data,null,2));console.log(JSON.stringify(data,null,2));assert(!mismatches.length);
