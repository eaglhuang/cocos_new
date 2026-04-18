<!-- doc_id: doc_index_0008 -->
# Keep Consensus — UI Architecture（§7–§12 · §19–§23）

> 這是 `keep.md` (doc_index_0011) 的「UI Architecture（§7–§12 · §19–§23）」分片。完整索引見 `docs/keep.md (doc_index_0011)` (doc_index_0011)。

## 7. UI 契約基礎

- UI 必須維持資料驅動，不回退成「每個畫面手調 Prefab 當唯一真實來源」。
- 正式 UI 契約為三層 JSON：
  - `assets/resources/ui-spec/layouts/`
  - `assets/resources/ui-spec/skins/`
  - `assets/resources/ui-spec/screens/`
- 全域設計 token：
  - `assets/resources/ui-spec/ui-design-tokens.json`

### 7.1 BattleScene UI Data Schema Contract（DATA-1-0001，完成於 2026-04-05）

- 正式 TS 介面定義：`assets/scripts/core/data/BattleBindData.ts`
- 定義 5 個介面（Unity 對照：相當於 ViewModel / SerializedField 的資料契約）：
  - `BattleStateData`：`battleState.*`（玩家/敵方名稱、城牆 HP、回合數、糧食、狀態訊息）
  - `UnitDisplayData`：`unit.*`（單位名稱、副稱、攻防血速費用、描述）
  - `TallyUnitData`：`tally[n].*`（虎符列表各格的 atk/hp/badge/unitName/cost）
  - `BattleActionData`：`battle.*`（奧義名稱、SP 百分比）
  - `BattleLogData`：`battleLog.*`（戰報訊息）
- 5 個 layout JSON 中共 38 個 `bind:"dynamic"` 已全部替換為明確 bind path
- `UIPreviewNodeFactory` 現在將 bind path 節點顯示為 `{battleState.playerName}` 格式佔位文字
- **重要**：所有新 UI 動態 label 的 bind 欄位必須使用 BattleBindData 契約中定義的 path，不得再寫 `"dynamic"`

### 7.1a BattleScene Style Guardrail（2026-04-08）

- BattleScene 的正式母語言是 `deep-ink battlefield + cold tactical HUD + gold CTA`。
- 這不是獨立於大廳 / 人物頁 / 商店之外的第二套 UI 美術宇宙，而是同一套全域 UI 美術系統在戰場場景下的戰術化變體。
- 全景地圖可以是夜景、白天、陰天、晴天；那是背景敘事與氛圍問題，不是 HUD family 切換條件。
- 若背景亮度或冷暖感改變，允許調整的是 HUD 的 alpha、描邊、陰影與對比，不是把常態 HUD 改成跟著場景晨昏換主題。
- 戰場畫面中，3D 棋盤與單位永遠是第一主體；HUD 只負責框定資訊、指揮操作與戰況導視，不可把螢幕蓋成閱讀頁或商業展示頁。
- 允許的常態家族：
  - 冷色深底 tactical HUD
  - 低存在感工具列 / 日誌層
  - 局部金色高光 CTA
- 禁止把下列語言直接搬進 BattleScene 常態 HUD：
  - 人物頁的 `Jade-Parchment Header`
  - 轉蛋 / collectible 的 plaque、medallion、reward-card 語言
  - 高彩稀有度 badge 或大面積 parchment 閱讀卡
- 例外只允許在 reward / reveal / result popup / 特別演出層使用較高裝飾度 family；常態 Top HUD / TigerTally / ControlBar / BattleLog 不得回退到人物頁或轉蛋頁語言。

Unity 對照:
- `layout` 類似 Prefab 結構
- `skin` 類似 Theme / Sprite mapping
- `screen` 類似 route / 開啟設定

### 7.2 Design Token 使用規則（2026-04-05）

**核心原則：skin / fragment JSON 中的所有顏色欄位，一律引用 `ui-design-tokens.json` 中的 token key，禁止直接寫 hex 硬編碼。**

#### ✅ 正確寫法

```json
{ "kind": "color-rect",  "color": "surfaceParchmentFill", "alpha": 230 }
{ "kind": "label-style", "color": "textOnParchment" }
{ "kind": "color-rect",  "color": "dividerOnParchment" }
```

#### ❌ 禁止寫法

```json
{ "kind": "color-rect",  "color": "#F0E8D8E6" }
{ "kind": "label-style", "color": "#2D2926" }
{ "kind": "color-rect",  "color": "#8C7A66" }
```

#### 完整解釋

- `UISkinResolver.resolveColor()` 是唯一的顏色解析出口：收到 token key → 查 `tokens.colors[key]` → 取 hex；若查不到則 fallback `Color.WHITE`。
- 直接寫 hex 雖然短期能用，但繞過了 token 系統，主題切換或 token 更新時無法統一同步。
- 未在 `ui-design-tokens.json` 中存在的顏色語意，**必須先補 token**，再在 skin 裡引用；不得把新顏色直接寫入 skin 或 fragment。

#### 透明度表示方式

