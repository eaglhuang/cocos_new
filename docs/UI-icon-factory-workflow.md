# UI Icon Factory Workflow

這份文件把 icon / badge / currency / medal / nav glyph 這類「不是整頁 UI、但又不是單純隨手切圖」的資產，正式納入 AI factory。

重點只有一句話：

icon 不是單顆 PNG，而是一個有結構的 family unit。

它常常至少包含以下其中一種結構：

1. `glyph only`：只有主圖形，沒有襯底。
2. `underlay + glyph`：有襯底或 medal，主 glyph 疊在上面。
3. `underlay + glyph + runtime label`：AI 只產底與圖形，文字由 runtime 疊上去。
4. `icon + count dock`：圖示旁邊有數量、貨幣數字或 chip。
5. `icon + state marker`：附鎖頭、稀有度、通知紅點、選中態。

因此 icon 量產不能再用「想到一顆就生一顆」的方式處理，而要先定義 family 與 structure mode。

## 1. 什麼 icon 要進 factory

以下都應視為 icon factory 範圍：

1. 大廳功能 icon
2. 貨幣 icon
3. 稀有度 / badge / medal / tier 標識
4. Gacha 池類標識與貨幣 icon
5. 戰場 buff / debuff / state icon
6. 任務、通知、商城、加號、鎖定等工具型 icon

## 2. 先決定 icon family，不要直接生單顆

每套 icon 先回答三件事：

1. 它屬於哪個系統：`lobby / gacha / battle / common utility`
2. 它的結構模式是什麼：`glyph only / underlay + glyph / runtime label dock / count dock / state marker`
3. 它要和哪一組畫面 family 對齊：例如 `lobby parchment`、`gacha badge`、`battle tactical ink`

建議 family 命名：

1. `lobby-nav-icon-v1`
2. `lobby-currency-icon-v1`
3. `lobby-badge-icon-v1`
4. `gacha-badge-icon-v1`
5. `battle-status-icon-v1`
6. `common-utility-icon-v1`

但命名與 batch 輸出不能只靠口頭約定。

正式 family id、suite 命名、member key 與 output 命名規則，統一以：

1. `docs/UI-icon-family-registry.md`

為準。

## 3. Icon 的結構規則

### A. AI 不負責畫 runtime 文字

AI 可畫：

1. glyph
2. underlay / medal / badge plate
3. label chip 的底板
4. 狀態 marker 的底形

AI 不應畫：

1. 可讀中文
2. 可讀英文單字
3. 可讀數字數量
4. 會在 runtime 變動的 count / rarity / timer / token 值

如果 icon 需要文字標識，正式解法應是：

1. AI 產出 `label chip / plate`
2. runtime 再疊 `Label`

### B. Underlay 要先定義用途

underlay 常見用途：

1. 提高深底可讀性
2. 統一同系統 icon 外輪廓
3. 提供 badge / rarity / count 的承載底座

如果有 underlay，必須先定義：

1. 它是純襯底、badge 底板，還是 medal 本體
2. 它是否允許 runtime 疊字
3. 它是否和 glyph 分件輸出
4. 它的 glyph 承載比例是否採用預設 80% 規則；除非明確登記例外，否則一律沿用 repo 統一比例

### B-1. Underlay + Glyph 的承載比例統一規則

若結構模式為 `underlay + glyph` 或 `underlay + glyph + runtime label`：

1. **主 glyph 的 logical box 預設佔 underlay 有效承載區的 80%**。
2. 這裡的 `logical box` 指的是「這顆圖示在 `256x256` master 畫布上，若要以滿版語意框呈現時，應該對齊的外接矩形」；它是設計與辨識用的導引框，不是最後只看得到的金色筆畫像素框。
3. `logical box` 的判定依據是圖示的語意外形與應有輪廓，例如弓與弦之間的中空、盾牌內凹、細槍桿周圍的透明帶，都仍屬於同一顆圖示的邏輯框，不可因為 `alpha bounds` 較小就把它們再放大一輪。
4. `alpha bounds`、不透明像素面積、內部鏤空面積，只能作為技術檢查資料，不得直接當成 family 正規化的最終縮放基準。
5. 這個 80% 規則代表 underlay 外圈約保留 10% 左右的視覺安全帶，用於 rim、bevel、陰影與 badge / state marker 疊層。
6. 這條規則是 family 級預設，不為每顆 icon 臨時重算新比例；若個別 member 需要例外，必須在 registry、任務卡或 logical-box manifest 內明列理由。
7. 若 runtime 場景需要更小或更大的顯示尺寸，應縮放「整體 underlay + glyph 成品」，不是回頭改壞 family 內 glyph 的 logical box 基準。

### C. 同一套 icon 盡量 batch 生成

以下情況應 batch 一次生成，而不是一顆顆分開生：

1. 同一個 screen 的貨幣 icon 組
2. 同一組 nav icon
3. 同一組 rarity / tier / badge icon
4. 同一組 buff / debuff status icon

原因：

1. 同批次比較容易保持線條粗細一致
2. 同批次比較容易保持材質、描邊、發光語言一致
3. 後面套回 runtime 時，比較不會出現「每顆 icon 像不同遊戲」

## 4. Icon 在 factory 裡怎麼表示

當 proof compiler 遇到 icon 區塊時，visual zone 應明確標成：

1. `family: "icon"`
2. notes 裡寫清楚它是 `badge / currency / nav / status`

然後 family router 應把它映射成：

1. `icon-suite`
2. `icon-badge-suite`
3. `icon-currency-suite`

這些 zone 不應直接退化成「普通 image」。

## 5. 建議輸出物

若一張 screen 含 icon system，除了原本的 screen 產物外，建議補：

1. `reference/prompts/icon-prompt-card-*.md`
2. `tasks/icon/*.json`
3. `prompts/icon/*.txt`
4. registry 決策註記：本次採用哪個 `icon family id / structure mode / suite id`

若只是先做 onboarding，至少要在：

1. `proof/*.proof.json`
2. `proof/*.family-map.json`

把 icon zone 獨立標出，避免日後回頭重拆。

## 6. prompt card 最少要寫清楚的欄位

1. `iconFamilyId`
2. `suiteScope`
3. `structureMode`
4. `runtimeTextPolicy`
5. `underlayPolicy`
6. `sourceMasterSize`
7. `batchMembers`
8. `mustKeep`
9. `mustAvoid`

### 6.1 `sourceMasterSize` 預設規則

- icon prompt card 若未明寫尺寸，Agent 不得自行猜測大型輸出。
- `battle-badge-icon-v1`、戰場 troop type glyph、戰場小型 badge icon，預設 master 一律填 `256x256`。
- 只有明確標註為大 badge、medal、商業導視或需要二次裁切時，才可升到 `512x512` 或更大。
- prompt 應直接寫出 `square icon composition for 256x256 UI use` 這類用途描述，避免模型滑向插圖或寬幅構圖。

可直接使用：

1. `artifacts/ui-source/ai-recipes/icon-prompt-card-template.md`
2. `docs/UI-icon-family-registry.md`

## 7. 不該做的事

1. 不要把 icon 上的可變文字直接畫死在圖裡。
2. 不要同一 screen 的 icon 今天金屬、明天羊皮、後天卡通描邊。
3. 不要把 icon underlay、glyph、label chip 全綁成單一不可拆 PNG，除非確定永遠不需要 runtime 疊字。
4. 不要一顆 icon 一顆 icon 地獨立找風格，應先定義 suite 再 batch 生。
5. 不要把 icon 當作 screen proof 的附屬品，應把 icon zone 當正式 zone 處理。