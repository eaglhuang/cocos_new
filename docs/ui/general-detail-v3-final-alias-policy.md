# GeneralDetail V3 Final Alias Policy

日期: 2026-04-09
範圍: `assets/resources/sprites/ui_families/general_detail/v3_final/*`
對象: `GeneralDetailOverview` / `general-detail-bloodline-v3-default.json` / `GeneralDetailOverviewShell.ts`

## 使用規則

- 任何 Agent 之後若要替換 `v3_final` alias，只能從下表的白名單或「可暫留 provisional」欄位執行。
- 未列在白名單的替換，一律視為黑名單；必須先開新 task，再跑新的 runtime formal pass。
- `preview stopgap` 只允許為了移除紅 XX 或 placeholder，用於 QA / preview；不可宣稱為正式量產。
- `proof / source / flat sample / kit sheet` 一律不得直接掛進正式 alias。
- 若候選資產屬於「四角完整花角 + 四邊連續 ornament」的整框，預設視為 `non-9-slice ornate frame`，不得直接當 `frame/fill/band` 類 sliced sprite 使用；必須先拆件或改畫 stretch-safe 版本。

## 白名單 / 可暫留 Provisional

| Alias / Slot | 現掛來源 | 狀態 | 可接受原因 | 下一步 |
| --- | --- | --- | --- | --- |
| `portrait_frame_final` | `v3_final/portrait_frame_final` | keep | 目前 runtime 無新增 regressions | 待後續 compare 再決定是否重產 |
| `parchment_header_band` | `v3_final/panel_header_band` | provisional-allow | `formal-pass-r4` 證明比舊 band 更乾淨，較符合 jade-parchment header 秩序 | UI-2-0096 正式生產後再替換 |
| `parchment_header_fill` | `v3_parts/parchment_header_fill` 升格版 | provisional-allow | 比舊 final 版本更接近 parchment-first | UI-2-0096 |
| `parchment_header_frame` | `v3_parts/parchment_header_frame` 升格版 | provisional-allow | 線框秩序正確，未見多餘文字燒入 | UI-2-0096 |
| `panel_header_cap_l` | `v3_final/panel_header_cap_l` | provisional-allow | 雖不是最終 formal，但比舊 ornament 穩定 | UI-2-0096 |
| `panel_header_cap_r` | `v3_final/panel_header_cap_r` | provisional-allow | 同上 | UI-2-0096 |
| `panel_header_cap_l_v4j_r5` | `v3_final/panel_header_cap_l_v4j_r5` | provisional-allow | compare board 顯示比現役 cap 更接近人物頁玉牌語言；已切為 1024x768 cap canvas 並掛入 skin | 已完成 formal-pass-r5 capture；後續只需補多角色 smoke |
| `panel_header_cap_r_v4j_r5` | `v3_final/panel_header_cap_r_v4j_r5` | provisional-allow | 同上 | 已完成 formal-pass-r5 capture；後續只需補多角色 smoke |
| `badge_family_common_v5` | `v3_final/badge_family_common_v5` | provisional-allow | 家族語義目前可接受 | UI-2-0097 統一正式化 |
| `badge_family_rare_v5` | `v3_final/badge_family_rare_v5` | provisional-allow | 家族語義目前可接受 | UI-2-0097 |
| `badge_family_epic_v5` | `v3_final/badge_family_epic_v5` | provisional-allow | 家族語義目前可接受 | UI-2-0097 |
| `badge_family_legendary_v5` | `v3_final/badge_family_legendary_v5` | provisional-allow | 現行 screenshot 無主要問題 | UI-2-0097 |
| `panel_body_fill` | `v3_final/panel_body_fill` | keep | 目前不是主問題來源 | compare 再決定 |
| `panel_body_frame` | `v3_final/panel_body_frame` | keep | 目前不是主問題來源 | compare 再決定 |
| `crest_face_final` | `v3_final/crest_face_v5` 升格版 | provisional-allow | 符合 jade-parchment 命紋方向，已取代借用參考圖 | UI-2-0095 正式生產 |
| `crest_ring_final` | `v3_final/crest_ring_v9` 升格版 | provisional-allow | 結構成熟、金玉 socket 語義正確 | UI-2-0095 |
| `story_strip_base_v5` | `v3_final/story_strip_base_v5` | provisional-allow | 目前非主要視覺 blocker | 後續再 compare |
| `story_strip_art_v9` | `v3_final/story_strip_art_v9` | provisional-allow | 目前非主要視覺 blocker | 後續再 compare |

