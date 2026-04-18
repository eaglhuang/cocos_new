---
doc_id: doc_agentskill_0017
name: general-balance-tuner
description: '武將數值平衡調校 SKILL — 以雙軸演算法（maxStat + avg5）自動計算 rarityTier 與 characterCategory，並執行 EP 重算、適性校驗、因子分派、稀有度分布統計。USE FOR: 新武將入庫前的數值校準、全量武將的平衡盤點、稀有度自動分類。DO NOT USE FOR: 故事生成（用 general-story-writer）、資料爬取匯入（用 general-data-pipeline）。'
argument-hint: '指定目標武將 ID（單一或批次）、操作模式（classify / rebalance / audit / full）、以及是否要套用 characterCategory override。'
---

# General Balance Tuner

用這個 skill 對武將數值進行平衡調校，包含稀有度自動分類、EP 重新計算、適性校驗、因子合理性檢查。

Unity 對照：類似 Editor 中的 Balance Sheet 工具或自動化測試 ScriptableObject 的 Custom Inspector，但改用 Copilot 本機對話執行，零 API 成本。

## When to Use

- 新增武將需要自動判定 `rarityTier` 和 `characterCategory`
- 需要盤點全量武將的稀有度分布是否合理（N/R/SR/SSR/UR）
- 需要重新計算某位武將的 EP（因屬性調整）
- 需要檢查適性配置（兵種/地形/天氣）是否與稀有度匹配
- 需要為武將分派基因（genes）並確認合理性
- 需要驗證門檻值（rarity-thresholds.json）調整後的影響

## Do Not Use

- 不要用這個 skill 生成故事內容（用 `general-story-writer`）
- 不要用這個 skill 做資料爬取或匯入（用 `general-data-pipeline`）
- 不要直接覆蓋人工標記的 `rarityTier`（手動標記永遠最高優先）

## Procedure

### Step 1：載入設定與資料

**讀取門檻設定**：

```
assets/resources/data/rarity-thresholds.json
```

確認 `axes.maxStat`、`axes.avg5`、`categoryOverrides`、`excludeFromAvg` 配置正確。

**讀取武將資料**：

```
assets/resources/data/generals.json
```

**讀取 GeneralConfig 型別定義**：

```
assets/scripts/core/models/GeneralUnit.ts
```

### Step 2：雙軸稀有度計算

對每位目標武將執行以下演算法：

```
輸入：五主屬性 [str, int, lea, pol, cha]
      （luk 排除，依 excludeFromAvg 設定）

Axis A — maxStat 軸（偏科天才）：
  maxStat = max(str, int, lea, pol, cha)
  if maxStat >= 95 → legendary
  if maxStat >= 80 → epic
  if maxStat >= 65 → rare
  else → common

Axis B — avg5 軸（綜合實力）：
  avg5 = average(str, int, lea, pol, cha)
  if avg5 >= 80 → legendary
  if avg5 >= 65 → epic
  if avg5 >= 50 → rare
  else → common

最終 tier = max(Axis A, Axis B)
```

**Category Override 規則**（在雙軸計算之後）：
- `characterCategory === 'mythical'` → 強制提升至 `mythic`（UR）
- `characterCategory === 'titled'` → 強制提升至至少 `legendary`（SSR）
- 手動 `rarityTier` 欄位 → 跳過自動計算

**EP Fallback**：若五維全為 0（資料尚未填入），改用 EP 值推算：
- EP ≥ 90 → legendary
- EP ≥ 75 → epic
- EP ≥ 60 → rare
- EP < 60 → common

### Step 3：CharacterCategory 自動推薦

若武將尚無 `characterCategory`，根據以下規則建議：

| 條件 | 建議分類 |
|---|---|
| 五維最高值 < 50 | `civilian` |
| 50 ≤ 五維最高值 < 80 | `general` |
| 80 ≤ 五維最高值 且 自動 tier ≥ SR | `famed` |
| 手動標記或有覺醒名號 | 保留現有分類 |

### Step 4：EP 重新計算

EP 計算公式（依血統理論系統規格書）：

```
EP = 50 + [血脈共鳴] + [異脈加成] + [名將契合] + [天命波動]
```

簡化版（無血脈資料時）：

