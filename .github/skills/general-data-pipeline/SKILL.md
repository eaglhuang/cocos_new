---
name: general-data-pipeline
description: '武將資料管線 SKILL — 整合「公開資料爬取 → 欄位映射 → 合併去重 → 自動分類 → 品質驗證 → 匯出入庫」的端到端流程。USE FOR: 批次新增武將、從光榮三國志 Wiki 匯入參考數值、建立 master 資料集。DO NOT USE FOR: 故事文案生成（用 general-story-writer）、細部數值微調（用 general-balance-tuner）。'
argument-hint: '指定操作階段（scrape / map / merge / classify / validate / export / full）、目標武將範圍（faction / name list / all）、以及資料來源（wiki / koei / manual）。'
---

# General Data Pipeline

用這個 skill 執行武將資料的完整收集與入庫管線，從公開資料來源到結構化 JSON。

Unity 對照：類似 AssetPostprocessor 的自動匯入管線，但對象是遊戲設計資料而非美術素材。

## When to Use

- 需要批次新增數十到數百位武將的基礎資料
- 需要從光榮三國志系列 Wiki 抓取屬性參考值
- 需要將外部資料源映射為 GeneralConfig 格式
- 需要對新匯入的武將自動執行稀有度分類 + 品質驗證
- 需要建立分層的 master 資料集（base / lore / stories）

## Do Not Use

- 不要用這個 skill 生成不存在於公開資料的虛構內容（用 `general-story-writer`）
- 不要用這個 skill 做精細的單一武將數值微調（用 `general-balance-tuner`）
- 不要用這個 skill 直接覆蓋正式的 `generals.json`（匯出前必須人工確認）

## Procedure

### Phase A：資料收集（Scrape）

#### A1. 資料來源

| 來源 | URL 範例 | 取得內容 |
|---|---|---|
| 維基百科三國志人物列表 | `zh.wikipedia.org/wiki/三國志人物列表` | 姓名、字、籍貫、所屬勢力、生卒年、官職 |
| 光榮三國志 Wiki | `koei.fandom.com/wiki/` | 五維數值（武力/智力/統率/政治/魅力）、技能、兵種適性 |
| 手動輸入 | N/A | 自創武將、神話人物、特殊版本 |

#### A2. 欄位映射表

**維基百科 → GeneralConfig**：

| Wiki 欄位 | GeneralConfig 欄位 | 轉換規則 |
|---|---|---|
| 姓名 | `name` | 直接映射 |
| 字 | `title` | 前綴「字」去除 |
| 所屬 | `faction` | 映射：蜀漢→Shu, 曹魏→Wei, 東吳→Wu, 其他→Qun |
| 籍貫 | `storyStripCells[0].text`（origin slot） | 簡化為地名 |
| 官職 | `role` | 映射為戰場定位 |

**光榮三國志 → GeneralConfig**：

| 光榮欄位 | GeneralConfig 欄位 | 轉換規則 |
|---|---|---|
| 武力 | `str` | 直接映射（0-100） |
| 智力 | `int` | 直接映射（0-100） |
| 統率 | `lea` | 直接映射（0-100） |
| 政治 | `pol` | 直接映射（0-100） |
| 魅力 | `cha` | 直接映射（0-100） |
| 運 | `luk` | 直接映射（若有） |
| 特技 | `learnedTactics[]` | 映射為技能 ID |
| 適性（騎/步/弓/水） | `troopAptitude` | 映射為 S/A/B/C 等級 |

### Phase B：合併去重（Merge）

#### B1. 合併規則

1. 以 `name` + `faction` 為 unique key
2. 若同一武將在多個來源出現，取光榮數值為主、維基背景為輔
3. 產出 master 資料前標記來源：`source: "wiki+koei"` / `source: "manual"`

#### B2. ID 生成規則

```
id = kebab-case(name-pinyin)
例：趙雲 → zhao-yun
例：諸葛亮 → zhuge-liang
例：神趙雲 → shen-zhao-yun
```

`templateId` 生成規則：

