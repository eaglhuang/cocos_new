<!-- doc_id: doc_spec_0176 -->
# NPC 人性化規格書

> **來源文件**：NPC 行為決策系統優化.md (doc_spec_0168)、NPC 遞增演化架構設計.md (doc_spec_0169)、推薦使用 ChromaDB（地端極輕量向量庫）+ llama.cpp（支援超低顯存運行）.md (doc_spec_0170)、智慧 NPC 技術架構與風險.md (doc_spec_0171)、想問以目前地端AI 的開源模型 是否可以達到做一個有自己思維判斷的, 遊戲中NPC 行為決策模式呢....md (doc_spec_0172)
> **對應母規格**：武將日誌與離線互動系統.md (doc_spec_0015)、武將系統.md (doc_spec_0016)、家族關係（史實相性）系統.md (doc_spec_0026)、Data Schema文件（本機端與Server端）.md (doc_tech_0014)
> **中台依賴**：三國大腦中台規格書.md (doc_spec_0177)

---

## A. 系統描述

NPC 人性化系統負責把武將從「可操作資料卡」提升為「會被玩家記得的人」。本系統不宣稱 NPC 具備真正自我意識，而是用可驗證的資料、可控的性格錨點、日誌記憶與有限生成，讓武將在人物頁、大廳晨報、離線互動與對話台詞中呈現穩定的人格感。

核心原則如下：

1. **Utility AI 做骨架**：武將是否主動請纓、安慰玩家、頂撞玩家、推薦派遣或回憶戰事，由公式、狀態機與事件權重決定。
2. **RAG / 模板做記憶**：歷史、演義、人際關係、玩家互動與日誌摘要先被轉為可查詢資料，不由模型臨場亂編。
3. **LLM 做語言皮膚**：需要自然語氣時，才由三國大腦中台或本地小模型改寫成符合角色的台詞。
4. **性格錨點不可漂移**：每位武將保留不可覆蓋的核心性格、關係與底線；玩家記憶只能微調語氣，不能改寫史實人格。
5. **離線可用、連網增強**：MVP 以本地模板與日誌摘要成立；連網後可透過三國大腦中台取得更豐富的歷史 RAG 與生成式台詞。

Unity 對照：本系統相當於 `Character Memory + Utility AI + Dialogue Persona Profile + Quest Log Read Model`。Cocos 實作上應以資料驅動服務與 UI contract 串接，不把人格判斷寫死在單一 Component。

---

## B. 系統目的

| 目的 | 說明 |
|---|---|
| 角色存在感 | 讓武將在登入、人物頁、派遣與戰後摘要中持續表現自己的性格 |
| 關係可感知 | 讓玩家能感覺到義兄弟、宿敵、主從、師徒、血脈關係會影響話語與行動 |
| 離線生活感 | 與 `武將日誌與離線互動系統` 共用資料，使離線事件不只是獎勵結算 |
| 生成可控 | 任何生成式台詞都必須能回扣 persona card、檢索片段或日誌來源 |
| 跨平台降級 | Web / iOS / Android / PC 均能在無模型推論時回退到模板模式 |

---

## C. 商業套路

| 商業點 | 說明 |
|---|---|
| 名將情感保值 | 高稀有武將不只數值強，也有更完整的性格錨點、關係台詞與專屬回憶 |
| 日誌回訪 | 玩家每天登入可看到武將對昨夜事件的個性化反應 |
| 事件驚喜 | 特定武將、關係、地點與歷史事件組合可觸發特殊語音 / 文本 |
| 教官與傳承黏著 | 退役名將可留下口吻、教誨與家族記憶，支撐長線收集 |
| 活動擴充 | 節慶、賽季、挑戰賽可追加限時 persona prompt 或特殊事件 key |

---

## D. 系統 TA

| 玩家類型 | 使用情境 |
|---|---|
| 劇情玩家 | 在人物頁點頭像，聽張飛回憶長坂橋或桃園結義 |
| 養成玩家 | 透過日誌看見武將對培育、派遣、戰績的反應 |
| 策略玩家 | 從武將語氣與建議中得到派遣、戰場適性、關係提示 |
| 長線玩家 | 追蹤某位武將跨季、跨世家、跨死亡/英靈狀態的記憶延續 |

