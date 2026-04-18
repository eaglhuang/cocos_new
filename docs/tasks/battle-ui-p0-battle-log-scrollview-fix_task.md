<!-- doc_id: doc_task_0139 -->
# 任務卡 — battle-ui-p0-battle-log-scrollview-fix

## frontmatter
```yaml
id: battle-ui-p0-battle-log-scrollview-fix
status: not-started
priority: P0
area: battle-ui
started_at: ~
started_by_agent: ~
```

## 摘要

`BattleLogPanel` 的 `onBuildComplete()` 完成後，
Log 輸出顯示 `scrollView:false`，表示 `ScrollView` 元件**斷鏈**：

```
[BattleLogPanel] 綁定完成 — scrollView:false label:true contentNode:true
```

這意味著玩家無法在戰鬥紀錄中滾動查看舊訊息，
且 `_flush()` 的 `scrollView?.scrollToBottom()` 呼叫靜默失效。

## 根源分析

`onBuildComplete()` 以 `this._deepFind('ScrollView')` 搜尋節點，
但後續 `.getComponent(ScrollView)` 回傳 null，可能原因：

| 可能原因 | 排查方式 |
|---|---|
| A. Layout JSON 中節點名稱非 `ScrollView`（如 `battleLogScrollView`） | 比對 `battle-log-main.json` 中節點 `name` 欄位 |
| B. `ScrollView` 組件未在 JSON/程式碼中掛建 — 節點存在但無此元件 | 檢查 `UIPreviewBuilder` 是否支援建構 ScrollView 型別 |
| C. `_deepFind` 搜尋範圍未涵蓋 `ScrollView` 所在層級 | 檢查節點層級深度是否超出 BFS 範圍 |
| D. Inspector `@property scrollView` 未綁定且 JSON 查找失敗 | 確認 Inspector 欄位是否需要手動拖拽綁定 |

## 驗收條件

- [ ] Log 中 `scrollView:true`（綁定成功）
- [ ] 累積戰鬥訊息後，Panel 可正常滾動
- [ ] `append()` 後 ScrollView 自動滾至底部
- [ ] 折疊 / 展開按鈕動畫正常（Tween 0.3s）
- [ ] QA 截圖：展開狀態下日誌條目可見

## 影響檔案

- `assets/scripts/ui/components/BattleLogPanel.ts`
- `assets/resources/ui-spec/layouts/battle-log-main.json`
- `assets/resources/ui-spec/screens/battle-log-screen.json`

## 規格來源

- `docs/主戰場UI規格書.md (doc_ui_0001)` (doc_ui_0001) §2.5（右側：戰鬥紀錄與控制）
- `docs/主戰場UI規格補充_v3.md (doc_ui_0003)` (doc_ui_0003) Zone 5（v3-2 日誌可收合）

## 修法方向

**Step 1**：讀取 `battle-log-main.json`，確認 ScrollView 節點的 `name` 與 `type` 欄位。

**Step 2**：若節點名稱與 `_deepFind('ScrollView')` 不符，更新 `onBuildComplete` 中的
查找字串為正確的節點名稱。

**Step 3**：若 `UIPreviewBuilder` 未自動掛建 `ScrollView` 元件，
在 `onBuildComplete` 中手動 `addComponent(ScrollView)` 並設定 content node。

**Step 4**：若 Inspector `@property` 優先路徑可行，考慮直接在 Scene/Prefab 中
手動拖拽綁定 ScrollView（適合設計師主導方案）。

## notes

> （由執行 Agent 填入開工/進度/驗收紀錄）
