# Blank Wireframe PNG Spec v1

## 目標

定義後續所有 `AI UI proof -> wireframe` 流程中的「空白線稿底圖 PNG」規格，讓不同畫面都能用一致方式繪製：

- 結構線稿
- slot-map
- codegen 對照

## 適用範圍

- 日常人物頁
- 血脈命鏡 / 覺醒頁
- 英靈虎符詳情
- 特種軍隊圖鑑

## 輸出尺寸

### 主規格

- `1920 x 1080`
- PNG
- 72 dpi
- RGB
- 透明背景

### 行動裝置縮放基準

- 以 `1920 x 1080` 為母版
- 不另外為手機重畫一套 wireframe
- 手機適配由 widget / safe-area 規則處理

## 線稿層級

### Layer 01: Safe Area

- 顏色：`#5AA9FF`
- 線寬：`2 px`
- 用途：標示安全區，不參與正式 UI 節點

### Layer 02: Main Containers

- 顏色：`#EAC97A`
- 線寬：`4 px`
- 用途：主區塊框線
- 例如：
  - 角色立繪區
  - 主資訊卡
  - 故事 rail
  - 命鏡主視覺區

### Layer 03: Modules

- 顏色：`#8CCFC4`
- 線寬：`3 px`
- 用途：模組框
- 例如：
  - 血脈卡
  - trait card
  - crest 區
  - CTA 區

### Layer 04: Slots

- 顏色：`#C9D2D9`
- 線寬：`2 px`
- 用途：圖像 / badge / progress / story cell 實際放置區

### Layer 05: Labels

- 顏色：`#B8B8B8`
- 線寬：`1 px`
- 文字：節點名
- 字級：`20 px`

## 文字標示規則

### 命名格式

- 容器：`ContainerName`
- 模組：`ModuleName`
- 槽位：`slot: gdv3.bloodline.crest`
- 標籤：`label: gdv3.label.name`

### 顯示原則

- 一個框只標一個主名稱
- 不在同一張圖塞過多說明段落
- 太複雜時拆成：
  - `wireframe_base`
  - `slotmap_overlay`

## 空白底圖內容

每張 `blank wireframe PNG` 應包含：

1. 畫面外框
2. safe area
3. 頂部 header guide
4. 左 / 中 / 右主欄比例 guide
5. 底部 story rail guide
6. 右下角版本角標區

## 命名規則

### 空白線稿底圖

- `09_{screen}_wireframe_base_v1.png`

例：

- `09_general-detail_wireframe_base_v1.png`
- `09_bloodline-mirror_wireframe_base_v1.png`
- `09_spirit-tally-detail_wireframe_base_v1.png`

### 完整線稿

- `10_{screen}_wireframe_v1.png`

### slot-map 疊圖

- `20_{screen}_slotmap_v1.png`

## 視覺原則

- 不要放人物
- 不要放材質
- 不要放陰影特效
- 只保留結構與比例

## 與 Unity 對照

- 這張 `blank wireframe PNG`
  - 很像先畫一張 UI prefab 的 blockout 截圖底板
- `slotmap`
  - 很像把 hierarchy / rect / image slot 再疊一層註記

## 可行性評估

### 高可行

- 任何新畫面都先從空白底圖開始
- AI 與人手協作都更穩

### 建議流程

1. 先出 blank wireframe base
2. 再畫正式 wireframe
3. 再疊 slot-map
4. 再對 JSON
