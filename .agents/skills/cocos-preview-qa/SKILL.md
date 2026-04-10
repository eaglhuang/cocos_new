---
name: cocos-preview-qa
description: 'BROWSER REVIEW QA SKILL — Use the built-in browser/headless browser (puppeteer-core) to open a browser-runnable Cocos preview, switch preview targets, capture screenshots, and compare them with reference images. USE FOR: screen-driven QA only when the user has already prepared a Browser Review environment that can run in the browser (`http://localhost:7456`, LoadingScene/preview host/preview target wiring ready). DO NOT USE FOR: current Cocos Editor window screenshots, Editor Preview capture, compile errors, or pure log analysis. If the Browser Review environment is not ready, stop and remind the user to prepare it first.'
argument-hint: 'Specify target screen and task id only after confirming the Browser Review environment is ready. Example: "target=LobbyMain taskId=UI-1-0014".'
---

# Cocos Preview QA（Browser Review 自動截圖 + 比對）

## 先判斷是不是該用這個 skill

只有在下列條件都成立時，才使用 `cocos-preview-qa`：
- 使用者要的是 **瀏覽器裡的遊戲畫面 QA / 截圖比對**，不是 Cocos Editor 視窗截圖
- 使用者已準備好 **Browser Review 環境**，至少包含：`http://localhost:7456` 可開、可進入 LoadingScene/Preview Host、可切換 preview target
- Agent 需要自動切換 target、連續截多張圖、對照參考圖做 QA

若任何一項不成立，先停止並提醒使用者準備環境；不要退而改用 `cocos-screenshot` 假裝完成同一件事。

## 與 `cocos-screenshot` 的最大差別

- `cocos-preview-qa`: 截的是 **瀏覽器 / Browser Review**，可以自動開頁、切 target、批次截圖、做參考圖比對
- `cocos-screenshot`: 截的是 **Cocos Editor 視窗目前看到的內容**，不會自動開瀏覽器，也不會替你切 preview target
- Browser Review 沒準備好時，`cocos-preview-qa` 應先要求使用者準備環境；Editor 沒打開目標畫面時，`cocos-screenshot` 也無法替代

## When to Use

- 驗收 D 階段 UI 任務（UI-1-0014、UI-1-0015、UI-1-0016 及後續）
- 需要對照參考圖確認視覺品質
- 任何要求「截圖 preview 畫面」的 QA 工作
- 新增 screen 後需要第一次截圖確認
- 使用者已明確表示 Browser Review 環境已準備好，可讓 Agent 自動瀏覽切換

**不適用：**
- Cocos Editor 本身的截圖（Editor crash / UI 跑掉）→ 用 `cocos-screenshot`
- 使用者只有開 Cocos Editor Preview，沒有可切換的 Browser Review 環境
- 編譯錯誤 → 用 `get_errors`
- 純 log 分析 → 用 `cocos-log-reader`

---

## 架構說明（Unity 對照）

| 概念 | Cocos Creator | Unity 對照 |
|------|--------------|------------|
| Preview 入口 | `LoadingScene.scene` | 一個專門的 PreviewBootstrap Scene |
| 控制旗標 | `previewMode=true` + `previewTarget=N` | 用 `#if UNITY_EDITOR` 的 Preview Manager |
| Screen 掛載點 | `UIScreenPreviewHost.ts` | 一個 MonoBehaviour 動態 Instantiate Prefab Variant |
| 狀態訊號 | `window.__UI_CAPTURE_STATE__` | 一個靜态布林旗標或 Event 告知截圖工具「已就緒」 |
| 自動化截圖工具 | `tools_node/capture-ui-screens.js`（puppeteer-core） | Unity Test Framework + Graphics.Blit 或 EditorScreenshot |

**Preview 入口 URL：**
```
http://localhost:7456
```
瀏覽器開啟此 URL 時，Cocos Editor 會以 Game View 模式渲染最後一次開啟的場景。

---

## 可用 Preview Targets

