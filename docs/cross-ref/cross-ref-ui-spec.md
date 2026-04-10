# Cross-Reference: UI Spec JSON 資產索引

> 這是 cross-reference-index.md 的 C 節分片。完整索引見 `docs/cross-reference-index.md`。
> 最後更新請參考母檔 Header。

## C. UI Spec JSON 資產索引（assets/resources/ui-spec/）

> 三層合約：`layouts/` 節點樹 → `skins/` 外觀資源 → `screens/` 組裝+資料綁定  
> Bundle: `lobby_ui`；Atlas 分組見各檔 `atlasPolicy` 欄位

### C-0. UI 元件尺寸契約（新增 2026-04-09）

| 文件 | 用途 |
|------|------|
| `docs/ui/component-sizing-contract.md` | **Repo 級唯一尺寸真相來源**：幾何行為六類（FX/SS/SR/TR/LC/DI）、Title A/B 二分規則、元件標準尺寸矩陣、Screen Sizing Table 格式規範 |

**每份 screen spec / task card 必須有 Component Sizing Table 才算規格齊備。**

| 檔案 | 類型 | 對應規格書 | Atlas | 備注 |
|---|---|---|---|---|
| `layouts/support-card-main.json` | layout | 教官系統（支援卡）.md | lobby_support_card | 三欄 Grid，450×460 cell，4-tab |
| `skins/support-card-default.json` | skin | 教官系統（支援卡）.md | lobby_support_card | 稀有度卡背、星星槽、突破按鈕 |
| `screens/support-card-screen.json` | screen | 教官系統（支援卡）.md | — | 3 screens + 2 popups（突破確認/好友借用） |
| `layouts/gacha-main.json` | layout | 轉蛋系統.md | lobby_gacha | 雙池分頁、PityBar、CurrencyBar、Pull1+Pull10 |
| `skins/gacha-default.json` | skin | 轉蛋系統.md | lobby_gacha | 三池 bg 變體、結果卡背三稀有度、天命商店 |
| `screens/gacha-screen.json` | screen | 轉蛋系統.md | — | 3 screens + 2 popups（機率公告/求籤定向） |

### C-2. UI Spec JSON → 規格書（反向索引）

| UI Spec JSON | 主要依賴規格書 | 相關 Schema 欄位 |
|---|---|---|
| support-card-*.json (×3) | 教官系統（支援卡）.md §B, §D, §F, §K, §L, §M | Support_Card_ID, Star_Level, Training_Slot_Affinity, Synergy_Partners, Decompose_Value, BorrowSession |
| gacha-*.json (×3) | 轉蛋系統.md §C, §E, §F, §I | Hero_Pool, Support_Pool, Pity_Independent, Player_Currency（Spirit_Jade/Bronze_Charm/Divination_Token） |

### C-3. 尚需建立的 Spec 檔案（待辦）

