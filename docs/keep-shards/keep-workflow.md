<!-- doc_id: doc_index_0009 -->
# Keep Consensus — Workflow（§3–§6 · §13）

> 這是 `keep.md` (doc_index_0011) 的「Workflow（§3–§6 · §13）」分片。完整索引見 `docs/keep.md (doc_index_0011)` (doc_index_0011)。

## 3. Cocos 工作流

- 正式建置與資產流程仍由 Cocos Creator Editor 管理，不以 npm script 取代。
- Editor 入口以 `http://localhost:7456` 為主。
- asset refresh 可用：

```bash
curl.exe http://localhost:7456/asset-db/refresh
```

- 不手改：
  - `library/`
  - `temp/tsconfig.cocos.json`
  - `profiles/v2/`
  - `settings/v2/`
  - `.meta`

### 3.2 日誌規範（UCUFLogger）（2026-04-14）

- **禁止在 `assets/scripts/` 新增裸 `console.log/warn/error`**；一律使用 `UCUFLogger`。
- 路徑：`assets/scripts/ui/core/UCUFLogger.ts`
- API：
  ```ts
  import { UCUFLogger, LogCategory, LogLevel } from '../core/UCUFLogger';
  UCUFLogger.debug(LogCategory.DRAG, '[MyComponent] event', payload);
  UCUFLogger.info(LogCategory.LIFECYCLE, '[MyComponent] mounted');
  ```
- 現有 `LogCategory`：`LIFECYCLE` / `SKIN` / `DATA` / `PERFORMANCE` / `RULE` / `DRAG`
  - 需要新分類時直接補 `enum` 值，不要另建 log 模組。
- Runtime 開關（Browser Console）：
  - `__ucuf_debug()` → 全開 DEBUG
  - `__ucuf_quiet()` → 靜音（僅 ERROR）
  - `__ucuf_level(n)` → 0=DEBUG / 1=INFO / 2=WARN / 3=ERROR
- Unity 對照：`Debug.Log` + `Conditional("DEBUG")` + 自訂 namespace logger 的組合。
- 若任務需要特化 debug helper（如 `DeployDragDebug.ts`），實作必須委派至 `UCUFLogger`，不得自建獨立 log toggle。

### 3.3 Fail-Fast / Fallback 準則（2026-04-14）

- **開發期、Editor、Preview、QA、內部測試路徑預設採 fail-fast，不得輕易補 fallback。**
- 若核心元件、必要節點、必要 spec、必要資產、必要組件缺失，**優先 `throw` / `Error log` / 中止流程**，讓問題第一時間暴露；卡住可以接受，靜默降級不可接受。
- **禁止用 fallback 掩蓋場景配置錯誤、Prefab 綁定錯誤、spec 缺漏、資產遺失、組件未掛載** 這類應立即修正的嚴重問題。
- `warn + fallback` 只適用於以下情況：
  - 正式上線後的 runtime 韌性保護
  - 已明確標記為 release-only guard 的防護邏輯
  - keep 或正式規格已明文批准的相容層
- 若真的需要 fallback，必須同時滿足：
  - 程式註解寫明「為何不能 fail-fast」
  - 記錄 owner / 後續移除條件 / 對應任務卡
  - log 等級不得低於 `warn`
- 預設判斷原則：**如果 fallback 會讓真正的資料/場景/組件錯誤延後暴露，就不應該存在。**
- Unity 對照：開發期寧可讓 `MissingReferenceException` / `NullReferenceException` 直接爆出，也不要先塞自動補件邏輯把壞配置掩蓋掉。
- **根因優先修復**：除非使用者明示批准，debug 不以「刪功能 / 關特效 / 降級視覺」作為預設解法；應優先追 lifecycle、資料流、資產契約與初始化時序的根因。若只能先止血，必須在註解 / 任務卡 / handoff 中標記為短期 workaround，且保留根因修復 follow-up。
- **Transient FX / Callback 生命週期**：任何綁在暫態節點上的 tween、schedule、async callback，都必須在 `rebuild`、換場、`onDestroy` 前顯式 `stop + dispose`。若仍發現失效 node，應記 `UCUFLogger.error` 並安全中止該 FX，不得讓 Preview / runtime 直接崩潰。

### 3.1 Preview Hub Workflow（2026-04-08）

