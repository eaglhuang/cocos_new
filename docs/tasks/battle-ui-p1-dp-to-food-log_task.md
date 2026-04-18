<!-- doc_id: doc_task_0143 -->
# 任務：battle-ui-p1-dp-to-food-log

## frontmatter
```yaml
id: battle-ui-p1-dp-to-food-log
status: done
priority: P1
area: battle-ui / BattleScene log
started_at: "2026-04-01"
started_by_agent: "Copilot-Agent"
```

## 問題描述
截圖確認：右側戰鬥日誌顯示 "斬敵門日鏦 · DP 30" 等舊版 DP 用語。
v3 規格已將 DP 改為「糧草（攜帶上限）」。BattleScene.ts 有 3 處 append 仍用 "DP"。

## 接受條件
- 戰鬥日誌不再出現 "DP" 字樣
- 改為「糧草 N」形式與 v3 規格一致

## 修改位置
- assets/scripts/battle/views/BattleScene.ts (line 247, 495, 996)

## 完成記錄
- [ ] 3 處 append 訊息 DP → 糧草
- [ ] 重截圖確認日誌用語