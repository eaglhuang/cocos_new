<!-- doc_id: doc_task_0202 -->
# 任務卡：battle-vfx-lightning-arc

## frontmatter
```yaml
id: battle-vfx-lightning-arc
status: done
priority: P1
area: battle / vfx / shader
started_at: "2026-04-17"
completed_at: "2026-04-17"
started_by_agent: "Codex"
```

## 目標
- 實作路線 C 第 2 支程序化 Shader：`lightning-arc.effect`。
- 建立可在戰法/場勢中條件掛載的雷電弧視覺，保留 fallback 與可調參數。

## 實作範圍
- `assets/bundles/vfx_core/shaders/lightning-arc.effect`
- `assets/bundles/vfx_core/shaders/lightning-arc.effect.meta`
- `assets/scripts/battle/views/BoardRenderer.ts`
- `assets/bundles/vfx_core/README.md`

## 已完成
- [x] 新增 `lightning-arc.effect` 程序化材質（透明混合、噪聲擾動、脈衝閃爍）。
- [x] `BoardRenderer` 新增 `NightRaid` 條件 lazy-load：
  - `tryEnsureLightningArcMaterial(...)`
  - `loadLightningArcMaterial(...)`
- [x] `resolveSceneEffectMaterial('night-raid')` 改為優先使用 `lightningArcFillMaterial`，失敗 fallback 到既有 `sceneEffectCampFillMaterial`。
- [x] 失敗重試機制：載入失敗會解除 request lock，後續可重試。
- [x] `vfx_core/README.md` 更新 shader 數量與積木表。

## 驗證紀錄
- [x] TypeScript parse：`BoardRenderer.ts` `parse-ok`
- [x] 夜襲 smoke：
  - `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic night-raid --outDir artifacts/ui-qa/lightning-arc-check --timeout 120000`
- [x] 普通戰法對照：
  - `node tools_node/capture-ui-screens.js --target BattleScene --battleTactic normal --outDir artifacts/ui-qa/lightning-arc-check-normal --timeout 120000`
- [x] 125px 檢視主圖：
  - `artifacts/ui-qa/lightning-arc-check/BattleScene.png`
  - `artifacts/ui-qa/lightning-arc-check-normal/BattleScene.png`

- [x] Runtime probe（puppeteer-core）確認條件掛載：night-raid = hasLightningArcMaterial:true；normal = false

## 備註
- 本次掛載點選擇 `NightRaid` 是因為現有 battle flow 已具備 `night-raid` tile state，可直接驗收。
- 若要改成「雷擊專屬戰法」可在後續新增 `BattleTactic` 與 `TileEffectState` 再平移掛載邏輯。