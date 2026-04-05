# Figma + Cocos MCP + Playwright 量產流程補遺

日期：`2026-04-04`

## 正式定位

本專案未來的高品質 UI 量產流程，正式採用下列五段式：

1. `AI proof`
2. `wireframe`
3. `slot-map`
4. `Figma component / token 規格化`
5. `Cocos ui-spec skeleton + Playwright QA`

## 實作原則

- `proof` 不直接等於實作。
- `Figma` 不取代 repo 內的 `layout / skin / screen JSON`，而是作為規格中介層。
- `slot-map` 仍然是 Cocos 實作前的必要契約。
- `Playwright` 作為 screen-level QA，不取代美術審圖。
- `cocos-creator MCP` 只先用於讀取、scaffold、輔助建骨架，不直接對既有複雜畫面做大規模自動改寫。

## 對應既有流程

- `docs/UI品質參考圖/UI_PROOF_TEMPLATE`
  - 持續作為 proof / wireframe / slot-map / codegen-ready 的資料夾母板
- `assets/resources/ui-spec/layouts`
  - 對應 node tree / slot 區塊
- `assets/resources/ui-spec/skins`
  - 對應 token / family / variant
- `assets/resources/ui-spec/screens`
  - 對應 route / state / scene context

## 安裝現況

- `figma` MCP：已註冊並登入
- `playwright` MCP：已註冊
- `cocos-creator` MCP：已註冊，待 editor-side smoke test
- `cocos-log-bridge` MCP：已註冊，待 editor-side smoke test
- `figma` curated plugin：已啟用

## 參考

- [UI-2-0073 README](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0073\README.md)
- [量產流程藍圖 v1](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0073\figma-cocos-playwright-production-blueprint-v1.md)
- [安裝狀態](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0073\mcp-toolchain-install-status-2026-04-04.md)
