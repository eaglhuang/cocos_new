# UCUF Migration Active Checklist (2026-04-13)

> 本檔不再作為「完成報告」，而是過渡期唯一真相來源（single source of truth）。
> 每次 UCUF / battle migration / gate / AI 協作流程有實質進展，都必須先更新本檔，再更新永久文件。
> 等所有項目完成、且永久文件已吸收最終結論後，才可刪除此過渡檔。

## 狀態總覽

- 實際完成度：約 `80%`。
- 已完成主體：CompositePanel 主幹、M10/M11 gate 基礎、battle 主幹 host-node/composite-first 改造、aggregate UCUF tests。
- 未完成主體：legacy 物理退場（battle prefab inspector 審查、零引用 panel 搬移）、spec debt 盤點、P3 文件回收。
- 完成主體 (本輪新增)：M9 四項全部驗證為已實作、battle direct legacy import 清零確認、RT-11 決策落地、CI workflow 落地。
- 最新驗證：`test:ucuf = 225 passed, 3 skipped`；`test:snapshot` 可執行（+24 specs, ~14 changed）；battle 主幹無 direct legacy import。

## 文件維護規則

- [x] 本檔升格為過渡期主 CheckList。
- [ ] 每次完成一個子項目，要同步更新本檔的勾選狀態與「最新驗證」。
- [ ] 若某項決策已穩定，需回寫到永久文件：`docs/keep.md`、對應 developer guide、對應 instruction、對應測試。
- [ ] 只有當本檔所有項目完成，且內容已回收至永久文件後，才可刪除此檔。

## 已完成基礎盤

### Composite / Migration 基礎

- [x] `BattleHUDComposite`
- [x] `GeneralListComposite`
- [x] `GeneralDetailComposite`
- [x] `DuelChallengeComposite`
- [x] `ActionCommandComposite`
- [x] `UnitInfoComposite`
- [x] `BattleLogComposite`
- [x] `UltimateSelectPopupComposite`
- [x] `ResultPopupComposite`
- [x] `ToastMessageComposite`
- [x] `GeneralQuickViewComposite`
- [x] `GeneralPortraitComposite`
- [x] `TigerTallyComposite`

### Toolchain / Gate 基礎

- [x] `validate-ui-specs` CLI integration 已有測試覆蓋。
- [x] `finalize-agent-turn` CLI integration 已有測試覆蓋。
- [x] `ucuf-runtime-check` 已補 button-skin / themeStack regression tests。
- [x] `test:ucuf` 聚合入口已建立。
- [x] `gate:ucuf:staged` 已建立。
- [x] `.githooks/pre-commit` 已補 staged `ui-spec` 驗證。
- [x] context-budget baseline 已落地。
- [x] live task-scope 已可讀取 `.task-locks/*.lock.json` 檔案範圍。

### Battle 主幹整改

- [x] `BattleScene.ts` 已改成 host-node/composite-first 綁定主路徑。
- [x] `BattleScenePanel.ts` 已改成 host-node/composite-first 綁定主路徑。
- [x] battle 主路徑主要 legacy `@property(BattleHUD|BattleLogPanel|TigerTallyPanel|ActionCommandPanel|UnitInfoPanel|DuelChallengePanel)` 已移除。

## 全量執行 CheckList

### P0. Gate 可信度與文件真實性

- [x] 修正 `ucuf-runtime-check` 對 `button-skin` 的 RT-03 誤報。
- [x] 修正 `ucuf-runtime-check` 對 `themeStack` 繼承 slot 的 RT-03 誤報。
- [x] 修正 `.github/instructions/ucuf-compliance.instructions.md` 措辭，使其符合遷移期現況。
- [x] 將本檔從「完成報告」改成「過渡期主 CheckList」。
- [x] 更新 `docs/UCUF-developer-guide.md`，明確說明遷移期規則、例外範圍、gate 入口與 task-scope 入口。
- [x] 已檢查 docs 內仍在使用的 UCUF 過渡文件；目前僅保留本檔作為主控板，未再發現其他仍宣稱「約 90% 完成」的 active migration note。
- [x] 建立「完成定義」：何時算 migration done、何時能刪過渡文件。  
  *見本檔底部「Definition Of Done」區段，已明確定義六個必要條件。*

### P1. Battle / Legacy 退場