---

## E. 製作功能清單

| # | 功能 | 優先級 | 說明 |
|---|---|---|---|
| 1 | Persona Card | P0 | 每位武將的性格、口吻、人際關係、禁忌與核心台詞 |
| 2 | Context Option | P0 | 下拉情境 key，例如長坂橋、桃園結義、華容道、單騎救主 |
| 3 | Journal Reaction | P0 | 對武將日誌、晨報與派遣結果生成一句短反應 |
| 4 | Offline Template Engine | P0 | 無中台時以模板與 slot 組合輸出台詞 |
| 5 | RAG Dialogue Hook | P1 | 連接三國大腦中台，依歷史與玩家記憶生成台詞 |
| 6 | Unknown Event Capture | P1 | 本地未命中情境記錄，連網時送中台生成新模板候選 |
| 7 | Personality Drift Guard | P0 | 防止玩家記憶或模型生成讓角色口吻崩壞 |
| 8 | Golden Line Set | P1 | 每位核心武將保留不可覆蓋的錨點台詞與驗收樣本 |

---

## F. 行為與語言公式

### F-1. 行為選擇：Utility AI

```typescript
function scoreNpcAction(context: NpcActionContext, profile: NpcPersonaCard): number {
    return context.eventWeight
        * profile.personalityWeights[context.actionType]
        * context.relationshipModifier
        * context.moodModifier
        * context.cooldownModifier;
}
```

1. Utility AI 只決定「要做什麼」與「用什麼情緒說」，不直接產生長文本。
2. 行為候選必須來自正式事件、日誌、派遣、戰鬥快照或中台回傳的 context option。
3. 同一武將在同一登入窗內只允許 1 則高權重主動互動，避免洗版。

### F-2. 對話生成模式

| 模式 | 使用時機 | 資料來源 | 輸出方式 |
|---|---|---|---|
| `STATIC_TEMPLATE` | MVP / 離線 / 低階設備 | 本地模板、persona card | slot filling |
| `RAG_REWRITE` | 連網、玩家主動點擊 | 中台檢索片段 + persona card | LLM 改寫短句 |
| `JOURNAL_REACTION` | 晨報 / 人物日誌 | `General_Journal` entry | 模板或 LLM 短評 |
| `FALLBACK_LINE` | 錯誤 / 未命中 / 安全攔截 | persona card safeFallbackLine | 固定句 |

### F-3. 性格漂移限制

```typescript
function canAcceptGeneratedLine(line: GeneratedLine, persona: NpcPersonaCard): boolean {
    return line.length <= persona.maxLineChars
        && !line.flags.includes('MODERN_SLANG')
        && !line.flags.includes('UNSUPPORTED_HISTORY_CLAIM')
        && persona.requiredToneTags.every(tag => line.toneTags.includes(tag));
}
```

1. 玩家記憶可以影響稱呼、親疏與回憶頻率，不得改寫陣營、史實關係或核心道德底線。
2. 20% 核心錨點台詞不得被中台覆蓋，只能作為 style anchor 參考。
3. LLM 輸出若無法通過檢查，必須回退 `FALLBACK_LINE`。

---

## G. 劇本相關

| 情境 | 劇本需求 |
|---|---|
| 點武將頭像 | 武將依所選 context option 說一句 20~60 字短句 |
| 晨報摘要 | 武將對昨夜派遣、戰事或玩家資源狀態給出個性化評論 |
| 派遣完成 | 武將依成果品質與性格表達得意、惋惜、請罪或建議 |
| 關係互動 | 義兄弟、宿敵、主從、師徒關係應影響稱呼與語氣 |
| 歷史事件 | 台詞要能回扣演義/正史來源，不得無來源創造重大戰功 |

張飛範例：

