name: nano-banana-gen
description: 'Nano Banana（Google Gemini）圖像生成 SKILL。用於呼叫 Gemini 系列圖像模型（gemini-2.5-flash-image, gemini-3.1-flash-image-preview, gemini-3-pro-image-preview）生成概念圖、UI 資產草稿、icon、badge、卡面母稿。需要在 tools_mcp/nano-banana-mcp/.env 設定 GOOGLE_AI_API_KEY。'
argument-hint: '描述圖像目標、prompt 來源（直接或 --prompt-file）、輸出路徑、model 選擇（nano-banana / nano-banana-2）。'
---

# Nano Banana 圖像生成

用這個 skill 走專案內建的 Gemini 圖像包裝器，使用 Nano Banana 系列模型生圖。

Unity 對照：這類似於把「外部 AI 生成服務」包成一個固定的 Editor utility，讓不同 Agent 可以用同一個 wrapper 呼叫，不需要每次各自處理 API 串接。

## Nano Banana 暱稱對照

| 社群暱稱 | alias flag | 正式 API modelId |
|---|---|---|
| Nano Banana | `nano-banana` | `gemini-2.5-flash-image` |
| Nano Banana 2 | `nano-banana-2` | `gemini-3.1-flash-image-preview` |
| Nano Banana Pro | `nano-banana-pro` | `gemini-3-pro-image-preview` |
| 預設模型 | _(預設)_ | `gemini-2.5-flash-image` |

## When to Use

- 需要用 Gemini 圖像模型生概念圖、UI icon 草稿、badge、卡面母稿或視覺探索。
- Agent1 用 Nano Banana 系列模型生圖時，走這個包裝器取代手動 API 串接。
- 需要把生圖結果直接下載到本地（`artifacts/` 或其他工作目錄）。

## Do Not Use

- 不要用這個 skill 直接覆蓋正式量產資產或 `.meta`。
- 不要把 `GOOGLE_AI_API_KEY` 寫進 prompt、文件或腳本。
- 不要把它當成最終 UI 成品產線；它是概念生成與候選稿工具。

## 前置設定（首次使用）

1. 取得免費 Google AI Studio API Key：https://aistudio.google.com/apikey
2. 建立 `tools_mcp/nano-banana-mcp/.env`（複製 `.env.example`）：
   ```
   GOOGLE_AI_API_KEY=AIza...
   ```
3. 驗證設定：
   ```powershell
   node .github/skills/nano-banana-gen/scripts/generate-banana.js --self-test --json
   ```

## Commands

短 prompt 直接跑（預設模型）：

```powershell
node .github/skills/nano-banana-gen/scripts/generate-banana.js --prompt "ancient Chinese ornamental frame border, pure decorative pattern, NO text NO calligraphy, transparent background, 512x512, PNG" --output artifacts/ui-qa/UI-2-0094/r2-test/frame-v1.png
```

長 prompt 建議走文字檔：

```powershell
node .github/skills/nano-banana-gen/scripts/generate-banana.js --prompt-file artifacts/ui-qa/UI-2-0094/prompts/header_ornament_l.txt --output artifacts/ui-qa/UI-2-0094/r2-post-fix/header_ornament_l.png --json
```

指定使用 Nano Banana（Flash 2.5）：

```powershell
node .github/skills/nano-banana-gen/scripts/generate-banana.js --prompt-file artifacts/ui-qa/UI-2-0094/prompts/crest_face_final.txt --model nano-banana --output artifacts/ui-qa/UI-2-0094/r2-post-fix/crest_face_final.png --json
```

只驗證 API Key，不生圖：

```powershell
node .github/skills/nano-banana-gen/scripts/generate-banana.js --self-test --json
```

## UI-2-0094 批次重生（4 張無文字圖）

按順序執行，每張確認 `"ok": true` 後再跑下一張：

```powershell
node .github/skills/nano-banana-gen/scripts/generate-banana.js --prompt-file artifacts/ui-qa/UI-2-0094/prompts/header_ornament_l.txt --model nano-banana --output artifacts/ui-qa/UI-2-0094/r2-post-fix/header_ornament_l.png --json
```

```powershell
node .github/skills/nano-banana-gen/scripts/generate-banana.js --prompt-file artifacts/ui-qa/UI-2-0094/prompts/header_ornament_r.txt --model nano-banana --output artifacts/ui-qa/UI-2-0094/r2-post-fix/header_ornament_r.png --json
```

```powershell
node .github/skills/nano-banana-gen/scripts/generate-banana.js --prompt-file artifacts/ui-qa/UI-2-0094/prompts/crest_face_final.txt --model nano-banana --output artifacts/ui-qa/UI-2-0094/r2-post-fix/crest_face_final.png --json
```

```powershell
node .github/skills/nano-banana-gen/scripts/generate-banana.js --prompt-file artifacts/ui-qa/UI-2-0094/prompts/crest_ring_final.txt --model nano-banana --output artifacts/ui-qa/UI-2-0094/r2-post-fix/crest_ring_final.png --json
```

## Prompt Guidance

- UI icon / badge 類：明確加 `NO text, NO letters, NO calligraphy, NO characters`。
- 如要避免文字被生進圖像，在 prompt 最後加一行：`IMPORTANT: absolutely no text, no writing, no symbols, no characters of any language`.
- 批次探索多方向時，拆成 `v1 / v2a / v2b` 個別 prompt file，不要塞進同一條。
- 透明背景：加 `transparent background` 但 Gemini 圖像模型不保證支援透明，建議另存後再去背。

## Outputs

腳本回傳（`--json` 模式）：

```json
{
  "ok": true,
   "model": "gemini-3.1-flash-image-preview",
   "mimeType": "image/jpeg",
   "savedTo": "c:\\Users\\User\\3KLife\\artifacts\\ui-qa\\...\\header_ornament_l.jpg",
  "textContent": null
}
```

## Notes

- npm 套件位置：`tools_mcp/nano-banana-mcp/node_modules/` （已安裝 `@google/generative-ai@0.24.x + dotenv`）
- API Key 由 `tools_mcp/nano-banana-mcp/.env` 讀取，wrapper 不處理金鑰
- `savedTo` 會依模型實際回傳的 `mimeType` 自動對齊副檔名；Gemini 3.1 / Pro 常見為 `.jpg`
- 若需要新版模型，改用 `--model nano-banana-2` 或 `--model nano-banana-pro`
- 若要批次生多張，重複呼叫腳本即可
