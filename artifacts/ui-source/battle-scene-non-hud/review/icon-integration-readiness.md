# BattleScene Non-HUD Icon Integration Readiness

更新日期: 2026-04-08

## 現況

- `TigerTallyPanel`
  - F7 `typeBadgeUnderlay` 已進 runtime 路徑
  - `typeIconResource` 已補進 `TallyCardData`，可傳給 `UnitInfoPanel`
  - `atk / hp / cost` 目前仍是純文字數值，尚未正式接入 stat micro glyph
- `UnitInfoPanel`
  - `unitinfo.type.icon` image slot 已 runtime-ready
  - `typeIconResource -> battle_unit_type_glyph_<type> -> legacy fallback` 已成立
  - `AtkRow / HpRow / CostRow` 已有 docking target，可承接 `UI-2-0101`
- `BattleLogPanel`
  - F8 overlay icon slot 已 runtime-ready
  - 目前 blocker 已從結構缺口轉成後續對位 polish
- `ActionCommandPanel`
  - F8 overlay icon slot 已 runtime-ready
  - 目前 blocker 已從結構缺口轉成後續對位 polish

## 本輪回寫

1. `UI-2-0099` troop-type suite 已完成首批 runtime member spec
   - `cavalry / infantry / shield / archer / pikeman / engineer / medic / navy`
   - `siege / smart` 保留為系統規格成員
2. `UI-2-0101` stat micro glyph suite 已完成正式 spec 包
   - `reference/prompts/battle-stat-micro-glyph-prompt-card.md`
   - `tasks/battle-scene-non-hud-stat-micro-glyph-suite.json`
   - `tasks/battle-scene-non-hud-stat-micro-glyph-member-spec.json`
   - `reference/selected/battle-stat-micro-runtime-reference.md`
   - 首批成員固定為 `atk / hp / cost`
   - `def / spd` 明確保留到第二批
   - `cost` 語意統一為軍糧 / 補給，不可走貨幣 icon 語言
3. 這一輪只做 spec / prompt / reference，不生圖

## 下一步

1. 等 `UI-2-0101` 需要正式生圖時，再依 member spec 批次生成首批三個 micro glyph。
2. glyph 實際接到 `TigerTallyPanel` / `UnitInfoPanel` runtime 後，再決定 `TigerTally` 的兵種縮寫文字是否退場。
3. `UnitInfoPanel` drawer 仍要繼續收 residual，目標 clean pass。
