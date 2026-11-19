// Historical regression positions assume the former automatic Event draw at a
// particular click. Keep those assertions on the engine's compatibility path.
// Only the test HTML is adapted. Production manual entry is covered separately
// by physical_events.js and complete, unmodified-browser campaigns.
module.exports = html => html.replace('/* ---- main.js ---- */',
  '/* Historical automatic-Event regression fixture. */\n' +
  'enablePhysicalEvents = function(s) { delete s.options.physicalEvents; };\n' +
  '/* ---- main.js ---- */');
