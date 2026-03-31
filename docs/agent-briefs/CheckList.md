# Agent Briefs — Task CheckList

> 本清單為所有已開立任務卡的總覽，可快速查詢狀態與完成度。  
> 任務卡詳情請點擊卡號連結。更新狀態時，請同步修改對應任務卡 frontmatter 與 `docs/ui-quality-todo.json`。
>
> **任務卡 ID 規則**：`{系統代號}-{子系統}-{流水號4位}`  
> 代號定義詳見 [docs/系統規格書/名詞定義文件.md](../../系統規格書/名詞定義文件.md)

---

## UI 視覺介面系統（UI-1 視覺資產 / UI-2 接線配置）

| 優先級 | 卡號 | 開單原因 | 開單時間 | 簡單描述 | 狀態 | 完成度% | 完成時間 | 負責 Agent |
|---|---|---|---|---|---|---|---|---|
| P0 | [UI-1-0001](tasks/UI-1-0001.md) | nav_ink runtime 路徑未建立，skin 無法引用 | 2026-03-31 | 搬遷 `nav_ink` 按鈕 family 至 runtime 路徑 | done | 100% | 2026-03-31 | Agent2 |
| P0 | [UI-1-0002](tasks/UI-1-0002.md) | paper_utility runtime 路徑未建立，skin 無法引用 | 2026-03-31 | 搬遷 `paper_utility` 按鈕 family 至 runtime 路徑 | done | 100% | 2026-03-31 | Agent2 |
| P0 | [UI-1-0003](tasks/UI-1-0003.md) | warning runtime 路徑未建立，誤操作防護視覺層缺失 | 2026-03-31 | 搬遷 `warning` 按鈕 family 至 runtime 路徑 | done | 100% | 2026-03-31 | Agent2 |
| P0 | [UI-1-0004](tasks/UI-1-0004.md) | 共用 shadow/noise 紋理缺失，多個 skin 無法引用 | 2026-03-31 | 產生共用 shadow 與 noise 紋理 | done | 100% | 2026-03-31 | Agent2 |
| P0 | [UI-2-0001](tasks/UI-2-0001.md) | lobby-main 按鈕群未接 nav_ink，與規範不符 | 2026-03-31 | 更新 `lobby-main-default` skin 指向 `nav_ink` | done | 100% | 2026-03-31 | Agent1 |
| P0 | [UI-2-0002](tasks/UI-2-0002.md) | duel-challenge 拒絕/工具按鈕未接 paper_utility | 2026-03-31 | 更新 `duel-challenge-default` skin 指向 `paper_utility` | done | 100% | 2026-03-31 | Agent1 |
| P0 | [UI-2-0021](tasks/UI-2-0021.md) | PreviewInEditor 無法載入已存在的 `shadow/noise/equipment/general_detail` SpriteFrame，日常預覽與 QA 可信度受損 | 2026-03-31 | 修復 PreviewInEditor 的 SpriteFrame 資源索引 / 路徑解析斷鏈 | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0003](tasks/UI-2-0003.md) | 淺底面板缺少共用 token，paper/parchment 家族無法共用顏色語言 | 2026-03-31 | 新增 parchment 系列 design token | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0004](tasks/UI-2-0004.md) | 淺底文字樣式缺失，paper 面板上的字色與描邊不正確 | 2026-03-31 | 新增淺底專用 label-style 變體 | done | 100% | 2026-03-31 | Agent1 |
| P2 | [UI-2-0005](tasks/UI-2-0005.md) | button-skin 缺少 selected 態，tab 與切換器無法沿用同一家族 API | 2026-03-31 | 為 button-skin 新增 selected 第四態 | done | 100% | 2026-03-31 | Agent1 |
| P0 | [UI-2-0006](tasks/UI-2-0006.md) | 共享按鈕家族已落地，但九宮格 border 尚未做統一驗證 | 2026-03-31 | 驗證 shared button family 的 border 20px 規範 | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0007](tasks/UI-2-0007.md) | shadow 紋理已存在，但各 skin 尚未補 shadow slot | 2026-03-31 | 為多個 skin 補上 shadow slot 定義 | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0013](tasks/UI-2-0013.md) | UI-2-0007 範圍過大，先拆首批 nav/popup/duel skin rollout | 2026-03-31 | 為 lobby / popup / duel 首批 skin 補 shadow slot | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0014](tasks/UI-2-0014.md) | UI-2-0007 範圍過大，需分離 lobby/detail collection 群組 | 2026-03-31 | 為 general / support / shop / gacha 群組補 shadow slot | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0015](tasks/UI-2-0015.md) | UI-2-0007 範圍過大，需分離 battle/system 群組 | 2026-03-31 | 為 battle / system 群組補 shadow slot | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0008](tasks/UI-2-0008.md) | item-cell 素材已生成，但尚未抽成共用 skin fragment | 2026-03-31 | 建立 item-cell 標準 skin fragment | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0009](tasks/UI-2-0009.md) | parchment 資產與 token 已就緒，但缺少可重用淺底框體 fragment | 2026-03-31 | 建立 common-parchment skin fragment | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0010](tasks/UI-2-0010.md) | shadow slot 與素材已齊，但 runtime 仍需先落地第一版並盤點剩餘缺口 | 2026-03-31 | 為 `UIPreviewBuilder` 加入 shadow layer 渲染 | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0016](tasks/UI-2-0016.md) | 第一版 shadow runtime 對 `popup` / `Layout` parent / legacy 畫面仍有缺口 | 2026-03-31 | 補齊 `UIPreviewBuilder` 的 popup / Layout / legacy shadow 覆蓋 | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0017](tasks/UI-2-0017.md) | validate-skin-contracts.js 發現 general-detail 缺 5 個 bleed slot | 2026-03-31 | 修補 general-detail-default.json 5 個缺失 bleed slot，目標契約驗證 100% PASS | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0018](tasks/UI-2-0018.md) | D-1~D-3 缺少真實的 screen-driven 預覽入口，Agent2 無法對 JSON 畫面做可信截圖 | 2026-03-31 | 補上 `lobby-main` / `shop-main` / `gacha` / `duel-challenge` 的 `loadFullScreen(...)` preview harness | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0019](tasks/UI-2-0019.md) | D-2 任務文字仍寫 `paper.utility`，但 `shop-main-default` / `gacha-default` 實作已與此脫節 | 2026-03-31 | 對齊 D-2 的 QA 目標，決定是回補 `paper.utility` 還是改寫為 `common-parchment` / light-surface 驗收 | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0020](tasks/UI-2-0020.md) | D-2 已收晕為 light-surface 驗收，但 `shop-main` / `gacha` 尚未接上共同可驗 target | 2026-03-31 | 將 `shop-main` / `gacha` 接上可供 D-2 截圖的 shared light-surface carrier | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0022](tasks/UI-2-0022.md) | `general-list` 仍停留在 placeholder / color-rect 表格，與既有九宮格框體標準不一致 | 2026-03-31 | 將 `general-list` 升級為正式九宮格背景與 framed header/list/row 皮膚 | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0023](tasks/UI-2-0023.md) | D 階段 headless capture 工具已完成，並已成功輸出 `LobbyMain` / `ShopMain` / `DuelChallenge` screenshot | 2026-03-31 | 完成 D-1~D-3 可重現的 headless preview screenshot 流程，並保留 debug artifacts 供 runtime 問題追查 | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0024](tasks/UI-2-0024.md) | `UIPreviewBuilder.ts` 中文密度過高且曾出現編碼災難風險，多人同檔衝突成本過大 | 2026-03-31 | 在目前修復穩定後，拆分 `UIPreviewBuilder.ts` 為 helper 模組以降低編碼與 merge 風險 | completed | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0025](tasks/UI-2-0025.md) | `Gacha` preview 入口已改為 `gacha-main-screen` + `gacha-preview-main`，不再受 legacy screen/layout schema 阻塞 | 2026-03-31 | 對齊 `Gacha` preview contract，讓 `Gacha.png` 可由 headless capture 正常輸出 | done | 100% | 2026-03-31 | Agent1 |
| P2 | [UI-2-0011](tasks/UI-2-0011.md) | noise 紋理已到位，但 runtime 尚未能做 fill 層疊加 | 2026-03-31 | 為 `UIPreviewBuilder` 加入 noise overlay 混合 | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-2-0012](tasks/UI-2-0012.md) | duel-challenge 的 accept 按鈕尚未對齊 `equipment.primary`，無法完成 D-3 混搭目標 | 2026-03-31 | 更新 `duel.btn.accept` 指向 `ui-common-metal.equipment.primary` | done | 100% | 2026-03-31 | Agent1 |
| P1 | [UI-1-0005](tasks/UI-1-0005.md) | Tab 框體家族完全缺失（§2.6），框體完整性 3/10 | 2026-03-31 | 產生水平 Tab active/inactive sprites | done | 100% | 2026-03-31 | Agent2 |
| P1 | [UI-1-0006](tasks/UI-1-0006.md) | bleed 暈邊層缺失，框體邊緣有「貼紙感」（§4.2） | 2026-03-31 | 產生 bleed overlay sprites（dark + parchment） | done | 100% | 2026-03-31 | Agent2 |
| P1 | [UI-1-0007](tasks/UI-1-0007.md) | §2.1 深色金屬框主體 sprite 完全缺失，框體完整性 3/10 | 2026-03-31 | 產生 dark_metal frame/fill/bg sprites（§2.1 主框體家族） | done | 100% | 2026-03-31 | Agent2 |
| P1 | [UI-1-0008](tasks/UI-1-0008.md) | 圓形 icon 按鈕在 §6.1/6.2/6.4 三畫面出現但無統一素材 | 2026-03-31 | 產生 circle_icon sprites（normal/pressed/disabled，80×80） | done | 100% | 2026-03-31 | Agent2 |
| P2 | [UI-1-0009](tasks/UI-1-0009.md) | §2.6 垂直菱形 Tab 完全缺失，§7.2 明列需補強 | 2026-03-31 | 產生 diamond_tab sprites（active/inactive，56×56，非 9-slice） | done | 100% | 2026-03-31 | Agent2 |
| P1 | [UI-1-0010](tasks/UI-1-0010.md) | §2.7 item-cell badge 層完全缺失（稀 有度角標/Lv/數量/通知 badge） | 2026-03-31 | 產生 badge sprites 9 個（rarity_N/R/SR/SSR/UR/LR + lv/qty/notification） | done | 100% | 2026-03-31 | Agent2 |
| P1 | [UI-1-0011](tasks/UI-1-0011.md) | §2.4 Gold CTA 框體缺少獨立 frame/fill/bg（只有按鈕 sprite） | 2026-03-31 | 產生 gold_cta frame/fill/bg sprites（80×80/64×64，9-slice [28,28,28,28]） | done | 100% | 2026-03-31 | Agent2 |
| P1 | [UI-1-0012](tasks/UI-1-0012.md) | §9.6 缺少自動化契約驗證腳本 | 2026-03-31 | 建立 tools_node/validate-skin-contracts.js，初次掃描通過率 82.8%（5 FAIL：general-detail bleed slots 缺失） | done | 100% | 2026-03-31 | Agent2 |
| P1 | [UI-1-0013](tasks/UI-1-0013.md) | §3.3 遭缺少 frame sprite 金色邊框像素掃描 | 2026-03-31 | 建立 tools/validate-frame-sprites.ps1，掃描 10 個 frame/button sprite 金色邊緣；首次執行 10/10 PASS, §9.6 驗證套件完整度 100% | done | 100% | 2026-03-31 | Agent2 |
| P1 | [UI-1-0014](tasks/UI-1-0014.md) | D-1 原先誤綁 `LobbyScene.scene`，現已確認不是 `lobby-main-screen` 的真實預覽入口 | 2026-03-31 | 改用 `LoadingScene.previewTarget=LobbyMain` 進行 `nav.ink + shadow` 截圖 QA；本輪已開始執行，但本機 Editor 端點暫時離線 | in-progress | 20% | — | Agent2 |
| P1 | [UI-1-0015](tasks/UI-1-0015.md) | D-2 已可擷取 `ShopMain` 與 `Gacha`，目前進度轉為正式比較與 notes 回填 | 2026-03-31 | 使用 `LoadingScene.previewTarget=ShopMain/Gacha` 執行正式截圖與 notes 回填 | in-progress | 70% | — | Agent2 |
| P2 | [UI-1-0016](tasks/UI-1-0016.md) | D-3 已可由 headless pipeline 輸出 `DuelChallenge.png`，接下來補正式比較與 notes | 2026-03-31 | 改用 `LoadingScene.previewTarget=DuelChallenge` 進行 mixed-family 語意 QA | in-progress | 40% | — | Agent2 |

