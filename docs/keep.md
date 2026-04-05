# Keep Consensus

更新日期: `2026-04-05`

本文件是目前專案的最高共識摘要。每次新會話開始時，先讀本檔，再開始任何分析、改碼、測試或文件工作。

---

## 1. 專案基準

- 專案: `3KLife`
- 引擎: `Cocos Creator 3.8.8`
- 工作流: `IDE-first`
- 語言: `TypeScript (ES2015)`
- 主要平台: `Web / Android / iOS`
- 階段: `Demo / UI 量產產線建立期`

Unity 對照:
- `Cocos Creator Editor` 對應 Unity Editor
- `assets/resources` 對應 Resources / Addressables 可載入資料根

---

## 2. Pre-flight

1. 每次處理任何請求前，先讀 `docs/keep.md`。
2. 回覆與推理一律使用繁體中文與台灣慣用術語。
3. 若有新技術決策，必須補回 `docs/keep.md`。
4. 新會話開始時，先摘要 keep 目前重點。
5. 規格異動優先回寫正式母規格，不把補遺當成長期單一真相來源。
6. 補遺只允許作為短期工作底稿、compare note 或跨功能整理；若不是全新功能規格，結案前必須併回正式規格書。
7. 只要正式規格書有新增、刪改或重定位，必須同步更新 `docs/cross-reference-index.md`。
8. 若內容同時影響系統規格與 UI 呈現，至少要同步更新主要系統規格書、`docs/UI 規格書.md` 與交叉索引。

---

## 3. Cocos 工作流

- 正式建置與資產流程仍由 Cocos Creator Editor 管理，不以 npm script 取代。
- Editor 入口以 `http://localhost:7456` 為主。
- asset refresh 可用：

```bash
curl.exe http://localhost:7456/asset-db/refresh
```

- 不手改：
  - `library/`
  - `temp/tsconfig.cocos.json`
  - `profiles/v2/`
  - `settings/v2/`
  - `.meta`

---

## 4. 編碼防災

- 所有文字檔必須維持 `UTF-8 without BOM`。
- 高風險副檔名：
  - `.md`
  - `.json`
  - `.ts`
  - `.js`
  - `.ps1`
- 禁止把 `Set-Content -Encoding UTF8` 當成安全寫檔方式。
- 也避免直接用 `Out-File` 重寫重要文字檔。
- 修改高風險文字檔後，立刻跑：

```bash
node tools_node/check-encoding-touched.js --files <file...>
```

- 高風險檔修改前可先跑：

```bash
npm run prepare:high-risk-edit -- <file>
```

- `docs/keep.md` 本身是高風險檔；若再出現亂碼，優先用「重建乾淨 UTF-8 文本」修復，不做猜字修補。

---

## 5. 任務卡 / Agent 協作

### 任務卡原則

- 正式工作原則上先有任務卡，再進入實作、重構、正式 QA 或批次文件整理。
- `docs/ui-quality-todo.json` 是 UI 任務狀態的單一真相來源。
- 若工作範圍擴大、衍生 blocker 或新子題，先更新 `related / depends / notes`，必要時補開新卡。

### 鎖卡規則

- 開工先鎖卡，再做事。
- 鎖卡至少要補：
  - `status: in-progress`
  - `started_at`
  - `started_by_agent`
  - `notes` 第一行寫明誰在何時開始、先做什麼
- 若只是閱讀或查資料，不應鎖卡。

### 交接規則

- 任務卡被某個 Agent 鎖定後，其他 Agent 不重複實作同一張卡。
- 若要接手，先在卡上補交接說明。
- 若已鎖卡但暫停，必須補上目前狀態、阻塞與下一步建議。

### Notes 格式

```text
YYYY-MM-DD | 狀態: in-progress | 處理: <本輪內容> | 驗證: <已做驗證> | 阻塞: <若無則寫無>
```

### 分工共識

- Agent1 主要偏向：
  - runtime
  - preview host
  - UI contract
  - tooling
  - 重構
- Agent2 主要偏向：
  - QA
  - artifact
  - compare board
  - refinement 追蹤
  - screen-context 驗證

### 撞檔規則

- 多個 Agent 不同時修改同一個高風險檔。
- 高風險檔包含：
  - `docs/keep.md`
  - `UIPreviewBuilder.ts`
  - 大型中文 Markdown
  - 核心 JSON 契約檔

---

## 6. Git 規則

- 不做破壞性 git 操作。
- 不覆蓋不是自己做的變更。
- commit message 格式：

```text
[bug|feat|chore] 主題: 說明 [AgentX]
```

---

## 7. UI 契約基礎

- UI 必須維持資料驅動，不回退成「每個畫面手調 Prefab 當唯一真實來源」。
- 正式 UI 契約為三層 JSON：
  - `assets/resources/ui-spec/layouts/`
  - `assets/resources/ui-spec/skins/`
  - `assets/resources/ui-spec/screens/`
- 全域設計 token：
  - `assets/resources/ui-spec/ui-design-tokens.json`

Unity 對照:
- `layout` 類似 Prefab 結構
- `skin` 類似 Theme / Sprite mapping
- `screen` 類似 route / 開啟設定

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