```
templateId = "GEN_{FACTION}_{NAME_UPPER}"
例：趙雲 → GEN_SHU_ZHAO_YUN
例：曹操 → GEN_WEI_CAO_CAO
```

### Phase C：自動分類（Classify）

呼叫 `general-balance-tuner` skill 的邏輯：

1. 對每位新武將執行雙軸稀有度計算
2. 根據五維數值自動建議 `characterCategory`
3. 計算 EP_base 與 epRating
4. 產出分類報告

### Phase D：品質驗證（Validate）

#### D1. 必填欄位檢查

```
必填：id, name, faction, hp, str, int, lea
建議：pol, cha, luk, role, title, characterCategory
```

#### D2. 數值範圍驗證

| 欄位 | 有效範圍 |
|---|---|
| str, int, lea, pol, cha, luk | 0-100（一般）/ 0-120（神話） |
| hp | 80-300 |
| ep | 0-100 |
| maxSp | 50-200 |

#### D3. 一致性檢查

- `rarityTier` 與雙軸計算結果是否一致
- `characterCategory` 與 `rarityTier` 搭配是否合理
- 同陣營武將的數值分布是否過於集中
- 是否有重複 ID 或重複 name+faction

#### D4. 驗證報告格式

```
=== 品質驗證報告 ===
檢查武將數：50
通過：45
警告：3
  ⚠️ 文聘 (wen-pin): pol 欄位缺失
  ⚠️ 蔣欽 (jiang-qin): 兵種適性全為 B，建議至少 1 個 A
  ⚠️ 左慈 (zuo-ci): characterCategory=civilian 但 int=95（建議改為 famed）
錯誤：2
  ❌ 無名氏 (unknown-1): 缺少必填欄位 faction
  ❌ 重複 ID: zhao-yun 出現 2 次
```

### Phase E：匯出入庫（Export）

#### E1. 分層匯出

```
assets/resources/data/
  generals.json            ← 正式入庫（需人工確認）
  master/
    generals-base.json     ← 基礎屬性（批次匯入中間產物）
    generals-lore.json     ← 歷史背景（延遲載入資料）
    generals-stories.json  ← 故事條模板
```

#### E2. 匯出前 checklist

- [ ] 品質驗證零 error
- [ ] 稀有度分布在目標範圍內
- [ ] 人工審核 SSR/UR 級武將的數值
- [ ] encoding 檢查通過（`encoding-touched-guard` skill）

## Batch Workflow Example

完整的 50 位武將匯入流程：

```
1. [Scrape] 準備 wiki 資料 + 光榮數值
   → 產出 raw-generals-batch-1.json

2. [Map] 對照欄位映射表轉換格式
   → 產出 mapped-generals-batch-1.json

3. [Merge] 合併雙來源、去重、生成 ID
   → 產出 merged-generals-batch-1.json

4. [Classify] 呼叫 general-balance-tuner 跑雙軸分類
   → 產出 classified-generals-batch-1.json

5. [Validate] 品質驗證
   → 產出 validation-report-batch-1.txt

6. [Review] 人工審核 SSR/UR 武將 + 修正 warning
   → 確認 classified-generals-batch-1.json

7. [Export] 併入 generals.json
   → 更新正式資料 + encoding 檢查
```

## Interconnection

- **下游 skill**：
  - `general-balance-tuner` — Phase C 自動分類時呼叫
  - `general-story-writer` — 入庫後為缺少故事的武將批次生成內容
  - `encoding-touched-guard` — 每次匯出後檢查編碼

- **設定檔依賴**：
  - `assets/resources/data/rarity-thresholds.json` — 稀有度門檻
  - `assets/scripts/core/models/GeneralUnit.ts` — GeneralConfig 型別定義

## Notes

- 這個 skill 純粹在 Copilot 對話中執行，不需要外部 API
- Wiki 資料的取得建議由使用者手動複製貼上（避免自動爬蟲的法律風險）
- 光榮數值僅作為「參考基準」，最終數值可由設計師調整
- 所有匯出都需要人工確認，skill 不會自動覆蓋正式 generals.json
- 中間產物建議放在 `artifacts/data-pipeline/` 目錄
