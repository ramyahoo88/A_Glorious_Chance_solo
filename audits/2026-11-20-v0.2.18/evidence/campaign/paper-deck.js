// Independent shuffled physical deck. Only turn reset/exhaustion prepares a new
// pile; do not silently repair any disagreement with the application.
const assert=require('node:assert/strict');
module.exports=function paperDeck(seed){
 let rng=seed>>>0,turn=-1,pile=[];
 const rand=n=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)%n;};
 return s=>{
  if(turn!==s.turn||!pile.length){
   const keep=['US','BR'].map(sd=>s.intelligence[sd]?.card).filter(Boolean);
   pile=Array.from({length:38},(_,i)=>i+1).filter(id=>!keep.includes(id));
   for(let i=pile.length-1;i>0;i--){const j=rand(i+1);[pile[i],pile[j]]=[pile[j],pile[i]];}
   turn=s.turn;
  }
  assert.deepEqual(pile.slice().sort((a,b)=>a-b),Array.from(s.deck.event).sort((a,b)=>a-b),'Independent physical card availability');
  return pile.shift();
 };
};
