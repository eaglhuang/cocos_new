# BattleScene Main UI Art Direction Audit

## 審核結論

`BattleScene` 目前的畫面結構已經不是雜亂拼裝，而是有明確的區位設計，這點屬於 `near-pass`。但如果以 Agent2 / 美術總監標準來看，它仍停在「模組規格已成形、整體 style profile 尚未完全收斂」的階段。

目前判定：

- 版位結構：`near-pass`
- family 分工：`near-pass`
- 視覺語言一致性：`partial-pass`
- World-space 與螢幕 UI 分層：`blocked by UI-2-0046`
- 最終導入狀態：`ready-for-style-profile / not-ready-for-final-placement`

換句話說，這張畫面現在最需要的不是再補一個漂亮元件，而是先把整張戰場畫面的美術分工講成一份正式 profile，讓後續的 icon、portrait、card art、capture QA 都有共同母規格。

## 核心審核問題

1. 主視覺焦點是否明確，而且不被次要工具列搶走？
2. 情報、操作、戰術卡、暫態回饋、world-space 回饋是否真的被拆成不同 style zone？
3. 同一畫面內的 tone pair、family、字級、亮度階層是否有共同規則？
4. 是否仍有區塊停留在 legacy / placeholder / 平面色塊階段，導致整體像不同年代的 UI 拼在一起？
5. 如果之後接真場景 capture，這套審核規則能不能直接落到 placement QA？

## BattleScene Style Zone Map

| Zone | 組件 | 畫面角色 | 正確語言 | 目前判讀 |
|---|---|---|---|---|
| Z1 | `battle-hud-screen` TopBar + ProgressBars | 戰局摘要 / 陣營對立 / 長條資訊 | 冷靜、薄而穩的戰術 HUD；藍紅對立、金色只做階層與關鍵字 | 結構正確，但頭像仍是 placeholder，還沒進 A2 正式語言 |
| Z2 | `tiger-tally-screen` | 戰術卡列 / 可部署單位池 | 卡片語言要明顯獨立於按鈕語言；A4/F6/F7 疊合 | 方向正確，但 card art / badge / rarity 尚未完成 runtime 與正式 proof |
| Z3 | `unit-info-panel-screen` + `GeneralQuickView` | 二級資訊抽屜 / 詳細說明 | 深色抽屜、金色 section、utility close；應比主 CTA 再退一階 | 基本成立，但需要和 TigerTally / Top HUD 共享同一套次級資訊階層 |
| Z4 | `battle-log-screen` + `ControlBar` | 低頻工具列 / 戰報 | 應是最安靜的系統 rail，不可與主操作搶亮度 | 現況最弱，平面色塊感偏重，像暫時樣式而非正式 family |
| Z5 | `action-command-screen` + `UltimatePopup` | 主 CTA / 高風險決策 / 回合節奏 | 全畫面最高互動層級；F8 action-button family，金色與青藍對比最強 | 是目前最接近主產品感的區塊，應繼續保持頂級亮度階層 |
| Z6 | Toast / EnemyTurn / ResultPopup / 暫態中場浮層 | 節奏控制 / 事件宣告 | 暫態訊息需與主畫面不同層，但不能像另一個系統跳進來 | 規格有方向，仍缺與主畫面共同 style profile 的對照 |
| Z7 | HP bar / 浮字 / 格位提示 / 部署預覽 | 世界空間戰場回饋 | 極高可讀、極低裝飾、以戰場為主，不可套用卡片與厚重 CTA 語言 | 規格存在，但未進新 QA 鏈，仍屬待實景審核區 |

## 已經成立的部分

### 1. 戰場主構圖沒有走錯

`battle-scene-main.json` 把 BattleScene 拆成 Top HUD、左側卡列、右側側欄、右下主操作區與延伸抽屜，這個分法本身是正確的。它像 Unity 裡先把一個大 Canvas 拆成幾個職責明確的 Prefab 區，而不是把所有資訊都塞在同一個 HUDGroup 內。

### 2. 主 CTA 與次要資訊已經有基本分離

