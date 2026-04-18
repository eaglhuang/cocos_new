<!-- doc_id: doc_index_0006 -->
# Keep Consensus — Core（P0 · §0–§2c）

> 這是 `keep.md` (doc_index_0011) 的「Core（P0 · §0–§2c）」分片。完整索引見 `docs/keep.md (doc_index_0011)` (doc_index_0011)。

# Keep Consensus

## P0. Agent Context Budget（2026-04-08）

- 這件事列為目前第一最高優先級：任何會讓 Agent 對話上下文暴增的流程，都要先收斂再繼續。
- 真正高風險來源不是一般程式碼，而是整份 `keep.md` (doc_index_0011) / `ui-quality-todo.json`、QA compare board、screenshot、AI 原圖、binary diff、以及同一輪重複貼入相同背景。
- 強制規則：Agent handoff 改用「摘要卡」，只傳任務目標、1~3 個必要檔案、3 點已知結論、3 點未決策項目、1 條驗證方式；禁止把整份 manifest、長篇 notes、成批圖片直接塞進對話。
- 圖片節流：單次對話最多 2 張圖；只允許 1 張主圖 + 1 張對照圖，其餘只保留路徑、尺寸、用途與 QA 結論。
- 圖片讀取預設改為 thumbnail-first progressive zoom：`125px -> 250px -> 500px`。規則是先試 `125px`，足夠就停止；只有前一級不足時才可放大一倍。這條規則屬於高層共識，不依賴 hook，所有 Agent 都必須遵守。
- 文件節流：`keep.md` (doc_index_0011) 只留最高層共識與 P0 警戒；長分析搬去 `docs/agent-context-budget.md (doc_ai_0025)` (doc_ai_0025)，在 keep 只留索引。
- 警戒線：單檔文字估算超過 `6000 tokens` 禁止整份讀入；單輪估算超過 `18000 tokens` 必須提出警告；超過 `30000 tokens` 視為 `hard-stop`，必須先縮成摘要卡。
- 工具：handoff 前先跑 `node tools_node/check-context-budget.js --changed --emit-keep-note`；若出現 `warn` 或 `hard-stop`，要先警告，再把原因寫回 keep。
- 爆量事件紀錄格式：日期、估算 token 量級、疑似原因、已採取的縮減策略、是否列為 P0。不要把整份分析全文再寫回 keep，避免二次膨脹。
- 詳細規範文件：`docs/agent-context-budget.md (doc_ai_0025)` (doc_ai_0025)
- 2026-04-06 現況掃描：`node tools_node/check-context-budget.js --scan-default --emit-keep-note` 估算約 `791656 tokens`，`--changed` 估算約 `429502 tokens`，兩者皆為 `hard-stop`。疑似主因：compare board / screenshot / QA 圖片被納入、`keep.md` (doc_index_0011) / `ui-quality-todo.json` / 大型 docs 被整份讀入、changed files 含大量 binary 與大型資料檔。這件事維持 P0，直到 handoff 全面改成摘要卡與路徑索引為止。

## 0. UI 任務 Shard 入口（2026-04-05）

- `docs/ui-quality-tasks/*.json` 是 UI 任務機器可讀資料的可編輯 shard 來源。
- `docs/ui-quality-todo.json` 改為 aggregate manifest，由 `node tools_node/build-ui-task-manifest.js` 生成。
- `docs/agent-briefs/tasks_index.md (doc_task_0002)` (doc_task_0002) 也由同一支生成器重建，不再建議手工維護。
- 新任務的建議順序：
  1. 建立任務卡 Markdown
  2. 新增或更新對應 shard
  3. 執行 `node tools_node/build-ui-task-manifest.js`
  4. 執行 encoding touched check
- 過渡期允許舊任務仍保留在 `docs/ui-quality-todo.json`；新任務優先走 shard，不要求一次搬完整份歷史資料。

更新日期: `2026-04-06`

本文件是目前專案的最高共識摘要。每次新會話開始時，先讀本檔，再開始任何分析、改碼、測試或文件工作。

---

## 1. 專案基準

- 專案: `3KLife`
- 引擎: `Cocos Creator 3.8.8`
- 工作流: `IDE-first`
- 語言: `TypeScript (ES2015)`
- 主要平台: `Web / Android / iOS`
- 階段: `資料管理中心 (DC Phase) 基礎建設完成 / UI 量產期`

