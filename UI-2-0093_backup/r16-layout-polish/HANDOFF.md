# UI-2-0093 r16 Handoff

日期：2026-04-06

## 最新基線

- 最新截圖：`artifacts/ui-qa/UI-2-0093/r22-portrait-stage-pass/GeneralDetailOverview.png`
- 參考圖：`docs/UI品質參考圖/UI-2-0054_人物頁與血脈命鏡/06_日常人物頁_v3_正確參考.png`

## 這輪已完成

- 右側資訊區從早期的文字互撞、空白框、髒 ribbon 狀態，收斂到可讀的 overview 結構。
- `GeneralDetailOverviewMapper.ts` 已收成摘要型內容，不再把 bloodline 區做成資料表。
- `GeneralDetailOverviewShell.ts` 已持續微調 header / crest / portrait 的 hierarchy。
- `general-detail-bloodline-v3-default.json` 已切到 jade-parchment header 套件，crest 目前以 `dragon_medallion_face_v1` 作為 proof bridge。
- `LoadingScene.ts` 已補強 preview route 等待策略，`GeneralDetailOverview` smoke route 可再次穩定出圖。
- `r22` 已重新跑過：
  - `node tools_node/check-encoding-touched.js`
  - `node tools_node/validate-ui-specs.js --strict --check-content-contract`
  - `curl.exe http://localhost:7456/asset-db/refresh`
  - `node tools_node/capture-ui-screens.js --target GeneralDetailOverview --outDir artifacts/ui-qa/UI-2-0093/r22-portrait-stage-pass`

## 目前最大殘差

1. `header` 的玉牌結構已回來，但文字層級與置中感仍弱，還沒到 canonical finish。
2. `crest` 已有中心命紋，但目前屬 proof bridge，不是 final family。
3. 左側人物舞台已更亮更聚焦，但右側資訊卡整體質感仍偏平，距離參考圖的高級感還有差距。

## 下一步建議

1. 先收 `header`：優先用 `layout / skin / shell tint` 把右上 header 從偏亮偏平收成 jade-parchment 玉牌階層。
2. 再收 `crest`：等 header 階層穩住後，再處理 crest face / ring 的內紋對比與嵌入感。
3. 最後收 `portrait frame`：把左側人物框的亮度、通透感與景深分離往 canonical reference 拉近。
4. 只有當 `header / crest / portrait frame` 三塊都各自收過一輪，仍無法進到 canonical finish，才改走 `.github/skills/dalle3-image-gen/` 補單件資產，再接回 `v3_final`。

## 方向提醒

- `r22` 已經比 `r16` 更接近正確方向，但還沒到 canonical finish。
- 接手時先照 `header → crest → portrait frame` 這個順序，不要又回頭做大範圍 layout 重排或另開新 proof 方向。
