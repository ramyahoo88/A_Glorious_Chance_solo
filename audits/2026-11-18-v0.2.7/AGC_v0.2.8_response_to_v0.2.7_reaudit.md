# A Glorious Chance Solo Companion — response to the v0.2.7 re-audit

Reviewed audit: "v0.2.7 release and save recovery re-audit" (release commit `497721c`; evidence in `787fd3d`), findings N01–N03 and O01.
Result: v0.2.8, commit `ffd7317`, pushed to `main` and `release/v0.2.8`. GitHub Pages is on `gh-pages` commit `ef31610`. Built `dist/index.html`: 308,978 bytes, sha256 `386ef169acf1f508e1fe4eca3fff028f55d6ca86089170c1bd51601268ee9793`. Two builds were byte-identical.

All three findings and the optional item are confirmed and done. Your note says the earlier response attachment didn't reach you, so from now on each response is also committed next to your audit in `audits/<date>-v<version>/`.

## N01 — damage already applied by 0.2.6: confirmed, flagged
- **What the loader does:** a new `damageFrom026()` runs for every unstamped save, and once more for a 0.2.7 save that an upgrade touched. It looks for contradictions the corrected procedures never produce.
- **Contradictions it detects:**
  - **A surrender settled in the middle of its own Encounter chain.** A ship is `done` in the current Encounter, and its settlement line ("… is CAPTURED by the …" or "… is rescued and returns home") comes after the last Pursuit line, while its Strike Check is still pending in the frame lines or logged after that Pursuit. This catches Wolfe.
    - Ship lines are matched by name with any version and current-owner suffix ("Wolfe (B) [U.S.]"). Wolfe's capture had changed `shipName`, which is why a plain match missed him.
  - **An old Pursuit surrender settled differently from note 68.** The ship's Strike Check is before the Pursuit, but its recorded fate disagrees with the boundary rule (pursued Defender captured, Attacker rescued). This catches Asp, rescued by 0.2.6's 1d6 5.
  - **Troops queued by 0.2.6 after the A.I. had already used them.** Either a lookup on a Troops row of 1 or more happened between the abort and 0.2.6's "Older save upgraded" line, or an `aiDeploy` frame on the stack has a row larger than the Troops now Available. This catches B35.
- **What it does on a match:** it only flags the save. No rollback, as you suggested. The notice names the ship or the deployment and asks for the save from before 0.2.6 opened it.
- **Results:**
  - `V026_saved_after_wrong_Wolfe_repair.json` (Wolfe American and `done`, pending Strike Check 2+1), `V026_saved_after_wrong_Asp_repair.json` and `V026_saved_after_wrong_B35_repair.json`: each opens with its notice, the state left as saved. The notice persists (see N02).
  - Correct repairs are not flagged, for example `F02_just_after_Asp_pursuit.json`.

## N02 — the notice disappears on reopen: confirmed, fixed
- **Stored with the board:** unresolved notices are now saved in the state itself (`s.recovery`).
  - A red panel above every prompt shows them, with two buttons: **Load an earlier save** (opens Load) and **Keep playing this position** (acknowledges the notice and removes it).
  - The notice survives autosave, export, reload, Undo and further play, until the player loads another game or acknowledges it.
  - Successful repairs are still reported once, as before.
- **0.2.7 exports:** 0.2.7 stamped and exported positions after showing a notice it never stored. A save stamped 0.2.7 and touched by an upgrade (`s.migrated`) is therefore rechecked, for notices only. `V027_saved_after_E01…`, `…E02…` and `…L01_old_already_sailed` all show their notice again.
- **In Chrome**, with E01: the notice shows on opening, after reload/Continue it, after export and re-import, and after confirming the picker. It is gone after Keep playing, including after a reload.

## N03 — Undo omits the build stamp: confirmed, fixed
- **Fix:** `undo()` now stamps the restored state with the current build after the upgrade, exactly as a load does.
- **Result:** `V024_autosave_with_pre_F7_undo.json` restored as the autosave → Continue it → Undo gives 1 marker queued for F7, `build` 0.2.8, and the immediate export carries `build` 0.2.8.

## O01 — ∞ vs 99 at zero Defense: done
Gunnery and Harbor Gunnery round texts now print ∞:1 when Defense is 0, matching the previews. The column logic is unchanged (3:1+).

## How it was checked
- **Repository:**
  - `npm test`: unit 65, scenario 14, regression 153 (14 new), sim 100. 0 failures.
  - The new checks load six of your positions, kept as fixtures in `tests/fixtures/audit-v0.2.7/`.
  - Against v0.2.7, all 14 new checks fail, and the three earlier F03/F04 warning checks fail too, because they now read the stored notice. All pass on v0.2.8.
  - `tests/sim.js 400` and my audit sims: no violations.
- **Your sweeps (`scan_saves.js`), checked by the v0.2.8 loader:**

| Saves from | Seeds | Loads or comparisons | Differences |
|---|---|---|---|
| v0.2.8 fresh | 191000–191511 | 42,709 loads | 0 |
| v0.2.7 | 191000–191511 | 42,709 loads | 0 |
| v0.2.6 | 191000–191511 | 42,709 loads | 0 |
| v0.2.4 legacy | 191000–191511 | 1,713 prizes | 0 |
| v0.2.4 legacy | 300000–303071 (12,288 campaigns) | 9,816 prizes | 0 |

- **`compare_play.js` against v0.2.6** (512 games, 72,844 prompts): every prompt, final board and ledger matches. The one exception is the intended "99:1" → "∞:1" text, so I ran it with that text normalised. Unmodified, it stops at the first zero-Defense round.
- **Your other scripts:**
  - `followup_rules.js`: 9/9. `next_rules.js`: 28/28. `new_boundaries.js`: 11.
  - `edges.js`: 29. `map_checks.js`: no mismatches. `boundary_checks.js`: 23.
  - `recheck_engine.js`: all passing. `campaigns.js`: no stock changes.
  - `timing_campaigns.js`: 0 re-embarks.
  - `paper_checks.js`: only the documented Package 8 row.
  - `recovery_paths.js` needs jsdom. I ran the same routes in Chrome instead.
- **Real Chrome** (Playwright), at 1300 px and 390 px:
  - the three N01 saves, flagged and unchanged, with the notice kept after reload;
  - the N02 route above, plus the "Load an earlier save" button;
  - the N03 Undo export;
  - the correct-repair control.
  - No page errors and no overflow. The smoke runs and full UI audits for both campaigns are clean.
- **Compatibility:** 160 v0.2.7 mid-game saves pass the check and finish in v0.2.8. All 90 of your saves across the evidence sets load.

## Open questions (unchanged)
Aid VII 62–63 at 0 Long Gun / 3 Troops; Package 8's first-Force choice; return timing for used or negated Tactics other than Rake. Mobile hardware and offline home-screen launch are still untested here.
