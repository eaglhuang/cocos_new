# 保留共識 (Keep Consensus)

> **說明**: 本文件記錄專案開發過程中的重要技術決策、架構共識與關鍵約定。AI 助手在處理任何請求前須先讀取此文件，並同步參考 `docs/demo_playbook.md` 的玩法規格。

**最後更新**: 2026-03-06

---

## 📋 專案基本資訊

- **專案名稱**: NewProject
- **專案類型**: Cocos Creator 跨平台 2.5D 戰鬥遊戲專案
- **引擎版本**: Cocos Creator 3.8.8-121518
- **專案 UUID**: 3cabd774-9528-4461-99d1-01e92b52bdf9
- **開發語言**: TypeScript (ES2015)
- **目標平台**: Web / Android / iOS
- **專案階段**: Demo 規格定案與雛型啟動階段

---

## 🎯 核心開發原則

### 1. 編輯器驅動開發模式
- **必須透過 Cocos Creator 編輯器進行開發**（監聽於 `http://localhost:7456`）
- 所有資源編譯、場景編輯、組件綁定均由編輯器處理
- **禁止**依賴 npm scripts 進行建置

### 2. TypeScript 配置約定
- 使用 `experimentalDecorators: true`（支援 `@ccclass` 等裝飾器）
- **不啟用** strict 模式
- 目標版本: ES2015
- 配置延伸自 `temp/tsconfig.cocos.json`（由 Cocos Creator 自動生成）

### 3. 平台與互動約定
- 第一優先迭代平台為 Web，Android / iOS 需定期進行 smoke test
- 玩家主要互動方式為 **大按鈕 UI + 點擊 / 觸控選目標**
- UI 尺寸與交互必須以手機觸控友善為前提

### 4. 視覺與雛型約定
- 正式表現方向優先採 **2D / Spine**
- Demo 雛型階段優先使用 Cocos Creator 內建 placeholder 資源
- 第一版重點是驗證玩法、節奏與操作，不以正式美術量產為優先

### 5. 架構原則
- 專案必須採 **資料驅動**、**模組解耦**、**可擴充平台抽象層**
- 戰鬥邏輯、單位表現、UI 顯示、配置資料需分離
- 遊戲邏輯不得直接耦合第三方 SDK

### 6. AI / Vibe Coding 協作原則
- AI 產出需以清楚資料夾結構、命名規則、模組責任為前提
- 每次任務應限制修改範圍，避免同時重構多個模組
- 事件機制可用於模組通知，但不應讓核心戰鬥流程過度依賴全域事件
- 動態載入可作為 Demo 手段，但不應把所有資源策略永久綁死在單一路徑機制

---

## 🧭 Demo 核心方向

### 1. 第一階段玩法定位
- Demo 採 **2.5D 俯視角、雙入口主玩法**
- 玩法 A：**遭遇戰**
- 玩法 B：**推進模式**

### 2. 共通戰場規格
- 核心戰場為 **5 路 x 8 格深度** 的小棋盤
- 雙方各有一名將軍作為核心目標
- 小兵以格子為單位推進與接戰
- 敵方將軍被擊倒則獲勝，我方將軍被擊倒則失敗

### 3. 遭遇戰共識
- 玩家可直接進入一場完整戰鬥
- 主要用於驗證對推規則、部署操作、勝敗循環與可讀性
- 當遭遇敵將時，敵將固定出現在棋盤右上方並面向我方

### 4. 推進模式共識
- 玩家先沿道路持續推進，再遭遇事件
- 推進途中可能遭遇：敵將、神秘商人、大寶箱、其他 NPC
- 遭遇敵將時切入遭遇戰版型
- 推進模式需預留「棋盤轉換為道路向前移動」的視覺與動畫方向

### 5. 畫面構圖共識
- 我方武將固定在畫面左下角區域
- 左下角需預留額外空間，供未來玩家角色站在武將旁邊作為輔助角色
- 左下區域不可被主要按鈕 UI 遮擋
- 主要操作按鈕區應優先配置於畫面下方中間或右下方

---

## 🚫 禁止操作清單

以下檔案/資料夾**禁止手動編輯**，由 Cocos Creator 自動管理：

- `temp/tsconfig.cocos.json` — 自動生成的 TypeScript 配置
- `profiles/v2/`, `settings/v2/` — 編輯器設定檔
- `library/` — 資源資料庫（唯讀、雜湊索引）
- `build/`, `native/` — 建置輸出（.gitignore 已排除）

---

## 🔧 開發工作流

### 編譯與重新整理
- 透過 Cocos Creator 編輯器與既有任務進行資源刷新與編譯

### 除錯配置
- Chrome Debugger 連接至 `http://localhost:7456`
- 使用 VS Code 內建的 Chrome Debugger 擴充功能

### 腳本與文件開發
1. 在 `assets/` 資料夾中撰寫 TypeScript 組件
2. 使用 `@ccclass` 裝飾器註冊組件類別
3. 透過 Cocos Creator Inspector 綁定至場景物件
4. Demo 規格與技術決策同步維護於 `docs/` 目錄

---

## 📦 型別定義來源

- **引擎 API**: `@cocos/creator-types/engine` → `cc` 模組
- **編輯器 API**: `@cocos/creator-types/editor` → `Editor` 物件
- **自動生成**: `temp/declarations/` (cc, jsb, macros, env)

---

## 📝 技術決策記錄

### [2026-03-06] 初始化專案文檔架構
- 建立 `.github/copilot-instructions.md` 作為 AI 助手的工作空間指引
- 建立 `docs/keep.md` 作為技術共識與決策記錄
- 確立「執行前置檢查」規範，AI 須優先讀取本文件

