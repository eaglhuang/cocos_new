# 3KLife Design System — Claude Code 開發交接包
> 版本：2026-04-22　｜　設計保真度：**高保真 (Hi-Fi)**

---

## ⚠️ 重要說明

本包中的 HTML 檔案是**設計參考原型**，由 HTML/CSS 製作，用於視覺預覽。  
你的任務是：**在 Cocos Creator 專案（`3KLife/`）中，用現有的 UCUF 架構重現這些設計**。  
不要直接把 HTML 用在遊戲裡。

---

## 一、專案架構快速導覽

```
3KLife/assets/
├─ scripts/ui/
│  ├─ core/           ← UCUF 核心（CompositePanel、UILayoutConfig、UIPreviewBuilder 等）
│  ├─ components/     ← 各畫面的 Composite + Panel TS 檔
│  │  ├─ general-detail/   ← 人物詳情（已有！）
│  │  ├─ battle-hud-overlay/
│  │  └─ shop-main/
│  ├─ panels/         ← BloodlineTreePanel（進行中）
│  └─ scenes/         ← LobbyScene、LoadingScene、LoginScene
├─ resources/ui-spec/
│  ├─ layouts/        ← JSON 佈局定義（這是主要工作區）
│  ├─ fragments/      ← 可重用 widget/layout/skin 片段
│  └─ content/        ← 各畫面的內容狀態資料
```

---

## 二、設計畫面清單 & 實作狀態

| # | 畫面名稱 | 設計檔 | Cocos TS 狀態 | JSON Layout | 優先級 |
|---|---|---|---|---|---|
| 1 | **大廳 Lobby** | `lobby/index.html` | `LobbyScene.ts` 存在 | `lobby-main-main.json` | 🔴 高 |
| 2 | **人物詳情 General Detail** | `character/index.html` | `GeneralDetailComposite.ts` 存在 | `general-detail-unified-main.json` ✅已更新 | 🔴 高 |
| 3 | **戰場 HUD Battle** | `battle/index_v3.html` | `BattleHUDComposite.ts` 存在 | `battle-hud-main.json` | 🟡 中 |
| 4 | **戰場 HUD v1/v2** | `battle/index.html`, `battle/index_v2.html` | 同上 | 同上 | ⚪ 參考 |
| 5 | **血脈命鏡 Bloodline** | (設計系統元件) | `BloodlineTreePanel.ts` 進行中 | `bloodline-mirror-main.json` | 🔴 高 |
| 6 | **結果彈窗 Result Popup** | `preview/` 各元件 | `ResultPopupComposite.ts` 存在 | `result-popup-main.json` | 🟡 中 |
| 7 | **轉蛋 Gacha** | — | — | `gacha-main.json` | 🟢 低 |
| 8 | **商店 Shop** | — | — | `shop-main-main.json` | 🟢 低 |

---

## 三、各畫面規格

---

### 畫面 1：大廳 Lobby (`lobby/index.html`)

**用途**：玩家進入遊戲後的主城畫面  
**場景**：`LobbyScene.ts` → 需綁定到 `lobby-main-main.json`

#### 佈局結構（1920×1080，fit-height letterbox）

```
Root (1920×1080)
├─ Background               bg_lobby.png + 黑色漸層疊加 0.45→0.15→0.60
├─ TopBar (absolute, top:24 left:32 right:32)
│  ├─ PlayerCard            深色圓角膠囊，border: #4D4635，border-radius: 44px
│  │  ├─ Avatar             68×68px，圓形，border: 2px #D4AF37
│  │  ├─ PlayerName         font: Headline 22px/700，color: #FFE088
│  │  ├─ PlayerSub          font: Label 11px，color: #B0A880，letter-spacing: .12em
│  │  └─ ExpBar             180×10px，fill: linear #FFE088→#D4AF37，64% fill
│  └─ ResourcePills (flex row, gap:10)
│     ├─ Gold Pill          icon: G●，color: #FFE088，+ button
│     ├─ Jade Pill          icon: J●，color: #A4D2D0，+ button
│     └─ Rations Pill       icon: R●，color: #ffbfb8，+ button
├─ NavRail (absolute, left:32, top:50% translateY(-50%))
│  ├─ NavBtn × 5            110×100px，border-radius:18px，border:#4D4635
│  │                        hover: translateX(3px)，active: glow #D4AF37
│  └─ 按鈕：戰場/人物/培育/兵符/商店
├─ HeroSlot (absolute, center, top:56%)
│  ├─ HeroImage             height:720px，drop-shadow(0 20px 36px rgba(0,0,0,.7))
│  ├─ HeroName              Headline 56px/700，letter-spacing:.1em
│  └─ HeroSub               Label 14px，letter-spacing:.5em，color:#FFE088
├─ EventCards (absolute, right:32, top:130, width:360, gap:14)
│  ├─ EventCard × 3        border-radius:14px，border:#4D4635
│  │  ├─ ev1: bg #1a2030，tag: #B22222 紅
│  │  ├─ ev2: bg #2a2010，tag: #D4AF37 金
│  │  └─ ev3: bg #202830，tag: #A4D2D0 青
└─ Dock (absolute, bottom:24, center)
   └─ CTA Button            gold_cta 樣式，「出戰」
```