| 優先級 | 檔案 | 依賴規格書 |
|---|---|---|
| P0 | `layouts/training-main.json` | 培育系統.md |
| P1 | `skins/training-default.json` | 培育系統.md |
| P1 | `screens/training-screen.json` | 培育系統.md、教官系統（支援卡）.md |
| P2 | `layouts/general-detail.json` | 武將人物介面規格書.md |
| P2 | `layouts/general-bloodline-vignette-main.json` | 武將人物介面規格書.md、血統理論系統.md |
| P2 | `skins/general-bloodline-vignette-default.json` | 武將人物介面規格書.md、UI 規格書.md |
| P2 | `screens/general-bloodline-vignette-screen.json` | 武將人物介面規格書.md、UI 規格書.md |
| P2 | `layouts/spirit-tally-detail-main.json` | 兵種（虎符）系統.md、武將人物介面規格書.md |
| P2 | `skins/spirit-tally-detail-default.json` | 兵種（虎符）系統.md、UI 規格書.md |
| P2 | `screens/spirit-tally-detail-screen.json` | 兵種（虎符）系統.md、UI 規格書.md |
| P2 | `layouts/bloodline-mirror-loading-main.json` | 血脈命鏡過場載入規格書.md、UI 規格書.md |
| P2 | `skins/bloodline-mirror-loading-default.json` | 血脈命鏡過場載入規格書.md、UI 規格書.md |
| P2 | `screens/bloodline-mirror-loading-screen.json` | 血脈命鏡過場載入規格書.md、UI 規格書.md |
| P2 | `content/bloodline-mirror-states-v1.json` | 血脈命鏡過場載入規格書.md、UI 規格書.md |
| P2 | `contracts/bloodline-mirror-state-content.schema.json` | 血脈命鏡過場載入規格書.md、UI 規格書.md |
> **第二十批整合（2026-04-05）**：正式將 UI 量產方法論沉到 `keep.md §19` 與 `UI 規格書.md §8.2`。本批明確定義 `選 template family -> 填 content contract -> 套 skin fragment` 為 UI 量產主工作流，並補上 UI Agent 進場必讀順序與文件回寫原則，作為後續多 Agent 協作的共同入口。
> **第二十一批整合（2026-04-05）**：將 UI 量產方法正式落到 Agent brief 執行入口。新增 `docs/agent-briefs/UI-task-card-template.md`，並同步更新 `CheckList.md`、`tasks_index.md`、`agent1-instructions.md`、`agent2-instructions.md` 與 `ui-quality-todo.json` 的 task template，要求新 UI 任務至少寫出 `template_family / content_contract / skin_fragments / smoke_route / docs_backwritten`。
> **第二十二批整合（2026-04-05）**：將 `UI-2-0058 / UI-2-0059 / UI-2-0061` 回補為新模板格式。三張卡與 `ui-quality-todo.json` 現已同步補上 `template_family / content_contract / skin_fragments / smoke_route / docs_backwritten`，並修正 `UI-2-0058` 的 manifest / tasks index 狀態為 `done`。
> **第二十三批整合（2026-04-05）**：將下一張待做卡 `UI-2-0060` 也改為新模板格式，正式指定 `fullscreen-result` 為 template family，並在任務卡與 `ui-quality-todo.json` 補上 `content_contract / skin_fragments / smoke_route / docs_backwritten`，避免後續又回到舊格式開工。
> **第二十四批整合（2026-04-05）**：`UI-2-0060` 已進入真正實作。新增 `layouts/bloodline-mirror-loading-main.json` 與 `skins/bloodline-mirror-loading-default.json`，並讓 `bloodline-mirror-loading-screen.json`、`bloodline-mirror-awakening-screen.json` 一起切到 shared skeleton；正式固定命鏡 loading / awakening 共用 `StateBadge / MirrorHeader / CenterStage / TipPanel / ActionRow / StoryStrip` 模組。
> **第二十五批整合（2026-04-05）**：`UI-2-0054` 已把命鏡四種 state 收斂到 `content/bloodline-mirror-states-v1.json`。`loading / awakening / ascension / unowned-preview` 現在共用同一份 `fullscreen-result` content contract；既有 loading / awakening screen 也已補上 `content.source` 與 `content.state` 指向，後續不必再為每個 state 複製 layout。
> **第二十六批整合（2026-04-05）**：為了對齊 Agent1 的 `ServiceLoader + onReady(binder) + content contract` 新架構，命鏡畫面已新增 `contracts/bloodline-mirror-state-content.schema.json`，並在 loading / awakening screen 補上 `contentRequirements`。`validate-ui-specs.js` 也已支援 `--check-content-contract`，可直接驗證 schema、screen 契約與內容檔 state 對應。

> **第二十七批整合（2026-04-06，Phase F 收尾）**：完成 UI-2-0082（Figma Proof Mapping Sync）與 UI-2-0083（Agent Strict Layout Validator）。新增 `tools_node/sync-figma-proof-mapping.js`（讀取 Figma 或本地 config 輸出 `proof-mapping-{date}.json`，支援 `--config/--frame-id/--dry-run/--list`）；`tools_node/scaffold-ui-spec-family.js` 新增 `--figma-frame-id` 選項，可自動載入對應家族最新快照。`validate-ui-specs.js` 新增 `--strict` 模式，實作 17 條 layout 品質規則（節點深度、children 數量、empty-container、scroll-list itemTemplate、spacing/fontSize/alpha/opacity 範圍、widget 整數、family 專屬規則 dialog-max-cta/rail-list-min-items/detail-split-tab-count、bind-path-declared、no-dynamic-bind、nine-slice-border、skinSlot 交叉核對）。5 個佈局新增 `validation.exceptions` 登記豁免。新增 `assets/resources/ui-spec/validation-rules.json`（閾值設定檔）與 `docs/ui/layout-quality-rules.md`（規則說明）。Phase F 全部 P1 任務完成。

