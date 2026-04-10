# Keep Consensus 摘要

> 本檔是 `docs/keep.md` 的精簡索引。Agent pre-flight 預設讀本檔；需要修改共識時才讀全文。
> 更新日期: 2026-04-08

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
- 核心 `rarityTier` 與商業 `commercial band` 分離：平衡真相只看 core tier，商業卡面 / 招牌 / 限定一律走衍生規則
- **公式層平衡原則**：遊戲平衡透過戰鬥/生產/政務公式實現（指數壓縮 or 加權組合），不直接截斷基本屬性；基本屬性維持歷史語意正確性
- **資料生命周期收斂原則**：史實武將永久保留；動態後裔死亡後優先轉 `SpiritCard` + 血脈摘要，完整主體移入待刪區；AI/自動繁殖後裔必須受生育配額、支系壓縮與季結 GC 控制，避免單機長局資料無限膨脹

## §2b. 工具安全
- ❌ `get_changed_files` → 用 `git status --short`
- 詳見 → `.github/instructions/token-guard.instructions.md`

## §3–§4. Cocos 工作流 / 編碼防災
- Editor 入口 localhost:7456 / 不手改 library、temp、profiles
- UTF-8 without BOM / 修改後跑 `check-encoding-touched.js`
- `LoadingScene` preview hub 新增 `previewVariant` 子狀態路由；`Gacha` 已支援 `hero / support / limited`

## §5. 任務卡協作
- 開工先鎖卡 / handoff 用摘要卡 / 多 Agent 不同時改高風險檔

## §7. UI 契約
- 三層 JSON（layouts / skins / screens）/ Design Token 引用制 / 禁止 hex 硬編碼
- 共用 header / rarity 路線：`header-rarity-plaque` + `UIRarityMarkVisual` + `UIPreviewStateApplicator`
- BattleScene 常態 HUD 固定走 `deep-ink battlefield + cold tactical HUD + gold CTA`；這是全域 UI 美術系統在戰場場景下的戰術化變體，不跟全景地圖的晨昏 / 天氣色調綁定；禁止把人物頁 / 轉蛋頁的 plaque、medallion、parchment 商業語言搬回主戰場
- **元件幾何行為**: 六類（FX/SS/SR/TR/LC/DI）+ Title 二分 A/B 型。完整矩陣 → `docs/ui/component-sizing-contract.md`
- **所有 screen spec / task card 必須有 Component Sizing Table**（含明確 W×H 數值）才算規格齊備
- Title Type A（FX，不開 cap）/ Type B（SS，cap+band+fill）；建立 spec 時先判類型再委託美術
- Icon 若採 `underlay + glyph`，`80%` 一律指 glyph 的 `logical box` 佔底板有效承載區 **80%**，不是 `alpha bounds`；runtime 要變大變小請縮整體成品，不回頭改 family 基準

## §8–§9. Template 架構 / 量產協作
- Template-first 原則 / 家族：detail-split、dialog-card、rail-list
- 美術先選 family → wireframe → slot-map → screen-specific 強化
- `artifacts/ui-library/` 是正式的「非打包 UI 圖庫層」：生產中但值得保留重用的候選素材先放這裡，不可被 runtime 直接引用
- 正式遊戲資產必須與圖庫分層；只有 accepted / 正式挑選中的素材，才可透過 `tools_node/promote-ui-library-asset.js` 升格到 canonical runtime path
- 這條分層規則的目的，是避免專案後期在 runtime 資產目錄堆滿過期版、測試版與 screen 專用複本，導致無法乾淨清理

## §10–§12. Figma 量產線 / Skeleton 入口 / Proof Mapping
- `tools_node/scaffold-ui-spec-family.js` / familyId kebab-case

## P0b. Image View Guard

- `view_image` 一律先走 thumbnail-first progressive zoom：先試 `125px`，看得見就不准放大。
- 若 `125px` 不足，才允許依序放大到 `250px`、再到 `500px`；不得直接跳大圖。
- Browser / Editor / compare board / PrintWindow 截圖，一律先裁主區域，再套用同一套 `125 -> 250 -> 500` 規則。
- 先跑 `node tools_node/prepare-view-image.js --input <path>`；helper 現在預設就是 `125px`，只有在看不清時才重跑較大的 `--maxWidth`。
- 若不想手記數字，改用 `node tools_node/prepare-view-image-progressive.js --input <path> --level thumb|inspect|detail`；若從既有 preview 繼續升級，需搭配 `--next --source <original-path>`。
- 只有在使用者明確表示放開原圖限制時，才可查看 `>500px` 的原圖。