- `color-rect`：透明度用 `"alpha": 0–255`（整數），不要把 alpha 寫進 8位 hex。
- `sprite-frame`：透明度用 `"opacity": 0.0–1.0`（浮點）。
- label 顏色固定不透明，不需要 alpha 欄位。

#### 現有 Token 對照速查（羊皮紙系列）

| 語意 | Token key | hex |
|------|-----------|-----|
| 羊皮紙填色背景 | `surfaceParchmentFill` | `#F0E8D8` |
| 羊皮紙底色 | `surfaceParchment` | `#E8DFD0` |
| 主要文字（深褐） | `textOnParchment` | `#2D2926` |
| 次要文字（中褐） | `textOnParchmentMuted` | `#6B5E4E` |
| 強調文字（金） | `secondary` | `#D4AF37` |
| 分隔線 | `dividerOnParchment` | `#8C7A66` |

#### Token 命名收斂規則（2026-04-06）

- 舊 token key 先保留相容性，不在同一輪大規模改名既有 skin。
- 新畫面、新 skin、新 family 優先使用分層 alias：
  - `accent.gold.*`
  - `accent.jade.*`
  - `surface.parchment.*`
  - `text.parchment.*`
  - `divider.parchment`
- 若只是沿用既有畫面，可暫留 `secondary`、`surfaceParchmentFill`、`stdButtonPrimary` 等舊 key；但新增 token 不再優先擴張舊式平鋪命名。

### 7.3 Shared Header + Rarity Route（2026-04-08）

- 共用 header recipe 以 `assets/resources/ui-spec/fragments/widgets/header-rarity-plaque.json` 為主，skin slot 語彙由 `header-rarity-plaque-default.json` 承接。
- 共用 rarity 視覺 helper 以 `assets/scripts/ui/core/UIRarityMarkVisual.ts` 為主，統一處理 tier dock 尺寸、底色、字色、描邊。
- preview / smoke 若同時要注入文字與 rarity dock，統一走 `assets/scripts/ui/core/UIPreviewStateApplicator.ts`，不要在 `LoadingScene.ts` 內為每個 target 重複手寫 `binder.setTexts()` + badge 套色。
- 目前已驗證採用的 family：`GeneralDetailOverview`、`SpiritTallyDetail`、`Gacha`。
- 共用原則：
  - 主標與副標屬於 plaque 文本層。
  - rarity tier 屬於 badge dock 的局部狀態層。
  - 不再以整張 SSR/UR 圖 badge 硬縮進窄框。

### 7.4 UI 元件尺寸契約（2026-04-09）

> **完整矩陣與標準尺寸見 → `docs/ui/component-sizing-contract.md (doc_ui_0038)` (doc_ui_0038)**（這份文件是 repo 級唯一尺寸真相來源）。
> 本節只記錄共識摘要；細表不在此重複。

**幾何行為六類共識**（FX / SS / SR / TR / LC / DI）：

- `FX`（fixed-scale）：固定 W × H，只允許整體等比 scale，不可單軸拉伸。
- `SS`（stretch-safe-segmented）：必須分件（cap＋band＋fill）才能安全左右拉伸；不可整張圖拉伸。
- `SR`（sliced-rect）：9-slice 矩形框，四角固定、四邊可拉。
- `TR`（tiled-repeat）：紋理可重複貼磚。
- `LC`（layout-container）：由 `cc.Layout` 驅動，隨子節點自動擴展。
- `DI`（data-image-fixed）：固定顯示槽，runtime 圖片 crop/fit 進槽。

**Title 二分類共識**：

- **Type A — 畫面專屬固定標題**：幾何行為 `FX`，只允許整體 scale，**不預設開 left-cap / right-cap**。
- **Type B — 通用可拉伸標題**：幾何行為 `SS`，必須拆三件（cap-left + band-fill + cap-right）。
- 預設 Title **不得**先做圖後才判幾何類型；應在 screen spec 建立時先判類型，再委託美術。

**強制規則**：

1. 每份 screen spec / task card 必須包含 Component Sizing Table，才算規格齊備。
2. FX 元件必須有明確 W × H；沒有數字不算完整規格。
3. 資產 PostProcess 驗收：FX 元件輸出尺寸必須完全符合 sizing contract，不允許浮動。
4. GeneralDetail 右側欄位小標題（屬性、血脈、技能等）= Type A FX，不應生成 cap 資產。
5. 若 icon 採 `underlay + glyph` 結構，`80%` 指的是 glyph 的 `logical box` 佔底板有效承載區 80%，不是看 `alpha bounds` 或像素留白直接算比例；單顆 icon 若需例外，必須明列 manifest / task card，不能臨時肉眼重拉。

---

## 8. UI Template 新架構

Agent1 已把 UI templates 重構成可重用架構，這是後續 UI 量產的核心基礎。

### 主要實體

- `assets/scripts/ui/core/UITemplateResolver.ts`
- `assets/scripts/ui/core/UITemplateBinder.ts`
- `assets/scripts/ui/core/UISpecTypes.ts`
- `assets/resources/ui-spec/templates/`
- `assets/resources/ui-spec/fragments/widgets/`
- `assets/resources/ui-spec/fragments/layouts/`
- `assets/resources/ui-spec/fragments/skins/`