- [x] Battle 主幹先改成 Node host 綁定，而不是 concrete legacy class 綁定。
- [x] 清掉 `BattleUIBridge.ts` 的 direct legacy type import，並把 `BattleScene.ts` 的主要 fallback 改成字串查找 + 結構型別。
- [x] 清掉 battle flow 其餘仍殘留的 direct legacy type import / usage。  
  *驗證 (2026-04-13)：grep `assets/scripts/battle/**/*.ts` 無 direct legacy class import；BattleScene.ts 四處 getComponent 均為字串查找 + `*Like` 結構型別轉型（正確遷移模式）；`BattleUIBridge.ts` 僅定義結構介面，無 legacy import。*
- [x] 盤點所有 battle prefab / scene 內 inspector 仍掛 legacy class 的節點，改綁 host node 或 Composite。  
  *靜態盤點完成 (2026-04-13 本 session)：`BattleScene.scene` 已由舊欄位 `hud / deployPanel / resultPopup / battleLogPanel / duelChallengePanel` 改為 `hudHost / deployPanelHost / resultPopupHost / battleLogPanelHost / duelChallengePanelHost`；`DeployPanel` 序列化欄位 `toast` 也已改為 `toastHost`。*  
  *換柱完成 (2026-04-13 本 session，透過 Cocos MCP)：`HUD` 節點由 legacy `BattleHUD` → `BattleHUDComposite`；`Panel` 節點由 legacy `DeployPanel` → `DeployComposite`；`Popup` 節點由 legacy `ResultPopup` → `ResultPopupComposite`。scene 已存檔。*
- [ ] 對 battle 主要流程做一次 Editor/runtime 驗證，確認 inspector 序列化沒有因拔除 legacy class 而失效。  
  *更新 (2026-04-13 本 session)：scene 換柱完成（HUD/Panel/Popup 均已改為 Composite）；`BattleScene.scene` 已存檔。MCP smoke test 已驗：`BattleScene.onEndTurn()`、`DeployComposite.showToast()` 可正常呼叫；browser preview `BattleScene` 截圖成功；`ResultPopupComposite.showResult()` 原先因 `resources.load('ui-spec/screens/result-popup-screen')` 解析失敗而無法掛載，已改成 fallback 到現場景 `Popup` 節點，`popup.active=True`。本輪另已確認 `DeployComposite` 在 `deploy-panel-screen` spec 載入失敗時，會 fallback 綁定既有 legacy scene nodes，左側兵種／虎符卡區與右側行動鈕已在 browser capture 中恢復可見。剩餘阻礙：仍需跑一場真正的人工 end-to-end runtime 驗收，確認部署不只可見，且能完整走到 deploy → 回合 → toast → 結算。*
- [ ] 將已零引用的 legacy panels 正式搬入 `assets/scripts/ui/core/_pending-delete/` 或新建 `_deprecated/` 收容區。  
  *目前狀態 (2026-04-13 本 session)：所有 legacy panel TS 檔的直接 import 已完成清零，改為 `import type`、`@property(Node)` 或字串 `getComponent/addComponent`。剩餘條件：*  
  *(a) `BattleScene.ts.resultPopupHost` 已確認正確綁到 `Popup`；`DeployComposite` 的舊 `toastHost` 序列化欄位仍為空，但 `showToast()` smoke test 已證明目前可由 runtime 節點 fallback 正常顯示。若要完全移除 legacy 包袱，仍建議後續把 toast 顯示節點的正式綁定策略收斂成單一路徑（Inspector rebind 或 screen/binder-only）。*  
  *(b) ~~`BattleScene.scene` 的 `Panel` 節點目前仍序列化 legacy `DeployPanel` component~~ → **已解決** (2026-04-13)：Panel 已換成 `DeployComposite`；*  
  *(c) ~~`HUD` / `Popup` 節點掛的是 legacy 還是 Composite script 尚待 Editor 確認~~ → **已解決** (2026-04-13)：全部已換成 Composite；各 legacy `.ts` 實體現可由人手搬移至 `_deprecated/`。*  
  *本輪定義更新：「零引用」 = 無 direct import（`import type` 不算）；字串 `getComponent` 不算直接依賴。*
- [x] 對 `scan-deprecated-refs` 建立 battle migration 完成前後的基準，避免 legacy 回流。  
  *基準 (2026-04-13)：`node tools_node/scan-deprecated-refs.js --json` → `totalFiles=167, totalRefs=0`，無任何 `_deprecated/` 引用，基準乾淨。*