### [2026-03-06] 確立第一階段 Demo 與 AI 協作方向
- 目標平台確立為 `Web / Android / iOS`
- 第一階段 Demo 確立為 **2.5D 俯視角、雙方對推式格子 PVE 戰鬥**
- 戰場採 **5 路 x 8 格深度** 小棋盤
- Demo 共有兩種主玩法：`A. 遭遇戰`、`B. 推進模式`
- 玩家操作採 **大按鈕 UI + 滑鼠 / 觸控點選目標**
- 我方武將固定於左下角，並預留未來玩家輔助角色站位空間
- 遭遇敵將時，敵將固定出現在棋盤右上方並面向我方
- 正式視覺方向優先採 **2D / Spine**，雛型階段優先使用內建 placeholder 資源
- 短期內不接真實第三方 SDK，僅保留平台抽象層
- 專案架構以 **資料驅動、模組解耦、適合 AI / vibe coding 持續擴充** 為原則
- 詳細玩法規格統一維護於 `docs/demo_playbook.md`

### [2026-03-06] 建立 Editor 工具中樞與 Sprite 自動化管線
- 選定 **Node.js** 作為專案工具鏈標準（優先整合 Cocos Creator Editor Extension）
- 建立 `extensions/studio-tools-hub`，統一管理後續 AI 工具並掛載於上方選單
- 建立 `tools/sprite-pipeline` 自動化流程：綠幕去背、連通區切幀、底部錨點對齊、防抖輸出
- 工具輸出同時覆寫到 `assets/resources/sprites/`，以利 Cocos 直接載入與預覽

### [2026-03-08] 確立 MVC + Service 混合架構
- 採用 **MVC + Service 混合架構**，戰鬥模組使用 MVC、橫切關注使用 Service
- **ServiceLoader** 作為輕量 DI 容器，僅負責建立與注入依賴，不啟動遊戲邏輯
- **BattleSystem** 為回合狀態機，階段切換時透過 EventSystem 發送通知
- **FormulaSystem** 集中所有傷害 / 治療 / 互剋計算，避免公式散落
- **ResourceManager** 具備路徑快取，避免重複載入
- Model 層為純 TypeScript 類別（TroopUnit、GeneralUnit、BattleState），不依賴 Cocos 節點
- 技術架構文件獨立於 `docs/demo_技術架構.md`，玩法規格留在 `docs/demo_playbook.md`

### [2026-03-08] 架構審查與修正
- **BattleState.getCell()** 改為 O(1) 索引直算（原為 Array.find O(n)）
- **ServiceLoader.initialize()** 移除自動 beginBattle()，戰鬥啟動由 Controller 負責
- **BattleSystem** 新增 EventSystem 注入，階段變化時自動發送 `TurnPhaseChanged` 事件
- **GameManager** 新增 EventSystem 注入，模式切換時發送 `GameModeChanged` 事件
- **TroopUnit** 移除冗餘 `terrain` 欄位，地形資訊統一從 BattleState.GridCell 取得
- 新增 **GeneralUnit** 資料模型（武將 HP、攻擊加成、擅長地形）
- 新增 `UnitDeployed` / `GameModeChanged` 事件名稱

---

## 🛠 開發環境

- **引擎**: Cocos Creator 3.8.8
- **平台**: Web / Android / iOS
- **狀態**: 環境建置完成，已導出類型定義並配置 `tsconfig.json`

---

## 🤝 已達成共識

- [x] **語言**: 繁體中文互動與代碼註釋
- [x] **編輯器工作流**: 以 Cocos Creator 編輯器開發為主
- [x] **平台目標**: Web / Android / iOS
- [x] **Demo 玩法**: 2.5D 俯視角、5 路 x 8 格雙入口對推式 PVE Demo
- [x] **操作方式**: 大按鈕 UI + 滑鼠 / 觸控點選目標
- [x] **視覺策略**: 正式方向為 2D / Spine，雛型使用內建 placeholder
- [x] **主將構圖**: 我方主將位於左下角並保留未來玩家輔助角色空間
- [x] **第三方整合策略**: 短期僅保留抽象層，不接真實 SDK
- [x] **架構原則**: 資料驅動、模組解耦、利於 AI / vibe coding 穩定協作
- [x] **工具管理策略**: 採用 Cocos Editor 上方選單的工具中樞（`extensions/studio-tools-hub`）
- [x] **素材處理策略**: 採 Node.js `sprite-pipeline` 進行可量產的自動切幀與防抖對齊
- [x] **程式架構**: 採 MVC + Service 混合架構，ServiceLoader 為輕量 DI 容器
- [x] **文件分離**: 玩法規格在 `demo_playbook.md`，技術架構在 `demo_技術架構.md`

---

## 🔄 維護規範

1. **新增決策時機**:
   - 架構層級變更
   - 引入新的開發工具或框架
   - 確立命名規範或資料夾結構
   - Demo 主玩法規格或視覺方向調整
   - 解決重要技術問題後的經驗記錄

2. **更新方式**:
   - 在「技術決策記錄」區塊新增條目（含日期）
   - 若有過時內容，註記 `[已廢棄]` 並說明替代方案
   - 玩法層級調整需同步更新 `docs/demo_playbook.md`

3. **AI 助手職責**:
   - 每次對話開始時摘要本文件內容
   - 執行玩法或架構相關任務前，同步參考 `docs/demo_playbook.md`
   - 達成新技術決策時提醒用戶更新本文件
   - 遵循本文件記錄的所有準則與約定
4. **專案文檔**: 重要的技術決策、架構設計和開發規範需記錄於 `demo_技術架構.md`，並定期更新以反映最新共識。
5. **Demo 規格維護**: 詳細的玩法規格統一維護於 `demo_playbook.md`，確保所有開發人員對核心玩法有一致理解。
