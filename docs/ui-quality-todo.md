<!-- doc_id: doc_ui_0035 -->
# UI 品質落地 To-Do 追蹤計畫

> **目的**：追蹤「UI 參考圖品質分析」中所有 task 的分配、狀態與依賴關係。任何 Agent 或開發者在開始 UI 品質相關工作前，必須先讀取此文件以了解當前進度。
>
> **品質目標文件**：`docs/UI參考圖品質分析.md (doc_ui_0051)` (doc_ui_0051)
> **共識準則**：`docs/keep.md (doc_index_0011)` (doc_index_0011)
>
> **最後更新**：2026-04-02（Agent2 已將 `日常人物頁 v2` 與 `血脈命鏡過場 v2` 正式同步回系統規格與 UI 規格書；同步補開 `UI-2-0055` Loading tips 文案池與 `UI-2-0056` 未持有武將標記規則追蹤單，等待 v3 視覺 proof 後續收斂）

---

## 使用規則

1. **Agent 啟動 3 必讀**：`docs/keep.md (doc_index_0011)` (doc_index_0011) → `docs/ui-quality-todo.md (doc_ui_0035)` (doc_ui_0035)（本檔）→ `docs/UI參考圖品質分析.md (doc_ui_0051)` (doc_ui_0051)
2. **開工前**：確認你的 task 的上游依賴全部 `done`；把 status 改為 `in-progress`
3. **完工後**：把 status 改為 `done`，填入 `completed-date`，並在 notes 附上產出路徑或 PR 號
4. **被中斷**：新 Agent 應接手所有 `in-progress` 項目；若產出不完整則重做
5. **人工介入**：開發者可隨時改 owner 為自己（名字或代號）

---

## 所有者代號

| 代號 | 角色 | 說明 |
|---|---|---|
| `Agent2` | 視覺資產 Agent | 負責 sprite 生成、PowerShell 渲染、preview 截圖、品質目檢 |
| `Agent1` | 架構接線 Agent | 負責 skin/layout JSON 接線、design token、UIPreviewBuilder 程式、契約驗證 |
| `human` | 開發者 / 美術 | 最終 QA 審核、keep.md (doc_index_0011) 規範變更確認、Cocos Editor 操作 |
| `待分配` | — | 尚未指派 |

---

## Phase 0：立即落地（已有 preview）

| ID | 任務 | Owner | Status | Depends | Priority | Notes |
|---|---|---|---|---|---|---|
| P0-1 | nav.ink preview → runtime sprite 搬遷 | `Agent2` | done | — | 🔴 最高 | completed 2026-03-31. `nav_ink/btn_primary_normal.png \| B48C8CB2E748A509358E37CBF7D24BD9876AB15F507DEC3C3E4E27EC6985AF00 \| 6399B`, `btn_primary_pressed.png \| CCB50CDD4E2FA876DEA0CE0BE03D0B566BB8625E7CB690599829A1405267A4F7 \| 10732B`, `btn_primary_disabled.png \| 0685F6E4389205AF2773EE98E3ED7F9B761F4170A4AABCA154E5182F5944D880 \| 6407B`. SHA256 src=dst all OK. |
| P0-2 | nav.ink 接入 lobby-main-default.json | `Agent1` | done | P0-1 | 🔴 最高 | 2026-03-31 完成；`lobby-main-default.json` 新增 `ui-common-ink.nav.primary`，並將 `lobby.nav.btn` 改為 `nav_ink` button-skin，border=`[20,20,20,20]` |
| P0-3 | paper.utility preview → runtime sprite 搬遷 | `Agent2` | done | — | 🔴 最高 | completed 2026-03-31. `paper_utility/btn_primary_normal.png \| EA3E0BF59CCF3C095F397B877A4EC72FF464D0AD20C7C6249E174A5E50A60302 \| 7999B`, `btn_primary_pressed.png \| F2275DD45682D576FF0CB2252AFF7C979C72DCE3FFDF1D39EF27BCEB30EE5A93 \| 7491B`, `btn_primary_disabled.png \| 7A934F552A7007C4ACE1B5DF81D767DE073A31FD3CC727F5CE68D609E0C7EDDB \| 5126B`. SHA256 src=dst all OK. |
| P0-4 | paper.utility 接入 duel-challenge（reject/utility） | `Agent1` | done | P0-3 | 🔴 最高 | 2026-03-31 完成；`duel-challenge-default.json` 新增 `ui-common-paper.utility.primary`，並將 `duel.btn.reject` 改為 `paper_utility` button-skin，border=`[20,20,20,20]`（對應 [UI-2-0002](agent-briefs/tasks/UI-2-0002.md (doc_task_0026)) (doc_task_0026)） |
| P0-5 | warning.destructive preview → runtime sprite | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `warning/btn_primary_normal.png \| 3A0BCC158E1EF15CB957E916C93727533648C38D0AAF7023D9E8F26FD8440909 \| 9123B`, `btn_primary_pressed.png \| 08F086A7FC341C4CFCA82000D94FE3F758CBE8496A192EA4A5CF9AE7E32C0317 \| 10177B`, `btn_primary_disabled.png \| 070A2BCFFE81F250763F807C0AB6E7FFE466DC7B5E9819935DF8723B36F3A6B4 \| 6839B`. SHA256 src=dst all OK. |
| P0-6 | 全 button sprite border 20px 批量驗證 | `Agent1` | done | P0-1,P0-3,P0-5 | 🟡 中 | 2026-03-31 完成；新增 `tools_node/validate-button-family-borders.js` 並接入 acceptance，自動檢查 shared button family 的 `border=[20,20,20,20]` 與按鈕高度相容性 |