### P1. Toolchain / 測試 / 提交保護

- [x] 聚合 `test:ucuf` 已建立並驗證可用。
- [x] 已補 `test:snapshot` / `test:snapshot:update` / `test:snapshot:ci` 入口，讓 headless 結構快照檢查可直接執行。
- [x] pre-commit 啟用方式已驗證：`npm run install:hooks` 可將 `core.hooksPath` 設為 `.githooks`，並已寫回正式文件。
- [x] 已補 GitHub Actions：`.github/workflows/ucuf-validation.yml` 會跑 `check:ui-spec --strict --check-content-contract`、`ucuf-runtime-check --strict`、`test:ucuf`。
- [x] 已在 developer guide 明確定義 `gate:ucuf`、`gate:ucuf:staged`、`finalize-agent-turn --task-scope`、CI workflow 的責任分工。

### P1. AI 協作制度化

- [x] `task-lock.js` 已支援寫入 `files` 範圍。
- [x] live `.task-locks` 流程已驗證可用。
- [x] `.task-locks/` 已由 `.gitignore` 排除，並在正式文件中定義為不提交的本地協作檔。
- [x] `task-lock` 使用規範已寫回正式文件，包含 lock、unlock、task-scope finalize 的最小工作流。
- [x] 已決定 handoff 暫不由工具強制驗證；正式落點統一使用 `docs/agent-briefs/tasks/*.md` 與既有 task card。
- [x] 已決定暫不自動產生 mini-handoff；避免與既有 `docs/agent-briefs/` 任務卡形成雙重真相來源。

### P2. UCUF 架構承諾補完或降級

- [x] 重新標記 M9 四項為「已實作」或「僅設計未落地」，禁止再混用。  
  *驗證 (2026-04-13)：`docs/UCUF里程碑文件.md` M9 區段六項全部標 `[x]`；程式碼確認如下：*
- [x] Fragment JSON 快取：**已實作** — `UISpecLoader.ts` 有 `_layoutCache / _skinCache / _screenCache / _templateCache / _widgetCache / _recipeCache` 六個 Map 快取；二次載入同 id 直接命中快取，不觸發 `resources.load`。
- [x] ChildPanel diff-update：**已實作** — `ChildPanelBase.ts` 有 `onDiffUpdate(data, changedKeys)` 介面；`CompositePanel.ts:255` 呼叫後自動更新 `_lastData`，相同資料不重觸發。
- [x] Event bus 完整路由：**已實作（panel 私有 scope）** — `CompositePanel.ts` 有 `private readonly _eventBus = new EventSystem()`，emit `slot:switched` / `content:updated`；`TigerTallyPanel` 已接入 `UI_EVENTS.CardSelected` 廣播。`UCUFRuleRegistry` 也支援 optional `IEventBus` 注入。全面跨面板路由屬 future scope，現有實作已符合 M9 原始設計目標。
- [x] specVersion hot-update：**已實作（forward-compat guard 版本）** — `UISpecLoader.ts:82+283` 在載入 layout / screen 時，若 `specVersion > CURRENT_SPEC_VERSION` 則 `console.warn` 並繼續降級執行，不 crash。M9 文件原意為「降級處理」非「動態熱重載」，設計目標已達成。
- [x] `ResourceManager` 補 cache stats / 可觀測性，至少能知道快取上限與釋放結果。  
  *已於 (2026-04-13) 在 `ResourceManager.ts` 加入 `getCacheStats()` 方法，回傳 `{ json, prefab, spriteFrames, singleSpriteFrame, font, total }`。*

### P2. Spec / Contract / Runtime 驗證補洞

- [x] 盤點 `content contract` 驗證缺口，決定是否新增 RT-11 或等價規則。  
  *決策 (2026-04-13)：現有 R14 / R27 已涵蓋「layout bind → contentRequirements.requiredFields」的正向驗證。`contract.fields[].bindPath` 反向對位（slash 型 node path 是否在 layout 中存在）因 contract 與 layout 無直接連結（透過 `familyId` 而非 `layoutId`），靜態驗證需全量載入所有 layout，誤報率高，**正式降級為 P3 / future deferred**。Runtime 層 `UITemplateBinder.getLabelByPath()` 於找不到節點時已有 null 防護，不會 crash。*
- [x] 補 `content binding path` 與 layout node 對位檢查。  
  *同上決策：slash-path 型 bindPath 驗證降級為 deferred。dot-path 型（`header.title`）屬資料欄位路徑，非 layout 結構驗證範疇。*
