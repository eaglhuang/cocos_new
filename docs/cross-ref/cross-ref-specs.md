# Cross-Reference: 規格書索引（文件 → 相關文件）

> 這是 cross-reference-index.md 的 A 節分片。完整索引見 `docs/cross-reference-index.md`。
> 最後更新請參考母檔 Header。

## A. 規格書索引（文件 → 相關文件）

> 只列出明確的依賴 / 引用關係，不列模糊的主題重疊。

### 核心基礎系統

| 規格書 | 被依賴（下游系統） | 依賴（上游系統） |
|---|---|---|
| 數值系統.md | 兵種（虎符）系統、武將系統、AI武將強度系統、戰場適性系統、戰場部署系統、轉職與宿命系統 | — |
| 武將系統.md | 轉職與宿命系統、傭兵系統（試用）、武將壽命系統、武將背包（倉庫）系統、俘虜處理系統、武將人物介面規格書.md | 數值系統、遊戲時間系統、名詞定義文件 |
| 名詞定義文件.md | 全系統（UID/Bloodline_ID/Gene/Status 統一定義） | — |

### 血統 + 因子系統族群

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 血統理論系統.md | 因子爆發系統、培育系統、結緣系統（配種）、同名武將系統、家族關係（史實相性）系統、兵種（虎符）系統、武將人物介面規格書.md、新手開場規格書.md、UI 規格書.md | — |
| 因子爆發系統.md | 戰法系統、戰場適性系統、因子解鎖系統、運氣系統、家族關係（史實相性）系統 | 血統理論系統 |
| 因子解鎖系統.md | 名士預言系統 | 因子爆發系統、培育系統 |
| 同名武將系統.md | 兵種（虎符）系統 | 血統理論系統、轉蛋系統 |
| 家族關係（史實相性）系統.md | — | 血統理論系統、因子爆發系統 |
| 運氣系統.md | — | 因子爆發系統 |

### 養成流水線

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 結緣系統（配種）.md | 可結緣女性來源系統 | 血統理論系統、因子爆發系統、名士預言系統、資源循環系統、武將壽命系統 |
| 培育系統.md | 戰法系統、教官系統（支援卡） | 因子爆發系統、因子解鎖系統、資源循環系統 |
| 教官系統（支援卡）.md | — | 培育系統、轉蛋系統、武將壽命系統、傭兵系統（試用） |
| 武將壽命系統.md | 結緣系統（配種）、教官系統（支援卡） | 遊戲時間系統、資源循環系統 |
| 轉蛋系統.md | 同名武將系統、教官系統（支援卡）、傭兵系統（試用） | 武將系統 |
| 轉職與宿命系統.md | 兵種（虎符）系統 | 數值系統、因子爆發系統、培育系統 |
| 奧義系統.md | — | 轉蛋系統、武將系統 |

### 戰場系統族群

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 戰場部署系統.md | 名將挑戰賽系統 | 經濟系統、兵種（虎符）系統、數值系統、武將戰績系統 |
| 兵種（虎符）系統.md | 戰場部署系統、名將挑戰賽系統、武將人物介面規格書.md | 轉職與宿命系統、戰法系統、血統理論系統、同名武將系統 |
| 戰場適性系統.md | — | 因子爆發系統、戰法系統、數值系統 |
| 戰法系統.md | 戰場適性系統、戰法場景規格書（格子戰法定義） | 因子爆發系統、培育系統、教官系統（支援卡） |
| 武將戰績系統.md | 戰場部署系統 | 轉蛋系統 |
| AI武將強度系統.md | — | 數值系統、戰場部署系統 |
| 名將挑戰賽系統.md | — | 戰場部署系統、兵種（虎符）系統、戰場適性系統 |
| 治理模式他國AI系統.md | — | 經濟系統、領地治理系統 |
| **戰法場景規格書.md** | — | 戰法系統、戰場適性系統、奧義系統、戰場部署系統、主戰場UI規格書、治理模式他國AI系統（E-4/E-5 場景戰法觸發） |