`action-command-main.json` 的大圓奧義 + 三小圓操作區，是全畫面最明確的主操作區，這符合 AAA 手機策略 UI 的觸控邏輯。相對地，TopBar 與右側戰報都沒有被設計成同等強度，方向是對的。

### 3. BattleScene 的 family 路線已經可被說清楚

這輪不是從零開始，而是有前面幾張卡可引用：

- `UI-2-0038`
  - BattleHUD / QuickView 的頭像主體應走 `A2 HUD 頭像裁片 family`
- `UI-2-0039`
  - TigerTally card art 主語言應走 `A4 diorama card family`
- `UI-2-0030`
  - `tally.card.rarity.*` 應走 `F6 collectible-card family`
  - `tally.badge.type` 應走 `F7 micro-status badge`
- `UI-2-0035`
  - `action util / control` 屬於 `F8 action-button family`
  - `unitinfo.btn.close` 屬於 `F1 utility close`

也就是說，BattleScene 不是沒有規則，而是規則還沒有被收成一份畫面級 profile。

## 主要缺口

### 1. Top HUD、TigerTally、Action 區各自成立，但還缺同一套 tone pair

目前幾個子模組都各自有自己的合理性：

- Top HUD 偏冷色資訊板
- TigerTally 偏深色戰術卡
- ActionCommand 偏高亮 CTA

但這三者之間還缺一個畫面級規則，去明訂：

- 哪一區可以用高亮金色
- 哪一區只能用冷色/灰色
- 哪一區可保留卡面收藏感
- 哪一區只能當靜態資料板

沒有這層規則時，後續每個子卡都會在自己的局部看起來合理，但拼回 BattleScene 時會像三套美術語言共存。

### 2. 右側系統 rail 明顯還停留在暫定樣式

`battle-log-default.json` 目前的 `log.btn.auto` / `speed` / `setting` / `collapse` 多半還是平面 `color` slot。這讓右側 rail 與左側 TigerTally、右下 ActionCommand 之間的材質密度差很多。

這不一定表示右側要做得更花，而是要更明確：

- 它應該是「最低亮度、最低裝飾、最低存在感」的系統 rail
- 但仍要像同一款遊戲的成員，而不是開發中暫置面板

### 3. Placeholder 仍阻止 BattleScene 被整體批准

有幾個關鍵資產現在還不能誠實說「已過」：

- `hud.portrait.player` / `hud.portrait.enemy`
  - 仍是 placeholder，需等 `UI-2-0033` + `UI-2-0043`
- `tally.card.art`
  - 仍是 placeholder，需等 `UI-2-0034` + `UI-2-0039`
- `unitinfo.type.icon`
  - `UI-2-0036` 的 F7 refinement 已產出 v2a/v2b/v2c × 128/64/32，下一步改為 QA 選型（BattleScene 真場景/compare board）

所以這張卡目前能做的是 style audit，不是 placement 結案。

### 4. World-space UI 尚未納入同一條 capture QA

`主戰場UI規格書.md` 對血條、飄字、格位提示都有寫規格，但這些內容還沒被 `UI-2-0046` 的真場景 capture 鏈納入。這代表現在我們能審的是「畫面母規則」，還不能對實景中的密度、大小、遮擋做最終批准。

### 5. 二級資訊層的亮度階層還需正式收束

`UnitInfoPanel`、`GeneralQuickView`、`BattleLog` 都屬於次級資訊層。它們不能各自都用「很亮的金色、很重的邊框、很高的存在感」，否則整個畫面會失去主焦點。這一層現在有規格，但還沒有被 profile 明文規定。

## BattleScene Style Profile v1

這一版 profile 的目的，是先把 BattleScene 的美術母規則固定下來，供後續所有 asset card、runtime 綁定與 placement QA 直接引用。

### A. 基本定義

