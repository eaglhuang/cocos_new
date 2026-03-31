# UI 參考圖品質分析 — 九宮格框體與視覺層次拆解

> **目的**：拆解 4 張參考截圖（武將詳情、裝備介面、戰令商城、信件系統）中的九宮格框體手法，歸納深淺框體使用規則、融合背景的技法、以及文字配色策略，作為本專案 UI 開發的**落地品質目標**。
>
> **定位**：本文件不是空談理論規則，而是所有 UI skin JSON、sprite 製作、layout 設計與視覺 QA 的**可執行品質基準**。每個章節都包含具體的驗收條件、responsible agent 標記與已有的 preview 產出物參照。
>
> **最後更新**：2026-03-31（v2 — 加入 AI 架構分析、落地行動方案、Agent 協作策略、To-Do 追蹤計畫）

---

## 目錄

1. [總覽：參考圖共通設計語言](#1-總覽參考圖共通設計語言)
2. [框體家族分類（Frame Family Taxonomy）](#2-框體家族分類frame-family-taxonomy)
3. [深色框 vs 淺色框的使用時機](#3-深色框-vs-淺色框的使用時機)
4. [框體與背景融合技法](#4-框體與背景融合技法)
5. [文字配色與字體策略](#5-文字配色與字體策略)
6. [逐圖拆解](#6-逐圖拆解)
7. [與本專案現有系統的差距](#7-與本專案現有系統的差距)
8. [落地行動方案（Task-Level）](#8-落地行動方案task-level)
9. [AI 架構分析：「自然不協調感」的落地原理](#9-ai-架構分析自然不協調感的落地原理)
10. [Agent 協作分工策略](#10-agent-協作分工策略)
11. [已有產出物與基準線](#11-已有產出物與基準線)

---

## 1. 總覽：參考圖共通設計語言

### 1.1 核心視覺公式

```
背景層（水墨山水渲染）
  → 半透明暗色蒙版（壓暗但保留紋理）
    → 框體層（九宮格拉伸的金屬/羊皮紙框）
      → 內容層（圖標、文字、數值）
```

所有 4 張圖都遵循這個 4 層結構。框體從不直接浮在純白或純黑平面上，而是「漂浮」在有水墨質感的漸層背景之上，形成**有深度感的自然融合**。

### 1.2 全局配色方案（從參考圖取色）

| 用途 | 色值 | 說明 |
|---|---|---|
| 背景漸層暗端 | `#1A1510` ~ `#0F0F0F` | 水墨山水的暗部，帶微暖褐 |
| 背景漸層亮端 | `#C8BDA8` ~ `#DDD4C2` | 水墨留白 / 宣紙邊緣，暖米白 |
| 金色主調 | `#D4AF37` ~ `#C9A028` | 框邊、高亮標題、CTA 按鈕邊框 |
| 金色高光 | `#FFE088` ~ `#F5D75A` | 框角光澤點、啟用態 Tab、重要數字 |
| 深色填充 | `#1A1A1A` ~ `#2A2520` | 面板底色、資訊行背板 |
| 淺色填充 | `#E8DFD0` ~ `#F0E8D8` | 羊皮紙質感、信件正文底、戰令獎勵格 |
| 紅色強調 | `#B22222` ~ `#8B1A1A` | 破壞操作按鈕、稀有度 R 標籤 |
| 綠色正向 | `#4CAF50` ~ `#2E8B57` | 加成數值、進度條填充 |
| 灰色不可用 | `#68605A` ~ `#888` | 禁用/未獲得態、次要文字 |

### 1.3 視覺層級金字塔

```
          CTA按鈕（金框+深底+大字）
         ╱                     ╲
    主面板框（金邊+半透深底）    分頁Tab（金色啟用 / 灰色閒置）
       │                         │
  次級面板（深框 or 淺框取決於對比需求）
       │                         │
    行級容器（薄邊深底 / 無邊透底）
       │                         │
  圖標 + 數值（最終內容元素）
```

---

## 2. 框體家族分類（Frame Family Taxonomy）

從 4 張截圖中辨識出 **7 種核心框體家族**：

### 2.1 🟫 深色金屬框（Dark Metal Frame）

| 屬性 | 值 |
|---|---|
| **填充色** | `#1A1A1A` ~ `#252018`，不透明度 85~95% |
| **邊框** | 1~2px 金屬漸層（暗銅 → 亮金），四角有微光澤 |
| **圓角** | 4~8px（偏方正、鋼硬感） |
| **適用場景** | 資訊面板主框、裝備詳情卡、技能欄位、數值統計行 |
| **典型出現** | 圖1 右側數值面板、圖2 左側裝備詳情框 |

**9-Slice 要點**：
- 四角為金屬光點或小鉚釘裝飾 → 角區至少保留 **20~24px**
- 邊緣需含 2px `bleed`（暖色微光暈），方可在暗背景上自然收邊
- 內容安全帶建議 2~4px（框邊金屬有粗細漸變，內容不可緊貼）

### 2.2 📜 羊皮紙框（Parchment Frame）

| 屬性 | 值 |
|---|---|
| **填充色** | `#E8DFD0` ~ `#F0E8D8`，不透明度 90~100% |
| **邊框** | 極薄暗棕色邊（`#5A4E3E`，1px）或金色薄邊，部分無框只靠陰影 |
| **圓角** | 2~6px（紙張邊緣感，不宜太圓） |
| **適用場景** | 長篇閱讀內容（信件正文）、獎勵格子區、需要高可讀性的清單 |
| **典型出現** | 圖4 右側信件內文、圖3 戰令主內容區、圖4 左側信件列表 |

**9-Slice 要點**：
- 紙張四角常做舊處理（褐斑、捲邊效果）→ 角區保留 **16~20px**
- 紙張紋理在拉伸區不能出現明顯重複圖案 → 用極低對比的 noise 紋理
- 不加 bleed，改用下方投影（`#00000020`，blur 4~6px）形成浮起感

### 2.3 🔲 半透明暗色蒙版（Semi-transparent Dark Overlay）

| 屬性 | 值 |
|---|---|
| **填充色** | `#0F0F0F` / `#000000`，不透明度 50~80%（`CC` / `AA` / `80`） |
| **邊框** | 無邊框，邊緣以羽化漸變處理 |
| **圓角** | 0px（或極小 2px） |
| **適用場景** | 背景壓暗層、英雄立繪後方暈、資訊區底（讓白字可讀） |
| **典型出現** | 圖1 左側英雄資訊後方、圖2 英雄立繪後方、全部圖的最底層蒙版 |

**9-Slice 要點**：
- 通常不需要 9-slice（用 `color-rect` 或全螢幕 shader）
- 若需漸變邊緣，用獨立 bleed 圖層（Gaussian blur 邊緣 8~16px 羽化）
- 多個蒙版可疊加：底層 `#0F0F0FCC` → 局部再加 `#000000AA`

### 2.4 🏅 金色行動按鈕框（Gold CTA Frame）

| 屬性 | 值 |
|---|---|
| **邊框** | 3~4px 粗金色漸層（`#C9A028` → `#FFE088` → `#C9A028`） |
| **填充色** | 深褐 `#2A2018` 或深黑 `#1A1510` |
| **圓角** | 6~10px（比一般面板更圓） |
| **文字** | 金色 `#FFE088` 或米白 `#EEDFCC`，字號 20~28px，粗體 |
| **適用場景** | 主行動：「升級」「試玩角色」「購買進階戰令」「一鍵領取」 |
| **典型出現** | 圖1「試玩角色」、圖2「升級」、圖3「購買進階戰令」「一鍵領取」 |

**9-Slice 要點**：
- 框邊粗（3~4px）+ 外 glow（`#FFE08840`，blur 4px）→ 角區 **24~32px**
- normal / pressed / disabled 三態：pressed 加亮 10%、disabled 灰化 + opacity 0.5
- 按壓時金色邊框可微縮 1px + 內填色加亮，產生「按下去」手感

### 2.5 🟥 紅色破壞按鈕框（Red Destructive Frame）

| 屬性 | 值 |
|---|---|
| **邊框** | 2~3px 暗紅金屬邊（`#6B1A1A` → `#8B3030`） |
| **填充色** | 深紅 `#8B1A1A` ~ `#B22222` |
| **文字** | 白 `#FFFFFF` 或淺米 `#EEE`，粗體 |
| **適用場景** | 破壞性操作：「全部刪除」「全部卸除」 |
| **典型出現** | 圖4「全部刪除」、圖2「全部卸除」 |

**9-Slice 要點**：
- border 與金色 CTA 相同規格（共享拉伸邏輯），只換色
- 角區中可見微弱的暗紋理（金屬鍛打痕跡），保留 **20~24px**

### 2.6 📑 分頁標籤框（Tab Frame）

分為**水平 Tab**（圖1 上方「數值/將魂」）和**垂直菱形 Tab**（圖2 右側「詳情/戰法/裝備/將魂」）兩類：

**水平 Tab**

| 狀態 | 填充 | 邊框 | 文字 |
|---|---|---|---|
| **啟用** | 金色漸層 `#C9A028` → `#D4AF37` | 無獨立邊框（填色即框） | 深色 `#1A1A1A`，粗體 |
| **閒置** | 深灰 `#2A2A2A`，opacity 70% | 細金邊 1px `#4D4635` | 灰白 `#AAA`，常規 |

**垂直菱形 Tab**

| 狀態 | 填充 | 裝飾 | 圖標 |
|---|---|---|---|
| **啟用** | 金色漸層填充、尺寸略大 | 外 glow 金暈 | 深色圖標 |
| **閒置** | 暗墨色 `#2A2520`，低飽和度 | 無 glow | 灰金色圖標 |

**9-Slice 要點**：
- 水平 Tab：border `[12, 12, 12, 12]`，寬度由文字決定，高度固定 44~48px
- 菱形 Tab：非標準矩形 → 不適用 9-slice，用獨立 sprite 或 shader 旋轉

### 2.7 🎴 物品格子框（Item Cell Frame）

| 屬性 | 值 |
|---|---|
| **大小** | 固定 80~100px 正方（或配合 icon 的 1:1） |
| **填充** | 深灰 `#1A1A1A` ~ `#2A2520` |
| **邊框** | 1~2px 金屬細邊，**邊框顏色依稀有度變化** |
| **圓角** | 4~6px |
| **裝飾** | 左上角稀有度標籤 badge、右下角數量 badge、可選 Lv badge |
| **典型出現** | 圖3 所有獎勵格子、圖2 裝備欄位 |

**稀有度邊框色**

| 稀有度 | 邊框色 | 光暈 |
|---|---|---|
| 普通（白） | `#AAA` / `#888` | 無 |
| 精良（綠） | `#4CAF50` | 微弱 |
| 稀有（藍） | `#2196F3` | 微弱 |
| 史詩（紫） | `#9C27B0` | 中等 |
| 傳說（金） | `#FFC107` | 較強 |
| 神話（紅） | `#D32F2F` | 強 |

**9-Slice 要點**：
- 格子通常不大量拉伸（固定尺寸），可用 simple sprite 而非 sliced
- 但若做響應式網格，仍需 9-slice，border `[8, 8, 8, 8]`
- 空格（未裝備）用虛線邊框 + 十字加號 icon 表示「可添加」

---

## 3. 深色框 vs 淺色框的使用時機

### 3.1 決策樹

```
場景判斷
  ├─ 背景偏亮（水墨留白區、宣紙色邊緣）？
  │   └─ 用深色框（#1A1A1A 系）→ 拉開反差，框體前景感強
  │       └─ 框內文字：白/金色
  │
  ├─ 背景偏暗（山水暗部、英雄立繪陰影區）？
  │   └─ 用淺色框（#E8DFD0 系）→ 閱讀性佳，同時帶出「古卷」質感
  │       └─ 框內文字：深褐/黑色
  │
  └─ 需要強調互動性（按鈕、可選 Tab）？
      └─ 用金色邊框 + 深填充 → 視覺焦點引導
          └─ 框內文字：金/白色
```

### 3.2 四圖具體對應

| 圖像 | 深色框用途 | 淺色框用途 | 核心對比策略 |
|---|---|---|---|
| 圖1（武將詳情） | 數值面板、技能行、戰法框 | 無（全深色調） | 暗背景上浮出深框，靠金色邊界拉層次 |
| 圖2（裝備介面） | 裝備詳情卡、物品格、選單框 | 裝備提供能力統計區域（底部） | 淺色區塊用於「靜態總結資訊」，深色用於「可互動物件」 |
| 圖3（戰令商城） | 物品格子、進階戰令行 | 整個獎勵內容面板 | 大面積淺色拉開與暗背景的反差，格子回到深色表示可領取物品 |
| 圖4（信件系統） | 頂欄、底部動作列、分類 Tab | 信件列表、信件內文（右側） | 閱讀主體用淺色保證可讀性，操作區用深色區分功能 |

### 3.3 總結規則

| 規則 | 說明 |
|---|---|
| **閱讀型內容 → 淺色底** | 大段文字、表格型數據、物流/獎勵清單。底色 `#E8DFD0` ~ `#F0E8D8`，文字深褐 `#2D2926` |
| **互動型元素 → 深色底** | 按鈕、可選物件、選中態面板。底色 `#1A1A1A` ~ `#2A2520`，文字白/金 |
| **統計/摘要區 → 可深可淺** | 取決於周圍對比需要。若周圍已深色 → 改淺色突顯摘要；若周圍已淺 → 用深色壓住 |
| **金色邊框永遠存在** | 不論深淺框體，至少有 1px 金色/銅色邊界線。這是保持全局一致性的關鍵 |
| **空白等於呼吸** | 框與框之間留 8~16px 間距，不緊貼。間距區可透出背景水墨，增加透氣感 |

---

## 4. 框體與背景融合技法

### 4.1 水墨背景的三段式構成

```
最底層：寫意水墨山水全景（1920×1080 滿版，低飽和度，整體偏灰褐）
中間層：局部漸層蒙版（上暗下亮 or 左暗右亮）— 控制哪裡更深、哪裡能透出紙白
最上層：邊緣水墨飛白/暈染裝飾條（頂邊和底邊）— 增加手繪感
```

### 4.2 框體邊緣融合的 3 個層次

參考圖的高質感來自框體邊緣不是「硬切」的，而是分 3 層漸進：

| 層 | 描述 | 技術實作 | 對應我們的系統 |
|---|---|---|---|
| **① frame** | 主框邊：1~2px 金色/銅色實線 | 9-slice sprite，border 含完整框角 | skin slot `*.frame` |
| **② bleed** | 暖色暈邊：框外 2~4px 的柔光暈（低 opacity 金/褐色） | 獨立 9-slice sprite，比 frame 大 4~8px，Gaussian blur 效果 | skin slot `*.bleed` |
| **③ shadow** | 投影：框下方 4~8px 的暗影（`#00000030~50`） | CSS 思維的 drop-shadow；實作用獨立 sprite 或 shader | 目前系統缺此層 |

> **關鍵發現**：參考圖中框體之所以「自然」是因為 **bleed 層讓邊界不會突然斷裂**。如果只有 frame + fill，就會產生「貼紙感」（像貼在背景上的扁平矩形），缺乏深度。

### 4.3 透明度漸變的微妙層次

| 區域 | 不透明度 | 原因 |
|---|---|---|
| 全螢幕蒙版（最底） | 75~80%（`CC`） | 壓低背景但保留水墨紋理的隱約可見 |
| 主面板填充 | 85~95%（`DD` ~ `F0`） | 幾乎不透但微透出背景色調暖度 |
| 次級容器（行/格） | 90~100% | 數據清晰不受背景干擾 |
| 英雄立繪背後 | 40~60%（`66` ~ `99`） | 立繪本身提供視覺，後方蒙版只壓暗邊緣 |

### 4.4 材質紋理的隱性運用

- **金屬框邊不是純色漸層**：有極微弱的「鍛打紋」（斜線噪點 noise，混合模式 overlay，opacity 5~10%）
- **羊皮紙底不是純平色**：有低頻 Perlin noise（仿纖維走向），色差在 `#E8DFD0` ~ `#DDD4C2` 之間游走
- **深色底不是純黑**：帶微量褐色暖調趨勢（`#1A1A1A` 而非 `#0F0F0F`），與水墨背景呼應

---

## 5. 文字配色與字體策略

### 5.1 字體分層

| 層級 | 用途 | 觀察到的特徵 | 建議對應 |
|---|---|---|---|
| **標題字** | 英雄名、畫面標題、大區塊名 | 較粗、有描邊/立體陰影、字號 28~42px | `headlineFont` + `headlineLg/Md` |
| **中文正文字** | 信件內文、說明文字、技能描述 | 宋體比例（筆畫清晰）、字號 18~22px | `bodyFont` (NotoSans TC) + `bodyMd/Lg` |
| **數值/標籤字** | 9,999 / MAX Lv.300 / 99天後刪除 | 等寬或半等寬、字號 14~20px、有描邊 | `labelFont` (Manrope) + `labelMd/Lg` |
| **按鈕文字** | 升級、試玩角色、一鍵領取 | 粗體、居中、字號 20~28px | `bodyFont` bold + custom `button` style |

### 5.2 文字色彩搭配規則

| 底色類型 | 主文字色 | 強調色 | 次要/標注色 | 描邊 |
|---|---|---|---|---|
| **深色底**（`#1A1A1A`） | 白 `#E5E2E1` | 金 `#FFE088` | 灰 `#99907C` | 黑 `#000000CC`，寬 1~2px |
| **淺色底**（`#E8DFD0`） | 深褐 `#2D2926` | 金 `#D4AF37` | 中褐 `#6B5E4E` | 無（底已淺無需描邊） |
| **金色底**（CTA 按鈕內） | 深 `#1A1510` 或白 `#FFF` | — | — | 無或極細暗邊 |
| **紅色底**（破壞按鈕） | 白 `#FFFFFF` | — | — | 無 |

### 5.3 數值的特殊呈現

| 情境 | 格式 | 顏色 | 範例 |
|---|---|---|---|
| 基礎屬性值 | icon + 數字 | 白色 | ❤ 999,999 |
| 加成數值 | `+ 999` | 綠色 `#86E1A5` | 9,999 **+ 999** |
| 百分比 | `99.99%` | 白色，特殊情境用金色 | 99.99% |
| 等級 | `Lv.XX` 或 `MAX` badge | MAX 用金底黑字 badge | MAX Lv. 300 |
| 稀有度文字 | 字母縮寫（R/SR/SSR/UR/LR） | 對應稀有度色 | SSR（金） |
| 未獲得/鎖定 | 灰化 + 「未獲得」文字 | `#888888`，opacity 50~60% | UR 未獲得 |

### 5.4 描邊（Outline）的關鍵作用

> **重要發現**：參考圖中幾乎所有深色底上的白色/金色文字都有 **1~2px 黑色描邊**（`#000000`，opacity 70~90%）。這不是為了美觀，而是為了**在半透明底上保證文字可讀性**。若底層框體稍微透出背景亮斑，沒有描邊的文字就會「斷字」。

---

## 6. 逐圖拆解

### 6.1 圖1 — 武將詳情（數值分頁）

**佈局結構**：
```
┌─────────────────────────────────────────────────┐
│ [頂部暗色水墨飛白條]                               │
│                                                   │
│ ┌────────────┐              ┌──────────────────┐ │
│ │ 英雄名        │              │ [數值] [將魂]    │ │
│ │ 屬性icon列    │    英雄       │  Tab 活/閒        │ │
│ │ 戰法類型列    │    立繪       │ MAX Lv. 300      │ │
│ │ 戰法Skills   │    (中央)     │ stat icon+數值 ×8 │ │
│ │ ┌──────────┐│              │                   │ │
│ │ │ 固定戰法   ││              │ 稀有度Tab列       │ │
│ │ │ (金邊深底) ││              │ R/SR/SSR/UR/LR   │ │
│ │ └──────────┘│              └──────────────────┘ │
│ └────────────┘                                    │
│ ┌─試玩角色─┐ [圖標]          [生平] [獎勵]        │
│ └──(金CTA)──┘                [圓形icon按鈕]       │
│ [底部水墨飛白條]                                    │
└─────────────────────────────────────────────────┘
```

**框體使用拆解**：

| 區域 | 框體類型 | 填充 | 邊框 | 備注 |
|---|---|---|---|---|
| 全螢幕背景 | 水墨山水 | — | — | 漸層：左暗右亮 |
| 英雄立繪後方 | 半透暗蒙版 | `#0F0F0F80` | 無 | 左側漸入、右側漸出，不覆蓋整個立繪 |
| 左側資訊區 | 隱形容器 | 無底色 | 無 | 靠蒙版壓暗即可，文字直接用描邊保證可讀 |
| 固定戰法框 | 深色金屬框 | `#1A1A1ADD` | 金邊 2px + bleed 2px | 最典型的深色九宮格應用 |
| 右側數值面板 | 深色金屬框 | `#1A1A1AEE` | 金邊 1px + 圓角 8px | 內含水平分隔線（`#2A2A2A`） |
| Tab 列（數值/將魂） | Tab框體 | 啟用金、閒置深灰 | 啟用無額外邊、閒置金邊 1px | 啟用態的金色底自帶「前景感」 |
| 生平/獎勵按鈕 | 圓形icon按鈕 | `#2A2520CC` | 金色環 2px | circle frame，非九宮格 |
| 試玩角色按鈕 | 金色CTA框 | `#2A2018` | 金色漸層 3px | 最高互動層級 |
| 稀有度 Badge（R/SR/SSR…） | 特殊形狀框 | 對應稀有度色填充 | 金屬質感邊 | 非九宮格—用獨立 sprite |

### 6.2 圖2 — 裝備介面

**框體使用拆解**：

| 區域 | 框體類型 | 填充 | 邊框 | 備注 |
|---|---|---|---|---|
| 裝備詳情（左側大卡） | 深色金屬框 | `#1A1A1AEE` | 金邊 2px | 內部再細分為：圖標行+數值行+說明行+按鈕行 |
| 裝備 icon 格 | 物品格子框 | `#1A1A1A` | 紫色邊2px（SSR級） | 左上角 SSR badge、右下角 Lv badge |
| 「替換」「移除」按鈕 | 深色小按鈕 | `#2A2520` | 金邊 1px | 小互動，不用金色CTA級別 |
| 四個裝備欄位（右側） | 物品格子框 | `#2A2520` | 依稀有度色 | 空格：虛線邊 + 十字加號 icon |
| 裝備提供能力（右下） | **淺色羊皮紙框** | `#E8DFD0F0` | 金色薄邊 1px | **唯一的淺色框**，用於靜態統計摘要 |
| 右側菱形Tab列 | 菱形Tab | 啟用金/閒置暗墨 | 外 glow | 每個 Tab 含 icon + 文字label |
| 「升級」按鈕 | 金色CTA框 | `#2A2018` | 粗金邊 3px | 最大互動強調 |
| 「一鍵升等」「一鍵配戴」 | 紅色按鈕 / 金色按鈕 | 紅 / 金 | — | 双 CTA 並排，紅色為次要 |
| 「全部卸除」（右上） | 紅色破壞框 | `#8B1A1ADD` | 暗紅金屬邊 | 危險操作 |
| 重鑄/打磨 icon按鈕 | 圓形icon | `#2A2520CC` | 金色環 | 與圖1 生平/獎勵同家族 |

### 6.3 圖3 — 戰令商城（Battle Pass）

**框體使用拆解**：

| 區域 | 框體類型 | 填充 | 邊框 | 備注 |
|---|---|---|---|---|
| 左側分類選單 | 深色容器 | `#1A1510DD` | 無邊框 | 各選項用 icon+文字排列，選中態金色高亮 |
| 主內容面板（戰令獎勵區） | **大面積羊皮紙框** | `#EBE3CEFF` | 金色薄邊 1px + 圓角 4px | 這是參考圖中**最大面積的淺色框應用** |
| RANK 圓形 badge | 特殊圓形 | 深色 `#1A1A1A` | 粗金環 3px | 數字 "3" 居中，金色字 |
| 進度條框 | 進度容器 | 灰底 `#3A3A3A` | 金邊 1px | 填充漸層：`#4CAF50` → `#C9A028` |
| 免費戰令物品格 | 物品格子框 | `#2A2520` | 金屬細邊 1px | 深色底格子嵌在淺色面板中 → 內外反差 |
| 進階戰令物品格 | 物品格子框 | `#2A2520` | 略深邊 1px | 與免費同框型但加 🔒 遮罩表示鎖定 |
| 等級節點（①②③④⑤） | 圓角數字 badge | 金色圓底 | 金色 | 當前等級外加陰影 + 皇冠 |
| 「購買進階戰令」按鈕 | 金色CTA框 | `#2A2018` | 粗金邊 3px + glow | 最大 CTA，文字金色 |
| 「一鍵領取」按鈕 | 金色CTA框 | `#2A2018` | 粗金邊 3px | 次要 CTA |
| 右上角英雄半身像 | 無框 | — | — | 疊在面板右上角，做decorative用 |

> **重點觀察**：戰令介面是深淺嵌套的最佳範例——大面積淺底面板為主體，其中嵌入深色物品格，形成「獎品在展示台上」的感覺。這比全深色一片更有高級感。

### 6.4 圖4 — 信件系統（Mailbox）

**框體使用拆解**：

| 區域 | 框體類型 | 填充 | 邊框 | 備注 |
|---|---|---|---|---|
| 信件列表（左側） | 羊皮紙框 | `#E8DFD0F0` | 左側無邊、上下各項用水平分隔線 | 每封信是一行 row，選中態做底色加深 `#DDD4C2` |
| 分類Tab列（最左邊） | 垂直icon Tab | 深色 `#2A2520` | 選中態加左側金色指示條 | icon + 文字 + badge（99）|
| 信件內文（右側上方header） | 深色金屬框 | `#1A1510EE` | 無額外框邊（靠底色分界） | 標題金色大字、日期白字、寄件者資訊 |
| 信件內文（右側下方body） | **羊皮紙框** | `#EBE3CE` | 微弱棕邊 1px | 長距離純文字閱讀 → 必須淺底 |
| 底部動作列（左半） | 深色容器 | `#2A2520DD` | — | 「一鍵領取」金按鈕 + 「全部刪除」紅按鈕 |
| 底部動作列（右半） | 行動按鈕排列 | 深褐 `#3A3028` | 金邊 1px | 翻譯/收藏/刪除/跳轉，每個是小金屬按鈕 |
| 紅色 badge（99） | 紅色圓形 | `#D32F2F` | 無 | 未讀數量 |
| 捲軸 icon（每行右側） | 裝飾icon | — | — | 信件類型 icon，不影響框體 |

> **重點觀察**：信件是「閱讀密集型」介面，右側大量使用淺色底。此處的 header（深） → body（淺）切換，對比 Unity 常見的「同色底」做法更有視覺呼吸。

---

## 7. 與本專案現有系統的差距

### 7.1 已具備 ✅

| 項目 | 現狀 |
|---|---|
| 五層框體概念（frame/bleed/fill/accent/bg） | `general-detail-default.json` 已完整建立 |
| design tokens 色彩系統 | `ui-design-tokens.json` v2.2 定義了完整色值 |
| 九宮格 border 規範 | skin 全部有整數 border + bleed 值 |
| 稀有度色 | 7 級稀有度色已定義 |
| button-skin 三態 | equipment / commerce 按鈕已建立 |
| label-style 多層級 | 從 title 到 muted 共 10 種 label-style |

### 7.2 需補強 ⚠️

| 項目 | 差距 | 影響 |
|---|---|---|
| **淺色羊皮紙框體家族** | 目前只有 `surfaceParchment: #E8DFD0` 色值，**沒有對應的 sprite 資產和 skin slot** | 信件、戰令等閱讀型介面無法呈現參考圖品質 |
| **shadow/投影層** | 現有系統只有 frame+bleed+fill+accent+bg 五層，**缺少外投影層** | 框體浮起感不足，「貼紙感」問題 |
| **紋理 noise** | 目前填充全為純色或 color-rect，**無紙張紋理、金屬噪點** | 高質感差距的主要來源 |
| **深淺框體決策機制** | 目前只有深色框家族，**無原則化的深/淺切換規範** | 所有畫面看起來偏暗偏平 |
| **Tab 框體家族** | 水平 Tab 有基本實作，**垂直菱形 Tab 完全缺失** | 圖2 右側的菱形 Tab 列無法實現 |
| **物品格子框家族** | 無統一的 item-cell skin，**各處格子未標準化** | 戰令、裝備格子難以批量生產 |
| **紅色破壞按鈕家族** | 只有 equipment 金色系按鈕，**紅色 CTA 缺失** | 「全部刪除」等操作無對應素材 |
| **進度條框體** | 無 progress-bar skin/slot 定義 | 戰令進度條無標準框體 |
| **文字描邊一致性** | label-style 有 outlineWidth/Color，但**部分淺底場景不該加描邊卻統一加了** | 淺底上的深色字加黑描邊會很奇怪 |

### 7.3 差距量化評分（含近期進度更新）

> **2026-03-31 v3 中期估算（Agent2 Session 5）**：反映 Phase 0/A 全完成（29 tasks）＋Phase B 3/5 完成（UI-2-0013~0015 shadow rollout、B-1/B-3 tokens/label-style）＋C-1 shadow runtime 70%。
> **2026-03-31 v3.1 文件校正（Agent1）**：`UI-2-0018` 已補齊真實預覽入口，`UI-2-0019` 已把 D-2 收斂為 `common-parchment / light-surface carrier consistency`。目前待辦不再是「有沒有 preview」，而是 `UI-2-0020` 是否把 `shop-main` / `gacha` 接上真正可驗的 shared carrier；D-1 / D-3 已可進入正式截圖驗收。
> *(前版備註：已新增 3 個 button family preview、完成 19 畫面 button family 盤點 CSV、keep.md §4.1 已納入 5-family 分類)*

| 維度 | 參考圖標準 (10/10) | 目前得分 | 前次得分 | 說明 |
|---|---|---|---|---|
| 框體分類完整性 | 7 種家族 | **7/10** | 3 | §2 全 7 種框體家族均有 sprite：dark_metal/parchment/gold_cta/tab/diamond_tab/item_cell+badge/警告（紅）；另含 bleed/shadow/noise/circle_icon/progress_bar 共 18 個族群資料夾 |
| 深淺對比策略 | 深淺嵌套 | **3/10** | 2 | parchment frame + token + label-style 基建完成（B-1/B-3），但 skin fragment（B-4/B-5）尚未完成，畫面上尚無可見的淺底面板 |
| 邊緣融合品質 | 3 層（frame+bleed+shadow） | **7/10** | 6 | shadow slots 補齊全 19 個 skin（B-2），C-1 shadow runtime 第一版已通過 acceptance（70%）；popup/Layout 剩餘缺口由 UI-2-0016 追蹤 |
| 紋理質感 | 金屬噪點+紙張纖維 | **2/10** | 1 | `metal_noise_256.png` + `paper_noise_256.png` 就緒（A-5），但 C-2 noise overlay runtime 尚未實作，目前仍為純色呈現 |
| 文字配色 | 深底白/金 vs 淺底褐/黑 | **6/10** | 5 | `bodyOnParchment` / `labelOnParchment` label-style 已建立（B-3），深底配色已到位；淺底面板待 B-4/B-5 部署後才能目視驗證 |
| 按鈕家族完整性 | 金CTA+紅破壞+小互動+導覽+工具 | **8/10** | 5 | 全 5 個 button family 正式落地且接入畫面（P0-1~P0-6 完成）；§3.3 gold-edge 掃描 10/10 PASS；待 D-1~D-3 截圖視覺 QA |
| 物品格子標準化 | 統一格子+稀有度邊色 | **4/10** | 2 | item_cell bg + 7色稀有度border（A-2）+ badge套件 9 檔（UI-1-0010）完成；skin fragment（B-4）尚未接線，格子在畫面上仍為預設樣式 |
| **總體平均** | — | **5.3 / 10** | 3.4 | Phase A 全完成（14 項） + B-2 shadow rollout + B-1/B-3 tokens/label-style 帶動顯著提升；按鈕家族 +3 分、框體完整性 +4 分是主要跳升驅動力 |

### 7.4 高槓桿提升路徑（投資報酬率排序）

> 以下排序依**同等工時能帶來的視覺品質提升幅度**，由高到低。

| 排名 | 項目 | 預估工時 | 預估品質跳升 | 原因 |
|---|---|---|---|---|
| 🥇 | 深淺嵌套落地（parchment frame + paper.utility 接入） | 中 | +2.0 | 一旦有「淺色面板 + 深色格子」，整體層次感指數級提升——這是參考圖與我們最大的觀感差距 |
| 🥈 | nav.ink 正式接入 lobby-main | 低 | +1.0 | 首頁左側導覽從純色改為墨漆質感，第一印象直接改變 |
| 🥉 | Shadow 層補齊 | 低 | +1.0 | 所有框體從「平貼」變「浮起」，整體深度感大幅改善 |
| 4 | 紋理 noise overlay | 低~中 | +1.5 | 每個家族只需 1-2 張 noise overlay（Perlin / directional），但效果是「純色 → 質感」的本質跳躍 |
| 5 | warning.destructive 接入 | 低 | +0.5 | 語意完整性補齊，影響面較窄 |
| 6 | item-cell 標準化 | 中 | +1.0 | 影響面廣（戰令、裝備、轉蛋都用），但需要 7 色稀有度邊框 |
| 7 | label-style 淺底變體 | 低 | +0.5 | 純 JSON 修改，配合 parchment 框體才有意義 |

---

## 8. 落地行動方案（Task-Level）

> 本章節取代舊版抽象建議，改為**可直接執行的 task-level 行動方案**。每個 task 包含驗收條件、所有者標記與依賴關係。
> 所有者標記：`[SPR]` = Sprite 生產 Agent、`[SKN]` = Skin/JSON 架構 Agent、`[RND]` = Renderer/程式 Agent、`[QA]` = 視覺 QA（人工）。
> 完整 To-Do 追蹤計畫見 `docs/ui-quality-todo.md`。

### Phase 0：立即落地（已有 preview，可直接接入）

| Task ID | 任務 | 所有者 | 依賴 | 驗收條件 |
|---|---|---|---|---|
| P0-1 | nav.ink preview → 正式 runtime sprite | `[SPR]` | — | `assets/resources/sprites/ui_families/common/nav_ink/btn_primary_{normal,pressed,disabled}.png` 存在且 border `[20,20,20,20]` 驗證通過 |
| P0-2 | nav.ink 接入 `lobby-main-default.json` | `[SKN]` | P0-1 | lobby-main skin 的 `lobby.nav.btn.*` slots 改為 `button-skin` kind，指向 nav_ink sprite 路徑；preview 截圖確認深墨底 + 金邊 active |
| P0-3 | paper.utility preview → 正式 runtime sprite | `[SPR]` | — | `assets/resources/sprites/ui_families/common/paper_utility/btn_primary_{normal,pressed,disabled}.png` 存在 |
| P0-4 | paper.utility 接入 duel-challenge（reject/utility） | `[SKN]` | P0-3 | `duel-challenge-default` 的 reject/utility 按鈕改用 `paper_utility` family；截圖確認宣紙質感與 `equipment.primary` 的暖金確認感形成合理視覺層級 |
| P0-5 | warning.destructive preview → 正式 runtime sprite | `[SPR]` | — | `assets/resources/sprites/ui_families/common/warning/btn_primary_{normal,pressed,disabled}.png` 存在 |
| P0-6 | 驗證 button border 20px 規範 | `[QA]` | P0-1~5 | 批量檢查所有新 button sprite 的 9-slice border 不衝突；高度 ≥ 56px 時 20+20=40 < 56 通過 |

### Phase A：建立缺失的框體家族

| Task ID | 任務 | 所有者 | 依賴 | 產出 | 驗收條件 |
|---|---|---|---|---|---|
| A-1 | 羊皮紙框體 sprite（frame/fill/bg） | `[SPR]` | — | `sprites/ui_families/common/parchment/` 下 3~5 張 | 拉伸至 400×300 無明顯重複紋理；角區 ≥ 16px 含做舊效果 |
| A-2 | item-cell 框體 sprite（bg + 7 色稀有度邊框） | `[SPR]` | — | `sprites/ui_families/common/item_cell/` 下 8~10 張 | 80×80 / 100×100 正方；每色邊框在深色底上清晰辨識 |
| A-3 | shadow/投影層通用 sprite | `[SPR]` | — | `sprites/ui_families/common/shadow/` 下 2~3 張 | 9-slice 拉伸無鋸齒；blur 效果 4~8px；`#00000030~50` 透明度 |
| A-4 | progress-bar 框體（track + fill） | `[SPR]` | — | `sprites/ui_families/common/progress_bar/` 下 2~3 張 | track 灰底金邊 1px；fill 支持 sliced 漸層 |
| A-5 | 紋理 noise overlay 套件 | `[SPR]` | — | `sprites/ui_families/common/noise/` 下 metal_noise + paper_noise 各 1 張 | 256×256 tileable；overlay 混合 5~10% 時不影響可讀性 |

### Phase B：Skin 系統升級

| Task ID | 任務 | 所有者 | 依賴 | 驗收條件 |
|---|---|---|---|---|
| B-1 | `ui-design-tokens.json` 新增 parchment 系列 token | `[SKN]` | — | 新增 `surfaceParchmentFill` / `textOnParchment` / `dividerOnParchment` / `shadowDefault` token |
| B-2 | 所有畫面 skin 加入 `*.shadow` slot 定義 | `[SKN]` | A-3 | 19 個 skin 各有 shadow slot；UISpecLoader 可正確解析 |
| B-3 | label-style 補充「淺底專用」變體 | `[SKN]` | B-1 | 新增 `bodyOnParchment` / `labelOnParchment` label-style；無描邊，文字色 `#2D2926` |
| B-4 | item-cell 標準 skin fragment | `[SKN]` | A-2 | 可被 gacha / shop / equipment skin 引用；含 rarity 色動態切換邏輯定義 |
| B-5 | common-parchment skin fragment | `[SKN]` | A-1, B-1 | 可被 mail / battle-pass / general-detail skin 引用的共用淺色框體 slot 集 |

### Phase C：Renderer 與程式支持

| Task ID | 任務 | 所有者 | 依賴 | 驗收條件 |
|---|---|---|---|---|
| C-1 | `UIPreviewBuilder` 加入 shadow layer 渲染 | `[RND]` | A-3, B-2 | shadow sprite 自動渲染在 frame 下方，偏移量由 skin slot config 控制 |
| C-2 | `UIPreviewBuilder` 支持 noise overlay 混合 | `[RND]` | A-5 | noise texture 以 overlay blend mode 疊在 fill 層上，opacity 由 token 控制 |
| C-3 | button-skin 支持 `selected` 第四態 | `[RND]` | — | Tab 類按鈕可用 `selected` 態（金色高亮底）；fallback 為 normal |

### Phase D：畫面驗證台

| Task ID | 任務 | 所有者 | 依賴 | 驗收條件 |
|---|---|---|---|---|
| D-1 | lobby-main 全面板 nav.ink + shadow 驗證 | `[SKN]` + `[QA]` | P0-2, B-2, C-1, UI-2-0018 | 使用 `LoadingScene.previewTarget=LobbyMain` 截圖，並與參考圖（圖1/圖3 左側導覽）並排對比，品質差距 ≤ 30% |
| D-2 | shop-main + gacha light-surface / common-parchment 多畫面驗證 | `[SKN]` + `[QA]` | UI-2-0014, UI-2-0018, UI-2-0019, UI-2-0020 | `shop-main` 與 `gacha` 的 shared light-surface carrier 在亮度、邊框存在感、文字可讀性上保持一致 |
| D-3 | duel-challenge paper.utility + equipment 混搭驗證 | `[SKN]` + `[QA]` | P0-4, UI-2-0012, UI-2-0018 | 使用 `LoadingScene.previewTarget=DuelChallenge` 截圖，確認 reject 用 paper.utility、accept 用 equipment.primary 的語意區分清晰 |
| D-4 | 產出「品質評分 v2」更新至本文件 § 7.3 | `[QA]` | D-1~3 | 至少 3 個維度提升 ≥ 1 分 |

> 2026-03-31 補充：Agent2 已補開 `UI-1-0014 ~ UI-1-0016` 三張對應 QA 卡，並建立 `docs/agent-briefs/agent2-visual-qa-playbook.md` 作為 D-1~D-3 的共用截圖與評分模板。
>
> 2026-03-31 再補充：`UI-2-0018` 已完成，正式預覽入口統一為 `assets/scenes/LoadingScene.scene` → root `LoadingScene` 元件 → `previewMode=true` → `previewTarget={LobbyMain,ShopMain,Gacha,DuelChallenge}`；D-1 與 D-3 已解除 blocked。
>
> 2026-03-31 再補充 2：`UI-2-0019` 已完成，D-2 的正式目標不再是 `paper.utility`，而是 `common-parchment / light-surface carrier consistency`；目前剩 `UI-2-0020` 負責把 `shop-main-default` / `gacha-default` 接上真正可驗的 shared carrier。

---

## 9. AI 架構分析：「自然不協調感」的落地原理

> 本章節由 AI 在分析完整份參考圖品質文件後產出，旨在把「自然不協調感」從直覺觀察轉化為可工程化的設計原則。

### 9.1 核心洞察：材質層級 ≠ 隨機材質混搭

參考圖中的「自然不協調感」不是隨機在不同畫面使用不同材質。它的底層邏輯是 **Material Hierarchy（材質層級映射）**：

```
互動層級（由遠到近）    →    材質家族
────────────────────    ────────────────
全域導覽（永遠在場）    →    黑漆門牌 / 墨板（nav.ink）
內容承載（閱讀為主）    →    宣紙 / 竹簡（parchment / paper.utility）
推進操作（養成主軸）    →    暖金屬 / 墨染金（equipment.primary）
高轉換行動（花錢主軸）  →    亮金屬 / 拋光金（commerce.primary）
不可逆操作（危險動作）  →    朱砂 / 焦鐵（warning.destructive）
```

**Unity 對照**：這類似 Unity 中為不同 Canvas Layer 設置不同材質 Profile 的做法，但更精細——不是按 Z-order 分，而是按**語意角色**分。

### 9.2 框體家族 vs 按鈕家族的交叉映射

本文件 § 2 定義了 7 種**框體家族**（dark-metal, parchment, overlay, gold-cta, red-destructive, tab, item-cell），keep.md § 4.1 定義了 5 種**按鈕家族**（commerce, equipment, nav.ink, paper.utility, warning.destructive）。它們不是兩套獨立系統，而是同一材質語言的不同面向：

| 按鈕家族 (keep.md § 4.1) | 對應框體載體 (本文件 § 2) | 落地關係 |
|---|---|---|
| `commerce.primary` | § 2.4 Gold CTA Frame | 按鈕 sprite 住在金色 CTA 框體內；按鈕本身就是框體的互動態 |
| `equipment.primary` | § 2.1 Dark Metal Frame（暖化版） | 按鈕用墨染暖金，框體提供周圍的深色面板環境 |
| `nav.ink` | § 2.1 Dark Metal Frame（冷化版） | 導覽按鈕是框體的一部分，active/inactive 從框體填充色切換 |
| `paper.utility` | § 2.2 Parchment Frame | 宣紙按鈕與宣紙面板共用材質家族，按鈕只是更小更可互動的宣紙片段 |
| `warning.destructive` | § 2.5 Red Destructive Frame | 紅色按鈕是破壞框體的縮版 |

**給 Agent 的指引**：做 sprite 時，同一個家族的按鈕和框體必須共用**色彩基調**、**noise texture 類型**和 **bleed 暖度**。如果 nav.ink 按鈕的 bleed 是暖銅色，但 nav.ink 面板的 bleed 是冷灰色，視覺上就會「斷裂」。

### 9.3 深淺嵌套：品質提升的最大槓桿

§ 7.3 評分中，「深淺對比策略」僅 2/10，這是**最大的品質跳崖點**。原因：

- 人眼對**明度對比**的敏感度遠高於色相對比
- 參考圖中所有「高級感」畫面都包含至少一次深→淺或淺→深的嵌套（圖3 戰令的淺色獎勵面板 + 深色格子；圖4 信件的深色 header + 淺色 body）
- 我們目前所有畫面都是**同色調深底**，視覺上「一坨黑」，即使框體層次正確也看不出差異

**Unity 對照**：這就像 Unity 中所有 Panel 都用同一個 Material + 同一個 alpha，即使佈局正確也看起來很「平」。解法不是調 panel 本身，而是故意讓**相鄰面板的明度值差 ≥ 40%**。

### 9.4 Shadow 層不是裝飾，是架構升級

§ 4.2 正確指出缺少 shadow 層導致「貼紙感」。補充分析：

- Shadow 層本質是**空間深度的視覺暗示**——沒有它，所有框體永遠在同一個 Z 平面上
- 在 2D UI 中模擬 Z 深度只有三種手段：**陰影** / **尺寸差** / **模糊差**。陰影是成本最低、效果最穩定的手段
- 建議 shadow sprite 做成通用 9-slice（模糊黑色 rounded rectangle），由 skin slot 的 `shadowOffset` 和 `shadowScale` 控制偏移和放大比例
- **不建議用 shader**：shader 方案在 Cocos Web 平台有 drawcall 和相容性風險；9-slice sprite 方案零額外 drawcall（共用 atlas）

### 9.5 紋理 Noise 的投資報酬率

§ 7.3 中紋理質感 1/10 是最低分項，但修復成本其實很低：

| 紋理類型 | 用途 | 尺寸 | 製作方式 | 混合方式 |
|---|---|---|---|---|
| `metal_noise.png` | 金屬框邊/按鈕表面 | 256×256 tileable | Photoshop → Add Noise → Motion Blur (斜 45°) | overlay, opacity 5~10% |
| `paper_noise.png` | 宣紙面板/paper.utility 按鈕 | 256×256 tileable | Photoshop → Clouds → 極低對比 | multiply, opacity 3~8% |

**每個家族只需要多 1 張 noise texture**，就能從「純色填充」跳到「材質質感」，這是 ROI 最高的視覺改善路徑之一。

### 9.6 文件 § 2~§ 6 的「可執行化」對照

| 原文觀察 | 可執行規則 | 驗證方式 |
|---|---|---|
| § 2.1 角區 20~24px | `border ≥ [20,20,20,20]`（dark-metal 框體） | JSON schema 驗證 |
| § 2.2 紙張角區做舊 | parchment frame 四角含 ≥ 4px 色差（褐斑） | 視覺 QA 目檢 |
| § 3.3 金色邊框永遠存在 | **所有**框體 sprite 必須包含 ≥ 1px 金色/銅色邊界線 | sprite 自動掃描腳本 |
| § 4.2 bleed 層必須存在 | skin slot 中 `*.bleed` 不可省略（可設透明但 slot 必須宣告） | JSON contract 驗證 |
| § 4.3 主面板不透明度 85~95% | skin fill slot 的 color hex 結尾必須在 `DD`~`F0` 範圍 | JSON contract 驗證 |
| § 5.4 深底文字必有描邊 | 深底上 label-style 的 `outlineWidth ≥ 1` | UI contract 驗證 |
| § 5.2 淺底文字不加描邊 | 淺底上 label-style 的 `outlineWidth = 0` 且 `color` 為深褐 | UI contract 驗證 |

---

## 10. Agent 協作分工策略

> 本章節定義如何讓兩個（或以上）AI Agent 在同一份品質目標下平行工作而不衝突。

### 10.1 核心原則：Domain Partitioning（領域分割不是檔案分割）

兩個 Agent 同時改同一個 JSON 是最常見的衝突源。解法不是「A 改前半、B 改後半」，而是按**資產領域**劃分：

```
Agent2（視覺資產 Agent）                Agent1（架構接線 Agent）
────────────────────────                ────────────────────────
負責 sprite 生成 / noise texture        負責 skin JSON 接線 / design token
負責 gen-ui-layered-frames.ps1 腳本     負責 UIPreviewBuilder.ts 程式
負責 preview → runtime 資產搬遷         負責 layout JSON 新增 slot 定義
負責逐圖拆解品質驗收                     負責契約驗證腳本更新
```

### 10.2 不衝突的分工矩陣

| 工作項目 | Agent2（視覺/素材） | Agent1（架構/接線） | 衝突風險 |
|---|---|---|---|
| **生成 sprite PNG** | ✅ 執行 | ❌ 不碰 | 無 |
| **修改 skin JSON 的 skin slot** | ❌ 不碰 | ✅ 執行 | 無 |
| **修改 layout JSON 的節點樹** | ❌ 不碰 | ✅ 執行 | 無 |
| **修改 design-tokens.json** | ❌ 不碰 | ✅ 執行 | 無 |
| **修改 gen-ui-layered-frames.ps1** | ✅ 執行 | ❌ 不碰 | 無 |
| **修改 UIPreviewBuilder.ts** | ❌ 不碰 | ✅ 執行 | 無 |
| **修改 keep.md § 4.1** | 提議 → 人工確認 | 提議 → 人工確認 | ⚠️ 兩者都可能要改；用 PR 審核 |
| **修改本文件（品質分析.md）** | 更新 § 6 逐圖拆解 / § 7 差距 | 更新 § 8 Task / § 9 架構分析 | ⚠️ 各自負責不同章節 |
| **修改 cross-reference-index.md** | 不碰 | ✅ 執行 | 無 |
| **產出 preview 截圖** | ✅ 執行 | ❌ 不碰 | 無 |
| **視覺 QA 驗收** | ✅ 初檢 | ❌ | 最終由人工覆核 |

### 10.3 共用文件的章節鎖定規則

| 共用文件 | Agent2 可改章節 | Agent1 可改章節 | 絕不可同時改 |
|---|---|---|---|
| `docs/keep.md` | 無（只可提議） | § 4.1 按鈕家族 rollout 狀態 | § 4.1 主體規範 |
| `docs/UI參考圖品質分析.md` | § 6, § 7.1, § 7.2, § 11 | § 8, § 9, § 10 | § 7.3 評分（需協調） |
| `docs/美術素材規劃與使用說明.md` | § 4.4 family workflow | § 4.4 以外 | § 4.4 本體 |
| `docs/cross-reference-index.md` | 不碰 | 統一由一個 Agent 維護 | — |

### 10.4 推薦的工作序列（避免阻塞）

```
── 時間軸 ──────────────────────────────────────────────────

Agent2                              Agent1
─────────                            ─────────
[1] 生成 nav_ink runtime sprite      [1] 更新 design-tokens (parchment)
[2] 生成 paper_utility sprite        [2] lobby-main skin 接入 nav.ink
    └─ 等 Agent2-1 完成再開始 Agent1-2           （需要 Agent2-1 的 sprite 路徑）
[3] 生成 shadow sprite               [3] shop-main skin 接入 paper.utility
    └─ 等 Agent2-2 完成再開始 Agent1-3
[4] 生成 noise overlay textures      [4] skin 加入 shadow slot
    └─ 等 Agent2-3 完成再開始 Agent1-4
[5] 品質截圖驗收                      [5] UIPreviewBuilder shadow 支持
                                     [6] 契約驗證腳本更新
```

### 10.5 To-Do 文件作為協調中心

- 所有可分配的 task 統一在 `docs/ui-quality-todo.md` 中追蹤
- 每個 task 標記 `owner: Agent2 / Agent1 / 待分配`
- Agent 開始工作前先讀 To-Do 文件，確認目前進度
- Agent 完成 task 後立即更新 To-Do 文件的狀態
- **人類開發者可隨時介入接管任何 task**，只需在 To-Do 中改 owner 為人名

### 10.6 打斷恢復機制

> 「如果 Agent 被中斷，如何恢復？」

1. 新 Agent 啟動時，**必讀三份文件**：
   - `docs/keep.md`（最高準則）
   - `docs/ui-quality-todo.md`（當前進度）
   - `docs/UI參考圖品質分析.md`（品質目標）
2. To-Do 文件中 `status: in-progress` 的項目就是上一個 Agent 被中斷的點
3. 新 Agent 應先完成 `in-progress` 項目，再按優先序推進 `not-started` 項目
4. 若 `in-progress` 項目的產出物不完整（例如 sprite 生成到一半），新 Agent 應重做該項目而非嘗試續接半成品

---

## 11. 已有產出物與基準線

> 記錄截至目前為止已經產出的 preview、審計表與 sprite，作為後續工作的起點。

### 11.1 Preview Sprite 資產

| Family | Preview 路徑 | 狀態 | 說明 |
|---|---|---|---|
| nav.ink | `artifacts/ui-layered-frames/family-previews/nav_ink/btn_primary_{normal,pressed,disabled}.png` | ✅ Preview 完成 | 深墨棕底、金色窄邊、ink-lacquer 質感 |
| paper.utility | `artifacts/ui-layered-frames/family-previews/paper_utility/btn_primary_{normal,pressed,disabled}.png` | ✅ Preview 完成 | 暖米白宣紙底、微做舊棕邊 |
| warning.destructive | `artifacts/ui-layered-frames/family-previews/warning/btn_primary_{normal,pressed,disabled}.png` | ✅ Preview 完成 | 赤陶紅棕底、暖金屬邊框 |
| commerce.primary | `assets/resources/sprites/ui_families/common/commerce/btn_primary_*.png` | ✅ 正式落地 | 亮金屬 CTA |
| equipment.primary | `assets/resources/sprites/ui_families/common/equipment/btn_primary_*.png` | ✅ 正式落地 | 暖金墨染 |

### 11.2 Screen Button Family 盤點

| 檔案 | 路徑 | 內容 |
|---|---|---|
| 盤點 CSV | `artifacts/ui-source/button-family-screen-audit-2026-03-31.csv` | 19 畫面 × 8 欄位：screen_id, layout, skin, current state, recommended dominant, secondary, status, notes |
| 摘要 TXT | `artifacts/ui-source/button-family-summary-2026-03-31.txt` | 按 dominant family 分群 + 下一步優先序 |
| Preview Skin Manifest | `temp_workspace/button-family-preview.json` | 3 個 button-skin slot 定義（nav.ink / paper.utility / warning.destructive） |
| Agent2 Visual QA Playbook | `docs/agent-briefs/agent2-visual-qa-playbook.md` | D-1~D-3 共用的截圖路徑、人工驗收欄位與 notes 模板 |

### 11.3 Equipment Ink Preview（歷史留存）

| Variant | 路徑 | 說明 |
|---|---|---|
| A（較淡） | `artifacts/ui-layered-frames/equipment-ink-preview/` | 初版 horizontal-ink 水墨模式 |
| B（較濃） | `artifacts/ui-layered-frames/equipment-ink-preview-b/` | 加強 ink stroke，更接近參考圖的暖琥珀底 |

### 11.4 PowerShell 渲染工具狀態

- `tools/gen-ui-layered-frames.ps1` 已支援 `ButtonInkMode` 參數（`blobs` / `horizontal-ink`）
- 新增函式：`Add-ButtonInkStrokes`、`Add-ButtonSurfaceOverlay`
- 可用於批量生成新 family 的 preview sprite

---

> **本文件的定位**：作為 UI 框體品質目標的**可執行基準**，所有後續 skin JSON 設計、sprite 製作、UI 驗收、Agent 分工均需參考此文件。相關規格連結：`docs/UI技術規格書.md`、`docs/UI 規格書.md`、`assets/resources/ui-spec/ui-design-tokens.json`、`docs/ui-quality-todo.md`。


---

## 2026-04-01 BattleScene Icon 候選稿比對

### 比對對象

- 候選稿：`artifacts/ui-generated/UI-2-0028/unitinfo_type_icon_spear_v1.png`
- 參考圖：
  - `docs/UI品質參考圖/螢幕擷取畫面 2026-03-29 143202.png`
  - `docs/UI品質參考圖/螢幕擷取畫面 2026-03-31 091522.png`
  - `docs/UI品質參考圖/螢幕擷取畫面 2026-04-01 011025.png`
  - `docs/UI品質參考圖/螢幕擷取畫面 2026-04-01 011040.png`
  - `docs/UI品質參考圖/螢幕擷取畫面 2026-04-01 011101.png`

### 結論

`unitinfo_type_icon_spear_v1.png` 已具備輪廓清楚、語意明確、適合複製量產的優點，但和參考圖中的正式 icon 語言相比，仍偏向乾淨、對稱、亮色、現代化的 UI 徽章，不足以直接視為正式 runtime 品質。

### 明顯品質差異

1. **材質層次不足**
   參考圖 icon 常見做舊金屬、髒污、邊緣磨耗、內陰影或紙面紋理；v1 目前只有乾淨金屬圈與平滑藍底。

2. **配色過亮、過飽和**
   v1 的藍色高光與紅色鉚釘偏亮，視覺語言更接近現代化遊戲 UI；參考圖以舊金、墨黑、灰白、暗紅為主。

3. **carrier 語言不夠貼近參考圖**
   v1 使用工整圓章 medallion，但參考圖更常見六角章、舊幣章、刷痕背板或不規則章體。

4. **主 glyph 比外圈弱**
   目前最顯眼的是外圈金環，交叉長槍反而次要；參考圖的小 icon 多半是主圖形優先被讀到。

5. **縮圖辨識風險**
   128x128 下清楚，但若縮到 32x32，長槍柄、鉚釘與內圈容易糊成一團；參考圖 icon 通常 glyph 更粗、負空間更大。

6. **缺少題材化的不規則感**
   參考圖保留筆刷感、金屬缺口、亮暗不均等人工作痕跡；v1 目前仍太規則。

### 保留優點

- 語意明確：交叉長槍很直覺地對應兵種 / 戰場單位
- 輪廓乾淨：適合做成 icon family 的自動化母版
- 容易延展：可延伸成劍、盾、軍旗、齒輪等同系列 icon

### 後續修正方向

1. 將外圈從完美圓章改為更貼近參考圖的六角章、盾牌章或舊幣章。
2. 主 glyph 加粗約 `1.3x ~ 1.5x`，優先確保 `32x32` 可讀性。
3. 藍色與紅色降彩，改用舊金、灰藍、暗紅。
4. 補上 3%~5% 金屬噪點、1px 亮邊、2px 內陰影與邊緣磨耗。
5. v2 必須同時輸出 `128 / 64 / 32` 三種尺寸預覽。

### 任務對應

- `UI-2-0028` 保持 `in-progress`，代表第一張候選稿與參考圖比對已完成。
- 新開 `UI-2-0032`，專門處理 BattleScene icon v2 的品質修正。