- `LoadingScene.ts` 是正式 preview hub，screen-driven smoke route 優先走這裡，不再各畫面各自發明 preview 入口。
- 同一個 `previewTarget` 若需要多個子狀態，統一使用 `previewVariant`（query / localStorage / capture target 都可注入），不要再為相近狀態複製多份 screen JSON。
- `Gacha` 已落地三個 variant：`hero`、`support`、`limited`。
- `tools_node/capture-ui-screens.js` 若要做 variant smoke，優先新增顯式 target，例如 `GachaHero` / `GachaSupport` / `GachaLimited`，讓 QA 不必手改 localStorage。
- preview 文本與 rarity dock 的共用套用邏輯，一律走 `UIPreviewStateApplicator`；`LoadingScene` 只負責選 target、載入 state、呼叫 applicator。

---

## 4. 編碼防災

- 所有文字檔必須維持 `UTF-8 without BOM`。
- 高風險副檔名：
  - `.md`
  - `.json`
  - `.ts`
  - `.js`
  - `.ps1`
- 禁止把 `Set-Content -Encoding UTF8` 當成安全寫檔方式。
- 也避免直接用 `Out-File` 重寫重要文字檔。
- 修改高風險文字檔後，立刻跑：

```bash
node tools_node/check-encoding-touched.js --files <file...>
```

- 高風險檔修改前可先跑：

```bash
npm run prepare:high-risk-edit -- <file>
```

- `docs/keep.md (doc_index_0011)` (doc_index_0011) 本身是高風險檔；若再出現亂碼，優先用「重建乾淨 UTF-8 文本」修復，不做猜字修補。

---

## 5. 任務卡 / Agent 協作

### 任務卡原則

- 正式工作原則上先有任務卡，再進入實作、重構、正式 QA 或批次文件整理。
- `docs/ui-quality-todo.json` 是 UI 任務狀態的單一真相來源。
- 若工作範圍擴大、衍生 blocker 或新子題，先更新 `related / depends / notes`，必要時補開新卡。

### 鎖卡規則

- 開工先鎖卡，再做事。
- 鎖卡至少要補：
  - `status: in-progress`
  - `started_at`
  - `started_by_agent`
  - `notes` 第一行寫明誰在何時開始、先做什麼
- 若只是閱讀或查資料，不應鎖卡。

### 交接規則

- 任務卡被某個 Agent 鎖定後，其他 Agent 不重複實作同一張卡。
- 若要接手，先在卡上補交接說明。
- 若已鎖卡但暫停，必須補上目前狀態、阻塞與下一步建議。

### Notes 格式

```text
YYYY-MM-DD | 狀態: in-progress | 處理: <本輪內容> | 驗證: <已做驗證> | 阻塞: <若無則寫無>
```

### 分工共識

- Agent1 主要偏向：
  - runtime
  - preview host
  - UI contract
  - tooling
  - 重構
- Agent2 主要偏向：
  - QA
  - artifact
  - compare board
  - refinement 追蹤
  - screen-context 驗證

### 撞檔規則

- 多個 Agent 不同時修改同一個高風險檔。
- 高風險檔包含：
  - `docs/keep.md (doc_index_0011)` (doc_index_0011)
  - `UIPreviewBuilder.ts`
  - 大型中文 Markdown
  - 核心 JSON 契約檔

---

## 6. Git 規則

- 不做破壞性 git 操作。
- 不覆蓋不是自己做的變更。
- commit message 格式：

```text
[bug|feat|chore] 主題: 說明 [AgentX]
```

---

## 13. QA / 驗證

- 先走 preview / capture / contract 驗證，不靠肉眼口頭比對。
- 收工前至少要能跑：

```bash
node tools_node/validate-ui-specs.js
```

- touched-files 編碼檢查：

```bash
node tools_node/check-encoding-touched.js --files <file...>
```

- 完整驗收：

```bash
node tools_node/run-acceptance.js
```

---
- **2026-04-13 討論來源全量整併里程碑**：歷史 112 份討論文件已全數完成深度拆解與共識回寫（Strategy A）。發現 17 項機制 Gap 與 9 個新 MCQ 已全數結案並同步至各規格書。後續新增討論文件必須立即執行 `consolidation-doubt-mcq.js` 流程。
