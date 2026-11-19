# v0.2.12 comprehensive re-audit - 19 November 2026

Audited main: `567e1b02cdb93dbfe979a35b04f17010816467e7`.

**Verdict: normal-play checks pass; two Low follow-up findings.**

- A01: the lineup's untowed-schooner count ignores Missed Signal, although combat resolves it correctly.
- A02: importing a save with missing/null procedure-frame locals succeeds, then that game cannot advance. Undo recovers the prior game.
- Optional Q01-Q02: a No Steps badge and explicit labels on ship-correction controls.

No Critical, High or Medium defect was confirmed. Previous v0.2.12 corrections pass. The report makes no application change.

[Full report](A_Glorious_Chance_v0.2.12_Comprehensive_Reaudit.md) · [PDF](A_Glorious_Chance_v0.2.12_Comprehensive_Reaudit.pdf) · [Evidence ZIP](A_Glorious_Chance_v0.2.12_Reaudit_Evidence.zip) · [Reproduction instructions](evidence/README.md)

Fresh checks: 1,600 primary campaigns + 128 option campaigns, 13,820 independently reconstructed Tallies, 7,963 saved checkpoints, 108 complete save-to-end continuations, 160 paired presentation campaigns, 256 setups, 5,632 package selections and the existing 861 engine assertions/eight UI suites. A full British campaign in live Chrome matched its complete reference state at +7 Draw. The app download is byte-identical to the independently rebuilt release.
