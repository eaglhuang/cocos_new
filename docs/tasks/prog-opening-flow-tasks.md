<!-- doc_id: doc_task_0153 -->
# 新手開場程式規格書 — 可執行任務單總覽

**來源規格書**: `docs/程式規格書.md (doc_tech_0008)` (doc_tech_0008)  
**分析日期**: 2026-04-06  
**任務前綴**: `PROG-1-XXXX`  
**機器可讀 shard**: `docs/ui-quality-tasks/phase-prog-opening.json`

---

## 分析摘要

`程式規格書.md` (doc_tech_0008) 定義了新手開場系統全部元件，截至分析日 **均未實作**。

| 類別 | 模組數 | 任務數 |
|------|--------|--------|
| 資料結構（§3.x） | 6 | 6 張（P0） |
| Controller 實作（§2.x） | 3 | 3 張（P1） |
| UI 元件（§2.x） | 2 | 2 張（P1） |
| 整合/驗證（§4-5） | 5 | 5 張（P2） |
| **合計** | **16** | **16 張** |

依賴順序：**P0 → P1 → P2**（不可並行）

---

## 優先度 P0 — 資料結構（所有實作的前置）

### PROG-1-0001 HeroBase 介面 + 6 位初始武將資料落地

| 欄位 | 值 |
|------|----|
| 類型 | data-structure |
| 對應規格 | §3.1 HeroBase |
| 交付物 | `assets/scripts/core/models/HeroBase.ts` + `assets/resources/data/generals.json`（擴充） |
| 驗收 | 介面 0 TS errors；6 位武將含 introLine/portraitKey/battleVoiceKey |

**欄位清單**：`id, name, title, originRegion, coreFactorTag, rarity, element, initialRole, introLine, portraitKey, battleVoiceKey`

---

### PROG-1-0002 SupportCardBase 介面 + support-cards.json 初始落地

| 欄位 | 值 |
|------|----|
| 類型 | data-structure |
| 對應規格 | §3.2 SupportCardBase |
| 交付物 | `assets/scripts/core/models/SupportCardBase.ts` + `assets/resources/data/support-cards.json` |
| 驗收 | 介面 0 errors；至少 3 筆含 rarity/routeType/arrivalTime/rushPrice |

**欄位清單**：`id, name, category, rarity, routeType, arrivalTime, rushPrice, effectTags, previewLine, portraitKey`

---

### PROG-1-0003 InheritLogic 介面 + 預設繼承規則落地

| 欄位 | 值 |
|------|----|
| 類型 | data-structure |
| 對應規格 | §3.3 InheritLogic |
| 交付物 | `assets/scripts/core/models/InheritLogic.ts` + `assets/resources/data/inherit-logic-default.json` |
| 驗收 | 0 TS errors；與 `BloodlineGenerator.ts` 型別無衝突 |

**欄位清單**：`fatherId, motherId, ancestorCount, allowedRegions, factorSlots, mutationRules, previewWeights, inheritCaps`

> ⚠️ `BloodlineGenerator.ts` 已存在，先讀取確認整合點後再定義介面。

---

### PROG-1-0004 OpeningFlowConfig 介面 + 開場幕次 JSON 落地

| 欄位 | 值 |
|------|----|
| 類型 | data-structure |
| 對應規格 | §3.4 OpeningFlowConfig |
| 交付物 | `assets/scripts/core/models/OpeningFlowConfig.ts` + `assets/resources/data/opening-flow-config.json` |
| 驗收 | 全部幕次（≥5 幕）均有 entryCondition/exitCondition |

**欄位清單**：`phaseId, phaseName, durationHint, entryCondition, exitCondition, requiredUi, requiredEffects, requiredRewards`

---

### PROG-1-0005 GachaConfig 介面 + 抽卡配置 JSON 落地

| 欄位 | 值 |
|------|----|
| 類型 | data-structure |
| 依賴 | PROG-1-0001, PROG-1-0002（candidateIds 需真實 id） |
| 對應規格 | §3.5 GachaConfig |
| 交付物 | `assets/scripts/core/models/GachaConfig.ts` + `assets/resources/data/gacha-config.json` |
| 驗收 | 含 hero-pool（resetEnabled:true, pickCount:10）+ support-pool |

**欄位清單**：`poolId, poolType, resetEnabled, guaranteeRarity, pickCount, candidateIds, firstPickOnly, confirmRequired`

---

### PROG-1-0006 CountdownConfig 介面 + 倒數參數 JSON 落地

| 欄位 | 值 |
|------|----|
| 類型 | data-structure |
| 對應規格 | §3.6 CountdownConfig |
| 交付物 | `assets/scripts/core/models/CountdownConfig.ts` + `assets/resources/data/countdown-config.json` |
| 驗收 | 含 canAccelerate / rushPrice / notifyEveryLogin |

**欄位清單**：`targetId, startTimestamp, finishTimestamp, rushPrice, displayLocation, notifyEveryLogin, canAccelerate`

---

## 優先度 P1 — Controller & UI 元件實作

### PROG-1-0007 OpeningFlowController 實作

| 欄位 | 值 |
|------|----|
| 類型 | implementation |
| 依賴 | PROG-1-0001, PROG-1-0002, PROG-1-0004 |
| 對應規格 | §2.1 + §4 流程規則 |
| 交付物 | `assets/scripts/core/controllers/OpeningFlowController.ts` |

**核心需求**：
- 事件驅動（透過 `EventSystem`）、每幕狀態可追蹤
- 幕次：信件 → 漫畫 → 轉場 → 轉蛋 → 教學
- 未登入時各幕顯示預設內容（不 crash）
- 整合 `SceneManager` + `UIManager`

