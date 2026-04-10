# UI Icon Family Registry

這份文件是 icon factory 的正式母規格之一。

目的不是多開一份風格清單，而是把 icon suite 的 `family id / 結構模式 / 命名規則 / 批次輸出規則` 制度化，讓 lobby / gacha / battle 在量產時不再各自發明命名。

## 1. 使用方式

當 screen 含有 icon / badge / currency / state marker 時，流程應是：

1. 先在本表選定 `icon family id`
2. 再決定 `structure mode`
3. 再建立 `icon prompt card`
4. 最後才進 batch generation 或 partial asset task

如果 proof 有 `family: "icon"`，family router 只能把它映射到本表內已存在或已核准新增的 registry 項目。

## 2. Canonical Family ID 規則

統一格式：

`<domain>-<semantic>-icon-v<major>`

規則：

1. `domain` 只能是 `lobby / gacha / battle / common`
2. `semantic` 要描述用途，不描述單顆圖案，例如 `nav / currency / badge / status / utility`
3. `v<major>` 只有在整套材質語言或輪廓規則換代時才升版

範例：

1. `lobby-nav-icon-v1`
2. `lobby-currency-icon-v1`
3. `gacha-badge-icon-v1`
4. `gacha-currency-icon-v1`
5. `battle-status-icon-v1`
6. `common-utility-icon-v1`

## 3. Canonical Structure Mode

`structureMode` 只能從以下集合選：

1. `glyph-only`
2. `underlay-glyph`
3. `underlay-glyph-runtime-label`
4. `icon-count-dock`
5. `icon-state-marker`

補充：

1. 需要 runtime 疊字的 badge / rarity / tier，一律用 `underlay-glyph-runtime-label`
2. 貨幣與常駐 nav icon，預設優先 `glyph-only` 或 `underlay-glyph`
3. battle buff / debuff / tactical state，預設優先 `glyph-only` 或 `icon-state-marker`

## 4. Registry Table

| familyId | domain | semantic | defaultStructure | runtimeTextPolicy | defaultUnderlayPolicy | visualLanguage | 備註 |
|---|---|---|---|---|---|---|---|
| `lobby-nav-icon-v1` | lobby | nav | `underlay-glyph` | no runtime text | optional pill / tile | ink navigation / calm parchment support | 大廳主要入口、頁籤、功能列 |
| `lobby-currency-icon-v1` | lobby | currency | `glyph-only` | no runtime text | none | clean collectible utility | 用於主資源列、資產欄 |
| `lobby-badge-icon-v1` | lobby | badge | `underlay-glyph-runtime-label` | runtime label allowed | badge plate | parchment collectible badge | 榮譽、任務、活動 badge |
| `gacha-badge-icon-v1` | gacha | badge | `underlay-glyph-runtime-label` | runtime label required for tier / rarity | badge plate | collectible commerce / parchment badge | 池型、tier、稀有度標識 |
| `gacha-currency-icon-v1` | gacha | currency | `underlay-glyph` | no runtime text | optional coin plate | premium commerce token | 靈玉、券、天命代幣 |
| `battle-badge-icon-v1` | battle | badge | `underlay-glyph` | optional runtime text | tactical badge plate | deep-ink tactical / restrained antique metal | troop type badge、drawer type icon、戰場小型徽章 |
| `battle-status-icon-v1` | battle | status | `glyph-only` | no runtime text | optional tactical plate | deep-ink tactical / battlefield | buff / debuff / state icon |
| `battle-action-icon-v1` | battle | action | `icon-state-marker` | no runtime text | optional action chip | tactical signal / readable silhouette | command / readiness / target marker |
| `common-utility-icon-v1` | common | utility | `glyph-only` | no runtime text | none | neutral utility | 加號、鎖頭、通知、設定 |

### 4.1 尺寸補充契約

- 若 family 沒有另開尺寸規格，icon suite 必須在 prompt card 額外聲明 `sourceMasterSize`。
- `battle-badge-icon-v1` 的 troop type glyph / badge member，預設 master 尺寸為 `256x256` 方形。
- 這個 family 的 `glyph` 應優先服務戰場小型 badge 與 type icon，可讀性優先於細節堆疊，不應用大插圖輸出後再硬縮。

### 4.2 Logical Box 正規化契約

- `underlay-glyph` 與 `underlay-glyph-runtime-label` family 的 `80%`，一律指 **glyph logical box 佔 underlay 有效承載區 80%**，不是指不透明像素外框佔比。
- `logical box` 是圖示的語意外接矩形；其判定應包含細筆畫之間的中空、鏤空、凹口與輪廓導引空間，不得因 `alpha bounds` 較小就把 member 視為「本來就該更小」。
- family 正規化報表若有技術需要，可以同時記錄 `logicalBox` 與 `alphaBounds`；但最終縮放決策必須以前者為準。
- 若 battle troop type、badge、drawer icon 需要 member 級微調，應在 manifest 或 task card 中明列各 member 的 logical box，不能靠人工肉眼一次次重拉縮放。
- runtime 若要依畫面密度改大改小，縮放的是最終成品或 prefab 內整體節點，不回頭破壞 family 既定的 logical box 規則。

## 5. Batch 命名規則

### A. Suite ID

screen 內的實際 batch 單位使用：

`<screen-scope>-<family-semantic>-suite`

範例：

1. `gacha-pool-tier-badge-suite`
2. `lobby-top-nav-suite`
3. `battle-buff-status-suite`

### B. 成員 key

成員 key 只能描述結構角色，不描述最終文案：

1. `glyph`
2. `underlay`
3. `plate`
4. `marker`
5. `count-dock`
6. `label-chip`

若同一 suite 有多顆 glyph，使用：

1. `glyph-main`
2. `glyph-alt`
3. `glyph-rare`

### C. 產出檔名

統一格式：

`<screenScope>_<zoneId>_<memberKey>`

範例：

1. `pool-tier-badge_badge_glyph`
2. `pool-tier-badge_badge_underlay`
3. `currency-bar_spirit-jade_glyph`

不要把：

1. `SSR`
2. `UR`
3. `10連`
4. `商店`

這類 runtime 文案寫進檔名主體。

## 6. Prompt / Task / Review 命名規則

1. prompt card：`reference/prompts/<screen-scope>-<zone-or-suite>-icon-prompt-card.md`
2. asset task id：`<screen-scope>-<zone-id>-<member-key>`
3. generated dir：`reference/generated/icon-suite/<familyId>/`
4. selected dir：`reference/selected/icon-suite/<familyId>/`

## 7. Runtime Text Policy

以下資訊預設視為 runtime overlay，不得烤死：

1. rarity 字樣：`SSR / SR / UR / EX`
2. count / token / currency 數量
3. timer / countdown
4. 可翻譯文字
5. 可切換狀態名稱

允許 baked 的只有：

1. 不可讀 ornament
2. 無語義紋章
3. 抽象化材質紋樣

## 8. 新增 family 的門檻

只有以下情況才新增新 family id：

1. 現有 family 無法承接該系統的材質語言
2. 結構模式明顯不同，無法只靠成員組合解決
3. 若硬套舊 family，會造成 battle / lobby / gacha 視覺語言混線

如果只是同 family 內多一顆新 icon，不要新增 family id，應新增 suite member。

## 9. 與其他文件的關係

1. `docs/UI-icon-factory-workflow.md`：說明 icon 怎麼進工廠流程
2. `docs/UI-factory-agent-entry.md`：告訴 Agent 什麼時候必讀這份 registry
3. `artifacts/ui-source/ai-recipes/icon-prompt-card-template.md`：實際填寫 prompt card 用
