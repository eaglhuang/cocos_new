<!-- doc_id: doc_ai_0021 -->
# Agent2 Visual QA Playbook

本文件只保留 Agent2 執行 D 階段 QA 的操作步驟。通用規則、單寫者、編碼與提交規則請看 [../keep.md (doc_index_0011)](../keep.md (doc_index_0011)) (doc_index_0011)。

## 1. 適用任務

- `UI-1-0014` / D-1
- `UI-1-0015` / D-2
- `UI-1-0016` / D-3

## 2. 產出位置

每張卡固定放在：

- `artifacts/ui-qa/<task-id>/`
- `artifacts/ui-qa/<task-id>/notes.md`

常用截圖命名：

- `<screen>-phone-16-9.png`
- `<screen>-phone-19_5-9.png`

## 3. 驗收前提

- 必須走真實 `LoadingScene` preview host
- 必須是 screen-driven preview
- 不得拿 legacy 手刻場景代替正式 QA

## 4. 執行步驟

1. 開啟 `LoadingScene.scene`
2. 設定 `previewMode = true`
3. 指定 `previewTarget`
4. 產出 `16:9` 與 `19.5:9` 截圖
5. 存入對應 `artifacts/ui-qa/<task-id>/`
6. 回填 `notes.md`
7. 同步更新任務狀態與 notes

## 5. `notes.md` 最少要寫

- screen
- ratio
- capture time
- pass / needs-tweak / blocked
- 主要觀察點
- 若 blocked，交給哪個 Agent 處理

## 6. QA 觀察點

- 承載面是否清楚
- 深淺層次是否成立
- shadow / noise / frame 是否正確
- 元件密度是否過擠
- 參考圖對齊程度

## 7. 阻塞處理

- preview host 壞掉：開 Agent1 卡
- screen contract 不一致：開 Agent1 卡
- 純視覺或素材問題：標記對應 task / notes
- 無法驗證時，狀態維持 `in-progress` 或 `blocked`，不要假裝完成