#### 顏色 Token 對應
| 用途 | Token | 值 |
|---|---|---|
| 背景 | `background` | `#0F0F0F` |
| 金框 | `accentGold` / `outline` | `#D4AF37` / `#4D4635` |
| 玩家名稱 | `textAccent` | `#FFE088` |
| 副文字 | `textSecondary` | `#D0C5AF` |
| 紅色事件標籤 | `primary` | `#B22222` |

---

### 畫面 2：人物詳情 General Detail (`character/index.html`)

**用途**：單一武將的詳細資料頁（總覽、屬性、技能、血脈、培育、延伸）  
**Layout JSON**：`assets/resources/ui-spec/layouts/general-detail-unified-main.json` ← **已更新，需複製回去**

#### 佈局結構

```
Root (1920×1080)
├─ PortraitArea (left: 0, width: 62%)
│  ├─ Background            radial-gradient warm+cool tones
│  ├─ FadeOverlay           linear-gradient 90deg transparent→#0a0a0a (right edge)
│  ├─ PortraitImage         height:98%, bottom:0, centered, drop-shadow
│  ├─ NavLeft               96×96px 圓形，left:24px，gold border，"‹"
│  ├─ NavRight              96×96px 圓形，right:24px，gold border，"›"
│  ├─ RankBadge             90×90px，top:28 left:28，jade bg (#3F6A62)，border:#8CCFC4
│  └─ PortraitTitle         bottom:36 left:36，Headline 20px，opacity:.35，letter-spacing:.6em
├─ RightTabBar (absolute, right:0, top:0, width:330px, height:1000px) ← ✅ 已更新 3倍
│  ├─ TabButton × 6         290×290px 各 tab
│  │  ├─ IconInactive/Active 126×126px
│  │  ├─ Badge              54×54px（通知紅點）
│  │  └─ Label              66px 高，letter-spacing:.1em
│  └─ CloseButton           290×180px，bottom
├─ RightContentArea (absolute, top:280px, right:366px) ← ✅ 已更新 +106px 呼吸空間
│  ├─ JadeHeaderPlaque      Jade bg (#3F6A62→#2a4a44)，border:#8CCFC4
│  │  ├─ GeneralName        Headline 64px/900，color:#FFE088
│  │  ├─ TitleBadge         border-radius:6px，金框
│  │  └─ RarityBadge        對應稀有度顏色
│  ├─ TabContent (動態切換)
│  │  ├─ 總覽 Overview      stats grid + story strip
│  │  ├─ 屬性 Stats         數值列表，progress bar
│  │  ├─ 技能 Skills        技能卡片
│  │  ├─ 血脈 Bloodline     血脈樹
│  │  ├─ 資質 Aptitude      六角雷達圖
│  │  └─ 延伸 Extended      裝備 grid
│  └─ CTABar                「出戰」gold_cta + 「培育」secondary
```

#### 已有的 TS 檔案（不需重新建立）
- `GeneralDetailComposite.ts` — 主要組合器
- `GeneralDetailOverviewChild.ts` — 總覽 tab
- `GeneralDetailBasicsChild.ts` — 屬性 tab
- `GeneralDetailSkillsChild.ts` — 技能 tab
- `GeneralDetailBloodlineChild.ts` — 血脈 tab
- `GeneralDetailAptitudeChild.ts` — 資質 tab
- `GeneralDetailExtendedChild.ts` — 延伸 tab

#### 需要做的工作
1. ✅ 複製 `changes/general-detail-unified-main-updated.json` → `assets/resources/ui-spec/layouts/general-detail-unified-main.json`
2. 在 Cocos Editor 重新載入場景，確認 Tab 按鈕（290×290px）和內容區域（top:280）正確顯示

---

### 畫面 3：戰場 HUD Battle (`battle/index_v3.html`)

**用途**：即時戰鬥畫面的 HUD 疊加層  
**TS 檔**：`BattleHUDComposite.ts`, `BattleHUD.ts`, `BattleLogComposite.ts`  
**Layout JSON**：`battle-hud-main.json`, `action-command-main.json`, `battle-log-main.json`

