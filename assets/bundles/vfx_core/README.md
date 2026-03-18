# VFX Core Bundle 目錄說明

本目錄為核心特效資源包，未來打包時會配置為獨立的 **Asset Bundle**。

## 目錄結構區分
- `rings/`: 地板上的法陣、圓環、底座 (建議尺寸 128x128 ~ 256x256)
- `icons/`: 特效中心的主圖示，如劍、盾牌、愛心 (建議尺寸 128x128)
- `shapes/`: 較小的點綴圖形，如向上箭頭、星星、十字、爆點 (建議尺寸 64x64 ~ 128x128)

## 命名規範
一律小寫，並以 `tex_` (texture) 作為前綴代表通用貼圖：
- `tex_ring_xxx.png` (例如 tex_ring_runes_01.png)
- `tex_icon_xxx.png` (例如 tex_icon_sword_red.png)
- `tex_shape_xxx.png` (例如 tex_shape_arrow_up.png)

## 圖集與效能 (Auto Atlas)
日後請在編輯器中於 `textures` 資料夾內右鍵建立一塊 **Auto Atlas (自動圖集)**。
開發期盡情丟零散小圖進來不影響，Cocos 建置時會自動將這些小圖打包在一張 1024 或 2048 的大圖內，實現**只要 1 個 Draw Call** 就能渲染 3 層材質的效果。