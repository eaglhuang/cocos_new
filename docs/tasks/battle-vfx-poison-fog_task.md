<!-- doc_id: doc_task_0203 -->
# 任務卡：battle-vfx-poison-fog

## frontmatter
```yaml
id: battle-vfx-poison-fog
status: done
priority: P1
area: battle / vfx / shader
started_at: "2026-04-17"
completed_at: "2026-04-17"
started_by_agent: "Codex"
```

## 目標
- 實作路線 C 第 3 支程序化 Shader：`poison-fog.effect`。
- 讓 BattleScene 在 `BattleTactic.AmbushAttack` 才掛載毒霧材質，非伏擊戰法維持既有森林底材。

## 實作範圍
- `assets/bundles/vfx_core/shaders/poison-fog.effect`
- `assets/bundles/vfx_core/shaders/poison-fog.effect.meta`
- `assets/scripts/battle/views/BoardRenderer.ts`
- `assets/bundles/vfx_core/README.md`

## 已完成
- [x] 新增 `poison-fog.effect`（程序化流動霧層 + 呼吸密度變化）。
- [x] 新增 `poison-fog.effect.meta` 並完成資產註冊。
- [x] `BoardRenderer` 新增 `AmbushAttack` 條件 lazy-load：
  - `tryEnsurePoisonFogMaterial(...)`
  - `loadPoisonFogMaterial(...)`
- [x] `resolveSceneEffectMaterial('ambush-field')` 改為優先使用 `poisonFogFillMaterial`，失敗 fallback `sceneEffectForestFillMaterial`。
- [x] 補強重試語意：`floodRipple` / `lightningArc` / `poisonFog` 三者在載入回傳 `null` 時都會解除 request lock，後續可重試。
- [x] `assets/bundles/vfx_core/README.md` 更新 shader 總數與毒霧積木條目。

## 驗證紀錄
- `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic ambush-attack --outDir artifacts/ui-qa/poison-fog-check --timeout 120000`
- `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic normal --outDir artifacts/ui-qa/poison-fog-check-normal --timeout 120000`
- Runtime probe（puppeteer-core）：
  - `ambush-attack`: `hasPoisonFogMaterial=true`
  - `normal`: `hasPoisonFogMaterial=false`

- [x] 125px 主圖：
  - `artifacts/ui-qa/poison-fog-check/BattleScene.png`
  - `artifacts/ui-qa/poison-fog-check-normal/BattleScene.png`

## Notes
- `2026-04-17`：開卡，開始實作 C-3 poison-fog。
- `2026-04-17`：完成 C-3 實作與 smoke 驗證，任務結案（status: done）。