---

## Phase A：建立缺失的框體家族

| ID | 任務 | Owner | Status | Depends | Priority | Notes |
|---|---|---|---|---|---|---|
| A-1 | 羊皮紙框體 sprite (frame/fill/bg) | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `parchment/frame.png \| AA3DE463495F8487C61F9BD5C49B3929821CA6B78F001319BBC9B1066C8D5B74 \| 2013B` (80×80, 角區16px, 做舊點), `fill.png \| D62DDFC18D9739C51809065DD152211AF2A9C2231F10585EE34ED96BBA208C93 \| 2255B` (64×64), `bg.png \| 7857F48825B84A99A5AF68E14BDA75D9A71EAF7926615692C93E5D4C99E89661 \| 2190B` (64×64). |
| A-2 | item-cell 框體 sprite (bg + 7色稀有度邊) | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. 8 files in `item_cell/`: `bg.png \| 525B`, `border_common \| 823B`, `border_uncommon \| 805B`, `border_rare \| 836B`, `border_epic \| 845B`, `border_legendary \| 801B`, `border_artifact \| 814B`, `border_special \| 820B`. 各 64×64, 9-slice 相容.  |
| A-3 | shadow/投影層通用 sprite | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `shadow/shadow_01.png \| DF1BCE6F2320F7930DB59BBCEFE30870D9DDF79987290C84799C4DD901D5DB4F \| 5163B`. 256×256, 8層圓角暈影, 中央透明, 9-slice 可拉伸. |
| A-4 | progress-bar 框體 (track + fill) | `Agent2` | done | — | 🟢 低 | completed 2026-03-31. `progress_bar/track.png \| 7F8EB4A0DDE8D74E1DC1D077AE7D474D9B11850989794DCFC8D119A53CA61E01 \| 731B` (128×24, 灰底金框膠囊), `fill.png \| 61E96931343BD1A28ED04C61E2F91AD28773D0AAE1A1F56AB5726EBDD9728459 \| 1814B` (128×24, 綠→金漸層). |
| A-5 | 紋理 noise overlay (metal + paper) | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `noise/metal_noise_256.png \| 9E0B4ED3550616D0ADAC36E5DC0375ACDDB45FFB1137EA51AA218A44C077F984 \| 78537B` (偏藍灰, opacity 18%), `paper_noise_256.png \| 4D35C0C55F157C5DAF72A08B64B4F30BE5F4B3D26B4DEC88967A2D5FF4F96D28 \| 73393B` (暖米白, opacity 22%). 固定 seed=42, tileable. |

| UI-1-0005 | 水平 Tab 框體 sprite (active/inactive) | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `tab/tab_active.png \| 24E038EA1BE51FA054941AC0D1231C3358B23F8FEA61DB69D327FAA053A49DEA \| 919B` (96×48, 金色上圓角), `tab_inactive.png \| DF18B81C842D9B492F660BBD1382DA7802DECFBA8094773A6ECFED82A6DA065B \| 465B` (96×48, 暗灰). §2.6 Tab 框體家族缺口. |
| UI-1-0006 | Bleed overlay sprites (dark + parchment) | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `bleed/bleed_dark.png \| E53DB2CA7255391E6212A73C290B2B93EA5F63895DA85CACC69666528D966DF8 \| 1610B` (128×128, 暖銅暈邊), `bleed_parchment.png \| D12550208B1355ED8BDD036ECC1A0614A2B01F95743FD9C5B1075C85BDA50562 \| 1634B` (128×128, 暖棕暈邊). §4.2 三層融合 bleed 層. |
| UI-1-0007 | 深色金屬框體 sprite (frame/fill/bg) | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `dark_metal/frame.png \| 2CC47D1BEC6393DDD3C20FC69084EB2174123458AE0AB331E5E62B876F2D02E4 \| 1201B` (80×80, 金邊角點), `fill.png \| 60945CC81CEFE3B4FD5F68A0C4F742AA09DB23A426A162B9DB3A8DBAF1D0697C \| 278B` (64×64), `bg.png \| DF5F105F1BF24128B9EAD6F16BD24EDC215A48096009FAC7687AEDCD603FA081 \| 884B` (64×64). §2.1 主框體家族缺口修正，9-slice [20,20,20,20]. |
| UI-1-0008 | 圓形 icon 按鈕 sprite (normal/pressed/disabled) | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `circle_icon/circle_normal.png \| C59C521BB34380A192B9DF560F14B729C2771F3CFEC799FF81B0FA1DD364172B \| 3359B`, `circle_pressed.png \| D0B4EC5584617667408979DFEFF54700F6941D199565B32F97E1871688284403 \| 3127B`, `circle_disabled.png \| B055E02BA53B6594A25DEF9451D86EB7F1215919811BFC6D21D7A8B929BA55F6 \| 2039B`. §6.1/6.2/6.4 跨畫面圓形按鈕通用家族. |
| UI-1-0009 | 垂直菱形 Tab sprite (active/inactive) | `Agent2` | done | — | 🟠 中低 | completed 2026-03-31. `diamond_tab/diamond_active.png \| 1BBF88ADA803112741BF98D5CC497777B83F0DD343F80B4DA0FEFC7455F334E9 \| 1686B` (56×56, 金色漸層菱形), `diamond_inactive.png \| 589D5B67853E071297EB8D52BA17CE13DB3F0F0BACA463243465AC30FF585A76 \| 472B` (56×56). §2.6 垂直菱形 Tab，非 9-slice 獨立 sprite. |
| UI-1-0010 | Badge/角標 Sprite 套件（9 檔） | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `badge/badge_rarity_N.png \| 96AA8008...ABE151 \| 530B`, R `\|579B`, SR `\|700B`, SSR `\|704B`, UR `\|672B`, LR `\|592B`, `badge_lv.png \|646B`, `badge_qty.png \|271B`, `badge_notification.png \|1229B`. §2.7 item-cell badge 層缺口修正. |
| UI-1-0011 | Gold CTA 框體 sprite (frame/fill/bg) | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. `gold_cta/frame.png \| B753A6D6...E5A4A9 \| 2189B` (80×80, 3px 金層框+外 glow+角三角裝飾, border [28,28,28,28]), `fill.png \|290B` (64×64), `bg.png \|733B` (64×64). §2.4 Gold CTA 框體獨立面板 sprite. |
| UI-1-0012 | §9.6 Skin 契約自動驗證腳本 | `Agent2` | done | — | 🟡 中 | completed 2026-03-31. 建立 `tools_node/validate-skin-contracts.js`，初次掃描通過率 82.8%（24 PASS / 5 FAIL）＜general-detail-default.json 5 個 bleed slot 缺失（需 Agent1 補齊）. |
| UI-1-0013 | §3.3 Frame Sprite 金色邊框像素掃描腳本 | `Agent2` | done | UI-1-0012 | 🟡 中 | completed 2026-03-31. 建立 `tools/validate-frame-sprites.ps1`，掃描 10 個 frame/button sprite 的邊緣金色像素；首次執行 10/10 PASS（dark_metal:735px, parchment:101px, gold_cta:738px ... commerce:3877px）；§9.6 全規則套件完整度 100%. |

