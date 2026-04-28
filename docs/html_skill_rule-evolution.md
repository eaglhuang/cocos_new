<!-- doc_id: doc_other_0010 -->
# HTML Skill Rule Evolution

本檔為 append-only 規則演進紀錄，由 `tools_node/dom-to-ui-feedback.js --apply-suggestion` 寫入。

> 規則：只能 append，不可刪改既有 entry；所有 entry 均需 reviewer 與 PR 連結。
> 對應規格：`docs/html_skill_plan.md` (doc_other_0009) §36.6 / §37.1（鐵律 6）

---

## Entry 2026-04-26 — phase-2-baseline-recorded

- suggestion id: `phase-2-baseline-2026-04-26`
- reviewer: tech-director
- PR: (manual landing — pre-PR baseline)
- before: `dom-to-ui-json.js` 使用 regex 占位 HTML 解析；`--validate` 旗標只在 telemetry 標記 `passed:true`；`--sync-existing` 僅標記 `mode: sync` 未實際合併。
- after: 改用 `tools_node/lib/dom-to-ui/html-parser.js` + `draft-builder.js` 遞迴轉譯；`--validate` 以 `spawnSync` 串 `validate-ui-specs.js`；`--sync-existing` 透過 `smart-merge.js` 執行 preserve-human / html-authoritative / dry-run 三模式並輸出 `syncDelta.fieldChanges[]`。
- reason: 收斂 `docs/html_skill_plan.md` §42.3 列出的三項已知限制；對齊 §37 鐵律 7（永遠 closed-loop validate）與鐵律 2（skinLayers 優先）。
- samples: `tests/fixtures/dom-to-ui/gacha-banner.html`、`tools_node/test/dom-to-ui-self-test.js`（8/8 PASS）。
- impact: 規則本身未變更；本 entry 僅為 phase-2 落地的歷史 baseline，後續任何規則 threshold 調整仍須以 `--apply-suggestion` 個別 append。

---

## Entry 2026-04-26 — art-director-m2-visual-guards

- suggestion id: `art-director-m2-visual-guards-2026-04-26`
- reviewer: art-director
- PR: (manual landing — pre-PR baseline)
- before: M2 只能做 basic hex / rgba 辨識、`line-height` / `letter-spacing` 換算；CSS var、spacing / typography reverse lookup、資產路徑 guard 與高風險 CSS warning 仍停在 checklist。
- after: 新增 `tools_node/lib/dom-to-ui/token-registry.js`，由 runtime + handoff token 建立 color / spacing / typography reverse lookup；`draft-builder.js` 支援 CSS var 映射、spacing / typography token usage report、`font-weight -> isBold`、`db://` / 絕對路徑 / missing asset guard，以及 transform / overflow / z-index / asymmetric radius / node opacity / CSS effect 美術風險 warning。
- reason: 從美術總監角度降低 token drift、文字洗淡、bleed 裁切、層級錯位與 placeholder 資產等常見視覺瑕疵；對齊 `docs/html_skill_plan.md` §23 與 §34.4。
- samples: `tools_node/test/dom-to-ui-self-test.js` 第 9 項 M2 art token mapping + visual guard warnings（9/9 PASS）。
- impact: M2 由部分完成推進到核心完成；進階 nearest-token suggestion 與 strict fail policy 仍需後續獨立 entry。

---

## Entry 2026-04-26 — technical-director-m1m3m4m5m6-closeout