### 經濟 & 資源系統

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 經濟系統.md | 戰場部署系統、道具系統 | 資源循環系統、領地治理系統 |
| 領地治理系統.md | 經濟系統 | 遊戲時間系統 |
| 資源循環系統.md | 結緣系統（配種）、培育系統、經濟系統 | 武將壽命系統 |
| 道具系統（付費免費道具）.md | — | 經濟系統、結緣系統、傭兵系統、培育系統、領地治理系統 |
| 遊戲時間系統.md | 武將壽命系統、領地治理系統、培育系統 | — |

### 社交 & 留存

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| 傭兵系統（試用）.md | 教官系統（支援卡）、可結緣女性來源系統 | 轉蛋系統 |
| 留存系統.md | — | 傭兵系統（試用）、教官系統（支援卡） |
| 名士預言系統.md | 結緣系統（配種） | 因子解鎖系統 |
| 可結緣女性來源系統.md | — | 結緣系統（配種）、傭兵系統（試用）、俘虜處理系統、培育系統 |
| 俘虜處理系統.md | 可結緣女性來源系統 | 經濟系統、武將系統 |
| 武將背包（倉庫）系統.md | — | 轉職與宿命系統、傭兵系統（試用） |

### 樞紐 & 規劃文件

| 規格書 | 被依賴 | 依賴 |
|---|---|---|
| MVP遊戲驗證規格書.md | — | 武將系統、結緣系統、培育系統、血統理論系統、因子爆發系統、戰場部署系統 |
| Data Schema文件（本機端與Server端）.md | — | 全系統（匯總所有 I 區 Schema） |
| 新手開場規格書.md | 正式版劇本文案、UI 規格書.md | 轉蛋系統、血統理論系統、因子解鎖系統、道具系統 |
| 正式版劇本文案.md | — | 新手開場規格書、UI 規格書 |
| 血脈命鏡過場載入規格書.md | UI 規格書.md | 血統理論系統.md、武將人物介面規格書.md |

### Docs 層級文件

