# v0.2.17 comprehensive re-audit

20 November 2026. Main audited at `4980c08b807c9fef8b307354b2984677effbafd2`.

Normal campaign play passes the tested scenarios; a small recovery patch is recommended. Two confirmed findings: a remaining coastal-save validation gap (Medium) and lost physical-pile reconciliation after multiple Undos across a turn reset (Low). One optional Reference-topic improvement is described separately.

- [Full report](A_Glorious_Chance_v0.2.17_Comprehensive_Reaudit.md)
- [PDF report](A_Glorious_Chance_v0.2.17_Comprehensive_Reaudit.pdf)
- [Evidence archive](A_Glorious_Chance_v0.2.17_Reaudit_Evidence.zip)
- [Recorded evidence and reproduction scripts](evidence/)

All existing suites, 288 fresh physical campaigns, two complete Chromium campaigns, 84 map-layout cases and live release verification passed. The additional findings are reproduced separately with their exact scope and limits in the report. Application source and published app are unchanged.
