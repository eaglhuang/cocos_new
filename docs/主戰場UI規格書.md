<!-- doc_id: doc_ui_0001 -->
# 主戰場 UI 規格書 (Main Battlefield UI Specification)

> **文件目的**: 定義「三國 2.5D 策略對推遊戲」Demo 的主戰場 UI 佈局、元件樣式與交互邏輯，供 UI 設計師或 AI 生成視覺示意圖使用。
> **參考依據**: `demo_playbook.md` (doc_spec_0161) (v2026-03-15)、`keep.md` (doc_index_0011) (v2026-03-19)。

---

## 1. 設計總則 (Design Principles)

- **視角與構圖**: 遊戲採 **2.5D 俯視角** (Camera Pitch -52°, Yaw -32°)。UI 應配合棋盤「左下往右上延伸」的透視感，避免遮擋核心戰區。
- **裝置目標**: **Mobile First** (手機優先)。按鈕尺寸需適合觸控 (Touch-friendly)，重要操作區避開螢幕邊緣誤觸區。
- **美術風格**: 
  - **核心**: `deep-ink battlefield + cold tactical HUD + gold CTA`。
  - **統一性**: Battle HUD 與大廳 / 人物頁 / 商店仍屬同一套全域 UI 美術系統；差異只在戰場場景下，HUD 必須更低存在感、更強調導視與操作層級。
  - **主次**: 3D 棋盤與單位永遠是第一視覺主體，HUD 只負責框定資訊、指揮操作與戰況導視，不可把戰場蓋成 UI 桌面。
  - **分層**: Top HUD / TigerTally / Action Command 屬於指揮層；BattleLog / ControlBar / utility button 屬於次級工具層，存在感必須更低。
  - **限制**: 主戰場不主用人物頁的 jade-parchment 匾額語言，也不主用 collectible-card / reward-card 的商業框體；這些只在 reward、reveal、結算或特別彈窗層使用。
  - **與地圖解耦**: 全景地圖可以是夜景、清晨、陰天或晴天；那屬於場景底圖氣氛。HUD 常態語言不跟著晨昏換風格，只允許針對可讀性做亮度、透明度、描邊與陰影微調。
  - **配色**: 
    - **我方 (Player)**: 藍色/青色系 (Blue/Cyan) — 代表友軍、安全、可操作。
    - **敵方 (Enemy)**: 紅色/橘色系 (Red/Orange) — 代表敵軍、威脅、目標。
    - **強調 (Accent)**: 金色 (Gold) — 用於勝利、升級、Buff、關鍵技能。
    - **背景面板**: 半透明深色遮罩 (Dark Overlay, Alpha 60-80%)，確保戰場可視度。

---

## 2. UI 佈局區域 (Layout Composition)

整體畫面分為四個主要圖層區域（Z-Order 由低至高）：

### 2.1 頂部資訊 HUD (Top HUD)
- **位置**: 螢幕頂部邊緣，全寬。
- **功能**: 顯示全域戰局狀態。
- **元件構成**:
  1. **回合計數 (Turn Counter)**: 
     - 置中或左上。顯示 "Turn 5" 或 "第 5 回合"。
  2. **糧草顯示 (Food Display)**: 
    - 醒目顯示，例如 "🌾 糧草 8,500 / 12,000"。
    - 出戰時糧草有**攜帶上限**（由武將/關卡決定），顯示「目前 / 上限」。
    - 回合開始時糧草**不自動增長**，與傳統 DP 每回合增長機制不同。
    - 若該場景有虎符部署摘要，可在同區顯示 `精銳上限 / AI 保留 band / Set 觸發` 等 1~2 個重點戰術提示。
    - 數值變動時需有跳動或顏色變化效果。
  3. **陣地血量條 (Fortress HP)**:
     - **左側 (我方)**: 藍色長條，旁邊標示 "我軍陣地"。
     - **右側 (敵方)**: 紅色長條，旁邊標示 "敵軍陣地"。
     - 中央可用 "VS" 圖示或分數比分隔。

