---
applyTo: "assets/resources/ui-spec/**,assets/scripts/ui/**,artifacts/ui-source/**,docs/ui/**,docs/UI*.md"
---

# UI Factory Routing

當任務涉及 UI 畫面量產、proof / family-map / task manifest、layout / skin / screen、或 UI runtime 驗證時：

1. 先讀 `docs/keep.summary.md`。
2. 再讀 `docs/UI-factory-agent-entry.md`，依其中「必讀順序」建立上下文。
3. 若任務還沒有 canonical reference，或需要與使用者一起探索 AI 參考圖，讀 `docs/UI-reference-source-workflow.md`。
4. 需要統一 UI 基準（解析度 / 平台 / 自適應 / 驗收 gate）時，讀 `docs/ui/UI-factory-baseline-and-gates.md`。
5. 需要實作流程細節時，讀 `artifacts/ui-source/general-detail-overview/decomposition-pipeline-ops-guide.md`。
6. 若任務修改 `layout / skin / screen / content / panel` 或任何 UI 資產，收尾必須補 runtime 驗證思路，至少更新 `review/generated-review.json` / `review/runtime-verdict.json` 其中之一。

## 路由原則

- 不要把 AI 生圖當成主幹；主幹永遠是 `UItemplate + widget + content contract + skin fragment`。
- AI 若有參與，定位是 `reference exploration` 或 `partial asset generation`，不是整頁真相來源。
- 若現有 family 可承接 80% 以上，預設走 `reuse-only` 或 `param-tune`，禁止直接開整頁生圖。
- 若需要新增局部資產，優先走 `compile-family-map-to-asset-tasks.js` 的 partial asset 路徑。
- 若是 layout / opacity / tint / spacing 微調，優先走 `compile-family-map-to-param-tune-tasks.js`。

## 不可跳過的統一基準

- 設計基準解析度：1920x1080 橫向
- 平台：Web / iOS / Android / PC
- 自適應：`Widget + SafeArea + Layout` 為主，禁止絕對座標 hardcode 當正式解
- 觸控熱區：最小 44x44 px

## 完成定義

當前 UI factory 任務，至少要能回答：

1. 這張 screen 的 `intake / family-map / asset-task-manifest / param-tune-manifest` 是否齊備？
2. `generated-review.json` 是否已落檔？
3. `runtime-verdict.json` 是否至少有 skeleton？
4. 這張畫面屬於哪個 family / 哪個 gate，距離 factory default 還差什麼？