---

## Phase B：Skin 系統升級

| ID | 任務 | Owner | Status | Depends | Priority | Notes |
|---|---|---|---|---|---|---|
| B-1 | ui-design-tokens.json 新增 parchment 系列 | `Agent1` | done | — | 🟡 中 | 2026-03-31 完成；已新增 `surfaceParchmentFill` / `textOnParchment` / `dividerOnParchment` / `shadowDefault` 至 `assets/resources/ui-spec/ui-design-tokens.json` |
| B-2 | 所有 skin 加入 *.shadow slot | `Agent1` | done | A-3 | 🟡 中 | 2026-03-31 完成；已拆成 `UI-2-0013 ~ UI-2-0015` 三波 rollout，19 個 skin 的主容器 shadow slot 全數補齊 |
| B-3 | label-style 淺底專用變體 | `Agent1` | done | B-1 | 🟡 中 | 2026-03-31 完成；新增 `bodyOnParchment` / `labelOnParchment`，並讓 `UISkinResolver` 可讀取 `label-style.style` typography preset，預設 `outlineWidth=0` |
| UI-2-0017 | 修補 general-detail 缺失 5 個 bleed slot | `Agent1` | done | UI-1-0012 | 🟡 中 | 2026-03-31 驗證確認 `general-detail-default.json` 已補齊 5 個 bleed slot；`validate-skin-contracts.js` 與 acceptance 皆通過，29/29 PASS（對應 [UI-2-0017](agent-briefs/tasks/UI-2-0017.md (doc_task_0041)) (doc_task_0041)）. |
| B-4 | item-cell 標準 skin fragment | `Agent1` | done | A-2 | 🟡 中 | 2026-03-31 完成；`item-cell-default.json` v2：修正 sprite 路徑、新增 7 階 rarity.*.border + rarity.default.bg；R2/R5 合規，acceptance 全綠 |
| B-5 | common-parchment skin fragment | `Agent1` | done | A-1, B-1 | 🟡 中 | 2026-03-31 完成；`common-parchment-default.json` v2：parchment frame/bleed/noise 路徑修正、新增 text.primary/secondary/accent (outlineWidth=0)；R2/R4 合規，acceptance 全綠 |
| UI-2-0019 | 對齊 D-2 的家族目標（paper.utility vs common-parchment） | `Agent1` | done | B-5, UI-2-0014 | 🟡 中 | 2026-03-31 完成；正式將 D-2 收斂為 `common-parchment / light-surface carrier consistency`，不再以 `paper.utility` 當作 shop/gacha 的正式驗收對象 |
| UI-2-0023 | 建立 D 階段可重現的 headless preview capture 流程 | `Agent1` | done | — | 🟡 中 | 2026-03-31 完成；已穩定輸出 `LobbyMain` / `ShopMain` / `Gacha` / `DuelChallenge` |
| UI-2-0025 | 對齊 Gacha preview contract 與 `loadFullScreen()` | `Agent1` | done | UI-2-0018, UI-2-0023 | 🟡 中 | 2026-03-31 完成；新增 `gacha-preview-main.json`，並將 `previewTarget=Gacha` 對齊到 `gacha-main-screen`，`Gacha.png` 已可輸出 |
| UI-2-0020 | 將 shop-main / gacha 接上可驗的 light-surface carrier | `Agent1` | done | B-5, UI-2-0014, UI-2-0019 | 🟡 中 | 前置任務 (B-5, UI-2-0014, UI-2-0019) 全部完成；待 Agent1 執行接線 |
| UI-2-0022 | 將 general-list 從 placeholder 表格升級為正式九宮格框體 | `Agent1` | done | — | 🟡 中 | `general.header.bg` / `general.list.bg` / `general.row.bg` 仍是 `color-rect`；待 Agent1 以 common/lobby panel family 收斂 |

---

## Phase C：Renderer 與程式支持

