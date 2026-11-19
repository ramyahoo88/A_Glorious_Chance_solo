# Comprehensive audit and v0.2.9

18 November 2026. Baseline v0.2.8 at `ffd7317`; fixes released as v0.2.9 at `6dc43ca`. The audit prioritizes fresh games and current-game saves; historical migration behavior is unchanged.

- [Full report (Markdown)](A_Glorious_Chance_v0.2.9_Comprehensive_Audit.md)
- [Full report (21-page PDF)](A_Glorious_Chance_v0.2.9_Comprehensive_Audit.pdf)
- [Evidence, importable saves and runnable checks](A_Glorious_Chance_v0.2.9_Evidence.zip)

All 28 confirmed finding groups are fixed. Final verification includes 423 engine assertions, 101 DOM checks, 200 smoke games, 768 campaign executions, 128 intensive save campaigns and two complete native-Chrome games matching independent final-state replays. Both committed HTML and the public site are byte-identical to the separate rebuild.

Final HTML: 324,911 bytes; SHA-256 `ffa43b5dd90a5540c2757cb6701d8742e8a1eff8beba51a6ec27d4b1f7c815c4`.

**Verdict:** release for fresh games under the explicitly documented interpretations. The report separates Pursuit, OA1, missing Land Battle outcomes and other unresolved rulings from confirmed defects, and records physical-device, tabletop and combination-coverage limits.
