<!-- doc_id: doc_task_0206 -->
# 任務卡 battle-vfx-battle-flow-hooks

## frontmatter
```yaml
id: battle-vfx-battle-flow-hooks
status: done
priority: P1
area: battle / vfx / runtime
started_at: "2026-04-19"
completed_at: "2026-04-19"
started_by_agent: "Codex"
```

## 目標
- 在 `BattleScene` 戰鬥流程中掛上關鍵特效，覆蓋：
  - 受擊特效（UnitDamaged）
  - 死亡消失前特效（UnitDied before dissolve）
  - 其他流程型特效（技能施放、受迫位移、戰鬥結束）

## 實作檔案
- `assets/scripts/battle/views/BattleScene.ts`
- `docs/特效研究/claude規劃的3d粒子計畫.md`

## 完成項目
- [x] UnitDamaged 掛入命中特效，並對夜襲開場傷害做特效分流
- [x] UnitDied 在 `playDeathAsync` 前加爆裂 + 殘煙
- [x] GeneralSkillUsed / forcedMove / BattleEnded 掛入流程型特效
- [x] 回寫「啟動時機 + 特效名稱(描述)」對照表到研究文件
- [x] 執行語法與編碼檢查

## 驗證
- [x] `node tools_node/check-ts-syntax.js assets/scripts/battle/views/BattleScene.ts`
- [x] `node tools_node/check-encoding-touched.js --files docs/tasks/battle-vfx-battle-flow-hooks_task.md assets/scripts/battle/views/BattleScene.ts docs/特效研究/claude規劃的3d粒子計畫.md`

## Notes
- 2026-04-19 | 狀態: done | 動作: 完成 BattleScene 戰鬥流程掛點與文件回寫 | 風險: 低（全部使用已存在的 VFX block 與 EffectSystem API）
