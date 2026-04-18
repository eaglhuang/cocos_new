<!-- doc_id: doc_ui_0031 -->
# UI 規格補遺 2026-04-11 培育戰場轉蛋 pending

> 對應母規格：`結緣系統（配種）.md` (doc_spec_0028)、`教官系統（支援卡）.md` (doc_spec_0027)、`培育系統.md` (doc_spec_0026)、`關卡設計系統.md` (doc_spec_0044)、`轉蛋系統.md` (doc_spec_0042)
> 對應入口：`BondingSetup`、`NurtureSession`、`BattleScene`、`GachaMain`

## 補遺目的

本補遺只定義「待定 contract 掛點」，把本輪新落版內容延伸到 UI 文件可實作的摘要層；不宣告新的正式 fullscreen 畫面，也不建立平行系統殼層。

## BondingSetup pending contract

1. `bonding-lineage-mode-chip`
   - 定位：結緣配置畫面的父母摘要列或結果預估卡旁。
   - 內容：本次模式為 `Standard / Peace_Lineage`、是否仍具親傳資格、是否已受退役或教官化邊界影響。
   - 限制：只做模式提示與資格摘要，不延伸成宗廟、傳家寶或家系儀式子頁。

## NurtureSession pending contract

1. `nurture-phase-block-header`
   - 定位：培育主畫面頂部進度列或回合摘要條。
   - 內容：`Round 1-12`、`13-24`、`25-36` 對應的三階段學年、目前所在 phase、目前教學介入類型（一般教官 / 英靈傳道）。
   - 限制：不可用來提前揭露未解鎖五維精確值，不替代既有回合 / TP 主資訊。

2. `graduation-tags-strip`
   - 定位：畢業結算條、培育完成摘要列，或人物頁的後續 peek 卡。
   - 內容：`Graduation_Tags`，例如「槍將預備 / 夜襲適性 / 水戰候補」。
   - 限制：只做戰術傾向摘要，不直接替玩家自動配好 loadout，也不把關卡答案一次交完。

## BattleScene pending contract

1. `strategist-hud-summary`
   - 定位：Top HUD 次層資訊帶，或右側可收合的軍師資訊抽屜。
   - 內容：`Theme_Hazard`、`Interactive_Object_Status`、`requiredIntelValue` 對照、`Environment_Bonus_Pct` 摘要、`Recommended_Loadout_Gap`。
   - 限制：不得直接揭露埋伏點、完整 AI 腳本或開局站位答案。

2. `stage-salvage-summary`
   - 定位：戰中可收合提示條，或戰後結果面板的摘要卡。
   - 內容：石材 / 木材 / 補給 / 情報等 `Stage_Salvage` 類別與本戰累積結果。
   - 限制：不在戰中逐筆把經濟收益刷到帳號資源列，避免 HUD 過載與經濟責任混線。

## GachaMain pending contract

1. `gacha-pool-positioning-brief`
   - 定位：卡池 tabs 上緣說明帶、池子切換後的 hero card 上方，或 pity 區旁的說明 chip。
   - 內容：名將池 = `Bloodline_Seed`、支援卡池 = `Nurture_Depth`、死亡傳承另由名將身後結算處理。
   - 限制：不得把 `英靈卡 / 虎符卡` 說成抽卡可得內容，也不回流 `DP` 用語。

## 非目標

1. 不在本補遺內宣告新的 `screen.json` 正式路徑。
2. 不把 `BattleScene` 的軍師 HUD 拆成另一套平行戰場 UI。
3. 不把 `GachaMain` 額外拆成「雙池教學全屏」才看得懂的重引導頁。
4. 不把 `Peace_Lineage` 包裝成獨立世界觀系統頁。