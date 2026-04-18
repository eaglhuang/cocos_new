---
id: UCUF-GENERAL-LIST-SCREEN
priority: P1
phase: M0
created: 2026-04-15
created_by_agent: GitHubCopilot
owner: GitHubCopilot
status: open
type: composite-panel
related_cards: []
depends: []
screen_id: general-list-screen
parent_panel: CompositePanel
fragments_owned:
  []
content_contract_schema: contracts/general-list-content.schema.json
data_sources_owned:
  - generals
skin_manifest: skins/general-list-default.json
skin_slots_added: []
skin_layers_used: []
atlas_group: general-list
child_panels:
  - name: ListSlotHost
    type: list-host
    data_source: generals
smoke_route: LobbyScene -> onClickGeneralList() -> GeneralListComposite.show(generals)
verification_commands:
  - node tools_node/validate-ui-specs.js --strict --check-content-contract
  - node tools_node/ucuf-runtime-check.js --screen general-list-screen
  - node tools_node/check-encoding-touched.js <changed-files>
deliverables:
  - assets/resources/ui-spec/screens/general-list-screen.json
  - assets/resources/ui-spec/contracts/general-list-content.schema.json
  - assets/resources/ui-spec/layouts/general-list-main.json
  - assets/resources/ui-spec/skins/general-list-default.json
  - assets/scripts/ui/components/GeneralListComposite.ts
docs_backwritten:
  - docs/keep.md
  - docs/cross-reference-index.md
  - docs/ui/UCUF-UI-template-blueprint.md
---

# UCUF-GENERAL-LIST-SCREEN GeneralList Recipe Onboarding

## 背景

GeneralList 已經有可運作的 UCUF/既有畫面資產，但目前仍缺少正式 recipe 到工具鏈的編譯入口。
本卡的目標是把 general-list-screen 的 machine-readable recipe 轉成可穩定重建的 screen spec 與可執行任務卡，作為 rail-list family 的第一批 compiler 樣本。

## 實作清單

- [ ] 以 recipe 正規化 general-list-screen 的 screen metadata
- [ ] 確認 content contract general-list-content 與 dataSources 對齊
- [ ] 為 rail-list family 補齊 v0 compiler 需要的欄位映射
- [ ] 產出 generated review / runtime 驗收骨架（若尚未存在）

## 驗收條件

- [ ] recipe 與 screen spec 欄位一致（screenId=general-list-screen）
- [ ] validate-ui-specs --strict --check-content-contract 全部通過
- [ ] UCUF runtime smoke route 可進入目標畫面
- [ ] 所有 required data source 都可對應到 content contract 欄位
- [ ] validation profile 套用為 rail-list-game-standard

## 結案檢查清單

- [ ] task card frontmatter 可通過 validate-ucuf-task-card.js
- [ ] 相關 recipe / screen spec / contract 路徑皆可解析
- [ ] 所有變更檔案已完成 encoding check

