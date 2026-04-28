<!-- doc_id: doc_index_0012 -->

> **2026-04-26 最新共識補充**：武將本體沒有傳統 `Level / EXP / 突破`。人物頁正式收斂為 `將 / 屬 / 命 / 技 / 寶 / 兵` 六頁：`將` 承接身份 / 天命週期 / 名聲官職 / 統領軍勢，`屬` 承接六色屬性與教官評價，`命` 承接 14 人祖先血統圖與英靈卡命槽，`技` 承接戰法習得狀態，`寶` 承接一般裝備 / 傳家寶 / 道具，`兵` 承接戰場適性與虎符槽。畢業後成長感由 `武將名聲 / 將階 / 帶兵上限` 承接；正式戰鬥模型改為 `人口 -> 城市兵源 -> 出征軍勢 -> 場上分隊`。初期戰鬥保底 `出征軍勢` 不低於 8,000，以保留召喚爽感；戰鬥中每次召喚 / 部署部隊都要同時扣 `出征軍勢` 與 `糧草`，部隊退場時返還剩餘兵力，戰損回扣城市兵源並由治理恢復。`戰備值 / Military_Readiness` 不再作為玩家主顯示資源，若保留只能作為後台摘要或舊欄位相容名。
# Keep Consensus 摘要

> 本檔是 `docs/keep.md (doc_index_0011)` (doc_index_0011) 的精簡索引。Agent pre-flight 預設讀本檔；需要修改共識時才讀全文。
> 更新日期: 2026-04-22

## P0. Agent Context Budget
- 最高優先級：防止 Agent 上下文暴增。警戒線 6k/18k/30k tokens。
- 禁止整份讀入 keep.md (doc_index_0011) / ui-quality-todo.json / cross-reference-index.md (doc_index_0005) / 大型 notes / 批次圖片。
- 三大重量文件已拆成分片目錄，按需讀對應分片：
  - `docs/keep-shards/keep-core.md (doc_index_0006)` (doc_index_0006) / `keep-workflow.md` (doc_index_0009) / `keep-ui-arch.md` (doc_index_0008) / `keep-status.md` (doc_index_0007)
  - `docs/tasks/tasks-ui.json` / `tasks-prog.json` / `tasks-dc.json`
  - `docs/cross-ref/cross-ref-specs.md (doc_index_0002)` (doc_index_0002) / `cross-ref-code.md` (doc_index_0001) / `cross-ref-ui-spec.md` (doc_index_0003)
- 維護分片工具：`node tools_node/shard-manager.js rebuild-index <shardDir>`
- 詳見 → `docs/agent-context-budget.md (doc_ai_0025)` (doc_ai_0025)

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
- **轉蛋池正式共識**：只保留 `三國名將池（含女性）` 與 `支援卡（教官）池` 兩種不同目的的池子；`英靈卡 / 虎符卡` 不入池，統一由名將死亡結算產出，退役只進教官 / 傳承路徑
- **名將生命週期 / 大廳 / AI 最新共識**：英靈卡門檻鎖為史實名將 + 女性名將；先退役後死亡仍補發雙卡；世家積分採個人存檔制；英靈卡與虎符卡可同角色同裝；死亡後英靈卡必須保留完整英勇事蹟、最終屬性與技能快照供家族展示列回看；官職升格獨立系統；反霸權聯盟對非霸主強制加入；天下大亂不回退世界沙盤解鎖；大廳自告奮勇為純彩蛋事件；`武將日誌與離線互動` 正式升格為獨立母規格，晨報 / 派遣 / 離線互動優先掛在大廳與人物頁入口，UI contract 先保留 pending；戰場部署正式採 `精銳上限 + AI 保留槽`；場景戰法情報門檻改為固定 `requiredIntelValue`；戰鬥修正採「兵種剋制先乘、地形 / 天氣 / 適性 / 場景百分點加總」；虎符品質統一以 `TigerTallyScore` 映射；挑戰賽採賽季鏡像快照與 soft reset；經濟補上地窖保護與每日補貼；世界沙盤 `S3 全球遠征` 以 `Expedition_Dossier / External_Power` 承接異域壓力，不要求所有外敵都走本土治理全套；`Peace_Lineage` 只是結緣模式標記，仍受 `Vigor / Pregnancy_Lock / Breeding_Cap` 約束；退役活體武將可先保種、轉成教官卡後即失去親傳資格；36 回合培育正式拆成三階段學年；關卡正式加入 `Strategist_HUD + Stage_Salvage` 摘要層；轉蛋雙池敘事固定為「名將池 = 血統種子、支援卡池 = 培育深度」；舊大綱中的虎符轉蛋提案不採納，仍維持死亡結算產卡
- **Inventory Service 正式共識**：道具 / 一般裝備 / 虎符資料層正式收斂成單一 `Inventory Service`；`PlayerInventory`、`GeneralEquipment`、`Talisman_Inventory` 改為同一服務下的分類投影。前端展示不得混成單一大背包，人物頁正式分流為 `命` 承接英靈卡、`寶 / GEAR` 承接一般裝備 / 傳家寶 / 道具、`兵 / Aptitude` 承接虎符與戰場適性。後續欄位與槽位規則先回寫 `武將裝備道具系統.md` 與 `Data Schema文件（本機端與Server端）.md`。