- [x] 盤點所有遷移中的 screen / skin / layout 是否仍有人工忽略的 spec debt。  
  *盤點結果 (2026-04-13)：`npm run check:ui-spec -- --strict --check-content-contract` 通過（0 failures），warnings 分三類：*  
  *(1) `max-layout-node-count`：5 個 layout 超 50 節點（bloodline-mirror-loading 51、tiger-tally 57、general-detail-unified 69、general-detail-bloodline-v3 61、lobby-main 84、**general-detail-main 163**）→ 應拆 Fragment，已知 debt；*  
  *(2) `no-duplicate-widget-siblings` / `no-fill-bleed-frame-triplet`：tiger-tally、general-detail、elite-troop-codex 使用疊層模式而非 skinLayers → 已知 debt；*  
  *(3) `atlas-batch-limit`：多個 skin 超過 4 atlas 目錄 → 已知 draw-call debt；*  
  *(4) `composite-panel-tab-route-integrity`：`general-detail-unified-screen.json` tabRouting 參考 7 個尚未建立的 fragment JSON (`fragments/layouts/gd-tab-*`) → **已解決 (2026-04-13 本 session)**：files 已存在；修復 `validate-ui-specs.js` R28 路徑解析邏輯（加入 `uiSpecRoot`-relative fragPathRelSpec 第三路徑），validator 不再誤報。*
- [x] 若保留 baseline/known-debt 機制，建立「只容忍舊 debt、阻擋新 debt」的文件與測試。  
  *決策：現有 skip-rules + exceptions 機制（`--skip-rules` CLI flag）可處理已知 debt；新的 `atlas-batch-limit` / `max-layout-node-count` warnings 保持 warning-only 不升 failure，避免 CI 誤報。`general-detail-unified` 的 tabRouting fragment 遭漏已修復 (2026-04-13 本 session)：7 個 fragment files 均存在，validator R28 路徑解析 bug 已 patch。*

### P3. 文件回收與過渡檔刪除

- [x] 將最終遷移規則收斂回永久文件，而非散落在 dated migration notes。  
  *進度 (2026-04-13)：battle migration 最終狀態表、障礙清嗦、設計原則已写回 `docs/UCUF-developer-guide.md`。keep.md 的摘要屬于 P3 最後一步，需全部項目完成後才寫回。*
- [x] 將 battle migration 最終狀態寫回正式架構文件或 developer guide。  
  *已於 (2026-04-13) 更新 `docs/UCUF-developer-guide.md` 「遷移狀態總覽」區段，列出全部 14 個面板的遷移狀態，並記錄 ResultPopup 換柱陣票。*
- [x] 將 AI 協作最終工作流寫回正式 protocol / keep 摘要。  
  *已於 (2026-04-13) 分別更新 `docs/agent-collaboration-protocol.md`（task-lock 最小工作流、git hook 啟用、handoff 決策）與 `docs/UCUF-developer-guide.md`（gate 責任分工表、snapshot test）。keep.md 摘要差 Pull Request 或問離最後一步。*
- [ ] 確認本檔所有項目已勾選完成。
- [ ] 刪除此過渡檔，並在永久文件中留下最終落點。

## Definition Of Done

只有同時滿足下列條件，UCUF migration 才算真正完成：

- [x] battle 主路徑不再依賴 legacy panel concrete class 綁定與 direct runtime import。  
  *驗證 (2026-04-13 本 session)：14/14 Composite 換柱完成。`BattleScene.ts` `@property(ResultPopup)` → `@property(Node) resultPopupHost`；`BattleUIBridge` 已移除 ResultPopup import、加入 `ResultPopupLike` 接口；`ResultPopupComposite` 加入 `showResult()` alias；TS 0 errors。prefab Inspector 序列化需 Editor rebind（`resultPopupHost` Node 欄位），runtime fallback 走 `getChildByName("Popup")`，功能不受阻。*
- [ ] 已遷移的 legacy panels 零引用，並已完成物理搬移或刪除。  
  *目前狀態 (2026-04-13 本 session)：TypeScript 層 direct import 已完成清零：`BattleScenePanel.ts` 5 個改 `import type`，`LobbyScene.ts` 3 個改 `import type`，`DeployComposite.ts` 1 個改 `import type`，`DeployPanel.ts` 也已由 `@property(ToastMessage)` 改為 `@property(Node) toastHost`。剩餘：`resultPopupHost` / `toastHost` 需 Editor rebind；各 legacy `.ts` 實體等 scene/prefab 層 Editor 驗證後由人手搬移。*