### 2.2 左側：虎符卡片列 (Tiger Tally Card Sidebar)
- **位置**: 螢幕左側，垂直排列，佔寬度約 14-18%。
- **背景**: 輕微的深色底板，與戰場區隔。
- **元件**: **虎符卡片** (每回合隨機抽出 4 張)。
  - **排列**: 垂直單列排列，卡片間距 10px。

  #### 雙態卡片架構（v4 統一）

  虎符卡片採用 **統一元件雙態設計**，戰場與武將人物頁共用同一個 `TigerTallyUnifiedCard` prefab，僅透過 skin 切換視覺語言：

  - **State A（摘要態）**：戰場預設態 / 武將頁裝備欄態。只顯示核心戰術資訊，不展開詳情。
  - **State B（展開態）**：點擊卡片後，右側滑出詳情面板，顯示完整描述、特殊戰法、進階數值與來源資訊。
  - **戰場限制**：戰場中 State B 預設不展開（避免遮擋戰場），僅在長按或特定操作時可快覽。
  - **武將頁**：點擊即展開 State B，作為 `SpiritTallyDetail` 的正式查詢入口。
  - **Skin 切換**：Battle 使用 `battle-tally-skin`（`deep-ink + cold tactical HUD`）；人物頁使用 `parchment-tally-skin`（`parchment-first` 閱讀面）。Layout 與資料 contract 完全共用。

  - **卡牌樣式（State A 摘要態）**:
    - **美術圖**: 中央為兵種部隊美術圖（如：虎豹騎、陷陣營），填滿卡片。
    - **卡圖規格**: 現行 troop 主視覺以 `287x142 px` 為基準，資源命名跟隨 `troops_<troopType>.png`，Battle 端由 `TigerTallyComposite` 依 `artResource` 載入；目前 8 張正式 `troops_*.png` 已完成，找不到專圖時退回 `troops.png`。
    - **攻擊力 (AtkLabel)**: 底部左側，大字顯示攻擊數值，搭配 ⚔ 或十字準星 icon。
    - **生命值 (HpLabel)**: 底部右側，大字顯示生命數值，搭配 ❤ 或盾牌 icon。
    - **兵種徽章列 (UnitTypeBadges)**: 右側垂直 icon 列，顯示兵種類型與特殊戰法 icon。
    - **消耗**: 左上或右上角標示糧草消耗值 (如 "10")，必要時疊加狀態角標（`糧草不足 / Cap Full / 將降級 / Set Active`）。
    - **兵種名稱 (UnitName)**: 底部居中，兵種全名。
    - **品質外框**: 依據 `TigerTallyScore -> Quality Band` 顯示不同的邊框顏色與特效：
      1. **白色 (普通)**: 灰色或白色細邊框。
      2. **綠色 (優良)**: 綠色邊框。
      3. **藍色 (稀有)**: 藍色邊框 + 微弱藍光。
      4. **紫色 (史詩)**: 紫色邊框 + 呼吸感紫光。
      5. **金色 (傳說)**: 金色雕花邊框 + 閃爍金芒。
      6. **紅色 (聖階)**: 紅色重型邊框 + 燃燒火焰粒子。
      7. **彩色 (幻想)**: 虹彩流光動態邊框 + 粒子散逸特效。
    - **上限提示**: 當 `Elite_Deploy_Cap` 已滿時，卡片需顯示 `Cap Full / 將降級` 小標，而不是讓玩家誤以為卡牌失效。
    - **狀態**: 
      - `Ready`: 亮起，可點擊。
      - `Selected`: 卡片稍微放大並浮起，顯示拖曳預覽。
      - `FoodShort`: 變灰 (Grayed out)，表示糧草不足，且需顯示缺口值。
      - `CapFull`: 顯示 `Cap Full` 小標；若規則允許降級，需同步顯示降級去向。
      - `Downgrade`: 額外提示此時會改產普通小兵，而非完全無法操作。
      - `SetActive`: 卡角顯示低存在感金色或青金色標籤，提示此卡目前受 Set 羈絆加成。
      - `Locked`: 表示該虎符未裝備、來源尚未結算或暫不可由玩家操作。

  - **展開態（State B）內容**:
    - **描述區 (Description)**: 虎符 / 特殊兵種的文字敘述。
    - **特殊戰法列表 (SpecialTactics)**: 該虎符賦予的戰法列表，含 icon + 名稱 + 簡述。
    - **進階數值 (AdvancedStats)**: 防禦、速度、地形適性等完整面板。
    - **來源資訊 (SourceInfo)**: 死亡結算 / 招降移交 / 封賞結算的來源 crest + 名將小頭像 + 家族徽記。
    - **展開動畫**: 右側 slide-out 0.3s ease-out，寬度約為卡片寬度的 1.2~1.5 倍。

  TigerTally 卡片在 battle runtime 至少需提供以下欄位，才足以支撐正式戰場語意：

  1. `tallyId`
  2. `troopId`
  3. `tallyName`
  4. `troopName`
  5. `TigerTallyScore`
  6. `qualityBand`
  7. `star`
  8. `grainCost`
  9. `equippedGeneralName`
  10. `sourceType`
  11. `deployState`
  12. `deployReasonCode`
  13. `setIds`
  14. `setActive`

  > **統一元件約束（v4）**：戰場與武將頁使用同一個 `TigerTallyUnifiedCard` prefab，共用 layout 與資料 contract（`rarity / badge / card-art / source crest / ATK / HP`）。差異僅在 skin：Battle 端使用 `battle-tally-skin`（冷調戰術 HUD），人物頁使用 `parchment-tally-skin`（parchment-first 承載面）。State A（摘要態）在兩端完全一致，State B（展開態）僅在人物頁或戰場長按時觸發。

  `deployState` 正式列舉：
  - `Ready`
  - `Selected`
  - `FoodShort`
  - `CapFull`
  - `Downgrade`
  - `SetActive`
  - `Locked`

  `deployReasonCode` 正式列舉：
  - `NONE`
  - `FOOD_SHORT`
  - `ELITE_CAP_FULL`
  - `DOWNGRADE_TO_MILITIA`
  - `SOURCE_PENDING`
  - `TALLY_UNEQUIPPED`
  - `AI_RESERVED`
  - `SET_ACTIVE`

