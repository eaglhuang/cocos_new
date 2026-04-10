# General Detail Shared Baseboard Pilot v1

對應任務：
- `UI-2-0098` Formal Convergence
- `UI-2-0091` Asset Direction
- `general-detail-bloodline-v3-screen` runtime 收斂

用途：
- 把 `GeneralDetailBloodlineV3` 從「多片卡框拼接」收斂成「shared baseboard + local readable panels + rarity accent」的正式量產方向。
- 讓下一手美術與前端能直接照切層規格重做 `info card / portrait frame / story rail`，不再只靠口頭描述 family。

## Screen 錨點

- `screenId`: `general-detail-bloodline-v3-screen`
- `template_family`: `detail-split`
- `content_contract`: `general-detail-overview-content`
- `smoke_state`: `general-detail-overview-states-v1 / smoke-zhang-fei`

Unity 對照：
- 這一步比較像先定義一套 `Shared Stage Prefab family + Theme layering rules`
- 不是直接做一張完整 UI concept 再硬拆成 Sprite

## Canonical References

- 定調 reference：`docs/UI品質參考圖/UI-2-0054_人物頁與血脈命鏡/人物日常介紹v3_正確參考.png`
- 問題現況：`artifacts/ui-qa/UI-2-0098/formal-convergence-check/GeneralDetailOverview.png`
- Tab 與底圖承載參考：`C:/Users/User/Pictures/cocos專案/人物/人物UI/人物介紹UI的Tab參考.png`
- 交接卡：`artifacts/ui-qa/UI-2-0098/formal-convergence-check/HANDOFF.md`

## 目標

- 用一張較大的 `shared baseboard` 統一左人物區與右資訊區，消除目前 `portrait shrine + info card` 的拼裝感。
- 保留必要的功能件與承載件，讓文字、稀有度、crest、story rail 仍能獨立調整。
- 大方向改成 `淡色大地底 + 水墨紙感 + 少量分隔 + 單一主 accent 區`，讓人物與 rarity 提示自然跳出。

## 正確方向

- 主舞台是單一大底板，不是多塊彼此競爭的框體。
- 層次主要靠明度差、紙感、內凹陰影、分隔線、留白建立。
- Tab 應像主面板上緣的一段低高度嵌入式切換片，而不是額外掛在右側的獨立厚標籤。
- header / rarity slab / crest socket / story rail 是少量視覺焦點，而不是每一區都各自有厚框。
- 大面積底色偏中性淡色，允許人物彩度與 rarity 色塊成為第一視覺焦點。
- 右側資訊可讀性優先於 ornament；像冊頁、卷軸、文書面板，不像裝備卡。

## 禁止方向

- 禁止左側人物區維持亮白 shrine / 神龕感。
- 禁止右側資訊區用厚褐框再包一層 header chrome，導致 header 與 body 像兩套 UI。
- 禁止把模式切換做成與主板分離的厚 badge / 側掛牌；那會把已經在收斂的 shared baseboard 再切碎。
- 禁止把 `portrait + info + text + rarity` 烘成唯一不可拆的大圖。
- 禁止靠高彩 glow、大量角件、厚 bevel 硬做層次。
- 禁止把 reference 的綠色完成氣氛直接整張 hue shift 成紫 / 金 / 紅。

## Family 定義

### Family A: shared-baseboard-stage

用途：
- 作為人物區與資訊區共用舞台底。

必要產物：
- `baseboard_fill_wide`
- `baseboard_edge_soft`
- `baseboard_divider_soft`
- `baseboard_inner_shadow`
- `paper_noise_subtle`

規則：
- 視覺上應跨過左人物區與右資訊區，但中間仍要保留可讀的區域差。
- 四周只允許非常輕的邊界感，不做厚實外框。
- 可 sliced，但角區不可依賴 ornate corner。
- 紙紋與噪點要低頻、低對比，不能髒。

對應 runtime 區塊：
- `PortraitCarrier`
- `InfoCardChrome`
- 兩者之間新增共享舞台底層

### Family B: readable-panel-locals

用途：
- 只負責文字承載與局部資訊可讀性，不再承擔整體 family 的大形輪廓。

必要產物：
- `info_panel_fill_light`
- `info_panel_rule_top`
- `info_panel_rule_mid`
- `subpanel_fill_soft`
- `crest_socket_panel`

規則：
- 局部面板要像底板上的文書區塊，不像外掛卡片。
- 可保留極輕的 frame / rule，但以線性分隔取代厚框。
- 模組卡之間優先靠底色微差，而不是各自獨立框線。

對應 runtime 區塊：
- `InfoContent`
- `OverviewSummaryModules`
- `BloodlineSummaryCard`
- `BloodlineCrestCard`

### Family C: rarity-accent-slab

用途：
- 承接 rarity 的第一視覺提示。

必要產物：
- `rarity_header_slab_neutral`
- `rarity_badge_common`
- `rarity_badge_rare`
- `rarity_badge_epic`
- `rarity_badge_legendary`
- `rarity_badge_mythic`

