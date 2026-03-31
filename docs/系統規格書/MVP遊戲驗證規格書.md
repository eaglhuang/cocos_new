# MVP 遊戲驗證規格書

> **來源文件**：MVP 遊戲驗證規格書.md

---

## A. 系統描述

MVP（Minimum Viable Product）驗證規格書定義了遊戲第一個可玩版本的最小功能集。MVP 的目標是驗證核心樂趣迴圈：「結緣→培育→戰場→世代傳承」。只實做 P0 功能，P1/P2 全部延後。MVP 驗收標準：一個完整的「祖→父→子」三代循環可以跑通。

### 長線願景：全球征途

> 遊戲最終目的：玩家扮演三國領主，透過跨世代血統培育與精銳虎符組合，從**中原統一**走向挑戰世界強權的**全球征途**。

| 階段 | 目標 | 對手 | 解鎖條件 |
|---|---|---|---|
| 第一階段 | 中原統一 | 三國群雄 AI | MVP 核心迴圈 |
| 第二階段 | 邊境征伐 | 蠻族/南蠻/北狄 | 統一中原後 |
| 第三階段 | 全球遠征 | 蒙古帝國/十字軍/大和武士 | 邊境征伐完成後 |

- **核心視覺**：2.5D 棋盤視角，融合懷舊大頭貼對話與現代華麗特效
- **TA 玩家**：35-50 歲，喜愛《三國志》《天下布武》的資深策略玩家，追求「延時滿足」與「推理決策」
- **核心體驗**：跨世代血統培育的百年家族經營 + 虎符英靈系統的傳承美學

> MVP 階段僅驗證第一階段核心迴圈，但架構需預留後續全球征途的擴展空間。

---

## B. 系統目的

1. **驗證核心玩法**：確認「配種→開獎→培育→戰鬥」迴圈是否有趣
2. **技術可行性**：確認 14 人血統矩陣、因子繼承、鏡像培育的技術架構
3. **最小研發投入**：砍掉所有非核心功能，專注驗證
4. **迭代基礎**：MVP 完成後根據反饋決定下一階段方向

---

## C. 商業套路

| 商業點 | MVP 狀態 |
|---|---|
| 轉蛋 | ✅ 最簡版（單池+保底） |
| 補元散 | ✅ 測試用免費發放 |
| 月卡/通行證 | ❌ 延後 |
| 商城 | ❌ 延後 |

---

## Note: 六色因子納入 MVP 的範圍說明

- 依照最新決策，MVP 範圍已擴展為實作六色因子（藍/粉/綠/紫/白/紅）。此變更將顯著增加前端展示、因子字典、因子覺醒邏輯與資料表的工作量。
- 預估影響：新增 2~3 個 sprint 的開發與測試（視團隊人力而定）；需在 sprint planning 中標示為高風險項目並保留技術債緩衝。
- 若希望縮短交付週期，建議採用分步策略（先交付 3 色核心 + 6 色技術原型），或在 MVP 文件中明確標註哪些六色功能為 mock/placeholder（請見後續選項）。

## D. 系統 TA

| 玩家類型 | MVP 驗證重點 |
|---|---|
| 養成控 | 培育 36 回合是否有趣？ |
| 數值控 | 血統矩陣配種是否有深度？ |
| 三國迷 | 名將+世代傳承是否有代入感？ |
| 內部團隊 | 技術架構是否能支撐後續擴展？ |

---

## E. 製作功能清單（MVP P0 Only）