| targetId | screenId | targetIndex |
|----------|----------|-------------|
| `LobbyMain` | `lobby-main-screen` | 1 |
| `ShopMain` | `shop-main-screen` | 2 |
| `Gacha` | `gacha-main-screen` | 3 |
| `DuelChallenge` | `duel-challenge-screen` | 4 |

---

## Step 1 — 確認 Cocos Editor 正在運行

### Browser Review 環境前提

執行前，先確認使用者已準備好：
- Cocos 可從瀏覽器載入，且 `http://localhost:7456` 可達
- LoadingScene / Preview Host / preview target 切換鏈已接通
- 目標 screen 已經接進 `tools_node/capture-ui-screens.js` 或相容的 preview pipeline

若上述任一條件未滿足，先回報「缺 Browser Review 環境」，不要直接改用 `cocos-screenshot`。

```powershell
# 確認 Editor 可回應：
Invoke-RestMethod -Uri "http://localhost:7456/asset-db/refresh" -Method Get
```

若失敗（無法連線）→ 必須先啟動 Cocos Creator Editor，開啟此專案。

---

## Step 2 — 執行 Headless Capture

### 快速指令：截全部 4 個 screens

```powershell
cd c:\Users\User\3KLife
node tools_node/capture-ui-screens.js --outDir artifacts/ui-qa/<taskId>
```

### 截單一 screen

```powershell
node tools_node/capture-ui-screens.js --target LobbyMain --outDir artifacts/ui-qa/<taskId>
```

### 完整參數列表

| 參數 | 說明 | 預設 |
|------|------|------|
| `--target` | 指定單一 target（省略則截全部）| 全部 |
| `--outDir` | 輸出目錄 | `artifacts/ui-qa/UI-2-0023` |
| `--url` | Cocos Editor 基礎 URL | `http://localhost:7456` |
| `--timeout` | 等待畫面就緒的 ms 上限 | `45000` |
| `--retries` | 失敗自動重試次數 | `1` |
| `--browser` | 指定 Edge/Chrome 執行檔路徑 | 自動搜尋 |
| `--refreshBefore` | 是否在截圖前先觸發 asset-db refresh | `true` |

**範例：指定 browser 路徑**
```powershell
node tools_node/capture-ui-screens.js --target LobbyMain --outDir artifacts/ui-qa/UI-1-0014 --browser "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
```

---

## Step 3 — 查看截圖（用 view_image）

`capture-ui-screens.js` 的輸出在進 `view_image` 前，仍需遵守 thumbnail-first progressive zoom：先看 `125px`，不足才升到 `250px`、`500px`。

截圖完成後，**一次只開 1 張主圖**；若需要比對，再額外開 **1 張對照圖**，不可整批開 4 張：

```
view_image: artifacts/ui-qa/<taskId>/LobbyMain.png
```

> 圖片檢視硬規定：一次最多 `1` 張主圖 + `1` 張對照圖；先試 `125px`，不足才放大一倍；需要看 `>500px` 原圖時，必須先取得使用者明確同意。

---

## Step 4 — 對照參考圖

### 參考圖位置

| 用途 | 路徑 |
|------|------|
| UI 品質參考圖（設計稿） | `docs/UI品質參考圖/` |
| 已通過的歷史 QA 截圖 | `artifacts/ui-qa/<舊taskId>/*.png` |

### 比對方法

1. `view_image` 開啟新截圖前，先用 `prepare-view-image.js` 產出 `125px` 版本
2. 若 `125px` 不足，再依序升到 `250px`、`500px`；參考圖也用同一套流程
3. 逐點比較（見下方觀察點）

### QA 觀察點 Checklist

- [ ] **承載面（carrier/parchment）** — 是否正確顯示背景板
- [ ] **層次深淺** — 深色/淺色區塊層次是否成立
- [ ] **Shadow / noise / frame** — 框體效果是否正確
- [ ] **元件密度** — 是否過擠或版面跑位
- [ ] **文字 i18n** — 中文是否正確顯示（無亂碼）
- [ ] **Nav / Tab 狀態** — active/inactive 視覺是否正確
- [ ] **圖示與素材** — 是否有 placeholder（純色方塊）遺留
- [ ] **整體對齊** — 是否與參考圖整體構圖一致（允許 ±5% 容差）