規則：
- slab 本體盡量中性、可染色，真正 per-rarity 的圖件集中在 badge 或少量 emblem。
- 稀有度色塊要顯眼，但只能有一個主區，不要畫面到處都是彩色提示。
- 若要做紫 / 金 / 紅版，優先改 accent 層，不重畫整張 baseboard。

對應 runtime 區塊：
- `InfoCardHeaderChrome`
- `RarityBadge`
- `AwakeningBarFill`
- 可延伸到 crest glow / frame accent

### Family E: top-edge-tab-strip

用途：
- 承接模式切換或次級導覽，語言參考 `人物介紹UI的Tab參考` 的上緣嵌入式 Tab。

必要產物：
- `tab_strip_base_neutral`
- `tab_idle_chip`
- `tab_active_chip`
- `tab_divider_soft`

規則：
- Tab 要嵌在資訊主板上緣或 header slab 內，不做右側外掛式直立標籤。
- Active tab 以明度與細邊線勝出，不靠厚外框或高彩描邊。
- 整條 tab strip 與 shared baseboard 同語系，像冊頁分頁，不像網站 navbar。

對應 runtime 區塊：
- `OverviewModeBadge`
- 若未來新增真正 mode tabs，優先掛在 `InfoCardHeaderChrome` 上緣

### Family D: story-rail-inline

用途：
- 底部故事帶與 shared baseboard 同語系，不再像另一條獨立卷軸。

必要產物：
- `story_rail_base_inline`
- `story_rail_rule`
- `story_rail_art_overlay`

規則：
- 以嵌入底板的橫向敘事帶來看待，不做突出的獨立框。
- 與 shared baseboard 必須共色階，共紙感，共陰影語言。
- 允許故事圖維持獨立 master art，但 rail 本身要被視為 baseboard 的一部分。

## 切層策略

### 可合併

- `PortraitCarrier` 與 `InfoCardChrome` 的大形輪廓，可合成一張 `shared baseboard`。
- 背景紙感、低對比雜訊、輕內陰影，可成為同一套共享材質。
- 故事帶底槽可視為 shared baseboard 的延伸結構。

### 不可合併

- 人物圖與 shared baseboard 不能烘死在同一張 production 成品。
- 文字承載區、badge、rarity slab、crest socket 不能併進唯一大圖。
- 任何會受在地化長度、角色替換、稀有度切換影響的區塊都必須維持獨立。

## 色彩策略

- baseboard 主色：偏淡 parchment / earth / ink wash 中性區。
- 局部 readable panel：比 baseboard 再亮或再暗一階即可，不要跳 tone。
- rarity accent：作為唯一高彩區，集中在 header slab、badge、progress fill、少量 crest glow。
- 若未來要支持紫 / 金 / 紅：改 `accent profile`，不改 shared baseboard 主色。

## 對 layout / skin 的直接指令

1. `PortraitCarrier + InfoCardChrome` 下一輪優先重構成共享舞台底與局部承載件。
2. `InfoCardHeaderChrome` 不再視為獨立厚框 header，而是 shared baseboard 上方的 accent slab。
3. `OverviewModeBadge` 下一輪優先收斂成上緣嵌入式 tab chip，不再像獨立 badge 掛件。
4. `OverviewSummaryModules` 三欄卡優先改為底色微差或細分隔線，不保留強烈卡片外框感。
5. `BloodlineCrestCard` 改為嵌入式 socket，不做浮起的獨立厚卡。
6. `StoryStripRail` 要像底板延伸，不像第二條 UI 桌布。

## 驗收標準

- 一眼看上去先讀到 `人物 + 名稱 + 稀有度主 accent`，不是先讀到框。
- 左右區像同一個舞台，不像兩張不同主題的 UI 拼在一起。
- 大面積底圖淡而穩，不搶人物與 rarity。
- 文字區不依賴厚框也能維持可讀。
- 換 rarity 時，只需替換 accent 與少量 badge，不需要整套重畫。

## Smoke Route

```bash
curl.exe http://localhost:7456/asset-db/refresh
node tools_node/validate-ui-specs.js --strict --check-content-contract
node tools_node/capture-ui-screens.js --target GeneralDetailOverview --outDir artifacts/ui-qa/UI-2-0098/formal-convergence-check
```

## 下一步

1. 先用此 brief 重做 `info_card_fill_formal` / `info_card_frame_formal`，把右側從厚框改成 shared baseboard 語言。
2. 同步重做 `portrait_frame_formal`，移除 shrine 感並讓人物區吃進 shared baseboard。
3. 再重做 `story_strip_base_formal` / `story_strip_art_formal`，收斂到底板延伸語言。
4. 若做到第 1 步後，團隊仍對 `共同底板輪廓`、`主 accent 區位置`、`稀有度色塊佔比` 無共識，再補一張新的低承諾 AI reference。