- suggestion id: 	echnical-director-closeout-2026-04-26
- reviewer: technical-director
- PR: (manual landing — pre-PR baseline)
- before: M1 / M3 / M4 / M5 / M6 仍各有未勾 checklist：缺 `data-ucuf-id` stable key、`data-ucuf-lock`、specVersion / canvas meta、composite slot report、bundle-suggestion、skin-layer-atlas-risk、strict unmapped fail、R25 / R27 / R28 自動保證、sync report artifact、suggestion accept 後 checklist 同步。
- after: `draft-builder.js` 於 layout root 自動填 `specVersion: 1` 與 `canvas` meta（可由 `<html data-canvas-*>` 提示），新增 `_ucufId` / `_lockedFields` 標記與 composite 節點收集；`smart-merge.js` 改以 `_ucufId` 為 stable key 並支援 `_lockedFields` 鎖定；新增 `lib/dom-to-ui/sidecar-emitters.js` 同時輸出 composite report、bundle suggestion、skin-layer-atlas-risk、sync report、R-guard summary；`dom-to-ui-json.js` 預設啟用四個 sidecar 並在 strict 下對 `unmapped-color` / `unmapped-css-var` / `forbidden-node-type` / `asset-path-guarded` / R-guard fail 以 exit 6 / 7 中止；`dom-to-ui-feedback.js` 新增 `--update-checklist`。
- reason: 收斂 §39 checklist 中 M1 / M3 / M4 / M5 / M6 的剩餘項，把分散的 sync 健康度與規則保證統一收進可機讀 sidecar，建立未來 CI gate 的單一信號源。
- samples: `tools_node/test/dom-to-ui-self-test.js` 10/10 PASS、`validate-ui-specs.js` layouts=34 skins=37 screens=31 recipes=5 全綠。
- impact: M1 / M3 / M4 / M5 / M6 全部進入「完成」狀態；剩餘 nearest-token suggestion、`--variant-mode`、`scaffold-ui-component.js --ucuf` 端到端、fragment runtime check 改為下一波個別 entry。

---

## Entry 2026-04-26 — accuracy-harness-baseline

- suggestion id: `accuracy-harness-baseline-2026-04-26`
- reviewer: technical-director
- PR: (manual landing — pre-PR baseline)
- before: 工具沒有量化的「重複拆解 / 等價變體 / baseline 比對」驗證，無法在規則演進時擋住回歸，也沒有量化指標餵回 telemetry。
- after: 新增 `tools_node/lib/dom-to-ui/accuracy-harness.js`（perturbation 生成、結構簽名、token 覆蓋率、warning precision/recall）、`tools_node/dom-to-ui-accuracy.js` CLI（`--baseline` / `--strict` / `--iterations`、寫入 `<screen>.accuracy.json` 與 telemetry）、`tests/fixtures/dom-to-ui/gacha-banner.accuracy-baseline.json` 首個 baseline；self-test 新增第 10 步驗證 idempotency=1 / structuralStability=1 / tokenCoverage>=0.5；`docs/html_skill_plan.md` 新增 §40 完整流程與 CI 命令。
- reason: 把「工具是否有效」從感性判斷轉成可量化 / 可入 CI 的指標；強迫工具對表面格式 perturbation 不變，並建立 baseline 凍結制度避免規則回歸。
- samples: `node tools_node/dom-to-ui-accuracy.js --input tests/fixtures/dom-to-ui/gacha-banner.html --screen-id gacha --bundle ui_gacha --baseline tests/fixtures/dom-to-ui/gacha-banner.accuracy-baseline.json --output <tmp> --strict` 通過：`idem=1 stab=1.000 tokenCov=0.500`。
- impact: 工具進入「自我度量 + 回歸保護」階段；後續任何規則變動都必須先過 accuracy verdict=pass，且能透過 `--detect-drift` + `--update-checklist` 把演進事件回寫 evolution log。

---

## Entry 2026-04-26 — logic-motion-art-review-plan

- suggestion id: `logic-motion-art-review-plan-2026-04-26`
- reviewer: art-director / technical-director
- PR: (manual planning entry — pre-implementation)
- before: HTML 覆蓋既有 Cocos UI 的流程只保證 layout / skin / validate / accuracy，不保證已接好的 button handler、route、bind path、panel API、child panel route 或 lazySlot 不被洗掉；HTML 中的簡單開窗、tab、modal close、transition / keyframes 也尚未被轉成 Cocos interaction / motion draft；美術複盤缺少 motion、state-layer、screenshot zone confidence 等感知 gate。
- after: `docs/html_skill_plan.md` 新增 M9 Existing UI Logic Guard、M10 Interaction & Motion Translation、M11 Art Director Visual Regression；新增 §41 定義 `<screen>.logic-inventory.json` / `<screen>.logic-guard.json`、exit 9、Error Log / telemetry / evolution log 串接；新增 §42 定義 `<screen>.interaction.json` / `<screen>.motion.json`、exit 10、button 開窗 / tab / modal / transition / keyframes 翻譯規則；新增 §43 以美術總監角度複盤 M0-M8，要求 screenshot zone confidence、motion token、state-layer review、正式 UI tokenCoverage 門檻分級。
- reason: 覆蓋既有 UI 的真正風險不是 JSON 無效，而是「畫面看似更新成功，但既有功能或動態感消失」。新規則把功能驗證、互動翻譯、動畫翻譯與美術感知驗收納入同一條 closed-loop。
- samples: 規劃樣本包含 `general-detail-unified` tab switch、`lobby-mission-detail-dialog` button open panel、`gacha-banner` CTA transition；正式 fixture 需於 M9 / M10 實作時補入 self-test。
- impact: 目前為文件與 checklist 回寫，尚未宣稱工具已落地；後續實作必須以 exit 9 / exit 10、logic / interaction / motion sidecar、Error Log 摘要與 `docs/html_skill_rule-evolution.md` append-only entry 作為驗收條件。
- errata: 前一筆 `technical-director-m1m3m4m5m6-closeout` 的 `suggestion id` 行因 PowerShell escape 顯示成缺少開頭字元；canonical id 應為 `technical-director-closeout-2026-04-26`。依本檔 append-only 規則，保留原 entry 並以本 errata 補正。

