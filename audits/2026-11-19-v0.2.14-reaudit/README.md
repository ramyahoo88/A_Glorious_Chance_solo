# v0.2.14 comprehensive re-audit - 19 November 2026

Audited `main` at `c8073ddd7d639b0f0c68b64f6d319a711c5c2bea`.

**Gameplay and persistence checks pass; one Medium and three Low display findings.**

- A01 Medium: occupied map-port dialogs show headings without the ships.
- A02 Low: automatic multi-step actions can omit intermediate movements.
- A03 Low: shared route badges overlap; crowded labels can hide arrowheads.
- A04 Low: the Tracks panel overflows at narrow desktop widths.
- Q01 optional: retain a way back to the map/fleet after inspecting a ship.

[Full report](A_Glorious_Chance_v0.2.14_Comprehensive_Reaudit.md) | [PDF](A_Glorious_Chance_v0.2.14_Comprehensive_Reaudit.pdf) | [Evidence ZIP](A_Glorious_Chance_v0.2.14_Reaudit_Evidence.zip) | [Reproduce](evidence/README.md)

Checks include 768 fresh gameplay campaigns, 6,144 independently reconstructed Tallies, 128 additional paired map/gameplay campaigns, two complete Chromium games through the visible controls, 70 map layouts, all existing engine/UI suites and exact release/download verification. No application code or published build was changed.
