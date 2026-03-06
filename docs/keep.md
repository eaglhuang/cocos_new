# 保留共識 (Keep Consensus)

> **說明**: 本文件記錄專案開發過程中的重要技術決策、架構共識與關鍵約定。AI 助手在處理任何請求前須先讀取此文件。

**最後更新**: 2026-03-06

---

## 📋 專案基本資訊

- **專案名稱**: NewProject
- **專案類型**: Cocos Creator 3D 遊戲專案
- **引擎版本**: Cocos Creator 3.8.8-121518
- **專案 UUID**: 3cabd774-9528-4461-99d1-01e92b52bdf9
- **開發語言**: TypeScript (ES2015)
- **專案階段**: 初期腳架階段（assets/ 尚未有遊戲資源）

---

## 🎯 核心開發原則

### 1. IDE 驅動開發模式
- **必須透過 Cocos Creator 編輯器進行開發**（監聽於 `http://localhost:7456`）
- 所有資源編譯、場景編輯、組件綁定均由編輯器處理
- **禁止**依賴 npm scripts 進行建置

### 2. TypeScript 配置約定
- 使用 `experimentalDecorators: true`（支援 `@ccclass` 等裝飾器）
- **不啟用** strict 模式
- 目標版本: ES2015
- 配置延伸自 `temp/tsconfig.cocos.json`（由 Cocos Creator 自動生成）

### 3. 資源路徑規範
- 使用 `db://` 協議引用資源
  - `db://assets/*` → 專案資源資料夾
  - `db://internal/*` → 引擎內建資源

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
```bash
# 透過 VS Code 任務觸發資源重新整理
curl http://localhost:7456/asset-db/refresh
```

### 除錯配置
- Chrome Debugger 連接至 `http://localhost:7456`
- 使用 VS Code 內建的 Chrome Debugger 擴充功能

### 組件腳本開發
1. 在 `assets/` 資料夾中撰寫 TypeScript 組件
2. 使用 `@ccclass` 裝飾器註冊組件類別
3. 透過 Cocos Creator Inspector 綁定至場景物件

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

## 🛠 開發環境
- **引擎**: Cocos Creator 3.8.8
- **平台**: Web / Android / iOS
- **狀態**: 環境建置完成，已導出類型定義並配置 tsconfig.json。

## 🤝 已達成共識
- [x] **語言**: 繁體中文互動與代碼註釋。
- [x] **編輯器連動**: 已配置 `Cocos Creator compile` 任務。
- [x] **技術棧**: 2D UI + 3D 渲染物件 + Spine 動畫。
---

## 🔄 維護規範

1. **新增決策時機**: 
   - 架構層級變更
   - 引入新的開發工具或框架
   - 確立命名規範或資料夾結構
   - 解決重要技術問題後的經驗記錄

2. **更新方式**:
   - 在「技術決策記錄」區塊新增條目（含日期）
   - 若有過時內容，註記 `[已廢棄]` 並說明替代方案

3. **AI 助手職責**:
   - 每次對話開始時摘要本文件內容
   - 達成新技術決策時提醒用戶更新本文件
   - 遵循本文件記錄的所有準則與約定