---

## Entry 2026-04-26 — technical-director-checklist-closeout

- suggestion id: `technical-director-checklist-closeout-2026-04-26`
- reviewer: technical-director
- PR: (manual landing — pre-PR baseline)
- before: `docs/html_skill_plan.md` §39 仍有 27 個未完成 checklist，集中於 `--variant-mode gacha-3pool`、`scaffold-ui-component.js --ucuf` gate、fragment/tabRouting patch、runtimeGate、更多 accuracy baseline、M9 logic guard、M10 interaction/motion translation、M11 visual regression。
- after: 新增 `tools_node/dom-to-ui-logic-guard.js`、`logic-guard.js`、`interaction-translator.js`、`motion-translator.js`、`visual-review.js`；`draft-builder.js` 會輸出 interaction / motion draft；`dom-to-ui-json.js` 會輸出 `.interaction.json`、`.motion.json`、`.fragment-routes.json`、`.logic-inventory.json`、`.logic-guard.json`、`.visual-review.json`，並支援 `--variant-mode gacha-3pool`、exit 9 / exit 10；`performance.js` 補 runtimeGate nodeCount / maxDepth；`dom-to-ui-accuracy.js` 補 visual metrics / logic guard linkage / profile tokenCoverage；`scaffold-ui-component.js --ucuf --check-ucuf` 可乾跑驗證；新增 lobby / general-detail / battle / interaction-motion fixtures；self-test 擴為 17/17 PASS。
- reason: 從技術總監角度把「文件規劃」推進到可執行 gate，避免 HTML 覆蓋既有 Cocos UI 時只保證 JSON 合法，卻丟失功能、互動、動畫或美術感知品質。
- samples: `node tools_node/test/dom-to-ui-self-test.js` 17/17 PASS；`node tools_node/validate-ui-specs.js` 全綠；`node tools_node/dom-to-ui-accuracy.js --input tests/fixtures/dom-to-ui/gacha-banner.html --screen-id gacha-banner --bundle ui_gacha --baseline tests/fixtures/dom-to-ui/gacha-banner.accuracy-baseline.json --output artifacts/dom-to-ui-accuracy/gacha-banner.json --iterations 5 --strict` PASS。
- impact: `docs/html_skill_plan.md` §39 checklist 清零，M9 / M10 / M11 狀態改為完成；後續不足改列 §34.3 / §44 流程風險與 M12 類體驗優化，不再作為 M0-M11 阻塞項。

---

## Entry 2026-04-26 — backup-before-overwrite