| ID | 任務 | Owner | Status | Depends | Priority | Notes |
|---|---|---|---|---|---|---|
| C-1 | UIPreviewBuilder shadow layer 渲染 | `Agent1` | done | A-3, B-2 | 🟡 中 | 2026-03-31 完成 shadow runtime + layout-safe detached shadow host；acceptance 38/38 全綠。CLOSED |
| C-1A | popup / Layout / legacy shadow 補齊 | `Agent1` | done | C-1 | 🟡 中 | 2026-03-31 Layout/popup 缺口已解，validate-skin-contracts 全綠。人工 preview QA 由 D-1~D-3 後續收斂。CLOSED |
| UI-2-0018 | D 階段 screen-driven preview harness | `Agent1` | done | — | 🟡 中 | 2026-03-31 完成；新增 `UIScreenPreviewHost.ts`，並將 `LoadingScene.ts` 擴成 preview hub。正式入口為 `LoadingScene.scene` + `previewMode=true` + `previewTarget={LobbyMain,ShopMain,Gacha,DuelChallenge}` |
| UI-2-0021 | PreviewInEditor SpriteFrame 索引修復 | `Agent1` | done | A-3, A-5, UI-2-0018 | 🔴 最高 | 2026-03-31 完成；`ResourceManager.ts` 補齊資源路徑正規化、SpriteFrame/Texture fallback 候選載入與單張 SpriteFrame 快取釋放，新增 `tools_node/validate-representative-spriteframe-assets.js` 並接入 acceptance，4/4 代表性路徑 PASS，`curl.exe http://localhost:7456/asset-db/refresh` 成功 |
| C-2 | UIPreviewBuilder noise overlay 混合 | `Agent1` | done | A-5 | 🟢 低 | 2026-03-31 完成；`UIPreviewBuilder` 新增 `*.noise` 關聯 slot 解析，先支援 standalone fill panel 的 alpha 疊圖 noise overlay；`general-detail-default` 已接入 `detail.header/summary/tabbar.rail/content/footer.noise` |
| C-3 | button-skin 支持 selected 第四態 | `Agent1` | done | — | 🟢 低 | 2026-03-31 完成；`button-skin` 新增 `selected`，`UIPreviewBuilder` 會快取各狀態 frame，並提供 `setButtonVisualState()`；若未提供 `selected` 則 fallback 到 `normal` |

---

## Phase D：畫面驗證台

| ID | 任務 | Owner | Status | Depends | Priority | Notes |
|---|---|---|---|---|---|---|
| D-1 | lobby-main nav.ink + shadow 全驗證 | `Agent2`+`human` | in-progress | P0-2, B-2, C-1, UI-2-0018 | 🟡 中 | 2026-03-31 已由 `UI-2-0018` 解除 blocked；正式入口為 `assets/scenes/LoadingScene.scene` → `LoadingScene.previewMode=true` → `previewTarget=LobbyMain`。Agent2 已開始執行，但本 session `http://localhost:7456` 暫時無法連線，待 Editor 恢復後可直接接續截圖 |
| D-2 | shop-main + gacha light-surface / common-parchment 多畫面驗證 | `Agent2`+`human` | in-progress | UI-2-0014, UI-2-0018, UI-2-0019, UI-2-0020, UI-2-0025 | 🟡 中 | 2026-03-31 `ShopMain.png` 與 `Gacha.png` 已可由 headless preview 輸出；下一步是補正式比較 notes 與人工 review |
| D-3 | duel-challenge 混搭驗證 | `Agent2`+`human` | not-started | P0-4, UI-2-0012, UI-2-0018 | 🟢 低 | 2026-03-31 已由 `UI-2-0018` 解除 blocked；正式入口為 `assets/scenes/LoadingScene.scene` → `LoadingScene.previewMode=true` → `previewTarget=DuelChallenge`，不再借用 legacy `DuelChallengePanel.ts` |
| D-4 | 品質評分 v2 更新至品質分析 § 7.3 | `human` | not-started | D-1~D-3 | 🟡 中 | 至少 3 個維度 ≥ +1 分 |

---

## 快速看板

### 進度統計

| Phase | Total | Done | In Progress | Not Started | Blocked |
|---|---|---|---|---|---|
| P0 | 6 | 6 | 0 | 0 | 0 |
| A | 14 | 14 | 0 | 0 | 0 |
| Phase B | 9 | 9 | 0 | 0 | 0 |
| Phase C | 7 | 6 | 0 | 1 | 0 |
| Phase D | 29 | 6 | 15 | 8 | 0 |
| **Total** | **70** | **44** | **18** | **8** | **0** |

### 推薦的平行執行路線

```
             ┌─ P0-1 (Agent2) ──→ P0-2 (Agent1) ──┐
             │
開始 ────────┼─ P0-3 (Agent2) ──→ P0-4 (Agent1) ──┼─→ UI-2-0018 (Agent1) + UI-2-0021 (Agent1) ──→ D-1 / D-3
             │
             ├─ P0-5 (Agent2) ──→ P0-6 (Agent1)
             │
             ├─ A-1 (Agent2) ──┐
             │             ├──→ B-5 (Agent1)
             ├─ B-1 (Agent1) ──┘
             │
             ├─ A-3 (Agent2) ──→ B-2 (Agent1) ──→ C-1 (Agent1)
             │
             └─ A-5 (Agent2) ──→ C-2 (Agent1)

UI-2-0014 ──→ UI-2-0019 ──→ UI-2-0020 ──→ D-2
```

> **最短路徑**：如果只有一個 Agent，現在可先直接跑 `D-1` 或 `D-3`；若要關閉 D-2，最短路徑是 `UI-2-0019 → UI-2-0020 → D-2`。

---

## 變更紀錄

