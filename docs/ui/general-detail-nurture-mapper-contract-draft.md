<!-- doc_id: doc_ui_0041 -->
# GeneralDetail × NurtureSession Mapper / Contract 草稿

> 狀態：草稿
> 日期：2026-04-11
> 目的：把人物頁總覽與 `NurtureSession` 的欄位語意收斂成同一套 canonical contract，避免一邊用展示字串、一邊用訓練摘要，最後各自長出第二套真相。

## 1. 設計原則

1. `GeneralDetailOverview` 是讀取端，不是雙層數值的真相來源。
2. `NurtureSession` 是進行端，負責揭露節奏、訓練摘要與畢業標籤，不直接定義人物頁的最終排版文案。
3. 兩邊共用的正式來源應收斂成三個共通物件：`dualLayerStats`、`profilePresentation`、`trainingProfile`。
4. `NurtureSession` 另有自己的 canonical chrome / support / risk 物件：`sessionInfo`、`supportPlan`、`riskPlan`；它們屬於培育頁專屬真相，不回灌成人物頁 tab 結構。
4. 扁平欄位仍可保留給現有 `UIContentBinder` / `GeneralDetailOverviewShell` 使用，但它們應視為 mapped summary，而不是 canonical source。

Unity 對照：這相當於把 `CharacterDetailViewModel` 與 `TrainingSessionViewModel` 的共用底層抽成一份 `CharacterGrowthContract`，避免兩個 Prefab 各自 hardcode 字串格式。

## 2. Canonical Contract 草稿

```json
{
  "dualLayerStats": {
    "str": {
      "talent": {
        "base": 98,
        "current": 100,
        "maxPotential": 108,
        "revelationLevel": "EXACT"
      },
      "prowess": 1688
    }
  },
  "profilePresentation": {
    "defaultTab": "Overview",
    "crestState": "revealed",
    "storyStripCells": {
      "origin": "...",
      "faction": "...",
      "role": "...",
      "awakening": "...",
      "bloodline": "...",
      "future": "..."
    }
  },
  "trainingProfile": {
    "sourceSessionId": "NS_0007",
    "phaseBlock": "MID",
    "mentorModeLabel": "TeachingOnly",
    "recommendedFocus": ["校場操練", "沙盤推演"],
    "graduationTags": ["前排突破", "長坂威吼"]
  },
  "sessionInfo": {
    "title": "培育行程",
    "subtitle": "第三學年 / 中盤磨合",
    "turnLabel": "第 13 回合"
  },
  "supportPlan": {
    "title": "支援窗口",
    "mentors": ["黃月英教官", "諸葛亮英靈"],
    "lineageBoundary": "英靈傳道屬教學支援，不會轉回血脈親傳"
  },
  "riskPlan": {
    "title": "風險提醒",
    "pressureTags": ["高壓事件", "疲勞累積"],
    "recoveryHint": "畫面只以戰術標籤與恢復提示呈現",
    "concealExactYield": true
  }
}
```

## 3. 欄位對映表

| Canonical source | GeneralDetailOverview 現行欄位 | NurtureSession 現行欄位 | 備註 |
|---|---|---|---|
| `dualLayerStats.*.talent.base/current/maxPotential/revelationLevel` | `coreStatsValue` 的摘要來源之一 | `sessionSummary`、`phaseBlockBody` 的揭露節奏來源 | 人物頁可顯示精確值；培育頁在 `TENDENCY/RANGE` 階段只顯示傾向或區間，不提前劇透。 |
| `dualLayerStats.*.prowess` | `coreStatsValue`、後續 rank 卡 | `mainCourseBody` 的收益目標參考 | `Prowess` 是培育定型結果，不得反向寫回 `Talent`。 |
| `profilePresentation.defaultTab` | overview 首頁路由 | 無直接欄位 | 由人物頁專用；NurtureSession 只需知道回流到 overview，不複製 tab 結構。 |
| `profilePresentation.crestState` | `crestState` | `phaseBlockBody` 可引用為覺醒進度語氣 | 命紋狀態仍以人物頁視覺為主；培育頁只借用語意，不接手徽記排版。 |
| `profilePresentation.storyStripCells.*` | `storyCells` | 無直接欄位 | 人物頁首頁固定故事帶的 canonical source。培育頁不維護 story strip。 |
| `trainingProfile.phaseBlock` | 可做人物頁補充摘要 | `phaseBlockTitle` | `BEGIN / MID / LATE / GRADUATION` 或等價階段值由培育端主控。 |
| `trainingProfile.mentorModeLabel` | 人物頁可顯示培育出處 | `mentorModeLabel` | 必須延續 `TeachingOnly` 邊界，不得混成血脈親傳。 |
| `trainingProfile.recommendedFocus[]` | 可映射到人物頁 `traitValue` / 推薦摘要 | `mainCourseBody` | 培育頁應保留可操作語氣；人物頁則只顯示結果導向摘要。 |
| `trainingProfile.graduationTags[]` | 人物頁次層摘要 / 延伸資訊 | `graduationTagsBody` | canonical source 應是陣列；現行 `graduationTagsBody` 只是 join 後的顯示字串。 |
| `sessionInfo.title/subtitle/turnLabel` | 無直接欄位 | `sessionTitle / sessionSubtitle / turnLabel` | 培育頁 chrome 的正式來源，避免標題列仍靠散落字串各自維護。 |
| `supportPlan.mentors[] / lineageBoundary` | 無直接欄位 | `supportWindowBody` | 支援窗口應由名單與邊界規則投影，不再直接手寫整段說明。 |
| `riskPlan.pressureTags[] / recoveryHint / concealExactYield` | 無直接欄位 | `riskWindowBody` | 風險提醒應由結構化風險標籤投影，而不是每次重寫整段警告文。 |

## 4. Mapper 規則草稿

1. `GeneralDetailOverviewMapper` 應先讀 canonical object，再產出扁平欄位：`coreStatsValue`、`traitValue`、`storyCells`。
2. `NurtureSessionMapper` 應優先讀 `sessionInfo + trainingProfile + dualLayerStats + supportPlan + riskPlan`，再產出 `sessionSummary`、`phaseBlockBody`、`mainCourseBody`、`supportWindowBody`、`riskWindowBody`、`graduationTagsBody`。
3. `storyCells` 與 `graduationTagsBody` 都屬顯示層投影，不得作為回寫資料來源。
4. 若 canonical object 與扁平欄位同時存在，runtime 以 canonical object 為主，扁平欄位視為 backward compatibility。

## 5. 建議後續實作

1. 在 `GeneralDetailOverviewContentState` 正式保留 `dualLayerStats / profilePresentation / trainingProfile`。
2. 補一個 `NurtureSessionMapper.ts`，讓 `nurture-session-states-v1.json` 以 canonical object 為主，扁平欄位改由 runtime 投影。
3. 等 `NurtureSession` 需要更深的培育畫面時，再把 `graduationTagsBody` 升格為陣列 contract，而不是延續單字串 join。