Unity 對照:
- `Cocos Creator Editor` 對應 Unity Editor
- `assets/resources` 對應 Resources / Addressables 可載入資料根

---

## 2. Pre-flight

1. 每次處理任何請求前，先讀 `docs/keep.md (doc_index_0011)` (doc_index_0011)。
2. 回覆與推理一律使用繁體中文與台灣慣用術語。
3. 若有新技術決策，必須補回 `docs/keep.md (doc_index_0011)` (doc_index_0011)。
4. 新會話開始時，先摘要 keep 目前重點。
5. 規格異動優先回寫正式母規格，不把補遺當成長期單一真相來源。
6. 補遺只允許作為短期工作底稿、compare note 或跨功能整理；若不是全新功能規格，結案前必須併回正式規格書。
7. 只要正式規格書有新增、刪改或重定位，必須同步更新 `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)。
8. 若內容同時影響系統規格與 UI 呈現，至少要同步更新主要系統規格書、`docs/UI 規格書.md (doc_ui_0027)` (doc_ui_0027) 與交叉索引。
9. 核心 `rarityTier` 與商業 `commercial band` 必須分離：前者是戰力平衡真相，後者是卡面 / 活動 / 招牌包裝的衍生結果；禁止把商業包裝回寫成核心戰力。
10. 女將商業補正只能作用於商業層，不得直接改原始五維；招牌金卡、限定卡、旗艦卡亦同。
11. **遊戲平衡不應直接截斷基本屬性**，應透過公式層（戰鬥公式 / 生產公式 / 政務公式）實現差距收斂：基本屬性保持歷史詮釋的語意正確性，公式層負責遊戲體驗的平衡性，兩者職責分離。具體做法：使用指數曲線（如 `stat^0.7`）或加權組合（如 `str*0.7 + lea*0.3`）在公式層壓縮頂端差距，而非直接調低史書名將的數值。
12. **轉蛋池正式共識**：轉蛋系統只保留兩種不同目的的池子：`三國名將池（含女性）` 與 `支援卡（教官）池`；`英靈卡 / 虎符卡` 不入池，統一由名將死亡結算產出。名將生前退役只進教官 / 傳承路徑，不直接產卡。
13. **名將生命週期與中樞治理正式共識**：英靈卡門檻鎖定為「史實名將 + 女性名將（具正式名將模板）必出，其餘不出」；若名將曾先退役，死亡時仍依正式規則補發 `英靈卡 + 虎符卡`；世家積分採完全個人存檔制；英靈卡與虎符卡允許同角色同時裝備；大廳中的女性角色一律歸於名將池，以 `Female_Role_Type` 區分戰鬥型 / 輔助型；官職正式升格為獨立系統；反霸權聯盟對非霸主為強制捲入；天下大亂重組時保留世界沙盤已解鎖進度；大廳「自告奮勇」屬彩蛋事件，不建立固定成功率公式；`武將日誌與離線互動` 正式升格為獨立母規格，晨報 / 派遣 / 離線互動先掛在大廳與人物頁入口，未定 UI 形態先保留 pending contract；戰場部署正式加入 `Elite_Deploy_Cap + AI_Reserve_Policy`；場景戰法情報門檻改為固定 `Required_Intel_Value`；戰鬥公式採「兵種剋制先乘，其餘環境修正改走百分點加總」；虎符品質統一由 `TigerTallyScore` 映射；名將挑戰賽採賽季鏡像快照與 soft reset；經濟系統補入地窖保護與每日補貼；世界沙盤 `S3 全球遠征` 以 `Expedition_Dossier / External_Power` 承接異域壓力與終局目標，不要求所有外敵都套本土治理全迴圈；`Peace_Lineage` 只是結緣模式標記，仍受 `Vigor / Pregnancy_Lock / Breeding_Cap` 約束；退役活體武將可先保種，轉成教官卡後失去親傳資格；36 回合培育正式拆成三階段學年；關卡正式加入 `Strategist_HUD + Stage_Salvage` 摘要層；轉蛋雙池敘事固定為「名將池 = 血統種子、支援卡池 = 培育深度」；舊版遊戲大綱中的虎符轉蛋提案不採納，仍維持死亡結算產卡。

---

## 2b. Agent 工具安全規則（2026-04-06）

### ❌ 禁止呼叫 `get_changed_files`

本專案包含大量 PNG / binary QA artifact，`get_changed_files` 會把所有 unstaged/staged diff（含 PNG binary 內容）一次塞入 context，必定觸發 **413 Request Entity Too Large** 並導致 Agent 凍結當機。

**絕對不要呼叫 `get_changed_files`，無論任何情況。**

替代方式：
- 查目前 git 狀態：用 `run_in_terminal` 跑 `git status --short`（只回傳路徑，不含 diff）
- 查特定文字檔的 diff：用 `run_in_terminal` 跑 `git diff -- <filepath>`（限定 `.ts` / `.json` / `.md`，不要用萬用路徑）
- 查最新 commit 資訊：用 `run_in_terminal` 跑 `git log -1 --stat`

### ⚠️ 其他工具使用注意

- `grep_search` 不要用萬用路徑 `**` 搜尋 `artifacts/` 目錄（大量 PNG 會拖慢搜尋，且結果無用）
- `file_search` 查 png artifact 路徑時加 `maxResults: 10`，不要讓結果暴增

---

## §§ 文件代號系統（doc_id）（2026-04-11）

每個 `.md` 文件有唯一穩定代號，文件移動後代號不變，Agent 可用代號定位文件：

- **格式**：`doc_<category>_<NNNN>`，10 大類別：`tech / ui / art / data / spec / index / task / ai / agentskill / other`
- **注入位置**：無 YAML frontmatter → 首行 `<!-- doc_id: doc_spec_0001 -->`；有 frontmatter → YAML 第一個 key
- **搜尋命令**：`node tools_node/resolve-doc-id.js doc_spec_0001` 或 `grep -r "doc_id: doc_spec_0001" docs/`
- **Registry**：`docs/doc-id-registry.json`（機器可讀）/ `docs/doc-id-registry.md (doc_other_0001)` (doc_other_0001)（人可讀表格）
- **新增文件**：`node tools_node/doc-id-registry.js --assign <path>`（自動分類、分配代號、注入）
- **禁止**：手動填寫或複製他人 doc_id；分配必須透過工具執行
- **2026-04-13 核心架構重大更新**：
  - **雙層數值架構 (Q70)**：武將屬性採「資質層 (Talent 0-100, 成長上限)」與「實力層 (Prowess 0~2000+, 戰場實值)」分離架構。戰場與人物頁主顯 Prowess。
  - **戰場格子狀態機 (Q71)**：戰場格子正式透過 `Normal / Hazard / Force-Move / Stealth` 四種底層狀態驅動邏輯，與上層 VFX 分離（火燒、落石、水淹、埋伏）。
  - **虎符卡視覺統一 (v4)**：人物頁與戰場端共用 `TigerTallyUnifiedCard` 元件，僅透過 `parchment-tally-skin` 進行視覺切換。
  - **育成存檔上限 (Q69)**：單一子嗣允許多次培育，但存檔最近 3 次實例，出師時採三選一決策。
  - **傭兵保護機制 (Q72-74)**：傭兵結義期具備「戰場不被俘虜」豁免權，轉正後抽到同名卡觸發「二轉」，失敗或結義結束後有 30 天冷卻期。
  - **武將生活感 UI 擴充 (2026-04-14)**：導入 **性格標籤體系** (義/豪/睿/貪)、**忠誠/信任進度條** (俘虜與傭兵專用)、**動態日誌氣泡** (晨報摘要) 與 **任務適合度標籤**，深化大廳與人物頁的敘事連動。
  - **戰法與培育核心定案 (2026-04-14)**：
    - **36 回合鏡像壓縮**：外界 1 回合 = 培育進程 36 回合（對齊外界 1Q 治理週期）。
    - **無痛重修擇優**：單一子嗣允許多次重修（無代價），保留最近 3 份紀錄供玩家於畢業時「三選一」正式定型。
    - **戰場環境 UI 強約束**：當天氣/地形導致戰法不可用（如雨天火計）時，UI 按鈕強制灰階 (Gray-out) 並提供 Toast 提示，禁止誤操作。
    - **技能定義區分**：**格子戰法 (Grid Tactic)** 為部隊級變動技能，消耗 TP，來源多樣（虎符/培育/血統）；**個人奧義 (General Ultimate)** 為武將專屬絕招，消耗 SP，由模板固定。