---

## 依賴關係說明

| 前置任務卡 | 後置任務卡 | 說明 |
|---|---|---|
| UI-1-0001 | UI-2-0001 | nav_ink sprite 需先落地，lobby-main skin 才可引用 |
| UI-1-0002 | UI-2-0002 | paper_utility sprite 需先落地，duel-challenge skin 才可引用 |
| UI-1-0001 / UI-1-0002 / UI-1-0003 | UI-2-0006 | border 驗證需在三組 shared button family 都到位後執行 |
| UI-1-0004 | UI-2-0007 | shadow 紋理先就緒，skin 才能補 shadow slot |
| UI-2-0007 | UI-2-0013 / UI-2-0014 / UI-2-0015 | UI-2-0007 已拆成三張 rollout 子卡，parent 保留總追蹤與命名規範 |
| UI-1-0004 + UI-2-0007 | UI-2-0010 | shadow 素材與 slot 兩者都存在後，才值得補 runtime 渲染 |
| UI-1-0012 | UI-1-0013 | §9.6 contract script found general-detail bleed issues, prompting gold-edge sprite scan scope |
| UI-1-0012 | UI-2-0017 | validate-skin-contracts.js 初次掃描發現 general-detail 5 個 bleed slot 缺失，需 Agent1 修補 |
| UI-2-0010 | UI-2-0016 | 第一版 shadow runtime 完成後，再補 `popup` / `Layout` parent / legacy 畫面的剩餘覆蓋 |
| UI-1-0004 | UI-2-0011 | noise 紋理先就緒，runtime 才能支援 overlay |
| UI-2-0018 | UI-1-0014 / UI-1-0015 / UI-1-0016 | D 階段 QA 必須建立在真實的 `loadFullScreen(...)` 預覽入口上，不能拿 legacy 手刻場景替代 |
| UI-2-0001 + UI-2-0010 + UI-2-0018 | UI-1-0014 | `lobby-main` 的 nav.ink 視覺驗收要在實際 shadow runtime 與 screen-driven 預覽入口都可用後才有意義 |
| UI-2-0019 | UI-1-0015 | D-2 已正式收斂為 `common-parchment` / light-surface 一致性驗收 |
| UI-2-0020 | UI-1-0015 | `shop-main` / `gacha` 的 shared light-surface target 已齊備，Agent2 可直接進行 D-2 QA |
| UI-2-0014 + UI-2-0018 + UI-2-0019 + UI-2-0020 | UI-1-0015 | D-2 需同時具備真實 screen 畫面、明確 target family 定義與實際 shared carrier，否則 Agent2 仍會驗錯對象 |
| UI-2-0002 + UI-2-0012 + UI-2-0018 | UI-1-0016 | duel-challenge mixed-family 驗收以前置接線完成且有真實 screen-driven 預覽入口為前提 |
| UI-2-0002 | UI-2-0012 | reject 先切到 paper.utility 後，再補 accept 對齊 equipment.primary，才能進入 D-3 混搭驗收 |
| UI-2-0021 | UI-1-0014 / UI-1-0016 | 若 PreviewInEditor 對既有 spriteFrame 仍回報 `Bundle resources doesn't contain .../spriteFrame`，則 screen-driven QA 與日常 smoke 都不可信 |

> **並行執行**：所有 UI-1 任務卡可並行；UI-2 各卡在各自前置完成後可並行。

---

## 如何更新狀態

1. 完成任務後，修改對應任務卡（`tasks/XXX.md`）frontmatter 的 `status` 與 `notes`。
2. 更新 `docs/ui-quality-todo.json` 中對應 task 的 `status` 與 `notes`。
3. 更新本清單對應行的「狀態」與「完成度%」與「完成時間」。
4. 若新增任務卡，在上方表格加入一行，並在 `deps` 表格加入依賴關係（若有）。

### Agent 可開立新任務卡（注意事項）

Agent 在執行任務時，若發現超出原任務範圍或會阻塞後續工作，可依 `docs/agent-briefs/Readme.md` 的流程開立新任務卡。新卡至少需包含：`id`、`priority`、`created`（RFC3339）、`created_by_agent`、`owner`、`status`、`開單原因`、`related_cards`、`notes`。若 `owner` 為 `human`，請在 `notes` 標註聯絡人。建立後請同步更新 `docs/ui-quality-todo.json` 與本清單。

---

*最後更新：2026-03-31（`UI-2-0025` 完成，`Gacha.png` 已可輸出；共 41 張任務卡）*
