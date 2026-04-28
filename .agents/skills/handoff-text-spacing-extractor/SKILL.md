---
doc_id: doc_agentskill_0030
name: handoff-text-spacing-extractor
description: 'Handoff text-spacing extractor SKILL — 從 canonical HTML/JSX/TSX inline style 盡量抽出字間距與空間細節（letterSpacing, gap, padding, margin, fontSize, lineHeight 等），並回補到 Design System/design_handoff/source/ui-design-tokens.json 的 handoffTextSpacingExtracted 區段。USE FOR: UI 對齊前先把參考圖 / handoff source 的 spacing recipe 轉成可重用 token；DO NOT USE FOR: 只有 runtime 截圖、沒有 source 設定，或純 CSS module / computed style 無法直接讀取的場景。'
argument-hint: '提供 source file / folder、tokens 路徑（可選）、以及要回補的 section 名稱；若是整個 handoff 目錄，直接傳資料夾路徑。'
---

# Handoff Text Spacing Extractor

把 handoff source 裡的細粒度字距與版面間距，整理成可重用的 design token 與 component recipe。

Unity 對照：相當於先把 Prefab / UI 參考圖中的字級、字距、欄距、行距、內距整理成一份可重跑的 style recipe，而不是每次都靠手工比對。

## 何時使用

- 你要從 canonical handoff source 抽出 `letterSpacing / gap / padding / margin / fontSize / lineHeight`
- 你已經有 UI reference 或 JSX/HTML handoff source，想回補到 `ui-design-tokens.json`
- 你希望下次做相同 UI 時直接重用 token，而不是重新目測

## 適用來源

優先使用能看到真實 spacing 的 canonical source：

- React / JSX / TSX 中的 inline style object，例如 `style: { ... }` 或 `style={{ ... }}`
- HTML inline style，例如 `style="..."`
- 單一檔或整個資料夾都可；若傳資料夾，工具會遞迴掃描支援副檔名

## 不要這樣用

- 不要只拿 runtime screenshot 當唯一來源，因為看不到原始 spacing recipe
- 不要拿純 CSS module / className 直接當真相，除非你已先把 computed style 解析成可見值
- 不要把這一步當成最後美術評審；它只負責抽取與回填 token

## 標準流程

1. 找到 canonical handoff source，優先選有 inline style 的 HTML/JSX/TSX 檔
2. 執行：

```bash
npm run tokens:backfill-handoff-text-spacing -- --source <file-or-folder>
```

3. 如需換 token 檔或 section，可加參數：

```bash
npm run tokens:backfill-handoff-text-spacing -- --source <file-or-folder> --tokens "Design System/design_handoff/source/ui-design-tokens.json" --section handoffTextSpacingExtracted
```

4. 檢查輸出 token 區段是否包含：
- `typography`
- `spacing`
- `componentRecipes`
- `sourceSummaries`

5. 若回填後要動 UI layout / skin，先用 token 的全域尺度，再回 canonical source 的 component recipe 補局部 spacing

## 輸出原則

- 先抽出可重用的全域 token，再補 component-specific recipe
- 對齊時優先相信 canonical source 的實際數值，不要只靠肉眼
- 每次跑完都要看 `handoffTextSpacingExtracted` 是否有更新來源與樣本

## 已知限制

- 目前最適合抽 inline style；如果 source 完全沒有 inline style，只靠 class 名稱，工具不會自動算出 computed style
- 若同一畫面有多個來源檔，請把它們都放進同一個 folder 或以逗號分隔的 source list
- 這個 skill 的目標是建立可重跑的 token recipe，不是替代最終的 visual QA

## 與其他 skills 的銜接

- 需要先從參考圖建立結構化 view：`ui-reference-decompose`
- 需要把結構分派成 family：`ui-family-architect`
- 需要把落地版面驗證到 runtime：`ui-runtime-verify`

## 完成標準

- 你已經能用同一條命令重跑抽取
- 新的 spacing recipe 被回補到 `ui-design-tokens.json`
- 下一次做相同 UI 時，先查 token，不再從零猜 spacing