```
EP_base = round(avg5 * 0.8 + maxStat * 0.2)
EP_rating = EP_base >= 90 ? 'S+' :
            EP_base >= 85 ? 'S'  :
            EP_base >= 80 ? 'S-' :
            EP_base >= 75 ? 'A+' :
            EP_base >= 70 ? 'A'  :
            EP_base >= 65 ? 'A-' :
            EP_base >= 60 ? 'B+' :
            EP_base >= 55 ? 'B'  : 'C'
```

### Step 5：適性一致性校驗

檢查每位武將的適性配置是否與稀有度匹配：

| 稀有度 | 兵種適性（S/A 級數量） | 地形適性（S 級數量） | 天氣適性 |
|---|---|---|---|
| N | 0-1 個 S/A | 0 個 S | 無特殊 |
| R | 1-2 個 S/A | 0-1 個 S | 0-1 個 S |
| SR | 2-3 個 S/A | 1-2 個 S | 1 個 S |
| SSR | 3-4 個 S/A | 2 個 S | 1-2 個 S |
| UR | 4+ 個 S/A | 2+ 個 S | 2+ 個 S |

產出不一致項作為警告（不自動修正）。

### Step 6：因子分派建議

根據稀有度建議因子配置：

| 稀有度 | 建議因子數量 | 建議最高因子等級 |
|---|---|---|
| N | 1-2 | level 1 |
| R | 2-3 | level 1-2 |
| SR | 3-4 | level 2-3 |
| SSR | 4-5 | level 3-4 |
| UR | 5-6 | level 4-5 |

### Step 7：分布統計與報告

**全量盤點模式**（audit）：統計所有武將的稀有度分布：

```
目標分布（參考轉蛋系統機率反推合理配比）：
  N（common）   : ~35-40%
  R（rare）     : ~30-35%
  SR（epic）    : ~18-22%
  SSR（legendary）: ~5-8%
  UR（mythic）  : ~1-3%（手動標記）
```

產出偏差警告：若某 tier 偏離目標 ±10%，標記為 `⚠️ 分布偏斜`。

### Step 8：輸出格式

**單一武將結果**：

```json
{
  "id": "zhang-fei",
  "name": "張飛",
  "computed": {
    "maxStat": 98,
    "avg5": 65.4,
    "axisA": "legendary",
    "axisB": "epic",
    "finalTier": "legendary",
    "suggestedCategory": "famed",
    "ep_base": 72,
    "epRating": "A+"
  },
  "current": {
    "rarityTier": null,
    "characterCategory": null,
    "ep": 91
  },
  "warnings": [
    "兵種適性只有 1 個 S 級，建議 SSR 至少 3 個"
  ],
  "suggestions": {
    "rarityTier": "legendary",
    "characterCategory": "famed",
    "genes_count": "建議 4-5 個基因"
  }
}
```

**全量盤點報告**：

```
=== 稀有度分布報告 ===
  N（common）  : 4 / 10 = 40.0%  ✅ 目標 35-40%
  R（rare）    : 3 / 10 = 30.0%  ✅ 目標 30-35%
  SR（epic）   : 2 / 10 = 20.0%  ✅ 目標 18-22%
  SSR（legendary）: 1 / 10 = 10.0%  ⚠️ 偏高（目標 5-8%）
  UR（mythic） : 0 / 10 = 0.0%   ✅ 目標 1-3%

=== 門檻影響分析 ===
  若 maxStat 門檻從 95 降至 90：SSR 增加 2 位（+20%）
  若 avg5 門檻從 80 降至 75：SSR 增加 1 位（+10%）
```

## Interconnection

- **輸入依賴**：`rarity-thresholds.json`（門檻）、`generals.json`（資料）
- **下游 skill**：完成 tuner 後，用 `general-story-writer` 根據確定的 rarityTier 生成對應風格故事
- **上游 skill**：`general-data-pipeline` 在匯入新武將時會呼叫 tuner 做自動分類

## Notes

- 這個 skill 純粹在 Copilot 對話中執行，不需要外部 API
- 所有「建議」都需要人工確認後再寫入 generals.json
- 門檻值調整後，建議重新跑一次全量 audit 確認分布影響
- 建議每次修改後用 `encoding-touched-guard` skill 檢查 JSON 編碼