> **第二十八批整合（2026-04-05，UI-2-0078 MemoryManager LRU）**：完成 UI-2-0078（MemoryManager LRU 弱引用快取 + Scope 批次釋放）。MemoryManager.ts 改為兩層式帳目架構：
ecords（active，refCount > 0）+ lruBuffer（軟釋放緩衝，refCount = 0）；
otifyReleased 不再立即刪除，而是移入 lruBuffer，超過 lruMaxSize（預設 50）時觸發 onAssetEvicted。新增 
eleaseByScope(scope) 支援場景批次清理；新增 evictLRU(count?) 手動觸發硬逐出；新增 getLruReport() / getByScope() / lruBufferCount；
otifyLoaded 第 4 參數新增可選 scope 標籤（向後相容）。AssetRecord 新增 lastUsedAt 與 scopes 欄位。所有現有呼叫端（ResourceManager、VfxComposerTool）無需修改。
> **蝚砌????寞??2026-04-05嚗?** `GeneralDetailBloodlineV3` 第一輪品質收斂已確認兩條可複用規則：`UIPreviewNodeFactory.buildImage()` 必須正確處理 `color-rect / transparent` image slot，避免 runtime 後載立繪被深色 fallback 壓灰；`StoryStrip` 正式改採 `master art 長條圖 + 六個 overlay slot` family，資料契約仍維持 `origin / faction / role / awakening / bloodline / future` 六格語意。
> **蝚砌???寞??2026-04-05嚗?** `GeneralDetailBloodlineV3` 的 `StoryStrip` 已移除預設可見 caption/title badge，正式回到 `純長條敘事圖 + 六個無字 overlay slot` 呈現。這條規則確認日後 AI 生成的 strip master art 應一次輸出完整連續畫面，不再依賴 UI 端補標題字來完成敘事。
> **蝚砌???寞??2026-04-05嚗?** `StoryStrip` 新增 `弱臉化` 量產規則：在角色一致性 reference / LoRA 尚未建立前，故事帶應優先使用背影、側臉、剪影、遠景、武器與旗幟等辨識元素，而非正臉特寫；`assets/resources/sprites/ui_families/general_detail/story_strip/proof/zhangfei_story_strip_master_v1.png` 已明確標記為 `proof-only`，僅供構圖驗證。
> **蝚砌???寞??2026-04-05嚗?** `StoryStrip` 已正式往 `UI-2-0089 / UI-2-0091 / UI-2-0087` 產線化：新增 `artifacts/ui-source/ai-recipes/story-strip-horizontal-scroll-r1.art-recipe.json`、`artifacts/ui-source/asset-direction/story-strip-horizontal-scroll-pilot-v1.md`、`artifacts/ui-qa/UI-2-0059/story-strip-compare-input-v1.md`。這代表後續故事帶不再只靠 prompt 疊字數，而是有可追溯的 recipe、載體規格與 compare board 輸入。
> **蝚砌???寞??2026-04-05嚗?** `GeneralDetailBloodlineV3` 已建立 canonical reference -> reference crop -> proof sprite -> preview capture 的驗證路徑；目前 proof crop 僅供 compare/layout 驗證，不可視為正式商業素材。最新可對照截圖為 `artifacts/ui-qa/UI-2-0059/preview-compare-2026-04-05-v17-story-spriteframe/GeneralDetailOverview.png`。
> **蝚砌???寞??2026-04-05嚗?** `GeneralDetailBloodlineV3` 第二輪品質收斂確認：`general-detail-default.json` 的 `RightTabBar` 已改採較輕的 parchment rail/button family，避免 overview shell 使用 v3 主視覺時仍被舊黑金 tab rail 破壞；最新對照截圖為 `artifacts/ui-qa/UI-2-0059/preview-compare-2026-04-05-v19-crest-medallion-pass/GeneralDetailOverview.png`。
> **蝚砌????寞??2026-04-05嚗?** `GeneralDetailBloodlineV3` header 已從單一色帶升級成 `InfoCardHeaderChrome(bleed + band + frame)`，`crest` 則先落成 `medallion skeleton` proof。此階段目標是建立可替換的 `jade-parchment header / circular crest carrier` family；正式命紋 glyph 美術資產仍需後續替換。
> **第三十一批整合（2026-04-05，UI-2-0090 Skill Orchestration Pack）**：完成 Phase G UI-2-0090（UI Skill Orchestration Pack）。新增 5 個 `.github/skills/` 技能模組，固化 UI production pipeline 的五步工作流：`ui-reference-decompose`（參考圖解析 → proof-contract-v1 草稿）→ `ui-family-architect`（family/recipe 分派 + themeStack 規劃）→ `ui-asset-gen-director`（art-recipe 委託書 + 缺失資產清單）→ `ui-asset-qc`（R1-R6 自動驗證 + validate-visual-assets.js）→ `ui-preview-judge`（截圖比對 + zone 信心分數 PASS/FAIL）。每個 skill 含固定的輸入/輸出 artifact 邊界、Agent1/Agent2 分工說明、品質門檻與下一步指引。任務計數：done:65, in-progress:20, open:13。
> **第三十二批整合（2026-04-05，UI-2-0080 / UI-2-0076 提交對齊）**：正式提交 `UI-2-0080` 與回補 `UI-2-0076` 任務卡狀態。`UITemplateBinder.ts` 新增 layout 相對路徑索引（`getNodeByPath/getLabelByPath/getSpriteByPath`），`UIContentBinder.ts` 改為讀取 `contracts/*.schema.json` 的 `bindPath` 進行 runtime 綁定，不再只靠欄位名對 id/name 的弱對應；`GeneralDetailOverviewShell.ts` 已接上 `general-detail-bloodline-v3-screen` 的 `contentRequirements`，讓內容契約真正落到畫面 runtime。對應文件 `docs/ui/content-contract-framework.md` 已同步更新；`UI-2-0076.md` 與 `UI-2-0080.md` 也已與 `ui-quality-todo.json` 的 done 狀態對齊。
