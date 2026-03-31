# UI-1-0014 Artifact README

這個資料夾是 `UI-1-0014 / D-1` 的 QA 交付位置。

## 目的

驗證 `lobby-main` 畫面的：

1. `nav.ink` 按鈕家族是否已在整排導覽中成立
2. `lobby.navbar.shadow` 是否真的把底部導覽從背景拉出層次
3. 與 `docs/UI參考圖品質分析.md` 指定參考區相比，差距是否可收斂到 `30%` 內

## 對應資產

- preview host: `assets/scenes/LoadingScene.scene` → root `LoadingScene` 元件 → `previewMode=true` → `previewTarget=LobbyMain`
- screen: `assets/resources/ui-spec/screens/lobby-main-screen.json`
- layout: `assets/resources/ui-spec/layouts/lobby-main-main.json`
- skin: `assets/resources/ui-spec/skins/lobby-main-default.json`

## 目前狀態

- `UI-2-0018` 已完成，D-1 不再被 preview host 阻塞。
- `assets/scenes/LobbyScene.scene` 仍視為 legacy 手刻場景，不再作為正式截圖入口。

## 預期檔案

- `lobby-main-phone-16-9.png`
- `lobby-main-phone-19_5-9.png`
- `notes.md`

## 手動執行建議

1. 開啟 `assets/scenes/LoadingScene.scene`
2. 在 root `LoadingScene` 元件設定 `previewMode=true`、`previewTarget=LobbyMain`
3. 擷取 `16:9` 與 `19.5:9` 兩張畫面
4. 把觀察寫回 `notes.md`