### 2.3 ~~左下角：主將資訊區 (Hero Info)~~ — ⛔ 已刪除 (v2)

> **v2 起刪除此區域**。原主將資訊分散至：
> - **主將肖像 / SP** → Zone 1 TopBar 兩側肖像 + Zone 7 奧義按鈕 SP 環
> - **HP / Buff** → WorldSpace 3D 頭頂 HUD
> - **屬性戰法詳情** → Zone 1 頭像點擊彈窗 GeneralQuickView（v3 新增）

### 2.4 右下角：核心操作區 (Action Command Area) — v3 改版
- **位置**: 螢幕右下角 (Bottom-Right Anchor)。
- **排列**: 1 大圓 + 3 小圓環繞佈局。
- **大圓：奧義 (UltimateBtn)**:
  - **尺寸**: 120×120px 圓形，含 SP 填充環（環寬 8px）。
  - 位於最右下角 `bottom: 24px, right: 24px`。
  - SP 滿時：環色 `#7ec8f7` + 呼吸脈衝 + 水墨外框 + 文字「發動」。
  - SP 未滿：環色暗淡 `#3A8FD9`，文字「奧義 72%」。
  - **點擊行為**：SP 滿時彈出「奧義選擇小窗」（支援多招奧義選擇，§4.4）。
- **小圓 1：結束回合 (EndTurnBtn)**:
  - 80×80px，大圓左側偏上。墨綠漸層。文字「結束」。
- **小圓 2：計謀 (TacticsBtn)**:
  - 80×80px，大圓正上方偏左。深藍漸層。文字「計謀」。
  - 正式資料來源為當前主將 / 出戰武將的 `tacticSlots[]`；按鈕需顯示來自 canonical tactics 的摘要（名稱 / 類型 / 數量），不得再用「開發中」或硬編碼假資料占位。
