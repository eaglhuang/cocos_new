# Keep Consensus 摘要

> 本檔是 `docs/keep.md` 的精簡索引。Agent pre-flight 預設讀本檔；需要修改共識時才讀全文。
> 更新日期: 2026-04-06

## P0. Agent Context Budget
- 最高優先級：防止 Agent 上下文暴增。警戒線 6k/18k/30k tokens。
- 禁止整份讀入 keep.md / ui-quality-todo.json / cross-reference-index.md / 大型 notes / 批次圖片。
- 三大重量文件已拆成分片目錄，按需讀對應分片：
  - `docs/keep-shards/keep-core.md` / `keep-workflow.md` / `keep-ui-arch.md` / `keep-status.md`
  - `docs/tasks/tasks-ui.json` / `tasks-prog.json` / `tasks-dc.json`
  - `docs/cross-ref/cross-ref-specs.md` / `cross-ref-code.md` / `cross-ref-ui-spec.md`
- 維護分片工具：`node tools_node/shard-manager.js rebuild-index <shardDir>`
- 詳見 → `docs/agent-context-budget.md`

## §0. UI 任務 Shard 入口
- 新任務走 `docs/ui-quality-tasks/*.json` shard，不直接改 aggregate manifest。
- 生成器：`node tools_node/build-ui-task-manifest.js`

## §1. 專案基準
- 3KLife / Cocos Creator 3.8.8 / TypeScript ES2015 / Web+Android+iOS / UI 量產期

## §2. Pre-flight
- 先讀本摘要 → 繁體中文 → 新決策補回 keep → 規格異動回寫母規格 → 同步交叉索引

## §2b. 工具安全
- ❌ `get_changed_files` → 用 `git status --short`
- 詳見 → `.github/instructions/token-guard.instructions.md`

## §3–§4. Cocos 工作流 / 編碼防災
- Editor 入口 localhost:7456 / 不手改 library、temp、profiles
- UTF-8 without BOM / 修改後跑 `check-encoding-touched.js`

## §5. 任務卡協作
- 開工先鎖卡 / handoff 用摘要卡 / 多 Agent 不同時改高風險檔

## §7. UI 契約
- 三層 JSON（layouts / skins / screens）/ Design Token 引用制 / 禁止 hex 硬編碼

## §8–§9. Template 架構 / 量產協作
- Template-first 原則 / 家族：detail-split、dialog-card、rail-list
- 美術先選 family → wireframe → slot-map → screen-specific 強化

## §10–§12. Figma 量產線 / Skeleton 入口 / Proof Mapping
- `tools_node/scaffold-ui-spec-family.js` / familyId kebab-case