| # | 系統 | 功能 | 說明 |
|---|---|---|---|
| 1 | 武將 | 武將數據結構 | UID/Template_ID/Bloodline_ID/五維/Genes |
| 2 | 武將 | 5 歲開獎 | 揭曉五維+因子 |
| 3 | 血統 | 14 人矩陣 | Ancestors_JSON 完整實做 |
| 4 | 血統 | 虛擬祖先 | 初代名將自動補齊 |
| 5 | 因子 | 六色因子（藍/粉/綠/紫/白/紅） | P0 實作完整六色因子（較大工程，需對照因子字典） |
| 6 | 結緣 | 基礎配種 | 精力消耗+子嗣生成 |
| 7 | 結緣 | EP 計算 | 爆發力公式（不含天命波動） |
| 8 | 培育 | 36 回合 | 鏡像快照+教官+訓練 |
| 9 | 培育 | 教官指派 | 基礎 TP 加成 |
| 10 | 轉蛋 | 單池抽取 | 基礎保底機制 |
| 11 | 傭兵 | 6 日結義 | 試用→結義流程 |
| 12 | 治理 | 基礎內政 | 5 大任務產出 |
| 13 | 時間 | 季度推進 | 季度制+年齡增長 |
| 14 | 壽命 | 退役判定 | 65 歲退役+教官 |
| 15 | 宿命 | 5 歲分流 | 武官/文官建議 |

---

## F. 公式相關

MVP 使用的公式子集（簡化版）：

### EP（不含天命波動）
```
EP_MVP = 50 + [共鳴] + [異脈] + [契合]
// 天命波動延後到 P1
```

### 因子繼承（六色）
```
Factor_Pool = [Blue, Pink, Green, Purple, White, Red]
Inheritance_Rate: G1=100%, G2=50%, G3=25%
```

### 培育（簡化）
```
Stat_Gain = Training_Base × (1 + Mentor_TP/100)
// Event_Bonus 延後到 P1
```

---

## G. 劇本相關

| 情境 | MVP 需求 |
|---|---|
| 開場新手引導 | 最基礎的 3 段式引導 |
| 5 歲開獎 | 標準開獎動畫+旁白 |
| 結義/退場 | 簡化版文字 |
| 戰場/治理 | placeholder 文字 |

---

## H. 字串內容相關

MVP 只需上述各系統的核心字串（標記為 P0 的 UI_ key），其餘 P1/P2 字串延後。

---

## I. Data Schema 需求

### MVP 最小數據結構
```json
{
  "MVP_Schema": {
    "General": {
      "UID": "string",
      "Template_ID": "string",
      "Bloodline_ID": "string",
      "Name": "string",
      "Age": "float",
      "Stats": {"STR":"int","INT":"int","POL":"int","CHR":"int","LUK":"int"},
      "Genes": ["GeneObject"],
      "Vitality": "int",
      "Vitality_Max": "int",
      "Class": "Warrior|Scholar",
      "Status": "Active|Retired|Dead",
      "Ancestors_JSON": "object (14-person)"
    },
    "GeneObject": {
      "Type": "Blue|Pink|Green|Purple|White|Red",
      "ID": "string",
      "Level": "int (1-5)",
      "Is_Locked": "boolean",
      "Discovery_Level": "int"
    },
    "Nurture_Session": {
      "Child_UID": "string",
      "Round": "int (1-36)",
      "Mentor_ID": "string",
      "TP": "int",
      "Snapshot_Stats": "object"
    },
    "Mercenary": {
      "UID": "string",
      "Days_Left": "int (0-6)",
      "Bond": "int",
      "Status": "Trial|Bonded|Expired"
    }
  }
}
```

### Server 端（MVP 最小表）
| 表名 | 說明 |
|---|---|
| generals | 武將主表 |
| gene_dictionary | 因子字典（3 色） |
| nurture_sessions | 培育紀錄 |
| mercenaries | 傭兵狀態 |
| player_resources | 玩家資源 |
| gacha_history | 轉蛋紀錄 |

---

## J. 名詞定義

| 名詞 | 代碼/Key | 定義 |
|---|---|---|
| MVP | MVP | 最小可玩版本 |
| P0 | Priority_0 | MVP 必做功能 |
| P1 | Priority_1 | 後續迭代功能 |
| P2 | Priority_2 | 遠期規劃功能 |
| 三代循環 | Three_Gen_Loop | 祖→父→子完整跑通=MVP 驗收標準 |
| 核心迴圈 | Core_Loop | 結緣→培育→戰場→世代傳承 |
