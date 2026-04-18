<!-- doc_id: doc_task_0131 -->
# UCUF UI Task Card Template

> 版本：v1.0 | 日期：2026-04-12
> 對應架構：`docs/universal-composite-ui-framework-plan.md (doc_ui_0052)` (doc_ui_0052) v1.3
> 本模板取代舊 `UI-task-card-template.md` (doc_task_0132) 作為所有新 UCUF UI 任務的開卡範本。

---

## Frontmatter 範例

```yaml
---
# ══════════════════════════════════════════
#  Section A — 基本資訊（每張卡必填）
# ══════════════════════════════════════════
id: UCUF-XXXX
priority: P1                     # P0（阻塞）/ P1（核心）/ P2（改善）/ P3（美化）
phase: M4                       # 對應 plan.md 的里程碑：M1~M12
created: 2026-04-12
created_by_agent: AgentX
owner: AgentX
status: open                    # open / in-progress / blocked / done
type: composite-panel            # 見 §type 分類表

related_cards:
  - UCUF-YYYY
depends:
  - UCUF-ZZZZ

# ══════════════════════════════════════════
#  Section B — UCUF 架構約束（每張卡必填）
# ══════════════════════════════════════════

## B1: 畫面定義
screen_id: general-detail-unified    # Screen JSON 的 id（kebab-case）
parent_panel: CompositePanel         # 必須繼承 CompositePanel

## B2: Fragment 範圍（本張卡負責的 Fragment 列表）
fragments_owned:
  - fragments/layouts/tab-basics     # 本卡負責開發/修改的 Fragment
  - fragments/layouts/tab-stats

## B3: Content Contract
content_contract_schema: contracts/general-detail-content.schema.json
data_sources_owned:                  # 本卡負責的 dataSource 列表
  - basicAttributes                  # → AttributePanel
  - coreStats                        # → RadarChartPanel

## B4: Skin 與視覺資源
skin_manifest: skins/general-detail-v3-default.json
skin_slots_added: []                 # 本卡新增的 skinSlot（若無則空）
skin_layers_used:
  - slot: detail.footer.fill         # 使用 skinLayers 的面板及其 slot
    target_panel: FooterPanel
atlas_group: general-detail          # 所有 skinSlot 必須屬於此 Atlas

## B5: ChildPanel 使用
child_panels:
  - name: BasicInfoPanel
    type: attribute
    data_source: basicAttributes
  - name: StatsRadar
    type: radar-chart
    data_source: coreStats

# ══════════════════════════════════════════
#  Section C — 驗證與品質門檻（每張卡必填）
# ══════════════════════════════════════════

## C1: 最小可驗證路徑
smoke_route: LobbyScene → GeneralList → 點擊武將 → GeneralDetailComposite.mount()

## C2: 驗證指令（Agent 完成後必須全部執行並通過）
verification_commands:
  - node tools_node/validate-ui-specs.js --strict --check-content-contract
  - node tools_node/ucuf-runtime-check.js --screen general-detail-unified
  - node tools_node/check-encoding-touched.js <changed-files>

## C3: 效能 Budget（§19 規範）
perf_budget:
  build_screen_ms: 50
  switch_slot_first_ms: 30
  switch_slot_cached_ms: 5
  max_node_count: 35
  max_draw_calls: 15

## C4: 驗收條件（人類可讀）
acceptance:
  - Layout JSON 節點數 ≤ 35（R21）
  - 無同位置兄弟節點疊加（R19）
  - 所有 child-panel 有 dataSource（R27）
  - Content Contract schema 驗證通過
  - 截圖與 reference 對比 diff ≤ 2%

# ══════════════════════════════════════════
#  Section D — 交付物與文件回寫（每張卡必填）
# ══════════════════════════════════════════

## D1: 預期交付檔案（Agent 必須在完成前核對）
deliverables:
  - assets/resources/ui-spec/fragments/layouts/tab-basics.json
  - assets/resources/ui-spec/fragments/layouts/tab-stats.json
  - assets/scripts/ui/components/GeneralDetailComposite.ts（修改）

## D2: 文件回寫
docs_backwritten:
  - docs/keep.md (doc_index_0011)
  - docs/cross-reference-index.md (doc_index_0005)
  - docs/ui/systems/general-detail/README.md

---

## type 分類表

| type 值 | 說明 | 典型交付物 |
|---------|------|-----------|
| `composite-panel` | 新建 / 遷移一個完整的 CompositePanel 畫面 | Panel.ts + Layout JSON + Screen JSON + Contract |
| `fragment-develop` | 開發單一 Fragment（Tab 頁面） | Fragment JSON + ChildPanel 邏輯 |
| `child-panel-type` | 新增一種 ChildPanel 子類 | ChildPanel.ts + Registry 註冊 + 單元測試 |
| `skin-layer-work` | skinLayers / composite-image 視覺整合 | Skin JSON 修改 + Atlas 素材 |
| `content-contract` | 定義或修改 Content Contract Schema | Schema JSON + Mapper 修改 |
| `mapper-logic` | 純業務邏輯：資料映射、計算、格式轉換 | Mapper.ts 修改 |
| `migration` | 將既有畫面從舊架構遷移至 UCUF | 舊檔移入 _deprecated/ + 新 Panel + 截圖對比 |
| `performance` | 效能優化任務（§19 相關） | 程式碼修改 + benchmark 報告 |
| `tooling` | CLI 工具 / lint 規則 / 測試框架 | tools_node/ 新增 / 修改 |
| `architecture` | 核心架構修改（CompositePanel / ChildPanelBase / Registry） | 需獨佔鎖 |

---

## 必填欄位與完整性檢查

### 每張卡的 5 個「不可空白」區塊

| 區塊 | 不可空白欄位 | 空白代表什麼 |
|------|-------------|-------------|
| **B1 畫面定義** | `screen_id`, `parent_panel` | 不知道要做哪個畫面 → 卡片未收斂 |
| **B3 Content Contract** | `content_contract_schema`, `data_sources_owned` | 不知道資料結構 → 無法開始寫邏輯 |
| **B5 ChildPanel** | 至少一個 entry | 不知道用什麼元件 → 無法開始寫 Layout |
| **C1 smoke_route** | 非空字串 | 無法驗證 → 不算可交付 |
| **C2 verification_commands** | 至少包含 `validate-ui-specs.js` | 無自動驗證 → 品質無保障 |

### 選填但建議填的欄位

| 欄位 | 何時可省略 |
|------|-----------|
| `fragments_owned` | type 為 `mapper-logic` / `tooling` 時不涉及 Fragment |
| `skin_slots_added` | 只修改既有 skin，不新增 slot 時可為空陣列 |
| `perf_budget` | type 為 `content-contract` / `tooling` 等非渲染任務時可省略 |
| `atlas_group` | 不涉及視覺資源時可省略 |

---

## Agent 開卡流程（Step-by-Step）

```
┌─ Step 0: 前置閱讀 ──────────────────────────────────┐
│  ① 讀 docs/keep.summary.md (doc_index_0012)                          │
│  ② 讀 docs/universal-composite-ui-framework-plan.md (doc_ui_0052) │
│     （至少讀 §2 設計原則 + §4 ChildPanel 體系        │
│       + §9 Layout Spec v2 + §17 資料驅動規範）       │
│  ③ 讀本模板（UCUF-task-card-template.md）            │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 1: 確認任務邊界 ──────────────────────────────┐
│  ① 本卡的 type 是什麼？（見 type 分類表）            │
│  ② 本卡負責哪些 Fragment？（填 fragments_owned）      │
│  ③ 本卡負責哪些 dataSource？（填 data_sources_owned） │
│  ④ 是否需要新增 skinSlot？（填 skin_slots_added）     │
│  ⚠️ 若任一項無法確定 → 先開一張 type=content-contract │
│     的前置卡定義 Contract，再回來填本卡                │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 2: 填寫 Frontmatter ──────────────────────────┐
│  ① 複製本模板的 Frontmatter 範例                      │
│  ② 逐欄填入，不可留空不可留 placeholder               │
│  ③ perf_budget 參考 plan.md §19.4.1 的 budget 表     │
│  ④ acceptance 參考 plan.md §9.4 的 lint 規則表        │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 3: 填寫卡片本文 ─────────────────────────────┐
│  依照「卡片本文結構」填寫（見下方）                   │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 4: 自我驗證 ─────────────────────────────────┐
│  ① 檢查 5 個「不可空白」區塊是否完整                 │
│  ② 檢查 deliverables 是否對應 fragments_owned        │
│  ③ 檢查 data_sources_owned 是否對應 child_panels     │
│  ④ 如果是 type=architecture → 確認沒有其他 Agent     │
│     鎖定 UCUF-CORE-* 相關鎖                          │
└──────────────────────────────────────────────────────┘
```

---

## 卡片本文結構

Frontmatter 之後的 Markdown 本文，必須包含以下 4 個 section：

### 1. 背景（必填）

用 2~5 句話說明：
- **為什麼**需要這張卡？（痛點 / 前置卡的結論 / plan.md 哪個章節要求）
- **做完後**會改善什麼？

```markdown
## 背景

