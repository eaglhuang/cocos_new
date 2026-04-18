<!-- doc_id: doc_task_0144 -->
# 任務卡 — battle-ui-p1-general-quickview-interactable

## frontmatter
```yaml
id: battle-ui-p1-general-quickview-interactable
status: not-started
priority: P1
area: battle-ui
started_at: ~
started_by_agent: ~
depends: battle-ui-p0-battle-hud-timing-fix
```

## 摘要

規格 **v3-5** 要求 TopBar 上的「我方主將頭像」與「敵方主將頭像」可被點擊，
彈出 `GeneralQuickViewPanel`（320×400px，金色邊框）。

目前 `BattleHUD.onBuildComplete()` 雖然已嘗試綁定點擊事件：

```typescript
playerPortrait?.on(Button.EventType.CLICK, () => this._onPortraitClick('player'), this);
enemyPortrait?.on(Button.EventType.CLICK,  () => this._onPortraitClick('enemy'),  this);
```

但有兩個風險點尚待驗證：
1. `PlayerPortrait` / `EnemyPortrait` 節點上是否掛有 `Button` 組件
   （無 Button 則 Click 事件永遠不觸發）。
2. `GeneralQuickViewPanel` 是否已正確掛入場景並由事件驅動顯示。

`GeneralQuickViewPanel.ts` 已存在但整合狀態未驗收。

## 驗收條件

- [ ] 點擊 TopBar 我方主將頭像 → `GeneralQuickViewPanel` 彈出，顯示我方武將屬性
- [ ] 點擊 TopBar 敵方主將頭像 → `GeneralQuickViewPanel` 彈出，HP/攻/防顯示為「???」
- [ ] 彈窗尺寸：320×400px（手機全寬 90%）
- [ ] 樣式：圓角 12px，金色邊框
- [ ] 點擊彈窗外部區域或「×」按鈕 → 關閉彈窗
- [ ] 頭像 press 狀態：邊框亮度 +20%、縮放 105%
- [ ] Log 中無「找不到 PlayerPortrait 節點」warning
- [ ] QA 截圖驗收（我方版 + 敵方版）

## 影響檔案

- `assets/scripts/ui/components/BattleHUD.ts`（頭像點擊觸發）
- `assets/scripts/ui/components/GeneralQuickViewPanel.ts`（彈窗顯示邏輯）
- `assets/resources/ui-spec/layouts/battle-hud-main.json`（PlayerPortrait 節點需有 Button 欄位）
- `assets/resources/ui-spec/layouts/general-quickview-main.json`
- `assets/resources/ui-spec/skins/general-quickview-default.json`

## 規格來源

- `docs/主戰場UI規格書.md (doc_ui_0001)` (doc_ui_0001) §4.3（GeneralQuickView）
- `docs/主戰場UI規格補充_v3.md (doc_ui_0003)` (doc_ui_0003) §v3-5、Zone 1

## 修法方向

**Step 1**：讀取 `battle-hud-main.json`，確認 `PlayerPortrait` / `EnemyPortrait`
節點是否宣告 `"interactable": true` 或含 `Button` 型別。

**Step 2**：若未宣告，在 JSON 中補上 Button 型別，或在 `onBuildComplete` 中
手動 `node.addComponent(Button)` 並設定 `interactable = true`。

**Step 3**：確認場景中存在 `GeneralQuickViewPanel` 的節點實例，
且 `BattleHUD._onPortraitClick()` → `services().event.emit(ShowGeneralQuickView)` 鏈路通暢。

**Step 4**：驗收彈窗關閉（BgOverlay click + CloseBtn click）兩條路徑均可關閉。

## notes

> （由執行 Agent 填入開工/進度/驗收紀錄）
