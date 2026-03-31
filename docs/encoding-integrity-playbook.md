# 中文字串編碼防災作業手冊

本文件整理專案目前的 UTF-8 防災規範、提交流程與災難回救方式。

對照 Unity 經驗，這份手冊的用途很像團隊的 Prefab / YAML 保護規範：
檔案不只要「能打開」，還要確保內容沒有先被錯誤碼頁解碼再寫回。

## Repo 基線

- 專案文字檔一律以 UTF-8 + LF 為標準。
- 受控副檔名至少包含 `.ts`、`.js`、`.json`、`.md`、`.ps1`。
- 主要設定檔：
  - `.editorconfig`
  - `.gitattributes`
  - `.vscode/settings.json`
- VS Code 必須固定：
  - `files.encoding = utf8`
  - `files.autoGuessEncoding = false`

## 自動檢查

- 編碼檢查腳本：`tools_node/check-encoding-integrity.js`
- 預設掃描範圍：git 追蹤中的專案文字檔
- 排除範圍：
  - vendored / 第三方型別來源
  - 工作樹中已不存在的舊追蹤路徑
- 必須攔截的問題：
  - `U+FFFD` replacement character
  - 非預期 BOM
  - 可疑 mojibake 特徵
  - 高風險檔非 ASCII 基線異常漂移

## 執行入口

- 本機快速檢查：
  ```bash
  npm run check:encoding
  ```
- 驗收檢查：
  ```bash
  npm run check:acceptance
  ```
- 提交前檢查：
  ```bash
  node tools_node/check-encoding-integrity.js --staged
  ```

## Git 與提交流程

- 必須安裝 hooks：
  ```bash
  npm run install:hooks
  ```
- `pre-commit` 會自動執行 staged 編碼檢查。
- commit message 固定格式：
  ```text
  [bug|feat|chore] 任務卡號 功能描述 [AgentX]
  ```
- git commit 是災難回救保底，不是取代 pre-commit 的理由。

## 高風險中文檔

高風險中文檔包含：

- 大量中文 template string
- 大量中文 log
- 長段中文註解
- 大量非 ASCII 文案常數

處理規則：

- 採單寫者規則，同一時間只允許一位 Agent / 開發者修改。
- 修改前先執行：
  ```bash
  npm run prepare:high-risk-edit -- <file>
  ```
- 該步驟會：
  - 記錄 SHA256
  - 建立 `local/encoding-backups/` 備份
  - 先跑一次檢查，確認原始狀態

## 禁止的寫檔方式

下列流程容易讓中文經過主控台碼頁或 PowerShell 預設編碼污染，禁止用於回救或覆寫中文檔：

- `Set-Content`
- `Out-File`
- `git show ... | Out-String | WriteAllText(...)`
- 任何未明確指定 UTF-8 的整檔重寫工具

## 允許的安全方式

- `apply_patch`
- 明確指定 UTF-8（無 BOM）的檔案 API
- 二進位安全覆寫，例如：
  ```bash
  cmd /c "git show HEAD:path\\to\\file > path\\to\\file"
  ```

## 災難回救流程

如果檔案疑似亂碼，先停止繼續編輯，不要在損毀內容上反覆存檔。

建議流程：

1. 先複製當前壞檔到 `local/encoding-backups/` 保留現場。
2. 檢查最近乾淨版本：
   ```bash
   git show HEAD:path/to/file
   git diff --word-diff -- path/to/file
   ```
3. 用二進位安全方式從 git blob 回救。
4. 回救後立即重跑：
   ```bash
   npm run check:encoding
   ```

## 400 行硬規則

- 任一代碼檔只要超過 400 行，就必須被視為強制重構對象。
- 不接受「先放著，下次再拆」作為常態做法。
- 若當輪任務無法完整拆分，至少必須：
  - 開正式任務卡
  - 在當輪 notes / 規格中記錄拆分責任與下一步
  - 避免再把新功能繼續堆進同一檔

對照 Unity，這條規則等同於：
不要把所有行為、資料綁定、視覺組裝、除錯輸出都繼續塞在同一支超肥 `MonoBehaviour`。

## `UIPreviewBuilder.ts` 的專案特例

- `UIPreviewBuilder.ts` 目前屬高風險中文密集檔。
- 後續必須朝下列方向拆分：
  - orchestrator
  - text catalog
  - diagnostics
  - layout builder
  - style builder
  - node factory

## 驗收標準

以下條件同時成立，才算這套防線有效：

- `npm run check:encoding` 通過
- `npm run check:acceptance` 通過
- 高風險檔修改前有備份與 SHA
- commit 前 hooks 真的有執行
- review 時有檢查非 ASCII 變更