plan.md §4 定義了 `RadarChartPanel` 作為 UCUF 標準化元件，
但目前 StatsTab 仍使用 6 個 Label 手動排列六維數值。
本卡將 StatsTab 遷移為 RadarChartPanel + AttributePanel 組合，
減少節點數並統一資料驅動模式。
```

### 2. 實作清單（必填）

用 checklist 條列所有**具體的程式碼變更**。
每個條目必須標明**檔案路徑**和**動作**（新增 / 修改 / 刪除 / 搬移）。

```markdown
## 實作清單

- [ ] **新增** `assets/resources/ui-spec/fragments/layouts/tab-stats.json`
  - 使用 `child-panel` type，childType: `radar-chart` + `attribute`
  - dataSource: `coreStats`（雷達圖）、`detailedStats`（條目列表）
  - 節點數 ≤ 8
- [ ] **修改** `assets/resources/ui-spec/contracts/general-detail-content.schema.json`
  - 新增 `coreStats` 和 `detailedStats` 欄位定義
- [ ] **修改** `assets/scripts/ui/components/GeneralDetailOverviewMapper.ts`
  - `buildContentState()` 新增 `coreStats` 和 `detailedStats` 映射
- [ ] **驗證** `node tools_node/validate-ui-specs.js --strict --check-content-contract`
```

### 3. 驗收條件（必填）

用 checklist 條列所有**可機器驗證或人工確認的通過條件**。
每個條目必須是 boolean（通過 / 不通過），不可模糊。

```markdown
## 驗收條件

