<!-- doc_id: doc_task_0207 -->
# battle-ui-p1-tally-card-art-troops-fix

## frontmatter
```yaml
id: battle-ui-p1-tally-card-art-troops-fix
status: done
priority: P1
area: battle-ui / tiger-tally
started_at: "2026-04-20"
started_by_agent: "Copilot"
```

## 目的
把虎符卡片中間的卡圖從 `tally_card_art_*_formal` 武器剪影，改回正確的部隊主視覺 `ui/tiger-tally/card-art/troops`，讓 002 的卡面表現靠近 001 的正確樣子。

## 驗收
- [x] `BattleSceneLoader.buildTallyCards()` 的 `artResource` 改為 `ui/tiger-tally/card-art/troops`
- [x] `TigerTallyComposite` / `TigerTallyPanel` 會吃到正確的 troop 卡圖
- [x] 不需要另外生成圖片，因為專案內已經有 `assets/resources/ui/tiger-tally/card-art/troops.png`

## notes
- 2026-04-20 | done | root cause 是卡資料填入了 formal 剪影圖，非布局問題
- 2026-04-20 | done | 已驗證 `troops.png` 就是 001 的那張兵團主視覺
