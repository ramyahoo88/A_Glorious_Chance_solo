/* Compare presentation paces at every stop, including game state, hidden decks, log and RNG. */
const path = require('path'), fs = require('fs'), assert = require('node:assert/strict'), vm = require('vm');
const repo = path.resolve(process.argv[2]), trials = Number(process.argv[3] || 24);
const { policy } = require('../campaign/policy');
const {ctx, x} = require('../campaign/load')(repo);
vm.runInContext(fs.readFileSync(path.join(repo, 'src/ui_table.js'), 'utf8')+
  "\nfunction sgn(n) { return (n>0?'+' : n<0?'−':'±')+Math.abs(n); }",ctx);
const {newGame, run, act, playTableAction} = x('({newGame,run,act,playTableAction})');
function digest(s) { const { tableReport, ...state } = s; return JSON.stringify(state); }
const count={games:0,individual:0,grouped:0,groupedNotices:0,forcedTactics:0,comparisons:0,turns:0};
const samples=[];
for(let i=0;i<trials;i++) for(const human of ['US','BR']){
  const style=['coast','screen','blockade'][i%3], seed=963000+i;
  const game=newGame(human, seed, { groupUpdates:true, confirmAiSteps:true, cuttingOut:i%2===0, oa1Upgrades:i%2===1 });
  run(game); const detailed=JSON.parse(JSON.stringify(game));
  let clicks=0, actions=0;
  while(!game.over){
    const ans=policy(game,game.prompt,style);
    playTableAction(game,ans); act(detailed,ans); actions++; clicks++;
    for(const entry of (game.tableReport?.notices||[])){
      const p=detailed.prompt;
      assert(p && p.title===entry.title);
      const options=p.options.filter(o=>!o.disabled);
      assert(p.kind==='info'||(p.tactic&&options.length===1));
      if(p.tactic)count.forcedTactics++;
      act(detailed,p.kind==='info'?'ok':options[0].id); actions++;
    }
    assert.equal(digest(game),digest(detailed)); count.comparisons++;
    assert(clicks<2000);
  }
  count.games++;count.individual+=actions;count.grouped+=clicks;count.groupedNotices+=actions-clicks;
  count.turns+=Math.min(8,game.turn+1);samples.push({human,seed,style,actions,clicks,score:game.result.score,level:game.result.level});
}
assert(count.groupedNotices>0&&count.forcedTactics>0);
fs.writeFileSync(path.join(__dirname,'grouped-results.json'),JSON.stringify({count,samples},null,2));
console.log(JSON.stringify(count));
