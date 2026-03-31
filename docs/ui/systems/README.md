# UI 系統規格目錄說明

此目錄按系統功能分設子目錄，用於管理各 UI 系統的規格文件。

## 目錄規則

1. **目錄名稱** = 系統名稱（kebab-case），如 `general-list/`、`battle-hud/`
2. **空目錄** = 尚未定義規格，AI 可根據截圖或 design-brief 自行推斷
3. **有 spec.md** = 已定義規格，AI **必須嚴格遵守**規格內容

## 已建立的系統目錄

| 目錄 | 系統 | 狀態 |
|------|------|------|
| `general-list/` | 武將列表 | 📋 待定義 |
| `general-detail/` | 武將詳情 | 📋 待定義 |
| `battle-hud/` | 戰鬥 HUD | 📋 待定義 |
| `battle-log/` | 戰鬥記錄 | 📋 待定義 |
| `deploy-panel/` | 部署面板 | 📋 待定義 |
| `duel-challenge/` | 單挑挑戰 | 📋 待定義 |
| `result-popup/` | 結算彈窗 | 📋 待定義 |
| `lobby-main/` | 大廳主畫面 | 📋 待定義 |
| `toast-message/` | Toast 提示 | 📋 待定義 |
| `network-status/` | 網路狀態 | 📋 待定義 |
| `shop-main/` | 商城主頁 | 📋 待定義 |

## spec.md 格式

每個系統的 `spec.md` 應遵循以下結構：

```markdown
# {系統中文名}

## 功能描述
## 規格約束
## 互動規則
## 節點結構要求
## 設計參考
```
