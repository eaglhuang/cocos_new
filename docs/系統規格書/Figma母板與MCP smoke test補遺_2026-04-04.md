# Figma 母板與 MCP Smoke Test 補遺

日期：`2026-04-04`

## 目的

把 `UI_PROOF_TEMPLATE -> Figma -> slot-map -> ui-spec skeleton -> Playwright QA` 這條新量產流程，正式補進系統規格層，並註記目前 MCP 工具鏈的實測狀態。

## 1. Figma 母板建立原則

本專案後續不應再以「單張 proof 圖」直接進行 UI 量產，而應固定經過下列層級：

1. `AI proof`
2. `selected proof`
3. `wireframe`
4. `slot-map`
5. `Figma component library`
6. `ui-spec skeleton`
7. `Cocos scaffold / Playwright QA`

### 第一批必建 screen family

- `General Detail`
- `Bloodline Mirror`
- `Spirit Tally`

### 第一批必建 Figma page

- `01_Tokens`
- `02_Common Components`
- `03_General Detail`
- `04_Bloodline Mirror`
- `05_Spirit Tally`
- `06_Story Strip`
- `07_Badges & Markers`
- `08_Wireframe Bases`
- `09_Proof Mapping`

## 2. Figma 母板不是自由發揮頁

Figma 在本專案的角色，應視為：

- Unity 的 `Prefab Variant + Theme Guide + UI Contract`

而不是單純視覺稿。

因此每個母板都必須對應：

- 固定 slot 命名
- 固定 component 變體
- 固定 badge / marker family
- 固定 story strip rail
- 固定 JSON skeleton screen id

## 3. MCP 工具鏈狀態

### 已確認可用

- `cocos-creator`

說明：

- Cocos Editor 已運行於 `http://127.0.0.1:7456`
- `http://127.0.0.1:3000/mcp` 已完成 `initialize` 測試
- 可判定 Editor 端 `cocos-mcp-server` 已通

### 已安裝，待會話刷新

- `figma`
- `playwright`

說明：

- 兩者已在 Codex CLI 層級完成註冊
- 但本聊天工作階段內的 developer MCP tool registry 尚未刷新
- 因此需要下一次會話再做真正的資源讀寫 smoke test

### 已安裝，待 Editor 端橋接驗證

- `cocos-log-bridge`

說明：

- Python server 啟動相容性已修正
- stdio 啟動命令已可用
- 但仍需驗證 Editor 端 TCP bridge（預設 `::1:6400`）是否真的回傳 scene / log 工具結果

## 4. 後續執行規則

### 若 MCP tool registry 已刷新

下一輪優先順序：

1. 直接在 Figma 建立 `General Detail / Bloodline Mirror / Spirit Tally` 母板
2. 回填 frame URL 與 component 數量
3. 實測 Playwright 對 Browser Review 的 screenshot QA
4. 補做 `cocos-log-bridge` 的 query / scene smoke test

### 若 MCP tool registry 尚未刷新

則先沿用本輪已產出的：

- `Figma 母板結構清單`
- `slot-map`
- `ui-spec skeleton`

由人工或下一輪會話照表建立，不阻塞整體流程。

## 5. 對 Cocos / Unity 的實作意義

- `Figma component library` 對等 Unity 的 UI prefab family 規劃
- `ui-spec skeleton JSON` 對等 Unity 的 prefab hierarchy + screen route contract
- `Playwright QA` 對等 Unity 裡做 Game View regression capture
- `cocos-creator MCP` 對等可程式化呼叫 Editor API 的 gateway

## 6. 參考文件

- [figma-component-library-structure-v1.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0073\figma-component-library-structure-v1.md)
- [mcp-smoke-test-report-2026-04-04.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0073\mcp-smoke-test-report-2026-04-04.md)
- [figma-cocos-playwright-production-blueprint-v1.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0073\figma-cocos-playwright-production-blueprint-v1.md)
