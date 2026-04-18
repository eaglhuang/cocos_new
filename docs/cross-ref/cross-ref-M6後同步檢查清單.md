<!-- doc_id: doc_index_0018 -->
# Cross-Ref M6 後同步檢查清單

> **執行時機**：M6 驗收完成後（2026-04-14 傍晚）
> **預估時間**：30~45 分鐘
> **執行者**：Agent（自動化） + 人類（確認）

---

## ✅ Pre-flight 檢查（5 分鐘）

- [ ] `docs/cross-ref/cross-ref-進度.md (doc_index_0017)` 已開啟並備份
- [ ] `docs/cross-reference-index.md (doc_index_0005)` 母檔已備份
- [ ] 確認 M6 的 4 份規格書已更新：
  - [ ] `docs/遊戲規格文件/系統規格書/培育系統.md (doc_spec_0026)`
  - [ ] `docs/遊戲規格文件/系統規格書/教官系統（支援卡）.md (doc_spec_0027)`
  - [ ] `docs/遊戲規格文件/系統規格書/英靈世家系統.md (doc_spec_0022)`
  - [ ] `docs/遊戲規格文件/系統規格書/轉蛋系統.md (doc_spec_0042)`

---

## 📝 Step 1：更新 D-1「規格書實作進度」（15 分鐘）

### 編輯位置

`docs/cross-ref/cross-ref-進度.md` 第 29、62、59、73 行

### 四行更新內容

#### Line 29：教官系統（支援卡）.md

**原文**：
```markdown
| **教官系統（支援卡）.md (doc_spec_0027)** | 尚無實作 | 🔴 0% | 尚無 |
```

**修改為**：
```markdown
| **教官系統（支援卡）.md (doc_spec_0027)** | ... (列出相關代碼檔) | 🟡 40% | M6 整併確認支援卡屬性、階級定義；代碼實作與 UI Spec 待建 |
```

---

#### Line 62：英靈世家系統.md

**原文**：
```markdown
| 英靈世家系統.md (doc_spec_0011) | 尚無實作 | 🔴 0% | 尚無 |
```

**修改為**：
```markdown
| 英靈世家系統.md (doc_spec_0022) | ... | 🟡 25% | M6 整併確認血脈優先權機制；代碼實作待建 |
```

---

#### Line 59：培育系統.md

**原文**：
```markdown
| 培育系統.md (doc_spec_0026) | 尚無實作 | 🔴 0% | 尚無 |
```

**修改為**：
```markdown
| 培育系統.md (doc_spec_0026) | ... | 🟡 50% | M6 整併確認重修代價機制、Deck 組成、黃巾起義劇本；UI Spec（P0）待建 |
```

---

#### Line 73：轉蛋系統.md

**原文**：
```markdown
| 轉蛋系統.md (doc_spec_0042) | 尚無實作 | 🔴 0% | 尚無 |
```

**修改為**：
```markdown
| 轉蛋系統.md (doc_spec_0042) | ... | 🟡 15% | M6 整併確認支援卡轉蛋規則；代碼實作與 UI Spec（P1）待建 |
```

---

## 📋 Step 2：更新 D-2「待建 UI Spec」優先級（10 分鐘）

### 新增或優先級提升

在 D-2 表格中進行以下操作：

#### 操作 1：提升 nurture-session 為 P0

**原文** (Line 89)：
```markdown
| P0 | `layouts/nurture-session-main.json` | 培育系統.md (doc_spec_0026) |
| P1 | `skins/nurture-session-default.json` | 培育系統.md (doc_spec_0026) |
```

**保持不變**（已是 P0 & P1）

#### 操作 2：新增支援卡與血脈 Spec

在 D-2 表格結尾新增：

```markdown
| P1 | `layouts/gacha-support-card-pool-main.json` | 教官系統（支援卡）.md (doc_spec_0027)、轉蛋系統.md (doc_spec_0042) |
| P1 | `skins/gacha-support-card-pool-default.json` | 教官系統（支援卡）.md (doc_spec_0027)、轉蛋系統.md (doc_spec_0042) |
| P1 | `layouts/bloodline-priority-card-main.json` | 英靈世家系統.md (doc_spec_0022) |
```

---

## 🔄 Step 3：執行自動進度計算（10 分鐘）

### 命令執行

```bash
cd c:\Users\User\3KLife
node tools_node/rebuild-crossref.js --rebuild-progress
```

### 預期輸出

```
✅ Scanning cross-ref-進度.md...
✅ Parsing D-1 規格書實作進度...
✅ Calculating weighted progress...

[Progress Summary]
核心戰場系統：43% → 45%
UI 系統：75% → 70%
其他系統：25% → 30%
加權總進度：38% → 42%

✅ Updated D-4 progress table
✅ Cross-reference consistency check passed
```

### 失敗排除

若出現 error，檢查：

- [ ] D-1 四行的進度顏色碼是否正確（🟡 = 0.5，🟢 = 1.0）
- [ ] D-1 的規格書數是否未變（應為 55）
- [ ] 是否有多餘空格或特殊字符

---

## ✓ Step 4：驗收與文檔更新（5 分鐘）

### 驗收檢查

- [ ] D-1 四行已更新（教官、英靈、培育、轉蛋）
- [ ] D-2 新增 3 行 UI Spec（P1）
- [ ] D-4 加權進度重新計算（完成率應上升 3~5%）
- [ ] 無 error 或 warning

### 文檔更新

編輯 `docs/cross-reference-index.md (doc_index_0005)` Header：

**原文**：
```markdown
> 最後更新：2026-04-12（cross-ref-進度.md 自動掃描；代碼覆蓋掃描）
```

**修改為**：
```markdown
> 最後更新：2026-04-14（M6 整併完成；D-1 規格進度更新；D-2 UI Spec 優先級提升；D-4 自動進度計算）
```

---

## 🎯 整體對帳

### 四份規格書的狀態變更

| 規格書 | M6 前 | M6 後 | 變更理由 |
|--------|------|------|---------|
| 教官系統（支援卡）| 🔴 0% | 🟡 40% | 屬性、階級、戰法確認 |
| 英靈世家系統 | 🔴 0% | 🟡 25% | 血脈優先權機制確認 |
| 培育系統 | 🔴 0% | 🟡 50% | 重修、Deck、劇本確認 |
| 轉蛋系統 | 🔴 0% | 🟡 15% | 支援卡轉蛋規則確認 |

### 新增 UI Spec（P0/P1）

| UI Spec | 類型 | 依賴規格 |
|---------|------|---------|
| nurture-session-main.json | P0 | 培育系統 |
| gacha-support-card-pool-main.json | P1 | 教官+轉蛋 |
| bloodline-priority-card-main.json | P1 | 英靈世家 |

---

## 📊 完成後預期結果

```
更新前進度：38%（核心 43% / UI 75% / 其他 25%）
更新後進度：42%（核心 45% / UI 70% / 其他 30%）

進度提升：+4% ✅
```

---

## 🚀 後續步驟（同一天下午）

1. ✅ Cross-Ref 同步完成
2. 📌 在 doc-consolidation-flow 的 M6 完成報告中註記「Cross-Ref 已同步」
3. 🎯 開始 M7 計畫（整併優先級 1 & 3 的 6 份舊檔案）

---

**⏰ 預估總時間：45 分鐘**

