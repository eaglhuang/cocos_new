# 任務卡 — battle-ui-p1-ultimate-select-popup

## frontmatter
```yaml
id: battle-ui-p1-ultimate-select-popup
status: not-started
priority: P1
area: battle-ui
started_at: ~
started_by_agent: ~
depends: ~
```

## 摘要

規格 **v3-6** 要求：當主將 SP 槽滿時，點擊奧義大按鈕（UltimateBtn）
應彈出**奧義選擇小窗（UltimateSelectPopup）**，讓玩家從多個奧義技能中選擇一個發動。

目前 `ActionCommandPanel.ts` 已有 UltimateBtn，但**尚無 UltimateSelectPopup 元件**，
SP 滿後點擊按鈕直接觸發（單招設計），不符合 v3-6 多招選擇需求。

## 規格（v3-6）

```
觸發：SP 槽已滿 + 點擊奧義大按鈕（UltimateBtn）
位置：奧義按鈕「正上方向上展開」

尺寸：
  寬：220px
  高：自適應 = (奧義數 × 56px) + padding(16px top + 16px bottom)

每個技能項目（200×48px）：
  - 左側：icon（32×32px）
  - 中央：技能名稱（fontSize 16）
  - 右側：SP 消耗數字（fontSize 14，顏色 #7ec8f7）

行為：
  - 點擊一項 → 觸發對應奧義 → 小窗關閉 → SP 扣除
  - 點擊小窗外區域 → 關閉不發動（取消）
  - 若主將只有 1 個奧義，仍彈出小窗（確認步驟，保持一致流程）

SP 未滿時：奧義按鈕不可點擊（disabled 狀態，暗環色 #3A8FD9）
```

## 驗收條件

- [ ] SP 滿時點擊 UltimateBtn → `UltimateSelectPopup` 在按鈕正上方展開
- [ ] 小窗依奧義技能數量自適應高度
- [ ] 每個技能項目顯示 icon + 名稱 + SP 消耗
- [ ] 點擊某技能 → 觸發奧義事件 → 小窗關閉
- [ ] 點擊小窗外區域 → 取消，小窗關閉，SP 不扣除
- [ ] SP 未滿時 UltimateBtn 不觸發彈窗
- [ ] QA 截圖驗收（展開狀態、多技能版）

## 影響檔案

- `assets/scripts/ui/components/ActionCommandPanel.ts`（整合彈窗觸發邏輯）
- `assets/scripts/ui/components/UltimateSelectPopup.ts`（**新建**）
- `assets/resources/ui-spec/layouts/ultimate-select-popup-main.json`（**新建**，可選）
- `assets/resources/ui-spec/skins/ultimate-select-popup-default.json`（**新建**，可選）

## 規格來源

- `docs/主戰場UI規格書.md` §2.4（右下角：核心操作區）、§4.4（UltimateSelectPopup）
- `docs/主戰場UI規格補充_v3.md` §v3-1、§v3-6、Zone 7

## 修法方向

**Step 1**：建立 `UltimateSelectPopup.ts`（繼承 `UIPreviewBuilder` 或獨立 Component），
實作 `show(skills: UltimateSkillData[])` 與 `hide()` 方法。

**Step 2**：在 `ActionCommandPanel.ts` 的 UltimateBtn 點擊回調中，
判斷 SP 是否已滿，若是則呼叫 `UltimateSelectPopup.show(skills)`。

**Step 3**：小窗位置：取 UltimateBtn 在 Canvas 中的世界座標，
設定小窗 `position.y = btnWorldPos.y + btnHeight/2 + popupHeight/2 + 8`。

**Step 4**：背景遮罩（`BgOverlay`）覆蓋全螢幕但透明，click 觸發 `hide()`。

**資料介面建議**：
```typescript
interface UltimateSkillData {
    id:        string;    // 技能 ID
    name:      string;    // 顯示名稱
    spCost:    number;    // SP 消耗
    iconPath?: string;    // sprite 路徑（可選）
}
```

## notes

> （由執行 Agent 填入開工/進度/驗收紀錄）
