# keep-shards/

`docs/keep.md` 的拆分分片。每個分片約 150-200 行，避免整份 keep.md 一次塞入 context。

| 分片 | 章節 |
|------|------|
| keep-core.md | P0, §0–§2c（核心共識、工具安全、Skill 路由）|
| keep-workflow.md | §3–§6, §13（Cocos 流程、編碼、任務卡、Git、QA）|
| keep-ui-arch.md | §7–§12, §19, §23（UI 架構、模板、量產、MemoryManager）|
| keep-status.md | §14–§18（MCP、架構評估、UIManager、下一步）|

修改時注意：同步更新 `docs/keep.md`（stub 索引）與 `docs/keep.summary.md`。