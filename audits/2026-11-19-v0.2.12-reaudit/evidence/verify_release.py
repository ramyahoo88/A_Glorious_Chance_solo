"""Independent assembly, separate from tools/build.js; writes no source/build files."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[3]
spec = json.loads((root / "tools/files.json").read_text())
version = json.loads((root / "package.json").read_text())["version"]
js = "\n;\n".join("/* ---- " + name + " ---- */\n" + (root / "src" / name).read_text()
                  for name in spec["engine"] + spec["ui"])
css = "\n".join((root / "src" / name).read_text() for name in spec["css"])
html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A Glorious Chance – Solo Companion v{version}</title>
<style>
{css}
</style>
</head>
<body>
<div id="hdr"></div>
<div id="app"></div>
<div id="modal"></div>
<script>
"use strict";
{js}
</script>
</body>
</html>
'''.encode()
assert html == (root / "dist/index.html").read_bytes(), "Independent rebuild differs"
print(json.dumps({"independentRebuildMatches": True, "version": version,
                  "bytes": len(html), "sha256": hashlib.sha256(html).hexdigest()}, indent=2))
