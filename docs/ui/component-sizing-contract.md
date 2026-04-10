# UI 元件尺寸契約 (Component Sizing Contract)

> **文件目的**: 定義所有 UI 元件的「幾何行為分類 (Geometry Behavior)」與標準尺寸矩陣，作為 repo 級的唯一尺寸真相來源。
> **設計基準**: 1920 × 1080 px 橫向。所有數值以此解析度為準，除非另有標記。
> **上游依據**: `docs/UI技術規格書.md` / `docs/UI品質檢核表.md` / `docs/keep-shards/keep-ui-arch.md`
> **最後更新**: 2026-04-09

---

## 1. 幾何行為分類 (Geometry Behavior Types)

每個 UI 元件都必須在 screen spec / task card 中明確標記所屬的幾何行為類別。共六類：

| 代號 | 名稱 | 說明 | 典型元件 |
|------|------|------|---------|
| **FX** | `fixed-scale` | 固定寬高；只允許整體等比 scale，不可單軸拉伸。| icon、badge、portrait、crest/medallion、固定標題、小按鈕 |
| **SS** | `stretch-safe-segmented` | 必須分件（cap＋band＋fill）才能安全左右拉伸，不可直接整體拉伸。| 橫向通用標題帶、可變寬度 header band |
| **SR** | `sliced-rect` | 9-slice 矩形框體；四角固定、四邊可拉伸。| 通用框體 panel、content card、對話框 |
| **TR** | `tiled-repeat` | 紋理可重複貼磚；不依賴角件比例。| 純紋理底板、fill tile |
| **LC** | `layout-container` | 由 `cc.Layout` 驅動寬高，隨子節點自動擴展，無固定尺寸。| 垂直/水平/格狀排列的容器節點 |
| **DI** | `data-image-fixed` | 尺寸由資料來源決定（如遊戲截圖、圖鑑圖片）；必須設定固定顯示槽大小，runtime 圖片 crop/fit 進此槽。| 地圖預覽、畫廊、截圖卡 |

### 1.1 行為選擇決策樹

```
此元件是否需要依內容文字/資料動態改變寬度？
├── 是 → 是否包含裝飾邊角（花角 ornate frame）？
│         ├── 是 → 使用 SS（分件）
│         └── 否 → 使用 SR（9-slice）
└── 否 → 此元件是否為純紋理底板或 fill tile？
          ├── 是 → 使用 TR（tiled-repeat）
          └── 否 → 此元件是否由子節點 Layout 決定大小？
                    ├── 是 → 使用 LC（layout-container）
                    └── 否 → 此元件是否顯示外部資料圖片？
                              ├── 是 → 使用 DI（data-image-fixed）
                              └── 否 → 使用 FX（fixed-scale）
```

---

## 2. Title 元件分類規則（重要）

Title（標題）元件必須明確區分兩種類型，不可混用：

### 2.1 Type A — 畫面專屬固定標題 (Screen-Specific Fixed Title)

- **定義**: 僅出現在一個特定畫面或特定區域；標題文字長度固定或有上限；不需跨畫面復用、不需依不同寬度拉伸。
- **幾何行為**: `FX`（fixed-scale）
- **資產實作**:
  - 整體 sprite 設為 `simple`（不 9-slice）
  - **不預設拆 left cap / right cap**
  - 若標題包含裝飾背景，背景圖為固定尺寸，整體 scale 即可
- **典型案例**:
  - GeneralDetailOverview 右側欄位的「屬性」、「血脈」、「技能」等區段標題
  - GeneralDetailOverview 的「概要資訊卡」組欄位標題
  - BattleHUD 內固定位置的狀態標頭
- **禁止事項**: 不可為此類 Title 生成 left-cap / right-cap 資產後再組合；應直接用整體圖或 label-only 實作。

### 2.2 Type B — 通用可拉伸標題 (Generic Reusable Title)

- **定義**: 跨多個畫面復用，或同一畫面中需配合不同資訊寬度延展；文字長度不固定。
- **幾何行為**: `SS`（stretch-safe-segmented）
- **資產實作**:
  - 必須拆成三件：`{name}-cap-left` + `{name}-band-fill` + `{name}-cap-right`
  - cap 為固定尺寸 FX；band-fill 為可水平拉伸（tiled 或 9-slice）
  - 典型 cap 尺寸範圍：寬 64–96 px、高 48–72 px（視設計語言而定）
- **典型案例**:
  - GeneralDetail 頂部橫幅 header band（跨 Tab 頁復用，需配合名字長度）
  - ShopMain 各商品類別橫幅
  - 任何跨畫面共用的區段標題帶
- **禁止事項**: 不可把 Type B 用一整張 simple sprite 實作，否則改文字寬度時圖形會拉壞。

---

## 3. 元件標準尺寸矩陣 (Component Sizing Matrix)

> 備註: 尺寸以 1920×1080 設計稿基準值為主；`adapts` 欄位為跨平台自適應模式；`min` 欄位為可讀性下限。
> 所有 `FX` 元件必須有明確的 W × H；所有 `SS` / `SR` 元件必須有明確的角件尺寸與最小寬度下限。

