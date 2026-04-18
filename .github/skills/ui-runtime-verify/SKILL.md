---
doc_id: doc_agentskill_0029
name: ui-runtime-verify
description: 'UI runtime 驗證 SKILL — 刷新 Cocos asset-db、執行 validate-ui-specs.js、headless-snapshot-test.js、capture-ui-screens.js，並依環境選用 cocos-screenshot 或 cocos-preview-qa 檢查實際畫面殘差，回寫 generated-review / runtime-verdict。USE FOR: 修改 layout / skin / screen / content / Panel / UI 資產後的驗證收尾。DO NOT USE FOR: 純資產生成、無 target 的整專案大範圍探索。'
argument-hint: '提供 target screen、驗證路徑或 capture target，並說明需要 strict 驗證、截圖輸出、或殘差分析。'
---

# UI Runtime Verify

把「檔案看起來合理」提升成「runtime 真的長對」的收尾技能。

Unity 對照：相當於做完 Prefab / Script 修改後，不只跑靜態檢查，還要進 Play Mode 看實際 GameView。

## 何時使用

- 修改任何 `layout / skin / screen / content` JSON 後
- 修改 UI Panel / CompositePanel / ChildPanel / mapper 後
- 替換 `proof` 或 `final` UI 資產後

## 驗證前置

固定先跑：

```bash
curl.exe http://localhost:7456/asset-db/refresh
node tools_node/validate-ui-specs.js --strict --check-content-contract
node tools_node/headless-snapshot-test.js
```

若有 touched 高風險檔，收工前補：

```bash
node tools_node/check-encoding-touched.js --files <file...>
```

## 選擇驗證路徑

### 路徑 A：有固定 capture target

優先使用：

```bash
node tools_node/capture-ui-screens.js --target <Target> --outDir artifacts/ui-source/<screen-id>/review
```

目前 script 內建 target（完整清單見 `tools_node/capture-ui-screens.js` 的 `targets` 陣列）：

- `LobbyMain`, `ShopMain`, `Gacha`, `GachaHero`, `GachaSupport`, `GachaLimited`
- `DuelChallenge`, `BattleScene`, `BattleSceneFromLobby`
- `GeneralDetailOverview`, `GeneralDetailSkills`, `GeneralDetailOverviewZhenJi`, `GeneralDetailBloodlineV3`
- `SpiritTallyDetail`, `GeneralList`, `NurtureSession`

### 路徑 B：使用者已把畫面開在 Cocos Editor / Editor Preview

改用 `cocos-screenshot`。

### 路徑 C：已準備 Browser Review 環境

改用 `cocos-preview-qa`。

## 檢查重點

每次驗證都至少看這幾項：

- 文字是否重疊、截斷、貼邊
- 區塊是否有異常空白框、殘影、黑區
- hierarchy 是否接近 canonical reference，而不是只是「能顯示」
- crest / header / portrait / story strip 等重點家族是否還停留在 placeholder 感
- console / page error 是否出現致命錯誤

## 失敗時的處理順序

先判斷是：

1. 契約錯誤：先修 `screen / contract / bind path`
2. 佈局錯誤：修 `layout / shell`
3. 視覺錯誤：修 `skin / tint / asset`
4. 載入錯誤：看 console、page errors、bundle path、資產路徑

不要一看到截圖怪就直接重畫整頁。

## 建議輸出

把結果寫回任務卡或 handoff 時，至少包含：

- 驗證命令
- 截圖路徑
- 通過 / 未通過
- 最大殘差 1 到 3 點
- 下一步修正優先順序

並同步更新：

- `artifacts/ui-source/<screen-id>/review/generated-review.json`
- `artifacts/ui-source/<screen-id>/review/runtime-verdict.json`

## 與其他 skills 的銜接

- 還沒產 skeleton：先用 `ui-spec-scaffold`
- 資產檔案要先過規則檢查：先用 `ui-asset-qc`
- 需要做最終視覺評審：接 `ui-preview-judge`
