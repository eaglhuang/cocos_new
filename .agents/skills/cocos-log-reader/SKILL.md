---
doc_id: doc_agentskill_0003
name: cocos-log-reader
description: 'DEBUGGING SKILL — Read and analyze Cocos Creator project.log for runtime errors, warnings, and stack traces. USE FOR: any bug report, crash, UI glitch, TypeError, null reference, missing asset, CompositePanel mount fail, ChildPanel route fail, or screen spec wiring error. Load this skill FIRST before any runtime debugging session. DO NOT USE FOR: compile errors (use get_errors tool instead).'
argument-hint: 'Describe the symptom or error message to filter. Examples: "TypeError null root", "BattleHUD init fail", "GeneralDetailComposite mount fail", "label no textKey"'
---

# Cocos Log Reader（運行期日誌分析）

## When to Use

**凡是 runtime 問題，必先讀 log，再看程式碼。**

- 使用者回報 crash / TypeError / 畫面異常
- 使用者貼出錯誤截圖（Cocos Editor 彈出 Error 對話框）
- 任何「一團亂」、「看起來有問題」、「行為不對」的描述
- 分析 CompositePanel / ChildPanel / BattleScene / 任何組件初始化失敗

**不適用：**
- TypeScript 編譯錯誤 → 改用 `get_errors` 工具
- 純邏輯推理問題（不需要 log 佐證）

---

## Log 檔案位置

```
c:\Users\User\3KLife\temp\logs\project.log
```

- Cocos Creator 在 Editor Preview 時將所有 `console.log/warn/error` 寫入此檔
- 每次開啟 Editor 後累積，**不會自動清空**
- 新的 log 在檔案末尾

---

## 標準讀取流程（必須按順序執行）

### Step 1：讀取最近 N 行 log

根據問題複雜度選擇行數：
- 一般問題：最後 **150 行**
- 複雜問題 / 多個組件：最後 **400 行**

```powershell
Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Tail 150 -Encoding UTF8
```

### Step 2：針對症狀過濾

根據使用者描述的關鍵字縮小範圍：

```powershell
# 過濾 error 與 TypeError
Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Tail 400 -Encoding UTF8 |
  Where-Object { $_ -match "error|Error|TypeError|Cannot|undefined|null" } |
  Select-Object -Last 60

# 過濾特定組件
Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Tail 400 -Encoding UTF8 |
  Where-Object { $_ -match "BattleHUD|loadLayout|buildScreen" } |
  Select-Object -Last 40
```

### Step 3：讀取 log 檔大小（判斷是否需要更大範圍）

```powershell
(Get-Item "c:\Users\User\3KLife\temp\logs\project.log").Length
(Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Encoding UTF8 | Measure-Object -Line).Lines
```

---

## Log 格式解析

```
YYYY-M-DD HH:MM:SS - level: [tag] message
```

| level | 含義 |
|-------|------|
| `log`   | 一般 console.log |
| `warn`  | console.warn（非致命，但需注意） |
| `error` | console.error 或未捕捉例外 |

### 堆疊追蹤格式

Cocos Editor preview 的 stack trace 路徑格式：

```
at ClassName.methodName (file:///C:/...temp/programming/packer-driver/.../OriginalFile.ts:LINE:COL)
```

- 路徑中的 `chunks/XX/` 是打包中間層，**可忽略**
- 最後的 `OriginalFile.ts:LINE:COL` 是**真實原始碼位置**

---

## 常見錯誤模式

### Pattern 1：`Cannot read properties of null (reading 'xxx')`

**症狀**：UI 彈出 Error 對話框，顯示 TypeError

**根源追查**：
1. 找到 stack trace 中最底層的呼叫（最早出現的那一條）
2. 定位原始碼 → 找 `.xxx` 的呼叫，往上找哪個物件為 null
3. 常見原因：`loadJson` 返回 null（JSON 路徑錯誤）、節點已被 destroy、Inspector 未綁定

**修復方向**：加 null guard + 詳細 log，找到 null 的來源

---

### Pattern 2：`label "XXX" has no textKey/text/bind`

**症狀**：label 節點顯示預設 placeholder 字串

**根源**：對應 layout JSON 中那個節點缺少 `textKey`、`text` 或 `bind` 欄位

**修復方向**：在 layout JSON 中補上對應欄位

---

### Pattern 3：組件初始化 log 出現但後續無動作

**症狀**：`xxx: 開始載入` 有印出，但 `xxx: 完成` 沒有

**根源**：async 函數中途拋出例外，或 await 卡住

**修復方向**：在 try/catch 的 catch 區段補印 `e.stack`

---

### Pattern 4：`[UISpecLoader] loadLayout: 載入 "xxx" 失敗`

**症狀**：明確的 null guard 訊息（本專案已加入）

**根源**：`assets/resources/ui-spec/layouts/{xxx}.json` 不存在

**修復方向**：
```powershell
# 確認檔案是否存在
Test-Path "c:\Users\User\3KLife\assets\resources\ui-spec\layouts\{xxx}.json"
Get-ChildItem "c:\Users\User\3KLife\assets\resources\ui-spec\layouts\" -Filter "*.json"
```

---

## 與其他工具的搭配順序

```
1. 讀 log（本 skill）
   ↓ 確認錯誤類型與發生組件
2. 讀原始碼（read_file / grep_search）
   ↓ 找到對應行號
3. 修復（replace_string_in_file）
   ↓
4. 確認無新 compile error（get_errors）
   ↓
5. 再次讀 log 驗證修復結果
```

---

## 快速診斷腳本（一次性全掃）

遇到不明 bug 時，先執行此腳本取得全局概覽：

```powershell
$log = Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Tail 300 -Encoding UTF8

Write-Host "=== ERROR 行 ===" -ForegroundColor Red
$log | Where-Object { $_ -match "^\d{4}" -and $_ -match " - error:" } | Select-Object -Last 20

Write-Host "=== WARN 行（摘要）===" -ForegroundColor Yellow
$log | Where-Object { $_ -match "^\d{4}" -and $_ -match " - warn:" } | Select-Object -Last 10

Write-Host "=== 最後 LOG 行 ===" -ForegroundColor Cyan
$log | Where-Object { $_ -match "^\d{4}" -and $_ -match " - log:" } | Select-Object -Last 10
```

---

## 注意事項

- log 檔案在 Editor **重開**後才截斷，正常使用中只會累積
- 若 log 過舊（超過數小時前），可請使用者在 Editor 重新 Preview 後再讀取
- `[PreviewInEditor]` 前綴代表在 Editor 的 scene preview 模式中執行
- stack trace 中出現 `packer-driver` 路徑是正常的，不是工具問題
