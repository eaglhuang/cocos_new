# UI Factory Agent Entry

這份文件是給其他 Agent 的正式入口。

它的用途不是再發明一套平行規格，而是把「哪幾份文件一定要讀、照什麼順序讀、讀完後該怎麼推動」明文化，並且把「參考圖從哪裡來」這個常被漏掉的前置環節補回正式流程。

## 必讀順序

1. `docs/keep.summary.md`
目的：先載入專案共識、平台範圍、UI 量產原則與 token 節流規則。

2. `docs/UI技術規格書.md`
目的：確認全域 UI 技術基準，例如跨平台自適應、`Widget + SafeArea + Layout`、三層 JSON 契約、禁止 hardcode 座標。

3. `docs/UI品質檢核表.md`
目的：確認統一 UI 品質門檻，例如 1920x1080、44x44 觸控熱區、9-slice / ornate frame 規則、驗收解析度。

4. `docs/ui/UI-factory-baseline-and-gates.md`
目的：確認 UI factory 的統一基準、目前量產 gate、完成定義與尚未完成的缺口。

5. `docs/UI-reference-source-workflow.md`
目的：確認這張 screen 的參考圖來源是使用者提供、Agent 與使用者共同探索 AI 參考圖，還是混合模式。

6. `docs/UI-icon-factory-workflow.md`（若畫面含 icon / badge / currency / medal / nav glyph）
目的：確認 icon 不是單顆 PNG，而是要先定義 family、structure mode、underlay / label / runtime overlay 規則，再進入 AI 量產。

7. `docs/UI-icon-family-registry.md`（若畫面含 icon system）
目的：確認 `family id / suite id / member key / output naming` 都走統一 registry，而不是每張 screen 各自命名。

8. `artifacts/ui-source/general-detail-overview/decomposition-pipeline-ops-guide.md`
目的：確認量產流程的角色分工、輸出物、工具路由、為什麼會變快。

9. 當前 screen 的 `artifacts/ui-source/<screen-id>/`
目的：直接讀現場產物，例如 `manifests/intake.json`、`proof/*.family-map.json`、`review/generated-review.json`、`review/runtime-verdict.json`。

10. `.github/skills/ui-asset-slice-pipeline/SKILL.md`（若使用者提供的是整頁 UI、2K 母圖、panel sheet，且需求是先切件再收斂）
目的：把 `全切 -> auto-classify -> auto-pick -> temp/selected 分流 -> trim/postprocess` 納入正式工具鏈，而不是每次手工臨時拼命令。

11. `docs/ui/UI-asset-slice-pipeline-quickstart.md`（若另一個 Agent 只需要 1 頁判斷是否該走切件線）
目的：快速判斷什麼時候該走 `slice -> selected -> postprocess`，以及最短命令長什麼樣。

## Agent 應如何推動 UI 畫面

### Step 0. 先決定參考圖來源，不要直接跳 proof

每張 screen 在進入 intake / proof 之前，先回答一件事：這張畫面的 canonical reference 從哪裡來。

可接受的來源只有三種：

1. 使用者提供現成參考圖。
2. Agent 與使用者一起依規格書探索 AI 參考圖。
3. 混合模式：使用者提供一部分，AI 補視覺方向探索。

如果走 AI 參考圖：

1. Agent 不能直接自己決定 prompt 後埋頭生圖。
2. 必須先把規格約束、family 語言、禁用視覺語言、平台限制整理成 prompt card，和使用者一起討論。
3. AI 生成結果只作為 `reference / concept exploration`，不是正式量產資產，也不是 proof 的唯一真相。

參考 prompt 卡可直接從：

- `artifacts/ui-source/ai-recipes/reference-prompt-card-template.md`

若主題其實是 icon suite，而不是整頁 screen composition，應改用：

- `artifacts/ui-source/ai-recipes/icon-prompt-card-template.md`

開始。

### Step 1. 先判斷這張 screen 在 factory 的哪一段

- 還沒有 `intake.json`：先走 intake。
- 有 proof，但沒有 family-map：先走 family routing。
- 有 family-map，但沒有任務 manifest：看是 `generate-partial-asset` 還是 `param-tune`。
- 有 manifest，但沒有 review：補 `generated-review.json`。
- 有 generated review，但沒有 runtime verdict：補 `runtime-verdict.json` skeleton 或真正 runtime 驗證。

### Step 2. 先保護主幹，再決定任務型別

主幹永遠是：

1. `UItemplate`
2. `widget`
3. `content contract`
4. `skin fragment`

只有當 template / widget 無法承接，才允許往下開新局部資產。

如果畫面內含 icon system，還要多問一題：

1. 這些 icon 是不是同一個 family suite。
2. 它們是否需要 underlay / badge plate / runtime label chip。
3. 它們是否應該 batch 一次生成，而不是逐顆臨時生圖。
4. 它們的 `family id / suite id / member key` 是否已符合 registry 命名規則。

### Step 3. 四種任務型別的路由