- suggestion id: `backup-before-overwrite-2026-04-26`
- reviewer: technical-director
- PR: (manual landing — pre-PR baseline)
- before: `dom-to-ui-json.js` 在覆蓋既有 `layouts/` / `skins/` / `screens/` JSON 前沒有任何備份機制；一旦覆蓋後發現 UI 被弄壞，只能靠 git 回退，未提交的工作有遺失風險。
- after: 新增 `tools_node/lib/dom-to-ui/backup.js`（`createBackup` helper）；`dom-to-ui-json.js` 在第一個 `writeJson` 前呼叫 `createBackup`，把所有即將被覆蓋的既有檔案（layout、skin 及全部 sidecar）備份到 `artifacts/dom-to-ui-backups/<YYYY-MM-DD_HH-mm-ss>_<screenId>/`；新增 `--no-backup` / `--backup-dir` CLI 旗標；`dom-to-ui-self-test.js` self-test 步驟 14 驗收備份功能（建立 + `--no-backup` 抑制）；`docs/html_skill_plan.md` 新增 §45 完整規格。
- reason: 新舊 UI 覆蓋屬高風險操作，備份機制是安全網；不依賴 git，開發者可立刻從備份目錄手動還原，降低不可逆操作的心理成本。
- samples: `node tools_node/test/dom-to-ui-self-test.js` ALL PASS（含步驟 14 backup 驗收）；`node tools_node/lib/dom-to-ui/backup.js` 可 require 並直接呼叫 `createBackup`；`--no-backup` 確認不建立任何目錄。
- impact: `dom-to-ui-json.js` 預設啟用備份；`docs/html_skill_plan.md` §45 checklist 全部 `[x]`；覆蓋 UI 的安全性顯著提升。

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-background-size-88c3a87b

