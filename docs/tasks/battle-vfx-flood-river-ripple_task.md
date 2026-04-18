<!-- doc_id: doc_task_0201 -->
# 任務卡：battle-vfx-flood-river-ripple

## frontmatter
```yaml
id: battle-vfx-flood-river-ripple
status: done
priority: P1
area: battle / vfx / shader
started_at: "2026-04-17"
completed_at: "2026-04-17"
started_by_agent: "Codex"
```

## 目標
- 讓河道地板的 `water-ripple.effect` 只在 `BattleTactic.FloodAttack` 啟用時掛上。
- 維持非水淹戰法時的基底材質行為，不引入額外載入或視覺副作用。

## 實作範圍
- `assets/scripts/battle/views/BoardRenderer.ts`
- `assets/bundles/vfx_core/shaders/water-ripple.effect`
- `assets/resources/textures/bg_water.png`

## 已完成
- [x] `renderState(state)` 以 `state.battleTactic` 觸發 `tryEnsureFloodRippleMaterial(...)`。
- [x] `tryEnsureFloodRippleMaterial(...)` 僅在 `BattleTactic.FloodAttack` 進行 lazy-load。
- [x] `resolveCellBaseMaterial('flood-river')` 優先使用 ripple 材質，失敗時 fallback 靜態 flood base 材質。
- [x] 失敗重試機制：載入失敗後會解除請求鎖，下一次可重試。

## 驗證紀錄
- [x] `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic flood-attack --outDir artifacts/ui-qa/flood-ripple-check --timeout 120000`
- [x] `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic normal --outDir artifacts/ui-qa/flood-ripple-check-normal --timeout 120000`
- [x] 125px 檢視主圖：
  - `artifacts/ui-qa/flood-ripple-check/BattleScene.png`
  - `artifacts/ui-qa/flood-ripple-check-normal/BattleScene.png`

## 備註
- 已達成「發動水淹戰法時才掛上 effect」的條件掛載需求。
- 若需更貼圖參考圖風格，可再調 `riverDir` / `flowParams` / `foamParams` 參數做第二輪美術校準。