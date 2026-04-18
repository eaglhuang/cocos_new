<!-- doc_id: doc_index_0003 -->
# Cross-Reference: UI Spec JSON 資產索引

> 這是 doc_index_0005 的 C 節分片。完整索引見 `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)。
> 最後更新請參考母檔 Header。
>
> **doc_id 查詢**：用 `node tools_node/resolve-doc-id.js <搜尋詞>` 查文件代號，或瀏覽 `docs/doc-id-registry.md (doc_other_0001)` (doc_other_0001)。
> ⚠️ **壓縮版（doc_id 索引）**：中文名稱已移除，查詢名稱請用 resolve-doc-id.js。人類可讀進度 → `docs/cross-ref/cross-ref-進度.md (doc_index_0017)` (doc_index_0017)

## C. UI Spec JSON 資產索引（assets/resources/ui-spec/）

> 三層合約：`layouts/` 節點樹 → `skins/` 外觀資源 → `screens/` 組裝+資料綁定  
> Bundle: `lobby_ui`；Atlas 分組見各檔 `atlasPolicy` 欄位

### C-0. UI 元件尺寸契約（新增 2026-04-09）

| 文件 | 用途 |
|------|------|
| doc_ui_0038 | **Repo 級唯一尺寸真相來源**：幾何行為六類（FX/SS/SR/TR/LC/DI）、Title A/B 二分規則、元件標準尺寸矩陣、Screen Sizing Table 格式規範 |

**每份 screen spec / task card 必須有 Component Sizing Table 才算規格齊備。**

| 檔案 | 類型 | 對應規格書 | Atlas | 備注 |
|---|---|---|---|---|
| `layouts/support-card-main.json` | layout | doc_spec_0027 | lobby_support_card | 三欄 Grid，450×460 cell，4-tab |
| `skins/support-card-default.json` | skin | doc_spec_0027 | lobby_support_card | 稀有度卡背、星星槽、突破按鈕 |
| `screens/support-card-screen.json` | screen | doc_spec_0027 | — | 3 screens + 2 popups（突破確認/好友借用） |
| `layouts/gacha-main.json` | layout | doc_spec_0042 | lobby_gacha | 雙池分頁、PityBar、CurrencyBar、Pull1+Pull10 |
| `skins/gacha-default.json` | skin | doc_spec_0042 | lobby_gacha | 三池 bg 變體、結果卡背三稀有度、天命商店 |
| `screens/gacha-screen.json` | screen | doc_spec_0042 | — | 3 screens + 2 popups（機率公告/求籤定向） |
| `layouts/lobby-main-main.json` | layout | doc_spec_0002 | lobby_ui | 大廳主場景骨架，承接雙牆 / 世界沙盤 / 許願祭壇掛點 |
| `skins/lobby-main-default.json` | skin | doc_spec_0002 | lobby_ui | 議事廳主題、節慶插槽、沙盤與任務牆外觀 |
| `screens/lobby-main-screen.json` | screen | doc_spec_0002、doc_spec_0014 | — | 大廳主入口 screen，讀取官職快照與世界沙盤狀態 |

### C-2. UI Spec JSON → 規格書（反向索引）

| UI Spec JSON | 主要依賴規格書 | 相關 Schema 欄位 |
|---|---|---|
| support-card-*.json (×3) | doc_spec_0027 §B, §D, §F, §K, §L, §M | Support_Card_ID, Star_Level, Training_Slot_Affinity, Synergy_Partners, Decompose_Value, BorrowSession, Role_Boundary |
| gacha-*.json (×3) | doc_spec_0042 §C, §E, §F, §I | Hero_Pool, Support_Pool, Pool_Positioning, Pity_Independent, Player_Currency（Spirit_Jade/Bronze_Charm/Divination_Token） |
| lobby-main-*.json (×3) | doc_spec_0002 §E, §I、doc_spec_0014 §E, §I | Mission_Boards, Officer_Snapshot, World_Sandtable, Wish_Altar, Volunteer_Event_Log, Morning_Report_Summary, Dispatch_Board_State |
