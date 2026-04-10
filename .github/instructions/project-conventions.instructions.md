---
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
- 隨專案演進，定期回顧和更新 `docs/keep.md` 的共識

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