| 日期 | 變更人 | 說明 |
|---|---|---|
| 2026-03-31 | Agent1 | 初始建立；23 個 task 全部 not-started |
| 2026-03-31 | Agent2 | 完成 P0-1/P0-3/P0-5（sprite 搬遷）、A-1（parchment）、A-2（item-cell）、A-3（shadow）、A-5（noise）；共 23 個檔案，全部 SHA256 驗收通過 |
| 2026-03-31 | Agent1 | 完成 B-1 / B-3 / C-3；P0-2 / P0-4 仍待 Agent2 將 nav.ink / paper.utility runtime sprite 搬入正式路徑後接線 |
| 2026-03-31 | Agent1 | 補開 UI-2-0006 ~ UI-2-0011 任務卡，並同步 `ui-quality-todo.json` / `CheckList.md` (doc_ai_0022) / `tasks_index.md` (doc_task_0002)，修正 P0-6 與 legacy card 的對應 |
| 2026-03-31 | Agent1 | 完成 UI-2-0001 / UI-2-0002；`lobby-main-default` 接上 `nav_ink`，`duel-challenge-default` 的 reject 按鈕接上 `paper_utility`，並同步所有追蹤文件 |
| 2026-03-31 | Agent1 | 完成 UI-2-0006；新增 shared button family border 驗證腳本並接入 acceptance，P0 系列目前僅剩視覺驗收項 |
| 2026-03-31 | Agent1 | 依 `D-3` 混搭驗收缺口補開 `UI-2-0012`，追蹤 `duel.btn.accept -> ui-common-metal.equipment.primary` 的後續接線 |
| 2026-03-31 | Agent1 | 完成 UI-2-0012；`duel.btn.accept` 已接上 `ui-common-metal.equipment.primary`，`D-3` 所需的 mixed-family 接線前置已齊備 |
| 2026-03-31 | Agent2 | 補開 `UI-1-0014 ~ UI-1-0016` 三張 D 階段視覺 QA 任務卡，並建立 `docs/agent-briefs/agent2-visual-qa-playbook.md (doc_ai_0021)` (doc_ai_0021) 作為 Agent2 共用截圖與評分模板；`D-1` 進入 in-progress |
| 2026-03-31 | Agent1 | 將 `B-2 / UI-2-0007` 轉為 umbrella task，拆成 `UI-2-0013 ~ UI-2-0015` 三波 shadow rollout 子卡，先同步 manifest 與 Agent1 索引 |
| 2026-03-31 | Agent1 | 完成 `UI-2-0013`；於 `lobby-main-default`、`duel-challenge-default`、`result-popup-default`、`network-status-default`、`toast-message-default` 補上首波 shadow slot，並通過 acceptance |
| 2026-03-31 | Agent1 | 完成 `UI-2-0014`；於 `general-detail-default`、`general-list-default`、`general-portrait-default`、`general-quickview-default`、`support-card-default`、`shop-main-default`、`gacha-default` 補上第二波 shadow slot，並通過 acceptance |
| 2026-03-31 | Agent1 | 完成 `UI-2-0015`；於 `battle-hud-default`、`battle-log-default`、`action-command-default`、`deploy-panel-default`、`unit-info-panel-default`、`tiger-tally-default`、`style-check-default` 補上第三波 shadow slot，並將 `B-2 / UI-2-0007` 關單 |
| 2026-03-31 | Agent1 | 將 `UI-2-0010` 推進為 in-progress；確認第一版 shadow runtime 已上線且 acceptance 全綠，另補開 `UI-2-0016` 追蹤 `popup` / `Layout` parent / legacy 畫面的剩餘 shadow 缺口 |
| 2026-03-31 | Agent2 | Session 5：完成 UI-1-0013（§3.3 frame sprite gold-edge 掃描腳本，10/10 PASS）；補開 UI-2-0017（general-detail 5 個 bleed slot 修補，Agent1 任務）；更新 §7.3 評分至 v3 中期估算（5.3/10） |
| 2026-03-31 | Agent1 | 為 `UIPreviewBuilder` 新增 layout-safe detached shadow host，讓 parent 含 `Layout` 的節點可正確渲染 shadow，並以 `node tools_node/run-acceptance.js` 驗證全綠；同步確認 `general-detail-default` 的 5 個 bleed slot 已存在，關閉 `UI-2-0017` |
| 2026-03-31 | Agent1 | 完成 `UI-2-0011`；`UIPreviewBuilder` 新增 `*.noise` slot runtime，先支援 standalone fill panel 的 alpha 疊圖 noise overlay，並在 `general-detail-default.json` 接入 `detail.header/summary/tabbar.rail/content/footer.noise`；`run-acceptance` 與 `validate-skin-contracts` 全綠 |
| 2026-03-31 | Agent2 | 盤點 D-1~D-3 實際預覽入口後，確認 `lobby-main-screen` / `shop-main-screen` / `gacha-screen` / `duel-challenge-screen` 目前都缺少 `loadFullScreen(...)` 掛載點；將 `UI-1-0014 ~ UI-1-0016` 轉為 blocked，並補開 `UI-2-0018` 給 Agent1 收斂 preview harness |
| 2026-03-31 | Agent1 | 完成 B-4（UI-2-0008）與 B-5（UI-2-0009）：item-cell-default.json v2 修正路徑（bg/frame/bleed/shadow) 並新增 7 階 rarity.*.border + rarity.default.bg；common-parchment-default.json v2 修正路徑（parchment/frame, bleed/bleed_parchment, noise/paper_noise_256) 並新增 text.primary/secondary/accent, parchment.divider；R2/R4/R5 全合規，run-acceptance 全綠；關閉 C-1（UI-2-0010）與 C-1A（UI-2-0016） |
| 2026-03-31 | Agent2 | 進一步盤點 D-2 時發現任務文字仍寫 `paper.utility`，但 `shop-main-default` / `gacha-default` 實作已與此脫節；新增 `UI-2-0019` 讓 Agent1 先收斂 D-2 的 target family，並補齊 `UI-1-0015` / `UI-1-0016` 的 artifact QA 骨架 |
| 2026-03-31 | Agent1 | 完成 `UI-2-0018`；新增 `assets/scripts/ui/components/UIScreenPreviewHost.ts`，並將 `assets/scripts/ui/scenes/LoadingScene.ts` 擴成 preview hub，提供 `LobbyMain / ShopMain / Gacha / DuelChallenge` 四個 screen-driven 預覽入口 |
| 2026-03-31 | Agent1 | 完成 `UI-2-0019`，正式將 D-2 目標從 `paper.utility` 收斂為 `common-parchment / light-surface carrier consistency`，並補開 `UI-2-0020` 追蹤 shop-main / gacha 的 shared light-surface 接線 |
| 2026-03-31 | Agent2 | 收到 PreviewInEditor log 後，盤點 `shadow_01`、`metal_noise_256`、`equipment/btn_primary_normal` 與多個 `general_detail` sprite 的實體檔，確認 PNG 與 `.meta` 已存在於 `assets/resources/sprites/ui_families/...`；補開 `UI-2-0021` 交由 Agent1 收斂 PreviewInEditor 的 resources 索引 / 路徑解析斷鏈 |
| 2026-03-31 | Agent2 | 依 `general-list` 實機截圖補開 `UI-2-0022`；確認 `general-list-default.json` 雖已掛 `bg_ink_main`，但 header/list/row 仍是 `color-rect`，因此畫面仍呈現 placeholder / 白模表格感，先交由 Agent1 做 skin 與九宮格框體升級 |
| 2026-03-31 | Agent1 | 完成 `UI-2-0021`；`ResourceManager.ts` 補齊 SpriteFrame 路徑正規化、候選 fallback 與快取釋放，新增 `tools_node/validate-representative-spriteframe-assets.js` 並接入 acceptance，代表性路徑 4/4 PASS，`run-acceptance` 全綠，asset-db refresh 成功 |
| 2026-03-31 | Agent2 | 重新盤點 `UI-2-0020` / `UI-2-0022` 的實際 skin 狀態後，確認 manifest 的 `not-started` 才是正確狀態；同步把 D-1 / D-3 artifact README 與 notes 改為 ready，並將 D-2 的 blocker 收斂為只剩 `UI-2-0020` |
| 2026-03-31 | Agent1 | 完成 `UI-2-0022`；`general-list-default.json` v5：`general.header.bg` 改 `dark_metal/frame` 九宮格、`general.list.bg` 改 `parchment/bg` 九宮格（opacity=0.6）、`general.row.bg` 改 `dark_metal/bg` 九宮格、表頭字色升級為金色 #D4AF37；acceptance 全綠 |
| 2026-03-31 | Agent1 | 完成 `UI-2-0020`；shop-main-default.json v5 新增 `shop.content.carrier` QA anchor slot；gacha-default.json v3 新增 `gacha.pity.carrier.bg/frame` slot；gacha-main.json v2 於 `PityInfoBar` 掛入 carrier skinSlot；D-2 解除 blocked 改為 not-started，可由 Agent2 進行截圖 QA |
| 2026-04-01 | Agent2 | 補開 `UI-2-0047`，把 29 張 `UI品質參考圖` 進一步提煉成跨功能規則：同功能同色票、深淺成對、字級階層、carrier/glyph 分層、family 批次生產、狀態組 / 尺寸組同步產出，並回寫到主分析文件與 QA 規則文檔。 |
| 2026-04-01 | Agent2 | 由 `UI-2-0047` 再拆出 `UI-2-0048 ~ UI-2-0052`，把「固定功能語意色票、family 批次生產、狀態組與尺寸組、screen-context QA、規格欄位化」五個缺口全部轉成正式子任務，並新增 `asset-production-field-template.md` 供後續任務直接套用。 |
| 2026-04-01 | Agent2 | 正式完成 `UI-2-0047 ~ UI-2-0052`，將五張規格卡與 `macro-style-rules / field template` 收斂為可交接版本，並把 `UI-2-0044`、`UI-2-0045` 對齊為等待 Agent1 生圖的 `in-progress` 狀態。 |
| 2026-04-01 | Agent2 | 延續 `UI-2-0053`，完成 BattleScene 主 UI 的 style zone audit、BattleScene style profile v1 與各主畫面 screen style profile schema / 補件順序；目前結論是可進行畫面級規則收斂，但仍待 `UI-2-0046` 完成真場景 capture 後再做 placement QA。 |
| 2026-04-01 | Agent2 | 新開 `UI-2-0054`，完成全專案角色視覺總綱與美術品質優先序 v1，正式定案人物立繪採半寫實國風英雄化，並收斂為戰場 `3D 模型為主`、`2D 立繪為 HUD / Detail / Card / 商業化畫面主語言`。 |

