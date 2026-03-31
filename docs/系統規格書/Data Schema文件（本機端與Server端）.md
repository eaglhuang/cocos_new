# Data Schema 文件（事件溯源與 NoSQL 離線同步架構）

> **架構重構警告 (v2026-03-28)**：此文件已從傳統關聯式 SQL 轉型為 **Data-Driven (NoSQL) 與 Event Sourcing (事件溯源)** 架構，完美適配 AI 高產能開發，亦支持「單機離線遊玩、連線對稱驗證」防作弊機制。

---

## 一、本地端存檔根結構 (Root Save Schema)

所有使用者的存檔，無論本機或上傳至雲端，皆以下列單一 Root JSON Document 保存。

```json
{
  "Player_ID": "USER_0945A8",
  "Save_Version": "1.0.0",
  "Last_Sync_Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "Data": {
    "Generals": { ... },
    "Player_Economy": { ... },
    "Game_Time": { ... },
    "Governance": { ... }
    // 其他細部資料往下掛載
  },
  "Action_Records": [
    // 尚未與 Server 同步的離線操作佇列
  ]
}
```

### 重大架構變動：
1. **Save_Version (存檔版號)**：任何 `Data` 內部的欄位增刪（例如增加「敏捷」屬性），都需要提升此版號。當 Client 載入舊版存檔時，需呼叫 `MigrationService` 進行欄位無痛補齊。
2. **Action_Records (操作日誌 / 離線命令佇列)**：所有牽涉數值變動的行為（抽卡、花費金幣、升級）**不可直接修改 Data**。必須先生成一個 Action，由本地系統消化並算出結果後，才將 Action 壓入此陣列中，等候網路連線時上傳。

---

## 二、Data 區域快照結構 (Snapshot)

此處為原本各子系統的快照資料，全以 JSON 儲存，移除所有 Enum 與冗餘的關聯鍵，全面擁抱 AI Vibe Coding 的自由度。

### 1. 武將主結構 (General)
*(原有的嚴格 Enum 移除，改為 String 型別以利動態擴展；欄位名稱以 `武將系統.md` I 區為準)*
```json
{
  "Generals": {
    "G001": {
      "Template_ID": "Zhao_Yun_V1",
      "Bloodline_ID": "BL_ZhaoYun",
      "Phase": "Peak",
      "Status": "Active",
      "Role": "Combat",
      "Stats": {
        "STR": 92, "INT": 68, "LEA": 91, "POL": 45, "CHA": 80, "LUK": 78
      },
      "Vitality": 65.0,
      "Vitality_Max": 100.0,
      "Genes": [
        {"Type": "Blue", "ID": "BLUE_STR_05", "Level": 5, "Is_Locked": false, "Discovery_Level": 1}
      ],
      "Father_ID": "V_PID_ZY01_F",
      "Mother_ID": "V_PID_ZY01_M",
      "Core_Tags": ["長槍", "北境", "騎兵"],
      "Ancestors_JSON": {
        "Generation_1": { "Father": {}, "Mother": {} },
        "Generation_2": { "FF": {}, "FM": {}, "MF": {}, "MM": {} },
        "Generation_3": { "FFF": {}, "FFM": {}, "FMF": {}, "FMM": {}, "MFF": {}, "MFM": {}, "MMF": {}, "MMM": {} }
      }
    }
  }
}
```

> **欄位修正紀錄 (2026-03-30)**：
> - `CHR` → `CHA`，`Stats` 補上 `LEA` (Leadership)，與武將系統 I 區六色屬性一致
> - `Vitality_Current` → `Vitality` + `Vitality_Max`，與武將系統 I 區精力欄位統一
> - 補上 `Father_ID`, `Mother_ID`, `Core_Tags`, `Ancestors_JSON` 完整結構
> - `Ancestors_Generations` 已合併至 `Ancestors_JSON` 內（3 代 14 人由結構本身決定）

### 2. 子系統快照結構匯總

> 以下各子系統的完整 Schema 定義分散於對應規格書的 **I. Data Schema 需求** 章節，此處僅列出掛載位置與主要欄位，作為 Root Document 的導覽。

| 子系統 | `Data.*` 掛載路徑 | 權威定義文件 | 主要欄位 |
|---|---|---|---|
| **培育** | `Data.Nurture_Sessions` | 培育系統.md I 區 | Mentor_ID, Current_Round(1~36), TP_Accumulated, Snapshot_Stats |
| **戰法** | `Data.Generals[UID].Learned_Tactics` | 戰法系統.md I 區 | Tactic_ID, Level, Exp, Source, Available_TP |
| **奧義** | `Data.Generals[UID].Ultimates` | 奧義系統.md I 區 | Slot(1~5), Ult_ID, Level, Is_Inherited, Vitality_Cost_Pct |
| **結緣** | `Data.Bonding_Sessions` | 結緣系統（配種）.md I 區 | Father_UID, Mother_UID, EP_Estimate, Child 結構 |
| **因子** | `Data.Generals[UID].Genes[]` | 因子爆發系統.md I 區 | Type(六色), ID, Level, Is_Locked, Discovery_Level |
| **血統** | `Data.Generals[UID].Ancestors_JSON` | 血統理論系統.md I 區 | 3 代 14 人矩陣、Bloodline_ID |
| **教官** | `Data.Mentor_Pool` | 教官系統（支援卡）.md I 區 | Support_ID, TP_Bonus, Skill_Hints[], Stat_Bonus |
| **兵種虎符** | `Data.Talisman_Inventory` | 兵種（虎符）系統.md I 區 | Quality(UR/SSR/SR/R), Star(1~5), Source_General_UID |
| **戰場適性** | `Data.Generals[UID].Aptitudes` | 戰場適性系統.md I 區 | Troop_Apt(騎/步/弓/機械), Terrain_Apt, Weather_Resist |
| **戰場部署** | `Data.Battle_State` | 戰場部署系統.md I 區 | Food_Cost 表, Cooldown 表, 英靈憑依 |
| **經濟** | `Data.Player_Economy` | 經濟系統.md I 區 | 糧草/黃金/兵力/名聲/精元/結義點 |
| **名士預言** | `Data.Oracle_History` | 名士預言系統.md I 區 | Oracle_Session, Predicted_Type, Accuracy |
| **轉蛋** | `Data.Gacha_State` | 轉蛋系統.md I 區 | Pull_Count, Pity_Counter, Bonding_Points |
| **家族關係** | `Data.Family_Relations` | 家族關係（史實相性）系統.md I 區 | Relation_Type, EP_Bonus, Is_Active |
| **遊戲時間** | `Data.Game_Time` | 遊戲時間系統.md I 區 | Current_Season, Current_Year, Turn_Count |
| **領地治理** | `Data.Governance` | 領地治理系統.md I 區 | Territory 結構, Tax_Rate, Facilities |