| 欄位 | BattleScene v1 |
|---|---|
| `screen_id` | `battle-scene-main` |
| `screen_role` | 即時戰場主畫面 / 指揮視角 HUD |
| `tone_pair` | `deep-ink battlefield + cold tactical HUD + gold CTA` |
| `background_depth` | 3D 棋盤與單位永遠第一優先，HUD 只能做框定與指揮，不可蓋住戰場 |
| `screen_context` | `BattleScene.scene` + `battle-scene-main` composite |
| `qa_board_path` | `artifacts/ui-qa/UI-2-0053/` |
| `placement_gate` | `UI-2-0046` 完成後才能做真場景 capture placement QA |

### B. Family 指派

| 類型 | 應用位置 | 指派 |
|---|---|---|
| `icon_family` | `unitinfo.type.icon`、貼頭像小 badge、小型戰術辨識 | `F7 battle-micro-badge` |
| `icon_family` | 奧義 / 計謀 / 單挑 / Auto / x2 / 設定 | `F8 action-button / utility-button` |
| `icon_family` | close / 輕量 utility | `F1 utility close` |
| `portrait_family` | BattleHUD / QuickView 頭像 | `A2 HUD portrait crop` |
| `card_family` | TigerTally card art | `A4 tactical diorama card` |
| `rarity_family` | TigerTally rarity / collectible meta | `F6 collectible-card` |
| `container_family` | 戰場主畫面原則上不主用；若有 reward/reveal 才引入 | `F5/A8 only in dedicated reward layer` |

### C. 亮度與焦點階層

| 層級 | 區域 | 規則 |
|---|---|---|
| Tier A | `UltimateBtn`、已可發動的主操作 | 全畫面最高亮度；可用金色高光、青藍能量環、最厚材質 |
| Tier B | 選中 TigerTally、重要警示、關鍵戰況提示 | 次高亮；可有金框或明確色票，但不可超過主 CTA |
| Tier C | Top HUD、ProgressBars、UnitInfo Header | 穩定讀取層；看得清楚但不能搶戰場 |
| Tier D | BattleLog、ControlBar、收合鈕 | 最低存在感；偏靜音、偏系統工具質感 |
| Tier E | World-space 血條 / 格位提示 | 不跟螢幕 UI 拼材質，只求即時讀取 |

### D. 色票分工

| 語意 | 規則 |
|---|---|
| 玩家 | 藍 / 青色，不做勝利金 |
| 敵方 | 紅 / 橘色，不做豪華金邊 |
| 主 CTA | 金色 + 深底，只限 `Zone 7` 與必要事件按鈕 |
| 稀有 / 卡牌 meta | 金 / 紫 / rare 系，只限 TigerTally 與對應卡面 |
| 次要系統 rail | 灰藍 / 深灰，避免過度飽和 |
| disabled | 不是只降透明度，還要降材質價值感 |

### E. 字級階層

| 類別 | 建議區間 | 套用位置 |
|---|---|---|
| 主戰況標題 | `20~24` | Turn / 關鍵戰況標題 |
| 重要資訊字 | `14~20` | 主將名、城血文字、核心數值 |
| 系統按鈕字 | `11~14` | Auto/x2/設定、戰鬥控制 |
| 微型 badge / 角標 | `24 / 32` 尺寸先讀圖，不靠文字 | 兵種徽章、角標 icon |

### F. 明確禁止混用

- 不要把 `F5 reward-cell` 語言直接帶進 Top HUD 或 ActionCommand。
- 不要把 TigerTally 的 collectible 邊框厚度帶進 world-space 血條。
- 不要讓 `BattleLog` 用和 `UltimateBtn` 同級的高亮金色。
- 不要讓 portrait、badge、button 共用同一張 carrier。

## 這張卡目前最重要的下一步

1. `UI-2-0046`
   - 建立真場景 capture，讓 style audit 能進 placement QA。
2. `UI-2-0033` / `UI-2-0043`
   - 把 BattleHUD portrait 從 placeholder 拉回 `A2` 正式語言。
3. `UI-2-0034` / `UI-2-0039`
   - 把 TigerTally 的 card art / rarity / badge 真正做成戰術卡語言。
4. `UI-2-0036`
   - 把 `unitinfo.type.icon` 拉回 `F7` 微型 badge 正軌。

等這四條線回來後，`UI-2-0053` 才能從 desk audit 進到 review-round2 的實景 placement QA。
