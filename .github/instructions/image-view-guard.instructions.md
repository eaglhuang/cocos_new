---
doc_id: doc_ai_0013
applyTo: "**"
---

# Image View Guard

## Hard Rule

- Before every `view_image`, inspect the image size first.
- Use thumbnail-first progressive zoom: try `125px` first, and only enlarge when the thumbnail is not readable enough for the current task.
- If the image is a full-screen screenshot, browser capture, editor capture, or compare board, crop the relevant area first, then run the same progressive zoom rule on the crop.
- Default zoom ladder: `125px -> 250px -> 500px`, stopping at the first size that is sufficient. Do not jump directly to a larger width unless the previous rung was actually insufficient.
- `512px` is no longer the default reading size. Treat roughly `500px` as the practical upper rung, and do not read wider originals directly without explicit user approval.
- In one turn, prefer at most `1` main image plus `1` comparison image.

## Required Helper

- Use `node tools_node/prepare-view-image.js --input <path>` before `view_image` unless the image is already confirmed to be `<= 125px` wide and already readable for the current purpose.
- Preferred wrapper: `node tools_node/prepare-view-image-progressive.js --input <path> --level thumb`.
- The helper now defaults to `125px`; if the result is too small to judge, rerun with `--maxWidth 250`, then `--maxWidth 500` only if needed.
- If you do not want to remember the ladder manually, rerun the wrapper with `--level inspect`, then `--level detail`.
- If you want to advance from an existing preview path, use `--next --source <original-path>` so the wrapper still resizes from the original, not from an already shrunken preview.
- Only pass the helper output path to `view_image` when resizing was needed.
- If you truly need the original full-size image, get explicit user approval first.

## Capture Workflow Default

- Screenshot and capture workflows should prefer emitting view-safe small images by default.
- A temporary or one-off capture script is not exempt from this rule.
- If a capture flow cannot emit a small image directly, it must immediately pass the result through `prepare-view-image.js` before any `view_image`, starting from the `125px` rung.

## Intent

- This is a context-budget rule, not just a UI rule.
- Do not rely on memory. Treat the helper step as mandatory operational hygiene before image reading.