### 3.1 導覽與容器類

| 元件類別 | Behavior | 標準尺寸 W × H | 最小尺寸 | 備註 |
|---------|---------|--------------|--------|------|
| 全螢幕底板 | `SR` / `TR` | 1920 × 1080 | — | Widget 貼四邊 |
| 主要 Panel 框（含標題區） | `SR` | 依畫面而定，H ≥ 480 | — | 9-slice 角區 ≥ 20px |
| 二級 Panel 框（子區塊） | `SR` | 依位置，H ≥ 200 | 160 × 80 | 9-slice 角區 ≥ 16px |
| 分頁 Tab 列（Tab Bar） | `LC` | W = 100%，H = 60–72 | H ≥ 44 | 內含 Tab 按鈕 |
| 單顆 Tab 按鈕 | `FX` | 160–220 × 60–72 | 96 × 44 | |
| 捲動容器（ScrollView） | `LC` | 依內容區，H 可變 | — | 不設硬編死高度 |
| 列表列（List Row） | `SR` / `FX` | W = 100%，H = 72–88 | H = 56 | 固定高，寬自適應 |
| 工具提示（Tooltip） | `SR` | 240–480 × 80–160 | 200 × 60 | 9-slice；動態寬度 |
| Toast 浮動提示 | `SR` | 400–640 × 72–96 | 320 × 60 | 9-slice；不超高 |

### 3.2 Title 類

| 元件類別 | Type | Behavior | 標準尺寸 W × H | 備註 |
|---------|------|---------|--------------|------|
| 畫面專屬小標題（Type A） | A | `FX` | 自定義固定尺寸，典型 H = 36–56 | 不拆 cap，不 9-slice |
| 通用橫幅標題帶（Type B）—完整寬 | B | `SS` | 完整 W 依容器，H = 48–72 | cap + band + fill 三件 |
| Type B cap（左/右端帽） | B | `FX` | **64–96 × 48–72**（見各畫面 spec） | 固定尺寸，不可拉伸 |
| Type B band/fill（中段填充） | B | `SR` / `TR` | W 可拉，H = 同 cap H | 9-slice 或 tiled |

### 3.3 按鈕類

| 元件類別 | Behavior | 標準尺寸 W × H | 最小觸控 | 備註 |
|---------|---------|--------------|--------|------|
| 主要 CTA 按鈕（大） | `SR` | 240–320 × 72–80 | 44 × 44 | 9-slice；三態必驗 |
| 主要 CTA 按鈕（中） | `SR` | 160–240 × 60–72 | 44 × 44 | |
| 次要動作按鈕 | `SR` | 120–160 × 52–60 | 44 × 44 | |
| 破壞按鈕（紅色） | `SR` | 160–240 × 60–72 | 44 × 44 | 需二次確認設計 |
| 圓形圖示按鈕 | `FX` | 64 × 64 / 80 × 80 | 44 × 44 | |
| 關閉按鈕（×） | `FX` | **42 × 42**（layout 現況） | 44 × 44 | 注意最小觸控 |
| 文字連結按鈕 | `LC` | 文字包圍，H ≥ 44 | 44 × 44 | |

### 3.4 Icon / Badge 類

| 元件類別 | Behavior | 標準尺寸 W × H | 備註 |
|---------|---------|--------------|------|
| 大型 Icon（功能入口） | `FX` | **64 × 64** | 功能圖示、入口 icon |
| 中型 Icon（列表項目） | `FX` | **48 × 48** | 列表/格狀 icon |
| 小型 Icon（行內標籤） | `FX` | **32 × 32** | 行內、tag、inline 說明 |
| Badge（稀有度/狀態） | `FX` | **56 × 56** | 徽章等級、狀態標記 |
| 貨幣 Icon | `FX` | **40 × 40** | 行內貨幣符號 |
| 大型貨幣 Icon | `FX` | **56 × 56** | 商店/獎勵展示 |
| Tab Icon | `FX` | **40 × 40** | 分頁內圖示 |
| 稀有星等標識 | `FX` | **24 × 24**（單星） | 多顆並排時由 Layout 控制間距 |

#### Icon with Underlay 統一承載規則

- 若 icon 結構為 `underlay + glyph` 或 `underlay + glyph + runtime label`，**主 glyph 的外圍矩陣預設佔底板有效承載區的 80%**。
- 實作上可視為：底板可視承載盒若為 `W × H`，則 glyph 的包絡框目標為 `0.8W × 0.8H`，並保持中心對齊。
- 這個 80% 是 repo 級預設，不為單顆 icon 個別重定比例；若某 family 需要偏離，必須在 screen spec 或 icon family registry 明確標註例外原因。
- 其餘 20% 留給外圈 rim、bevel、陰影、安全留白與 badge / marker 疊層，避免 glyph 貼邊或不同 icon 家族出現承載密度漂移。

### 3.5 人物 / 肖像 / 裝飾類

