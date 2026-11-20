/* ============================================================================
   Procedure runner. Game flow is a stack of serialisable frames
   { proc, pc, A (args), L (locals), ret, answer }. Handlers return one of:
     G(pc)                    goto
     C(proc, args, thenPc)    call sub-procedure, resume at thenPc (f.ret holds result)
     R(value)                 return to caller
     P(prompt, thenPc)        wait for player input (f.answer) then resume at thenPc
   Everything in the state is plain JSON so save / load / undo are trivial.
   ========================================================================== */
const PROCS = {};
function G(pc) { return { goto: pc }; }
function C(proc, args, then) { return { call: proc, args: args || {}, then }; }
function R(v) { return { ret: v === undefined ? null : v }; }
function P(prompt, then) { return { prompt, then }; }

function topFrame(s) { return s.calls[s.calls.length - 1]; }

function run(s, onStep) {
  let guard = 0;
  while (!s.prompt && s.calls.length && !s.over) {
    if (++guard > 50000) throw new Error('Runaway procedure loop at ' + JSON.stringify(topFrame(s)).slice(0, 200));
    const f = topFrame(s);
    const proc = PROCS[f.proc];
    if (!proc) throw new Error('Unknown procedure ' + f.proc);
    const h = proc[f.pc];
    if (!h) throw new Error('No handler ' + f.proc + '.' + f.pc);
    const r = h(s, f);
    if (!r) throw new Error('Handler returned nothing: ' + f.proc + '.' + f.pc);
    // Optional presentation observer: never stored in the campaign or used to
    // choose a move. A handler is the boundary of an automatic procedure step.
    if (onStep) onStep(s);
    if (r.goto !== undefined) f.pc = r.goto;
    else if (r.call) { f.pc = r.then; f.ret = undefined; s.calls.push({ proc: r.call, pc: 'start', A: r.args, L: {} }); }
    else if (r.ret !== undefined) { s.calls.pop(); const p = topFrame(s); if (p) p.ret = r.ret; }
    else if (r.prompt) {
      f.pc = r.then; f.answer = undefined;
      s.prompt = Object.assign({ id: (s.promptSeq = (s.promptSeq || 0) + 1) }, r.prompt);
    } else throw new Error('Bad handler result ' + JSON.stringify(r));
  }
}

function act(s, answer, onStep) {
  if (!s.prompt) throw new Error('No prompt pending');
  s.build = APP_VERSION;   // marks saves written by the corrected procedures (see upgradeLegacy)
  const err = validateAnswer(s, s.prompt, answer);
  if (err) throw new Error(err);
  delete s.tableReport;
  // Routine notices do not reconcile physical cards. Keep the reminder until
  // the player resumes drawing from the restored pile.
  if (s.prompt.kind === 'event') delete s.eventRestore;
  const f = topFrame(s);
  f.answer = answer;
  s.prompt = null;
  run(s, onStep);
}

function validateAnswer(s, p, a) {
  if (p.kind === 'event') {
    if (!Number.isInteger(a) || !Object.hasOwn(EVENTS, a)) return 'Enter a whole Event card number from 1 to 38.';
    if (['US', 'BR'].some(sd => s.intelligence[sd]?.card === a)) return `Event #${a} is set aside for Intelligence. Draw another card.`;
    if (!s.deck.event.includes(a)) return `Event #${a} is not in the draw pile. Check the number or use Undo to correct the previous entry.`;
  } else if (p.kind === 'choice' || p.kind === 'info') {
    if (!p.options.some(o => o.id === a && !o.disabled)) return 'Invalid option ' + a;
  } else if (p.kind === 'select') {
    if (!Array.isArray(a)) return 'Selection must be an array';
    const ids = p.items.map(i => i.id);
    if (a.some(x => ids.indexOf(x) < 0)) return 'Unknown item in selection';
    if (new Set(a).size !== a.length) return 'Select each item only once.';
    if (p.min != null && a.length < p.min) return `Select at least ${p.min}`;
    if (p.max != null && a.length > p.max) return `Select at most ${p.max}`;
    if (p.validate) { const e = SELECT_VALIDATORS[p.validate](s, p, a); if (e) return e; }
    else if (p.pkg || p.title === 'Force Package #8 – second stack') {
      const e = manualPackageError(s, p, a); if (e) return e;
    }
  } else if (p.kind === 'assign') {
    const e = validateAssignment(s, p, a); if (e) return e;
  } else if (p.kind === 'lineup') {
    const e = validateLineup(s, p, a); if (e) return e;
  }
  return null;
}

