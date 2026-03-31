# 編碼防災 Playbook

本文件只補充編碼防災的操作流程。通用規則以 [keep.md](./keep.md) 為準，不在此重複。

## 1. 目的

- 防止中文檔、註解、template string、log 被錯誤編碼破壞。
- 讓災難處理流程標準化，不靠人工猜測回補。

Unity 對照：這和保護 Unity 的 YAML / Prefab 類似，最怕的不是格式壞掉，而是內容先被錯誤工具讀壞再存回。

## 2. 必跑指令

```bash
npm run check:encoding
npm run check:acceptance
```

每次修改高風險文字檔後，先跑 touched-files 快檢。多人協作時，優先只檢查你這輪剛改的檔案：

```bash
npm run check:encoding:touched -- --files <file...>
```

若要掃整個目前 dirty working tree，再用：

```bash
npm run check:encoding:touched
```

這一步比全 repo 快很多，適合每次編輯後立刻做。

若 PowerShell 被 execution policy 擋住 `npm.ps1`，可改用：

```bash
cmd /c npm run check:encoding:touched -- --files <file...>
```

只檢查 staged 檔案時可用：

```bash
npm run check:encoding:staged
```

## 3. 高風險檔編輯流程

高風險檔定義與單寫者規則見 [keep.md](./keep.md)。

編輯前：

```bash
npm run prepare:high-risk-edit -- <file>
```

此流程應產出：

- SHA256 記錄
- `local/encoding-backups/` 備份
- 編輯前檢查結果

編輯後：

- 先執行 `npm run check:encoding:touched -- --files <file...>`
- 收工前再執行一次對應本輪輸出的 touched 檢查
- 必要時再執行 `npm run check:encoding`
- 檢查非 ASCII diff
- 再提交

不要只等最後一次才檢查。越晚發現，越難知道是哪一步把中文寫壞。

## 4. 禁止流程

不要用會經過主控台碼頁的方式覆寫中文檔，例如：

- `Set-Content`
- `Out-File`
- 先把 `git show` 轉成 PowerShell 字串，再寫回檔案
- 任何未明確指定 UTF-8 的整檔重寫工具

## 5. 建議流程

- `apply_patch`
- 明確指定 UTF-8 的寫檔 API
- 直接用 git blob 回救：

```bash
cmd /c "git show HEAD:path\\to\\file > path\\to\\file"
```

## 6. 災難回救

若檔案已疑似亂碼：

1. 立刻停止繼續編輯。
2. 保留當前壞檔到 `local/encoding-backups/`。
3. 比對 git 歷史：

```bash
git show HEAD:path/to/file
git diff --word-diff -- path/to/file
```

4. 用 git blob 或乾淨備份回救。
5. 回救後重新跑 `npm run check:encoding`。

## 7. 與拆分規則的關係

- `400` 行以上代碼檔必拆，詳見 [keep.md](./keep.md)。
- 中文密集大檔優先拆成 text、diagnostics、layout、style、factory 等模組。
- 目標是縮小災難半徑與 merge conflict 面積。

## 8. 驗收

下列條件都成立才算完成：

- `npm run check:encoding` 通過
- `npm run check:acceptance` 通過
- 高風險檔修改前有備份與 SHA
- 提交前通過 pre-commit
