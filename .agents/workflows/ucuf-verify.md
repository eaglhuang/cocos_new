---
doc_id: doc_ai_0021
description: UCUF CompositePanel 驗證流程（三步快速驗收）
---

# UCUF 驗證 Workflow（ucuf-verify）

此 workflow 用於在 UCUF Panel 完成實作後進行快速驗收。
通常在 `ucuf-develop` Phase D 使用，或在 CI/CD 前作為 gate 使用。

## 使用時機

- 修改 Screen / Layout / Skin JSON 後
- 新增或修改 CompositePanel 子類後
- 在提交 PR 前
- 在執行 Cocos Editor preview 前

---

## Step 1：執行 validate-ui-specs --strict

```bash
node tools_node/validate-ui-specs.js --strict
```

**預期結果**：`0 failures, N warnings`

**重要規則（M9~M10 新增）**：

| 規則 ID | 說明 | 嚴重度 |
|---------|------|--------|
| `spec-version-mismatch` | Screen/Layout specVersion 超過引擎支援版本 (R25) | warning |
| `lazy-slot-has-fragment` | lazySlot 節點缺少 defaultFragment (R26) | warning |
| `dataSource-declared` | layout 的 dataSource 未在 contentRequirements 中宣告 (R27) | warning |
| `composite-panel-tab-route-integrity` | tabRouting 的 slotId 或 fragment 無效 (R28) | warning |

若有 warning 需確認是否為已知例外：
```bash
# 跳過特定規則（需在 screen spec 的 validation.exceptions 中正式登記）
node tools_node/validate-ui-specs.js --strict --skip-rule lazy-slot-has-fragment
```

---

## Step 2：Runtime 規則檢查（若 Cocos Editor 可用）

若 Editor 在運行中，執行資產刷新後確認控制台無錯誤：

```bash
# 刷新資產
curl.exe http://localhost:7456/asset-db/refresh
```

在 Chrome 開啟 DevTools（連接至 `http://localhost:7456`）確認：
- 無 `[CompositePanel]` 錯誤訊息
- 無 `[UISpecLoader]` 載入失敗訊息
- 無 `[R27:dataSource-declared]` 或 `[R28:composite-panel-tab-route-integrity]` 類型警告

---

## Step 3：截圖比對（若有 baseline）

若有參考截圖或 proof-contract，執行視覺比對：

```bash
# 使用 cocos-screenshot skill 截取 Editor Preview
# （見 .github/skills/cocos-screenshot/SKILL.md）
```

比對項目清單：
- [ ] lazySlot 區域正確顯示 defaultFragment 內容
- [ ] Tab 切換動畫正常（若有 transition 設定）
- [ ] Content Contract 必填欄位均有對應內容顯示
- [ ] 無白版面（空白節點）

---

## 快速指令摘要

```bash
# 1. 靜態驗證
node tools_node/validate-ui-specs.js --strict

# 2. 刷新 + 觀察 runtime
curl.exe http://localhost:7456/asset-db/refresh

# 3. 執行所有單元測試
node node_modules\ts-node\dist\bin.js --project tsconfig.test.json tests/run-cli.ts

# 4. 編碼安全檢查
node tools_node/check-encoding-touched.js --files assets/scripts/ui/components
```

---

## 相關文件

- [ucuf-develop.md](.agents/workflows/ucuf-develop.md) — 完整開發流程
- [ucuf-compliance.instructions.md](.github/instructions/ucuf-compliance.instructions.md) — 合規規則
