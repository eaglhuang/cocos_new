# 任務：battle-ui-p1-hp-bar-visual

## frontmatter
```yaml
id: battle-ui-p1-hp-bar-visual
status: in-progress
priority: P1
area: battle-ui / HUD
started_at: "2026-04-01"
started_by_agent: "Copilot-Agent"
```

## 問題描述
截圖確認：陣地 HP 僅以純色文字「1000 / 1000」呈現，缺乏視覺進度條。
skin JSON 已定義 hud.bar.hp / hud.bar.hp.enemy 的 sprite 路徑，
但 UIPreviewBuilder 對 image 類型節點沒有實作進度比例裁切，
改以 scaleX 方式呈現進度。

## 接受條件
- 左側藍色進度條（我軍）顯示正確比例
- 右側紅色進度條（敵軍）顯示正確比例
- BattleHUD.setFortressHp 能驅動進度條寬度

## 修改位置
- assets/scripts/ui/components/BattleHUD.ts (setFortressHp / 血條 scaleX)
- assets/resources/ui-spec/layouts/battle-hud-main.json (bar 節點型別確認)

## 完成記錄
- [ ] BattleHUD 用 scaleX 驅動血條
- [ ] 重截圖確認血條可視