#### 佈局結構

```
Root (1920×1080)
├─ TopBar (absolute, top:0, height:130px)
│  ├─ Background            topbar_bg.png + linear #060a0a
│  ├─ BottomBorder          1.5px solid rgba(#D4AF37, .5)
│  ├─ ScenePill (left:0)
│  │  ├─ SceneLoc           Headline 20px，color:#FFE088，letter-spacing:.3em
│  │  └─ Tags               weather/gambit chips
│  ├─ SysBtns (right:0)
│  │  ├─ AutoBtn            toggle，on: gold bg #FFE088→#D4AF37
│  │  ├─ SpeedBtn           blue tint #243a5a
│  │  └─ SurrenderBtn       red tint #5a1a14
│  └─ TopbarMain (grid 3-col, center)
│     ├─ LeftTeamInfo       flex col
│     ├─ TurnCounter        Headline 32px，gold，letter-spacing:.2em
│     └─ RightTeamInfo      flex col (mirror)
├─ BattleGrid (center, 40×760px 間距)
│  └─ 5×8 Grid Cells        cell: 144×144px，border-radius:8px
│     ├─ UnitCard           portrait + HP bar + type badge
│     └─ EmptyCell          虛線邊框，hover: 淡金色高光
├─ LeftPanel (absolute, left:0, center-y, width:440px)
│  └─ TeamList              6 unit slots，深色金屬背景
├─ RightPanel (absolute, right:0, center-y, width:440px)
│  └─ TeamList              6 unit slots（鏡像）
├─ ActionRing (absolute, bottom:24, center, z:50)
│  ├─ ActionBtn × 4        圓形按鈕，duel/end-turn/tactics/skill
│  └─ CostDisplay           軍糧消耗指示
└─ BattleLog (absolute, bottom:0, right:0, width:420px)
   └─ LogPanel              半透明深色，log entries
```

#### 版本說明
- `index.html` (v1) = 最初版本（參考用）
- `index_v2.html` (v2) = 中間改版（參考用）
- `index_v3.html` (v3) = **最新版本，以此為準**

---

### 畫面 4：血脈命鏡 Bloodline Mirror

**TS 狀態**：`BloodlineTreePanel.ts` — **進行中（未完成）**  
**Layout JSON**：`bloodline-mirror-main.json`, `bloodline-mirror-loading-main.json`

#### 需要完成的工作
1. 完成 `BloodlineTreePanel.ts` 中的血脈樹渲染邏輯
2. 對照設計系統中的 `preview/` 元件（rarity 顏色、badge 規格）
3. 使用 `assets/resources/ui-spec/content/bloodline-mirror-states-v1.json` 作為測試資料

---

## 四、設計 Token（完整）

```typescript
// 主色
primary:      "#B22222"   // 赤色（主要危險/CTA背景）
accentGold:   "#D4AF37"   // 金色（框線、重點）
accentLight:  "#FFE088"   // 淡金（文字 accent、標題）
jade:         "#3F6A62"   // 翡翠（header plaque 背景）
jadeLight:    "#8CCFC4"   // 淡翡翠（jade 框線）

// 背景層次
background:   "#0F0F0F"
surface:      "#1A1A1A"
surfaceHigh:  "#2A2A2A"

// 宣紙系列（人物頁右側）
parchment:    "#E8DFD0"
parchmentFill:"#F0E8D8"
textOnParch:  "#2D2926"
textOnParchM: "#6B5E4E"

// 文字
textPrimary:  "#E5E2E1"
textSecondary:"#D0C5AF"
textMuted:    "#99907C"
textAccent:   "#FFE088"

// 框線
outline:      "#4D4635"   // 標準金屬框
outlineSubtle:"#353535"

// 稀有度
rarityN:  "#E0E0E0"  // 白
rarityR:  "#4CAF50"  // 綠
raritySR: "#2196F3"  // 藍
raritySSR:"#9C27B0"  // 紫
rarityUR: "#FFC107"  // 金
rarityLR: "#D32F2F"  // 紅
rarityMythic:"#00FBFF"// 彩虹
```

---

## 五、字型規格

| 用途 | 字型名 | 檔案 | 主要用法 |
|---|---|---|---|
| 標題 / 數字 | Newsreader | `fonts/newsreader.ttf` | 武將名、大標題、羅馬數字 |
| 內文 / UI | Noto Sans TC | `fonts/notosans_tc.ttf` | 中文內文、說明文字 |
| 英文標籤 | Manrope | `fonts/manrope.ttf` | 英文按鈕、標籤、數字 |