| 文件 | 被依賴 | 依賴 |
|---|---|---|
| keep.md | 全專案（最高執行準則） | — |
| agent-context-budget.md | keep.md、AGENTS.md、.github/instructions/token-guard.instructions.md、.github/instructions/image-view-guard.instructions.md | keep.md |
| demo_playbook.md | 場景搭建指南、主戰場UI規格書 | 戰場部署系統、兵種（虎符）系統、數值系統 |
| demo_技術架構.md | — | 數值系統、戰法系統、資源循環系統、戰法場景規格書 |
| 場景搭建指南.md | — | demo_playbook |
| 討論來源整併狀態.md | keep.md | cross-reference-index.md |
| 正式規格矛盾審查.md | keep.md | 討論來源整併狀態.md、cross-reference-index.md |
| 程式規格書.md | — | 新手開場規格書、血統理論系統、轉蛋系統 |
| 資料中心架構規格書.md | demo_技術架構.md、Data Schema文件（本機端與Server端）.md、名詞定義文件.md | GeneralUnit.ts、FormulaSystem.ts、GeneralDetailOverviewMapper.ts、rarity-thresholds.json、audit-generals-commercial-balance.js、BloodlineGenerator.ts、MemoryManager.ts、ResourceManager.ts、SyncManager.ts、DataStorageAdapter.ts、SchemaMigration.ts、DataCatalog.ts、DataPageLoader.ts、PersonRegistry.ts、BloodlineGraph.ts、SaveSerializer.ts、DeltaPatchBuilder.ts、GeneralArchiver.ts、BattleLogArchiver.ts、SpiritCard.ts、DataGrowthMonitor.ts、GeneralLifecycle.ts、FamilyBranchSummary.ts、AIPopulationConfig.ts、PendingDeleteStore.ts、SeasonalRollup.ts、BranchCompactor.ts、BreedingQuotaEnforcer.ts（IBreedingGate）、DataLifecycleScheduler.ts、ai-population-config.json |
| dc-datacenter-tasks.md（tasks/） | 資料中心架構規格書.md | phase-dc-datacenter.json（ui-quality-tasks/） |
| phase-dc-datacenter.json（ui-quality-tasks/） | 資料中心架構規格書.md | dc-datacenter-tasks.md、ui-quality-todo.json |
| UI 規格書.md | 正式版劇本文案、UI技術規格書、武將人物介面規格書.md、血統樹14人UI規格書.md | 新手開場規格書、程式規格書、血統理論系統.md、兵種（虎符）系統.md |
| 武將人物介面規格書.md | UI技術規格書、武將系統.md、血統理論系統.md、戰法系統.md、戰場適性系統.md、兵種（虎符）系統.md | GeneralDetailPanel.ts、GeneralUnit.ts、GeneralListPanel.ts、LobbyScene.ts |
| 武將人物介面美術接線清單.md | 武將人物介面規格書.md、UI技術規格書.md | — |
| 主戰場UI規格書.md | UI技術規格書 | demo_playbook、戰場部署系統、兵種（虎符）系統、戰法場景規格書（§ 6 場景視覺主題）、美術風格規格書.md |
| 美術素材規劃與使用說明.md | UI技術規格書、demo_技術架構.md | keep.md、artifacts/ui-library/_registry/asset-registry.json、tools_node/promote-ui-library-asset.js |
| UI參考圖品質分析.md | UI技術規格書、UI 規格書.md、美術素材規劃與使用說明.md、ui-quality-todo.md、美術風格規格書.md | ui-design-tokens.json、general-detail-default.json、keep.md § 4.1 |
| 美術風格規格書.md | UI技術規格書、UI 規格書.md、美術素材規劃與使用說明.md、武將人物介面規格書.md、主戰場UI規格書.md | UI參考圖品質分析.md、UI品質檢核表.md、ui-design-tokens.json、general-detail-bloodline-v3-default.json、header-rarity-plaque.json、gacha-preview-main.json、battle-scene-main.json |
| UI-factory-agent-entry.md | UI-reference-source-workflow.md、artifacts/ui-source/general-detail-overview/decomposition-pipeline-ops-guide.md、docs/ui/UI-asset-slice-pipeline-quickstart.md | keep.summary.md、UI技術規格書.md、UI品質檢核表.md、美術風格規格書.md |
| UI-asset-slice-pipeline-quickstart.md | UI-factory-agent-entry.md、.github/skills/ui-asset-slice-pipeline/SKILL.md、artifacts/ui-source/general-detail-overview/manifests/selected-slice-postprocess-demo.selection-map.json | keep.summary.md、UI技術規格書.md、UI品質檢核表.md、美術素材規劃與使用說明.md |
| docs/ui/ComfyUI-Cocos-partial-asset-minimal-flow.md | UI-asset-slice-pipeline-quickstart.md、UI-factory-agent-entry.md、artifacts/ui-source/*/manifests/asset-task-manifest.json | keep.summary.md、UI技術規格書.md、UI品質檢核表.md、美術素材規劃與使用說明.md、UI-reference-source-workflow.md |
| UI-icon-factory-workflow.md | UI-factory-agent-entry.md、artifacts/ui-source/*/reference/prompts/icon-prompt-card-*.md | keep.summary.md、UI技術規格書.md、UI品質檢核表.md、美術風格規格書.md、UI-icon-family-registry.md |
| UI-icon-family-registry.md | UI-factory-agent-entry.md、UI-icon-factory-workflow.md、artifacts/ui-source/*/reference/prompts/icon-prompt-card-*.md | keep.summary.md、UI-icon-factory-workflow.md、UI品質檢核表.md |
| UI-reference-source-workflow.md | UI-factory-agent-entry.md、artifacts/ui-source/*/reference/* | keep.summary.md、UI技術規格書.md、UI品質檢核表.md、美術風格規格書.md、主戰場UI規格書.md |
| ui-quality-todo.md | — | UI參考圖品質分析.md § 8、keep.md、美術素材規劃與使用說明.md |
| UI技術規格書.md | — | keep.md、UI 規格書.md、主戰場UI規格書.md、美術素材規劃與使用說明.md、武將人物介面規格書.md、武將人物介面美術接線清單.md |
| 熱更新與版本控制規格書.md | — | Data Schema文件（本機端與Server端）.md |
| **Shared Protocols** | SyncManager.ts, server/src/index.ts | 跨平台對稱驗證協議定義 |

---
