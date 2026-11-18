/* Seeded RNG (mulberry32). The RNG state lives in the game state so that
   save / load / undo reproduce the same dice. */
function rngNext(s) {
  let t = (s.rng = (s.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rint(s, n) { return Math.floor(rngNext(s) * n); }
function d6(s) { return rint(s, 6) + 1; }
function d10(s) { return rint(s, 10); }          // 0-9, as printed on the game's d10
function d10r(s) { return rint(s, 10) + 1; }     // 1-10 reading (Strike checks, upgrade table)
function twoD6(s) { return d6(s) + d6(s); }
function d66(s) { const r = d6(s), b = d6(s); return { red: r, blue: b, v: r * 10 + b }; }
function pick(s, arr) { return arr[rint(s, arr.length)]; }
function shuffle(s, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rint(s, i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