| 元件類別 | Behavior | 標準尺寸 W × H | 備註 |
|---------|---------|--------------|------|
| 半身肖像（主舞台） | `DI` | 760 × 860（佔位槽） | 實際圖片 crop/fit；不硬拉 |
| 縮略頭像（列表/roster） | `FX` | **120 × 120** | |
| 小型頭像（inline） | `FX` | **64 × 64** | |
| Crest / Medallion（命紋） | `FX` | **120 × 120** — **200 × 200** | 依畫面大小；不可拉伸 |
| 裝飾 Plaque（牌匾底板） | `SS` | W 依標題長度，H = 72–96 | Type B 實作；cap + fill |
| Header Cap（左/右端帽） | `FX` | **84 × 64**（GDv3 基準） | 已驗證 occupancy 0.661 |

### 3.6 資源資訊類

| 元件類別 | Behavior | 標準尺寸 W × H | 備註 |
|---------|---------|--------------|------|
| 資源計數器（Resource Counter） | `FX` | **160–200 × 44–52** | icon + 數字組合 |
| 屬性數值列（Stat Row） | `LC` | W = 容器，H = 48–56 | label + value 排列 |
| 物品格（Item Cell） | `FX` | **96 × 96** / **120 × 120** | 不同場景可選 |
| 大型獎勵展示格 | `FX` | **160 × 160** | 轉蛋/商店獎勵 |

---

## 4. Screen Sizing Table 格式規範

每份畫面規格或任務卡都必須包含 **Component Sizing Table**，格式如下：

```markdown
## Component Sizing Table

| component-id | class | standard-size @1920×1080 | adaptation | geometry | stretch-rule | notes |
|-------------|-------|--------------------------|-----------|---------|-------------|-------|
| close-btn   | button | 42 × 42               | FX        | fixed-scale | 整體 scale | 注意最小觸控 44px |
| portrait-slot | image | 760 × 860             | DI        | data-image-fixed | crop/fit | 長寬比鎖定 |
| header-band | panel | 1160 × 180             | SS        | stretch-safe-segmented | cap+fill+cap | cap 寬 ~84 |
```

欄位說明：
- `component-id`：Prefab 或 layout JSON 中的 `name` / `id`
- `class`：UINodeType（container / panel / label / button / image / resource-counter…）
- `standard-size`：W × H，數字必須具體，不可寫「依內容」或「可變」
- `adaptation`：幾何行為代號（FX / SS / SR / TR / LC / DI）
- `geometry`：完整名稱（fixed-scale / stretch-safe-segmented / …）
- `stretch-rule`：若可拉伸，說明拆件 or 9-slice 規則；FX 元件填「整體 scale」
- `notes`：例外、最小觸控尺寸、對齊 layer 等補充

---

## 5. 強制規則摘要

1. **所有 `FX` 元件** 必須有明確的 W × H 標準尺寸；「大一點」或「依參考圖」不算數值。
2. **Title 元件** 在 screen spec 建立時必須先判斷 Type A or B，再決定資產拆件方式；預設不開 cap。
3. **美術委託書** 若元件幾何行為為 `FX`，必須在委託書中明確標示尺寸（W × H px）。
4. **PostProcess 驗收** 時，FX 元件的輸出尺寸必須完全符合標準尺寸，不允許浮動；SS 元件的 cap 必須符合 cap 標準尺寸。
5. **9-slice border 設定** (SR 元件): 角區大小在委託書與 skin JSON 中必須一致，不可只在 Cocos Inspector 設定。
6. **閉環要求**: Screen spec → Task card → ArtRecipe → PostProcess → Skin JSON 每個環節的尺寸必須完全一致，任何不一致點在最終驗收前必須修正。

---

## 6. 規則適用範例

### GeneralDetailOverview 右側資訊欄位 Title

- 右側「屬性」、「血脈」、「技能」、「概要」等區段標題 → **Type A，FX**
  - 這些標題只在 GeneralDetail 畫面中出現，文字長度固定（最多 4 個 CJK 字）
  - 標準尺寸約 240 × 52（依實際設計可微調），整體 scale 即可
  - **不應生成 left-cap / right-cap 資產**，這是已知的設計反模式

- GeneralDetail 頂部橫幅 (header band) → **Type B，SS**
  - 需配合角色名字長度拉伸
  - cap 標準尺寸 ~84 × 64（已驗收，occupancy 0.661）
  - 必須分件：header-cap-left + header-band-fill + header-cap-right

---

## 7. 版本與維護

- 若新增元件類別，先補此文件的 §3 矩陣，再更新相關 screen spec。
- 若某畫面的 standard size 與此表不一致，必須在 screen spec 中明確標記「例外」並說明原因。
- 此文件超過 400 行時，依 `docs/keep-shards/` shard policy 分片。
- 交叉索引：見 `docs/cross-ref/cross-ref-ui-spec.md`

---

*參考*: `docs/UI技術規格書.md` / `docs/UI品質檢核表.md` / `docs/ui/UI-factory-baseline-and-gates.md` / `docs/keep-shards/keep-ui-arch.md` / `docs/agent-briefs/tasks/UI-2-0096.md`
