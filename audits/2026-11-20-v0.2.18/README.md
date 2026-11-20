# v0.2.18 recovery patch and Cloudflare publication

20 November 2026. Implements A01, A02 and Q01 from the v0.2.17 comprehensive re-audit at `bcc6081`.

Both reproduced defects are corrected. The physical Event deck remains required. Rules, deployment, combat and scoring algorithms are unchanged.

**Published:** [Play on Cloudflare](https://solo-table.pages.dev/games/a-glorious-chance/) · [Download the offline HTML](https://solo-table.pages.dev/downloads/a-glorious-chance). Production deployment `78765fff-084f-4904-9767-5a3e07ca267d` completed successfully on 20 November 2026. Both the preview and public alias pass all 67 recovery/browser assertions, exact app-download verification, and byte comparisons for all 31 site files plus all nine attachment headers. The catalog browser check confirms ten games, two desktop columns, phone fit, and working launch/download controls.

Code and evidence are pushed to [release/v0.2.18, PR #1](https://github.com/ramyahoo88/A_Glorious_Chance_solo/pull/1); the catalog addition is in [solo-automa PR #1](https://github.com/ramyahoo88/solo-automa/pull/1). Automatic approval review blocked direct default-branch pushes as outside the Cloudflare publication request, so both PRs remain drafts. Publication uses the tested release branch; the existing GitHub Pages copy remains available separately.

| Item | Change | Verification |
| --- | --- | --- |
| A01 | Validate coastal side order and integer cursor, side agreement, pending queues and remaining Land Battle records before import replaces the campaign. | Both original missing-order saves are refused atomically through real Load controls, including the typed Event number, Undo history and autosave. Unmodified originals finish Coastal Action. The launched-Troops/missing-support control still passes. |
| A02 | Save a pending reconciliation record at non-Event checkpoints; carry it through subsequent Undos, routine Continue, reload and Save transfer. Clear it at the next accepted physical Event entry. | Seed 986000 is played through its original 26 real actions; ten Undos now retain `cards: [2], reshuffled: true` and explicitly require rebuilding the 34-card draw pile. Intermediate reload/transfer and exact gameplay restoration pass. |
| Q01 | Reuse the read-only Event deck panel in Reference at every campaign checkpoint. | Real controls verify sorted public card membership and unchanged campaign, unfinished input, Undo, RNG and autosave; the topic selector has an explicit accessible name. |

Validation completed:

- `npm test`: all historical engine/data/regression checks, 200 smoke campaigns, physical Event coverage (32,287 assertions; 64 paired campaigns) and the new 79 recovery assertions pass.
- `npm run test:ui`: all 13 existing interface suites pass, including physical entry and v0.2.17 recovery. The historical automatic-Event test fixture remains supported.
- `npm run test:browser`: 67 real Chromium control assertions pass, including atomic damaged imports, full Coastal continuation, the natural ten-Undo trace, intermediate reload/Save transfer, Reference and the exact offline download.
- Fresh option grid: 128 complete physical campaigns, seeds 988000–988063, both sides and all 64 engine-option combinations, coastal policy. Zero failures across 21,630 decisions, 5,070 physical entries, 5,686 exact saved continuations, 953 manual Force Packages and 227 manual Land Battles.
- Two complete Chromium campaigns: U.S. seed 987001 (desktop, individual notices), 124 actions/24 entries; British seed 987002 (390 px, grouped notices), 149 actions/38 entries. Every control matches the native reference and final VP ledger. Ten reloads, seven exact Undo/replays and eight Map/Deck inspections pass; no browser errors.
- Independent rebuild and both staged Cloudflare app/download files are byte-identical: 423,428 bytes; SHA-256 `c1670ee2f30d1cc948805afb3781c7d1a91a2785bb02a37298d00e15c9d579f3`.

The Cloudflare catalog starts from the existing production deployment `d7da274a-9780-4599-a127-772b9da81e59`. Its 29-file manifest matches the recovered publication snapshot exactly. The candidate retains all 28 existing assets other than the intentionally updated catalog, preserves all eight existing download Content-Disposition rules, and adds the new app/download plus its catalog entry. The before/candidate manifests retain the exact existing asset references; catalog and new app/download files are prepared for `ramyahoo88/solo-automa`.

Results and reproduction scripts are under `evidence/`. Run the campaign grid with `AGC_OPTION_GRID=1 AGC_POLICIES=coast node audits/2026-11-20-v0.2.18/evidence/campaign/sweep.js . 988000 64 options`. The browser campaign runner needs Playwright and @sparticuz/chromium 153.0.0 on NODE_PATH. No physical Android device, Firefox or Safari test was performed. These campaigns verify implementation and persistence; they do not measure human difficulty or competitive balance.
