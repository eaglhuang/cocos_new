# BattleScene Non-HUD Stat Micro Glyph Prompt Card

## Basic

- screenId: `BattleSceneNonHUD`
- iconFamilyId: `battle-status-icon-v1`
- suiteScope: `battle-stat-micro-suite`
- sourceMode: `spec-only`
- targetPlatform: `Web / iOS / Android / PC`
- memberSpec: `artifacts/ui-source/battle-scene-non-hud/tasks/battle-scene-non-hud-stat-micro-glyph-member-spec.json`

## Structure

- structureMode: `glyph-only`
- runtimeTextPolicy: `runtime number only`, no baked label
- underlayPolicy: no underlay by default; if runtime later needs a chip, the chip must be owned by screen runtime rather than baked into the glyph
- batchMembers: `atk`, `hp`, `cost`
- deferredMembers: `def`, `spd`

## Style Inputs

- related screen family: `tiger-tally-screen` + `unit-info-panel-screen`
- art bible: `docs/美術風格規格書.md`
- material language: `deep-ink battlefield + cold tactical HUD + restrained antique metal`
- layer discipline: `background / dark overlay / runtime frame / content glyph`
- line weight: `1.5px ~ 2px` at a `16px ~ 24px` working size
- small-size readability target: `16x16`, `20x20`, `24x24`

## Must Keep

1. `atk / hp / cost` 必須能在 BattleScene 非 HUD 深色場景上快速辨識。
2. `cost` 語意一律視為軍糧、補給、出征成本，不是貨幣。
3. glyph 只屬於內容層，不烘框、不烘牌、不烘大面積特效。

## Must Avoid

1. 不可使用文字、字母、數字，包含 `A / H / C / ATK / HP / FOOD`。
2. 不可把 `cost` 畫成金幣、元寶、寶石、票券、商城 token。
3. 不可把 `hp` 畫成可愛愛心貼紙或 RPG 治療道具。
4. 不可加入 ornate medal、badge plate、coin rim、button frame。

## Runtime Overlay Rules

- can overlay label: no
- can overlay number/count: yes
- can overlay rarity/state: no
- forbidden baked text: `ATK`, `HP`, `FOOD`, `COST`, `15`, `40`

## Batch Generation Plan

- should batch together: `atk`, `hp`, `cost`
- deferred until next batch: `def`, `spd`
- family consistency checkpoints: silhouette 方向一致、筆壓一致、在 `16px` 下仍能清楚區分三種語意

## Draft Prompt

```text
Create a micro glyph suite for a Three Kingdoms tactical battle UI. Generate small glyph-only icons for attack, health, and military provision cost. Visual language: deep-ink battlefield, cold tactical HUD, restrained antique metal accents. These glyphs sit next to runtime numbers on dark translucent battle cards and side drawers, so they must remain readable at 16px to 24px. Cost means ration or battle supply, not coin or premium currency. No text, no letters, no numbers, no full badge, no collectible reward icon styling.
```

## Negative / Guardrails

```text
no text, no letters, no numbers, no coin, no gem, no ticket, no cute emoji, no cartoon heart sticker, no giant gold medal, no full frame, no neon glow
```

## Output Plan

- promptFile: `artifacts/ui-source/battle-scene-non-hud/prompts/battle-scene-non-hud-stat-micro-glyph-suite.txt`
- generatedDir: `artifacts/ui-source/battle-scene-non-hud/reference/generated/icon-suite/battle-status-icon-v1/`
- selectedReference: `artifacts/ui-source/battle-scene-non-hud/reference/selected/battle-stat-micro-runtime-reference.md`
- expectedOutputs: `battle-stat-atk_glyph`, `battle-stat-hp_glyph`, `battle-stat-cost_glyph`

## Deferred For Later

1. `def / spd` 等待第一批 runtime integration 與可讀性結論後再開第二批。
2. `TigerTally` 兵種縮寫文字是否退場，等待本 suite 真正接入 runtime 後再決定。