### 已落地模板

- `dialog-confirm`
- `dialog-info`
- `dialog-select`
- `fullscreen-result`

### 核心意義

- Template 負責骨架
- Widget Fragment 負責可重用區塊
- Skin Fragment 負責視覺片段
- Binder 負責節點綁定

這代表 UI 不再是「每次重畫一個新畫面」，而是「優先挑既有 template / widget family，再做 screen-specific 變化」。

### 8.1 $ref Fragment 合併語意與最佳實踐（2026-04-10）

- Layout JSON 中任何節點可使用 `"$ref": "fragments/widgets/<widget>.json"` 引用可重用片段。
- 合併語意為 `{ ...fragment, ...node }`：**node JSON 的屬性覆蓋 fragment 的同名屬性**；fragment 的 children 如未覆寫則原樣帶入。
- **Immutable Keys**：`type` 欄位為不可覆寫保護欄位。若 node 嘗試覆蓋 fragment 的 `type`，UISpecLoader 會在 runtime 發出 warn、validate-ui-specs R18 會在靜態檢查攔截。
- **最佳實踐**：
  1. 引用 fragment 時只覆寫「確實需要客製化」的屬性（例如 `id`、`style`、`texts`），不重寫整個結構。
  2. 若 fragment 無法滿足需求，優先修改 fragment 的 `params` / `slots` 設計，而非在 node 側大量覆蓋。
  3. 使用 `node tools_node/build-fragment-usage-map.js --query <ref>` 查詢片段影響範圍再修改。
  4. 修改片段前必須遵守 `.github/instructions/fragment-guard.instructions.md (doc_ai_0012)` (doc_ai_0012) 的五步防護流程。

### 8.2 Widget Registry（2026-04-10）

- 正式 widget 索引：`assets/resources/ui-spec/fragments/widget-registry.json`
- 目前收錄 12 個 widget，分 7 類：`action / container / header / display / content / overlay / feedback`。
- 每筆 widget 包含：`id / name / category / type / description / childCount / slots / params / usageExample`。
- AI Agent 在建立新 layout 時，**必須先查 widget-registry.json**，優先使用既有 widget，而非手寫等效結構。
- 新增 widget 後必須同步更新 registry，並跑 `node tools_node/validate-widget-registry.js` 確認一致。

### 8.3 Content Contract Schema 強化驗證（2026-04-10）

- `UIContentBinder.validate()` 現在支援 schema 層級的進階驗證：
  - `type`：檢查 data 欄位的 JS typeof 是否與 schema 宣告的 type 一致。
  - `enum`：當 schema field 有 `"enum": [...]` 時，驗證 string 值是否在允許列表中。
  - `range`：當 schema field 有 `"range": [min, max]` 時，驗證 number 值是否在範圍內。
  - `pattern`：當 schema field 有 `"pattern": "regex"` 時，驗證 string 值是否符合正則。
- 這些驗證結果目前以 `warnings` 回報，不阻斷 runtime（保持遊戲可運行原則不變）。
- 新增 content contract schema 時，建議為有限值域的欄位補上 `enum`（例如 `rarityTier`）、為 0–1 進度條補上 `range`。

### 8.4 Engine Adapter 介面層（2026-04-10）

引擎耦合代碼由原本分散在各 `UIPreview*` 類別中，收斂到單一介面 + 平台目錄結構。

#### 介面目錄 `assets/scripts/ui/core/interfaces/`

| 介面 | 說明 |
|------|------|
| `INodeFactory` | 引擎無關的 UI 節點建構介面（buildPanel / buildLabel / buildButton / buildImage / buildScrollList / createContainer） |
| `IStyleApplicator` | 引擎無關的視覺樣式套用介面（applyBackgroundSkin / applyButtonSkin / applyLabelStyle / applySpriteType） |
| `ILayoutResolver` | 引擎無關的佈局計算介面，回傳純資料 DTO（resolveSize / resolveWidget / resolveLayout） |
| `index.ts` | barrel export，統一從此匯出三個介面 |

#### 平台目錄 `assets/scripts/ui/platform/`

| 實作 | 說明 |
|------|------|
| `cocos/CocosNodeFactory.ts` | `INodeFactory` 的 Cocos Creator 3.x 具體實作，委派給 `UIPreviewNodeFactory`；引擎耦合度的單一聚合點 |
| `unity/UnityNodeFactory.ts` | `INodeFactory` 的 Unity stub；所有方法 throw not-implemented，供跨引擎移植時填充 |

**設計原則**：
- 所有介面方法只接受純資料（`UILayoutNodeSpec` / 純 DTO），不持有引擎場景狀態。
- `NodeHandle = unknown`——具體型別由平台實作宣告，呼叫端不直接接觸引擎 `Node`。
- 引入新引擎時，只需新增 `platform/<engine>/` 目錄並實作三個介面，核心 UI 邏輯零修改。

