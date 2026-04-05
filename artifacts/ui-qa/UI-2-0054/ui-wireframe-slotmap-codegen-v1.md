# UI Wireframe / Slot-Map / Codegen v1

## 目標

把目前已定稿到 `v3` 的兩套畫面：

- `General Detail Bloodline V3`
- `Bloodline Mirror`

整理成可以直接對照：

1. 視覺 proof 圖
2. UI 結構線稿
3. `ui-spec` layout / skin / screen JSON
4. 後續 AI 產碼或 prefab 節點命名

## 使用方式

### Step 1. 視覺 proof

用途：
- 確認氛圍、比例、資訊分區、故事帶節奏

來源：
- 日常人物頁 v3 proof
- 血脈命鏡 / 覺醒頁 v3 proof

### Step 2. 線稿 wireframe

用途：
- 把 proof 壓回結構線
- 明確標出每個 slot 與 hierarchy

要求：
- 只保留框、分區、節點標籤
- 不保留人物材質與渲染細節
- 每個大區塊對應一個 root node

### Step 3. slot-map

用途：
- 對照哪一塊是資料槽、哪一塊是圖像槽、哪一塊是 style slot

### Step 4. codegen-ready

用途：
- 提供 AI 或工具腳本直接生成 Cocos UI 節點
- 節點命名、尺寸、widget 錨定、style slot 都可直接引用

---

## A. General Detail Bloodline V3

### A1. 視覺分區

1. 左：角色立繪區
2. 右：資訊卡
3. 下：六格故事帶

### A2. Wireframe 命名

- `GeneralDetailBloodlineRoot`
- `BackgroundFull`
- `PortraitCarrier`
- `PortraitImage`
- `UnownedPortraitRibbon`
- `UnownedPortraitHint`
- `InfoCard`
- `InfoContent`
- `HeaderRow`
- `MetaColumn`
- `CoreStatsCard`
- `RoleCard`
- `TraitCard`
- `BloodlineSummaryCard`
- `BloodlineCrestCard`
- `BloodlineSummaryFields`
- `BloodlineCrest`
- `StoryStripRail`
- `StoryStrip`
- `StoryCell01~06`

### A3. Slot-map 類型

#### 圖像槽

- `gdv3.bg.full`
- `gdv3.portrait.carrier`
- `gdv3.portrait.image`
- `gdv3.unowned.ribbon`
- `gdv3.unowned.badge`
- `gdv3.bloodline.crest`
- `gdv3.story.rail`
- `gdv3.story.cell`
- `gdv3.story.cell.turn`
- `gdv3.story.cell.bloodline`
- `gdv3.story.cell.future`

#### 模組槽

- `gdv3.info.card`
- `gdv3.module.card`
- `gdv3.bloodline.card`
- `gdv3.bloodline.crest.card`
- `gdv3.progress.awakening`

#### 字樣槽

- `gdv3.label.name`
- `gdv3.label.title`
- `gdv3.label.meta`
- `gdv3.label.section`
- `gdv3.label.value`
- `gdv3.label.note`
- `gdv3.label.unowned`

### A4. Codegen-ready 原則

- 左立繪與右資訊卡固定為兩大 root sibling。
- 故事條永遠獨立為底部 rail + strip。
- 六格故事不可拆成任意數量，v1 先固定為 6。
- 未持有狀態用 `ribbon + hint + badge`，不要額外生成第二套 layout。

### A5. 實作難度

#### 好做

- 基本容器、panel、image、label、progress
- 故事六格固定 slot
- 未持有 ribbon / badge

#### 中等

- 血脈區要維持同一頁深層人格感，需要 skin family 一致

#### 不建議自動做太滿

- 長段落故事自動排版
- 立繪上血脈符號細節自動拼接

---

## B. Bloodline Mirror

### B1. 視覺分區

1. 上方主視覺：左現世面 / 中命鏡裂隙 / 右血脈面
2. 中下：定心者 + 稀有度 aura + CTA
3. 下方：五格命運故事帶

### B2. Wireframe 命名

- `BloodlineMirrorRoot`
- `MirrorBackground`
- `LeftHero`
- `RightSpiritHero`
- `UnownedVeil`
- `UnownedBadge`
- `UnownedHint`
- `MirrorGate`
- `MirrorSigilField`
- `MeditationVessel`
- `MirrorHeader`
- `MirrorMetaRow`
- `ActionArea`
- `AwakenButton`
- `StoryRail`
- `StoryStrip`
- `StoryCell01~05`
- `SideMarkers`

### B3. Slot-map 類型

#### 圖像槽

- `mirror.bg.full`
- `mirror.hero.public`
- `mirror.hero.spirit`
- `mirror.unowned.veil`
- `mirror.unowned.badge`
- `mirror.gate`
- `mirror.sigil.field`
- `mirror.vessel.legendary`
- `mirror.badge.small`
- `mirror.story.rail`
- `mirror.story.cell.mortal`
- `mirror.story.cell.rise`
- `mirror.story.cell.crisis`
- `mirror.story.cell.awaken`
- `mirror.story.cell.spirit`

#### 字樣槽

- `mirror.label.header`
- `mirror.label.name`
- `mirror.label.rarity`
- `mirror.label.button`
- `mirror.label.marker.public`
- `mirror.label.marker.spirit`
- `mirror.label.unowned`

### B4. Codegen-ready 原則

- 左右雙面角色一定是兩個獨立 image node，不可用同 node 疊 ghost。
- 中央命鏡門與 sigil field 分開，方便後續替換成 Loading / 覺醒兩種氣氛。
- 定心者視為獨立 aura 載具，不與 story rail 合併。
- 故事條固定五格，先不要自動生成可變長 carousel。

### B5. 實作難度

#### 好做

- 雙立繪 + 中央門 + 底部五格故事
- CTA 區與 rarity 顯示
- 未持有 veil / badge / hint

#### 中等

- 中央門的氣氛如果想做出高級感，後續仍需美術圖資與少量 FX

#### 偏難

- 若要做真正動態鏡像融合、流動命紋、故事帶慢速輪播，現階段不建議直接上

---

## C. AI 產碼注意事項

### 建議讓 AI 直接吃的輸入

1. proof 圖
2. wireframe 線稿圖
3. 本文件的節點命名
4. 對應 layout / skin / screen JSON

### 建議不要直接讓 AI 自由猜的部分

- 故事格數
- 節點 hierarchy
- 未持有狀態規則
- 左右雙面是否為獨立角色節點

### 對 Unity 習慣的對照

- `layout JSON`
  - 類似 Unity 的 UI prefab 結構描述
- `skin JSON`
  - 類似 prefab style / sprite assignment / theme table
- `screen JSON`
  - 類似一個 screen prefab 的 route / binding 設定

---

## 結論

目前這兩套頁面都已經進入：

> `proof 可對照 -> wireframe 可拆 -> slot-map 可綁 -> codegen 可落`

真正還需要人工主導的，是 `美術 family 一致性`，而不是 UI 骨架本身。
