# MCP / Plugin 工具鏈安裝狀態

日期：`2026-04-04`

## 已完成

### Figma plugin

- 狀態：已啟用
- 設定位置：`C:\Users\User\.codex\config.toml`
- 項目：
  - `[plugins."figma@openai-curated"] enabled = true`

### Figma MCP

- 狀態：已加入 Codex 全域 MCP，且 OAuth 登入成功
- 名稱：`figma`
- 型式：streamable HTTP
- URL：`https://mcp.figma.com/mcp`

### Playwright MCP

- 狀態：已加入 Codex 全域 MCP
- 名稱：`playwright`
- 型式：stdio
- 指令：`npx @playwright/mcp@latest`

### Cocos Creator AI Plugin MCP

- 專案內狀態：已存在於 `extensions/cocos-mcp-server`
- Codex 狀態：已加入全域 MCP
- 名稱：`cocos-creator`
- 型式：HTTP
- URL：`http://127.0.0.1:3000/mcp`

備註：

- 這條線依賴 Cocos Creator 內的 `cocos-mcp-server` 擴充已啟動。
- 若 Editor 尚未啟動或擴充未啟動，Codex 雖然有設定，但不會真的連得上。

### Cocos Log Bridge

- 狀態：已安裝 repo，已加入 Codex 全域 MCP
- repo 位置：
  - `C:\Users\User\3KLife\extensions\cocosMCP`
  - `C:\Users\User\3KLife\tools_mcp\cocosMCP`
- 依賴：已用 `uv pip install --system -r requirements.txt` 安裝
- 名稱：`cocos-log-bridge`
- 型式：stdio
- 指令：
  - `uv --directory C:\Users\User\3KLife\extensions\cocosMCP\Python run server.py`

## 已知限制

### Figma

- 已登入，但要真正有產值，仍需要你們把 `General Detail / Bloodline Mirror / Spirit Tally` 做成 component library。

### Playwright

- 已安裝 MCP，但需要對應瀏覽器可檢視的目標頁面。
- 若是 Cocos Editor 內畫面，仍要走現有 preview host / Browser Review 環境。

### Cocos Creator AI Plugin MCP

- 已設定，但這條線是否可用，取決於：
  - Cocos Editor 是否開啟
  - `cocos-mcp-server` 擴充是否啟動
  - MCP HTTP endpoint 是否真的在 `3000` port

### Cocos Log Bridge

- 已安裝與註冊，但這個 repo 依賴本地 Cocos 端的 TCP bridge 與 extension 配置。
- 本回合未進行 editor-side 連線 smoke test，只完成安裝與 Codex 設定。

## 建議使用順序

1. `Figma`
   - 做 component / token / variant / 設計系統規格化
2. `cocos-creator`
   - 讀 prefab / node hierarchy / scene 資訊
3. `Playwright`
   - 做 screen-driven screenshot QA
4. `cocos-log-bridge`
   - 專門處理 log 與 scene utility 的輔助調試
