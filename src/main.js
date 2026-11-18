/* Boot */
installResume();
document.addEventListener('keydown', (e) => {
  if (!G_STATE || !G_STATE.prompt) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  if ((e.key === 'Enter' || e.key === ' ') && G_STATE.prompt.kind === 'info') { e.preventDefault(); doAct('ok'); }
  if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
});
window.addEventListener('load', () => { G_STATE = null; render(); });