- [ ] `tab-stats.json` 節點數 ≤ 8
- [ ] `validate-ui-specs.js --strict --check-content-contract` 全部 PASS
- [ ] RadarChartPanel 在 runtime 中正確繪製六邊形（6 軸，maxValue=100）
- [ ] AttributePanel 正確顯示所有條目（label + value 格式一致）
- [ ] 截圖與 reference 對比 diff ≤ 2%
- [ ] encoding check 通過
```

### 4. 結案檢查清單（必填）

完成所有實作後，Agent **必須逐條確認**以下檢查清單：

```markdown
## 結案檢查清單

- [ ] 所有 verification_commands 執行通過
- [ ] deliverables 中列出的每個檔案都已建立 / 修改
- [ ] Frontmatter 的 `status` 已改為 `done`
- [ ] Frontmatter 的 `completed_at` 已填入 RFC3339 時間
- [ ] Frontmatter 的 `notes` 已更新為最終狀態紀錄
- [ ] docs_backwritten 中列出的每份文件都已同步
- [ ] shard_file 已更新（`node tools_node/build-ui-task-manifest.js` 已跑）
- [ ] cross-reference-index.md (doc_index_0005) 已同步
- [ ] encoding check 通過（`node tools_node/check-encoding-touched.js`）
```

---

## Agent 接卡流程

Agent 拿到一張已開好的任務卡後，執行順序如下：

```
Step 1: 讀卡 → 確認 5 個不可空白區塊都已填寫
        若有空白 → 停下，回報「任務卡不完整，需先補齊 Section B/C」

Step 2: 鎖卡
        - status → in-progress
        - started_at → 當前 RFC3339 時間
        - started_by_agent → 自己的 Agent 名稱
        - notes → 「YYYY-MM-DD | 狀態: in-progress | 變更: 開始開發 | 阻塞: none」

Step 3: 對照 fragments_owned → 開始開發 Layout / Fragment JSON
        對照 data_sources_owned → 開發 Mapper 邏輯
        對照 child_panels → 確認 ChildPanel 類型已註冊

Step 4: 開發完成後，逐條執行 verification_commands

Step 5: 逐條檢查「結案檢查清單」

Step 6: 狀態更新
        - status → done
        - completed_at → 當前 RFC3339 時間
        - notes → 最終紀錄
```

---

## 範例：完整任務卡

以下是一張符合本模板的完整任務卡範例，可直接作為 Agent 的工作指令。

```markdown
---
id: UCUF-0004
priority: P1
phase: M4
created: 2026-04-12
created_by_agent: TechDirector
owner: ""
status: open
type: fragment-develop

related_cards:
  - UCUF-0001
  - UCUF-0003
depends:
  - UCUF-0001

screen_id: general-detail-unified
parent_panel: CompositePanel

fragments_owned:
  - fragments/layouts/tab-stats

content_contract_schema: contracts/general-detail-content.schema.json
data_sources_owned:
  - coreStats
  - detailedStats

skin_manifest: skins/general-detail-v3-default.json
skin_slots_added: []
skin_layers_used: []
atlas_group: general-detail

child_panels:
  - name: StatsRadar
    type: radar-chart
    data_source: coreStats
  - name: StatsDetailList
    type: attribute
    data_source: detailedStats

smoke_route: LobbyScene → GeneralList → 點擊武將 → Tab切到Stats