## 黑名單 / 禁止直接掛入正式 Alias

| 資產 / 類型 | 狀態 | 禁用原因 | 例外 |
| --- | --- | --- | --- |
| `badge_family_mythic_v5` 原始紅 XX 檔 | blocked | 明確 placeholder，不能進正式 alias | 無 |
| `badge_family_mythic_v5` 目前 stopgap（由 `badge_family_legendary_v5` 覆寫） | preview-stopgap-only | 只是為了避免 mythic 預覽出現紅 XX，不是正式 mythic 設計 | 只可做 preview，不可宣稱已正式完成 |
| `header_ornament_l` / `header_ornament_r` | blocked | 舊版曾出現 AI 燒字與用途錯位，不可回掛 | 無 |
| `artifacts/ui-qa/UI-2-0094/r2-candidates/header_ornament_l_new.png` / `header_ornament_r_new.png` | blocked | 這是整張 kit sheet，不是可直接掛載切圖 | 需先切片並驗證 |
| `jade_family_v4_kit` / `jade_family_v5_kit` / `jade_family_v6_kit` | blocked | kit sheet，不可直接當單一 UI asset 使用 | 需先切片 |
| 任何「整圈連續花紋外框」原圖 | blocked | 屬於 `non-9-slice ornate frame`；直接九宮拉伸會讓邊紋與角區一起變形 | 除非先拆成角件/邊件或重畫 stretch-safe 中段 |
| `crest_face_v4` | blocked | 含殘字與錯誤語義 | 無 |
| `crest_face_v9` | blocked | 黑墨重量過高，不符合 controlled dark contrast | 無 |
| `crest_ring_v4` | blocked | 結構不完整，裁切語義不足 | 無 |
| `crest_ring_v5` | blocked | 偏紫材質語義錯誤，與 jade-parchment 家族不一致 | 無 |
| `crest/final/*source*` / `*flat*` | blocked | source / flat sample 不得直接掛進正式 alias | 無 |
| `crest/proof/*` | blocked | proof bridge 只能做過橋驗證，不得留在正式區 | 無 |

## 本輪 Runtime 結論

- `formal-pass-r3`: `crest_face_v5 + crest_ring_v9` 可暫留正式區，已移除借用參考圖問題。
- `formal-pass-r4`: `panel_header_band` 可作為 `parchment_header_band` 的 provisional 替身；mythic badge 仍無正式候選，現在僅用 non-placeholder stopgap 避免紅 XX。
- `formal-pass-r5`: compare board 選定 `左右拉伸標題4j` 為 GeneralDetailOverview header cap 主案，已將 `panel_header_cap_l_v4j_r5` / `panel_header_cap_r_v4j_r5` 掛入 skin；`validate-ui-specs --strict` 已通過，runtime capture 已完成於 `artifacts/ui-qa/UI-2-0105/formal-pass-r5-v4j-cap-full/GeneralDetailOverview.png`。注意：`capture-ui-screens.js` 預設會縮到 `125px`，formal pass 必須明確加 `--maxWidth 0` 才能保留原尺寸。

## 強制執行

- 後續任何 Agent 若要替換本表中的 alias，必須先引用這份文件。
- 若替換目標不在本表白名單，必須先新增 task card，再產出新的 `formal-pass-rX` artifact。
