<!-- doc_id: doc_task_0205 -->
# 任務卡：battle-vfx-ice-crystal

## frontmatter
```yaml
id: battle-vfx-ice-crystal
status: done
priority: P1
area: battle / vfx / shader
started_at: "2026-04-17"
completed_at: "2026-04-17"
started_by_agent: "Codex"
```

## 目標
- 實作路線 C 最後一支程序化 Shader：`ice-crystal.effect`。
- 讓 BattleScene 在 `BattleTactic.FloodAttack` 的 `river-current` overlay 才掛載冰晶材質，並保留水流底材與 fallback。

## 實作範圍
- `assets/bundles/vfx_core/shaders/ice-crystal.effect`
- `assets/bundles/vfx_core/shaders/ice-crystal.effect.meta`
- `assets/scripts/battle/views/BoardRenderer.ts`
- `assets/bundles/vfx_core/README.md`

## 已完成
- [x] 新增 `ice-crystal.effect`（程序化冰晶高光 + 碎晶閃爍 + 呼吸脈衝）。
- [x] 新增 `ice-crystal.effect.meta` 並完成資產註冊。
- [x] `BoardRenderer` 新增 FloodAttack 條件 lazy-load：
  - `tryEnsureIceCrystalMaterial(...)`
  - `loadIceCrystalMaterial(...)`
- [x] `resolveSceneEffectMaterial('river-current')` 改為優先使用 `iceCrystalFillMaterial`，失敗 fallback `sceneEffectWaterFillMaterial`。
- [x] `assets/bundles/vfx_core/README.md` 更新 shader 總數與冰晶積木條目。

## 驗證紀錄
- `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic flood-attack --outDir artifacts/ui-qa/ice-crystal-check --timeout 120000`
- `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic normal --outDir artifacts/ui-qa/ice-crystal-check-normal --timeout 120000`
- Runtime probe（puppeteer-core）：
  - `flood-attack`: `hasIceCrystalMaterial=true`
  - `normal`: `hasIceCrystalMaterial=false`

- [x] 125px 主圖：
  - `artifacts/ui-qa/ice-crystal-check/BattleScene.png`
  - `artifacts/ui-qa/ice-crystal-check-normal/BattleScene.png`

## Notes
- `2026-04-17`：開卡，開始實作 C-5 ice-crystal。
- `2026-04-17`：完成 C-5 實作與 smoke 驗證，任務結案（status: done）。
