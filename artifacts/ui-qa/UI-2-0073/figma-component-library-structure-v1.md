# Figma 母板結構清單 v1

日期：`2026-04-04`

## 目的

這份文件是 `General Detail / Bloodline Mirror / Spirit Tally` 第一版 Figma component library 的母板結構清單。

現階段重點不是再發散更多 proof，而是把已經收斂過的：

- `UI_PROOF_TEMPLATE`
- `wireframe`
- `slot-map`
- `ui-spec skeleton JSON`

收成同一套可量產、可對照、可交給 AI 產碼的 Figma 結構。

## 現況判定

- `Figma MCP` 已完成安裝與 OAuth。
- 但**這個聊天工作階段內的 MCP tool registry 尚未刷新**，`functions.list_mcp_resources` 仍回報 `unknown MCP server 'figma'`。
- 因此本回合無法直接在這個會話內實際讀寫 Figma 資源。
- 先落這份母板清單，待下一次會話刷新後即可直接照表建立。

## Figma 檔案層級

建議建立單一 Figma 檔案：

- 檔名：`3KLife_UI_MasterLibrary_v1`

建議 page：

1. `00_Cover`
2. `01_Tokens`
3. `02_Common Components`
4. `03_General Detail`
5. `04_Bloodline Mirror`
6. `05_Spirit Tally`
7. `06_Story Strip`
8. `07_Badges & Markers`
9. `08_Wireframe Bases`
10. `09_Proof Mapping`

## 01 Tokens

### Color Tokens

- `surface.parchment.base`
- `surface.parchment.elevated`
- `surface.nightjade.base`
- `surface.nightjade.deep`
- `accent.gold.soft`
- `accent.gold.legendary`
- `accent.teal.muted`
- `accent.teal.bloodline`
- `accent.silver.moon`
- `text.dark.primary`
- `text.dark.secondary`
- `text.light.primary`
- `text.light.secondary`
- `state.unowned.veil`

### Radius Tokens

- `radius.card.sm`
- `radius.card.md`
- `radius.badge.round`
- `radius.story.cell`

### Spacing Tokens

- `space.4`
- `space.8`
- `space.12`
- `space.16`
- `space.20`
- `space.24`
- `space.32`

### Effect Tokens

- `glow.legendary.soft`
- `glow.bloodline.crest`
- `veil.unowned.default`
- `frame.inner.softshadow`

## 02 Common Components

### 通用卡框

- `Frame/Card/Base`
- `Frame/Card/Bloodline`
- `Frame/Card/Legend`

### 通用標題列

- `Header/Nameplate`
- `Header/SectionTitle`
- `Header/SectionTitle with Icon`

### 通用資訊列

- `Info/ValueRow`
- `Info/StatPill`
- `Info/BadgePill`
- `Info/ProgressBar`

### 通用圖騰 / crest

- `Crest/Bloodline/Base`
- `Crest/Bloodline/Legendary`
- `Crest/Bloodline/Locked`

## 03 General Detail

這一頁對應：

- `general-detail-bloodline-v3-main.json`
- `general-detail-bloodline-v3-default.json`
- `general-detail-bloodline-v3-screen.json`

### 主 frame

- `Screen/GeneralDetail/V3`

### 子元件

- `GD/PortraitCarrier`
- `GD/InfoCardRoot`
- `GD/Nameplate`
- `GD/RarityRow`
- `GD/AttributeGrid`
- `GD/RoleCard`
- `GD/TraitCard`
- `GD/BloodlineCard`
- `GD/BloodlineSummary`
- `GD/BloodlinePersonality`
- `GD/BloodlineAwakeningBar`
- `GD/BloodlineCrest`
- `GD/StoryStrip6`

### 變體

- `owned`
- `unowned`
- `locked-bloodline`
- `legendary`
- `normal`

### 必備 slot 命名

- `gdv3.portrait`
- `gdv3.nameplate`
- `gdv3.rarity`
- `gdv3.attributes`
- `gdv3.role`
- `gdv3.traits`
- `gdv3.bloodline.card`
- `gdv3.bloodline.crest`
- `gdv3.story.01` ~ `gdv3.story.06`
- `gdv3.unowned.ribbon`
- `gdv3.unowned.badge`

## 04 Bloodline Mirror

這一頁對應：

- `bloodline-mirror-main.json`
- `bloodline-mirror-default.json`
- `bloodline-mirror-loading-screen.json`
- `bloodline-mirror-awakening-screen.json`

### 主 frame

- `Screen/BloodlineMirror/V3`

