---
doc_id: doc_ai_0010
applyTo: "artifacts/**"
---

# Artifacts 目錄安全規則

本目錄含大量 PNG / binary QA 資產，操作時須嚴格控制 context 用量。

## 規則

- 禁止整批讀取 PNG 檔案內容
- 只讀路徑索引，不讀圖片二進位
- `grep_search` 不要用 `**` 萬用路徑搜尋本目錄
- `file_search` 查詢本目錄時必須加 `maxResults: 10`
- 圖片只保留路徑、尺寸、用途與 QA 結論，不帶入對話
- compare board / screenshot 一次最多 1 張主圖 + 1 張對照圖
