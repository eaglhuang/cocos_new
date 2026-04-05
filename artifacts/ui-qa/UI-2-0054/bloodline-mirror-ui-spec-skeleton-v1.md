# 血脈命鏡 ui-spec skeleton v1

對應任務：[UI-2-0060](C:\Users\User\3KLife\docs\agent-briefs\tasks\UI-2-0060.md)

## 已建立檔案

- [bloodline-mirror-main.json](C:\Users\User\3KLife\assets\resources\ui-spec\layouts\bloodline-mirror-main.json)
- [bloodline-mirror-default.json](C:\Users\User\3KLife\assets\resources\ui-spec\skins\bloodline-mirror-default.json)
- [bloodline-mirror-loading-screen.json](C:\Users\User\3KLife\assets\resources\ui-spec\screens\bloodline-mirror-loading-screen.json)
- [bloodline-mirror-awakening-screen.json](C:\Users\User\3KLife\assets\resources\ui-spec\screens\bloodline-mirror-awakening-screen.json)

## 畫面骨架

### 上層命鏡主視覺

- `LeftHero`
- `RightSpiritHero`
- `MirrorGate`
- `MirrorSigilField`
- `MeditationVessel`

### 頁首資訊

- `MirrorHeader`
- `MirrorMetaRow`

### 互動區

- `RarityAuraLabel`
- `AwakenButton`

### 下方故事帶

- `StoryCell01~05`

## State 共用策略

同一個 layout 可先支援以下 screen state：

- `bloodline-mirror-loading-screen`
- `bloodline-mirror-awakening-screen`

後續若要擴為：

- `ascension-success`
- `unowned-preview`

建議優先做 screen 層擴充，不急著重開 layout。

## 可行性評估

### 好拆

- 左右雙人物
- 中央門 / 中央定心者
- 5 格故事帶
- CTA / rarity / badge

### 中度成本

- 中央命鏡需要更成熟的圖像資產 family
- 右側英靈面要避免 generic 靈魂武將感，需要角色專屬 prompt 與 crest 語言

### 目前不要做太難

- 動態鏡面粒子大量變化
- 長時間漂浮故事跑馬燈
- 多層重疊 UI 動畫與大面積透明特效