### 8.5 Tools 基盤：project-config + Skills 管理（2026-04-10）

#### `tools_node/lib/project-config.js` — 集中路徑管理

- 統一匯出 `{ paths, scenes, locales, templateFamilies, ROOT }`，收攏 30+ 個常用路徑。
- 已遷移使用：`validate-ui-specs.js`、`validate-widget-registry.js`、`task-lock.js`、`build-fragment-usage-map.js`、`headless-snapshot-test.js`、`i18n-overflow-check.js`、`skills-manager.js`。
- **新增工具一律 `require('./lib/project-config')`，不允許 `path.join(__dirname, '../assets/...')` 硬編碼。**

#### `.github/skills-manifest.json` + `tools_node/skills-manager.js`

- skills-manifest 收錄 25 個 skill：11 portable（debug / image-gen / agent-workflow / doc-management）+ 14 project-specific（UI production + data pipeline），另記 6 個 mirror 對。
- `skills-manager.js` 支援 6 子命令：`list / info / validate / export / sync-mirrors / status`。

#### `tools_node/bootstrap-new-project.js` — 新專案快速啟動

- `--list`：列出 18 個可移植元件（tools / instructions / docs / ui-spec skeletons）。
- `--name <name> --out <dir>`：匯出到目標目錄，同時呼叫 `skills-manager export` 複製 portable skills。
- `--dry-run`：預覽複製清單，不寫入。
- `tools_node/lib/project-config.js` 需在目標專案手動調整路徑。

### 8.6 UI Spec Testing 工具（2026-04-10）

| 工具 | 功能 | 觸發時機 |
|------|------|---------|
| `validate-ui-specs.js` | R1–R18 靜態驗證（layouts/skins/screens/contracts/widgets/immutable-override）| 每次修改 UI spec JSON 後必跑 |
| `validate-widget-registry.js` | widget-registry.json ↔ 實際 widget 檔案一致性 | 新增/刪除 widget 後必跑 |
| `build-fragment-usage-map.js` | 掃描 $ref 引用，輸出使用地圖 | 修改 fragment 前先 `--query <ref>` |
| `headless-snapshot-test.js` | JSON 結構 hash 快照測試（base: 113 specs） | CI / spec 大批次修改後 |
| `layout-diff.js` | 兩份 layout JSON 人類可讀 diff | `--git` 模式對比 HEAD 變更 |
| `i18n-overflow-check.js` | CJK 文字寬度估算 + 溢出風險報告 | i18n key 新增或文字改動後 |
| `task-lock.js` | Multi-Agent file-based task 鎖定 | 多 Agent 並行修改同一 task JSON 前 |

**Snapshot regression 流程**：
1. `node tools_node/headless-snapshot-test.js` — 若輸出 `CHANGED` 列，表示 spec 結構改變。
2. 確認改變屬於預期（intentional refactor）→ `node tools_node/headless-snapshot-test.js --update` 更新 baseline。
3. 若非預期 → 找出 diff（`layout-diff.js --git <file>`）→ 修復 → 重跑驗證。

---

## 9. 美術 × 技術量產協作規則

這是目前最重要的新共識。

### Template-first 原則

- 美術在開始新畫面前，先指定「這張畫面屬於哪個已存在 template family」。
- 若某個 family 已接上 runtime 但視覺仍停在 placeholder，第一步優先把 `color-rect` 換成既有 family 可重用的 skin slot，不要直接跳去重做整張畫面或重排節點。
- 若能用既有 template 解決 70% 以上結構，就不得把它當成全新畫面重做。
- 只有在既有 template 明顯不適用時，才新增新 template。

### 美術交付順序

1. 先選 template family
2. 再做 wireframe
3. 再做 slot-map
4. 最後才做 screen-specific 視覺強化

### 技術配合

- 技術側要盡量把「共用骨架」沉到 template / fragment，不把共通結構散落在單一 screen JSON。
- 新畫面若只是同一家族的變體，優先新增 config、skin 或 fragment，不急著新增 template。

### 9.1 UI 圖庫與 Runtime 分層（2026-04-09）

- `artifacts/ui-library/` 是正式的「非打包 UI 圖庫層」，用途等同共用 Art Source Library / Shared UI Source Shelf。
- 這一層只收：
  - 生產中但值得保留的候選圖
  - accepted 可重用館藏
  - registry / promote 記錄
- `artifacts/ui-library/` 不可被 runtime 直接引用，也不應被視為正式 bundle / resources 載入路徑。
- 正式遊戲資產必須維持單一路徑真相；只有被挑選中的素材，才可透過 `tools_node/promote-ui-library-asset.js` 升格到 canonical runtime path。
- 目前 repo 的正式共用 UI runtime path 仍以 `assets/resources/sprites/ui_families/...` 為主；若未來某些資產改由 bundle 承接，也應遵守同一原則：
  - 圖庫留在 `artifacts/ui-library/`
  - runtime 只保留正式接線版本
  - 不把候選圖、測試圖、過期版本直接堆進 runtime 資產層