---

## Step 5 — 寫 QA Notes

輸出到 `artifacts/ui-qa/<taskId>/notes.md`，格式：

```markdown
# QA Notes — <taskId> — <screenId>

- **date**: YYYY-MM-DD
- **agent**: Agent2（或 AgentX）
- **capture tool**: tools_node/capture-ui-screens.js
- **preview entry**: LoadingScene.scene + previewMode=true + previewTarget=<N>

## 截圖

- <screen>-16-9.png
- <screen>-19_5-9.png（若已截）

## 結論

| 項目 | 狀態 |
|------|------|
| 承載面 | pass / needs-tweak / blocked |
| 層次深淺 | pass / needs-tweak / blocked |
| Shadow/frame | pass / needs-tweak / blocked |
| 文字 i18n | pass / needs-tweak / blocked |
| 整體對齊 | pass / needs-tweak / blocked |

**整體結論**: pass / needs-tweak / blocked

## 主要觀察

（寫實際觀察到的問題或通過的點）

## 待後續處理

（若 needs-tweak 或 blocked，寫給誰、開哪張卡）
```

---

## Step 6 — 更新任務卡狀態

完成截圖與 notes 後，更新 `docs/ui-quality-todo.json` 中該任務的狀態與 notes。

---

## 失敗排障（Troubleshooting）

### 找不到瀏覽器

```
[capture-ui-screens] 找不到可用瀏覽器
```
→ 手動指定 `--browser "C:\Program Files\Microsoft\Edge\Application\msedge.exe"`

---

### TimeoutError — 畫面未就緒

```
TimeoutError: Waiting for function failed: timeout...
```

**可能原因 1**: `__UI_CAPTURE_STATE__` 從未設為 `ready`
→ 讀 `<target>-debug-state.json`，確認 `captureState` 欄位
→ 讀 `<target>-debug.png`（`view_image`）確認畫面內容

**可能原因 2**: asset-db 未完成 refresh
→ 先執行 `curl.exe http://localhost:7456/asset-db/refresh`，等 1-2 秒再重試

**可能原因 3**: LoadingScene.scene UUID 不符
→ 確認 `assets/scenes/LoadingScene.scene.meta` 存在且 uuid 正確

---

### Unable to resolve bare specifier

```
Preview compile failed: Unable to resolve bare specifier...
```
→ TypeScript 編譯問題；先用 `get_errors` 檢查，再觸發 Cocos compile。

---

### __UI_CAPTURE_STATE__ status = error

```json
{"status": "error", "error": "loadFullScreen failed: ..."}
```
→ screen JSON 路徑有誤或 skin/layout JSON 缺失；確認 `UISpecLoader` 路徑：
- screen: `assets/resources/ui-spec/screens/<screenId>.json`
- layout: `assets/resources/ui-spec/layouts/<layoutId>.json`
- skin: `assets/resources/ui-spec/skins/<skinId>.json`

---

## 新增 Screen 到 Capture Pipeline

在 `tools_node/capture-ui-screens.js` 的 `targets` 陣列加入：

```js
{ id: 'NewScreen', screenId: 'new-screen-id', targetIndex: 5 },
```

同步更新 `assets/scripts/ui/scenes/LoadingScene.ts` 中的 switch case：

```ts
case 5: await previewHost.showScreen('new-screen-id'); break;
```

---

## 輸出物清單

成功執行後的 `outDir` 應包含：

| 檔案 | 說明 |
|------|------|
| `LobbyMain.png` | 正式截圖 |
| `ShopMain.png` | 正式截圖 |
| `Gacha.png` | 正式截圖 |
| `DuelChallenge.png` | 正式截圖 |
| `capture-report.json` | 本次 capture 的元資料（timestamp、host、機器名） |
| `<target>-debug.png` | 失敗時的除錯截圖（若有） |
| `<target>-debug-state.json` | 失敗時的完整狀態 JSON（若有） |
| `notes.md` | QA 觀察紀錄（手動補填） |
