<!-- doc_id: doc_task_0138 -->
# 任務卡 — battle-ui-p0-battle-hud-timing-fix

## frontmatter
```yaml
id: battle-ui-p0-battle-hud-timing-fix
status: done
priority: P0
area: battle-ui / runtime
started_at: "2026-04-01"
started_by_agent: "Copilot-Agent1"
done_at: "2026-04-01"
```

## 摘要

`BattleHUD.onLoad()` 與 `BattleScene.start()` 之間存在**時序競爭條件（Race Condition）**：

- `BattleHUD.onLoad()` 以非同步方式呼叫 `_initialize()` → `buildScreen()`，
  但**不 await**，直接繼續執行後續初始化（`_subscribeEvents`）。
- `BattleScene.start()` 在啟動時呼叫 `battleHUD.refresh()`，
  但此時 `buildScreen()` 尚未完成，`_initialized = false`，
  節點引用（`_turnLabel`、`_foodLabel`、`_playerFortressBar` 等）仍為 null，
  導致**首幀 HUD 數值（回合數、糧草、HP 條）不顯示**。

Log 中有對應 warning：
```
[BattleHUD] refresh() 在初始化完成前被呼叫 — 數值可能無法顯示
```

## 根源定位

| 位置 | 現況 | 問題 |
|---|---|---|
| `BattleHUD.onLoad()` | `this._initialize()` 未 await | buildScreen 非同步，後續綁定尚未完成 |
| `BattleHUD.refresh()` | 先檢查 `_initialized` 但直接 return | 初始化完成前呼叫的 refresh 結果被靜默丟棄 |
| `BattleScene.start()` | 直接同步呼叫 `this.battleHUD?.refresh()` | 不知道 HUD 尚未建構完成 |

## 驗收條件

- [ ] 遊戲啟動後首幀即正確顯示「第 1 回合」、糧草數值、雙方陣地 HP 條
- [ ] Log 中不再出現「refresh() 在初始化完成前被呼叫」warning
- [ ] `BattleScene.start()` 完成後才呼叫 `refresh()`，或 HUD 在 `onBuildComplete` 後主動刷新初始值

## 影響檔案

- `assets/scripts/ui/components/BattleHUD.ts`
- `assets/scripts/battle/views/BattleScene.ts`（或持有呼叫 refresh 的上層）

## 規格來源

- `docs/主戰場UI規格書.md (doc_ui_0001)` (doc_ui_0001) §2.1（頂部資訊 HUD）
- `docs/主戰場UI規格補充_v3.md (doc_ui_0003)` (doc_ui_0003) Zone 1

## 修法方向

**方案 A（推薦）**：在 `BattleHUD.onBuildComplete()` 結束後主動呼叫一次 `refresh()`，
讓 HUD 自己負責在就緒後刷新，不依賴外部呼叫時序。

```typescript
protected onBuildComplete(_rootNode: Node): void {
    // ... 現有節點綁定邏輯 ...

    // 建構完成後主動刷新一次，抹除時序競爭
    this._refreshInternal();
}
```

**方案 B（備選）**：`BattleScene.start()` 改為 `async`，`await` BattleHUD 的就緒 Promise
後再呼叫 `refresh()`。

## notes

> （由執行 Agent 填入開工/進度/驗收紀錄）
