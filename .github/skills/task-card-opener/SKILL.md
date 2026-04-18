---
doc_id: doc_agentskill_0026
name: task-card-opener
description: '通用任務開單器 SKILL — 統一建立或回寫 Markdown task card、docs/tasks/tasks-*.json 分片、UI quality shard，並強制遵守 docs/agent-briefs/Readme.md (doc_ai_0023) 與 docs/遊戲規格文件/系統規格書/名詞定義文件.md (doc_spec_0008) 的硬規則。USE FOR: 開任務卡、開單、task card、task shard、tasks-ui.json、tasks-prog.json、tasks-dc.json、tasks-data.json、agent-briefs/tasks、docs/tasks/*_task.md、UI pipeline 開卡。DO NOT USE FOR: 純 runtime 除錯、單純修改既有功能碼但不需要新卡、只做極小 typo 修補。'
argument-hint: '提供 task 類別、目標系統、是否需要 Markdown 卡、對應 task id 前綴、owner/priority/status，以及是否屬於 UI 任務。'
---

<!-- 主版本位於 .agents/skills/task-card-opener/SKILL.md；此檔作為 GitHub Copilot 技能載入入口。 -->

# Task Card Opener（鏡像索引）

這個 skill 用來把專案中的任務開單流程統一收斂到同一套規則：

1. 所有 Markdown 任務卡都要遵守 `docs/agent-briefs/Readme.md (doc_ai_0023)`
2. `docs/tasks/tasks-*.json` 分片仍是分類任務真相來源
3. UI task shard 仍要在更新後執行 `node tools_node/build-ui-task-manifest.js`
4. `ui-vibe-pipeline` 等 workflow 要委派本 skill 開卡，不再各自發展平行規則
5. 任務卡 ID / 卡號 / 系統代碼一律以 `docs/遊戲規格文件/系統規格書/名詞定義文件.md (doc_spec_0008)` 為唯一來源

## CLI compiler

對應的可執行工具是 `tools_node/task-card-opener.js`。它支援：

1. 直接從參數產出 Markdown 任務卡與 JSON skeleton / aggregate
2. 透過 `--recipe` 相容既有 UCUF recipe compiler

常用例子：

```bash
node tools_node/task-card-opener.js --id BAT-1-0001 --title "BattleController 驗證補強" --owner Copilot --priority P1 --md-out docs/agent-briefs/tasks/BAT-1-0001.md --json-out docs/tasks/tasks-prog.json --write
node tools_node/task-card-opener.js --id UI-1-0001 --title "UI quality shard" --md-out docs/agent-briefs/tasks/UI-1-0001.md --json-out docs/ui-quality-tasks/UI-1-0001.json --json-kind ui-quality-task-shard --write
node tools_node/task-card-opener.js --recipe artifacts/ui-source/example/generated/example-screen.recipe.json --write --out artifacts/ui-source/example/generated/example-task-card.md --shard-out artifacts/ui-source/example/generated/example-task-shard.json
```

完整 SOP 請讀：

`.agents/skills/task-card-opener/SKILL.md`