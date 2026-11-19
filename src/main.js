/* Boot */
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