### 推薦的平行執行路線

```
             ┌─ P0-1 (Agent2) ──→ P0-2 (Agent1) ──┐
             │
開始 ────────┼─ P0-3 (Agent2) ──→ P0-4 (Agent1) ──┼─→ UI-2-0018 (Agent1) + UI-2-0021 (Agent1) ──→ D-1 / D-3
             │
             ├─ P0-5 (Agent2) ──→ P0-6 (Agent1)
             │
             ├─ A-1 (Agent2) ──┐
             │             ├──→ B-5 (Agent1)
             ├─ B-1 (Agent1) ──┘
             │
             ├─ A-3 (Agent2) ──→ B-2 (Agent1) ──→ C-1 (Agent1)
             │
             └─ A-5 (Agent2) ──→ C-2 (Agent1)

UI-2-0014 ──→ UI-2-0019 ──→ UI-2-0020 ──→ D-2
```

> **最短路徑**：如果只有一個 Agent，現在可先直接跑 `D-1` 或 `D-3`；若要關閉 D-2，最短路徑是 `UI-2-0019 → UI-2-0020 → D-2`。

---

## 變更紀錄

| 日期 | 變更人 | 說明 |
|---|---|---|
| 2026-03-31 | Agent1 | 初始建立；23 個 task 全部 not-started |
| 2026-03-31 | Agent2 | 完成 P0-1/P0-3/P0-5（sprite 搬遷）、A-1（parchment）、A-2（item-cell）、A-3（shadow）、A-5（noise）；共 23 個檔案，全部 SHA256 驗收通過 |
| 2026-03-31 | Agent1 | 完成 B-1 / B-3 / C-3；P0-2 / P0-4 仍待 Agent2 將 nav.ink / paper.utility runtime sprite 搬入正式路徑後接線 |
| 2026-03-31 | Agent1 | 補開 UI-2-0006 ~ UI-2-0011 任務卡，並同步 `ui-quality-todo.json` / `CheckList.md` (doc_ai_0022) / `tasks_index.md` (doc_task_0002)，修正 P0-6 與 legacy card 的對應 |
| 2026-03-31 | Agent1 | 完成 UI-2-0001 / UI-2-0002；`lobby-main-default` 接上 `nav_ink`，`duel-challenge-default` 的 reject 按鈕接上 `paper_utility`，並同步所有追蹤文件 |
| 2026-03-31 | Agent1 | 完成 UI-2-0006；新增 shared button family border 驗證腳本並接入 acceptance，P0 系列目前僅剩視覺驗收項 |
| 2026-03-31 | Agent1 | 依 `D-3` 混搭驗收缺口補開 `UI-2-0012`，追蹤 `duel.btn.accept -> ui-common-metal.equipment.primary` 的後續接線 |
| 2026-03-31 | Agent1 | 完成 UI-2-0012；`duel.btn.accept` 已接上 `ui-common-metal.equipment.primary`，`D-3` 所需的 mixed-family 接線前置已齊備 |
| 2026-03-31 | Agent2 | Session 5：完成 UI-1-0013（§3.3 frame sprite gold-edge 掃描腳本，10/10 PASS）；補開 UI-2-0017（general-detail 5 個 bleed slot 修補，Agent1 任務）；更新 §7.3 評分至 v3 中期估算（5.3/10） |
| 2026-03-31 | Agent1 | 為 `UIPreviewBuilder` 新增 layout-safe detached shadow host，讓 parent 含 `Layout` 的節點可正確渲染 shadow，並以 `node tools_node/run-acceptance.js` 驗證全綠；同步確認 `general-detail-default` 的 5 個 bleed slot 已存在，關閉 `UI-2-0017` |
| 2026-03-31 | Agent1 | 完成 `UI-2-0011`；`UIPreviewBuilder` 新增 `*.noise` slot runtime，先支援 standalone fill panel 的 alpha 疊圖 noise overlay，並在 `general-detail-default.json` 接入 `detail.header/summary/tabbar.rail/content/footer.noise`；`run-acceptance` 與 `validate-skin-contracts` 全綠 |
| 2026-03-31 | Agent2 | 盤點 D-1~D-3 實際預覽入口後，確認 `lobby-main-screen` / `shop-main-screen` / `gacha-screen` / `duel-challenge-screen` 目前都缺少 `loadFullScreen(...)` 掛載點；將 `UI-1-0014 ~ UI-1-0016` 轉為 blocked，並補開 `UI-2-0018` 給 Agent1 收斂 preview harness |
| 2026-03-31 | Agent1 | 完成 B-4（UI-2-0008）與 B-5（UI-2-0009）：item-cell-default.json v2 修正路徑（bg/frame/bleed/shadow) 並新增 7 階 rarity.*.border + rarity.default.bg；common-parchment-default.json v2 修正路徑（parchment/frame, bleed/bleed_parchment, noise/paper_noise_256) 並新增 text.primary/secondary/accent, parchment.divider；R2/R4/R5 全合規，run-acceptance 全綠；關閉 C-1（UI-2-0010）與 C-1A（UI-2-0016） |
| 2026-03-31 | Agent2 | 進一步盤點 D-2 時發現任務文字仍寫 `paper.utility`，但 `shop-main-default` / `gacha-default` 實作已與此脫節；新增 `UI-2-0019` 讓 Agent1 先收斂 D-2 的 target family，並補齊 `UI-1-0015` / `UI-1-0016` 的 artifact QA 骨架 |
| 2026-03-31 | Agent1 | 完成 `UI-2-0018`；新增 `assets/scripts/ui/components/UIScreenPreviewHost.ts`，並將 `assets/scripts/ui/scenes/LoadingScene.ts` 擴成 preview hub，提供 `LobbyMain / ShopMain / Gacha / DuelChallenge` 四個 screen-driven 預覽入口 |
| 2026-03-31 | Agent1 | 完成 `UI-2-0019`，正式將 D-2 目標從 `paper.utility` 收斂為 `common-parchment / light-surface carrier consistency`，並補開 `UI-2-0020` 追蹤 shop-main / gacha 的 shared light-surface 接線 |
| 2026-03-31 | Agent2 | 收到 PreviewInEditor log 後，盤點 `shadow_01`、`metal_noise_256`、`equipment/btn_primary_normal` 與多個 `general_detail` sprite 的實體檔，確認 PNG 與 `.meta` 已存在於 `assets/resources/sprites/ui_families/...`；補開 `UI-2-0021` 交由 Agent1 收斂 PreviewInEditor 的 resources 索引 / 路徑解析斷鏈 |
| 2026-03-31 | Agent2 | 依 `general-list` 實機截圖補開 `UI-2-0022`；確認 `general-list-default.json` 雖已掛 `bg_ink_main`，但 header/list/row 仍是 `color-rect`，因此畫面仍呈現 placeholder / 白模表格感，先交由 Agent1 做 skin 與九宮格框體升級 |
| 2026-03-31 | Agent1 | 完成 `UI-2-0021`；`ResourceManager.ts` 補齊 SpriteFrame 路徑正規化、候選 fallback 與快取釋放，新增 `tools_node/validate-representative-spriteframe-assets.js` 並接入 acceptance，代表性路徑 4/4 PASS，`run-acceptance` 全綠，asset-db refresh 成功 |
| 2026-03-31 | Agent2 | 重新盤點 `UI-2-0020` / `UI-2-0022` 的實際 skin 狀態後，確認 manifest 的 `not-started` 才是正確狀態；同步把 D-1 / D-3 artifact README 與 notes 改為 ready，並將 D-2 的 blocker 收斂為只剩 `UI-2-0020` |
| 2026-03-31 | Agent1 | 完成 `UI-2-0022`；`general-list-default.json` v5：`general.header.bg` 改 `dark_metal/frame` 九宮格、`general.list.bg` 改 `parchment/bg` 九宮格（opacity=0.6）、`general.row.bg` 改 `dark_metal/bg` 九宮格、表頭字色升級為金色 #D4AF37；acceptance 全綠 |
| 2026-03-31 | Agent1 | 完成 `UI-2-0020`；shop-main-default.json v5 新增 `shop.content.carrier` QA anchor slot；gacha-default.json v3 新增 `gacha.pity.carrier.bg/frame` slot；gacha-main.json v2 於 `PityInfoBar` 掛入 carrier skinSlot；D-2 解除 blocked 改為 not-started，可由 Agent2 進行截圖 QA |
| 2026-04-01 | Agent2 | 完成 `UI-2-0028` 第一張自動化 icon 候選稿 `unitinfo_type_icon_spear_v1.png` 與 `docs/UI品質參考圖/` 的比對，確認主要品質差異在材質層次、飽和度、carrier 語言、縮圖辨識度與做舊感，並新開 `UI-2-0032` 作為 v2 refinement 任務。 |
| 2026-04-01 | Agent2 | 重新盤點 `docs/UI品質參考圖/` 全量截圖，補開 `UI-2-0035` 建立 20-icon baseline 與 icon family 條件規則庫，作為後續 BattleScene icon 自動生成與選型策略依據。 |
| 2026-04-01 | Agent2 | 延續 `UI-2-0035`，把 F1~F8 icon family 正式對應到 `UI-2-0027 ~ UI-2-0032` 的量產需求單，以及現行 `battle-hud`、`battle-log`、`tiger-tally`、`gacha`、`support-card` 等 ui-spec 契約，補出 `artifacts/ui-qa/UI-2-0035/icon-family-assignment.md` 作為後續量產與 QA 的依據。 |
| 2026-04-01 | Agent2 | 延續 `UI-2-0032`，完成 `artifacts/ui-qa/UI-2-0032/agent1-generation-brief.md`，將 v2 refinement 收斂為可直接交給 Agent1 的生圖規格；同步新開 `UI-2-0036` 作為 BattleScene icon v2 候選稿執行卡。 |
| 2026-04-01 | Agent2 | 盤點新增參考圖 `S13 ~ S28` 後，補開 `UI-2-0037`，將研究擴充到非 icon 的量產圖 family，新增 portrait、diorama card、建築節點、任務插畫卡、獎勵容器、道具包與服裝 torso 等規則，並回寫到 `docs/UI參考圖品質分析.md (doc_ui_0051)` (doc_ui_0051) 與 `artifacts/ui-qa/UI-2-0037/`。 |
| 2026-04-01 | Agent2 | 完成 `UI-2-0038` 的 A2 HUD 頭像裁片規格，建立 `artifacts/ui-qa/UI-2-0038/` 參考素材、`portrait-family-spec.md`、`agent1-generation-brief.md`，並補開 `UI-2-0043` 交給 Agent1 產出 BattleHUD portrait crop proof。 |
| 2026-04-01 | Agent2 | 依 `LobbyMain` 與 `general-detail / general-quickview / general-portrait` 的 ui-spec slot 盤點結果，補開 `UI-2-0044`（Lobby icon 生圖卡）與 `UI-2-0045`（武將介紹 / QuickView icon 生圖卡），讓 Lobby 與武將介紹 icon 正式脫離 BattleScene icon 任務單獨追蹤。 |

| 2026-04-01 | Agent2 | ?? `UI-2-0039`???? TigerTally card art ?????? `A4 tactical diorama card`???? `A5 hero-panel` ?? proof brief?? Agent1 ????? QA ??? |

| 2026-04-01 | Agent2 | 將 UI-2-0040 轉入 in-progress，補齊 A8 reward / bundle props family 的量產規格、QA 說明與 Agent1 generation brief，供商城 bundle、獎勵揭示、任務獎勵後續共用。 |
