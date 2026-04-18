<!-- doc_id: doc_ui_0036 -->
# UI Reference Source Workflow

這份文件定義 UI factory 裡最前面的環節：參考圖來源確認與 AI 參考圖探索。

重點只有一個：

Proof compiler 需要的是 `canonical reference`，但 canonical reference 不一定一開始就存在。

所以在 proof 前面，必須先有一段 `reference source` 流程，決定這張 screen 的參考圖到底來自哪裡。

## 1. 參考圖來源的三種模式

### A. 使用者提供現成參考圖

適用情況：

1. 已有競品截圖、歷史版本截圖、手繪草圖、Figma export。
2. 這張畫面的視覺方向其實已經被定義，不需要 Agent 再做概念探索。

Agent 要做的事：

1. 確認這張圖是不是 canonical reference，而不是臨時過渡稿。
2. 把來源記進 `canonicalReferences`。
3. 只針對看不清的 zone 再和使用者補口頭說明。

### B. Agent 與使用者共同探索 AI 參考圖

適用情況：

1. 有規格，但沒有可直接拆 proof 的參考圖。
2. 需要先探索視覺方向、材質感、裝飾語言、hierarchy。

Agent 要做的事：

1. 從規格書與 family baseline 先整理 prompt card。
2. 把 must-have / must-avoid / family language / platform constraints 寫清楚。
3. 先和使用者討論 prompt，再決定是否送去 AI 生圖。
4. AI 圖回來後，和使用者一起選哪一張可當 canonical reference，哪幾張只保留為探索稿。

### C. 混合模式

適用情況：

1. 使用者已有部分參考，但缺局部風格方向。
2. 需要 AI 補材質、框體、ornament、氛圍探索，但整體 composition 仍以使用者參考為主。

Agent 要做的事：

1. 明確切開哪些元素來自使用者參考。
2. 明確切開哪些元素交給 AI 只做概念探索。
3. 禁止把 AI 探索圖誤升格成正式完整畫面真相。

## 2. Agent 與使用者怎麼一起討論 AI 參考圖

### Step 1. 先讀正式規格，不先寫 prompt

最低限度要讀：

1. `docs/keep.summary.md (doc_index_0012)` (doc_index_0012)
2. `docs/UI技術規格書.md (doc_ui_0049)` (doc_ui_0049)
3. `docs/UI品質檢核表.md (doc_ui_0050)` (doc_ui_0050)
4. 相關的 screen spec / task brief / family baseline

### Step 2. 把 prompt 問題拆成五類

1. 這張畫面的核心用途是什麼。
2. 哪些 visual zones 必須存在。
3. 這張畫面應該沿用哪個 family 語言。
4. 哪些視覺語言明確禁止混入。
5. 這張圖只是 concept reference，還是想進一步被 proof compiler 使用。

### Step 3. 先產 prompt card，再決定要不要生圖

不要直接丟一句 prompt 去試運氣。

先產一張 prompt card，至少包含：

1. screenId
2. 來源模式
3. family / recipe 假設
4. must-have
5. must-avoid
6. composition / hierarchy
7. materials / mood
8. output expectations
9. open questions for user

可直接使用：

- `artifacts/ui-source/ai-recipes/reference-prompt-card-template.md`

若目標是 icon / badge / currency / medal family，而不是整頁畫面，改用：

- `artifacts/ui-source/ai-recipes/icon-prompt-card-template.md`

### Step 4. 生圖只負責 reference，不負責正式量產資產

AI 圖的定位是：

1. concept exploration
2. visual direction alignment
3. proof 前的語言收斂

AI 圖不是：

1. 直接上線的 screen
2. 直接切圖後就能塞回 runtime 的正式資產
3. 可以跳過 `family routing / template reuse` 的捷徑

### Step 3b. 如果探索對象其實是 icon suite

先不要把 icon 當作「附帶的小圖」。

至少先回答：

1. 它是 `glyph only`，還是 `underlay + glyph`。
2. 它是否需要 runtime 疊字或 count。
3. 它是單顆 icon，還是應該一起 batch 生成的一整套 family。

如果 icon 需要標識文字：

1. AI 應畫底板 / chip / underlay。
2. runtime 再疊 `Label`。
3. 不要把可變文字直接烤死在圖裡。

## 3. 生圖工具與檔案落點

目前建議標準工具：

1. `dalle3-image-gen` skill
2. 視情況可用其他既有 image generation flow，但要保持同樣的 prompt card 紀錄方式

若採用 DALL-E 3，建議流程：

1. 先把 prompt 存成文字檔
2. 再用 `.github/skills/dalle3-image-gen/scripts/generate-dalle3.js`
3. 把結果放在該 screen 的 `reference/` 子目錄

建議結構：

1. `artifacts/ui-source/<screen-id>/reference/prompts/`
2. `artifacts/ui-source/<screen-id>/reference/generated/`
3. `artifacts/ui-source/<screen-id>/reference/selected/`

若是 icon family，建議在同層補：

1. `reference/prompts/icon-prompt-card-*.md`
2. `reference/generated/icon-suite/*`
3. `reference/selected/icon-suite/*`

## 4. 什麼時候該停止 AI 探索，進入 proof

滿足以下條件即可：

1. 使用者已認可一張 canonical reference。
2. 主要 visual zones 已看得清楚。
3. family 語言沒有和 keep / baseline 衝突。
4. 該畫面的禁用語言已被排除。

## 5. 特別限制

1. BattleScene / BattleHUD 的常態 HUD 語言不得混入人物頁 / 轉蛋頁的 plaque、medallion、parchment 商業語言。
2. BattleScene 的晨昏、天氣、季節與地圖冷暖光感，只能影響 reference 中的背景氣氛判讀，不是常態 HUD family 切換條件。
3. AI prompt 若和 keep 衝突，優先修 prompt，不是先硬生圖再事後修理由。
4. 如果使用者已提供參考圖，Agent 不應擅自再開一輪大規模 AI 探索，除非使用者同意。