## §2b. 工具安全
- ❌ `get_changed_files` → 用 `git status --short`
- 詳見 → `.github/instructions/token-guard.instructions.md (doc_ai_0015)` (doc_ai_0015)

## §3–§4. Cocos 工作流 / 編碼防災
- Editor 入口 localhost:7456 / 不手改 library、temp、profiles
- UTF-8 without BOM / 修改後跑 `check-encoding-touched.js`
- `LoadingScene` preview hub 新增 `previewVariant` 子狀態路由；`Gacha` 已支援 `hero / support / limited`
- **日誌規範（§3.2）**：`assets/scripts/` 禁用裸 `console.log`，一律使用 `UCUFLogger`（`assets/scripts/ui/core/UCUFLogger.ts`）；Runtime 開關 `__ucuf_debug()` / `__ucuf_quiet()`；新 category 直接補 enum，不建新 log 模組
- **Fail-fast 準則（§3.3）**：開發期 / Editor / Preview / QA 預設不得輕易補 fallback；核心元件/節點/spec/資產缺失時優先 `throw` 或 `Error log` 讓流程中止。release-only guard 或 keep 明文批准者才可做 fallback。
- **根因優先修復（§3.3 補充）**：除非使用者明示批准，debug 不以「刪功能 / 關特效 / 降級視覺」作為預設解法；先追 lifecycle、資料流、資產契約等根因。若只能先止血，必須明確標記為暫時 workaround，並保留後續根因修復任務。
- **Transient FX 生命週期（§3.3 補充）**：所有綁在暫態節點上的 tween / schedule / async callback，遇到 `rebuild`、換場或 `onDestroy` 前必須顯式 `stop + dispose`；若仍偵測到失效 node，只能 `Error log` 後安全中止，不可讓 Preview / runtime 直接崩潰。

## §5. 任務卡協作
- 開工先鎖卡 / handoff 用摘要卡 / 多 Agent 不同時改高風險檔

