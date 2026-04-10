---
name: comfyui-sdxl-partial-asset-gen
description: 'Local ComfyUI / Stable Diffusion SDXL partial-asset generation workflow. Use for ComfyUI, stable diffusion, SDXL, LoRA, badge, cap, plaque, panel fragment, local UI asset exploration, and saving generated PNGs from the local backend.'
argument-hint: 'Describe the target asset type, prompt goal, output path, checkpoint, and whether you want the default ink + engraving dual-LoRA stack.'
---

# ComfyUI SDXL Partial Asset Gen

用這個 skill 走本機 `ComfyUI` backend，而不是每次手動進畫布拼一套最小 workflow。

Unity 對照：這比較像一個固定的本地 Editor utility，幫你把「Stable Diffusion 生局部 UI 件」包成可重跑、可落檔、可追 prompt 的命令列流程，而不是每次在 Inspector 手動拉參數。

## When to Use

- 要生 `badge / cap / plaque / panel fragment` 這類局部 UI partial asset。
- 要固定用一組已知可用的 `SDXL + 雙 LoRA` 最小配置重跑。
- 要把輸出結果直接落成 PNG 檔，放進 `artifacts/` 或其他工作目錄。
- 要讓不同 Agent 都能走同一套本地 `ComfyUI` 命令，而不是各自手動操作。

## Do Not Use

- 不要把這個 skill 當成整頁 UI 真相來源。
- 不要直接覆蓋正式 runtime 資產或 `.meta`。
- 不要先堆 `ControlNet + 多模型 + 多 refine`，再來猜哪一層出了問題。
- 不要在沒有 task / output plan 的情況下大量生圖。

## Current Local Baseline

- Backend: `http://127.0.0.1:8000`
- 預設 checkpoint: `sd_xl_base_1.0.safetensors`
- 預設 LoRA 1: `Chinese_Ink_Painting_Lora_SDXL.safetensors`
- 預設 LoRA 2: `engraving-sdxl-lora-001.safetensors`

這套預設的定位不是「直接出正式成品」，而是：

1. 水墨暈染氛圍
2. 雕刻紋理補強
3. 給後續 `postprocess / trim / selection / Cocos import` 用的 partial asset 母稿

## Core Files

- Script: `.github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js`
- Minimal config: `.github/skills/comfyui-sdxl-partial-asset-gen/examples/minimal-double-lora-config.json`
- Prompt examples:
  - `.github/skills/comfyui-sdxl-partial-asset-gen/examples/badge-prompt.txt`
  - `.github/skills/comfyui-sdxl-partial-asset-gen/examples/cap-prompt.txt`
  - `.github/skills/comfyui-sdxl-partial-asset-gen/examples/plaque-prompt.txt`
  - `.github/skills/comfyui-sdxl-partial-asset-gen/examples/panel-fragment-prompt.txt`
  - `.github/skills/comfyui-sdxl-partial-asset-gen/examples/ui-partial-asset-negative.txt`

## Procedure

1. 先選 asset 類型，不要先亂調 sampler。
2. 優先沿用 `minimal-double-lora-config.json`。
3. prompt 長內容優先寫成文字檔，再用 `--prompt-file` 傳入。
4. 若是標準四類件，優先用 `--asset-type`，不要手打 prompt 檔名與負面 prompt 路徑。
5. 若要壓掉寫實光影，優先加 `--style-profile game-ui-semi-real`。
6. 若 asset 是 `cap / plaque / panel fragment` 這種需要固定輪廓的 carrier，優先改走 `--init-image + --strength` 的 img2img 路線。
7. 先用 `--self-test` 驗後端。
8. 生圖落檔後，再走你們既有 `postprocess` / `selection-map` / `Cocos import` 流程。

## Commands

先驗後端：

```powershell
node .github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js --self-test --json
```

用快捷參數直接生標準件：

```powershell
node .github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js --config .github/skills/comfyui-sdxl-partial-asset-gen/examples/minimal-double-lora-config.json --asset-type badge --output artifacts/ui-generated/comfyui/badge-v1.png
```

用半寫實遊戲 UI profile 生 badge / plaque：

```powershell
node .github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js --config .github/skills/comfyui-sdxl-partial-asset-gen/examples/minimal-double-lora-config.json --asset-type badge --style-profile game-ui-semi-real --output artifacts/ui-generated/comfyui/badge-v2-semi-real.png
```

用預設雙 LoRA 生 badge：