> **維護原則**：各子系統的欄位增減以對應規格書的 I 區為準。本表僅維護掛載路徑對照，不重複定義欄位細節。如有欄位命名衝突，以武將系統.md 和本文件為最終裁定。

*(其餘 Player_Economy, Game_Time 維持類似的 JSON 樹狀結構，統一放在 `Data` 節點下)*

---

## 三、離線操作與對稱防弊驗證機制 (HMAC Hash Chain)

為了達成「無網路可玩」但又「不怕玩家開修改器亂改記憶體數字」，我們引入了經典的 **滾動雜湊與簽章核銷 (HMAC Rolling Hash)** 架構。

### 1. 離線操作日誌 (Action_Records)
```json
"Action_Records": [
  {
    "Seq": 1,
    "Timestamp": 1711600000,
    "Action": "BATTLE_WIN",
    "Payload": {"Enemy_ID": "LvBu_Army", "Rewards": {"Gold": 1500}},
    "Tx_Hash": "a1b2c3d4..." // 當下動作的防偽簽章
  },
  {
    "Seq": 2,
    "Timestamp": 1711600500,
    "Action": "GACHA_PULL",
    "Payload": {"Pool": "SSR_2024", "Cost": 1000},
    "Tx_Hash": "e5f6g7h8..."
  }
]
```

### 2. Hash 簽章對稱演算規則
Client 在離線發生上述行為時，會依照以下公式計算 `Tx_Hash`：
$$ \text{New\_Hash} = SHA256 ( \text{Action\_Name} + \text{Payload\_JSON} + \text{Session\_Secret} + \text{Previous\_Hash} ) $$
> `Session_Secret`: 玩家最後一次連線上網時，Server 派發並記錄在雲端與本機的一組一次性金鑰。

### 3. Server 驗證結算流程 (Online Sync)
1. **連線重整**：玩家連上網路。
2. **本機打包**：Client 打包整份 `{ "Player_ID", "Data", "Action_Records" }` 發給雲端。
3. **金鑰準備**：Server 從資料庫拉出該玩家的 `Session_Secret` 與上一次核銷成功的 `Last_Sync_Hash`。
4. **雲端重演 (Event Replay)**：Server 逐一重演 `Action_Records` 內的每筆紀錄：
   * 檢查每一個 `Tx_Hash` 是否符合伺服器算出的雜湊值。
   * **防修改器發威**：如果玩家直接擅改 Client `Data` 的金幣量為 999 萬，但他無法偽裝出具備正確 `Session_Secret` 簽章的「獲得金幣」Action Log，驗證會被立即推翻。
5. **驗證全數通過**：Server 覆蓋資料庫中的 Snapshot JSON，並回傳一組**全新的** `Session_Secret` 供玩家下次離線使用，接著清空本機的 Log 陣列。
6. **驗證失敗**：Server 拒絕同步，強迫 Client 退回 Server 上次成功的存檔進度與金錢狀態。

---

## 四、Server 端資料表設計 (NoSQL / JSON 化)

徹底拋棄原先十幾張龐大且綁手綁腳的關聯式 SQL 資料表，改用極簡的 NoSQL 或具備 JSON 欄位的 MySQL 架構，完全消除 Alter Table 的惡夢。

### 1. `users`（玩家主帳號表）
| 欄位 | 型別 | 說明 |
|---|---|---|
| Player_ID | VARCHAR(32) | PK |
| Account | VARCHAR(64) | 登入帳號/信箱/授權碼 |
| Created_At | DATETIME | 註冊時間 |

### 2. `save_snapshots`（玩家雲端存檔快照表）
| 欄位 | 型別 | 說明 |
|---|---|---|
| Player_ID | VARCHAR(32) | FK(>users) |
| Save_Version | VARCHAR(16) | 存檔版號 (例: 1.0.5) |
| Save_Data_JSON | LONGTEXT | 完整 `Data` 節點的 JSON 字串 |
| Last_Sync_Hash | VARCHAR(64) | 離線上傳驗證用的最近一次雜湊值 |
| Session_Secret | VARCHAR(64) | 用於驗證下次上傳 Action Log 的伺服器隱藏金鑰 |
| Updated_At | DATETIME | 最後同步時間 |

### 3. 設定配置表 (Config Tables / Static Data)
原本在資料庫裡的 `gene_dictionary`, `templates`, `sages` 等純**靜態讀取資料**，不再寫入關聯式資料庫（避免讀寫瓶頸造成卡頓）。
統一改由遊戲伺服器或 CI/CD 流程發布成靜態的 `.json` 檔案丟上 CDN。Client 登入時只核對 MD5 或版號，直接抓取到本機做 Dictionary 快取映射。
