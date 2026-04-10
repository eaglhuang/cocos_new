# 任務卡 — battle-ui-p1-reference-layout-minimalism-pass

## frontmatter
```yaml
id: battle-ui-p1-reference-layout-minimalism-pass
status: in-progress
priority: P1
area: battle-ui / art-direction
started_at: "2026-04-08"
started_by_agent: "Codex"
depends: battle-ui-p1-hp-bar-visual
```

## 摘要

以參考圖 `C:/Users/User/Pictures/cocos專案/戰場UI參考布局.png` 為「布局語言」對照，
將 BattleScene 進一步往 **角落化資訊、右側縱向操作軸、中央戰場留白** 的方向推進。

注意：本卡只借鑑布局節奏與資訊分層，不移植其賽博題材或現代都市美術。
BattleScene 仍需遵守 keep 共識的：

- `deep-ink battlefield + cold tactical HUD + gold CTA`
- 這是全域 UI 美術系統在戰場場景下的戰術化變體，不跟晨昏地圖色調綁定
- 主戰場不可套用人物頁 / 商業卡包式 plaque 語言

## 本輪已完成

- [x] Top HUD 改為更角落化的三段式資訊板
- [x] Fortress bar 改為較窄、較清楚的上方戰況條
- [x] 左側虎符卡從白模色塊切到正式軍牌底圖
- [x] 右下 ActionCommand 改為縱向操作軸 + 主奧義圓盤
- [x] BattleLog 預設收合，降低工具層遮擋

## 仍待推進

- [ ] 左上 / 右上指揮旗標做成更有辨識度的斜角或切角 banner 資產
- [ ] 右側操作軸補 icon-only / icon-first 的正式資產，降低文字依賴
- [ ] 收合後 BattleLog 改為更乾淨的小型戰報 tab，而非矩形工具塊
- [ ] Top HUD 人名、陣營識別、兵力 / 狀態欄做出更明確的敵我對照
- [ ] 依 BattleScene 最新截圖再做一次 zone-by-zone 視覺評審

## 若需生圖的候選資產

1. `battle_corner_banner_player`
   - 左上玩家 banner，冷藍鋼鐵切角，適合名稱 + 小徽記
2. `battle_corner_banner_enemy`
   - 右上敵方 banner，深紅鋼鐵切角，與玩家 banner 成對
3. `battle_action_rail_icons`
   - 計謀 / 單挑 / 結束 三顆右側操作軸 icon-first 資產
4. `battle_log_tab_compact`
   - 收合態戰報 tab，小型金屬片而非大矩形

## 驗收指標

- [ ] 1920×1080 預覽下，中央戰場至少保有 70% 以上主要視覺注意力
- [ ] 戰鬥 UI 從截圖第一眼可分出「我方 / 敵方 / 指令 / 工具」四個層級
- [ ] 右側操作軸與奧義圓盤形成明確主從關係
- [ ] 不需依賴大段文字也能理解主要互動入口

## notes

目前尚未執行生圖，原因是現階段瓶頸仍以布局與節奏為主，現有 battle_ui 資產足以先做方向收斂。
當 layout 節奏穩定後，再進入本卡的候選資產生成階段。
