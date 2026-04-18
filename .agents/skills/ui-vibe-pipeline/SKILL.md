---
doc_id: doc_agentskill_0008
name: ui-vibe-pipeline
description: 'UI 自動化生產總控 SKILL — 從 UI 示意圖、參考圖、Figma snapshot 或既有頁面經驗啟動，串接 proof draft、family-map、MCQ、normalized recipe、task shard、ui-spec 與 CompositePanel / ChildPanel scaffold、靜態驗證、Browser QA 自動調整，直到交付人類驗收。USE FOR: 想把一張新 UI 從「給圖」一路推進到可驗證的 screen package 與 QA 閉環。DO NOT USE FOR: 單純修一個 runtime bug、單一 prefab 微調、純美術資產委託。'
argument-hint: '提供 proofSource、screenId 或 proof.json 路徑，說明目標風格、參考頁面、是否要自動產 family-map / MCQ / normalized recipe / task shard / scaffold / Browser QA。'
---

# UI Vibe Pipeline

## When to Use

- 建立新的 Cocos UI 畫面，且希望從 UI 示意圖直接啟動
- 從截圖、Figma snapshot、參考 PNG 或既有頁面經驗，走完整 UCUF 自動化生產流程
- 自動產出 task card、brief、proof、recipe、ui-spec、Panel scaffold
- 自動驗證 framework / contract / screen wiring，並進入 Browser QA
- 在 QA 中根據其他頁面經驗或既有 family 風格自行迭代 screen，再交給人類驗收

## When NOT to Use

- 單純修復 runtime bug（無關 UI 生產流程）
- 手動調整單一 Prefab 節點
- 只想做單步任務，例如只做 proof 分解、只補 brief、只做最終截圖 QA

## Core Principle: 三層資料契約

**UI 的唯一真實來源不是 Prefab，而是三層 JSON**：

1. `assets/resources/ui-spec/layouts/*.json` — 結構、版位、Widget、Layout
2. `assets/resources/ui-spec/skins/*.json` — SpriteFrame、九宮格、字型、顏色、狀態圖
3. `assets/resources/ui-spec/screens/*.json` — 組裝：layout + skin + bundle + 驗證規則

## Global Design Tokens

`assets/resources/ui-spec/ui-design-tokens.json` 定義全遊戲的 UI 風格參數。
所有 skin manifest 應繼承這些值。

## Procedure

### 0. 入口判定：先吃圖，不先逼人填 recipe

預設入口優先順序：

1. `proofSource`：參考圖、Figma snapshot、既有頁面截圖
2. `existing runtime sample`：專案裡已存在、可拿來借鏡的 screen
3. `spec / brief`：若已有正式規格，再拿來補齊

這條 skill 的責任，是把「給一張圖」推進成「可執行的 UCUF 工作包」，而不是停在分解或 brief。

### 1. 參考圖分解為 proof draft

先進入 `ui-reference-decompose` 的語意：

1. 讀取 `proofSource`
2. 產出 `assets/resources/ui-spec/proof/screens/{screenId}.proof.json`
3. 拆出 `visualZones + componentIntents + spacingRecipe + contentSlots`
4. 標記 `unresolved notes`

若 proof draft 信心不足，必須明確保留 unresolved notes，不能直接假裝 recipe 已完整。

### 2. 用 UCUF 藍圖收斂 family / brief / MCQ

接著把 proof draft 接進 `UCUF UI 模板化藍圖`：

1. 判斷可承接的 family（優先既有 family）
2. 產出 `artifacts/ui-source/{screenId}/proof/{screenId}.family-map.json`
3. 產出 `design-brief.md` 或 task-ready brief
4. 對 proof 中無法直接推斷的欄位產出 MCQ
5. 將 MCQ answers 收斂為 normalized recipe

關鍵原則：

1. MCQ 是第二階段決策收斂，不是 workflow 入口
2. family 能自動推的，不要丟給人重答一次
3. family-map / brief / recipe / task shard 要共用同一份結構真相

### 3. 自動產生任務卡與文件

