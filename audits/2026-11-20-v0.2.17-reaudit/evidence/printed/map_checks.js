const fs=require('fs'),path=require('path'),assert=require('assert');
const {x}=require('./load')(path.resolve(process.argv[2]));
// Read DOWN the odds columns of the map, d10 0 through 9. The map is laid out by roll.
const columns=[
'A6 A5 A4 A3 A3 A2 A1 A1 End A1/D1',
'A2W A2 A1W A1 End A1/D1 D1 D1W D2 D2W',
'A2 A1W A1 End A1/D1 D1 D1W A1/D2 A1/D2W D3',
'A1/D1 D1 D1W D2 D2W A1/D2 D3W D3 A1/D3W A1/D4',
'D1 D1W D2 D2W D3 D3W D4 D4W D5 A1/D6',
'D1W D2 D2W D3 A1/D3W D4 D4W A1/D5 D5W D6',
'D2 D2W D3 A1/D3W D4 D4W A1/D5 D6 A1/D7 D7'];
const discord=[];columns.forEach((col,c)=>col.split(' ').forEach((v,i)=>{if(x('CRT['+i+']['+c+']')!==v)discord.push(['Lake Combat',c,i,v]);}));
// Number scattered and destroyed in each printed gun band. Remaining faces capture the convoy.
const gunRows=[[1,21,7,3],[22,42,6,3],[43,63,5,3],[64,84,4,3],[85,95,3,3],[96,110,2,3]];
for(const [r,[lo,hi,S,D]] of gunRows.entries())for(let i=0;i<10;i++){
 const want=i<S?'S':i<S+D?'D':'C';
 for(const guns of [lo,hi]){
  const got=x('(()=>{const row=SCATTER_ROWS.findIndex(a=>'+guns+'>=a[0]&&'+guns+'<=a[1]);return SCATTER[row]['+i+'];})()');
  if(got!==want)discord.push(['Convoy Scatter',r,i,want,got]);
 }
}
for(const [side,counts] of [['BR',[6,6,7,8,9,10,10]],['US',[10,10,9,8,7,6,6]]]){
 for(const [index,values] of [[-100,-70],[-69,-26],[-25,-16],[-15,0,15],[16,25],[26,59],[60,100]].entries()){
  for(const balance of values){const got=x('NB_CARDS['+JSON.stringify(side)+'][navalBalanceBand('+balance+')]');if(got!==counts[index])discord.push(['Naval Balance',side,balance,counts[index],got]);}
 }
}
const data={navalBalanceBandsPerMap:7,lakeCombatTable:70,convoyScatterTable:60,gunBandEndpointsTested:12,mismatches:discord};
fs.writeFileSync(path.join(__dirname,'map-results.json'),JSON.stringify(data,null,2));console.log(JSON.stringify(data));assert(!discord.length);