/* Prompt builders -------------------------------------------------------- */
function choice(title, text, options, extra) {
  return Object.assign({ kind: 'choice', title, text, options: options.map(o => typeof o === 'string' ? { id: o, label: o } : o) }, extra || {});
}
function info(title, text, extra) {
  return Object.assign({ kind: 'info', title, text, options: [{ id: 'ok', label: 'Continue', primary: true }] }, extra || {});
}
// Pause for the player to mirror AI moves (skipped when confirmAiSteps is off)
function aiPause(s, title, text, then, extra) {
  if (!s.options.confirmAiSteps) return G(then);
  return P(info(title, text, extra), then);
}
const SELECT_VALIDATORS = {};

/* Event deck ----------------------------------------------------------- */
// Physical-card play uses a real saved procedure frame, so no game action is
// replayed when the player enters a card. Automatic draws remain available to
// engine-only regression/simulation callers; the app always enables physical draws.
function eventDrawText(s, purpose, gale, restoring = false) {
  const cards = s.deck.event.slice().sort((a, b) => a - b);
  const keep = ['US', 'BR'].map(sd => s.intelligence[sd]?.card).filter(Boolean);
  const setup = !s.eventCardsPrepared && !restoring ? (cards.length === 38 ? 'Shuffle your physical Event deck.' :
    `Prepare and shuffle the physical draw pile using these ${cards.length} cards: ${cards.join(', ')}. Keep the other cards aside.`) : '';
  return `${purpose}\n\n${gale ? 'Discard Event #30 (Gale) and draw another card for this check.\n\n' : ''}${setup}${setup ? '\n\n' : ''}Draw the top physical Event card and enter its printed number (1–38).` +
    (keep.length ? `\nKeep Intelligence card${keep.length > 1 ? 's' : ''} #${keep.join(', #')} out of the draw pile.` : '');
}
PROCS.eventDraw = {
  start(s, f) {
    if (!s.deck.event.length) {
      const keep = ['US', 'BR'].map(sd => s.intelligence[sd]?.card).filter(Boolean);
      s.deck.event = shuffle(s, Object.keys(EVENTS).map(Number).filter(id => !keep.includes(id)));
      s.eventsDrawn = []; s.eventCardsPrepared = false;
      log(s, 'Event deck exhausted – reshuffle the physical Event cards, keeping Intelligence cards set aside.', 'info');
    }
    return P({ kind: 'event', title: 'Draw an Event card',
      purpose: f.A.purpose, allowGale: !!f.A.allowGale,
      text: eventDrawText(s, f.A.purpose, f.L.gale),
      remaining: s.deck.event.length }, 'number');
  },
  number(s, f) {
    const id = f.answer;
    s.deck.event.splice(s.deck.event.indexOf(id), 1);
    s.eventsDrawn.push({ id, purpose: f.A.purpose });
    s.eventCardsPrepared = true;
    log(s, `Physical Event card #${id} entered for ${f.A.purpose}.`, 'event');
    if (id === 30 && !f.A.allowGale) {
      log(s, `Drew Event #30 Gale for ${f.A.purpose} – discarded and redrawn [2.5.1].`, 'event');
      f.L.gale = true; return G('start');
    }
    return R(id);
  }
};
function drawEvent(s, purpose, allowGale) {
  for (let tries = 0; tries < 200; tries++) {
    if (!s.deck.event.length) {
      const keep = [s.intelligence.US && s.intelligence.US.card, s.intelligence.BR && s.intelligence.BR.card].filter(Boolean);
      s.deck.event = shuffle(s, Object.keys(EVENTS).map(Number).filter(id => keep.indexOf(id) < 0));
      s.eventsDrawn = [];
      log(s, 'Event deck exhausted – reshuffled all Event Cards.', 'info');
    }
    const id = s.deck.event.shift();
    s.eventsDrawn.push({ id, purpose });
    if (id === 30 && !allowGale) { log(s, `Drew Event #30 Gale for ${purpose} – discarded and redrawn [2.5.1].`, 'event'); continue; }
    return EVENTS[id];
  }
  throw new Error('Event deck failure');
}

/* Tactic decks --------------------------------------------------------- */
function drawTactics(s, deckKey, n) {
  const key = deckKey === 'A' ? 'tacA' : 'tacD';
  const out = s.deck[key].slice(0, n);
  s.deck[key] = s.deck[key].slice(n);
  return out;
}
function returnTactics(s, deckKey, ids) {
  const key = deckKey === 'A' ? 'tacA' : 'tacD';
  s.deck[key] = shuffle(s, s.deck[key].concat(ids));
}
