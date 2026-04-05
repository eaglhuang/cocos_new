# 角色血脈符號 Slot 契約 v1

## 目的

本文件定義角色在立繪、UI、血脈卡、英靈虎符、特種軍隊識別上的血脈符號 placement 規則。

目標是避免發生：

- 世界觀只存在於故事文案
- 血脈符號太小，看不見
- 角色本體、UI 徽記、虎符兵牌彼此像不同系統

## 基本規則

每位核心武將至少要有：

- `1 個主 slot`
- `1 個副 slot`
- `1 個可選延伸 slot`

推薦做法是 `2 主 + 2 副 + 1 延伸`。

## 主 Slot

### A. 胸甲核

- 角色最重要的血脈核心位置
- 可放：
  - 命篆核
  - 靈獸 crest 核心
  - 覺醒發光印記

### B. 腰封核

- 第二主識別位
- 適合放：
  - 家徽 / 血脈腰牌
  - 祖紋束帶
  - 中型命紋章

## 副 Slot

### C. 髮飾 / 髮冠

- 適合高階角色、女武將、文臣、王族
- 作為血脈高貴性與 lineage 身分顯示

### D. 玉佩 / 掛飾

- 適合做半透明命紋玉飾或獸印墜飾
- 對應人物頁與 icon 擴充非常方便

### E. 披肩扣件 / 肩甲扣件

- 適合軍勢型角色
- 可做成小型 crest 或雙側祖紋扣具

## 延伸 Slot

### F. 武器掛飾

- 用於名將專武、英靈面、覺醒頁
- 不宜過多，避免搶走武器本身輪廓

### G. 外袍邊紋 / 裙甲紋

- 適合做 family 一致性
- 適合低濃度重複紋樣鋪陳

### H. 虎符 / 兵牌

- 最重要的系統連接位
- 角色本體、血脈卡、虎符特種軍隊必須共用同一套主 crest 語言

## 男女角色差異

### 男武將

- 主 slot 以 `胸甲核 + 腰封核` 為核心
- 副 slot 優先 `肩甲扣件 / 武器掛飾`
- 視覺上偏剛性金屬、軍勢、權威

### 女武將

- 主 slot 同樣保留 `胸甲核 + 腰封核`
- 副 slot 可更重 `髮飾 / 玉佩 / 肩扣`
- 允許曲線玉飾與薄金屬，但不能只是裝飾珠寶，必須仍看得出是血脈識別

### 血脈面 / 英靈面

- 優先顯示：
  - 胸甲命紋核
  - 腰封血脈印帶
  - 額心 / 眼角 / 武器脈紋
- 不能做成恐怖裂痕與怪物化皮膚

## UI 對應元件

同一套 slot 語言應對應到：

- bloodline crest
- ancestral beast badge
- awakening marker
- lineage node icon
- tiger tally / spirit tally emblem

## 生圖 Prompt 實作規則

### 男武將

- `bloodline crest integrated into the breastplate`
- `ancestral emblem on the waist belt`
- `ancestral motif on shoulder armor clasp`

### 女武將

- `bloodline emblem integrated into ceremonial breastplate`
- `jade bloodline ornament at the waist`
- `ancestral beast motif in hair ornament or shoulder clasp`

### 血脈面 / 英靈面

- `bloodline sigils emerging from armor seams`
- `ancestral emblem glowing at chest core`
- `subtle bloodline markings along weapon and belt`

## 禁止事項

- 只有背景有血脈元素，角色本體完全沒有
- 符號小到像 logo 噪點
- 變成一隻可愛寵物站旁邊
- 只有顏色變化，沒有結構變化
- 隨機潑色或泛光，沒有實體 slot 承載

## 實際落地優先順序

第一波固定優先：

1. 胸甲核
2. 腰封核
3. 肩甲扣件
4. 髮飾 / 玉佩
5. 虎符 / 兵牌

這樣最符合目前產能，也最容易穩定量產。