1. `reuse-only`
代表現有 family 可直接承接，不要新增生圖任務。

2. `param-tune`
代表只需要 layout / opacity / tint / spacing 微調，走 `compile-family-map-to-param-tune-tasks.js`。

3. `generate-partial-asset`
代表需要新 ornament / wash / medallion 零件，走 `compile-family-map-to-asset-tasks.js`。

若 zone 被標成 `family: icon`，也應視為 `generate-partial-asset` 類型，但生成單位應是同 family 的 icon suite，而不是零散單顆 PNG。

`generate-partial-asset` 任務產出的 raw PNG 不可直接當 runtime 真相。至少還要經過一次 post-process：

1. `trim-png-by-background.js` 或 `postprocess-ui-asset.js`（含 safe de-fringe / outer-ring cleanup，但只在背景可判定時窄修正）
2. 尺寸 / 外圈 alpha / nine-slice border 檢查
3. 通過後才進 assembly / runtime capture

若 task 已經存在，優先走：

1. `run-ui-asset-postprocess.js --task <task.json> --input <raw.png>`

讓 processed asset / report 有固定落檔位置，而不是每次手工拼命令。

若要把 `family-map -> asset-task manifest -> processed outputs` 串成單指令，改走：

1. `run-ui-asset-task-batch.js --family-map <family-map.json> --input-dir <raw-dir>`
2. 或 `run-ui-asset-task-batch.js --manifest <asset-task-manifest.json> --input-dir <raw-dir>`

這層會依 `taskId / outputName / slot` 自動尋找 raw input，逐 task 呼叫 post-process runner，並寫 batch report。

若要同時套上 context-budget wrapper，標準包法是：

1. `run-ui-workflow.js --workflow generate-partial-asset-postprocess --task <task-id> --goal "compile manifest and postprocess raw assets" --files <family-map-or-manifest> <raw-dir> -- node tools_node/run-ui-asset-task-batch.js --family-map <family-map.json> --input-dir <raw-dir> --strict`

若使用者提供的是整頁 UI、整板母圖或 2K 高品質圖，且當前目標不是直接生新圖，而是先把局部件自動萃取出來，優先改走 `.github/skills/ui-asset-slice-pipeline/SKILL.md`。

這條 skill 目前的標準形狀是：

1. `slice-ui-image-components.js` 先做 `full-slice`
2. heuristic `auto-classify + auto-pick` 把高信心候選升到 `selected`
3. 其餘 provisional 切片全部留在 `temp`
4. `run-ui-selected-postprocess.js` 可直接把 `selected` 候選轉成 batch runner 可吃的 staging input
5. `trim-png-by-background.js` / `postprocess-ui-asset.js` / `run-ui-asset-task-batch.js` 再接上去做透明化、去毛邊與 runtime-ready 後處理

重要：`temp` 是故意保留的垃圾桶，不是正式輸出物。只要這輪沒被升到 `selected`，之後就應該允許整包清掃，而不是繼續堆在主產出區。

若 `selected` 內檔名已經整理成 `taskId / outputName / slot` 之一，標準接法是：

1. `npm run postprocess:ui-asset-selected -- --manifest <asset-task-manifest.json> --selected-dir <selected-dir> --generated-root <out-dir> --strict`

若 `selected` 內仍是 `component_014.png` 這類 generic 名稱，就補 `--selection-map <json>`，明確指定 `taskId -> selected relative path`。

目前已驗證的示範 screen 是 `GeneralDetailOverview`，對應檔案為：

1. `artifacts/ui-source/general-detail-overview/manifests/asset-task-manifest.json`
2. `artifacts/ui-source/general-detail-overview/manifests/selected-slice-postprocess-demo.selection-map.json`

對 sliced 類資產，目前正式建議仍是明確提供 border；heuristic auto-detect 只能當建議值，不能直接當最終真相。

若要把 sliced 任務寫成正式 task contract，至少要在 `postProcess` 裡明確落這三個欄位中的一組：

1. `spriteType: "sliced"`
2. `border: [top, right, bottom, left]`
3. 或 `autoDetectBorder: true`（只作建議值，不取代人工確認）

`compile-family-map-to-asset-tasks.js` 現在會保留這些欄位，且在有 `border` 或 `autoDetectBorder` 時自動把 `spriteType` 補成 `sliced`。

4. `new-family-required`
代表現有 family 完全無法承接，這不是直接生圖解，而是要先回到 family 設計層。

## 其他 Agent 最少要知道的輸出物

每張 screen 至少應有：

1. `manifests/intake.json`
2. `proof/<screen-id>.family-map.json`
3. `manifests/asset-task-manifest.json`
4. `manifests/param-tune-manifest.json`（若存在 `param-tune` zone）
5. `review/generated-review.json`
6. `review/runtime-verdict.json`

若這張畫面需要 AI 參考圖探索，還應補：

1. `reference/prompts/*.txt`
2. `reference/generated/*`
3. `reference/selected/*` 或使用者指定的 canonical reference 記錄

