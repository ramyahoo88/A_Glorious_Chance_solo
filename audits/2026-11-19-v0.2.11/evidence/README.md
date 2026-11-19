# Reproduce this audit

Audit target is main `fe636b21e2ee0027c611acd873ebea89189ed057` of `ramyahoo88/A_Glorious_Chance_solo`, app v0.2.11. `source-manifest.json` records the shipped HTML hash, publisher PDF URLs and hashes, and source hashes.

Run these commands from this evidence directory. Replace `/path/to/repository` with a checkout of the audited revision. Node 24 was used. DOM checks require jsdom 26.1.0 on `NODE_PATH`. No npm dependencies were added to the application repository.

```sh
node campaign/sweep.js /path/to/repository 920000 160 fresh
AGC_OPTION_GRID=1 AGC_POLICIES=coast node campaign/sweep.js /path/to/repository 943000 64 options
node table/grouped_campaigns.js /path/to/repository 80
node deploy/setup-and-packages.js /path/to/repository
node printed/paper_checks.js /path/to/repository
node printed/map_checks.js /path/to/repository
node printed/tactic_fields.js /path/to/repository
node probe.js /path/to/repository
node rule_replays.js /path/to/repository
NODE_PATH=/path/to/jsdom/node_modules node targeted.js /path/to/repository
NODE_PATH=/path/to/jsdom/node_modules node browser/campaign_controls.js /path/to/repository US 941119 coast group
NODE_PATH=/path/to/jsdom/node_modules node browser/campaign_controls.js /path/to/repository BR 941120 coast
```

From the application checkout also run `npm test` and, with jsdom available, `npm run test:ui`. Complete captured output is in `results/`. The independent campaign and component scripts were carried forward from the previous audit. Fresh main, option, grouping and setup seeds are documented in the report. `probe.js` searches natural campaigns to save interesting positions; it is diagnostic, not the scored 1,728-case matrix.

## Importable positions

Use the app's Load → paste text → Load pasted text. The files below are raw states accepted by the supported importer.

| File under `targeted/` | Origin and next action |
| --- | --- |
| `command.json` | Natural U.S. 920000. A01. Adjust Oneida to Out of Play, then Attack. It remains an attacker. |
| `tactics.json` | Natural continuation of that campaign. Moving Oneida out of play still leaves it contributing to the next roll. |
| `gunnery.json` | Natural round-result position. Active ship correction is accepted here too. |
| `lineup.json` | Nearby control. The same correction is correctly blocked at lineup. |
| `unknown-event-save.json` | **Intentionally damaged test file**. Natural Encounter save with the next Event ID changed to 999. It must eventually error on the audited build. Do not use it as a campaign backup. |
| `melee-loser-before.json` | Natural U.S. 920016, August I. Continue. The losing flagship skips its casualty roll. |
| `double-leader-before.json` | Natural U.S. 920023, August II. Attack. Both named U.S. commanders die within one hit result. Q01, not a confirmed rules defect. |
| `zero-guns-before.json` | Natural British 920011, August II. Continue. A reduced ship with zero eligible guns scatters an unescorted convoy. Q02. |

The `*-after.json`, `natural-metadata.json`, `rule-replay-results.json` and `targeted-results.json` files record the observations. A01 was also reproduced in the real public Chromium app; `browser/chrome-adjust-ghost.json` is its actual export. The rule replays do not alter natural positions or mock dice. The damaged-save test intentionally alters one card reference and is clearly separate.

## Browser evidence

`browser/controls-941119.json` and `controls-941120.json` contain the complete DOM-control reference sequences. Their final saves are under `browser/checkpoints/`. The public Chrome run activated those controls through the browser UI, checking each prompt title. Full exported final states are `chrome-final-US.json` and `chrome-final-BR.json`; `chrome-verification.json` records exact equality with the reference states. The initial 15 U.S. prompts ran before progress-file logging was installed; the timeout interrupted an assignment draft, which was removed and re-entered before continuing. The final complete-state comparison covers the entire run. The JSONL includes a repeated U.S. Tactics step used for the Undo test.

`browser-save-checks.json` records actual Undo and reload equality at a combat stop. Screenshots show final results. The existing browser save was backed up and restored but is excluded from this public evidence package.

The local native Chromium process could not start because its socket call was denied. This is an environment limitation, not an app failure. Real-browser tests used the cloud Chromium session. A synthetic seed-field fill did not dispatch its change handler there; real keyboard entry did. The correct seed was verified before the accepted runs. DOM emulation and live Chromium are reported separately.

The publisher PDFs are linked and hashed rather than redistributed. The evidence contains facts transcribed for checks, not a new copy of the game's physical components. `manifest.json` hashes every evidence file other than itself.
