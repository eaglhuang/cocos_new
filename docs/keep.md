# Keep Consensus

最後更新: 2026-03-31

本文件是目前專案的最高執行共識。AI、Agent 與人工協作者在開始任何工作前，都必須先閱讀本檔，再依本檔執行。

## 1. 專案現況

- 本專案已進入正式量產階段，不再以 Demo 階段規則為主。
- 專案主軸為 Cocos Creator 3.8.8 UI 與遊戲內容量產、驗收、重構與持續擴充。
- 目前工作模式以資料驅動、可量產、可驗證、可交接為優先。

## 2. 最高原則

- `docs/keep.md` 是最高共識文件；若其他文件與本檔衝突，以本檔為準。
- `docs/ui-quality-todo.json` 是 UI 任務狀態的單一真相來源；摘要文件若與 manifest 不一致，必須先修正摘要。
- 所有流程都以「可重跑、可驗證、可回救」為原則，不接受只靠口頭共識。
- 新技術決策一旦穩定，必須同步補回本檔。

## 3. Cocos 與建置規則

- 專案是 Cocos Creator IDE 驅動，不依賴 npm script 進行正式建置。
- Cocos Creator Editor 預設入口為 `http://localhost:7456`。
- 可用 `curl.exe http://localhost:7456/asset-db/refresh` 觸發 refresh。
- 不手動編輯下列內容：
  - `library/`
  - `temp/tsconfig.cocos.json`
  - `profiles/v2/`
  - `settings/v2/`
  - 各類 `.meta`

Unity 對照：這相當於不要手動改 Unity 的 `Library/` 與 editor 產生檔，避免資產資料庫失真。

## 4. UI 架構共識

- UI 採三層 JSON 契約：
  - `screens`
  - `layouts`
  - `skins`
- 正式 QA 與 Preview 必須建立在真實 screen-driven preview host 上，不能拿 legacy 手刻場景假裝等價。
- D 階段 QA 只能驗真實 preview 流程；若 preview host、screen contract 或 capture tooling 未完成，必須誠實標示 blocker。
- 新增或調整 UI 能力時，優先維持資料驅動，不把大量視覺規則硬寫死在單一元件中。

Unity 對照：`screen/layout/skin` 可以理解為 Prefab 組裝規則、版面設定與視覺皮膚的分層，不應全部塞進一支大 `MonoBehaviour`。

## 5. 任務與 Agent 協作規則

- 任務卡與追蹤文件必須同步維護。
- 正式工作原則上先有任務卡，再開始實作、重構、批次文件整理或正式 QA。
- 拿到任務卡準備開始做時，第一步必須先鎖定任務卡，不可先做再補記錄。
- 標準鎖定動作：
  - 任務卡 frontmatter 將 `status` 更新為 `in-progress`
  - 補上 `started_at`
  - 補上 `started_by_agent`
  - `notes` 第一行寫明「哪個 Agent、何時開始、目前先處理什麼」
- 任務卡一旦被鎖定，其他 Agent 不可重複執行同一張卡；若需要接手，必須先等原 Agent 釋放或在卡上明確交接。
- 若只是短暫查看，不打算實作，不應鎖卡；若已鎖卡但暫停，必須在 `notes` 補上阻塞或交接說明。
- 若工作範圍擴大、出現新 blocker、或衍生新的子問題，必須先補開新卡或更新原卡 `related / depends / notes`，不可默默混在同一張卡內。
- bug 修復可視情況不先開卡，但仍應以最小可追蹤單位處理，commit 必須寫清楚 bug 內容、修法與 Agent 標籤。
- `notes` 內容應使用固定結構，至少包含：日期、狀態、驗證、變更、阻塞。
- Agent1 主要負責 runtime、preview host、UI contract、tooling、重構。
- Agent2 主要負責 QA、artifact、比對紀錄、阻塞盤點與追蹤收斂。
- 若發現 blocker 屬於他人責任範圍，需開卡或更新狀態，不可假裝完成。
- 多位 Agent 不應同時修改同一個高風險檔；若撞檔，應等待、拆分任務，或延到下一輪提交。

## 6. Git 與提交規則

- 所有重要改動都要透過 git 保底。
- commit message 格式固定為：