- suggestion id: `fidelity-gap-battle-hud-fullpage-background-size-88c3a87b`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `header.topbar[0]` 的 `background-size: cover, auto` 沒有對映（occurrences=331）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.851，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System 2\ui_kits\battle\index_v3.html` 對應節點 `header.topbar[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-battle-hud-fullpage-background-size-88c3a87b` 接受

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-background-position-53b78df1

- suggestion id: `fidelity-gap-battle-hud-fullpage-background-position-53b78df1`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `header.topbar[0]` 的 `background-position: 50% 50%, 0% 0%` 沒有對映（occurrences=331）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.851，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System 2\ui_kits\battle\index_v3.html` 對應節點 `header.topbar[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-battle-hud-fullpage-background-position-53b78df1` 接受

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-background-repeat-e1e05a59

- suggestion id: `fidelity-gap-battle-hud-fullpage-background-repeat-e1e05a59`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `header.topbar[0]` 的 `background-repeat: no-repeat, repeat` 沒有對映（occurrences=331）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.851，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System 2\ui_kits\battle\index_v3.html` 對應節點 `header.topbar[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-battle-hud-fullpage-background-repeat-e1e05a59` 接受

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-text-decoration-line-71f8e797

- suggestion id: `fidelity-gap-battle-hud-fullpage-text-decoration-line-71f8e797`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `header.topbar[0]` 的 `text-decoration-line: none` 沒有對映（occurrences=331）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.851，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System 2\ui_kits\battle\index_v3.html` 對應節點 `header.topbar[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-battle-hud-fullpage-text-decoration-line-71f8e797` 接受

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-content-dd29ecf5

- suggestion id: `fidelity-gap-battle-hud-fullpage-content-dd29ecf5`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `aside.tally-col[1]>div.tcard.sel[0]::after` 的 `content: ""` 沒有對映（occurrences=8）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.851，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System 2\ui_kits\battle\index_v3.html` 對應節點 `aside.tally-col[1]>div.tcard.sel[0]::after`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-battle-hud-fullpage-content-dd29ecf5` 接受

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-ee8675a6

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-ee8675a6`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 85.1%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-a8a1a36c

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-a8a1a36c`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 85.1%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-1a71ab25

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-1a71ab25`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 85.3%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-fonts-missing-b904f1c8

- suggestion id: `fidelity-gap-battle-hud-fullpage-fonts-missing-b904f1c8`
- reviewer: (pending — auto-emitted by font-audit)
- before: source HTML 引用以下字型，但 headless Chrome 沒有載入：`NotoSansTC`, `Newsreader`, `Manrope`
- after: 使用者選擇以下任一方式：
  1. **安裝原字型**（最佳方案）：把對應字型檔放進系統字型目錄，puppeteer 重啟後即可命中。
  2. **強制 fallback**：dom-to-ui-compare 已自動把缺失字型 alias 到 `Microsoft JhengHei`/`Noto Sans CJK` 等本機字型，確保 source 與 preview 落在同一字型 stack。
- reason: 字型缺失會造成 CJK 字距 sub-pixel drift，pixel-diff coverage 上不去；目前已自動同步 fallback。
- samples: `C:\Users\User\3KLife\Design System 2\ui_kits\battle\index_v3.html`
- impact: pending — 若想要極致還原請選方案 1，否則 reviewer 確認方案 2 即可關閉

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-980cd528

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-980cd528`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 69.3%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-c1e65f1a

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-c1e65f1a`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 86.4%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-c9c584c1

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-c9c584c1`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 86.6%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-c6a08385

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-c6a08385`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 86.6%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-b1ff71e7

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-b1ff71e7`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 86.3%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-cad52610

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-cad52610`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 69.3%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-4e049825

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-4e049825`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 86.4%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-619f8d44

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-619f8d44`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 86.2%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-battle-hud-fullpage-low-coverage-03ddee70

- suggestion id: `fidelity-gap-battle-hud-fullpage-low-coverage-03ddee70`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 88.1%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 `fidelity-gap-battle-hud-fullpage-*` entry
- reason: §50 pixel-diff 報告
- samples: `C:\Users\User\3KLife\artifacts\skill-test-html-to-ucuf\battle-hud-fullpage.compare.pixel-diff.heatmap.png`
- impact: pending — 須先處理高占比的 dropped property

---

## Entry 2026-04-26 — fidelity-gap-character-detail-fullpage-background-size-0d612c12

- suggestion id: `fidelity-gap-character-detail-fullpage-background-size-0d612c12`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-size: auto` 沒有對映（occurrences=184）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.958，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-character-detail-fullpage-background-size-0d612c12` 接受

---

## Entry 2026-04-26 — fidelity-gap-character-detail-fullpage-background-position-ed1dc494

- suggestion id: `fidelity-gap-character-detail-fullpage-background-position-ed1dc494`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-position: 0% 0%` 沒有對映（occurrences=184）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.958，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-character-detail-fullpage-background-position-ed1dc494` 接受

---

## Entry 2026-04-26 — fidelity-gap-character-detail-fullpage-background-repeat-c0ac4842

- suggestion id: `fidelity-gap-character-detail-fullpage-background-repeat-c0ac4842`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-repeat: repeat` 沒有對映（occurrences=184）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.958，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-character-detail-fullpage-background-repeat-c0ac4842` 接受

---

## Entry 2026-04-26 — fidelity-gap-character-detail-fullpage-text-decoration-line-71f8e797

- suggestion id: `fidelity-gap-character-detail-fullpage-text-decoration-line-71f8e797`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `text-decoration-line: none` 沒有對映（occurrences=184）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.958，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-character-detail-fullpage-text-decoration-line-71f8e797` 接受

---

## Entry 2026-04-26 — fidelity-gap-character-detail-fullpage-content-dd29ecf5

- suggestion id: `fidelity-gap-character-detail-fullpage-content-dd29ecf5`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]>div.portrait-bg[0]::after` 的 `content: ""` 沒有對映（occurrences=13）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.958，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]>div.portrait-bg[0]::after`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-character-detail-fullpage-content-dd29ecf5` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-overview-m27-background-size-0d612c12

- suggestion id: `fidelity-gap-tab-overview-m27-background-size-0d612c12`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-size: auto` 沒有對映（occurrences=184）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.959，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-overview-m27-background-size-0d612c12` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-overview-m27-background-position-ed1dc494

- suggestion id: `fidelity-gap-tab-overview-m27-background-position-ed1dc494`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-position: 0% 0%` 沒有對映（occurrences=184）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.959，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-overview-m27-background-position-ed1dc494` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-overview-m27-background-repeat-c0ac4842

- suggestion id: `fidelity-gap-tab-overview-m27-background-repeat-c0ac4842`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-repeat: repeat` 沒有對映（occurrences=184）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.959，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-overview-m27-background-repeat-c0ac4842` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-overview-m27-text-decoration-line-71f8e797

- suggestion id: `fidelity-gap-tab-overview-m27-text-decoration-line-71f8e797`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `text-decoration-line: none` 沒有對映（occurrences=184）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.959，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-overview-m27-text-decoration-line-71f8e797` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-overview-m27-content-dd29ecf5

- suggestion id: `fidelity-gap-tab-overview-m27-content-dd29ecf5`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]>div.portrait-bg[0]::after` 的 `content: ""` 沒有對映（occurrences=13）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.959，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]>div.portrait-bg[0]::after`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-overview-m27-content-dd29ecf5` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-stats-m27-background-size-0d612c12

- suggestion id: `fidelity-gap-tab-stats-m27-background-size-0d612c12`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-size: auto` 沒有對映（occurrences=218）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.972，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-stats-m27-background-size-0d612c12` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-stats-m27-background-position-ed1dc494

- suggestion id: `fidelity-gap-tab-stats-m27-background-position-ed1dc494`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-position: 0% 0%` 沒有對映（occurrences=218）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.972，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-stats-m27-background-position-ed1dc494` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-stats-m27-background-repeat-c0ac4842

- suggestion id: `fidelity-gap-tab-stats-m27-background-repeat-c0ac4842`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-repeat: repeat` 沒有對映（occurrences=218）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.972，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-stats-m27-background-repeat-c0ac4842` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-stats-m27-text-decoration-line-71f8e797

- suggestion id: `fidelity-gap-tab-stats-m27-text-decoration-line-71f8e797`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `text-decoration-line: none` 沒有對映（occurrences=218）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.972，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-stats-m27-text-decoration-line-71f8e797` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-stats-m27-content-dd29ecf5