- **小圓 3：單挑 (DuelBtn)**:
  - 80×80px，大圓右上方。深紅漸層。條件不足時灰度鎖定。

### 2.5 右側：戰鬥紀錄與控制 (Side Panel) — v3 改版
- **位置**: 螢幕右側邊緣，佔寬度 ~10%。
- **佈局（上→下）**:
  1. **系統控制列 (ControlBar)** — 頂部固定（`top: 88px, right: 0`）
     - 水平排列 Auto / x2 / ⚙ 三顆按鈕（各 32×32），間距 8px。
     - 高 40px，半透明黑底背景。
  2. **戰鬥紀錄 (Battle Log)** — 控制列下方
     - 半透明黑底面板。
     - 展開高度 ~38%H（≈410px），ScrollView 滾動。
     - **可收合**：底部 28px 收合按鈕；收合後日誌隱藏，僅留一個 32×32「📋」小按鈕。
     - 再次點擊「📋」可展開日誌。過渡動畫 Tween 0.3s ease-out。

  ### 2.5-1. Battle / General Detail 共用技能資料流（2026-04-15）

  1. `BattleScene` 與 `GeneralDetail` 共用 `assets/resources/data/generals.json` 的 `tacticSlots[] / ultimateSlots[]`，不允許戰場 UI 再維護一份 battle-only 技能名單。
  2. `TacticsBtn` 的顯示摘要與可施放列表，來自 `tacticSlots[] -> tactic-library.json -> battleSkillId -> skills.json`。
  3. `UltimateBtn` 的奧義選擇小窗，來自 `ultimateSlots[] -> ultimate-definitions.json -> battleSkillId -> skills.json`；格子 / 地形只參與落點與效果結算，不決定奧義 ownership。
  4. 目前戰場執行層共用 **13** 條 signature battle skills，作為戰法與奧義的時間軸 wrapper；其上層 ownership、解鎖與說明仍以武將資料與 master library 為準。

---

## 3. 戰場內 UI (In-Game / World Space UI)

此類 UI 跟隨 3D 物件移動，需處理透視縮放。

### 3.1 單位資訊 (Unit Overlay)
- **血量條 (HP Bar)**:
  - 位於單位頭頂。
  - 我方藍色，敵方紅色。
  - 僅在「受傷」或「選中」時顯示，避免畫面雜亂。
- **狀態數值**:
  - 顯示 Buff 帶來的數值變化，如 `35 (+10)`。
  - 位於血條上方。

### 3.2 戰鬥飄字 (Floating Text)
- **傷害 (Damage)**: 紅色數字，向上飄動並漸隱 (BMFont: `dmg_normal.fnt`)。
- **暴擊 (Crit)**: 橘色/金色粗體數字，帶有震動或放大效果 (BMFont: `dmg_crit.fnt`)。
- **治療 (Heal)**: 綠色數字 (BMFont: `dmg_heal.fnt`)。
- **Buff/Debuff**: 文字提示，如 "暈眩"、"攻擊UP"。

### 3.3 棋盤交互指示 (Grid Indicators)
- **選中**: 該格子顯示綠色高亮框 (Selection Box)。
- **部署預覽**: 半透明的單位模型出現在游標懸停的格子上。
- **不可部署**: 紅色叉叉或紅色網格覆蓋。
- **地形標示**: 格子表面顯示 "山地"、"河流" 圖示或文字。
- **格線語言**: 棋盤格線應優先融入地表材質，只在關鍵可互動格、戰法落點與部署確認格給予輕微發光輔助；避免整片螢光 UI 線壓過 2.5D 場景。

---

## 4. 彈窗與反饋 (Popups & Feedback)

### 4.1 Toast 提示 (輕量通知)
- **樣式**: 黑色半透明圓角矩形，白色文字。
- **位置**: 螢幕正中央偏下。
- **行為**: 出現 2 秒後自動上浮消失。
- **情境**: "糧草不足"、"改派普通小兵"、"請選擇空格"、"敵方回合"、"SP 不足"。

