// Build dist/index.html: one self-contained offline file (no external resources).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const files = JSON.parse(fs.readFileSync(path.join(__dirname, 'files.json')));
const rd = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const js = files.engine.concat(files.ui).map(f => `/* ---- ${f} ---- */\n` + rd(f)).join('\n;\n');
const css = files.css.map(rd).join('\n');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A Glorious Chance – Solo Companion v${pkg.version}</title>
<style>
${css}
</style>
</head>
<body>
<div id="hdr"></div>
<div id="app"></div>
<div id="modal"></div>
<script>
"use strict";
${js}
</script>
</body>
</html>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(1) + ' KB');