- 這條規則的目的，是把「候選館藏」與「正式遊戲載入資產」制度化分層，避免專案後期在 runtime 目錄累積垃圾版本、重複複本與 screen 專用分叉，最後無法乾淨清理。
- 使用順序固定為：
  1. 候選 / accepted 先進 `artifacts/ui-library/<category>/<family>/...`
  2. 查 `artifacts/ui-library/_registry/asset-registry.json` 是否已有可重用館藏
  3. 正式升格才複製到 runtime canonical path
  4. runtime screen / skin 一律只接 canonical path，不回頭直接吃圖庫檔案

### 現階段模板家族

- `detail-split`
- `dialog-card`
- `rail-list`

---

## 10. Figma + Cocos + Playwright 量產線

正式量產線：

1. `UI_PROOF_TEMPLATE`
2. `Figma`
3. `wireframe`
4. `slot-map`
5. `ui-spec skeleton`
6. `preview / Playwright QA`

Figma 檔案：
- `https://www.figma.com/design/lf8ByZq8VVBtBTBJ0IpahX`

規則：
- `09_Proof Mapping` 不只是設計備註區，必須逐步收斂成 tooling 可直接吃的中介層。
- family naming 必須對應 repo 內 skeleton 生成器輸入。

---

## 11. UI Skeleton 量產入口

repo 內正式量產入口：
- `tools_node/scaffold-ui-spec-family.js`

目前支援模板：
- `detail-split`
- `dialog-card`
- `rail-list`

可直接從 config JSON 產出三層骨架：

```bash
node tools_node/scaffold-ui-spec-family.js --config <json>
```

命名規則：
- `familyId` 用 kebab-case
- layout: `<family>-main.json`
- skin: `<family>-default.json`
- screen: `<family>-screen.json`
- slot prefix: `familyId` 的 `-` 轉 `.`

---

## 12. Proof Mapping Contract

`09_Proof Mapping` 至少要維持這些欄位：

- `familyId`
- `template`
- `uiId`
- `bundle`
- `atlasPolicy`
- `titleKey`
- `bodyKey`
- `primaryKey`
- `secondaryKey`
- `tabs`
- `railItems`
- `proofVersion`
- `figmaFrame`
- `wireframeRef`
- `slotMapRef`
- `notes`

若某份設計沒有對應到這組欄位，視為尚未進入正式量產入口。

---

## 19. UI 量產主工作流（2026-04-05）

這一段是之後所有 UI Agent 都必須遵守的正式生產規則。若未來流程再演化，優先回寫本節與 `docs/UI 規格書.md (doc_ui_0027)` (doc_ui_0027)，不要把新共識只留在任務卡或補遺。

### 19.1 核心原則

- UI 量產的正式順序固定為：`先選 template family -> 再填 content contract -> 最後套 skin fragment`。
- `layout / template` 只描述穩定結構，`content contract` 只描述角色或畫面內容差異，`skin / fragment` 只描述視覺風格與素材映射。
- 若只是文案、故事條、血脈、徽記、狀態切換不同，優先修改 `content contract`，不要回頭重切 `layout JSON`。
- 若只是紙材、框體、紋樣、配色、按鈕 family 不同，優先修改 `skin fragment`，不要複製一份新 `layout`。
- 只有當畫面結構、導覽模型、slot 數量或互動骨架改變時，才允許新增 template family 或修改 template skeleton。

### 19.2 標準落地步驟

1. 先判定這張畫面屬於哪個 template family，例如 `detail-split`、`dialog-card`、`rail-list`。
2. 在 Figma `09_Proof Mapping` 或對應 config 內補齊 `familyId / template / tabs / railItems / titleKey / bodyKey / notes` 等正式欄位。
3. 以 scaffolder 生成三層骨架：`layouts / skins / screens`。
4. 將角色差異、系統差異、故事差異收斂到 `content contract`，例如 `storyStripCells / crestState / bloodlineRumor`。
5. 將視覺差異收斂到 `skin fragment`、token、atlas policy 與既有 widget family。
6. 只在最後一步做 screen-specific 收尾；若收尾超過 20% 結構修改，代表 template family 判定可能錯了，應回頭重評估。
7. 完成後必跑 `validate-ui-specs`、encoding touched check，以及最小 smoke / preview 驗證。

### 19.3 什麼情況代表流程真的在加速

- 新 UI 主要是在「選 family + 填 config + 補內容」，而不是重新手改大量節點。
- 同一 family 的第二張、第三張畫面，主要變更集中在 `content contract` 與 `skin fragment`。
- runtime 程式主要做 binder / mapper / host 組裝，而不是為每張新畫面重寫 panel 邏輯。
- Figma proof mapping 欄位可以直接對應 repo 內 config，而不是每次重新口頭翻譯。

若一張新 UI 還是需要大幅手改 `layout JSON`、臨時塞 runtime 節點、或為單畫面複製一整套新 family，表示量產鏈還沒打通，應優先補模板、fragment 或 contract，而不是繼續個案硬做。

### 19.4 後續加速器

