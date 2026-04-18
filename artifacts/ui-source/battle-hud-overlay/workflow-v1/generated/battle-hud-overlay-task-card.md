---
id: UCUF-BATTLE-HUD-OVERLAY-SCREEN
priority: P1
phase: M0
created: 2026-04-15
created_by_agent: GitHubCopilot
owner: GitHubCopilot
status: open
type: composite-panel
related_cards: []
depends: []
screen_id: battle-hud-overlay-screen
parent_panel: CompositePanel
fragments_owned:
  []
content_contract_schema: contracts/battle-hud-overlay-content.schema.json
data_sources_owned:
  - topBar
  - left
  - right
skin_manifest: skins/battle-hud-overlay-default.json
skin_slots_added: []
skin_layers_used: []
atlas_group: battle-hud-overlay
child_panels:
  - name: TopBarHost
  - name: LeftOverlayHost
  - name: RightOverlayHost
    type: layout-native
    data_source: topBar
    type: layout-native
    data_source: left
    type: layout-native
    data_source: right
smoke_route: BattleScene -> attach BattleHudOverlay HUD
verification_commands:
  - node tools_node/validate-ui-specs.js --strict --check-content-contract
  - node tools_node/ucuf-runtime-check.js --screen battle-hud-overlay-screen
  - node tools_node/check-encoding-touched.js <changed-files>
deliverables:
  - assets/resources/ui-spec/screens/battle-hud-overlay-screen.json
  - assets/resources/ui-spec/contracts/battle-hud-overlay-content.schema.json
  - assets/resources/ui-spec/layouts/battle-hud-overlay-main.json
  - assets/resources/ui-spec/skins/battle-hud-overlay-default.json
  - assets/scripts/ui/components/BattleHudOverlayComposite.ts
docs_backwritten:
  - docs/keep.md
  - docs/cross-reference-index.md
  - docs/ui/UCUF-UI-template-blueprint.md
---

# UCUF-BATTLE-HUD-OVERLAY-SCREEN BattleHudOverlay Recipe Onboarding

## 背景

BattleHudOverlay 已經有可運作的 UCUF/既有畫面資產，但目前仍缺少正式 recipe 到工具鏈的編譯入口。
本卡的目標是把 battle-hud-overlay-screen 的 machine-readable recipe 轉成可穩定重建的 screen spec 與可執行任務卡，作為 hud-overlay family 的第一批 compiler 樣本。

## 實作清單

- [ ] 以 recipe 正規化 battle-hud-overlay-screen 的 screen metadata
- [ ] 確認 content contract battle-hud-overlay-content 與 dataSources 對齊
- [ ] 為 hud-overlay family 補齊 v0 compiler 需要的欄位映射
- [ ] 產出 generated review / runtime 驗收骨架（若尚未存在）

## 驗收條件

- [ ] recipe 與 screen spec 欄位一致（screenId=battle-hud-overlay-screen）
- [ ] validate-ui-specs --strict --check-content-contract 全部通過
- [ ] UCUF runtime smoke route 可進入目標畫面
- [ ] 所有 required data source 都可對應到 content contract 欄位
- [ ] validation profile 套用為 hud-overlay-strict

## 結案檢查清單

- [ ] task card frontmatter 可通過 validate-ucuf-task-card.js
- [ ] 相關 recipe / screen spec / contract 路徑皆可解析
- [ ] 所有變更檔案已完成 encoding check