**尺寸規範（Cocos canvas 1920×1080）：**
- 武將大名：64–80px / 900 weight
- 區塊標題：32–40px / 700–800
- 內文：22–28px / 400–500
- 微標籤：18–22px / 600–700，letter-spacing: .12–.3em
- **最小可用尺寸：18px（低於此不可出現在手機上）**

---

## 六、Sprite 資源對應

| 設計元素 | Cocos Sprite 路徑 |
|---|---|
| 宣紙背景 | `resources/sprites/ui_families/common/parchment/bg.png` |
| 金色 CTA 按鈕 | `resources/sprites/ui_families/common/gold_cta/*.png` |
| 深色金屬框 | `resources/sprites/ui_families/common/dark_metal/*.png` |
| 物品格子 | `resources/sprites/ui_families/common/item_cell/*.png` |
| 稀有度 badge | `resources/sprites/ui_families/common/badge/rarity_*.png` |
| 進度條 | `resources/sprites/ui_families/common/progress_bar/*.png` |
| Tab 精靈 | `resources/sprites/ui_families/common/tab/*.png` |
| 大廳背景 | `resources/sprites/bg_lobby.png` |
| 水墨背景 | `resources/sprites/bg_ink.png` |
| 武將立繪 | `resources/sprites/generals/{name}.png` |

---

## 七、需要立即執行的工作（按優先序）

### 🔴 立即（影響現有功能）
1. **複製 Layout JSON**  
   `design_handoff/changes/general-detail-unified-main-updated.json`  
   → `assets/resources/ui-spec/layouts/general-detail-unified-main.json`  
   *說明：Tab 按鈕放大 3 倍（97→290px），內容區上移 106px*

### 🔴 本週（進行中的畫面）
2. **完成 BloodlineTreePanel.ts**  
   參考：`bloodline-mirror-main.json` + `bloodline-mirror-states-v1.json`  
   設計參考：`design_handoff/preview/` 中的稀有度顏色、badge 規格

3. **Lobby 畫面綁定**  
   `LobbyScene.ts` 需完整綁定 `lobby-main-main.json` 中的所有節點

### 🟡 下週
4. **Battle HUD v3 同步**  
   對照 `design_handoff/battle/index_v3.html`，更新 `battle-hud-main.json`

---

## 八、設計參考檔案清單

```
design_handoff/
├─ README.md                    ← 你正在看這個
├─ lobby/
│  └─ index.html                ← 大廳完整設計稿
├─ battle/
│  ├─ index.html                ← 戰場 v1（參考）
│  ├─ index_v2.html             ← 戰場 v2（參考）
│  └─ index_v3.html             ← 戰場 v3（最新，以此為準）
├─ character/
│  ├─ index.html                ← 人物詳情主頁
│  ├─ index_v1.html             ← 舊版（參考）
│  ├─ components.jsx            ← React 元件版（參考）
│  └─ tabs.jsx                  ← Tab 元件（參考）
├─ preview/                     ← Design System 原子元件
│  ├─ buttons.html
│  ├─ badges.html
│  ├─ tabs.html
│  ├─ item_cells.html
│  ├─ progress_bars.html
│  ├─ jade_header.html
│  ├─ action_ring.html
│  ├─ icons_glyphs.html
│  ├─ colors_*.html             ← 各色系預覽
│  ├─ type_*.html               ← 字型預覽
│  ├─ spacing.html
│  ├─ radii.html
│  └─ shadows.html
├─ changes/
│  ├─ general-detail-unified-main-updated.json   ← 需複製回 Cocos！
│  └─ comparison.html           ← 新舊對比視覺化
└─ source/
   └─ ui-design-tokens.json     ← 完整 token 定義
```

---

## 九、給 Claude Code 的提示

當你在 Cocos Creator 中實作這些設計時：

1. **使用 UCUF 架構**：所有 UI 都通過 `CompositePanel` + JSON Layout 驅動，不要手動建立節點
2. **Token 優先**：顏色/尺寸用 `ui-design-tokens.json` 中的值，不要寫 hardcode
3. **9-slice sprites**：parchment、dark_metal、gold_cta 都需要 9-slice，邊框寬度見 token
4. **中文優先**：所有標籤用繁體中文，英文只用於微標籤（全大寫）
5. **輪廓文字**：場景上的文字必須加黑色輪廓（`outlineWidth: 2, outlineColor: #1A1A1A`）

---

*文件產生時間：2026-04-22*  
*設計版本：Design System v2.2 (3klife-v2-integrated)*