- 維護 `template family catalogue`：清楚列出每個 family 的適用場景、限制與現成 fragment。
- 維護 `content contract schema`：讓新 family 可直接用 config / JSON schema 建欄位，而不是人工猜欄位名。
- 維護 `skin fragment library`：把常用框體、卡片、故事帶、徽記、進度條沉成可複用 fragment。
- 維護 `preview / smoke routes`：每個高頻 family 至少有一條可快速驗證的 route。

---

## 23. MemoryManager LRU + Scope 批次釋放（UI-2-0078，2026-04-05）

### 23.1 概念設計

兩層式帳目架構（Unity Addressables 對照）：

| 層 | 說明 | Unity 對照 |
|----|------|------------|
| `records` | active 資源（refCount > 0） | Addressables tracked handles |
| `lruBuffer` | 軟釋放緩衝（refCount == 0，等待硬逐出） | soft-unload / 待 Release 的 handle |

### 23.2 主要新增 API

| 方法 / 屬性 | 說明 |
|-------------|------|
| `notifyLoaded(key, bundle, type, scope?)` | 第 4 參數 `scope` 為可選；同 key 若在 lruBuffer → 移回 active |
| `notifyReleased(key)` | refCount 歸零 → 移入 lruBuffer（不立即刪除，支援再使用重拾） |
| `releaseByScope(scope)` | 批次強制逐出指定 scope 下所有資源（active + lruBuffer），直接觸發 `onAssetEvicted` |
| `evictLRU(count?)` | 手動逐出 lruBuffer 最舊條目；不帶參數時清空全部 |
| `getLruReport()` | 取得 lruBuffer 快照陣列 |
| `getByScope(scope)` | 取得 scope 內所有資源 key 清單 |
| `lruMaxSize` | LRU buffer 上限（預設 50）；超過時自動觸發 `onAssetEvicted` |
| `lruBufferCount` | 目前 lruBuffer 大小 |
| `onAssetEvicted` | [Hook C] 硬逐出時觸發，供 ResourceManager 真正釋放 Cocos 資源 |

### 23.3 使用範例

```typescript
// 場景切換前批次釋放
services().memory.releaseByScope('battle');

// 接 ResourceManager 的真正釋放（在 ServiceLoader 初始化後設置一次）
services().memory.onAssetEvicted = (key, bundle) => {
    services().resource.forceRelease(key, bundle);
};

// 記憶體壓力時手動清空 LRU buffer
services().memory.evictLRU();

// 載入時標記 scope
services().memory.notifyLoaded('ui/battle-hud', 'resources', 'Prefab', 'battle');
```

### 23.4 向後相容

- `notifyLoaded` 第 4 參數為可選，所有現有呼叫端（ResourceManager、VfxComposerTool）**無需修改**。
- `AssetRecord` 新增 `lastUsedAt` 與 `scopes` 欄位；現有使用 `getReport()` 的程式碼仍正常工作。
- 既有 `onThresholdExceeded` / `onAssetFullyReleased` Hook 語義不變。
- 維護 `proof mapping -> scaffolder` 對映：讓 Figma 欄位可直接生成 config，而不是再人工轉譯一次。

### 19.5 UI Agent 進場必讀順序

所有新加入的 UI Agent，在開始實作前必須依序閱讀：

