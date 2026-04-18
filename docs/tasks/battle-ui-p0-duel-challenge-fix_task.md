<!-- doc_id: doc_task_0140 -->
# 任務卡 — battle-ui-p0-duel-challenge-fix

## frontmatter
```yaml
id: battle-ui-p0-duel-challenge-fix
status: not-started
priority: P0
area: battle-ui
started_at: ~
started_by_agent: ~
```

## 摘要

`DuelChallengePanel` 在 QA 截圖中呈現兩個嚴重問題：
1. **i18n key 未解析**：「接受」/「拒絕」按鈕上直接顯示原始 key（`UI_DUEL_ACCEPT` /
   `UI_DUEL_REJECT`）而非中文文字。
2. **面板超出右側邊界**：Panel 的 Widget 或 position 設定導致面板靠右截斷，
   應居中於螢幕。

## 問題根源分析

### 問題 1 — i18n key 未解析

`DuelChallengePanel.buildUI()` 在 `onLoad()` 中同步呼叫，此時 `UIPreviewBuilder`
尚未完成 `buildScreen()`（非同步），所以 i18n 映射表尚未載入。按鈕的 Label 字串
由硬編碼的常數字串設定，但若這些字串是 i18n key 格式（`UI_DUEL_ACCEPT`），
就需要等映射表就緒後再套用。

**確認點**：
- `DuelChallengePanel.buildUI()` 內按鈕標籤設定位置（搜尋 `UI_DUEL_ACCEPT` 的出處）
- 是否透過 `UIPreviewBuilder.buildScreen()` 的 i18n 路徑，或是直接硬寫 key 字串

### 問題 2 — Panel 超出右側邊界

`buildUI()` 中卡片節點 `_Card` 以 `setPosition(new Vec3(0, 30, 0))`
設定相對於根節點的位置，但根節點的 Widget/Anchor 可能未對齊螢幕中心，
導致 Panel 整體向右偏移。

## 驗收條件

- [ ] DuelChallenge 面板在 1920×1080 檢視時完整置中顯示（Panel 不超出任何邊界）
- [ ] 「接受單挑」按鈕顯示中文文字（非 i18n key）
- [ ] 「拒絕挑戰」按鈕顯示中文文字（非 i18n key）
- [ ] 點擊接受 → 觸發 `duelAccepted` 事件，面板淡出消失
- [ ] 點擊拒絕 → 觸發 `duelRejected` 事件，面板淡出消失
- [ ] QA 截圖確認（搭配 cocos-preview-qa 或 cocos-screenshot skill）

## 影響檔案

- `assets/scripts/ui/components/DuelChallengePanel.ts`
- `assets/resources/ui-spec/layouts/duel-challenge-main.json`（若存在）
- `assets/resources/ui-spec/skins/duel-challenge-default.json`（若存在）

## 規格來源

- `docs/主戰場UI規格書.md (doc_ui_0001)` (doc_ui_0001) §4（彈窗與反饋）
- `docs/主戰場UI規格補充_v3.md (doc_ui_0003)` (doc_ui_0003)

## 修法方向

1. **i18n 問題**：在 `buildUI()` 中直接以**中文字串**設定按鈕 Label，
   不使用 i18n key 格式（DuelChallengePanel 是程式碼動態建構，不走規格 JSON 路徑）。
2. **置中問題**：確認 `DuelChallengePanel` 的根節點掛有 Widget 並設定
   `alignLeft/Right/Top/Bottom = true, margin = 0`；或確保父節點 Anchor 為 (0.5, 0.5)。

## notes

> （由執行 Agent 填入開工/進度/驗收紀錄）
