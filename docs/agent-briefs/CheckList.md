# Agent Briefs CheckList

本表是任務卡總覽。狀態更新時，必須同步修改：
- 任務卡本身
- [ui-quality-todo.json](C:\Users\User\3KLife\docs\ui-quality-todo.json)
- 本檔

共通硬規則以 [keep.md](C:\Users\User\3KLife\docs\keep.md) 為準。

## 執行前檢查

1. 這次工作是否已有任務卡。
2. 若沒有，而且不是小錯字或一次性查詢，先開卡。
3. 若決定開始做，先鎖卡：`status=in-progress`、補 `started_at` / `started_by_agent`、更新 `notes`。
4. 若是 bug 修復，可以先做最小修補，但仍要保留可追蹤性與單一問題範圍。
5. 若範圍擴大，先更新 `related / depends / notes`，必要時補開新卡。
6. 準備 commit 前，確認這批變更能對回單一卡號、單一主題或單一 bug。

## UI 視覺介面系統

| 優先級 | 卡號 | 簡單描述 | 狀態 | 完成度% | 負責 Agent |
|---|---|---|---|---|---|
| P0 | [UI-1-0001](tasks/UI-1-0001.md) | 搬遷 `nav_ink` 按鈕 family 至 runtime 路徑 | done | 100% | Agent2 |
| P0 | [UI-1-0002](tasks/UI-1-0002.md) | 搬遷 `paper_utility` 按鈕 family 至 runtime 路徑 | done | 100% | Agent2 |
| P0 | [UI-1-0003](tasks/UI-1-0003.md) | 搬遷 `warning` 按鈕 family 至 runtime 路徑 | done | 100% | Agent2 |
| P0 | [UI-1-0004](tasks/UI-1-0004.md) | 產生共用 shadow 與 noise 紋理 | done | 100% | Agent2 |
| P0 | [UI-2-0001](tasks/UI-2-0001.md) | 更新 `lobby-main-default` skin 指向 `nav_ink` | done | 100% | Agent1 |
| P0 | [UI-2-0002](tasks/UI-2-0002.md) | 更新 `duel-challenge-default` skin 指向 `paper_utility` | done | 100% | Agent1 |
| P0 | [UI-2-0021](tasks/UI-2-0021.md) | 修復 PreviewInEditor 的 SpriteFrame 路徑解析 | done | 100% | Agent1 |
| P1 | [UI-2-0003](tasks/UI-2-0003.md) | 新增 parchment 系列 design token | done | 100% | Agent1 |
| P1 | [UI-2-0004](tasks/UI-2-0004.md) | 新增淺底專用 label-style 變體 | done | 100% | Agent1 |
| P1 | [UI-2-0006](tasks/UI-2-0006.md) | 驗證 shared button family 的 border 20px 規範 | done | 100% | Agent1 |
| P1 | [UI-2-0007](tasks/UI-2-0007.md) | 為多個 skin 補上 shadow slot 定義 | done | 100% | Agent1 |
| P1 | [UI-2-0008](tasks/UI-2-0008.md) | 建立 item-cell 標準 skin fragment | done | 100% | Agent1 |
| P1 | [UI-2-0009](tasks/UI-2-0009.md) | 建立 common-parchment skin fragment | done | 100% | Agent1 |
| P1 | [UI-2-0010](tasks/UI-2-0010.md) | 為 `UIPreviewBuilder` 加入 shadow layer 渲染 | done | 100% | Agent1 |
| P1 | [UI-2-0011](tasks/UI-2-0011.md) | 為 `UIPreviewBuilder` 加入 noise overlay | done | 100% | Agent1 |
| P1 | [UI-2-0012](tasks/UI-2-0012.md) | `duel.btn.accept` 對齊 `equipment.primary` | done | 100% | Agent1 |
| P1 | [UI-2-0013](tasks/UI-2-0013.md) | lobby / popup / duel 首批 skin 補 shadow slot | done | 100% | Agent1 |
| P1 | [UI-2-0014](tasks/UI-2-0014.md) | general / support / shop / gacha 群組補 shadow slot | done | 100% | Agent1 |
| P1 | [UI-2-0015](tasks/UI-2-0015.md) | battle / system 群組補 shadow slot | done | 100% | Agent1 |
| P1 | [UI-2-0016](tasks/UI-2-0016.md) | 補齊 popup / Layout / legacy shadow 覆蓋 | done | 100% | Agent1 |
| P1 | [UI-2-0017](tasks/UI-2-0017.md) | 修補 general-detail bleed slot 缺失 | done | 100% | Agent1 |
| P1 | [UI-2-0018](tasks/UI-2-0018.md) | 補上 screen-driven preview harness | done | 100% | Agent1 |
| P1 | [UI-2-0019](tasks/UI-2-0019.md) | 對齊 D-2 QA 目標與 target family | done | 100% | Agent1 |
| P1 | [UI-2-0020](tasks/UI-2-0020.md) | 補上 shared light-surface carrier | done | 100% | Agent1 |
| P1 | [UI-2-0022](tasks/UI-2-0022.md) | `general-list` 升級正式九宮格皮膚 | done | 100% | Agent1 |
| P1 | [UI-2-0023](tasks/UI-2-0023.md) | 完成 headless preview screenshot 流程 | done | 100% | Agent1 |
| P1 | [UI-2-0024](tasks/UI-2-0024.md) | 拆分 `UIPreviewBuilder.ts` 降低風險 | completed | 100% | Agent1 |
| P1 | [UI-2-0025](tasks/UI-2-0025.md) | 對齊 `Gacha` preview contract | done | 100% | Agent1 |
| P1 | [UI-1-0005](tasks/UI-1-0005.md) | 產生水平 Tab active/inactive sprites | done | 100% | Agent2 |
| P1 | [UI-1-0006](tasks/UI-1-0006.md) | 產生 bleed overlay sprites | done | 100% | Agent2 |
| P1 | [UI-1-0007](tasks/UI-1-0007.md) | 產生 dark_metal frame/fill/bg sprites | done | 100% | Agent2 |
| P1 | [UI-1-0008](tasks/UI-1-0008.md) | 產生 circle_icon sprites | done | 100% | Agent2 |
| P1 | [UI-1-0010](tasks/UI-1-0010.md) | 產生 badge sprites | done | 100% | Agent2 |
| P1 | [UI-1-0011](tasks/UI-1-0011.md) | 產生 gold_cta frame/fill/bg sprites | done | 100% | Agent2 |
| P1 | [UI-1-0012](tasks/UI-1-0012.md) | 建立 `validate-skin-contracts.js` | done | 100% | Agent2 |
| P1 | [UI-1-0013](tasks/UI-1-0013.md) | 建立 frame sprite 金色邊緣掃描 | done | 100% | Agent2 |
| P1 | [UI-1-0014](tasks/UI-1-0014.md) | `LobbyMain` 正式截圖與 notes 回填 | in-progress | 20% | Agent2 |
| P1 | [UI-1-0015](tasks/UI-1-0015.md) | `ShopMain/Gacha` 正式比較與 notes 回填 | in-progress | 70% | Agent2 |
| P1 | [UI-1-0016](tasks/UI-1-0016.md) | `DuelChallenge` mixed-family QA | in-progress | 40% | Agent2 |
| P2 | [UI-2-0005](tasks/UI-2-0005.md) | button-skin 新增 selected 第四態 | done | 100% | Agent1 |
| P2 | [UI-1-0009](tasks/UI-1-0009.md) | 產生 diamond_tab sprites | done | 100% | Agent2 |

## 依賴維護原則

- 依賴的單一真相仍是 [ui-quality-todo.json](C:\Users\User\3KLife\docs\ui-quality-todo.json) 與各任務卡。
- 本檔只保留總覽，不再複製過長的依賴敘事。
- 若新增 blocker 或前後置關係，請同步更新任務卡與 manifest。

## 更新流程

1. 更新任務卡 frontmatter 與 notes。
2. 更新 [ui-quality-todo.json](C:\Users\User\3KLife\docs\ui-quality-todo.json)。
3. 更新本表狀態。
4. 若要正式 commit，確認 commit message 已帶任務卡號與 Agent 標籤。
5. 若是 bug commit，確認 message 也寫了系統代碼、問題描述與修改描述。

## 鎖卡最小欄位

- `status: in-progress`
- `started_at: <RFC3339>`
- `started_by_agent: AgentX`
- `notes` 第一筆寫開始時間、目前處理範圍與是否有 blocker
