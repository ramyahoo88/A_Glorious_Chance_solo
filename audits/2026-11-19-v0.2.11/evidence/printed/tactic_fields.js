// Independent transcription from rendered VASSAL v1.0 faces (all 20 physical cards).
const assert=require('assert'),path=require('path'),{x}=require('./load')(path.resolve(process.argv[2]));
const expected=[
['A_sweep','A','square','white','US'],['A_surprise','A','star','lavender'],['A_rake','A','star','salmon'],
['A_pursuit','A','arrow','yellow'],['A_outmaneuver','A','heart','salmon'],['A_grapple','A','diamond','teal','BR'],
['A_firstshot','A','club','lavender'],['A_dummy1','A',null,null,null,true],['A_dummy2','A',null,null,null,true],
['A_rof','A','club','green'],['D_repel','D','circle','teal','US'],['D_rof','D','club','green'],
['D_rake','D','heart','salmon'],['D_outmaneuver','D','heart','salmon'],['D_mutual','D','diamond','lavender'],
['D_openrange','D','square','white','BR'],['D_firstshot','D','club','lavender'],['D_escape','D','club','yellow'],
['D_dummy1','D',null,null,null,true],['D_dummy2','D',null,null,null,true]
].map(a=>[a[0],a[1],a[2]||null,a[3]||null,a[4]||null,!!a[5]]);
const actual=JSON.parse(x(`JSON.stringify(TACTICS.map(t=>[t.id,t.deck,t.sym||null,t.color||null,t.only||null,!!t.dummy]))`));
assert.deepStrictEqual(actual,expected);assert.equal(actual.filter(t=>t[1]==='A').length,10);assert.equal(actual.filter(t=>t[1]==='D').length,10);
console.log(JSON.stringify({checkedCards:20,active:16,dummies:4,fields:['id','deck','symbol','color','sideRestriction','dummy'],mismatches:0},null,2));