## §7. UI 契約
- 三層 JSON（layouts / skins / screens）/ Design Token 引用制 / 禁止 hex 硬編碼
- 共用 header / rarity 路線：`header-rarity-plaque` + `UIRarityMarkVisual` + `UIPreviewStateApplicator`
- BattleScene 常態 HUD 固定走 `deep-ink battlefield + cold tactical HUD + gold CTA`；這是全域 UI 美術系統在戰場場景下的戰術化變體，不跟全景地圖的晨昏 / 天氣色調綁定；禁止把人物頁 / 轉蛋頁的 plaque、medallion、parchment 商業語言搬回主戰場
- **元件幾何行為**: 六類（FX/SS/SR/TR/LC/DI）+ Title 二分 A/B 型。完整矩陣 → `docs/ui/component-sizing-contract.md (doc_ui_0038)` (doc_ui_0038)
- **所有 screen spec / task card 必須有 Component Sizing Table**（含明確 W×H 數值）才算規格齊備
- Title Type A（FX，不開 cap）/ Type B（SS，cap+band+fill）；建立 spec 時先判類型再委託美術
- Icon 若採 `underlay + glyph`，`80%` 一律指 glyph 的 `logical box` 佔底板有效承載區 **80%**，不是 `alpha bounds`；runtime 要變大變小請縮整體成品，不回頭改 family 基準

## §8–§9. Template 架構 / 量產協作
- Template-first 原則 / 家族：detail-split、dialog-card、rail-list
- 美術先選 family → wireframe → slot-map → screen-specific 強化
- `artifacts/ui-library/` 是正式的「非打包 UI 圖庫層」：生產中但值得保留重用的候選素材先放這裡，不可被 runtime 直接引用
- 正式遊戲資產必須與圖庫分層；只有 accepted / 正式挑選中的素材，才可透過 `tools_node/promote-ui-library-asset.js` 升格到 canonical runtime path
- 這條分層規則的目的，是避免專案後期在 runtime 資產目錄堆滿過期版、測試版與 screen 專用複本，導致無法乾淨清理
 - 大型背景圖格式規則：所有會成為 runtime 的大尺寸背景（例如 `BackgroundFull`、整螢幕 backdrop 等）不得使用 PNG（PNG 常含 alpha 通道會造成不預期透底或混合）；正式上線/升級到 runtime 的大背景一律使用不含透明通道的 JPG（不透明）。若美術提供帶 alpha 的 PNG，請把該 PNG 保留在 `artifacts/ui-library/` 或 archive，並在升級流程中由美術或資產負責人轉檔為 JPG 再推到 runtime 路徑。

## §10–§12. Figma 量產線 / Skeleton 入口 / Proof Mapping
- `tools_node/scaffold-ui-spec-family.js` / familyId kebab-case

## P0b. Image View Guard

- `view_image` 一律先走 thumbnail-first progressive zoom：先試 `125px`，看得見就不准放大。
- 若 `125px` 不足，才允許依序放大到 `250px`、再到 `500px`；不得直接跳大圖。
- Browser / Editor / compare board / PrintWindow 截圖，一律先裁主區域，再套用同一套 `125 -> 250 -> 500` 規則。
- 先跑 `node tools_node/prepare-view-image.js --input <path>`；helper 現在預設就是 `125px`，只有在看不清時才重跑較大的 `--maxWidth`。
- 若不想手記數字，改用 `node tools_node/prepare-view-image-progressive.js --input <path> --level thumb|inspect|detail`；若從既有 preview 繼續升級，需搭配 `--next --source <original-path>`。
- 只有在使用者明確表示放開原圖限制時，才可查看 `>500px` 的原圖。

## §§ 文件代號系統（doc_id）
- 每個 `.md` 文件有唯一 `doc_id`（格式：`doc_<category>_<NNNN>`），文件移動後代號不變。
- 10 大類別：`tech / ui / art / data / spec / index / task / ai / agentskill / other`
- 注入位置：無 YAML frontmatter → 首行 `<!-- doc_id: doc_spec_0001 -->`；有 frontmatter → YAML 第一個 key
- 搜尋：`grep -r "doc_id: doc_spec_0001" docs/ .github/` 或 `node tools_node/resolve-doc-id.js doc_spec_0001`
- Registry：`docs/doc-id-registry.json`（機器可讀）/ `docs/doc-id-registry.md (doc_other_0001)` (doc_other_0001)（人可讀表格）
- 新增文件：`node tools_node/doc-id-registry.js --assign <path>`（自動分類、分配代號、注入）