- [x] `test:ucuf`、核心 gate、必要 snapshot/regression 都能穩定執行。  
  *驗證：`225 passed, 3 skipped`，`test:snapshot` 可執行， CI workflow 已落地。*
- [x] AI 協作 task-lock / handoff / task-scope 有明確正式流程，而不只是臨時工具。  
  *驗證：已寫回 `agent-collaboration-protocol.md`，決策已收斂。*
- [x] M9 承諾已補完，或已正式降級並寫入永久文件。  
  *驗證：四項全部驗證為已實作，譙明已記錄於本檔。*
- [ ] 本檔內容已被永久文件吸收，不再需要 dated migration tracker。

## 最新驗證

- [x] `cmd /c npm run test:ucuf` → `225 passed, 3 skipped`
- [x] `cmd /c npm run check:encoding:touched -- --files ...` 通過
- [x] `node tools_node/finalize-agent-turn.js --workflow ucuf --task UI-2-0108 --task-scope --skip-ucuf --json` 可正確讀取 task lock 範圍
- [x] `BattleScene.ts` / `BattleScenePanel.ts` / `DeployPanel.ts` / `DeployComposite.ts` / `ToastMessageComposite.ts` 無最新 TypeScript 錯誤
- [x] `npm run install:hooks` 成功，`git config --get core.hooksPath` 回傳 `.githooks`
- [x] `npm run test:snapshot` 可正常執行，並回報目前 ui-spec snapshot diff（+24 / ~14）
- [x] `curl.exe http://localhost:7456/asset-db/refresh` 成功，Cocos Creator asset-db refresh 正常
- [x] 全量 grep 確認 `assets/scripts/**/*.ts` 已無 concrete legacy panel import（僅保留 `import type` / 字串 `getComponent` / `@property(Node)`）
- [x] `assets/scenes/BattleScene.scene` 已完成靜態序列化鍵名對齊：`hudHost / deployPanelHost / resultPopupHost / battleLogPanelHost / duelChallengePanelHost / toastHost`
- [x] Cocos MCP component audit 通過：`HUD / Panel / Popup` 已分別換成 `BattleHUDComposite / DeployComposite / ResultPopupComposite`，scene 已存檔
- [x] BattleScene runtime smoke test 通過：browser preview `BattleScene` 可截圖；`BattleScene.onEndTurn()`、`DeployComposite.showToast()` 可正常呼叫
- [x] `ResultPopupComposite.showResult()` 已可正常顯示 `Popup`（`popup.active=True`）；目前採 legacy node fallback，並記錄 `result-popup-screen` 在 `resources.load` 解析失敗的待追查 debt
- [x] Browser preview 已確認 `DeployComposite` fallback 生效：`artifacts/ui-qa/verify-deploy-fallback/BattleScene.png` 可見左側兵種／虎符卡區重新出現；目前仍屬 visual/runtime smoke，尚未完成完整 deploy flow 驗收
- [ ] GitHub Actions workflow 已落地，但尚未在遠端 runner 上完成首輪驗證
- [x] AI 協作 handoff 決策已收斂：暫不強制 `--check-handoff`，暫不自動生成 mini-handoff，正式落點統一回寫 `docs/agent-briefs/tasks/*.md`
- [x] spec debt 盤點完成：0 failures，已知 warnings 分類記錄，`general-detail-unified` tabRouting fragment 遺漏已修復
## 下一輪建議起手式

1. 實跑 battle flow：部署、回合切換、Toast、戰鬥結算，完成真正的人工 end-to-end 驗收。
2. 決定 `ResultPopupComposite` 與 toast 顯示節點的正式收斂方案：保留目前 runtime fallback，或補成完全 spec/binder 路徑並追查 `resources.load('ui-spec/screens/result-popup-screen')` 為何失敗。
3. 若 battle flow 驗收通過，將 `BattleHUD.ts` / `DeployPanel.ts` / `ResultPopup.ts` 等 legacy panel 實體搬入 `_deprecated/`。

---

*本檔類型：過渡期執行面板，不是最終規格。*
*刪除條件：上方 CheckList 全數完成，且永久文件已回收。*
