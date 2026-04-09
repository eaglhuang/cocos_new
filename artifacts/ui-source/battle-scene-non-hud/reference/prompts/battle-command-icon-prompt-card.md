# BattleScene Non-HUD Command Icon Prompt Card

## Basic

- screenId: `BattleSceneNonHUD`
- iconFamilyId: `battle-action-icon-v1`
- suiteScope: `battle-command-control-suite`
- sourceMode: `hybrid`
- targetPlatform: `Web / iOS / Android / PC`

## Structure

- structureMode: `glyph-only`
- runtimeTextPolicy: label 仍由 runtime `EndTurnLabel / TacticsLabel / DuelLabel` 與 log rail 組件承擔
- underlayPolicy: button surface / rail chip / CTA base 由 runtime 既有 skin 處理
- batchMembers: `endturn`, `tactics`, `duel`, `auto`, `speed`, `setting`, `collapse`

## Style Inputs

- related screen family: `action-command-screen` + `battle-log-screen`
- material language: `gold CTA core + deep-ink tactical control rail`
- line weight: 偏粗，32px 與 48px 都要清楚
- outline / glow policy: 只允許極低量邊光；不能和 Ultimate CTA 本體爭主焦點
- small-size readability target: `32x32` log rail controls / `48x48` EndTurn / `82x82` Tactics / Duel

## Must Keep

1. F8 戰鬥功能按鈕語言，要比 F7 更偏指令與操作，不偏收藏徽章。
2. action-command 與 battle-log 雖分層，但 glyph 家族要共用同一套戰術控制語言。
3. silhouette 需一眼分辨 end turn、tactics、duel、auto、speed、setting、collapse。

## Must Avoid

1. 把整顆 button 背板一起畫進 PNG。
2. 文案、字母、x2、AUTO、齒輪文字標籤。
3. 過重的戰利品徽章感、過亮金框、過深透視。

## Runtime Overlay Rules

- can overlay label: yes
- can overlay number/count: no
- can overlay rarity/state: no
- forbidden baked text: `AUTO`, `x2`, `END`, `DUEL`

## Batch Generation Plan

- should batch together: `endturn`, `tactics`, `duel`, `auto`, `speed`, `setting`, `collapse`
- per-icon differences allowed: glyph 主體與方向
- family consistency checkpoints: 同一筆觸厚度、同一墨金屬質感、同一 tactical control silhouette 規格

## Draft Prompt

```text
Create a tactical command glyph suite for a Three Kingdoms battle UI. Generate small readable glyph-only icons for end turn, tactics, duel, auto, speed, setting, and collapse. Visual language: deep-ink battlefield, restrained gold command cues, cold tactical control rail. These are not full buttons and not reward badges. Keep the whole suite consistent in weight and material, with clear silhouettes that remain readable at 32px and 48px.
```

## Negative / Guardrails

```text
no text, no letters, no x2 label, no AUTO label, no full button plate, no collectible medal, no sci-fi HUD, no giant glow ring, no perspective UI mockup
```

## Output Plan

- promptFile: `artifacts/ui-source/battle-scene-non-hud/reference/prompts/battle-command-icon-prompt-card.md`
- generatedDir: `artifacts/ui-source/battle-scene-non-hud/reference/generated/icon-suite/battle-action-icon-v1/`
- selectedReference: `artifacts/ui-source/battle-scene-non-hud/reference/selected/battle-command-runtime-reference.md`
- expectedOutputs: `battle-action_command_glyph`, `battle-log_control_glyph`

## Open Questions For User

1. `battle-log` 四顆 control 是否接受走更低存在感的 F8 子系，而不是沿用 action-command 的高亮語言？
2. `EndTurn` 是否要有專屬金色優先權，還是與 `Duel / Tactics` 完全同 family、只靠 underlay 區分？
3. battle-log 的 `setting / collapse` 是否應拆回 `common-utility-icon-v1`，而不是留在 battle-action-icon-v1？
