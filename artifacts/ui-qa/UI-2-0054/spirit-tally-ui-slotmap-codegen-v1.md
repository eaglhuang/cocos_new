# Spirit Tally / Elite Troop UI Slot-Map Codegen v1

## 範圍

本文件把 `虎符 / 英靈卡 / 特種軍隊` 三條線整理成可對照 `wireframe / slot-map / codegen-ready` 的實作骨架。

已涵蓋：

1. 戰場虎符卡列：沿用既有 `tiger-tally-*`
2. 英靈虎符詳情：新增 `spirit-tally-detail-*`
3. 特種軍隊圖鑑：新增 `elite-troop-codex-*`

## A. 戰場虎符卡列

現有骨架：

- `layouts/tiger-tally-main.json`
- `skins/tiger-tally-default.json`
- `screens/tiger-tally-screen.json`

定位：
- 戰場即時操作 UI
- 四張卡固定卡列
- 更偏戰術與部署

## B. 英靈虎符詳情

新增骨架：

- `layouts/spirit-tally-detail-main.json`
- `skins/spirit-tally-detail-default.json`
- `screens/spirit-tally-detail-screen.json`

### Wireframe 分區

1. 左：英靈卡主視覺
2. 中：英靈效果 / 血脈加成 / 共鳴 / 升階
3. 右：特種軍隊對應與摘要
4. 下：裝備 / 升階 / 軍隊詳情 CTA

### 核心節點

- `SpiritCardArt`
- `HeroGhostPortrait`
- `BloodlineCrest`
- `SpiritTraitsPanel`
- `BloodlineBoostPanel`
- `ResonancePanel`
- `UpgradeTrackPanel`
- `EliteTroopPanel`
- `TroopBanner`
- `TroopUnitArt`
- `TroopCrest`

### Slot-map 重點

- `std.art.spirit-card`
- `std.art.hero-ghost`
- `std.crest`
- `std.art.troop-banner`
- `std.art.troop-unit`
- `std.art.troop-crest`

## C. 特種軍隊圖鑑

新增骨架：

- `layouts/elite-troop-codex-main.json`
- `skins/elite-troop-codex-default.json`
- `screens/elite-troop-codex-screen.json`

### Wireframe 分區

1. 左：篩選 rail
2. 中：軍隊卡片 grid
3. 右：選中項詳情

### 詳情區要點

- `SelectedTroopBanner`
- `SelectedTroopCrest`
- `SelectedTroopStats`
- `SelectedTroopLore`
- `LinkedHeroPanel`

### Codegen-ready 原則

- grid 固定先做 3x2
- 右詳情 panel 固定做 banner / crest / stats / lore / linked hero 五塊
- 不要讓 AI 自由猜 detail panel 結構

## D. 與世界觀的對應

### 英靈虎符

- 是 `血脈卡的軍勢化載體`
- UI 上必須同時看到：
  - 英靈卡本體
  - 血脈 crest
  - 對應軍隊

### 特種軍隊

- 不是 generic 兵種
- 必須明確知道它來自哪位名將的英靈與血脈

### 共通視覺語言

三套都應吃同一組 family：

1. 角色 crest
2. 英靈卡 crest
3. 虎符 crest
4. 軍隊 banner / armor / badge

## E. 可行性評估

### 高可行

- 先做詳情頁與圖鑑頁骨架
- 先用靜態 art slot 承接資料
- 與現有 `tiger-tally` family 共構

### 中可行

- 若要把同一角色的英靈卡、虎符、軍隊做成完整 family，需要中期持續補圖

### 目前不建議

- 英靈卡翻面動畫
- 虎符展開變形
- 軍隊旗紋粒子化召喚

原因：
- 這些都比較吃動畫與 FX，不是當前最佳投資點。
