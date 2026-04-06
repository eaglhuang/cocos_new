---
name: general-story-writer
description: '武將故事批次生成 SKILL — 根據武將的 GeneralConfig（含 characterCategory + rarityTier），生成 historicalAnecdote、bloodlineRumor、六格 storyStripCells 故事條。USE FOR: 填充 generals.json 中的 "???" 欄位、批次生成武將背景故事、統一故事風格。DO NOT USE FOR: 數值平衡調整（用 general-balance-tuner）、資料爬取（用 general-data-pipeline）。'
argument-hint: '指定目標武將 ID 或名稱，以及需要生成的欄位（story / anecdote / rumor / all）。可指定批次模式一次處理多位武將。'
---

# General Story Writer

用這個 skill 為武將批次生成故事內容，包含歷史趣聞、血脈傳聞、六格故事條。

Unity 對照：類似 ScriptableObject 的批次填充 Editor Script，但改用 Copilot 本機對話執行，零 API 成本。

## When to Use

- generals.json 中有武將的 `historicalAnecdote`、`bloodlineRumor`、`storyStripCells` 為 `"???"` 或空值
- 新增武將需要完整的背景故事
- 需要統一多位武將的故事風格（如同一陣營的文風一致性）
- 需要根據稀有度調整故事語氣與深度

## Do Not Use

- 不要用這個 skill 修改武將的數值屬性（用 `general-balance-tuner`）
- 不要用這個 skill 做資料爬取或匯入（用 `general-data-pipeline`）
- 不要直接覆蓋已經人工審核通過的故事內容

## Procedure

### Step 1：讀取目標武將資料

讀取 `assets/resources/data/generals.json`，定位目標武將的 GeneralConfig。
確認以下欄位可用（故事生成的必要輸入）：

| 欄位 | 用途 | 必要性 |
|---|---|---|
| `name` | 武將姓名 | 必要 |
| `faction` | 陣營（蜀漢/魏/吳/群雄） | 必要 |
| `characterCategory` | 角色分類（civilian/general/famed/mythical/titled） | 建議 |
| `rarityTier` 或五維屬性 | 稀有度（影響故事深度） | 建議 |
| `title` | 稱號（如「萬人敵」「臥龍」） | 可選 |
| `role` | 戰場定位 | 可選 |
| `bloodlineId` | 血脈 ID | 可選 |
| `genes` | 基因配置 | 可選 |

### Step 2：確定故事風格

根據 `characterCategory` + `rarityTier` 選擇對應風格：

| 稀有度 | 分類 | 風格指引 |
|---|---|---|
| N（common） | civilian | 平凡日常、鄰里瑣事、市井傳聞。語氣質樸親切。 |
| R（rare） | general | 軍旅生涯、小規模戰役、同袍義氣。語氣硬朗務實。 |
| SR（epic） | general/famed | 關鍵戰役軼事、謀略交鋒、將帥風範。語氣沉穩大氣。 |
| SSR（legendary） | famed | 改變歷史走向的傳奇事蹟、命運轉折、英雄氣概。語氣磅礡壯闊。 |
| UR（mythic） | mythical | 超自然傳說、神蹟顯現、天命昭示。語氣神秘威嚴。 |

### Step 3：生成 historicalAnecdote（歷史趣聞）

**格式要求**：
- 1-2 段，總計 50-120 字（繁體中文）
- 必須有具體的歷史場景（時間、地點、人物互動）
- 不可重複已知正史主線劇情，應取「正史邊角」或「演義未收」的趣聞
- 結尾留懸念或反轉感

**生成 prompt 模板**：
```
請為三國時代的【{name}】（{faction}，{title}）撰寫一段歷史趣聞。
角色定位：{characterCategory}，稀有度等級：{rarityTier}。
風格要求：{style_guide}
字數：50-120 字繁體中文。
要求：具體歷史場景、不重複正史主線、結尾留懸念。
```

### Step 4：生成 bloodlineRumor（血脈傳聞）

**格式要求**：
- 1 段，30-80 字
- 暗示其血脈來源或後代影響
- 語氣偏神秘、引人探索
- 與 `bloodlineId` 和 `genes` 呼應（若有）

**生成 prompt 模板**：
```
請為【{name}】撰寫一段血脈傳聞。
基因特徵：{genes_summary}
血脈 ID：{bloodlineId}
風格要求：神秘、暗示性、引人探索。30-80 字繁體中文。
```

### Step 5：生成 storyStripCells（六格故事條）

六格故事條的 slot 定義：

| Slot | 語意 | 內容指引 |
|---|---|---|
| `origin` | 出身 | 出生地、家世背景、童年軼事 |
| `faction` | 投效 | 如何加入當前陣營、關鍵抉擇 |
| `role` | 定位 | 在軍中的角色、擅長的戰術 |
| `awakening` | 覺醒 | 能力覺醒的契機、轉折事件 |
| `bloodline` | 血脈 | 祖先淵源、血脈特質的顯現 |
| `future` | 未來 | 命運走向的暗示、未解之謎 |

**每格限制**：8-15 字繁體中文，語句精煉如碑文。

### Step 6：輸出與驗證

輸出格式為 JSON 片段，可直接貼入 generals.json：

```json
{
  "historicalAnecdote": "...",
  "bloodlineRumor": "...",
  "storyStripCells": [
    { "slot": "origin", "text": "..." },
    { "slot": "faction", "text": "..." },
    { "slot": "role", "text": "..." },
    { "slot": "awakening", "text": "..." },
    { "slot": "bloodline", "text": "..." },
    { "slot": "future", "text": "..." }
  ]
}
```

**驗證清單**：
- [ ] historicalAnecdote 字數 50-120
- [ ] bloodlineRumor 字數 30-80
- [ ] storyStripCells 共 6 格，slot 齊全
- [ ] 每格 text 字數 8-15
- [ ] 繁體中文（非簡體）
- [ ] 無重複正史主線劇情
- [ ] 風格與稀有度等級吻合

### Step 7：批次模式（可選）

若要一次處理多位武將：

1. 讀取 generals.json 全部武將
2. 篩選出 `historicalAnecdote === "???"` 或 `storyStripCells === "???"` 的武將
3. 依 faction 分組，確保同陣營文風一致
4. 逐一執行 Step 3-6
5. 輸出完整的替換 JSON，一次性更新

## Style Guide Reference

### 蜀漢風格
- 基調：仁義、義氣、正統、悲壯
- 用字偏好：「義」「信」「恩」「誓」「昭烈」

### 魏風格
- 基調：權謀、效率、實用、霸氣
- 用字偏好：「勢」「略」「令」「破」「天下」

### 吳風格
- 基調：穩健、江東、水師、家業傳承
- 用字偏好：「守」「江」「計」「承」「基業」

### 群雄風格
- 基調：自由、不羈、亂世求存、驚才絕艷
- 用字偏好：「狂」「絕」「獨」「破」「天命」

## Outputs

- 每位武將輸出一個 JSON 片段（historicalAnecdote + bloodlineRumor + storyStripCells）
- 批次模式輸出完整替換清單
- 驗證報告（字數統計 + 風格吻合度自評）

## Notes

- 這個 skill 純粹在 Copilot 對話中執行，不需要外部 API
- 故事內容需要人工最終審核後才正式入庫
- 建議每次生成後用 `encoding-touched-guard` skill 檢查 JSON 編碼
- 與 `general-balance-tuner` 配合：先用 tuner 確定 rarityTier，再用 story-writer 生成對應風格的故事