verification_commands:
  - node tools_node/validate-ui-specs.js --strict --check-content-contract
  - node tools_node/ucuf-runtime-check.js --screen general-detail-unified
  - node tools_node/check-encoding-touched.js assets/resources/ui-spec/fragments/layouts/tab-stats.json

perf_budget:
  build_screen_ms: 50
  switch_slot_first_ms: 30
  switch_slot_cached_ms: 5
  max_node_count: 35
  max_draw_calls: 15

acceptance:
  - tab-stats.json 節點數 ≤ 8
  - RadarChartPanel 正確繪製六邊形
  - AttributePanel 條目數與 GeneralConfig 六維一致
  - validate-ui-specs.js 全部 PASS
  - 截圖 diff ≤ 2%

deliverables:
  - assets/resources/ui-spec/fragments/layouts/tab-stats.json（新增）
  - assets/resources/ui-spec/contracts/general-detail-content.schema.json（修改）
  - assets/scripts/ui/components/GeneralDetailOverviewMapper.ts（修改）

docs_backwritten:
  - docs/cross-reference-index.md (doc_index_0005)

shard_file: docs/tasks/tasks-ucuf.json

started_at: ""
started_by_agent: ""
completed_at: ""
notes: "2026-04-12 | 狀態: open | 驗證: pending | 變更: 待開始 | 阻塞: none"
---

# UCUF-0004 — StatsTab 遷移至 RadarChartPanel + AttributePanel

## 背景

plan.md §4.5 定義了 `RadarChartPanel` 作為六維數值圖表的標準化元件，
但目前 GeneralDetailOverview 的 Stats Tab 仍使用 7 個 Label 手動排列。
本卡將 StatsTab 的 Fragment 遷移為 `RadarChartPanel`（六角圖）+
`AttributePanel`（詳細數值條目）的組合，
減少節點數（7→2）並統一資料驅動模式。

## 實作清單

- [ ] **新增** `assets/resources/ui-spec/fragments/layouts/tab-stats.json`
  - root container + 2 個 child-panel
  - child-panel[0]: type=radar-chart, dataSource=coreStats, config.axes=[str,int,lea,pol,cha,luk]
  - child-panel[1]: type=attribute, dataSource=detailedStats, config.columns=2
  - 節點數 ≤ 8

- [ ] **修改** `assets/resources/ui-spec/contracts/general-detail-content.schema.json`
  - 新增欄位 `coreStats`: { type: object, required: true, description: "六維數值 {str,int,lea,pol,cha,luk}" }
  - 新增欄位 `detailedStats`: { type: array, required: true, description: "詳細屬性條目 [{label,value}]" }

- [ ] **修改** `assets/scripts/ui/components/GeneralDetailOverviewMapper.ts`
  - buildContentState() 新增：
    - `coreStats: { str: config.str, int: config.int, lea: config.lea, pol: config.pol, cha: config.cha, luk: config.luk }`
    - `detailedStats: [{ label: i18n.t('ui.stat.str'), value: String(config.str) }, ...]`

- [ ] **驗證** 執行所有 verification_commands

## 驗收條件

- [ ] `tab-stats.json` 節點數 ≤ 8
- [ ] `validate-ui-specs.js --strict --check-content-contract` 全部 PASS
- [ ] RadarChartPanel 在 runtime 正確繪製六邊形（6 軸，maxValue=100）
- [ ] AttributePanel 顯示 6 條屬性，格式一致
- [ ] encoding check 通過

## 結案檢查清單

- [ ] 所有 verification_commands 執行通過
- [ ] deliverables 中的 3 個檔案已建立/修改
- [ ] Frontmatter status → done, completed_at 已填
- [ ] docs_backwritten 中的文件已同步
- [ ] shard_file 已更新
- [ ] encoding check 通過
```

---

## 與舊 UI-task-card-template.md (doc_task_0132) 的差異

| 面向 | 舊模板 | UCUF 新模板 |
|------|--------|------------|
| 繼承要求 | 未指定 | 必須 `parent_panel: CompositePanel` |
| Fragment 範圍 | 無 | `fragments_owned` 明確列出 |
| Content Contract | `content_contract` 只列欄位名 | `content_contract_schema` 指向 schema JSON + `data_sources_owned` 列出本卡負責的 dataSource |
| ChildPanel 宣告 | 無 | `child_panels` 列出 name / type / data_source |
| 效能 Budget | 無 | `perf_budget` 5 項指標 |
| 驗證指令 | `smoke_route` 一行 | `verification_commands` 多行可執行指令 |
| skinLayers | 無 | `skin_layers_used` 明確列出 |
| Atlas 約束 | 無 | `atlas_group` 確保合批 |
| 交付檔案清單 | 無 | `deliverables` 逐檔列出 |
| 結案檢查 | 4 條通用 | 9 條 UCUF 專屬 |