```json
{
  "generalId": "zhang-fei",
  "contextKey": "changban-bridge",
  "toneTags": ["bold", "loyal", "thunderous"],
  "line": "長坂橋頭那聲喝，俺不是為逞勇，是要替大哥斷開曹軍的膽。"
}
```

---

## H. 字串內容相關

| Key | 預設值 |
|---|---|
| UI_NPC_DIALOGUE_TITLE | 「武將心聲」 |
| UI_NPC_CONTEXT_SELECT | 「情境」 |
| UI_NPC_SPEAK_BUTTON | 「聽他說」 |
| UI_NPC_LOADING | 「正在回想往事...」 |
| UI_NPC_FALLBACK | 「此事容我再想想。」 |
| UI_NPC_OFFLINE_MODE | 「離線模板」 |
| UI_NPC_SOURCE_HINT | 「依據：{SourceTitle}」 |

---

## I. Data Schema 需求

### I-1. Persona Card

```json
{
  "Npc_Persona_Cards": {
    "zhang-fei": {
      "General_ID": "zhang-fei",
      "Display_Name": "張飛",
      "Core_Traits": ["豪烈", "忠義", "急躁", "護主"],
      "Voice_Style": "短句、直白、帶燕地粗豪感，不使用現代流行語",
      "Required_Tone_Tags": ["bold", "loyal"],
      "Forbidden_Claims": ["自稱知道玩家未經記錄的私事", "改寫桃園結義關係"],
      "Relationship_Anchors": [
        { "Target_General_ID": "liu-bei", "Relation": "義兄", "Tone": "敬重" },
        { "Target_General_ID": "guan-yu", "Relation": "義兄", "Tone": "親近" }
      ],
      "Safe_Fallback_Line": "此事俺記下了，待有眉目再與你分說。",
      "Golden_Lines": ["燕人張翼德在此！"]
    }
  }
}
```

### I-2. 本地 NPC Memory Read Model

本地端仍以 `Data.NPC_Memory` 保留離線快取、最近互動與模板槽位。若連網中台可用，`Data.NPC_Memory` 只保存必要摘要，不複製中台完整向量庫。

```json
{
  "NPC_Memory": {
    "SQLite_Vec_DB_Path": "save/npc_memory.db",
    "Persona_Card_Version": "npc-persona-v1",
    "Recent_Context": [
      {
        "General_ID": "zhang-fei",
        "Context_Key": "changban-bridge",
        "Last_Line_ID": "npc_line_0001",
        "Last_Used_At": "2026-04-28T08:00:00"
      }
    ],
    "Pending_Unknown_Events": []
  }
}
```

---

## J. 名詞定義

| 名詞 | 代碼 / Key | 定義 |
|---|---|---|
| Persona Card | `Npc_Persona_Card` | 武將性格、口吻、關係與安全底線的結構化資料 |
| Context Option | `Context_Key` | 玩家可選的情境關鍵字，如長坂橋、桃園結義 |
| Golden Line | `Golden_Line` | 不可覆蓋的核心錨點台詞 |
| Personality Drift | `PERSONALITY_DRIFT` | 生成內容偏離角色核心人格或世界觀 |
| Unknown Event | `Unknown_Event` | 本地模板與向量檢索都無法命中的互動情境 |
| Journal Reaction | `Journal_Reaction` | 武將針對日誌、晨報或派遣結果的一句反應 |

---

## K. 與三國大腦中台的分工

| 層級 | 權責 | 是否必須連網 |
|---|---|---|
| NPC 人性化系統 | 決定角色個性、互動規則、UI 掛點與本地降級 | 否 |
| 武將日誌與離線互動 | 產生日誌、晨報、派遣、離線快照 | 否 |
| 三國大腦中台 | PDF/MD 知識抽取、向量檢索、RAG 台詞生成、模板補丁 | 是 |
| Data Schema | 保存本地快取、同步摘要與 read model | 否 |

本規格要求：所有中台生成結果都必須回寫為「可驗證摘要」或「可丟棄快取」，不得讓 Cocos 前端把不可追溯的生成文字當成唯一真相。