### 子元件

- `BM/PublicHeroPanel`
- `BM/SpiritHeroPanel`
- `BM/CenterGate`
- `BM/CenterMeditationVessel`
- `BM/MirrorFogBlend`
- `BM/StoryStrip5`
- `BM/TipsBar`
- `BM/UnownedVeil`
- `BM/ConfirmCTA`

### 變體

- `loading`
- `awakening`
- `owned`
- `unowned`
- `legendary`
- `epic`
- `rare`

### 必備 slot 命名

- `mirror.hero.public`
- `mirror.hero.spirit`
- `mirror.center.gate`
- `mirror.center.vessel`
- `mirror.story.01` ~ `mirror.story.05`
- `mirror.tips`
- `mirror.unowned.veil`
- `mirror.unowned.badge`
- `mirror.confirm.cta`

## 05 Spirit Tally

這一頁對應：

- `spirit-tally-detail-main.json`
- `spirit-tally-detail-default.json`
- `spirit-tally-detail-screen.json`
- `elite-troop-codex-main.json`
- `elite-troop-codex-default.json`
- `elite-troop-codex-screen.json`

### 主 frame

- `Screen/SpiritTally/Detail`
- `Screen/EliteTroop/Codex`

### 子元件

- `ST/HeroEchoPortrait`
- `ST/TallyCard`
- `ST/CrestPanel`
- `ST/LineagePanel`
- `ST/EliteTroopPanel`
- `ST/BloodlineTierRow`
- `ST/InsertActionBar`
- `ET/CodexHeader`
- `ET/TroopList`
- `ET/TroopDetail`

### 必備 slot 命名

- `spirit.hero.echo`
- `spirit.tally.card`
- `spirit.crest`
- `spirit.lineage`
- `spirit.eliteTroop`
- `spirit.action.insert`
- `elite.codex.list`
- `elite.codex.detail`

## 06 Story Strip

### 基底

- `StoryStrip/Cell`
- `StoryStrip/Cell with Caption`
- `StoryStrip/Rail/5`
- `StoryStrip/Rail/6`

### 用途

- `General Detail` 使用 `6 格`
- `Bloodline Mirror` 使用 `5 格`

### Slot 命名規則

- `story.cell.01`
- `story.cell.02`
- `story.cell.03`
- `story.cell.04`
- `story.cell.05`
- `story.cell.06`

## 07 Badges & Markers

### 未持有

- `Badge/Unowned/Ribbon`
- `Badge/Unowned/Seal`
- `Badge/Unowned/Veil`

### 稀有度

- `Badge/Rarity/Common`
- `Badge/Rarity/Rare`
- `Badge/Rarity/Epic`
- `Badge/Rarity/Legendary`

### 血脈

- `Badge/Bloodline/Crest`
- `Badge/Bloodline/Tier`
- `Badge/Bloodline/Awakening`

## 08 Wireframe Bases

這一頁放空白線稿 PNG 對照底板：

- `Wireframe/GeneralDetail/1920x1080`
- `Wireframe/BloodlineMirror/1920x1080`
- `Wireframe/SpiritTally/1920x1080`

用途：

- 對照 `03_wireframe`
- 對照 `04_slotmap`
- 讓 AI 產碼時有固定 hierarchy 參考

## 09 Proof Mapping

這一頁不做設計，只做 proof 對照：

- `proof image`
- `selected proof`
- `wireframe`
- `slot-map`
- `skeleton json path`

建議欄位：

- `screen id`
- `proof version`
- `figma frame`
- `layout json`
- `skin json`
- `screen json`

## 建立順序

1. 先建 `01 Tokens`
2. 再建 `02 Common Components`
3. 接著建 `03 General Detail`
4. 再建 `04 Bloodline Mirror`
5. 再建 `05 Spirit Tally`
6. 最後補 `06 Story Strip / 07 Badges / 08 Wireframe Bases / 09 Proof Mapping`

## 與 Unity 的對照

- `Figma component library` 很像 Unity 的 `Prefab Variant + UI Style Guide`
- `Token` 很像 Unity 裡的 `Theme ScriptableObject / 常數樣式表`
- `slot naming` 很像 Unity prefab hierarchy 的固定 child path
- `Proof Mapping` 很像把 concept board 對回 prefab contract 與場景引用表

## 下一步

待 MCP 會話刷新後，直接依這份清單在 Figma 建第一版母板，並回填：

- frame URL
- component 數量
- variant 數量
- 與 `ui-spec skeleton` 的對應完成度
