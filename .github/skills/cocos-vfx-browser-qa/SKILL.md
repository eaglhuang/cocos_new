---
doc_id: doc_agentskill_0035
name: cocos-vfx-browser-qa
description: 'BROWSER VFX ACCEPTANCE SKILL — Use built-in browser/headless browser to automatically verify Cocos VFX block effects and composed VFX recipes in BattleScene preview (`http://localhost:7456`, `previewMode=true`, `previewTarget=5`). USE FOR: VFX health audit, per-block smoke validation, combo recipe regression checks before merging `vfx-block-registry.ts` / `vfx-effects.json`. DO NOT USE FOR: Cocos Editor window screenshot capture, compile-error debugging, or pure log-only diagnosis without browser preview.'
argument-hint: 'Provide scope and run id. Example: "scope=blocks runId=VFX-QA-2026-04-16" or "scope=combos source=assets/resources/data/vfx-effects.json runId=VFX-QA-2026-04-16".'
---
<!-- 此檔案為 .agents/skills/cocos-vfx-browser-qa/SKILL.md (doc_agentskill_0009) 的鏡像副本，供 GitHub Copilot 技能載入使用 -->
<!-- 對應原始路徑：c:\\Users\\User\\3KLife\\.agents\\skills\\cocos-vfx-browser-qa\\SKILL.md -->


# Cocos VFX Browser QA

用這個 skill 讓 Agent 在 Browser Review 環境中，自動驗收：
- 單積木特效（block）
- 積木組合特效（combo / recipe）

## Unity 對照

- `LoadingScene + previewTarget=5` = Unity 的 PreviewBootstrap Scene
- `VfxComposerTool` = Unity 內建特效預覽視窗（自訂工具）
- Browser 自動化（Playwright/Puppeteer）= Unity 測試框架裡的自動畫面驗收

## 前置條件

先確認以下條件全部成立，否則停止並回報缺口：
- `http://localhost:7456` 可連線
- Browser Review 已接上 `LoadingScene` preview flow
- `BattleScene` target 可用（`previewTarget=5`）
- 本次驗收範圍已明確（`scope=blocks` 或 `scope=combos`）

先做一次 refresh：

```powershell
curl.exe http://localhost:7456/asset-db/refresh
```

## 驗收範圍定義

### scope=blocks（單積木）

資料來源：`assets/scripts/tools/vfx-block-registry.ts`

每個 block 至少要驗：
- 可觸發播放（不是無反應）
- 不出現致命錯誤（load fail / play fail）
- 至少有一種可見輸出來源：`ParticleSystem > 0` 或 `Animation > 0`

### scope=combos（積木組合）

預設資料來源：`assets/resources/data/vfx-effects.json`

combo 規則：
- 若有 `blocks[]`，直接使用
- 若只有 `blockId`，視為單積木 combo

## 自動化流程

### 1. 進入 Browser Review

- 用內建瀏覽器或 headless browser 導向：

```text
http://localhost:7456/?previewMode=true&previewTarget=5&t=<timestamp>
```

- 等待 `__UI_CAPTURE_STATE__` 進入 `ready`，且 `screenId=battle-scene`

### 2. 逐筆執行測項

每個 case（block 或 combo）都做同一套流程：
- 呼叫 `VfxComposerTool` 或等效播放入口觸發特效
- 收集執行結果（played / psCount / animCount）
- 收集 console warning/error
- 截 1 張畫面（同一 case 固定命名）

輸出路徑建議：

```text
artifacts/vfx-qa/<runId>/
  report.json
  summary.md
  screenshots/<caseId>.png
```

### 3. 判定 PASS / FAIL / WARN

#### FAIL 條件

- 找不到 `BattleScene` 或 `VfxComposerTool`
- case 觸發結果 `played=false`
- `ParticleSystem=0` 且 `Animation=0`
- 出現致命錯誤字樣（例如：`載入失敗`、`播放失敗`、`未在 PoolSystem 中註冊`、`無法預覽`）

#### WARN 條件

- 有 warning 但可播放
- 觸發時發生 fallback（例如 prefab 失敗改 quad）

#### PASS 條件

- 可播放、且有可見輸出來源、且無致命錯誤

## 報告格式

`report.json` 每筆至少包含：
- `caseId`
- `scope` (`blocks` / `combos`)
- `status` (`pass` / `warn` / `fail`)
- `played`
- `psCount`
- `animCount`
- `errors[]`
- `warnings[]`
- `screenshot`

`summary.md` 至少包含：
- 本輪總數 / pass / warn / fail
- fail 清單（按 caseId）
- 高風險關鍵字統計（載入失敗、播放失敗、pool miss）

## 推薦搭配指令

先用一鍵 runner 跑完整驗收：

```powershell
node tools_node/run-vfx-browser-qa.js --scope all --runId VFX-QA-<date>
```

若只想快速確認 Browser Review 鏈路，再截 BattleScene 煙霧測試圖：

```powershell
node tools_node/capture-ui-screens.js --target BattleScene --outDir artifacts/vfx-qa/<runId>/smoke --timeout 70000
```

## 什麼時候不要用這個 skill

- 你要的是 Editor 視窗截圖，不是 Browser Review
- 你要查 crash / TypeError root cause（先用 `cocos-log-reader`）
- 你要做的是靜態 UI 視覺比對（優先用 `cocos-preview-qa`）

## 收尾規範

- 若有改動 `vfx-block-registry.ts`、`vfx-effects.json`，在回覆中要附本輪 `runId` 與 `report.json` 路徑
- 圖片檢視仍遵守 thumbnail-first（`125 -> 250 -> 500`）

