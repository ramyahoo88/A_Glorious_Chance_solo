// Replay natural campaign positions without changing dice or game state.
const fs=require('fs'),path=require('path'),assert=require('assert');
const repo=path.resolve(process.argv[2]),{x}=require('./campaign/load')(repo);
const E=x('({act})'),{policy}=require('./campaign/policy');
const out=path.join(__dirname,'targeted'),meta=JSON.parse(fs.readFileSync(path.join(out,'natural-metadata.json'))),results={};
for(const key of ['melee-loser-before','double-leader-before','zero-guns-before']){
 const before=JSON.parse(fs.readFileSync(path.join(out,key+'.json'))),s=JSON.parse(JSON.stringify(before));
 const answer=policy(s,s.prompt,meta[key].style),n=s.log.length;
 E.act(s,answer);const lines=s.log.slice(n).map(l=>l.text);
 const same=JSON.parse(JSON.stringify(before));E.act(same,answer);assert.equal(JSON.stringify(s),JSON.stringify(same));
 results[key]={human:s.human,seed:s.seed,turn:s.turn+1,promptBefore:before.prompt.title,answer,promptAfter:s.prompt?.title,
  beforeLeader:before.leader,afterLeader:s.leader,rngBefore:before.rng,rngAfter:s.rng,log:lines};
 fs.writeFileSync(path.join(out,key.replace('-before','-after')+'.json'),JSON.stringify(s,null,2));
}
assert(results['melee-loser-before'].log.some(t=>t.includes('Leader Casualty Check (Cdre. Yeo)')));
assert(!results['melee-loser-before'].log.some(t=>t.includes('Leader Casualty Check (Cdre. Chauncey)')));
assert.equal(results['double-leader-before'].beforeLeader.US.seq,0);assert.equal(results['double-leader-before'].afterLeader.US.seq,2);
assert(results['zero-guns-before'].log.some(t=>t.includes(', 0 guns):')&&t.includes('Scatters')));
fs.writeFileSync(path.join(out,'rule-replay-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
