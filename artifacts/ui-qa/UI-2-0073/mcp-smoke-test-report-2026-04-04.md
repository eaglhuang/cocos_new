# MCP Smoke Test 報告

日期：`2026-04-04`

## 測試目的

確認下列工具是否已達到「可用於後續 UI 量產流程」的最低門檻：

- `figma`
- `cocos-creator`
- `cocos-log-bridge`
- `playwright`

## 測試結果摘要

| 工具 | 安裝狀態 | 本機服務狀態 | 本會話可直接透過 developer MCP tool 使用 | 判定 |
|---|---|---|---|---|
| `figma` | 已完成 | 已登入 OAuth | 否 | 已安裝，待會話刷新 |
| `cocos-creator` | 已完成 | 可連 | 否 | HTTP MCP 已通 |
| `cocos-log-bridge` | 已完成 | 可啟動，但仍待 Editor 端橋接驗證 | 否 | 半通，待 bridge smoke test |
| `playwright` | 已完成 | 已註冊 | 否 | 已安裝，待會話刷新 |

## 1. Figma MCP

### 已完成

- 已透過 `codex mcp add` 註冊 `figma`
- 已完成 OAuth
- `C:\Users\User\.codex\config.toml` 已啟用 `figma@openai-curated`

### 本會話狀態

`functions.list_mcp_resources` 回傳：

- `unknown MCP server 'figma'`

### 判定

這不是安裝失敗，而是**本聊天工作階段的 MCP tool registry 尚未刷新**。

### 結論

- `Figma MCP` 已安裝成功
- 要在這個介面內直接讀寫 Figma，需在下一次會話或 MCP registry 刷新後再測

## 2. Cocos Creator MCP

### Editor 狀態

`http://127.0.0.1:7456` 回應 `200`

代表 Cocos Editor 正在運行。

### HTTP MCP 測試

對 `http://127.0.0.1:3000/mcp` 發送 `initialize` JSON-RPC 後，收到：

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"cocos-mcp-server","version":"1.0.0"}}}
```

### 判定

這代表：

- `cocos-mcp-server` 插件已在 Editor 端啟動
- `3000` port 已可用
- MCP initialize 已成功

### 結論

`cocos-creator` 這條**不是只有 port 活著，而是真的已經通過 MCP 初始化**。

## 3. Cocos Log Bridge

### 已完成

- 已將 `cocosMCP` repo 放入：
  - `extensions/cocosMCP`
  - `tools_mcp/cocosMCP`
- 已安裝 Python requirements
- 已修正 `FastMCP` 初始化參數，將 `description` 改為 `instructions`
- 已重新註冊 `cocos-log-bridge`：

```text
uv --directory C:\Users\User\3KLife\extensions\cocosMCP\Python run --with mcp --with typing-extensions --with dataclasses server.py
```

### 本次 smoke test

- 直接執行 server 啟動命令時，程序不會立即噴出 Python 參數錯誤
- 但在非 MCP host 管理下，它會很快結束，這符合 stdio MCP 在沒有持續 stdin/stdio host 時的常見行為

### 風險點

`cocos-log-bridge` 還依賴另一條 Editor 端 TCP 橋接：

- 預設 `IPv6 ::1`
- port `6400`

目前尚未完成這條 TCP bridge 的端到端功能驗證，因此無法宣告「所有 log / scene tools 已 fully ready」。

### 結論

- 安裝與啟動命令已修到可用狀態
- 真正的 Editor 橋接 smoke test 仍需下一輪在工具 registry 刷新後補做

## 4. Playwright MCP

### 已完成

- 已透過 `codex mcp add` 註冊 `playwright`
- `codex mcp list` 顯示啟用狀態

### 本會話狀態

和 `figma` 相同，本聊天工作階段內的 developer MCP tool registry 尚未刷新，因此無法直接用 `functions.list_mcp_resources` 驗證它。

### 結論

- `Playwright MCP` 已安裝成功
- 待下一次會話刷新後補做實際 browser automation smoke test

## 實際可用性判定

### 目前已可確認可用

- `cocos-creator` HTTP MCP

### 已安裝但待會話刷新

- `figma`
- `playwright`

### 已安裝但待 Editor 端橋接驗證

- `cocos-log-bridge`

## 建議下一步

1. 重新開一個新會話，確認 developer MCP tool registry 已看得到：
   - `figma`
   - `cocos-creator`
   - `cocos-log-bridge`
   - `playwright`
2. 新會話先做 `figma` component library 建立
3. 再做 `playwright` 對 Browser Review 的 screenshot smoke test
4. 最後補 `cocos-log-bridge` 的 log / scene 工具端到端驗證

## 與 Unity 的對照

- `cocos-creator` MCP 現在的狀態，很像 Unity Editor 已經有可呼叫的 Editor API gateway
- `cocos-log-bridge` 則像另一個依賴 Editor-side runtime bridge 的外掛，外掛本身已裝好，但還要確認 editor runtime callback 真的有接上