1. `docs/keep.md (doc_index_0011)` (doc_index_0011)
2. `docs/UI 規格書.md (doc_ui_0027)` (doc_ui_0027) 的「UI 量產工作流與 Agent 協作入口」
3. 對應系統的正式規格書，例如 `武將人物介面規格書.md` (doc_ui_0012)
4. 目前任務卡與 `docs/ui-quality-todo.json`
5. `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)，確認正式文件、程式檔與 ui-spec 的對應關係

UI 任務卡建立或重寫時，優先使用 `docs/agent-briefs/UI-task-card-template.md (doc_task_0132)` (doc_task_0132)。

若 Agent 沒有完成這個順序，就不應直接開始做新的 UI JSON、Panel 或 skin。

### 19.6 Agent 協作的強制原則

- Agent1/Agent2/其他 Agent 對 UI 的分工，必須建立在同一個 family、同一個 contract、同一套正式規格上。
- 任一 Agent 發現可以抽成共用 template、fragment、schema 的重複模式時，優先補基礎設施，不要只解當前畫面。
- 任一 Agent 若新增了 screen-specific workaround，必須在任務卡或正式規格寫明原因與退場條件。
- 任一 Agent 完成 UI 任務後，至少同步更新：正式規格書、`cross-reference-index.md` (doc_index_0005)、必要時更新 `keep.md` (doc_index_0011)。

### 19.7 正式參照

- 執行準則以本節為主。
- UI 正式方法論與結構定義，以 `docs/UI 規格書.md (doc_ui_0027)` (doc_ui_0027) 的「UI 量產工作流與 Agent 協作入口」為主。

---

## 20. Content Contract Framework（Phase F，2026-04-05）

Content Contract Framework 是讓 AI Agent 能從「只會產 JSON 骨架」推進到「能交付可執行 UI」的關鍵補強層。

Unity 對照：相當於把 Prefab 的 `SerializedField` 強制宣告出來，讓 Instantiate 時能靜態驗證該元件所需的所有欄位是否齊備。

### 20.1 核心概念

每個 template family 都必須有對應的 `ContentContractSpec`，描述：
- 這個 family 的 screen 最少需要哪些欄位
- 各欄位的型別、是否必填、有無預設值
- 欄位對應的 bind path（供 `UIContentBinder` 使用）

### 20.2 檔案位置

| 層 | 路徑 |
|----|------|
| JSON Schema | `assets/resources/ui-spec/contracts/{family-id}-content.schema.json` |
| TS 核心 | `assets/scripts/ui/core/UIContentBinder.ts` |
| Screen 擴充欄位 | `UIScreenSpec.contentRequirements` |
| 架構草案 | `docs/ui/content-contract-framework.md (doc_ui_0039)` (doc_ui_0039) |

### 20.3 UIScreenSpec 擴充

`UIScreenSpec` 新增選填欄位 `contentRequirements?: ContentContractRef`：
- `schemaId`：對應 `contracts/{schemaId}.schema.json`
- `familyId`：所屬 template family
- `requiredFields`：最少必填欄位清單

### 20.4 UIContentBinder（新增，2026-04-05）

`UIContentBinder` 負責：
1. 接收 `ContentContractRef` + runtime data object
2. 以型別安全方式把欄位映射到 `UITemplateBinder` path
3. 呼叫前驗證必填欄位是否存在，缺失時 warn 而非 silent fail

位置：`assets/scripts/ui/core/UIContentBinder.ts`

### 20.5 已落地 Content Schema（2026-04-05）

| Family | Schema ID | 必填欄位 |
|--------|-----------|----------|
| `detail-split` | `detail-split-content` | `titleKey, bodyKey, tabs` |
| `dialog-card` | `dialog-card-content` | `titleKey, bodyKey, primaryKey` |
| `rail-list` | `rail-list-content` | `titleKey, railItems` |
| `fullscreen-result` | `fullscreen-result-content` | `resultType, titleKey, descKey` |

BattleScene 的 bind path 契約沿用 `BattleBindData.ts`，不另開 schema。

### 20.6 強制規則

- 任何新 screen spec 建立後，若 family 已有對應 schema，`contentRequirements` 欄位**必須填寫**。
- `validate-ui-specs.js --check-content-contract` 必須通過才算完成 UI 任務。
- Screen spec 中不得再出現未在 `requiredFields` 宣告的魔法字串 bind path。

---

## 21. Screen → Component 自動落地（Scaffold Pipeline，Phase F，2026-04-05）

### 21.1 問題

`scaffold-ui-spec-family.js` 只解決 JSON 骨架生成；從 `screen.json` 到可執行的 TypeScript Panel 仍是人工步驟，是目前量產最後一哩的主要瓶頸。

Unity 對照：等同於只有 ScriptableObject 定義，但還沒有對應的 `MonoBehaviour` 骨架。

### 21.2 工具入口（待實作 UI-2-0081）

```bash
node tools_node/scaffold-ui-component.js --screen <screenId> [--family <familyId>] [--out <dir>]
```

位置：`tools_node/scaffold-ui-component.js`

### 21.3 產出物

| 產出 | 說明 |
|------|------|
| `assets/scripts/ui/components/<PanelName>.ts` | 繼承 `UIPreviewBuilder` 的面板類別，含 `onReady(binder)` 骨架與 `content contract` 綁定範例 |
| `UIConfig.ts` UIID entry | 自動新增 enum 成員（標記 `// TODO: 補 prefab 路徑`，不可留空字串） |

### 21.4 Panel 樣板家族

| Template Family | 樣板檔 |
|-----------------|--------|
| `detail-split` | `tools_node/templates/detail-split-panel.template.ts` |
| `dialog-card` | `tools_node/templates/dialog-card-panel.template.ts` |
| `rail-list` | `tools_node/templates/rail-list-panel.template.ts` |
| `fullscreen-result` | `tools_node/templates/fullscreen-result-panel.template.ts` |

### 21.5 規則

- 產出的 Panel TS 只包含骨架，業務邏輯由後續 Agent 或開發者填充。
- 每次 scaffold 後，自動跑 encoding check（BOM / U+FFFD 防禦）。
- UIConfig 新增 entry 必須標記 `// TODO: 補 prefab 路徑`，不可留無效佔位字串。
- scaffold 產出後，必須能通過 `tsc --noEmit` 靜態型別檢查。

---

## 22. Phase F 完成記錄（Agent1，2026-04-05）

### 22.1 本批次完成的工作

| 任務 | 產出 | 狀態 |
|------|------|------|
| UI-2-0080 Content Contract Framework | UISpecTypes.ts / UIContentBinder.ts / 4 schema JSON / content-contract-framework.md (doc_ui_0039) / validate-ui-specs `--check-content-contract` | ✅ done |
| UI-2-0081 Screen→Component Scaffolder | `tools_node/scaffold-ui-component.js` + 4 Family Panel template | ✅ done |

