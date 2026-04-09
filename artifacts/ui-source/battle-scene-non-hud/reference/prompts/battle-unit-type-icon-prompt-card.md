# BattleScene Non-HUD Troop Type Icon Prompt Card

## Basic

- screenId: `BattleSceneNonHUD`
- iconFamilyId: `battle-badge-icon-v1`
- suiteScope: `battle-troop-type-suite`
- sourceMode: `hybrid`
- targetPlatform: `Web / iOS / Android / PC`

## Structure

- structureMode: `underlay-plus-glyph`
- runtimeTextPolicy: `TigerTally` 若保留兵種縮寫，由 runtime label 疊加；PNG 不烘任何字
- underlayPolicy: badge underlay 與 glyph 分開輸出，保留 runtime 組裝
- batchMembers: `cavalry`, `infantry`, `shield`, `archer`, `pikeman`, `engineer`, `medic`, `navy`

## Style Inputs

- related screen family: `tiger-tally-screen` + `unit-info-panel-screen`
- material language: `deep-ink battlefield + cold tactical HUD + restrained antique metal`
- line weight: 2px 左右的一致線重，避免小尺寸糊掉
- outline / glow policy: 可有極輕薄外輪廓，不做霓虹、不做厚 glow
- small-size readability target: `32x32` TigerTally badge / `38x38` UnitInfo type icon

## Must Keep

1. 兵種識別必須一眼區分騎兵、步兵、盾兵、弓兵、長槍兵、工兵、醫護兵、水軍，不靠文字補救。
2. underlay 屬於框體層，glyph 屬於內容層，兩者不可烘成單張 full badge。
3. 整套在 BattleScene 暗底與半透明蒙版上仍要清楚，不能走商業徽章或轉蛋勳章語言。

## Must Avoid

1. 不可做成 SSR / UR / reward badge 的收藏品語言。
2. 不可把完整矩形 frame、ribbon、牌框或大面積底板烘進 glyph。
3. 不可加入文字、字母、數字或羅馬縮寫。

## Runtime Overlay Rules

- can overlay label: yes
- can overlay number/count: no
- can overlay rarity/state: yes, 由 runtime tint / state 控制
- forbidden baked text: `CV`, `IN`, `AR`, `PK`, `SH`, `EN`, `MD`, `NV`

## Batch Generation Plan

- should batch together: `cavalry`, `infantry`, `shield`, `archer`, `pikeman`, `engineer`, `medic`, `navy`
- per-icon differences allowed: 中央兵種符號輪廓與內部形狀
- family consistency checkpoints: 外輪廓尺度、材質語言、亮暗關係、線重、視覺重心一致

## Draft Prompt

```text
Create a troop-type icon suite for a Three Kingdoms tactical battle UI. Generate separate underlay and glyph assets for cavalry, infantry, shield, archer, pikeman, engineer, medic, and navy as the first runtime batch. Visual language: deep-ink battlefield, cold tactical HUD, restrained antique metal, subtle parchment-metal badge support. Keep the badge underlay and the central glyph as separate assets so runtime can assemble them. The glyphs must stay readable at 32px and 38px on a dark battle scene overlay. No text, no letters, no numbers, no collectible reward badge styling, no full rectangular frame, no giant ribbon.
```

## Negative / Guardrails

```text
no text, no letters, no numbers, no SSR badge, no gacha medal, no collectible card frame, no neon glow, no sci-fi plating, no long ribbon, no full button rectangle
```

## Output Plan

- promptFile: `artifacts/ui-source/battle-scene-non-hud/reference/prompts/battle-unit-type-icon-prompt-card.md`
- generatedDir: `artifacts/ui-source/battle-scene-non-hud/reference/generated/icon-suite/battle-badge-icon-v1/`
- selectedReference: `artifacts/ui-source/battle-scene-non-hud/reference/selected/battle-unit-type-runtime-reference.md`
- expectedOutputs: `battle-unit-type_glyph_*`, `battle-unit-type_underlay`

## Open Questions For User

1. `siege / smart` 是否要在 BattleScene runtime enum 未落地前，先只留在規格保留區？
2. `TigerTally` 最終是否仍要保留 runtime 兵種縮寫，或改成純 glyph 呈現？
3. `engineer / medic / navy` 是否需要額外一輪視覺語意審核，以避免跟一般戰鬥兵種混淆？
