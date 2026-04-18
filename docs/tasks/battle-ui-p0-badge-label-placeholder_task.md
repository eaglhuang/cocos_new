<!-- doc_id: doc_task_0137 -->
# 任務：battle-ui-p0-badge-label-placeholder

## frontmatter
```yaml
id: battle-ui-p0-badge-label-placeholder
status: done
priority: P0
area: battle-ui / UnitRenderer
started_at: "2026-04-01"
started_by_agent: "Copilot-Agent"
```

## 問題描述
截圖確認：UnitRenderer 的 badge overlay 底排 bottomNameLabel 顯示為 "label" 文字，
而非空字串或正確兵種名稱。
原因：buildBadge() 建立 nameStrLabel 後未顯式設定 string = ""，
Cocos Creator Label 元件的默認字串為 "label"。

## 接受條件
- 戰場不再出現懸浮 "label" 文字
- bottomNameLabel 在未設值前顯示空字串
- 帶有兵種名稱的格子可正常顯示兵種名

## 修改位置
- assets/scripts/battle/views/UnitRenderer.ts (buildBadge)

## 完成記錄
- [ ] 修改 buildBadge() 加 nameStrLabel.string = ""
- [ ] 重截圖確認消失