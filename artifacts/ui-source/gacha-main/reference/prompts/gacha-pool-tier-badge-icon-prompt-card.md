# Gacha Pool Tier Badge Icon Prompt Card

## Basic

- screenId: `GachaMain`
- iconFamilyId: `icon-badge-suite`
- suiteScope: `pool-tier-badge`
- sourceMode: `ai-exploration`
- targetPlatform: `Web / iOS / Android / PC`

## Structure

- structureMode: `underlay-glyph-runtime-label`
- runtimeTextPolicy: `PoolTierLabel` 由 runtime 疊字，AI 不直接畫 SSR / SR / UR 文字
- underlayPolicy: badge underlay 與主 glyph 分件輸出，可獨立替換或疊字
- batchMembers: `badgeGlyph`, `badgeUnderlay`

## Style Inputs

- related screen family: `gacha-default` + `widget.header.plaque.badge.*`
- material language: 溫暖羊皮紙 / 金邊 / 輕量 ornament，不走重工業或戰場戰術語言
- line weight: 小尺寸仍可讀的中細描邊
- outline / glow policy: 可有微金邊或柔和內發光，但不可厚重到搶文字
- small-size readability target: 176x44 badge dock 下仍可辨識

## Must Keep

1. 中央 glyph 形體清楚，縮小後仍可辨識。
2. underlay 可支撐 runtime 疊字，不可被過度 ornament 佔滿。
3. 與同一套 gacha badge family 保持一致材質與輪廓語言。

## Must Avoid

1. 可讀英文字、中文字、數字。
2. 重工業、厚金屬、戰場 tactical HUD 語言。
3. 太厚的 medal 或深透視結構，導致 badge dock 內文字空間被吃掉。

## Runtime Overlay Rules

- can overlay label: yes
- can overlay number/count: no
- can overlay rarity/state: yes, 由 runtime label 控制
- forbidden baked text: `SSR`, `SR`, `UR`, 任意可讀字樣

## Batch Generation Plan

- should batch together: `badgeGlyph` + `badgeUnderlay`
- per-icon differences allowed: glyph 紋樣、邊角 ornament 微差異
- family consistency checkpoints: 內外輪廓厚度、金色明度、羊皮紙底板髒污量需一致

## Draft Prompt

```text
Create a two-part gacha badge icon suite for a Three Kingdoms ink-parchment UI. Part A is a centered badge glyph. Part B is a flat readable badge underlay that supports runtime text overlay. Warm parchment and light gold detailing, elegant and collectible, small-size readable, clean silhouette, consistent family language, no heavy industrial metal.
```

## Negative / Guardrails

```text
no text, no letters, no numbers, no SSR letters, no deep perspective medal, no sci-fi metal, no battle HUD style, no full button rectangle, no photorealism
```

## Output Plan

- promptFile: `artifacts/ui-source/gacha-main/reference/prompts/gacha-pool-tier-badge-icon-prompt-card.md`
- generatedDir: `artifacts/ui-source/gacha-main/reference/generated/icon-suite/`
- selectedReference: `artifacts/ui-source/gacha-main/reference/selected/`
- expectedOutputs: `badgeGlyph`, `badgeUnderlay`

## Open Questions For User

1. 這個 badge family 要偏收藏徽章，還是偏淡雅紙牌標籤？
2. 是否允許 underlay 帶明顯稀有度色偏，還是維持中性由 runtime label 控制？
3. 未來 support / limited 池是否共用同一 badge 家族，只調色不換輪廓？