### 4.2 結算面板 (Result Popup)
- **樣式**: 全螢幕深色遮罩 + 中央大型卡片。
- **內容**:
  - **標題**: "VICTORY" (大勝) / "DEFEAT" (敗北)。
  - **視覺**: 勝利時有彩帶/光芒特效；失敗時色調灰暗。
  - **數據**: 本場擊殺數、回合數。
  - **操作**: [再來一場]、[返回首頁] 按鈕。

### 4.3 主將屬性戰法快覽 (GeneralQuickView) — v3 新增
- **觸發**: 點擊 TopBar 上的我方/敵方主將頭像。
- **樣式**: 320×400px popover（手機可全寬 90%），圓角 12px，金色邊框。
- **內容**: 肖像 + 星級 → 基礎屬性（HP/攻/防/速/智） → 戰法列表（被動/主動/奧義）→ 當前 Buff。
- **敵方版本**: 部分屬性可能隱藏（顯示「???」），未知戰法顯示「🔒 未知戰法」。
- **關閉**: 點擊外部區域 / 右上角 × 按鈕。

### 4.4 奧義選擇小窗 (UltimateSelectPopup) — v3 新增
- **觸發**: Point SP 已滿時點擊奧義大按鈕。
- **位置**: 奧義按鈕上方向上展開。
- **尺寸**: 寬 220px × 高度自適應（奧義數 × 56px + padding）。
- **項目**: 每項 200×48px，含 icon（32×32）+ 技能名 + SP 消耗。
- **選擇**: 點擊一項 → 觸發奧義 → 小窗關閉 → SP 扣除。
- **取消**: 點擊小窗外區域 → 關閉不發動。

### 4.5 敵方思考中 (Enemy Turn Banner)
- **樣式**: 橫跨螢幕中央的帶狀 Banner。
- **內容**: "敵軍行動中..." (Enemy Turn)。
- **動效**: 簡單的掃光或呼吸效果。

---

## 5. 給 AI 繪圖的 Prompt 參考關鍵字

若使用 Midjourney / Stable Diffusion 生成示意圖，可參考以下關鍵字：

> **Keywords**: 
> Game UI design, Mobile game interface, Three Kingdoms strategy game, 2.5D isometric view, battle HUD.
> **Left sidebar**: Unit cards, medieval soldier icons (cavalry, infantry, archer), blue and gold borders.
> **Bottom right**: Action buttons, "Skill", "End Turn", gloss effect buttons.
> **Top bar**: Turn counter, resource numbers, health bars (blue vs red).
> **Style**: Clean, semi-realistic, RPG icons, translucent dark panels, high contrast text.
> **Context**: On top of a 3D grid battlefield, grassy terrain, chibi warriors.

---

## 6. 場景戰法視覺主題與立牌比例變體

> **整併來源**：夜襲戰場視覺規格提案.md (doc_spec_0078)、三國傳承 UI 布局說明書.md (doc_spec_0074)、策略戰場視覺與玩法融合設計.md (doc_spec_0082)
> **完整規格**：場景戰法觸發流程、Tile-State 預設、格子戰法區分，詳見 **戰法場景規格書.md (doc_spec_0039)**。

### 6.1 通用原則

- 場景戰法（Scene Gambit）使用 **預繪靜態背景**，背景圖在進場時載入後不再切換。所有動態效果僅透過格子特效（Tile Effect Prefab）呈現。
- 主戰場允許套用不同場景的視覺主題，但不可改動本文件既定的操作區位與 Mobile First 佈局。
- 立牌比例維持「主將約為一般小兵 2 倍高度」，敵營或物資營等戰術目標可使用與小兵接近尺寸的場景立牌呈現。
- 若加入敵營營帳、物資營或夜襲營火等世界物件，需保持頭頂 HUD 與格子可讀性，不能讓裝飾覆蓋部署判定區。

