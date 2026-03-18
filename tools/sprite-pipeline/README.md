# Sprite Pipeline

Automated spritesheet processing for Cocos Creator projects.

## What It Does

- Green-screen removal (chroma key)
- Connected-component based frame extraction
- Bottom-center anchor alignment to reduce animation jitter
- Auto naming: `character_action_01.png`, `character_action_02.png`, ...
- Writes output both to:
  - `tools/sprite-pipeline/output/...`
  - `assets/resources/sprites/...` (for direct Cocos usage)

## Quick Start

1. Install dependency once:

```bash
cd tools/sprite-pipeline
npm install
```

2. Put source spritesheet images into:

`tools/sprite-pipeline/input`

Recommended naming: `zhangfei_walk_sheet.png`

3. Run pipeline:

```bash
cd tools/sprite-pipeline
npm run run
```

Or run from Cocos menu:

`Extension -> Studio Tools -> Run Sprite Pipeline`

## Config

Default config file:

`tools/sprite-pipeline/config/default.config.json`

Useful knobs:

- `minComponentArea`: Ignore tiny noise blobs
- `componentPadding`: Expand each frame bbox to avoid clipping trails
- `alignPadding`: Bottom margin for anchor alignment
- `greenKey`: hard/soft green removal thresholds
- `output.format`: `png` or `webp`

## Output Structure

Example output for `zhangfei_walk_sheet.png`:

- `tools/sprite-pipeline/output/zhangfei/walk/zhangfei_walk_01.png`
- `tools/sprite-pipeline/output/zhangfei/walk/zhangfei_walk_02.png`
- `tools/sprite-pipeline/output/zhangfei/walk/zhangfei_walk.json`
- `assets/resources/sprites/zhangfei/walk/*.png`

## Notes

- Frame order is row-major after component detection.
- If generated order is not the intended action sequence, split source sheet by action first.
- For effects trails, increase `componentPadding`.
