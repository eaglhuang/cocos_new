---
doc_id: doc_ai_0015
applyTo: "**"
---

# Token Guard

## Context Threshold

- Keep routine turns below roughly `6000` tokens when possible.
- If the working set grows past roughly `18000`, compress before continuing.
- If the working set approaches roughly `30000`, stop expanding context and shrink first.

## Default Guardrails

- Prefer `git status --short` and targeted reads over loading large files blindly.
- Read `docs/keep.summary.md (doc_index_0012)` (doc_index_0012) before reaching for larger consensus docs.
- Avoid dumping large notes, compare boards, or many screenshots into the conversation.
- For image artifacts, prefer at most `1` main image and `1` comparison image per turn.

## Image View Enforcement

- Before every `view_image`, inspect the image size first.
- Apply thumbnail-first progressive zoom: start at `125px`, and only enlarge when `125px` is not readable enough for the current decision.
- For full-screen screenshots, browser captures, editor captures, compare boards, and PrintWindow images: crop the relevant area first, then apply the same `125 -> 250 -> 500` ladder to the crop.
- `512px` is not the default reading width anymore. Use approximately `500px` only as the highest normal rung after smaller attempts failed.
- Before every `view_image`, run:
  - `node tools_node/prepare-view-image.js --input <path>`
- Preferred wrapper:
  - `node tools_node/prepare-view-image-progressive.js --input <path> --level thumb`
- If `125px` is insufficient, rerun with:
  - `node tools_node/prepare-view-image.js --input <path> --maxWidth 250`
  - then `node tools_node/prepare-view-image.js --input <path> --maxWidth 500` only if still necessary
- Or use the wrapper levels instead:
  - `node tools_node/prepare-view-image-progressive.js --input <path> --level inspect`
  - `node tools_node/prepare-view-image-progressive.js --input <path> --level detail`
- If you are advancing from an existing preview path, add `--source <original-path>` together with `--next`.
- If the helper emits a resized output path, only use that resized path for `view_image`.
- Only view a `>500px` original image when the user explicitly says to relax this rule.

## Handoff

- Keep handoff summaries short and focused on changed files, outcome, and next step.
