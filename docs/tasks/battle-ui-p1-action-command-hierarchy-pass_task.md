<!-- doc_id: doc_task_0141 -->
# 任務卡 — battle-ui-p1-action-command-hierarchy-pass

## frontmatter
```yaml
id: battle-ui-p1-action-command-hierarchy-pass
status: in-progress
priority: P1
area: battle-ui / action-command
started_at: "2026-04-08"
started_by_agent: "Codex"
depends: battle-ui-p1-reference-layout-minimalism-pass
```

## 摘要

BattleScene 右下操作區依最新參考圖，持續往「主按鈕最重、戰術次按鈕成組、待機/結束回合最輕」的權重結構推進。

這條線的目標不是單純把按鈕排好，而是要讓玩家在戰場中央專注時，右下角能憑輪廓與相對尺寸一眼理解：

- 最大圓：主技能 / 奧義
- 中型雙鍵：中頻戰術操作
- 最小小鍵：低頻待機 / 結束回合

## 本輪已完成

- [x] ActionCommand 由縱向 rail 改成主按鈕 + 右側雙次鍵 + 上方小待機鈕
- [x] 待機 / 結束回合降為最小級尺寸
- [x] 新增 `CommandDockPlate`，建立右下操作群的底座與群組感
- [x] 補 action-command 三層 JSON 的權重分層

## 待推進

- [ ] 右下操作群補 icon-first 正式資產，降低對中文字的依賴
- [ ] 待機 / 結束回合按鈕改成更明確的低頻 muted 造型
- [ ] 奧義主按鈕補 ready / charging / disabled 三態的更明確視覺層級
- [ ] 指令底座改為更貼近參考圖的斜切 / 非矩形 plate
- [ ] 若現有 battle_ui 資產不足，開圖生成 `battle-action-command-pack-v1`

## 建議生圖資產包（若啟動）

資產包名稱：`battle-action-command-pack-v1`

包含：
- `battle_action_dock_plate`
- `battle_action_endturn_minor`
- `battle_action_tactics_major`
- `battle_action_duel_major`
- `battle_action_ultimate_core_v2`
- `battle_action_icon_set_v1`

## 驗收條件

- [ ] 512px 寬縮圖下仍可明確辨識三段權重
- [ ] 不閱讀文字也能推斷哪顆是主技能、哪顆是低頻待機
- [ ] 右下操作群與主戰場不互相搶視覺焦點
- [ ] 低頻待機按鈕在視覺上不與主技能等權

## notes

目前尚未啟動生圖，因為布局與權重語言仍可先用現有資產逼近。
若下一輪截圖仍顯示辨識不足，直接開 `battle-action-command-pack-v1` 進入資產生成階段。
