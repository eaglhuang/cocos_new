# 任務：battle-ui-p1-capture-toolbar-clip

## frontmatter
```yaml
id: battle-ui-p1-capture-toolbar-clip
status: done
priority: P1
area: qa-tooling / capture
started_at: "2026-04-01"
started_by_agent: "Copilot-Agent"
```

## 問題描述
截圖最上方包含 Cocos Editor 工具列（設計分辨率 / Rotate / Debug Mode / FPS 60 / Pause），
干擾 UI 比對。headless capture 沒有 clip 排除工具列高度（約 30px）。

## 接受條件
- 截圖不再包含編輯器工具列
- 遊戲畫面佔滿截圖

## 修改位置
- tools_node/capture-ui-screens.js (captureOne 函式的 page.screenshot 呼叫)

## 完成記錄
- [ ] 加 clip: { x:0, y:30, width:1920, height:1050 }
- [ ] 重截圖確認工具列消失