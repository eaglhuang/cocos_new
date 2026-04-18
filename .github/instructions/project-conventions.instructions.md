---
doc_id: doc_ai_0014
applyTo: "assets/scripts/**"
---

# 架構原則與開發慣例

## 架構原則

1. **資料驅動**: 遊戲邏輯與數據分離，用 JSON 管理配置
2. **模組解耦**: 各功能模組獨立，透過明確接口通信
3. **適合 AI / vibe coding**: 保持代碼清晰、易於理解和修改
4. **平台抽象**: 保留平台抽象層以便未來擴展
5. **持續擴充**: 架構支撐後續功能擴充，避免大規模重構
6. **代碼風格**: 簡潔易讀，遵循 TypeScript 最佳實踐，盡量添加註解
7. **性能考量**: 注意遊戲邏輯和渲染的優化空間，管理記憶體釋放與 GC

## Unity 對照學習

- 解釋 Cocos Creator 概念時，主動對照 Unity 的對應概念與設計理念
- 自動工具腳本也要說明其原理是否與 Unity 對應概念一致
- 隨專案演進，定期回顧和更新 `docs/keep.md (doc_index_0011)` (doc_index_0011) 的共識

## 日誌規範（UCUFLogger）

**強制**：`assets/scripts/` 內禁止新增裸 `console.log/warn/error`。一律透過 UCUFLogger 輸出。

```ts
import { UCUFLogger, LogCategory, LogLevel } from '../core/UCUFLogger';

UCUFLogger.debug(LogCategory.LIFECYCLE, '[MyComponent] mount');
UCUFLogger.warn(LogCategory.DATA, '[MyComponent] missing field', { key });
```

- 檔案位置：`assets/scripts/ui/core/UCUFLogger.ts`
- 現有 `LogCategory`：`LIFECYCLE` / `SKIN` / `DATA` / `PERFORMANCE` / `RULE` / `DRAG`
- 新增分類：直接在 `LogCategory` enum 補一個值即可，**不要另建 log 模組或自訂 debug flag**。
- Runtime 開關（Browser DevTools Console）：
  - `__ucuf_debug()` → 全開 DEBUG（顯示所有分類）
  - `__ucuf_quiet()` → 靜音（僅 ERROR）
  - `__ucuf_level(0)` → 手動 DEBUG
- 若要建 debug helper（e.g. `XxxDebug.ts`），其內部必須委派至 `UCUFLogger.debug()`，不得自帶獨立 toggle。
- 違規檢查：`grep_search assets/scripts/ 'console\.log'` — 看到裸 log 一律遷移或報告。

## Fragment Override 規則

Layout JSON 中使用 `$ref` 引用片段時，必須遵守以下規則：

1. **禁止覆蓋 `type` 欄位**：`type` 為 immutable key，覆蓋會破壞節點類型語意。
   - 違規範例：`{ "$ref": "fragments/widgets/panel.json", "type": "label" }` ❌
   - Runtime 會發出 warn，`validate-ui-specs.js` R18 會攔截並報 error。

2. **最小覆蓋原則**：只覆寫「確實需要客製化」的屬性（如 `id`、`style`、`texts`），不重寫整個結構。

3. **修改 fragment 前必查使用範圍**：
   ```bash
   node tools_node/build-fragment-usage-map.js --query <ref>
   ```
   確認影響範圍後再修改，避免意外破壞其他 layout。

4. **新增 widget 必須更新 registry**：
   - 新 widget 加入 `assets/resources/ui-spec/fragments/widgets/` 後，必須同步更新 `widget-registry.json`。
   - 跑 `node tools_node/validate-widget-registry.js` 確認一致。

5. **修改 fragment 後必跑驗證**：
   - `node tools_node/validate-ui-specs.js --strict`
   - `node tools_node/headless-snapshot-test.js`

## Content Contract 強化驗證規則

在 `assets/resources/ui-spec/contracts/` 中定義 content contract schema 時：

1. **有限值域欄位補 `enum`**：例如 `rarityTier` 只有固定幾個 tier 值，必須聲明 `"enum": ["common", "uncommon", "rare", "epic", "legendary"]`。

2. **數值範圍欄位補 `range`**：例如 HP 百分比進度條 `"range": [0, 1]`；SP 值 `"range": [0, 100]`。

3. **格式欄位補 `pattern`**：例如 bind path 格式 `"pattern": "^[a-z][a-zA-Z0-9.]*$"`。

4. **驗證失敗以 warnings 回報，不阻斷 runtime**：`UIContentBinder.validate()` 採寬鬆原則，warning 只記錄不崩潰；正式上線前應修正所有 warning。

5. **不得在 runtime 中直接 hardcode 欄位名**：content contract 欄位名應由 schema 定義決定，TS 端透過 `UIContentBinder.bind()` 與 schema 對接。

## Engine Adapter 使用規則

新增 UI 節點建構邏輯時，必須透過 `assets/scripts/ui/core/interfaces/` 定義的介面：

- 引擎相依代碼只能出現在 `assets/scripts/ui/platform/cocos/` 目錄。
- `NodeHandle = unknown` 型別宣告——工具端代碼不得直接型別轉換為引擎型別（如 `node as cc.Node`）。
- 新引擎支援時，在 `platform/<engine>/` 下新增實作，核心邏輯零修改。

## 治理測試防衛規則（Governance Test Guard）

**強制**：任何改動以下檔案後，必須立即跑 governance test 確認 PASS：
- `assets/scripts/ui/components/GeneralDetailComposite.ts`
- `assets/scripts/ui/components/GeneralDetailOverviewShell.ts`
- `assets/scripts/ui/scenes/LoadingScene.ts`（overview 相關 assertion）
- `assets/scripts/ui/components/` 下新增或刪除 `*.ts` 檔案

```bash
npm run test:ucuf:governance
```

- 改架構時必須**同步更新治理測試**，不可「先 skip 再說」。
- `MIGRATION_PHASE` 常數（`tests/ucuf/architectureGovernance.test.ts`）必須與實際架構狀態一致。
- 治理測試斷言不用 exact source-text match — 用 regex / JSON property 檢查，避免 formatting 變動導致 false fail。
