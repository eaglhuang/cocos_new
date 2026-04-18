---
id: UCUF-SHOP-MAIN-SCREEN
priority: P1
phase: M0
created: 2026-04-15
created_by_agent: GitHubCopilot
owner: GitHubCopilot
status: open
type: composite-panel
related_cards: []
depends: []
screen_id: shop-main-screen
parent_panel: CompositePanel
fragments_owned:
  []
content_contract_schema: contracts/shop-main-content.schema.json
data_sources_owned:
  - title
  - selectedCategory
  - items
  - selectedItem
  - gold
  - gems
  - canBuySelected
skin_manifest: skins/shop-main-default.json
skin_slots_added: []
skin_layers_used: []
atlas_group: shop-main
child_panels:
  - name: ShopMainTabBarChild
  - name: ShopMainItemGridChild
  - name: CurrencyBarHost
  - name: ShopMainPurchasePanelChild
    type: tab-routed
    data_source: selectedCategory
    type: list-host
    data_source: items
    type: toolbar-host
    data_source: gold
    type: preview-host
    data_source: selectedItem
smoke_route: LobbyScene -> open ShopMain
verification_commands:
  - node tools_node/validate-ui-specs.js --strict --check-content-contract
  - node tools_node/ucuf-runtime-check.js --screen shop-main-screen
  - node tools_node/check-encoding-touched.js <changed-files>
deliverables:
  - assets/resources/ui-spec/screens/shop-main-screen.json
  - assets/resources/ui-spec/contracts/shop-main-content.schema.json
  - assets/resources/ui-spec/layouts/shop-main-main.json
  - assets/resources/ui-spec/skins/shop-main-default.json
  - assets/scripts/ui/components/ShopMainComposite.ts
docs_backwritten:
  - docs/keep.md
  - docs/cross-reference-index.md
  - docs/ui/UCUF-UI-template-blueprint.md
---

# UCUF-SHOP-MAIN-SCREEN ShopMain Recipe Onboarding

## 背景

ShopMain 已經有可運作的 UCUF/既有畫面資產，但目前仍缺少正式 recipe 到工具鏈的編譯入口。
本卡的目標是把 shop-main-screen 的 machine-readable recipe 轉成可穩定重建的 screen spec 與可執行任務卡，作為 rail-list family 的第一批 compiler 樣本。

## 實作清單

- [ ] 以 recipe 正規化 shop-main-screen 的 screen metadata
- [ ] 確認 content contract shop-main-content 與 dataSources 對齊
- [ ] 為 rail-list family 補齊 v0 compiler 需要的欄位映射
- [ ] 產出 generated review / runtime 驗收骨架（若尚未存在）

## 驗收條件

- [ ] recipe 與 screen spec 欄位一致（screenId=shop-main-screen）
- [ ] validate-ui-specs --strict --check-content-contract 全部通過
- [ ] UCUF runtime smoke route 可進入目標畫面
- [ ] 所有 required data source 都可對應到 content contract 欄位
- [ ] validation profile 套用為 rail-list-game-standard

## 結案檢查清單

- [ ] task card frontmatter 可通過 validate-ucuf-task-card.js
- [ ] 相關 recipe / screen spec / contract 路徑皆可解析
- [ ] 所有變更檔案已完成 encoding check