### 22.2 新增工具索引

| 工具 | 路徑 | 說明 |
|------|------|------|
| scaffold-ui-component | `tools_node/scaffold-ui-component.js` | 從 screen spec 一鍵生成 Panel TypeScript骨架 |
| Panel 模板 | `tools_node/templates/*.template.ts` | 4 家族各一份（detail-split / dialog-card / rail-list / fullscreen-result） |
| Content Schema | `assets/resources/ui-spec/contracts/*.schema.json` | 4 家族內容契約 JSON |
| UIContentBinder | `assets/scripts/ui/core/UIContentBinder.ts` | Content Contract 驗證與 binder 注入 |
| validate-ui-specs `--check-content-contract` | `tools_node/validate-ui-specs.js` | 驗證 screen spec 的 contentRequirements 是否符合 schema |

### 22.3 scaffold-ui-component.js 使用說明

```bash
# 基本用法
node tools_node/scaffold-ui-component.js --screen <screenId>

# 指定 family（省略時從 layout id 自動推斷）
node tools_node/scaffold-ui-component.js --screen general-detail-screen --family detail-split

# 先 dry-run 確認輸出
node tools_node/scaffold-ui-component.js --screen lobby-main-screen --dry-run

# 不自動修改 UIConfig
node tools_node/scaffold-ui-component.js --screen my-screen --no-uiconfig
```

### 22.4 Phase F 完成（2026-04-06）

- UI-2-0082（Figma Proof Mapping Sync）：✅ done — `tools_node/sync-figma-proof-mapping.js`
- UI-2-0083（Agent Strict Layout Validator）：✅ done — `validate-ui-specs.js --strict`（17條規則）
- UI-2-0078（MemoryManager LRU）：open，P2（Phase E 遺留）

**Phase F 新增工具一覽**：
- `tools_node/sync-figma-proof-mapping.js` — 從 Figma / 本地 config 輸出標準化 proof-mapping-{date}.json
- `validate-ui-specs.js --strict` — 17條 layout 品質規則（節點深度、間距、skinSlot 交叉核對等）
- `assets/resources/ui-spec/validation-rules.json` — 閾值設定檔
- `docs/ui/layout-quality-rules.md (doc_ui_0044)` (doc_ui_0044) — 規則說明文件
---

## 23. UI 美術資產治理與量產切換（2026-04-05）

### 23.1 目錄分層原則

- `artifacts/ui-source/`
  - 放 AI 原圖、裁切稿、compare input、recipe、prompt、審核紀錄。
  - 不可作為正式 runtime 載入路徑。
- `assets/resources/.../proof/`
  - 只允許短期 preview / smoke / compare 驗證使用。
  - 可暫時被 screen 或 skin 引用，但結案前必須替換或標記 blocker。
- `assets/resources/.../final/` 或正式 family 路徑
  - 只放已核准、可重用、允許正式打包的商業資產。
  - 正式版本優先引用這一層。

Unity 對照：
- `artifacts/ui-source/` 比較像 DCC 原始稿 / PSD 輸出站，不進 Player。
- `assets/resources/.../proof/` 像暫時掛在 Addressables/Resources 內的灰盒驗證圖。
- `final/` 才是可長期 shipping 的 Prefab / Sprite family 正式依賴。

### 23.2 Proof 與 Final 的切換規則

- Proof 資產的任務是驗證：
  - family 結構
  - slot 對位
  - 裁切策略
  - runtime 載入鏈
- Final 資產的任務是承擔：
  - 正式商業質感
  - 長期重用
  - 包體輸出
- 一個 family 只要下列條件成立，就應開始切正式貼圖，不必等整頁全部完成：
  - layout / screen 結構已穩定
  - slot-map 已穩定
  - 該 family 會被多頁共用

### 23.3 正式切圖優先順序

現階段優先做高重用 family，不要整頁一次重畫：
1. `jade-parchment-panel-final`
2. `crest-medallion-final`
3. `jade-rarity-badge-final`
4. `portrait-stage-final`
5. `story-strip-final`

原則：
- 先做 family，再做單頁特化。
- 先做可重用 panel kit，再做一次性插畫。

### 23.4 打包與污染防線

- 不允許把 `artifacts/ui-source/` 當成 runtime 資源目錄。
- `proof/` 目錄下的資產必須可被工具列出，方便之後清理或替換。
- 後續驗證工具應新增一條規則：
  - 正式 `screen / skin` 若仍引用 `proof/` 路徑，需輸出 warning；release 前升級為 error。
- `type: texture` 的 proof 圖若短期需要進 runtime 驗證，允許透過 `ResourceManager` fallback 載入，但這是過渡措施，不代表該資產已成為 final。

### 23.5 GeneralDetailBloodlineV3 當前狀態

- 目前可視為：
  - `layout / contract / runtime preview`：已打通
  - `story strip`：proof 可用
  - `crest medallion`：proof 可用，final 未完成
  - `jade header / panel`：過渡版可用，final family 未完成
- 因此下一步應是切入正式 family 資產，而不是再大幅重改 layout。