### 6.2 各場景視覺關鍵字

| 場景 | 背景主色調 | 場景物件 | Buff/Debuff 標記風格 |
|---|---|---|---|
| 🌲 森林埋伏戰 | 冷色深綠 + 微弱冷光 | 密林、落葉、濃霧 | 低可見度半透明標記 |
| 🌙 夜襲作戰 | 冷色月光 + 低飽和營火 | 敵營營帳、物資營、營火 | 螢光型高對比度標記 |
| 🪨 峽谷落石戰 | 高對比冷暖光影 | 崖壁、碎石、高處伏兵 | 標準色標記 + 震動警示 |
| 💧 水淹七軍戰 | 深藍水體 + 月光反射 | 斷裂旗幟、半淹石磚 | 藍灰色水流方向標記 |
| 🔥 火燒偷襲戰 | 暗暖橘色火光 | 焦黑地表、燃燒營帳 | 紅橙螢光 + 灰燼粒子 |
| 🏯 攻城戰 | 日間高對比 | 城牆、城門、攻城塔、護城河 | 標準色標記 |

### 6.3 軍師智謀能量 HUD（場景戰法專用）

- 棋盤格上方狀態欄常駐顯示軍師頭像 + 「INT 99, 正在執行: 夜襲」文字
- 右下角操作區「發動技能」按鈕左側，垂直排列 **智謀能量條**（金色粒子由下往上填充）
- 能量滿時可觸發場景專屬全局增幅效果
- 戰前偵查 UI 的正式揭露層級為：揭露敵將名稱與主要機制，不直接揭露站位；若要進一步顯示更細資訊，必須由任務 / 關卡配置額外授權。
- 情報需求必須以 `目前情報值 / requiredIntelValue` 顯示，不再使用單一百分比條件文案。
- 地形 / 天氣 / 適性 / 場景增幅應在 HUD 上以「百分點摘要」呈現，例如 `地形 +10%、夜戰 -5%、水戰適性 +15%`，避免玩家誤以為每項都是獨立乘區。

### 6.4 本輪 pending contract 掛點

- `strategist-hud-summary`
  - 定位：Top HUD 次層摘要帶，或右側可收合資訊抽屜。
  - 內容：`Theme_Hazard`、`Interactive_Object_Status`、`目前情報值 / requiredIntelValue`、`Environment_Bonus_Pct`、`Recommended_Loadout_Gap`。
  - 限制：只提供主題風險與缺口摘要，不揭露埋伏點與 AI 腳本答案。
- `stage-salvage-summary`
  - 定位：戰中可收合提示條或戰後摘要卡。
  - 內容：石材 / 木材 / 補給 / 情報等 `Stage_Salvage` 類別彙總。
  - 限制：戰中不逐筆刷到帳號資源列，避免 HUD 與經濟責任混線。

## 7. 版本修訂記錄
- **2026-04-11 v5**: 補入 `strategist-hud-summary / stage-salvage-summary` pending contract，作為關卡主題危害、互動物件與回收摘要的 UI 掛點。
- **2026-04-11 v4**: 虎符卡片外框正式改綁 `TigerTallyScore` 品質 band；補上精銳上限提示、固定情報門檻顯示與環境百分點摘要規則。
- **2026-03-30 v3**: 奧義升為大圓(SP環)+3小圓、控制列/日誌上下對調+收合、虎符加兵種符號+尺寸限制、DP→糧草(攜帶上限)、頭像點擊開屬性窗(§4.3)、奧義多招選擇(§4.4)。
- **2026-03-30 v2**: 雙肖像 TopBar、美術底圖卡片、日誌縮短、SP 環、刪除 Hero Info §2.3。
- **2026-03-30 v1**: 依現行 `戰場部署系統.md` (doc_spec_0040) 將 DP 用語改為糧草 / 冷卻顯示，並補入夜襲與立牌比例變體規格。
- **2026-03-19**: 初版建立，整合 Playbook 12.15.7 的按鈕規格與 12.14.5 的佈局佔比。
