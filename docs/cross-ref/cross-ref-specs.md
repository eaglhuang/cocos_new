<!-- doc_id: doc_index_0002 -->
# Cross-Reference: 規格書索引（文件 → 相關文件）

> 這是 doc_index_0005 的 A 節分片。完整索引見 `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)。
> 最後更新請參考母檔 Header。
>
> **doc_id 查詢**：用 `node tools_node/resolve-doc-id.js <搜尋詞>` 查文件代號，或瀏覽 `docs/doc-id-registry.md (doc_other_0001)` (doc_other_0001)。
> ⚠️ **壓縮版（doc_id 索引）**：中文名稱已移除，查詢名稱請用 resolve-doc-id.js。人類可讀進度 → `docs/cross-ref/cross-ref-進度.md (doc_index_0017)` (doc_index_0017)

## A. 規格書索引（文件 → 相關文件）

> 只列出明確的依賴 / 引用關係，不列模糊的主題重疊。

### 核心基礎系統

| 規格書 |被依賴（下游系統）|依賴（上游系統）|
|---|---|---|
| doc_data_0001 |doc_spec_0012、doc_spec_0016、doc_data_0002、doc_spec_0041、doc_spec_0040、doc_spec_0043|—|
| doc_spec_0016 |doc_spec_0043、doc_spec_0029、doc_spec_0018、doc_spec_0017、doc_spec_0021、doc_ui_0012、doc_spec_0038、doc_spec_0030|doc_data_0001、doc_spec_0034、doc_spec_0008、doc_spec_0038、doc_spec_0030|
| doc_spec_0008 |全系統（UID/Bloodline_ID/Gene/Status 統一定義）|—|

### 血統 + 因子系統族群

| 規格書 |被依賴|依賴|
|---|---|---|
| doc_spec_0011 |doc_spec_0010、doc_spec_0026、doc_spec_0028、doc_spec_0005、doc_spec_0024、doc_spec_0012、doc_spec_0022、doc_ui_0012、doc_spec_0031、doc_ui_0027|—|
| doc_spec_0010 |doc_spec_0038、doc_spec_0041、doc_spec_0009、doc_spec_0035、doc_spec_0024|doc_spec_0011|
| doc_spec_0009 |doc_spec_0006|doc_spec_0010、doc_spec_0026|
| doc_spec_0005 |doc_spec_0012|doc_spec_0011、doc_spec_0042|
| doc_spec_0024 |—|doc_spec_0011、doc_spec_0010|
| doc_spec_0022 |doc_spec_0012、doc_spec_0027、doc_ui_0012|doc_spec_0011、doc_spec_0018、doc_spec_0042|
| doc_spec_0035 |—|doc_spec_0010|

### 養成流水線

| 規格書 |被依賴|依賴|
|---|---|---|
| doc_spec_0028 |doc_spec_0003、doc_spec_0027|doc_spec_0011、doc_spec_0010、doc_spec_0006、doc_spec_0033、doc_spec_0018|
| doc_spec_0026 |doc_spec_0038、doc_spec_0027、doc_spec_0044|doc_spec_0010、doc_spec_0009、doc_spec_0033|
| doc_spec_0027 |—|doc_spec_0026、doc_spec_0042、doc_spec_0018、doc_spec_0022、doc_spec_0029、doc_spec_0028|
| doc_spec_0018 |doc_spec_0028、doc_spec_0027、doc_spec_0022、doc_spec_0012|doc_spec_0034、doc_spec_0033|
| doc_spec_0042 |doc_spec_0005、doc_spec_0027、doc_spec_0029、doc_spec_0028|doc_spec_0016、doc_spec_0026|
| doc_spec_0043 |doc_spec_0012|doc_data_0001、doc_spec_0010、doc_spec_0026|
| doc_spec_0030 |doc_ui_0012、doc_ui_0001、doc_spec_0040|doc_spec_0042、doc_spec_0016|

### 戰場系統族群

| 規格書 |被依賴|依賴|
|---|---|---|
| doc_spec_0040 |doc_spec_0007、doc_spec_0044、doc_ui_0001|doc_spec_0032、doc_spec_0012、doc_data_0001、doc_spec_0019、doc_spec_0039|
| doc_spec_0012 |doc_spec_0040、doc_spec_0007、doc_ui_0012、doc_ui_0001|doc_spec_0043、doc_spec_0038、doc_spec_0011、doc_spec_0022、doc_spec_0005|
| doc_spec_0041 |—|doc_spec_0010、doc_spec_0038、doc_data_0001|
| doc_spec_0038 |doc_spec_0041、doc_spec_0039（格子戰法定義）、doc_spec_0016、doc_ui_0012、doc_ui_0001、doc_spec_0040|doc_spec_0010、doc_spec_0026、doc_spec_0027、doc_spec_0016|
| doc_spec_0019 |doc_spec_0040|doc_spec_0042|
| doc_data_0002 |—|doc_data_0001、doc_spec_0040|
| doc_spec_0007 |doc_spec_0002、doc_ui_0027|doc_spec_0040、doc_spec_0044、doc_spec_0012、doc_spec_0041、doc_spec_0032|
| doc_spec_0020 |doc_spec_0002、doc_spec_0039|doc_spec_0032、doc_spec_0037、doc_spec_0014、doc_spec_0022、doc_spec_0018|
| doc_spec_0039** |—|doc_spec_0038、doc_spec_0041、doc_spec_0030、doc_spec_0044、doc_spec_0040、doc_ui_0001、doc_spec_0020（E-4/E-5 場景戰法觸發）|
| doc_spec_0044 |doc_spec_0007、doc_ui_0001|doc_spec_0040、doc_spec_0039、doc_spec_0026、doc_spec_0032|
| doc_spec_0002 |doc_spec_0039、doc_ui_0012、doc_spec_0015|doc_spec_0037、doc_spec_0014、doc_spec_0032、doc_spec_0034、doc_spec_0020|

### 經濟 & 資源系統

| 規格書 |被依賴|依賴|
|---|---|---|
| doc_spec_0032 |doc_spec_0040、道具系統、doc_spec_0007、doc_spec_0002|doc_spec_0033、doc_spec_0037|
| doc_spec_0037 |doc_spec_0032|doc_spec_0034|
| doc_spec_0014 |doc_spec_0002、doc_spec_0020|doc_spec_0037、doc_spec_0034|
| doc_spec_0033 |doc_spec_0028、doc_spec_0026、doc_spec_0032|doc_spec_0018|
| doc_spec_0036 |—|doc_spec_0032、結緣系統、傭兵系統、doc_spec_0026、doc_spec_0037|
| doc_spec_0034 |doc_spec_0018、doc_spec_0037、doc_spec_0026|—|

### 社交 & 留存

| 規格書 |被依賴|依賴|
|---|---|---|
| doc_spec_0029 |doc_spec_0027、doc_spec_0003|doc_spec_0042|
| doc_spec_0025 |—|doc_spec_0029、doc_spec_0027|
| doc_spec_0015 |doc_tech_0013、doc_ui_0027|doc_spec_0002、doc_spec_0025、doc_spec_0040|
| doc_spec_0006 |doc_spec_0028|doc_spec_0009|
| doc_spec_0003 |—|doc_spec_0028、doc_spec_0029、doc_spec_0021、doc_spec_0026|
| doc_spec_0021 |doc_spec_0003|doc_spec_0032、doc_spec_0016|
| doc_spec_0017 |—|doc_spec_0043、doc_spec_0029|

### 樞紐 & 規劃文件

| 規格書 |被依賴|依賴|
|---|---|---|
| doc_spec_0045 |—|doc_spec_0016、doc_spec_0028、doc_spec_0026、doc_spec_0011、doc_spec_0010、doc_spec_0040|
| doc_tech_0013 |—|全系統（匯總所有 I 區 Schema）、doc_spec_0002、doc_spec_0020、doc_spec_0014、doc_spec_0015、doc_spec_0007、doc_spec_0032、doc_spec_0039、doc_spec_0026、doc_spec_0022、doc_ui_0012|
| doc_spec_0031 |doc_spec_0004、doc_ui_0027|doc_spec_0042、doc_spec_0011、doc_spec_0009、doc_spec_0036|
| doc_spec_0004 |—|doc_spec_0031、doc_ui_0027|
| doc_ui_0005 |doc_ui_0027|doc_spec_0011、doc_ui_0012|

### Docs 層級文件

| 文件 |被依賴|依賴|
|---|---|---|
| doc_index_0011 |全專案（最高執行準則）|—|
| doc_ai_0025 |doc_index_0011、doc_ai_0018、doc_ai_0015、doc_ai_0013|doc_index_0011|
| doc_spec_0161 |doc_tech_0007、doc_ui_0001|doc_spec_0040、doc_spec_0012、doc_data_0001|
| doc_tech_0015 |—|doc_data_0001、doc_spec_0038、doc_spec_0033、doc_spec_0039|
| doc_tech_0007 |—|doc_spec_0161|
| doc_spec_0159 |doc_index_0011|doc_index_0005|
| doc_spec_0001 |doc_index_0011|doc_spec_0159、doc_index_0005|
| doc_tech_0008 |—|doc_spec_0031、doc_spec_0011、doc_spec_0042|
| doc_tech_0009 |doc_tech_0015、doc_tech_0013、doc_spec_0008、doc_spec_0010、doc_spec_0011| — |
| doc_ui_0027 |doc_spec_0004、doc_ui_0049、doc_ui_0012、doc_ui_0009|doc_spec_0031、doc_tech_0008、doc_spec_0011、doc_spec_0012、doc_spec_0015、doc_spec_0007、doc_spec_0032|
| doc_ui_0012 |doc_ui_0049、doc_spec_0016、doc_spec_0011、doc_spec_0038、doc_spec_0041、doc_spec_0012、doc_spec_0026、doc_spec_0022、doc_tech_0013|doc_spec_0030|
| doc_ui_0011 |doc_ui_0012、doc_ui_0049|—|
| doc_ui_0001 |doc_ui_0049|doc_spec_0161、doc_spec_0040、doc_spec_0012、doc_spec_0038、doc_spec_0030、doc_spec_0039（§ 6 場景視覺主題）、doc_art_0002|
| doc_art_0003 |doc_ui_0049、doc_tech_0015|doc_index_0011|
| doc_ui_0051 |doc_ui_0049、doc_ui_0027、doc_art_0003、doc_ui_0035、doc_art_0002、doc_agentskill_0011|doc_index_0011 § 4.1|
| doc_art_0002 |doc_ui_0049、doc_ui_0027、doc_art_0003、doc_ui_0012、doc_ui_0001|doc_ui_0051、doc_ui_0050|
| doc_ui_0032 |doc_ui_0036、doc_ui_0045|doc_index_0012、doc_ui_0049、doc_ui_0050、doc_art_0002|
| doc_ui_0045 |doc_ui_0032、doc_agentskill_0023、doc_agentskill_0031|doc_index_0012、doc_ui_0049、doc_ui_0050、doc_art_0003|
| doc_ui_0037 |doc_ui_0045、doc_ui_0032|doc_index_0012、doc_ui_0049、doc_ui_0050、doc_art_0003、doc_ui_0036|
| doc_ui_0033 |doc_ui_0032|doc_index_0012、doc_ui_0049、doc_ui_0050、doc_art_0002、doc_ui_0034|
| doc_ui_0034 |doc_ui_0032、doc_ui_0033|doc_index_0012、doc_ui_0033、doc_ui_0050|
| doc_ui_0036 |doc_ui_0032|doc_index_0012、doc_ui_0049、doc_ui_0050、doc_art_0002、doc_ui_0001|
| doc_ui_0035 |—|doc_ui_0051 § 8、doc_index_0011、doc_art_0003|
| doc_ui_0049 |doc_agentskill_0022、doc_agentskill_0029、doc_agentskill_0027、doc_agentskill_0011|doc_index_0011、doc_ui_0027、doc_ui_0001、doc_art_0003、doc_ui_0012、doc_ui_0011|
| doc_tech_0012 |—|doc_tech_0013|

---
