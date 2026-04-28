<!-- doc_id: doc_tech_0013 -->

> **2026-04-26 覆寫裁定：無武將 Level / EXP 的兵源資料模型**
>
> 1. `Data.Generals[*]` 不新增武將 `Level / Exp / Breakthrough_Level` 作為本體成長欄位。
> 2. 若需畢業後戰場成長，新增或投影 `General_Fame`、`General_Rank`、`Command_Capacity`；此處 `Command_Capacity` 定義為武將本場可帶出的兵力上限，不回寫 `Prowess_Stats`。
> 3. `Data.Governance` 或 `Data.Player_Economy` 需支援 `Population`、`Public_Morale`、`City_Troops_Current`、`City_Troops_Cap`、`Recruit_Regen_Per_Turn`、`Food_Output_Bonus_From_Population`。
> 4. `Data.Battle_State` 需支援 `Sortie_Troop_Pool_Max`、`Sortie_Troop_Pool_Current`、`Field_Unit_Count`、`Field_Unit_Limit`、`Food_Current`、`Food_Max`、`Battle_Troop_Loss_Estimate`。
> 5. `Data.Battle_Unit_State` 需支援 `Unit_Troop_Cost`、`Current_Troops`、`Returned_Troops`、`Lost_Troops`、`Food_Cost`。`Military_Readiness` 若保留，只能作為舊欄位相容或後台摘要，不作為玩家主顯示資源。
> 6. `Equipped_Spirit_UID` 的 UI 入口改由人物頁 `Bloodline / 命` 讀取；`Equip / 寶` 只讀一般裝備與 `Equipped_Tally_UID`。
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
    "Governance": { ... },
    "Lobby_Hub": { ... },
    "General_Journal": { ... },
    "Tournament_Data": { ... },
    "Rival_Nations": { ... },
    "Officer_System": { ... }
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
*(原有的嚴格 Enum 移除，改為 String 型別以利動態擴展；欄位名稱以 `武將系統.md` (doc_spec_0016) I 區為準)*
```json
{
  "Generals": {
    "G001": {
      "Template_ID": "Zhao_Yun_V1",
      "Bloodline_ID": "BL_ZhaoYun",
      "Phase": "Peak",
      "Status": "Active",
      "Role": "Combat",
      "Has_Retired_Before": false,
      "Female_Role_Type": "COMBAT",
      "Stats": {
        "STR": 92, "INT": 68, "LEA": 91, "POL": 45, "CHA": 80, "LUK": 78
      },
      "Talent_Stats": {
        "STR": { "Base": 92, "Current": 95, "Max_Potential": 105, "Revelation_Level": "EXACT" },
        "INT": { "Base": 68, "Current": 70, "Max_Potential": 88, "Revelation_Level": "RANGE" },
        "LEA": { "Base": 91, "Current": 93, "Max_Potential": 101, "Revelation_Level": "EXACT" },
        "POL": { "Base": 45, "Current": 45, "Max_Potential": 72, "Revelation_Level": "TENDENCY" },
        "CHA": { "Base": 80, "Current": 82, "Max_Potential": 92, "Revelation_Level": "EXACT" },
        "LUK": { "Base": 78, "Current": 78, "Max_Potential": 90, "Revelation_Level": "HIDDEN" }
      },
      "Prowess_Stats": {
        "STR": 1582,
        "INT": 1018,
        "LEA": 1460,
        "POL": 688,
        "CHA": 1215,
        "LUK": 760,
        "Overall_Rank": "SS",
        "Source_Session_ID": "NS_0007"
      },
      "Personality": {
        "Type": "Loyal",
        "Description": "重情重義，人脈廣布"
      },
      "Loyalty": {
        "Value": 100,
        "Is_Locked": true,
        "Source_Type": "Gacha"
      },
      "Recent_Log": {
        "Timestamp": "2026-04-14 05:00",
        "Narrative": "昨晚：在酒後與張遼切磋，助其武力提升了 1 點。",
        "Impact": "STAT_BOOST"
      },
      "Current_Suitability": {
        "Task_ID": "M_001",
        "Task_Name": "夜襲曹營",
        "Reason": "具有「夜戰」因子且武力卓越"
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
      },
      "Profile_Presentation": {
        "Default_Tab": "Overview",
        "Crest_State": "revealed",
        "Story_Strip_Cells": {
          "origin": "常山出身",
          "faction": "蜀軍白馬前鋒",
          "role": "突擊 / 救援",
          "awakening": "白龍命紋逐步顯現",
          "bloodline": "家族血脈與守護傾向相連",
          "future": "可往全能統軍核心培養"
        }
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
> - 補上 `Talent_Stats`, `Prowess_Stats`, `Profile_Presentation`，作為人物頁 / 培育頁共用的雙層數值與呈現契約

### 2. 子系統快照結構匯總

> 以下各子系統的完整 Schema 定義分散於對應規格書的 **I. Data Schema 需求** 章節，此處僅列出掛載位置與主要欄位，作為 Root Document 的導覽。

| 子系統 | `Data.*` 掛載路徑 | 權威定義文件 | 主要欄位 |
|---|---|---|---|
| **培育** | `Data.Nurture_Sessions` | 培育系統.md (doc_spec_0026) I 區 | Mentor_ID, Current_Round(1~36), TP_Accumulated, Snapshot_Stats, Phase_Block, Graduation_Tags |
| **戰法** | `Data.Generals[UID].Learned_Tactics` | 戰法系統.md (doc_spec_0038) I 區 | Tactic_ID, Level, Exp, Source (INC_COMMIT/SCROLL/AWAKEN/GACHA/BLOOD/BATTLE_LOOT), Available_TP |
| **奧義** | `Data.Generals[UID].Ultimates` | 奧義系統.md (doc_spec_0030) I 區 | Slot(1~5), Ult_ID, Level, Is_Inherited, Vitality_Cost_Pct |
| **結緣** | `Data.Bonding_Sessions` | 結緣系統（配種）.md (doc_spec_0028) I 區 | Father_UID, Mother_UID, Breeding_Mode, EP_Estimate, Child 結構 |
| **因子** | `Data.Generals[UID].Genes[]` | 因子爆發系統.md (doc_spec_0010) I 區 | Type(六色), ID, Level, Is_Locked, Discovery_Level |
| **血統** | `Data.Generals[UID].Ancestors_JSON` | 血統理論系統.md (doc_spec_0011) I 區 | 3 代 14 人矩陣、Bloodline_ID |
| **人物頁呈現** | `Data.Generals[UID].Profile_Presentation` | 武將人物介面規格書.md (doc_ui_0012) | Default_Tab, Crest_State, Story_Strip_Cells |
| **教官** | `Data.Mentor_Pool` | 教官系統（支援卡）.md (doc_spec_0027) I 區 | Support_ID, TP_Bonus, Skill_Hints[], Stat_Bonus, Current_Star, Role_Boundary |
| **統一物件庫** | `Data.Inventory_Service` | 武將裝備道具系統.md (doc_spec_0174) | Inventory_ID, Item_Type, Slot_Type, Bound_General_UID, Quantity, Quality, Source_Type, Display_Bucket, Is_Displayed |
| **兵種虎符** | `Data.Talisman_Inventory` | 兵種（虎符）系統.md (doc_spec_0012) I 區 / `Data.Inventory_Service` projection | Tally_ID, TigerTallyScore, Star, Source_Type, Source_General_UID, Equipped_General_UID, Linked_Troop_ID, Is_Displayed |
| **英靈卡投影** | `Data.Spirit_Card_Collection` | 英靈世家系統.md (doc_spec_0022) / `Data.Inventory_Service` projection | Spirit_ID, General_Template_ID, Spirit_Family_Key, LineageScore, Resonance_Band, Glow_State, Card_Role, Family_Primary_Flag, Equipped_General_UID, Slot_Type, Display_Bucket, Death_Snapshot |
| **英靈死亡快照** | `Data.Spirit_Archive_Snapshot` | 英靈世家系統.md (doc_spec_0022) / family display row projection | Spirit_ID, Death_Season, Heroic_Deeds_Summary, Final_Stats_Snapshot, Final_Skills_Snapshot, Final_Equipment_Snapshot, Battle_Record_Ref, Legacy_Quote, Display_Weight |
| **家族供養池** | `Data.Spirit_Family_State` | 英靈世家系統.md (doc_spec_0022) / family-level read model | Spirit_Family_Key, Family_Contribution_Pool, Family_Fame, Family_Depth, Active_Main_Spirit_UID, Main_Spirit_LineageScore, Contribution_Mode, Featured_Archive_Spirit_UIDs |
| **戰場適性** | `Data.Generals[UID].Aptitudes` | 戰場適性系統.md (doc_spec_0041) I 區 | Troop_Apt(騎/步/弓/機械), Terrain_Apt, Weather_Aptitude |
| **出征編制** | `Data.Sortie_Loadout` | 戰場部署系統.md (doc_spec_0040) I 區 | Commander_UID, Strategist_UID（參謀官）, Deputy_UID（後勤官）, Strategist_Max_Tactic_Bonus, Strategist_Start_Tactic_Bonus, Deputy_Food_Cap_Bonus |
| **戰場部署** | `Data.Battle_State` | 戰場部署系統.md (doc_spec_0040) I 區 | Current_Food, Max_Food, Current_Tactic_Points, Max_Tactic_Points, Elite_Deploy_Cap, Active_Elite_Count, Reserved_Tally_Bands, Strategist_UID（參謀官）, Deputy_UID（後勤官）, Delegate_AI_Active, Deploy_Result_Code |
| **場景戰法** | `Data.Scene_Gambit_State` | 戰法場景規格書.md (doc_spec_0039) K 區 | Required_Intel_Value, Tile_Preset_ID, Strategist_Energy |
| **關卡設計** | `Data.Stage_Chain_Progress` | 關卡設計系統.md (doc_spec_0044) I 區 | Stage_ID, Chain_ID, Intel_Summary, Recommended_Loadout_Gap, Stage_Salvage |
| **經濟** | `Data.Player_Economy` | 經濟系統.md (doc_spec_0032) I 區 | 糧草/黃金/城市兵源/名聲/精元/結義點 |
| **名將挑戰賽** | `Data.Tournament_Data` | 名將挑戰賽系統.md (doc_spec_0007) I 區 | Current_Season, Player_Tournament, Season_History |
| **名士預言** | `Data.Oracle_History` | 名士預言系統.md (doc_spec_0006) I 區 | Oracle_Session, Predicted_Type, Accuracy |
| **轉蛋** | `Data.Gacha_State` | 轉蛋系統.md (doc_spec_0042) I 區 | Pull_Count, Pity_Counter, Bonding_Points, Pool_Positioning |
| **家族關係** | `Data.Family_Relations` | 家族關係（史實相性）系統.md (doc_spec_0024) I 區 | Relation_Type, EP_Bonus, Is_Active |
| **遊戲時間** | `Data.Game_Time` | 遊戲時間系統.md (doc_spec_0034) I 區 | Current_Season, Current_Year, Turn_Count |
| **領地治理** | `Data.Governance` | 領地治理系統.md (doc_spec_0037) I 區 | Territory 結構, Tax_Rate, Facilities |
| **大廳系統** | `Data.Lobby_Hub` | 大廳系統.md (doc_spec_0002) I 區 | Mission_Boards, Character_Spots, World_Sandtable, World_Sandtable_Unlock_History, Wish_Altar, Current_Theme, Volunteer_Event_Log, Officer_Snapshot |
| **武將日誌與離線互動** | `Data.General_Journal` | 武將日誌與離線互動系統.md (doc_spec_0015) I 區 | Journal_Entries, Morning_Report, General_Dispatch, Offline_Interactions, Offline_Battle_Snapshots |
| **他國 AI** | `Data.Rival_Nations` | 治理模式他國AI系統.md (doc_spec_0020) I 區 | Nation_States, Diplomatic_Relations, Coalition_State, Relation_Decay_Rate |
| **官職系統** | `Data.Officer_System` | 官職系統.md (doc_spec_0014) I 區 | Current_Tier, Officer_Exp, Unlocked_Features, Unlock_History |
| **智慧 NPC 記憶** | `Data.NPC_Memory` | 智慧NPC技術架構與風險.md (doc_spec_0171) | General_UID, Conversation_History, Vector_Storage_Path, Interaction_Context |

> **維護原則**：各子系統的欄位增減以對應規格書的 I 區為準。本表僅維護掛載路徑對照，不重複定義欄位細節。如有欄位命名衝突，以武將系統.md 和本文件為最終裁定。

> **Battle / General Detail 技能資料流補充（2026-04-15）**：
> 1. `assets/resources/data/generals.json` 內的 `tacticSlots[] / ultimateSlots[]` 是武將的**canonical seed library**，供 `GeneralDetail` 與 `BattleScene` 共同讀取。
> 2. 本表中的 `Data.Generals[UID].Learned_Tactics` / `Data.Generals[UID].Ultimates` 屬於**存檔層 overlay**，負責保存等級、經驗、解鎖、繼承、冷卻等玩家進度，不取代 seed library。
> 3. 戰鬥執行時，`tactic-library.json[].battleSkillId` 與 `ultimate-definitions.json[].battleSkillId` 再映射到 `assets/resources/data/skills.json` 的時間軸技能定義；Battle 端不應再維護第三份平行技能資料表。

> **共用技能實作順序（2026-04-15）**：
> 1. 先讀 canonical seed：`tacticSlots[] / ultimateSlots[]`
> 2. 再疊 save overlay：`Learned_Tactics / Ultimates`
> 3. 再產 battle read model：`battleSkillId / targetMode / unlockState / cooldownState`
> 4. UI 層只吃 read model，不直接拼接多份 JSON
> 5. 戰鬥層只吃 `BattleSkillRequest`，不回頭讀 UI 狀態
> 6. replay / battle log 只記錄 request 與 result，不記錄整份 master 定義副本
> 7. shared contract 草案路徑：`shared/skill-runtime.ts`、`shared/skill-runtime.schema.json`
> 8. 讀模型統一前置卡：`docs/agent-briefs/tasks/SYS-SKILL-CORE-0001.md`

#### 共用技能任務卡索引（2026-04-15）

1. Shared read model 前置：`SYS-SKILL-CORE-0001`
2. 戰法模組包：`SYS-SKILL-TAC-0001 ~ 0005`
3. 奧義 family 包：`SYS-SKILL-ULT-0001 ~ 0008`
4. 所有技能卡都必須同時通過 `unit test / 畫面表演 / 數值公式 / 整合演出流程` 四層驗收，才能視為正式完成。

### 2-1. 虎符、英靈卡與戰場 UI 整合欄位約束

1. `Data.Talisman_Inventory` 視為 `TigerTally / PlayerTallyCollection` 的 root-save 掛載別名；正式 persisted 欄位至少需包含：`Tally_ID`、`Quality`、`TigerTallyScore`、`Star`、`Star_Exp`、`Source_Template_ID`、`Source_General_UID`、`Source_Type`、`Linked_Troop_ID`、`Equipped_General_UID`、`Death_Battle_Score`、`Legacy_Quality_Score`、`Acquired_Season`、`Is_Displayed`。
2. `Source_Type` 只允許 `DeathSettlement / Recruitment / WarConquest` 三種值，對應虎符正式來源三進路；不得再回流「退役產虎符」或「轉蛋產虎符」舊語意。
3. `Generals[*].Equipped_Tally_UID` 或等價關聯欄位必須表達「一將一符」單裝備槽，供戰場 UI 與人物頁 `兵 / Aptitude` 頁共用查詢入口；同時需支援持有者死亡後退回君主再分配的規則。
4. `Data.Spirit_Card_Collection` 視為英靈卡在 UI / 人物頁的 read model。正式 persisted 欄位至少需包含：`Spirit_ID`、`General_Template_ID`、`Spirit_Family_Key`、`LineageScore`、`Resonance_Band`、`Glow_State`、`Card_Role=MAIN / BACKUP`、`Family_Primary_Flag`、`Equipped_General_UID`、`Slot_Type=DESTINY`、`Display_Bucket=DESTINY_SLOT / CLAN_RELIC`、`DualEquip_Allowed`、`Death_Snapshot`；人物頁裝配入口固定對應 `命 / Bloodline` 頁英靈卡槽。
4a. `Data.Spirit_Archive_Snapshot` 視為家族層死亡快照 read model，至少需包含 `Spirit_ID`、`Death_Season`、`Heroic_Deeds_Summary`、`Final_Stats_Snapshot`、`Final_Skills_Snapshot`、`Final_Equipment_Snapshot`、`Battle_Record_Ref`、`Legacy_Quote`、`Display_Weight`，供英靈展示列與詳情頁使用。
4b. `Data.Spirit_Family_State` 視為家族級 read model，至少需包含 `Spirit_Family_Key`、`Family_Contribution_Pool`、`Family_Fame`、`Family_Depth`、`Active_Main_Spirit_UID`、`Main_Spirit_LineageScore`、`Contribution_Mode` 與 `Featured_Archive_Spirit_UIDs`，供主卡切換、展示列排序與家族深度計算使用。
4c. `英靈陳列室` 頁面的排序與篩選，應由 `Data.Spirit_Archive_Snapshot` + `Data.Spirit_Card_Collection` + `Data.Spirit_Family_State` 組合推導，不新增額外的手工排序欄位；預設排序鍵為 `Display_Weight DESC, Death_Season DESC, Spirit_ID ASC`，篩選鍵為 `Spirit_Family_Key`、`Resonance_Band`、`Card_Role` 與 `Death_Snapshot` 完整度。
5. `Generals[*].Equipped_Spirit_UID` 或等價關聯欄位必須表達「一將一命槽」單插規則；英靈卡雖由 `Inventory_Service` 管理，但前端不得與普通道具共用格子背包語意，且正式裝配入口固定為人物頁 `命 / Bloodline` 頁特殊槽。
6. `Data.Sortie_Loadout` 必須明確保存 `Commander_UID`、`Strategist_UID`、`Deputy_UID`，且三者不得重覆；這三個欄位對應的是同一場戰鬥內的角色責任，不是裝備槽。
7. `Data.Battle_State` 至少需提供 battle-facing read model：`Current_Food`、`Max_Food`、`Current_Tactic_Points`、`Max_Tactic_Points`、`Elite_Deploy_Cap`、`Active_Elite_Count`、`Reserved_Tally_Bands`、`Strategist_UID`、`Deputy_UID`、`Delegate_AI_Active`、`Last_Deploy_Result_Code`、`Triggered_Set_Bonus[]`。其中 `Last_Deploy_Result_Code` 供 HUD / TigerTally 卡片顯示 `Ready / FoodShort / CapFull / Downgrade / SetActive / Disabled` 等前端狀態。
8. `TigerTally.Grain_Cost_Base` 可在 client read model 暫存，供戰場 UI 直接顯示；但 canonical truth 仍以 `TALLY_GRAIN_COST[quality][star]` 為準，不應在多個 persisted schema 重複維護同一份平衡真相。
9. `TALLY_GRAIN_COST`、`SET_BONUS_DEFS`、參謀官 / 後勤官支援公式、委任 AI 釋放公式、`TigerTallyScore` 權重等平衡常數屬於 cross-ref 規則，不應硬寫成玩家存檔欄位；若 battle replay 需要，只記錄結果，如 `Food_Spent`、`Triggered_Set_Bonus`、`Reserved_Tally_Bands`。
10. 本文件不得新增 `TallyCategory`、`Cooldown_Turns` 等已被 Q61 / Q63 否決的欄位，避免 Data Schema 與母規格重新分裂。
11. `武將裝備道具系統.md` (doc_spec_0174) 是道具 / 一般裝備 / 虎符 / 英靈卡的整併母本；本檔以 `Data.Inventory_Service` 為 canonical truth，`Data.Talisman_Inventory` 與 `Data.Spirit_Card_Collection` 只保留 projection / compatibility read model。

#### 2-1a. 虎符 / 英靈卡 / 戰場最小 read model 形狀

以下 shape 為 battle UI 與人物頁 `寶 / GEAR` 頁查詢虎符、命槽英靈卡與出征支援時的正式最小讀模型，目的不是重複定義所有平衡規則，而是讓前端知道哪些欄位可以直接讀。

```json
{
  "Data": {
    "Talisman_Inventory": {
      "TALLY_0001": {
        "Tally_ID": "TALLY_0001",
        "Quality": "SSR",
        "TigerTallyScore": 78,
        "Star": 3,
        "Star_Exp": 240,
        "Source_Template_ID": "ZHANG_LIAO_V1",
        "Source_General_UID": "G_CHANG_0042",
        "Source_Type": "WarConquest",
        "Linked_Troop_ID": "TROOP_SWIFT_CAVALRY",
        "Equipped_General_UID": "G_PLAYER_0017",
        "Death_Battle_Score": 84,
        "Legacy_Quality_Score": 63,
        "Grain_Cost_Base": 92,
        "Acquired_Season": 9,
        "Is_Displayed": true
      }
    },
    "Spirit_Card_Collection": {
    "SPIRIT_0001": {
      "Spirit_ID": "SPIRIT_0001",
      "General_Template_ID": "ZHANG_LIAO_V1",
      "Spirit_Family_Key": "FAMILY_ZHANG",
      "LineageScore": 185000,
      "Resonance_Band": "SELF_RESONANCE",
      "Glow_State": "StrongGlow",
      "Card_Role": "MAIN",
      "Family_Primary_Flag": true,
      "Equipped_General_UID": "G_PLAYER_0017",
      "Slot_Type": "DESTINY",
      "Display_Bucket": "DESTINY_SLOT",
      "DualEquip_Allowed": true,
      "Death_Snapshot": {
        "Death_Season": 13,
        "Heroic_Deeds_Summary": "北伐破陣，七進七出斷後軍",
        "Final_Stats_Snapshot": {
          "STR": 91,
          "INT": 78,
          "LEA": 86,
          "POL": 52,
          "CHA": 74,
          "LUK": 63
        },
        "Final_Skills_Snapshot": [
          "突襲",
          "斷後",
          "破陣"
        ],
        "Final_Equipment_Snapshot": [
          "破軍槍",
          "玄甲"
        ],
        "Battle_Record_Ref": "BATTLE_2026_S13_081",
        "Legacy_Quote": "死戰不退，護主至終。"
      }
      }
    },
    "Spirit_Family_State": {
      "Spirit_Family_Key": "FAMILY_ZHANG",
      "Family_Contribution_Pool": 1280,
      "Family_Fame": 54,
      "Family_Depth": 3,
      "Active_Main_Spirit_UID": "SPIRIT_0001",
      "Main_Spirit_LineageScore": 185000,
      "Contribution_Mode": "ACTIVE_MAIN_CARD",
      "Featured_Archive_Spirit_UIDs": ["SPIRIT_0001"]
    },
    "Sortie_Loadout": {
      "Commander_UID": "G_PLAYER_0017",
      "Strategist_UID": "G_PLAYER_0009",
      "Deputy_UID": "G_PLAYER_0021",
      "Strategist_Max_Tactic_Bonus": 18,
      "Strategist_Start_Tactic_Bonus": 9,
      "Deputy_Food_Cap_Bonus": 1200
    },
    "Battle_State": {
      "Current_Food": 9700,
      "Max_Food": 13200,
      "Current_Tactic_Points": 21,
      "Max_Tactic_Points": 48,
      "Elite_Deploy_Cap": 3,
      "Active_Elite_Count": 2,
      "Reserved_Tally_Bands": ["SSR"],
      "Strategist_UID": "G_PLAYER_0009",
      "Deputy_UID": "G_PLAYER_0021",
      "Delegate_AI_Active": false,
      "Last_Deploy_Result_Code": "SET_ACTIVE",
      "Triggered_Set_Bonus": ["SET_FIVE_TIGERS"],
      "TigerTally_ReadModel": [
        {
          "tallyId": "TALLY_0001",
          "troopId": "TROOP_SWIFT_CAVALRY",
          "sourceType": "WarConquest",
          "deployState": "SetActive",
          "deployReasonCode": "SET_ACTIVE",
          "setIds": ["SET_FIVE_TIGERS"],
          "setActive": true
        }
      ]
    }
  }
}
```

> **讀寫邊界**：`TigerTally_ReadModel` 屬於 battle-facing projection，可由 battle scene assemble；`Talisman_Inventory` 仍是虎符持有與裝備真相來源。若兩者衝突，以 `Talisman_Inventory` + battle result assembly 為準。

### 2-2. 本輪補充欄位約束

1. `Generals[*].Has_Retired_Before`：記錄是否曾經退役，供死亡後雙卡補發與教官邊界判定。
2. `Generals[*].Female_Role_Type`：女性名將池內定位標籤，區分 `COMBAT / SUPPORT`，不改變其仍屬名將池。
3. `Lobby_Hub.World_Sandtable.Unlock_History`：天下大亂後仍保留的沙盤解鎖歷史。
4. `Lobby_Hub.Volunteer_Event_Log`：大廳自告奮勇彩蛋紀錄，僅作事件追蹤，不代表固定成功率機制。
5. `Rival_Nations[*].Coalition_State`：明確區分霸主、強制參盟與無聯盟狀態。
6. `Child_Preview.Revelation_Level`：子嗣隱藏資訊的揭露階段，依序為 `HIDDEN / TENDENCY / RANGE / EXACT`。
7. `General_Journal.Journal_Entries[*].Source_Action_Seq_Range`：對應離線期間的 Action 序號區間，供晨報與快照回扣驗證。
8. `General_Journal.Morning_Report.Items`：僅保存本次摘要引用的 `Entry_ID`，不複製事件內容。
9. `General_Journal.General_Dispatch.Active_Jobs`：只允許掛載低風險、可摘要結算的派遣案；高風險任務不得寫入此路徑。
10. `General_Journal.Offline_Battle_Snapshots[*].Sync_Hash_Link`：必須可回扣 `Action_Records` 或 `Last_Sync_Hash`，不可只保存裸結果字串。
11. `Battle_State.Elite_Deploy_Cap`：本場同時存活的精銳 / 特殊兵 / 器械上限；`Militia` 不計入。
12. `Battle_State.Scene_Preset_ID`：必須對齊 `Scene_Gambit_State.Tile_Preset_ID`，作為模組化棋盤唯一 preset 權威。
13. `Battle_State.Reserved_Tally_Bands`：僅記錄 AI / 任務保留的品質 band（如 `SSR / UR`），不直接複製虎符完整資料。
14. `Scene_Gambit_State.Required_Intel_Value`：每一種場景戰法的固定情報門檻，不得改寫成百分比條件。
15. `Scene_Gambit_State.Environment_Bonus_Pct`：地形 / 天氣 / 適性 / 場景增幅的百分點合併結果，供戰鬥公式一次結算。
16. `Player_Economy.Resource_Protection`：地窖保護保底值與最近觸發時間，保證敗局後仍有最低操作水位。
17. `Player_Economy.Daily_Subsidy`：每日救濟僅記錄本日補貼結果，不得被商業加速直接重複刷新。
18. `Tournament_Data.Player_Tournament.Registered_Snapshot_ID`：挑戰賽對戰只讀該快照，不回頭抓玩家當前即時配置。
19. `Tournament_Data.Season_History[*]`：至少保留賽季名、最終段位、最終積分、最佳連勝與快照 ID。
20. `Bonding_Sessions[*].Breeding_Mode`：只允許 `Standard / Peace_Lineage`；`Peace_Lineage` 仍受 `Vigor`、`Pregnancy_Lock`、`Breeding_Cap` 約束，不另開宗廟或額外精氣系統。
21. `Mentor_Pool[*].Role_Boundary`：固定為 `TeachingOnly`；教官資料不得回寫父母關係、血統因子或受孕率。
22. `Nurture_Sessions[*].Mentoring_Mode_Log`：必須可區分 `Support` 與 `Legendary_Mentoring`，供 36 回合事件重播與畢業摘要引用。
23. `Nurture_Sessions[*].Graduation_Tags`：只可作為 loadout / 場景推薦標籤，不得覆寫武將最終五維。
24. `Stage_Chain_Progress[*].Strategist_HUD`：只保存風險摘要、互動物件狀態與 loadout 缺口，不得儲存隱藏埋伏點答案。
25. `Stage_Chain_Progress[*].Stage_Salvage`：石材 / 木材 / 補給 / 情報等關卡收益先以戰後摘要形式存在，不在戰中逐筆改寫帳號經濟。
26. `Gacha_State.*.Pool_Positioning`：正式只允許 `Bloodline_Seed / Nurture_Depth`；不得回流 `Tiger_Tally`、`Spirit_Card` 或 `DP` 類別。
27. `Generals[*].Stats` 保留作為舊系統相容用的六維快照；若人物頁啟用雙層模式，應優先讀取 `Talent_Stats` 與 `Prowess_Stats`，不得反向用 `Stats` 假裝完整雙層資料。
28. `Generals[*].Talent_Stats.*.Revelation_Level` 只允許 `HIDDEN / TENDENCY / RANGE / EXACT`，供人物頁與培育頁共用揭露狀態。
29. `Generals[*].Prowess_Stats.Source_Session_ID` 可為空，表示此角色尚未形成正式培育畢業快照；UI 不得因此回填虛構戰力值。
30. `Generals[*].Profile_Presentation.Story_Strip_Cells` 固定使用 `origin / faction / role / awakening / bloodline / future` 六格語意槽位，不得任意改成流水號 key。
31. `Generals[*].Profile_Presentation.Default_Tab` 只允許 `Overview / Stats / Bloodline / Tactics / Equip / Aptitude`，確保人物頁路由與 UI 契約一致；本地化顯示分別對應 `將 / 屬 / 命 / 技 / 寶 / 兵`。
32. `Generals[*].Equipped_Spirit_UID` 若存在，必須能對回 `Data.Spirit_Card_Collection[*].Spirit_ID`，且同一時間一名武將只能掛一張。
33. `Sortie_Loadout.Strategist_UID` 與 `Sortie_Loadout.Deputy_UID` 不得與 `Commander_UID` 重覆，也不得彼此重覆；若 UI 想支援替換，必須透過顯式確認流程。
34. `Sortie_Loadout` 的支援角色不參與 `Triggered_Set_Bonus` 判定，也不得回寫成 `Battle_State` 中的在場虎符單位。

### 2-3. 智慧 NPC 與向量記憶欄位約束

1. `Data.NPC_Memory` 的本地核心儲存方案仍為 **SQLite-vec**，用於離線模板、最近互動與高頻 persona cache；連網研發與推論可由 `三國大腦中台規格書.md` (doc_spec_0177) 定義的 FastAPI / Pinecone 服務承接。
2. `SQLite_Vec_DB_Path` 指向本地 SQLite 資料庫，該資料庫只保存客戶端需要的 Embedding / Text Snippets / Template Slot 快取，不複製中台完整語料庫。
3. `Recall_Context` 作為 LLM 推論或模板選句時的上下文緩存，僅儲存最近或高權重的檢索片段，避免 Action_Records 過大。
4. 本系統在 MVP 階段僅保留 `Template_Slot_Values`；第二階段啟用三國大腦中台後，可寫入 `Brain_Service_Profile`、`Persona_Card_Version`、`Recent_Context` 與 `Pending_Unknown_Events` 等摘要欄位。
5. 數據隱私：NPC 記憶應與 `Player_ID` 綁定，確保存檔遷移後對話記憶不遺失；玩家輸入與未命中事件上傳中台前必須先摘要化，不得上傳完整存檔。

#### 2-3a. NPC 記憶最小 read model 形狀

```json
{
  "Data": {
    "NPC_Memory": {
      "SQLite_Vec_DB_Path": "save/npc_memory.db",
      "Brain_Service_Profile": "offline-template",
      "Persona_Card_Version": "npc-persona-v1",
      "Recall_Context": [
        { "General_UID": "G001", "Vector_ID": "V_0099", "Snippet": "曾於虎牢關共戰", "Last_Met": "2026-04-12" }
      ],
      "Recent_Context": [],
      "Pending_Unknown_Events": []
    }
  }
}
```

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

#### 1-1. 轉蛋操作日誌 Payload 詳細 Schema（GachaDrawRecord）

本機轉蛋目前支援三種 Action 代碼，對應不同貨幣召喚路徑。Payload 欄位定義如下：

| Action 代碼 | 說明 | 對應消耗貨幣 | 費用計算 |
|---|---|---|---|
| `LOCAL_GACHA_PULL` | 鑽石一般召喚（單抽/十連） | `gems` | 100 × drawCount |
| `LOCAL_GOLD_SUMMON` | 金幣召喚（單抽） | `gold` | 500 × drawCount |
| `LOCAL_TICKET_SUMMON` | 召喚券召喚（單抽） | `tickets` | 1 × drawCount |

```typescript
// GachaDrawRecord — 轉蛋 ActionRecord.Payload 結構（定義於 LocalGachaService）
interface GachaDrawRecord {
  poolId:     string;   // 池子識別碼，如 "GENERAL_STANDARD_01"
  drawCount:  number;   // 本次抽取數量（1 或 10）
  cost:       number;   // 消耗的貨幣數量
  localOnly:  true;     // 本機操作標記，尚未上傳 Server
  results: Array<{
    id:          string;  // 武將唯一 ID
    name:        string;  // 武將名稱
    rarityTier:  string;  // 稀有度 tier（mythic / legendary / epic / rare / common）
    displayText: string;  // 顯示文字（含序號與 bucket）
  }>;
}
```

> **召喚歷史讀取模型**：`LocalGachaService.getRecentPullHistory(limit)` 讀取 `sync.action-log` 中所有三種 Action 紀錄，以 `Timestamp` 降序（最新到最舊）排列，回傳 `{ total: number; records: GachaHistoryRecord[] }`。`GachaHistoryRecord` 為前端展示層使用的扁平化投影，包含 `seq / timestamp / actionType / drawCount / cost / currencyKey / results`。
>
> **時間戳記格式**：`Timestamp` 為 Unix 毫秒整數（`Date.now()` 產生），UI 層顯示格式為 `YYYY/MM/DD HH:mm:ss`（本地時區）。

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


---
## 🗳 MCQ 決策記錄（Q47）

- **問題**：培育外界時間換算
- **衝突說明**：鏡像時空育才系統設計(doc_spec_0157)與養成系統與教官來源定義(doc_spec_0151)都描述『每按1回合外界同步1季』，推導為36回合=外界9年；但子嗣系統規格書：三國傳承(doc_spec_0056)與現行培育系統規格書(doc_spec_0026)又寫成『培育36回合，外界僅1季』。這會直接影響壽命推進、內政治理結算、戰爭事件插入點與Data Schema時間戳定義，若不拍板會導致模擬與正式服時間線不一致。
- **裁決**：**選項 A** — 外界1季=培育36回合（維持鏡像壓縮）
- **回寫時間**：2026-04-12 12:52
- **來源**：由 `consolidation-doubt-mcq.js rewrite-all` 自動寫入

---


---
## 🗳 MCQ 決策記錄（Q48）

- **問題**：培育教官槽位定義
- **衝突說明**：鏡像時空育才系統設計(doc_spec_0157)寫入學時可快照6位教官；養成系統與教官來源定義(doc_spec_0151)又寫培育時有5個教官插槽；現行培育系統規格書(doc_spec_0026)則定義每輪可更換1名教官，計算式也採單一Mentor。三種結構會改變TP累積、支援卡價值、UI編排與教官重複使用限制，若不拍板，教官系統(doc_spec_0027)與培育UI契約無法實作一致。
- **裁決**：**選項 C** — 固定6教官槽（入學快照鎖定）
- **回寫時間**：2026-04-12 12:52
- **來源**：由 `consolidation-doubt-mcq.js rewrite-all` 自動寫入

---


---
## 🗳 MCQ 決策記錄（Q33）

- **問題**：格子屬性 JSON 結構
- **衝突說明**：戰場格子屬性表尚未定型資料結構，靜態JSON與ScriptableObject各有優缺，不拍板會導致戰場系統各部分各自選型無法橫向擴充。
- **裁決**：**選項 D** — 選項 D
- **回寫時間**：2026-04-12 13:16
- **來源**：由 `consolidation-doubt-mcq.js rewrite-all` 自動寫入

---


### 雙層數值定義更新 (Q70)
- General.Talent (資質層): { STR: 85, INT: 90, ... } (0-100)
- General.Prowess (實力層): { STR: 1540, INT: 1800, ... } (0-2000+)
(取代舊有單一五維架構)
