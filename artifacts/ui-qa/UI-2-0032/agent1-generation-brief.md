# UI-2-0032 Agent1 Generation Brief

## 任務定位

- 上游研究：`UI-2-0035`
- 上游基線：`UI-2-0028`
- 本輪目標：把 `unitinfo.type.icon` 從 v1 baseline 推到可作為 BattleScene `F7 戰場微型 badge` 母版的 v2 候選稿

## 這次不要做成什麼

- 不要做成乾淨、現代、太對稱的 app icon
- 不要做成 `F5/F6` 那種資源格 / 收藏物件縮圖
- 不要做成 `F8` 主操作按鈕的厚重大按鈕
- 不要用高亮霓虹藍、科技藍、塑膠亮面
- 不要讓槍身太細，避免 32x32 時變成雜訊

## 這次要做成什麼

- family：`F7 戰場微型屬性 badge`
- 使用位置：`unitinfo.type.icon`，也可作為後續頭像旁兵種 badge 的母版
- 目標觀感：
  - 深色戰場背景上能一眼讀到
  - 像舊戰棋 / 收藏 RPG 裡的兵種徽章
  - 有厚度、有做舊，但不過度華麗

## 視覺規格

### 1. Carrier

- 主體採「厚邊舊徽章 / 舊幣感圓章」
- 外圈不要完全幾何完美，允許輕微手工感與磨耗
- 建議結構：
  - 外圈：舊金或黯金金屬 rim
  - 內盤：深灰藍 / 墨藍 / 槍鐵藍底
  - 內外圈之間可有一圈暗溝或陰影帶

### 2. Glyph

- 主 glyph 為「交叉長槍 / 槍戟」兵種語意
- glyph 必須比 v1 更粗、更集中、更像實心剪影
- 允許保留小紅點作為中心綁帶 / 漆印，但不能搶過主 glyph
- 槍頭與槍柄要在 32x32 時仍保有清楚交叉形

### 3. 配色

- 主色群：
  - 舊金 / 黯金 rim
  - 墨藍 / 槍鐵藍內盤
  - 骨白 / 淺鐵白 glyph
  - 暗紅小點綴
- 禁止：
  - 螢光藍
  - 高飽和亮紅
  - 乾淨玩具感的純黃金

### 4. 材質

- 需要：
  - 金屬邊緣磨耗
  - 內陰影
  - 輕微髒污 / 斑駁
  - 微弱不均勻高光
- 不需要：
  - 大面積 glow
  - 鏡面反射
  - 過於乾淨的向量平塗

## 尺寸驗收

- 必交：
  - `128x128`
  - `64x64`
  - `32x32`
- 驗收重點：
  - `32x32` 仍能立刻辨識「槍類兵種」
  - rim 不可薄到縮小後消失
  - glyph 不可細到變成兩條糊線

## 建議輸出

- 至少 3 張方向變體：
  - `v2a`：偏穩定、最接近現在 v1 但更厚重
  - `v2b`：更舊幣 / 勳章感
  - `v2c`：更偏戰場 badge、對比最高
- 檔案格式：
  - 透明底 PNG
- 命名建議：
  - `unitinfo_type_icon_spear_v2a_128.png`
  - `unitinfo_type_icon_spear_v2a_64.png`
  - `unitinfo_type_icon_spear_v2a_32.png`

## 可直接使用的生成描述

```text
old military badge for spear troop type, dark gunmetal blue inner disk, worn antique gold rim, bold crossed spear silhouette, off-white metal glyph, tiny muted red center tie, subtle grime, inner shadow, uneven worn edges, readable at 32x32, no modern app icon look, no neon, no plastic gloss, transparent background
```

## 可直接使用的負面限制

```text
modern flat ui, clean vector icon, neon blue, sci-fi hologram, toy plastic, glossy enamel, thin lines, symmetric perfect circle, mobile app icon, reward item thumbnail, inventory loot style
```

## QA 回收方式

- 產出後直接放回 `artifacts/ui-qa/UI-2-0032/`
- 與 `baseline-compare-board.png` 並排比較
- 若只允許先選一張，優先挑：
  - `32x32` 最清楚
  - carrier 最不現代
  - 最不像獎勵格小物件
