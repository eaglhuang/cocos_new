# UI-1-0015 Artifact README

這個資料夾是 `UI-1-0015 / D-2` 的 QA 交付位置。

## 目的

驗證 `shop-main` 與 `gacha` 在同一個 light-surface 家族下是否具備一致的材質語言與層級感。

## 對應資產

- preview host: `assets/scenes/LoadingScene.scene` → root `LoadingScene` 元件 → `previewMode=true` → `previewTarget=ShopMain / Gacha`
- semantic target: `common-parchment / light-surface carrier consistency`
- shop screen: `assets/resources/ui-spec/screens/shop-main-screen.json`
- shop layout: `shop-main-main`
- shop skin: `assets/resources/ui-spec/skins/shop-main-default.json`
- gacha screen: `assets/resources/ui-spec/screens/gacha-screen.json`
- gacha sub-screen: `gacha-main`
- gacha skin: `assets/resources/ui-spec/skins/gacha-default.json`

## 目前阻塞

- `UI-2-0018` 與 `UI-2-0019` 已完成。
- 目前只剩 `UI-2-0020` 尚未把 `shop-main` / `gacha` 接上可供對照的 shared light-surface target，因此 D-2 仍維持 blocked。

## 預期檔案

- `shop-main-phone-16-9.png`
- `shop-main-phone-19_5-9.png`
- `gacha-main-phone-16-9.png`
- `gacha-main-phone-19_5-9.png`
- `notes.md`
