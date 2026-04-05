---
name: cocos-preview-qa
description: 'BROWSER REVIEW QA SKILL — Use the built-in browser/headless browser (puppeteer-core) to open a browser-runnable Cocos preview, switch preview targets, capture screenshots, and compare them with reference images. USE FOR: screen-driven QA only when the user has already prepared a Browser Review environment that can run in the browser (`http://localhost:7456`, LoadingScene/preview host/preview target wiring ready). DO NOT USE FOR: current Cocos Editor window screenshots, Editor Preview capture, compile errors, or pure log analysis. If the Browser Review environment is not ready, stop and remind the user to prepare it first.'
argument-hint: 'Specify target screen and task id only after confirming the Browser Review environment is ready. Example: "target=LobbyMain taskId=UI-1-0014".'
---

<!-- 此檔案為 .agents/skills/cocos-preview-qa/SKILL.md 的鏡像副本，供 GitHub Copilot 技能載入使用 -->
<!-- 主版本位於 c:\Users\User\3KLife\.agents\skills\cocos-preview-qa\SKILL.md -->

# Cocos Preview QA（Browser Review 自動截圖 + 比對）

此技能用於 **Browser Review 環境的自動截圖 + 參考圖比對 QA**：
- 對象：已接入瀏覽器 preview pipeline 的 D 階段 UI screen（LobbyMain / ShopMain / Gacha / DuelChallenge）
- 工具：`tools_node/capture-ui-screens.js`（puppeteer-core）
- 比對對象：`docs/UI品質參考圖/` 或歷史 `artifacts/ui-qa/`

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

## 核心流程（5 步驟）

```
Step1: 確認 localhost:7456 可達
Step2: node tools_node/capture-ui-screens.js --target <X> --outDir artifacts/ui-qa/<taskId>
Step3: view_image 逐張查看截圖
Step4: view_image 對照參考圖比較
Step5: 寫 notes.md + 更新 ui-quality-todo.json
```

## 快速指令

```powershell
# 截全部 4 個 screens
node tools_node/capture-ui-screens.js --outDir artifacts/ui-qa/<taskId>

# 截單一 screen
node tools_node/capture-ui-screens.js --target LobbyMain --outDir artifacts/ui-qa/<taskId>
```

## 完整 SOP

請讀取主技能檔案以取得完整步驟、QA checklist 與排障指引：
`.agents/skills/cocos-preview-qa/SKILL.md`
