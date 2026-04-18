<!-- doc_id: doc_task_0148 -->
# 任務卡 — battle-ui-p1-unit-type-badge

## frontmatter
```yaml
id: battle-ui-p1-unit-type-badge
status: not-started
priority: P1
area: battle-ui
started_at: ~
started_by_agent: ~
depends: ~
```

## 摘要

虎符卡片列（Zone 3）目前缺少 **v3-3 規格要求的兵種符號徽章（UnitTypeBadge）**。
每張卡片左下角應顯示一個 32×32 圓形徽章，內含兵種符號（emoji 或 icon）
與兵種專屬色，幫助玩家快速識別部隊類型。

## 規格（v3-3）

```
子節點：UnitTypeBadge
Widget: bottom: 4px, left: 4px
尺寸：32×32px 圓形
背景：rgba(0, 0, 0, 0.7) 圓形遮罩

兵種符號表：
  騎兵 🐴  → 顏色 #D4AF37（金）
  步兵 ⚔   → 顏色 #3A8FD9（藍）
  弓兵 🏹  → 顏色 #9b6dff（紫）
  盾兵 🛡  → 顏色 #888888（灰）
  槍兵 🔱  → 顏色 #2ecc71（綠）
```

完整卡片子節點結構（v3 彙整）：
```
TigerTallyCard
├── ArtBackground
├── RarityBorder
├── StatsOverlay
├── UnitTypeBadge   ← 此次新增
├── UnitName
├── CostBadge
└── DisabledMask
```

## 驗收條件

- [ ] 每張虎符卡片左下角顯示對應兵種符號徽章
- [ ] 徽章圓形背景為半透明黑底（rgba(0,0,0,0.7)）
- [ ] 符號顏色依兵種正確套用（5 種兵種各異）
- [ ] 不同稀有度卡片上的徽章位置一致（不被 RarityBorder 遮擋）
- [ ] 手機尺寸（高度 ≤ 720px）與 Web 尺寸（高度 > 720px）均正常顯示
- [ ] QA 截圖驗收

## 影響檔案

- `assets/scripts/ui/components/TigerTallyPanel.ts`（主要修改）
- `assets/resources/ui-spec/layouts/tiger-tally-main.json`（或卡片子 layout JSON）
- 可能需要新增 emoji/icon 的 bitmap font 或 sprite atlas

## 規格來源

- `docs/主戰場UI規格補充_v3.md (doc_ui_0003)` (doc_ui_0003) §Zone 3（v3-3）
- `docs/主戰場UI規格書.md (doc_ui_0001)` (doc_ui_0001) §2.2（虎符卡片列）

## 修法方向

1. 讀取 `TigerTallyPanel.ts` 確認卡片建構邏輯位置（`buildCard()` 或類似方法）。
2. 在卡片建構末段新增 `UnitTypeBadge` 子節點：
   - 掛 `UITransform` 設 32×32
   - 掛 `Widget` 設 `bottom: 4px, left: 4px`
   - 畫圓形背景（`Graphics` 或透明圓形 sprite）
   - 加 `Label` 顯示 emoji，`fontSize: 16`，顏色依兵種
3. 兵種 → 符號 / 顏色的映射以常數表管理，避免 magic string。

## notes

> （由執行 Agent 填入開工/進度/驗收紀錄）