這一步必須委派給 `task-card-opener` skill，不能由 `ui-vibe-pipeline` 自己發展平行開卡規則。
任務卡 ID / 卡號 / 系統代碼一律以 `docs/遊戲規格文件/系統規格書/名詞定義文件.md (doc_spec_0008)` 為準。

至少要產出：

1. `artifacts/ui-source/{screenId}/design-brief.md`
2. `docs/ui-quality-tasks/<task-id>.json` 或等價 task shard
3. `review/generated-review.json` skeleton
4. `review/runtime-verdict.json` skeleton

若已有既有任務卡或正式規格，這一步是回寫與補齊，不是平行另起一份真相。
若新增或回寫了 UI task shard，仍必須執行 `node tools_node/build-ui-task-manifest.js`。

### 4. 產出 UI 框架

這一步承接 `ui-spec-scaffold`：

1. 產出 / 更新 `layout / skin / screen` 三層 JSON
2. 產出 Composite / Child Panel scaffold
3. 補 mapper / bind path policy / content requirements
4. 若 family 已存在 canonical sample，優先 reuse 其結構與命名

### 5. 自動驗證邏輯與框架是否到齊

這一步承接 `ui-runtime-verify` 與既有 validator：

1. `validate-ui-specs.js --strict --check-content-contract`
2. asset-db refresh
3. screen / contract / bind path / content requirements 檢查
4. review / runtime skeleton 寫入與更新

若這一步未通過，不准直接跳去畫面 QA 假裝完成。

### 6. Browser QA 與自動調整迴圈

若 Browser Review 環境已準備好，接 `cocos-preview-qa`：

1. 擷取目標 screen
2. 與參考圖、proof、既有 family 經驗做比對
3. 先修 contract / layout / skin / asset path 這種結構性問題
4. 再重新截圖驗證

這一輪的目的不是追求一次完美，而是把殘差收斂到只剩人類需要做的審美判斷。

### 7. 等待人類驗收

收工前至少要留下：

1. task card / brief 已回寫
2. 驗證命令與結果
3. screenshot 路徑
4. 尚未完成的 residual polish
5. 建議人類驗收的焦點區塊

### 8. 若只需要單步能力，退回子 skill

只有在明確只要單一步驟時，才退回：

1. `ui-reference-decompose`
2. `ui-brief-generator`
3. `ui-family-architect`
4. `ui-spec-scaffold`
5. `ui-runtime-verify`
6. `cocos-preview-qa`

### 9. 確認系統規格

檢查 `docs/ui/systems/{系統名}/` 目錄：
- **有 spec.md** → 嚴格遵守
- **目錄為空** → 根據截圖或 design-brief 推斷

## Expected Outputs

一次完整 workflow 結束時，至少要看到：

1. proof draft
2. family-map
3. MCQ package
4. design brief
5. normalized recipe
6. task card / task shard
7. layout / skin / screen JSON
8. Panel scaffold
9. review / runtime verdict skeleton
10. QA screenshot 與殘差說明
11. 人類驗收前的 handoff 摘要

## 9-Slice Rules

1. border 必須是整數像素
2. 四角不放主陰影細節
3. 內容區至少保留 2px 安全帶
4. 邊緣加 2~4px bleed
5. 避免外框 glow 延伸進角區
6. 同一套框體的 normal/pressed/disabled border 必須一致

## Auto Atlas Rules

1. 共用 UI 小件 → `ui_common` bundle
2. 戰場 HUD → `battle_ui` bundle
3. 大廳 → `lobby_ui` bundle
4. 大面積背景 → 不進 Auto Atlas
5. 九宮格可進 atlas，但 bleed + padding 必須正確

## References

- [UI-vibe-pipeline.md](../../docs/ui/UI-vibe-pipeline.md (doc_ui_0048)) (doc_ui_0048)
- [ui-design-tokens.json](../../assets/resources/ui-spec/ui-design-tokens.json)
- [docs/ui/ui-system-architecture.md](../../docs/ui/ui-system-architecture.md) (doc_ui_0045)
