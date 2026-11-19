/* Boot */
// Copy only the app's static head and this inline script, before rendering.
// Browsers/extensions may insert overlays elsewhere in the document; never
// export those, a live game or a dialog. No fetch or network is needed.
const APP_DOWNLOAD_HTML = '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
  ['meta[charset]', 'meta[name="viewport"]', 'title', 'style'].map(selector => document.head.querySelector(selector).outerHTML).join('\n') +
  '\n</head>\n<body>\n<div id="hdr"></div>\n<div id="app"></div>\n<div id="modal"></div>\n' +
  document.currentScript.outerHTML + '\n</body>\n</html>\n';
installResume();
document.addEventListener('keydown', (e) => {
  if (modalKeydown(e) || e.defaultPrevented || e.repeat) return;
  if (!G_STATE) return;
  // Text editors keep their own Undo. Game Undo also works when a button has
  // focus, but Enter and Space must activate that button rather than advance play.
  const target = e.target && e.target.closest ? e.target : null;
  if (target && target.closest('input, select, textarea, [contenteditable="true"]')) return;
  if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); return; }
  if (!G_STATE.prompt || target && target.closest('button, summary, a[href], [role="button"]')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.key === 'Enter' || e.key === ' ') && G_STATE.prompt.kind === 'info') { e.preventDefault(); doAct('ok'); }
});
window.addEventListener('load', () => { G_STATE = null; render(); });
