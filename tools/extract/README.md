# Card-data extraction scripts (provenance)

These one-off scripts read card data out of the published VASSAL module (`A_Glorious_Chance_v1-0.vmod`, unzipped into `vmod/`):

* `tools_target_ocr.py` OCRs the Target Card headers (zone, mission, secondary mission, condition text).
* `tools_grid.py` detects the ship icons in the U.S.-campaign (A) deployment tables.
* `tools_bcluster.py` clusters the Force Package numerals in the British-campaign (B) deployment tables. The clusters were then labelled by eye; 15 glyph clusters cover all 1400 cells.
* `tools_bgrid.py` was an OCR first pass for the B tables. It was superseded by the clustering approach.
* `tools_event.py` OCRs the Event Cards and detects their icons. The final event, tactic and ship data were checked against the card images by eye.

The results are baked into `src/data_targets.js` and `src/data.js`; the app doesn't need these scripts.
