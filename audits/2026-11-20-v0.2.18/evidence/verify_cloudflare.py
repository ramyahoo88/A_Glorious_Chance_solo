"""Verify the complete retained site, app/download bytes and attachment names."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import sys
import urllib.request
import urllib.error

base, site_path, output_path = sys.argv[1:4]
site = Path(site_path)
manifest = json.loads((Path(__file__).parent / 'results/cloudflare-candidate-manifest.json').read_text())
dispositions = {}
current = None
for line in (site / '_headers').read_text().splitlines():
    if line.startswith('/'):
        current = line.strip()
    elif line.strip().lower().startswith('content-disposition:'):
        dispositions[current] = line.strip().split(':', 1)[1].strip()


def verify(path):
    expected = (site / path.lstrip('/')).read_bytes()
    request = urllib.request.Request(base.rstrip('/') + path, headers={
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
    })
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            actual = response.read()
            disposition = response.headers.get('Content-Disposition')
            content_type = response.headers.get('Content-Type')
            assert response.status == 200, (path, response.status)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'{path}: HTTP {error.code}: {error.read(300).decode(errors="replace")}') from None
    digest = hashlib.sha256(actual).hexdigest()
    assert actual == expected, 'Published bytes differ: ' + path
    assert digest[:32] == manifest[path], 'Published manifest differs: ' + path
    if path in dispositions:
        assert disposition == dispositions[path], (path, disposition, dispositions[path])
    return {'path': path, 'bytes': len(actual), 'sha256': digest, 'contentType': content_type, 'disposition': disposition}


with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    files = list(pool.map(verify, sorted(manifest)))
report = {'base': base, 'passed': True, 'verifiedFiles': len(files), 'attachmentHeaders': len(dispositions), 'files': files}
Path(output_path).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'files'}, indent=2))