```powershell
node .github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js --config .github/skills/comfyui-sdxl-partial-asset-gen/examples/minimal-double-lora-config.json --prompt-file .github/skills/comfyui-sdxl-partial-asset-gen/examples/badge-prompt.txt --negative-file .github/skills/comfyui-sdxl-partial-asset-gen/examples/ui-partial-asset-negative.txt --output artifacts/ui-generated/comfyui/badge-v1.png --json
```

改成 panel fragment：

```powershell
node .github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js --config .github/skills/comfyui-sdxl-partial-asset-gen/examples/minimal-double-lora-config.json --prompt-file .github/skills/comfyui-sdxl-partial-asset-gen/examples/panel-fragment-prompt.txt --negative-file .github/skills/comfyui-sdxl-partial-asset-gen/examples/ui-partial-asset-negative.txt --width 1536 --height 768 --output artifacts/ui-generated/comfyui/panel-fragment-v1.png
```

用 blockout / silhouette 走 img2img：

```powershell
node .github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js --config .github/skills/comfyui-sdxl-partial-asset-gen/examples/minimal-double-lora-config.json --asset-type cap --style-profile game-ui-clean-graphic --init-image artifacts/ui-generated/comfyui/cap-v5-clean-graphic.png --strength 0.35 --output artifacts/ui-generated/comfyui/cap-v6-img2img-probe.png --json
```

降低 engraving 強度：

```powershell
node .github/skills/comfyui-sdxl-partial-asset-gen/scripts/generate-comfyui-sdxl.js --config .github/skills/comfyui-sdxl-partial-asset-gen/examples/minimal-double-lora-config.json --prompt-file .github/skills/comfyui-sdxl-partial-asset-gen/examples/plaque-prompt.txt --negative-file .github/skills/comfyui-sdxl-partial-asset-gen/examples/ui-partial-asset-negative.txt --lora2-strength 0.2 --output artifacts/ui-generated/comfyui/plaque-v1.png
```

## Default Parameter Intent

- `Chinese_Ink_Painting_Lora_SDXL = 0.75`
  - 主導水墨與墨韻
- `engraving-sdxl-lora-001 = 0.30`
  - 補雕刻線與金屬紋理，不搶主風格
- `steps = 28`
- `cfg = 6.5`
- `sampler = dpmpp_2m`
- `scheduler = karras`

## Prompt Guidance

- `badge`：強調中心載體、外圈、留白區與縮圖可讀性。
- `cap`：強調橫向裝飾、兩側收頭、中央留給標題或徽記。
- `plaque`：強調牌匾、銘牌、金屬或木底與刻紋。
- `panel fragment`：強調局部角件、邊框片段、不可做整頁 UI。

`--asset-type` 目前內建：

- `badge` → `badge-prompt.txt`，預設 `1024x1024`
- `cap` → `cap-prompt.txt`，預設 `1536x512`
- `plaque` → `plaque-prompt.txt`，預設 `1280x768`
- `panel-fragment` → `panel-fragment-prompt.txt`，預設 `1536x768`

若帶 `--asset-type` 且未指定 `--output` / `--output-dir`，script 會自動落到：

- `artifacts/ui-generated/comfyui/<asset-type>-YYYYMMDD-HHMMSS.png`

`--style-profile` 目前內建：

- `game-ui-semi-real`
  - 額外負面 prompt：壓掉 `product render / studio lighting / chrome / glossy enamel / pbr metal / deep embossed relief`
  - 較保守 LoRA 強度：`ink = 0.45`、`engraving = 0.12`
- `game-ui-flat-clean`
  - 進一步壓低水墨與雕刻感，適合較乾淨扁平的 UI partial asset
- `game-ui-clean-graphic`
  - 關閉預設 LoRA，並額外排除 `ornament sheet / manuscript page / contact sheet / draft sketch` 類型漂移

`--init-image` / `--strength`：

- `--init-image <path>` 會把本機圖片上傳到 ComfyUI input folder，啟用 `LoadImage -> ImageScale -> VAEEncode -> KSampler` 的 img2img workflow
- `--strength <0~1>` 直接對應 KSampler `denoise`
- 對 carrier asset 建議從 `0.25 ~ 0.45` 起跑，先保輪廓，再慢慢放鬆

負面限制建議固定帶：

- `no full-screen ui`
- `no characters`
- `no baked text`
- `no modern mobile app icon`
- `no glossy plastic`
- `no photoreal scene background`

## Notes

- 這個 skill 走的是本機 `ComfyUI` HTTP API，不依賴額外 MCP tool。
- 若想改成單 LoRA，只要把其中一顆 strength 調到 `0`。
- 若之後 `inpaint checkpoint` 完成，可再擴充第二支 wrapper 做局部修補，不要把 txt2img 與 inpaint 混在同一支腳本裡。