---

## 9. 美術 × 技術量產協作規則

這是目前最重要的新共識。

### Template-first 原則

- 美術在開始新畫面前，先指定「這張畫面屬於哪個已存在 template family」。
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

## 13. QA / 驗證

- 先走 preview / capture / contract 驗證，不靠肉眼口頭比對。
- 收工前至少要能跑：

```bash
node tools_node/validate-ui-specs.js
```

- touched-files 編碼檢查：

```bash
node tools_node/check-encoding-touched.js --files <file...>
```

- 完整驗收：

```bash
node tools_node/run-acceptance.js
```

---

## 14. MCP 工具鏈現況

`2026-04-04` 已實測可用：
- `figma`
- `playwright`
- `cocos-log-bridge`

另一路可用：
- `cocos-creator` 的 `http://127.0.0.1:3000/mcp` 端點已完成 `initialize / tools/list / scene_* / project_*` 驗證

目前限制：
- `cocos-log-bridge` 與 `cocos-creator` 目前抓到的 scene context 偏向 Editor scene graph，不一定等於 runtime scene。

---

## 15. 量產相關文件

這批文件集中在：
- `artifacts/ui-qa/UI-2-0073/`

關鍵文件：
- `figma-cocos-playwright-production-blueprint-v1.md`
- `figma-component-library-structure-v1.md`
- `figma-proof-mapping-contract-v1.md`
- `ui-spec-skeleton-scaffolder-2026-04-04.md`
- `mcp-smoke-test-report-2026-04-04.md`
- `proof-mapping-template.detail-split.json`
- `proof-mapping-template.dialog-card.json`
- `proof-mapping-template.rail-list.json`

---

## 16. 架構評估（2026-04-05，Agent1）

完整報告：`docs/架構評估報告_2026-04-05_Agent1.md`

發現 7 個架構缺口，已全數開單（UI-2-0074 ~ UI-2-0079）：

| 卡號 | 問題 | 優先 | 狀態 |
|------|------|------|------|
| UI-2-0074 | UIConfig UIID 只有 6 個入口；22 個畫面繞過 UIManager | **P0** | ✅ done |
| UI-2-0075 | UISpecLoader 15 個獨立 new 實例，無共享快取 | P1 | ✅ done |
| UI-2-0076 | Binder 遷移：11 個元件仍用手動節點操作 | P1 | open |
| UI-2-0077 | 14 個元件 `loadI18n('zh-TW')` 硬編碼 | P1 | ✅ done |
| UI-2-0078 | MemoryManager 為空殼（無 LRU / releaseByScope） | P2 | open |
| UI-2-0079 | `UILayerName` deprecated enum 殘留 Constants.ts | P3 | ✅ done |

Phase E（新增）= 架構補強優先序列，最終目標是讓 UIManager 覆蓋全部 22+ 個畫面。

---

## 17. UIConfig / UIManager 現況（2026-04-05，Agent1）

### UIConfig.ts UIID enum（25 入口）

| 層級 | UIID 清單 |
|------|-----------|
| Game | BattleHUD, DeployPanel, BattleLogPanel, TigerTallyPanel, ActionCommandPanel |
| UI | LobbyMain, ShopMain, GachaMain, Gacha, GeneralList, BloodlineMirrorAwakening |
| PopUp | GeneralDetail, GeneralDetailBloodline, GeneralPortrait, GeneralQuickView, UnitInfoPanel, SupportCard, SpiritTallyDetail, EliteTroopCodex |
| Dialog | DuelChallenge, ResultPopup |
| System | SystemAlert, NetworkStatus, BloodlineMirrorLoading |
| Notify | Toast |

所有 PopUp/UI 層新入口已填入 `prefab` 佔位路徑（`"ui/<name>"`）——待 Prefab 實際落地後路徑才有效。

### UIManager.ts 新 API

```typescript
// 注入層級容器節點（SceneController 的 onLoad 中呼叫一次）
services().ui.setupLayers({ [LayerType.UI]: lobbyContainer, [LayerType.PopUp]: popupContainer });

// 非同步開啟（自動 loadPrefab → instantiate → register → open）
await services().ui.openAsync(UIID.LobbyMain);

// 同步開啟（已 register 的場景節點舊路徑，保持向後相容）
services().ui.open(UIID.BattleHUD);
```

---

## 18. 目前下一步

- ✅ **P1 完成**：UI-2-0077（i18n 脫硬編碼 — 15 元件全改用 `services().i18n.currentLocale`）
- **P1 排入**：UI-2-0076（Binder 遷移，等 DATA-1-0001 確認 bind path 合約）
- 為 LobbyMain / ShopMain / Gacha 建立真正的 Prefab，讓 openAsync 完整走通
- 解除 UI-2-0046 blockers → 繼續 UI-2-0026（BattleScene 對位修正）
- 收斂 slot-map 匯出格式，讓它能直接轉成 scaffolder config JSON
- 繼續校正 `cocos-log-bridge` 的 scene context
- 持續擴充 template family，但遵守 template-first，而不是為單一畫面濫開新模板