- suggestion id: `fidelity-gap-tab-stats-m27-content-dd29ecf5`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]>div.portrait-bg[0]::after` 的 `content: ""` 沒有對映（occurrences=13）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.972，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]>div.portrait-bg[0]::after`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-stats-m27-content-dd29ecf5` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-equip-m27-background-size-0d612c12

- suggestion id: `fidelity-gap-tab-equip-m27-background-size-0d612c12`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-size: auto` 沒有對映（occurrences=141）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.976，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-equip-m27-background-size-0d612c12` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-equip-m27-background-position-ed1dc494

- suggestion id: `fidelity-gap-tab-equip-m27-background-position-ed1dc494`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-position: 0% 0%` 沒有對映（occurrences=141）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.976，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-equip-m27-background-position-ed1dc494` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-equip-m27-background-repeat-c0ac4842

- suggestion id: `fidelity-gap-tab-equip-m27-background-repeat-c0ac4842`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-repeat: repeat` 沒有對映（occurrences=141）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.976，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-equip-m27-background-repeat-c0ac4842` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-equip-m27-text-decoration-line-71f8e797

- suggestion id: `fidelity-gap-tab-equip-m27-text-decoration-line-71f8e797`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `text-decoration-line: none` 沒有對映（occurrences=141）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.976，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-equip-m27-text-decoration-line-71f8e797` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-equip-m27-content-dd29ecf5

- suggestion id: `fidelity-gap-tab-equip-m27-content-dd29ecf5`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]>div.portrait-bg[0]::after` 的 `content: ""` 沒有對映（occurrences=13）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.976，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]>div.portrait-bg[0]::after`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-equip-m27-content-dd29ecf5` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-tactics-m27-background-size-0d612c12

- suggestion id: `fidelity-gap-tab-tactics-m27-background-size-0d612c12`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-size: auto` 沒有對映（occurrences=153）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.968，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-tactics-m27-background-size-0d612c12` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-tactics-m27-background-position-ed1dc494

- suggestion id: `fidelity-gap-tab-tactics-m27-background-position-ed1dc494`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-position: 0% 0%` 沒有對映（occurrences=153）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.968，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-tactics-m27-background-position-ed1dc494` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-tactics-m27-background-repeat-c0ac4842

- suggestion id: `fidelity-gap-tab-tactics-m27-background-repeat-c0ac4842`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `background-repeat: repeat` 沒有對映（occurrences=153）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.968，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-tactics-m27-background-repeat-c0ac4842` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-tactics-m27-text-decoration-line-71f8e797

- suggestion id: `fidelity-gap-tab-tactics-m27-text-decoration-line-71f8e797`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]` 的 `text-decoration-line: none` 沒有對映（occurrences=153）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.968，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-tactics-m27-text-decoration-line-71f8e797` 接受

---

## Entry 2026-04-26 — fidelity-gap-tab-tactics-m27-content-dd29ecf5

- suggestion id: `fidelity-gap-tab-tactics-m27-content-dd29ecf5`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 `div#stage.stage[0]>div.portrait-bg[0]::after` 的 `content: ""` 沒有對映（occurrences=13）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=0.968，目標 ≥0.95
- samples: `C:\Users\User\3KLife\Design System\design_handoff\character\index.html` 對應節點 `div#stage.stage[0]>div.portrait-bg[0]::after`
- impact: pending — 等待 reviewer 透過 `dom-to-ui-feedback.js --apply-suggestion fidelity-gap-tab-tactics-m27-content-dd29ecf5` 接受
