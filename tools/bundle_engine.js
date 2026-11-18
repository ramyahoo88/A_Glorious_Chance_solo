// Concatenate the engine sources into one script usable from Node tests.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const files = JSON.parse(fs.readFileSync(path.join(__dirname, 'files.json'))).engine;
let src = files.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n;\n') + '\n;installResume();\n';
module.exports = function loadEngine() {
  const vm = require('vm');
  const ctx = { console, Math, JSON, Object, Array, String, Number, Error, Date };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__api = { newGame, run, act, PROCS, TARGET_CARDS, EVENTS, TACTICS, SHIP_BY_ID, def, isFull, shipName, sideShips, gameScore, validateAnswer, assignableShips, troopCapacity, defaultTows, canTow, isCLS, ZONES, MISSION_NAME, crtColumnForRatio, hitPosition, HIT_DIST, CRT, parseCrt };', ctx, { filename: 'engine.js' });
  return ctx.__api;
};
if (require.main === module) { fs.writeFileSync(path.join(root, 'dist', 'engine.js'), src); console.log('wrote dist/engine.js', src.length); }
