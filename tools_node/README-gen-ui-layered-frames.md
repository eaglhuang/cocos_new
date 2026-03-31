Gen UI Layered Frames (scan + report)
===================================

This now covers scan/report plus renderer handoff for preview/apply.

Usage
-----

Run from the repository root:

```bash
node tools_node/gen-ui-layered-frames.js -ReportPath artifacts/ui-layered-frames/report.json
node tools_node/gen-ui-layered-frames.js -FamilyFilter detail. -Preview -ReportPath artifacts/ui-layered-frames/report.json
node tools_node/gen-ui-layered-frames.js -FamilyFilter detail. -Apply -RefreshCocos -ReportPath artifacts/ui-layered-frames/report.json
```

Options supported (minimal):

- `-SkinPath <path>` : path to a single skin manifest JSON or a directory containing skin JSONs (defaults to `assets/resources/ui-spec/skins`).
- `-FamilyFilter <prefix>` : only include families starting with prefix.
- `-ReportPath <path>` : output report JSON path.
- `-FailOnMissingMeta` : exit with non-zero if any family is missing `frame`.
- `-RefreshCocos` : attempt to call `http://localhost:7456/asset-db/refresh` after report.
- `-Preview` : invoke the renderer and emit preview PNGs under `artifacts/ui-layered-frames/preview`.
- `-Apply` : invoke the renderer and write runtime PNGs into `assets/resources/sprites/ui_families/...`.

Notes
-----

- The report contains family IDs, roles found, missing roles, and basic border checks for `sprite-frame` samples.
- Rendering is performed by `tools/gen-ui-layered-frames.ps1`, which generates ink-wash panel layers, field wash strips, and metallic tab button assets.