**驗收**：空存檔啟動跑完全幕次，零 TypeError；phaseId 可追蹤

---

### PROG-1-0008 GachaManager 實作

| 欄位 | 值 |
|------|----|
| 類型 | implementation |
| 依賴 | PROG-1-0001, PROG-1-0002, PROG-1-0005 |
| 對應規格 | §2.2 + §5.2 |
| 交付物 | `assets/scripts/core/managers/GachaManager.ts` |

**核心需求**：
- 無限重置十連抽（名將池 + 紅顏池）
- 保底：第 10 抽必出 `guaranteeRarity`
- `resetEnabled` 旗標控制是否可重置
- `firstPickOnly` 限制（只能選一次）
- `confirmRequired` 確認前不鎖定結果

**驗收**：reset 正確歸零；第 10 抽保底 10 輪全中；firstPickOnly 第二次 pick 報錯

---

### PROG-1-0009 CountdownManager 實作

| 欄位 | 值 |
|------|----|
| 類型 | implementation |
| 依賴 | PROG-1-0006 |
| 對應規格 | §2.3 + §5.4 |
| 交付物 | `assets/scripts/core/managers/CountdownManager.ts` |

**核心需求**：
- 離線時間累積（App 背景時 `Date.now` delta）
- 加速：`rushPrice` 換算縮短秒數
- 完成：到達 `finishTimestamp` → 狀態切為 `'arrived'`
- `notifyEveryLogin` = 每次登入彈出提示

**驗收**：mock 離線 1800s → remainingMs 正確縮短；arrived 狀態不反覆切換

---

### PROG-1-0010 BloodlineTreePanel 元件實作

| 欄位 | 值 |
|------|----|
| 類型 | ui-component |
| 依賴 | PROG-1-0001, PROG-1-0003 |
| 對應規格 | §2.4 UI_BloodlineTree |
| 交付物 | `assets/scripts/ui/components/BloodlineTreePanel.ts` |

**核心需求**：
- 顯示祖先矩陣（3 代 14 人，對接 `ancestors.json`）
- 因子繼承視覺化（連線或色塊）
- 子嗣預測顯示（對接 `BloodlineGenerator.ts`）
- 720p 下無溢出

**驗收**：smoke capture 可截圖；BloodlineGenerator 輸出與面板顯示 100% 一致

---

### PROG-1-0011 AttributePanel 元件實作

| 欄位 | 值 |
|------|----|
| 類型 | ui-component |
| 依賴 | PROG-1-0001 |
| 對應規格 | §2.5 AttributePanel |
| 交付物 | `assets/scripts/ui/components/AttributePanel.ts`（新建或確認 GeneralDetailPanel.ts 已包含） |

> ⚠️ 先讀 `GeneralDetailPanel.ts` 確認是否已實作六維屬性顯示，避免重複建立

**核心需求**：
- 主因子（`coreFactorTag`）+ 次級因子 + 解鎖狀態（灰遮罩 vs 亮色）
- 六角圖或等效圖表（CurveSystem / Graphics API）
- 支援掛入 `GeneralDetailOverviewShell`

---

## 優先度 P2 — 整合驗證

### PROG-1-0012 新手開場流程整合驗證

依賴：PROG-1-0007, PROG-1-0008, PROG-1-0009  
對應：§4 流程規則 + §5.1

驗收：
- 空存檔啟動 → 5+ 幕次全過 → 進入 LobbyScene，零 TypeError
- 未登入時各幕均有預設內容

---

### PROG-1-0013 抽卡重置邏輯驗證

依賴：PROG-1-0008  
對應：§5.2

驗收：
- 10 次 reset 後初始狀態完全一致
- 第 10 抽保底 10 輪全中

---

### PROG-1-0014 因子預覽對應角色資料驗證

依賴：PROG-1-0010, PROG-1-0003  
對應：§5.3

驗收：
- 10 組父母資料，BloodlineTreePanel 顯示與 BloodlineGenerator 輸出 100% 一致

---

### PROG-1-0015 倒數完成狀態切換驗證

依賴：PROG-1-0009  
對應：§5.4

驗收：
- mock 離線 1800s → remainingMs 縮短正確
- 完成後 UI 狀態切換為「已到達」無 flicker

---

### PROG-1-0016 商業化入口一致性驗證

依賴：PROG-1-0007, PROG-1-0008, PROG-1-0009  
對應：§4（所有商業入口從同一配置讀取）+ §5.5

驗收：
- `grep -r 'rushPrice\s*=\s*[0-9]' assets/scripts` 零結果
- 開場流程未完成前商業入口不可見/禁用

---

## 執行建議順序

```
第一週:
  PROG-1-0001 HeroBase
  PROG-1-0002 SupportCardBase
  PROG-1-0003 InheritLogic     ← 先讀 BloodlineGenerator.ts 再開工
  PROG-1-0004 OpeningFlowConfig
  PROG-1-0006 CountdownConfig

第一週後段 (PROG-1-0001/0002 完成後):
  PROG-1-0005 GachaConfig

第二週:
  PROG-1-0007 OpeningFlowController
  PROG-1-0008 GachaManager
  PROG-1-0009 CountdownManager

第三週:
  PROG-1-0010 BloodlineTreePanel
  PROG-1-0011 AttributePanel

第四週 (驗證):
  PROG-1-0012 → 0016 全部驗證任務
```

---

*shard 機器可讀位置: `docs/ui-quality-tasks/phase-prog-opening.json`*
