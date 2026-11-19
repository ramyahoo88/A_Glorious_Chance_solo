const fs = require('fs');
const path = require('path');
const vm = require('vm');
module.exports = function load(repo) {
  const order = JSON.parse(fs.readFileSync(path.join(repo, 'tools/files.json'))).engine;
  const ctx = vm.createContext({console, Math, JSON, Object, Array, String, Number, Error, Date});
  vm.runInContext(order.map(f => fs.readFileSync(path.join(repo, 'src', f), 'utf8')).join('\n;\n')+'\n;installResume();', ctx);
  return {ctx, x: code => vm.runInContext(code, ctx)};
};
