# Reproduce the v0.2.12 re-audit

Target main `567e1b02cdb93dbfe979a35b04f17010816467e7`. Run from the repository root. Node and jsdom 26.1.0 were used. Set NODE_PATH to an installed jsdom directory; no runtime dependency was added to the app.

```sh
npm test
npm run test:ui
node audits/2026-11-19-v0.2.12-reaudit/evidence/campaign/sweep.js . 960000 160 fresh
AGC_OPTION_GRID=1 AGC_POLICIES=coast node audits/2026-11-19-v0.2.12-reaudit/evidence/campaign/sweep.js . 962000 64 options
node audits/2026-11-19-v0.2.12-reaudit/evidence/table/grouped_campaigns.js . 80
node audits/2026-11-19-v0.2.12-reaudit/evidence/deploy/setup-and-packages.js .
node audits/2026-11-19-v0.2.12-reaudit/evidence/printed/paper_checks.js .
node audits/2026-11-19-v0.2.12-reaudit/evidence/printed/map_checks.js .
node audits/2026-11-19-v0.2.12-reaudit/evidence/printed/tactic_fields.js .
node audits/2026-11-19-v0.2.12-reaudit/evidence/targeted/probe.js .
node audits/2026-11-19-v0.2.12-reaudit/evidence/targeted/render-checks.js .
node audits/2026-11-19-v0.2.12-reaudit/evidence/targeted/import-checks.js .
node audits/2026-11-19-v0.2.12-reaudit/evidence/browser/campaign_controls.js . BR 965119 coast group
python audits/2026-11-19-v0.2.12-reaudit/evidence/verify_release.py
```

Scripts write their results beside themselves, so run on a copy if preserving original audit bytes. The broad harnesses and component oracles were carried forward, with new main/option/group/setup seeds; retained component transcriptions were not newly recreated. The source manifest identifies the release and publisher documents.

## Importable positions

Open Load and paste the complete file contents.

| File in targeted/ | Provenance and use |
| --- | --- |
| missed-tower.json | Natural U.S. 961377, fleet, July II. A01: Madison misses the Round; preview says 7 untowed. Accept lineup, choose Pursuit, Continue: actual roll correctly counts 8. |
| tow-preview.json | Natural U.S. 961019, fleet, June II. A01 nearby control: Growler misses the Round; preview counts 9, actual participating count is 8. |
| zero-strength-chip.json | Natural British 961000, coast, July II. Q01: Sir Sidney Smith has zero steps and Fight On; engine combat strengths are zero, chip retains printed Reduced values with empty dots. |
| missing-frame-locals.json | DELIBERATELY DAMAGED British 966001 save: deleted calls[0].L. A02: imports, then June I choice errors. Undo restores the prior game. |
| null-frame-locals.json | DELIBERATELY DAMAGED sibling: calls[0].L=null. Same failure. |
| unknown-event.json | DELIBERATELY DAMAGED control: Event ID 999 is correctly rejected by the v0.2.12 fix. |
| valid-control.json | Intact British 966001 A1 save. Imports and advances normally. |
| zero-precondition.json | REJECTED DIAGNOSTIC LEAD, NOT A FINDING. This is a first Breakout attack; the actual procedure waives the A.I. precondition. Read candidate-disposition.json. |

The rendering and import scripts reproduce observations, rather than expecting the future fixes to exist. The targeted search scanned 2,268 policy cases and is not part of the 1,728-game invariant-checked matrix.

## Browser evidence

`browser/controls-965119.json` records the DOM-control reference. `browser/checkpoints/game-over-965119.json` is its final export; `browser/chrome-final-BR.json` is the live Chrome export. `browser-verification.json` records exact whole-state equality, the independently summed ledger, reload and actual app-download hash. Screenshots show the result, towing mismatch and damaged-import error. `restoration.json` confirms the original campaign/60-step Undo restoration, without publishing its contents.

The Chrome replay normalized consecutive spaces when matching prompt titles; no action was changed. A failed exact label selector in Reference was replaced by the observed select control. These were automation adjustments, not application defects. Console observations returned extension metadata errors, which were excluded from app findings.

`natural-replays.json` is a fresh run of the existing v0.2.12 combat/convoy regressions. The manifest excludes itself and hashes all other evidence files. No publisher PDFs or private user save is redistributed.
