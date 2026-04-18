<!-- doc_id: doc_task_0204 -->
# 任務卡：battle-vfx-wind-vortex

## frontmatter
```yaml
id: battle-vfx-wind-vortex
status: done
priority: P1
area: battle / vfx / shader
started_at: "2026-04-17"
completed_at: "2026-04-17"
started_by_agent: "Codex"
```

## 目標
- 實作路線 C 第 4 支程序化 Shader：`wind-vortex.effect`。
- 讓 BattleScene 在 `BattleTactic.RockSlide` 才掛載風渦材質，非落石戰法維持既有岩石底材。

## 實作範圍
- `assets/bundles/vfx_core/shaders/wind-vortex.effect`
- `assets/bundles/vfx_core/shaders/wind-vortex.effect.meta`
- `assets/scripts/battle/views/BoardRenderer.ts`
- `assets/bundles/vfx_core/README.md`

## 已完成
- [x] 新增 `wind-vortex.effect`（程序化中心旋流 + 條帶掠影 + 呼吸脈衝）。
- [x] 新增 `wind-vortex.effect.meta` 並完成資產註冊。
- [x] `BoardRenderer` 新增 `RockSlide` 條件 lazy-load：
  - `tryEnsureWindVortexMaterial(...)`
  - `loadWindVortexMaterial(...)`
- [x] `resolveSceneEffectMaterial('hazard-rock')` 改為優先使用 `windVortexFillMaterial`，失敗 fallback `sceneEffectRockFillMaterial`。
- [x] `assets/bundles/vfx_core/README.md` 更新 shader 總數與風渦積木條目。

## 驗證紀錄
- `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic rock-slide --outDir artifacts/ui-qa/wind-vortex-check --timeout 120000`
- `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic normal --outDir artifacts/ui-qa/wind-vortex-check-normal --timeout 120000`
- Runtime probe（puppeteer-core）：
  - `rock-slide`: `hasWindVortexMaterial=true`
  - `normal`: `hasWindVortexMaterial=false`

- [x] 125px 主圖：
  - `artifacts/ui-qa/wind-vortex-check/BattleScene.png`
  - `artifacts/ui-qa/wind-vortex-check-normal/BattleScene.png`

## Notes
- `2026-04-17`：開卡，開始實作 C-4 wind-vortex。
- `2026-04-17`：完成 C-4 實作與 smoke 驗證，任務結案（status: done）。
