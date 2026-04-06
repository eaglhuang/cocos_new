---
name: dalle3-image-gen
description: 'DALL-E 3 image generation workflow for this repo MCP server. Use for dalle3, DALL-E 3, OpenAI image generation, concept art, UI icon, badge, card art, prompt drafting, and saving generated images to local files.'
argument-hint: 'Describe the image goal, prompt, output path, size, style, and whether you need raw concept art or UI asset exploration.'
---

# DALL-E 3 Image Generation

用這個 skill 走專案內建的 DALL-E 3 MCP server，而不是臨時手打 API。

Unity 對照：這比較像把「外部美術生成服務」包成一個固定的 Editor utility，而不是每次都各自寫一段臨時 editor script。

## When to Use

- 需要用 DALL-E 3 生概念圖、圖示草稿、badge、卡面母稿或 UI 視覺探索。
- 需要把生圖流程標準化，讓不同 Agent 都走同一個 MCP wrapper。
- 需要把生成結果直接下載成檔案，放進 `artifacts/` 或其他工作資料夾。

## Do Not Use

- 不要用這個 skill 直接覆蓋正式量產資產或 `.meta`。
- 不要把 OpenAI API Key 寫進 prompt、文件或腳本。
- 不要把它當成最終 UI 成品產線；它是概念生成與候選稿工具。

## Procedure

1. 先整理 prompt。
2. 長 prompt 優先寫成文字檔，再用 `--prompt-file` 傳入，避免終端 quoting 問題。
3. 執行 [generate-dalle3.js](./scripts/generate-dalle3.js)。
4. 若要落地檔案，提供 `--output`，腳本會自動下載圖片。
5. 之後再由對應任務流程做 compare board、縮圖、去背、切圖或 QA。

## Commands

短 prompt 直接跑：

```powershell
node .github/skills/dalle3-image-gen/scripts/generate-dalle3.js --prompt "old military badge for spear troop type, worn antique gold rim, dark gunmetal blue inner disk, bold crossed spear silhouette, readable at 32x32, transparent background" --style natural --output artifacts/ui-qa/UI-2-0032/dalle3-spear-v2a-1024.png
```

長 prompt 建議走文字檔：

```powershell
node .github/skills/dalle3-image-gen/scripts/generate-dalle3.js --prompt-file artifacts/ui-qa/UI-2-0032/prompt-v2a.txt --size 1024x1024 --style natural --output artifacts/ui-qa/UI-2-0032/dalle3-spear-v2a-1024.png --json
```

先驗 MCP server 與 tool 是否正常，不生圖：

```powershell
node .github/skills/dalle3-image-gen/scripts/generate-dalle3.js --self-test --json
```

只要 URL 與 revised prompt，不下載：

```powershell
node .github/skills/dalle3-image-gen/scripts/generate-dalle3.js --prompt-file artifacts/ui-qa/UI-2-0032/prompt-v2b.txt --json
```

## Prompt Guidance

- UI icon / badge 類：要明確要求 `single centered subject`、`transparent background`、`readable at 32x32`。
- 若要避免現代 app icon 感，請明確寫負面限制，例如 `no modern flat ui, no clean vector icon, no plastic gloss`。
- 若是探索多方向，建議拆成 `v1 / v2a / v2b / v2c` 各自 prompt file，不要把多個方向塞進同一條 prompt。

## Outputs

腳本會回傳：

- 生成圖片 URL
- OpenAI revised prompt
- 若指定 `--output`，則會把原始生成圖下載到本地
- 若指定 `--json`，則輸出機器可讀 JSON，方便後續 Agent 串接
- 若指定 `--self-test`，則只驗證 MCP 連線與 `generate_image_dalle3` 是否存在，不會消耗生圖額度

## Notes

- MCP server 位置：`tools_mcp/dalle3-mcp/`
- API Key 仍由 server 自己讀 `.env`，wrapper 不處理金鑰
- 若要批次生多張，重複呼叫腳本即可；目前 skill 不額外包批次佇列