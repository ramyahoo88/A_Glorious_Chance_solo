# A Glorious Chance Solo Companion — response to the v0.2.6 re-audit

Reviewed audit: "v0.2.6 release and save re-audit" (release commit `b7eb835`; evidence in `770afde`), findings F01–F04.
Result: v0.2.7, commit `497721c`, pushed to `main` and `release/v0.2.7`. GitHub Pages is on `gh-pages` commit `983d43e`. Built `dist/index.html`: 303,301 bytes, sha256 `766c2f02571355310d2592bf3b04be7ca054f5cb6b1add081434e3daa03d6806`. Two builds were byte-identical.

All four findings are confirmed and fixed.
- **Cause:** the v0.2.6 repair decided "old" from the absence of evidence. A surrender with no later Strike line was treated as pre-Pursuit, even when its Strike Check was still in the pending combat lines.
- **Approach now:** v0.2.7 never touches saves written by the corrected code. It changes an older save only on affirmative evidence, and it settles from the state at the boundary. Where it can't rebuild the position exactly, it leaves the save as it is and says so.

## F01 — fresh surrender captured on reload/Undo: confirmed, fixed
- **Build stamp:** every state now carries `build`, set by `newGame`, by every `act()`, and by `checkSaveState` after a load.
  - `upgradeLegacy` returns at once for a stamped save.
  - Snapshots taken during play are stamped, so Undo can never upgrade them.
  - `checkSaveState` no longer fills `build` in from a fresh game, so an older save is still recognised as older.
- **Unstamped (v0.2.6 and earlier) saves:** a pending Struck Colors ship counts as pre-Pursuit only if one of these holds:
  - its "… Strike Check … STRIKES COLORS." line was logged before the last Pursuit line this turn;
  - no combat has taken place since that Pursuit (no Gunnery Round line after it, no combat frame and no pending lines).
- **Treated as the new Encounter's:** a Strike Check in any pending frame's `L.lines`, or logged after the Pursuit. That ship waits for the end of its own Encounter.
- **Results:**
  - `F01_fresh_before_Wolfe_strikes.json` in Chrome: Continue reaches the withdrawal prompt with Wolfe British and Struck. After reload → Continue it, and after Ignore → Undo, he is still British and Struck. No notice appears.
  - `F01_fresh_pending_withdrawal.json` and `F01_fresh_pending_flag_transfer.json`: unchanged, no notice.
  - Your `prove_pursuit_boundaries.js --require-fixes` passes. Normal and reloaded play reach the same tally (15) and the same single Growler credit.
- **Sweeps:**
  - `scan_migrations.js` on 2,048 fresh v0.2.7 campaigns (seeds 191000–191511, baseline v0.2.5): 42,709 loads, 0 changed, 1,190 existing `flagIn` normalisations.
  - The same scan with **v0.2.6 as the engine**, so its saves are unstamped and test the evidence rules themselves: 42,709 loads, 0 changed. Your 20 `fresh-*-unexpected-change` positions all load unchanged with no notice.

## F02 — later casualty reverses an old prize: confirmed, fixed
- **Fix:** `settleStruck` has an `atBoundary` mode for repairs. Only the pursued side counts as withdrawn and the pursuer as present, whatever has been sunk since.
  - The pursued side is the Defender of the last Gunnery Round line before the Pursuit. CRT results never combine attacker and defender withdrawal, so a DW cancelled by Pursuit always leaves the pursuer present.
  - The pursued Defender's struck ships are Captured and the Attacker's are Rescued, with no roll.
  - If that line can't be found, nothing is changed and a notice asks for a save from before the Pursuit.
- **Results:**
  - `F02_just_after_Asp_pursuit.json` and `F02_after_Melville_sinks.json` both give Asp captured by the British. In the later save, Julia, who struck in the new Encounter, stays pending.
  - Your legacy sweep (v0.2.4 engine, 2,048 campaigns, 1,224 pending-surrender prompts): 0 mismatches against the boundary settlement.
  - All 12 `legacy-*-changed-fate` positions now match the expected owner and status.

## F03 — manual B35 picker keeps the inflated row: confirmed, handled by notice
- **What the repair checks first:** whether the A.I. has already counted the early marker. It counts as counted if any of these appear after the old abort line this turn:
  - a deployment lookup on a Troops row of 1 or more;
  - a Force sailing "Carrying … Troops";
  - an A.I. landing;
  - an `aiDeploy` frame on the stack whose cell row is already chosen.
- **If it has been counted:** nothing is changed and the notice asks for a save from before the withdrawal. I chose this rather than re-entering the card lookup. Rebuilding the picker would replay the lookup with dice that have already moved on, so the result wouldn't match a replay from the earlier save.
- **Results:**
  - `E01_old_B35_at_package_picker.json`: notice, 2 markers Available, nothing queued, prompt unchanged.
  - `E01_manual_package_control.json`: still reaches 0 and supply 1.
  - The original L01 saves (no lookup yet) still repair as before.

## F04 — no warning at Tally: confirmed, fixed
- **Fix:** the Troops check now also runs in the Tally phase.
  - At Tally it only ever warns, because F7 hasn't run yet and a queued marker would come back to the same place.
  - When the log shows the marker was used, the notice says the Tally has already scored that deployment and points to the earlier save. The scored turn is left as saved.
- **Results:** `E02_old_after_Kingston_Tally.json` shows the notice. `L01_old_already_sailed.json` still warns.

## How it was checked
- **Repository:**
  - `npm test`: unit 65, scenario 14, regression 139 (12 new), sim 100. 0 failures.
  - The new checks load seven of your positions, kept as fixtures in `tests/fixtures/audit-v0.2.6/`. Run against v0.2.6, eight of them fail, covering every F01–F04 defect assertion. All pass on v0.2.7.
  - The earlier L01/L02 tests now recreate v0.2.4 saves without the build stamp.
  - `tests/sim.js 400` and my audit sims (400 + 400 manual): no violations.
- **Your scripts on v0.2.7:**
  - `scan_migrations.js` (fresh and legacy) and `prove_pursuit_boundaries.js --require-fixes`: as above.
  - `followup_rules.js`: 9/9. `next_rules.js`: 28/28. `new_boundaries.js`: 11.
  - `edges.js`: 29. `map_checks.js`: no mismatches. `boundary_checks.js`: 23.
  - `recheck_engine.js`: all passing. `campaigns.js`: no stock changes.
  - `timing_campaigns.js`: 0 re-embarks.
  - `paper_checks.js`: only the documented Package 8 row.
  - The jsdom-based scripts can't run here. Chrome covers the same saves.
- **Real Chrome** (Playwright), at 1300 px and 390 px:
  - the F01 reload and Undo route;
  - both F01 v0.2.6 saves and both F02 saves;
  - E01, E02 and the already-sailed save, each showing its notice with nothing changed;
  - the original L01/L02 repairs.
  - No page errors and no overflow. The smoke runs and full UI audits for both campaigns are clean.
- **Compatibility:** 160 v0.2.6 mid-game saves pass the check and finish in v0.2.7. All 95 of your saves across the four evidence sets load.

## Open questions (unchanged)
Aid VII 62–63 at 0 Long Gun / 3 Troops; Package 8's first-Force choice; return timing for used or negated Tactics other than Rake. Mobile hardware and offline home-screen launch are still untested here.
