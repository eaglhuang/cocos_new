---
doc_id: doc_agentskill_0034
name: doc-consolidation-flow
description: "USE FOR: MCQ, 整併疑問書, 規格整併, 疑點裁決, consolidation-manifest, scan-answers, rewrite-all, doc-id-registry, 討論來源整併。當任務涉及 docs/遊戲規格文件/討論來源/ 內容歸納、衝突轉 MCQ、人工填答後批次回寫相關規格文件時啟用。強制流程: generate -> 人工填答 -> scan-answers -> rewrite-all。DO NOT USE FOR: UI 視覺調整、一般程式除錯、非規格文件任務。"
argument-hint: "輸入日期資料夾(例如 20260412)、單一討論檔路徑，或輸入 scan 進行新檔偵測。"
---

# Doc Consolidation Flow

本 skill 的唯一目標是讓 Agent 在規格整併任務中穩定命中完整 MCQ 閉環，不跳步、不漏寫、不手動硬判。

## Trigger Keywords

以下關鍵詞任一命中，就應載入本 skill：

- MCQ
- 整併疑問書
- 疑點裁決
- generate
- scan-answers
- rewrite-all
- consolidation-manifest
- doc-id-registry
- 討論來源整併
- 規格衝突

## Guardrails

- 禁止 Agent 自行拍板衝突內容。
- 禁止省略衝突全文，只寫簡短摘要題目。
- 禁止跳過 scan-answers 直接 rewrite-all。
- 禁止把回寫目標硬編碼在題號對照表作為主流程。
- 回寫目標必須來自 MCQ metadata 與 doc-id-registry 解析結果。

## Standard MCQ Workflow

### Step 0: Pre-flight

1. 讀 keep 摘要與 token guard，避免超上下文。
2. 掃描討論來源新檔，並比對 consolidation-manifest。

建議命令：

```bash
git status --short docs/遊戲規格文件/討論來源/
```

### Step 1: 產生 MCQ（強制完整題幹）

使用以下命令產生題目：

```bash
node tools_node/consolidation-doubt-mcq.js generate \
  --summary "題目名稱" \
  --sources "doc_id1,doc_id2" \
  --options "A:選項A|B:選項B|C:選項C|D:選項D" \
  --conflict "完整衝突段落：哪份文件說什麼、矛盾在哪、不拍板會影響什麼" \
  --rewrite-targets "doc_id1,doc_id2,doc_id3"
```

規則：

- conflict 必填，不可只寫一行摘要。
- 題目格式必須對齊整併疑問書 Q14 之後風格：
  - 來源衝突單段落
  - A/B/C/D 純文字選項
  - 決策欄位
- 每題必須寫入 metadata comments：
  - mcq-sources
  - mcq-rewrite-targets
  - mcq-opt-A/B/C/D
  - mcq-conflict

### Step 2: 人工填答

人類在整併疑問書填答：

```text
👉 請在此填寫你的決策：A
```

### Step 3: 掃描答案

```bash
node tools_node/consolidation-doubt-mcq.js scan-answers
```

要求：

- 必須看見已答題列表。
- 若 0 題，停止後續流程，不得回寫。

### Step 4: 批次回寫

```bash
node tools_node/consolidation-doubt-mcq.js rewrite-all
```

回寫要求：

- 逐題讀取 metadata。
- 用 doc-id-registry 解析實體檔案路徑。
- 對所有目標文件追加裁決記錄。
- 避免重複寫入同一題。
- 回寫後在整併疑問書標記已回寫與時間。

## Validation Checklist

每輪收工前必須全部滿足：

- 已生成 MCQ，且每題 conflict 為完整衝突段落。
- 已人工填答，且 scan-answers 可掃到答案。
- rewrite-all 已執行完成，無 fatal error。
- 每題已回寫到所有 rewrite-targets 對應文件。
- 整併疑問書已出現已回寫標記與裁決選項。
- consolidation-manifest 已同步狀態與 mcqRefs。
- touched files 已做編碼檢查（UTF-8 無 BOM、無 mojibake）。

## Failure Handling

### A. generate 失敗

常見原因：缺少 conflict、options 格式錯誤。

處理：

1. 修正參數後重跑 generate。
2. 不可手工先寫半成品題目再補。

### B. scan-answers 顯示 0 題

常見原因：人類未填、格式不符、題目區塊被破壞。

處理：

1. 確認決策欄格式。
2. 修復題目格式後重跑 scan-answers。
3. 在掃到答案前禁止 rewrite-all。

### C. rewrite-all 找不到 doc_id

常見原因：rewrite-targets 填錯、registry 缺漏。

處理：

1. 檢查 doc-id-registry。
2. 修正目標 doc_id 後重跑 rewrite-all。
3. 不可改用硬路徑跳過 registry。

### D. 回寫後有重複內容

處理：

1. 先檢查同題是否已存在 MCQ 決策記錄。
2. 若重複，保留最新正確版本並清除重複段。
3. 補上 manifest 與整併疑問書一致性。

## Minimal Completion Contract

任務可宣告完成，必須同時符合：

1. MCQ 題目完整且可讀。
2. 人類答案已被掃描。
3. 相關規格文件已全數回寫。
4. 整併疑問書與 manifest 狀態一致。
- [ ] `正式規格矛盾審查.md` (doc_spec_0001) 已更新（若有新矛盾）
- [ ] `cross-reference-index.md` (doc_index_0005) 已更新
- [ ] encoding check 通過
- [ ] token 量級回報完成