若這張畫面有 icon suite，建議再補：

1. `reference/prompts/icon-prompt-card-*.md`
2. `tasks/icon/*.json` 或等價的 icon suite 任務記錄
3. icon family / structure mode / suite id 的決策註記
4. 對應的 registry 決策來源（例如 `gacha-badge-icon-v1`）

## 當前可直接參考的已驗證樣本

1. `GeneralDetailOverview`
2. `GeneralDetailBloodlineV3`
3. `ShopMain`
4. `BattleHUD`
5. `SpiritTallyDetail`

截至 2026-04-08，這五張樣本的 `runtime-verdict.json` 都已經是 clean `pass`，可直接當成量產線的正式已驗證參考，而不只是「大致可用」的中途樣本。

這四張已經覆蓋：

1. 同 family 複用（detail-split）
2. 非 GeneralDetail Popup 類複用（ShopMain）
3. 戰場語言 family 複用（BattleHUD）

新增的 `SpiritTallyDetail` 則補上：

1. 一張先前尚未進 factory 的 popup screen，已實際走完 `reference source -> intake -> proof -> family-map -> manifests -> review -> runtime verdict`。
2. 證明這條 Agent Entry 不只適合整理既有樣本，也能拿來做新 screen onboarding。

## 最新 onboarding 中樣本

1. `GachaMain` 已完成第二個 onboarding 樣本的 `intake -> proof -> family-map -> manifests -> review -> runtime verdict`。
2. 這張樣本同時驗證了 icon 流程已能進入 factory：`pool-tier-badge` 已被編譯成 `icon-badge-suite` 的 asset tasks。
3. 目前 `GachaMain` runtime verdict 已更新為 clean `pass`，代表 icon-aware onboarding 樣本也已完成 runtime 收斂，而不是只停在可升級的中途狀態。

## 建議如何把這條線交棒

如果要把工作分給另一個 Agent，先把範圍切清楚：

1. `GeneralDetailOverview` 可以視為目前最完整的 canonical completed package。
2. `GeneralDetailBloodlineV3` 是同 family 的平行驗證樣本，可用來驗證 family reuse 是否真的成立。
3. `ShopMain` 是非 GeneralDetail 類型的 clean pass 樣本，可用來驗證 factory 不只會做人物頁。
4. `BattleHUD` 的 HUD runtime 驗證已完成 clean pass；如果另一個 Agent 要推進 `BattleScene`，應該把任務範圍明確鎖在 HUD 以外的戰場內容，而不是再回頭處理已經通過的 HUD residual。
5. `SpiritTallyDetail` 是目前最新的「從零 onboarding 到 clean pass」樣本，最適合拿來示範新 screen 如何進 factory，而不是只看既有老樣本。

## 現在最適合拿來完整示範的題目

如果需要挑一個「可以從 Agent Entry 一路走到完成定義」的示範題目，優先順序建議是：

1. `GeneralDetailOverview`：因為 intake / family-map / review / runtime verdict 都已齊，而且已是 clean pass，最適合拿來示範 end-to-end factory 完成態。
2. `ShopMain`：適合示範非 GeneralDetail 家族的量產承接。
3. `SpiritTallyDetail`：適合示範「尚未進 factory 的新 screen，如何用既有 runtime 畫面作 canonical reference 完成 onboarding」。
4. 新 screen：若要再驗證 Agent Entry 是否真能持續帶新任務落地，下一張就不該再選已經 clean pass 的畫面，而應直接開一張尚未進 factory 的新 screen。

## Agent 不該做的事

1. 不要把整頁 UI 丟給 AI 生圖。
2. 不要跳過「參考圖來源確認」就直接拆 proof。
3. 不要把 runtime 誤差直接解讀成「整頁重畫」。
4. 不要在正式流程裡把手調 Prefab 當唯一真相來源。
5. 不要在未確認 family reuse 前，就先開資產任務。

## 現在的下一步

如果是新 Agent 接手，建議優先做這四種工作之一：

1. 和使用者先收斂 `reference source + prompt card`。
2. 補新 screen 的 `intake -> family-map -> manifest`。
3. 補既有 screen 的 `generated-review / runtime-verdict`。
4. 把 `param-tune` task 真正回寫到 layout / skin / token 調整流程。
5. 若使用者手上是整頁 UI 或局部件母圖，先用 `UI-asset-slice-pipeline-quickstart.md` 判斷是否該走切件線，再接正式 task flow。

如果使用者要你「直接挑一個題目做完」，目前預設答案應該是：

1. 先拿 `GeneralDetailOverview` 當 canonical completed package 讀完整套產物。
2. 若使用者要把 `BattleScene` 交給別的 Agent，明確註記 `BattleHUD` 已 clean pass，不要重做。
3. 若要看「新 screen onboarding」的完整例子，直接讀 `SpiritTallyDetail` 這輪新增的 factory 產物。
4. 真正需要新產出的下一個目標，應該是尚未完成 factory 鏈路的新 screen，而不是已 clean pass 的樣本重複加工。