```text
[bug|feat|chore] 任務卡號 功能描述 [AgentX]
```

- 提交前必須通過 pre-commit 檢查。
- 正式 commit 必須能對回單一卡號、單一主題批次，或單一 bug 修復單位；若沒有任務卡，原則上不做正式功能 commit，但 bug 修復可以例外。
- 建議主題批次：
  - `infra / repo hygiene`
  - `tooling`
  - `runtime / contract`
  - `docs / tracking`
  - `qa artifact`
- bug commit 建議格式：

```text
[bug][系統代碼] Bug描述 : 修改描述 [AgentX]
```

- `Bug描述` 要說明發生了什麼問題，`修改描述` 要說明大概用了什麼方法。
- 發生災難時，優先從 git 歷史與乾淨 blob 回救，不靠人工猜測補字。

## 7. UTF-8 與編碼防災規則

- 專案文字檔統一使用 UTF-8。
- `.ts`、`.js`、`.json`、`.md`、`.ps1` 都受 UTF-8 規則約束。
- `tools_node/check-encoding-integrity.js` 預設掃描 repo 內 git 追蹤的專案文字檔。
- Agent 每次修改高風險文字檔後，必須先跑一次 touched-files 快檢。多人協作時優先只檢查自己剛改的檔案：

```bash
npm run check:encoding:touched -- --files <file...>
```

- 若要檢查整個目前 dirty working tree，再用：

```bash
npm run check:encoding:touched
```

- Agent 準備結束本輪工作、交接或提交前，必須至少再跑一次與本輪輸出對應的 touched 檢查。
- `pre-commit` 仍維持 staged-files 檢查，作為最後硬保底，不可只依賴最後一次手動檢查。
- pre-commit 與 acceptance 至少要攔下：
  - replacement character `U+FFFD`
  - 非預期 BOM
  - mojibake 特徵
  - 高風險檔非 ASCII 基線異常
- 不可使用會經過主控台碼頁的危險流程去覆寫中文檔，例如：
  - `Set-Content`
  - `Out-File`
  - 把 `git show` 結果先轉成 PowerShell 字串再寫回
- 回救中文檔時，必須用二進位安全方式或明確指定 UTF-8 的流程。
- 高風險中文檔編輯前，必須先執行：

```bash
npm run prepare:high-risk-edit -- <file>
```

Unity 對照：這和避免用錯工具改壞 Unity YAML / Prefab 很像，問題常常不是格式錯，而是內容先被錯誤編碼讀壞再存回。

## 8. 高風險檔與拆分規則

- 含大量中文 template string、中文 log、長段中文註解的程式檔，視為高風險檔。
- 高風險檔採單寫者規則，同一時間只允許一位 Agent 或一位開發者主寫。
- 任何代碼檔只要超過 400 行，就必須列入重構拆分清單，不可當作常態繼續膨脹。
- 拆分優先方向：
  - orchestration
  - text catalog
  - diagnostics
  - layout builder
  - style builder
  - node factory

Unity 對照：這相當於把過肥的 `MonoBehaviour` 拆成協調器、資料、視覺組裝與診斷模組，降低 merge conflict 與災難半徑。

## 9. 驗證規則

- 只要動到 runtime、tooling、contract、skin、驗收流程，就要補跑對應驗證。
- 基本驗證指令：

```bash
npm run check:encoding
node tools_node/run-acceptance.js
```

- 若有 preview/capture 任務，需補跑實際 capture 驗證。
- 若無法驗證，必須明講原因與阻塞點，不可省略。

## 10. 文件維護規則

- 文件應短、準、可執行，避免保留過時背景敘事。
- 已失效的 Demo 階段資訊、錯誤歷史狀態、重複規則，應定期清掉。
- 若新文件只是重複本檔規則，應改為引用本檔，而不是複製一份舊版內容。

## 11. 當前執行提醒

- 現階段優先目標是支撐 UI 正式量產、驗收自動化、Preview 穩定化與大檔拆分。
- `UIPreviewBuilder.ts` 類型的大檔不再允許持續堆疊責任，後續應分批拆出 text、layout、style、diagnostics 等模組。
- Agent 在新對話開始時，需先摘要本檔目前有效共識，再開始動作。
