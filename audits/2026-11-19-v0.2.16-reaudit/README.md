# v0.2.16 re-audit

Audit of main `53656b345df49fefbddc2bc32e1a6a55a315c5a9`, 19 November 2026.

**One Medium and two Low findings; normal-play checks pass.** Read [the report](A_Glorious_Chance_v0.2.16_Comprehensive_Reaudit.md). This directory adds audit evidence only; it does not modify or deploy the app.

The main new evidence is 288 complete physical-card campaigns, two complete actual-control browser games, and three focused reproductions. The `corrupt-*.json` fixtures intentionally remove one required parent field; their neighboring originals are valid saves. Their rejection is the expected behavior for a future fix, whereas this audit records that v0.2.16 accepts them and then stalls.

## Reproduce

Use the audited commit and this directory. Node is required; DOM tests need jsdom 26.1.0. Real-browser scripts need Playwright and @sparticuz/chromium 153.0.0 on NODE_PATH. Tests in this audit do not edit application source.

```sh
npm test
npm run test:ui
python audits/2026-11-19-v0.2.16/evidence/verify_release.py
node audits/2026-11-19-v0.2.16-reaudit/evidence/campaign/sweep.js . 977000 16 fresh
AGC_OPTION_GRID=1 AGC_POLICIES=coast node audits/2026-11-19-v0.2.16-reaudit/evidence/campaign/sweep.js . 978000 64 options
node audits/2026-11-19-v0.2.16-reaudit/evidence/probes.js .
node audits/2026-11-19-v0.2.16-reaudit/evidence/browser/campaigns.js .
node audits/2026-11-19-v0.2.16-reaudit/evidence/browser/findings.js .
AGC_URL=https://ramyahoo88.github.io/A_Glorious_Chance_solo/ node audits/2026-11-19-v0.2.16-reaudit/evidence/browser/focused.js .
node audits/2026-11-19-v0.2.16-reaudit/evidence/printed/paper_checks.js .
node audits/2026-11-19-v0.2.16-reaudit/evidence/printed/map_checks.js .
node audits/2026-11-19-v0.2.16-reaudit/evidence/printed/tactic_fields.js .
```

Run on a copy: the commands write evidence beside their scripts. `AGC_REPLAY_PROBES=1` skips the completed search and rechecks the three existing damaged fixtures. Browser findings assert the observed defects and therefore should change when those defects are corrected. Full campaigns use separate physical-deck shuffles; strategy policies never use the deck order.

The live script uses the environment HTTPS proxy if present and trusts its inspection certificate in the isolated test context. It also verifies that Download app returns exactly the local release bytes. No existing user session is used.
