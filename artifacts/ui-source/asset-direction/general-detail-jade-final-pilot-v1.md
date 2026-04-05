# GeneralDetail Jade Final Pilot v1

對應任務：
- `UI-2-0089` ArtRecipe
- `UI-2-0091` Asset Direction
- `UI-2-0092` Agent1 正式切圖

## 目標

為 `GeneralDetailBloodlineV3` 建立第一批可正式量產的 `jade-parchment` family 資產，讓右側資訊框、header、crest、rarity badge 都進入同一套視覺語言。

## 美術方向

### 正確方向

- 扁平化 jade-parchment，不走寫實玉石材質。
- 主體是 `羊皮紙底 + 水墨渲染感 + 細金線點綴 + 玉飾端件`。
- 邊框要自然融入整體 UI，像卷軸或冊頁，不像貼上的裝甲框。
- 立體感只能非常輕，重點是裝飾性與整體協調，不是材質炫技。

### 禁止方向

- 禁止高亮反射、厚 bevel、寫實玉石紋理。
- 禁止黑金重金屬、厚重勳章感。
- 禁止明顯貼片感、浮在 UI 上的外掛框。
- 禁止只對單一尺寸成立的非 9-slice 切法。

Unity 對照：
- 這比較像在做一套 `Prefab UI kit + Theme Sprite family`
- 不是做一張高解析 concept 圖再硬拆進 UI

## Family 1: jade-parchment-panel-final

### 必要產物

- `header_band`
- `header_cap_left`
- `header_cap_right`
- `body_frame_9slice`
- `body_fill_tile`
- `paper_noise_overlay`
- `inner_shadow_overlay`

### 規則

- header 與 body 必須同源
- 角件、端件不可被 9-slice 拉壞
- 紙感與墨感必須低調，不可髒亂
- 細金線只能點綴，不可搶主體

### 目標 slot

- `gdv3.header.band`
- `gdv3.header.capLeft`
- `gdv3.header.capRight`
- `gdv3.info.frame`
- `gdv3.info.fill`
- `gdv3.info.noise`
- `gdv3.info.innerShadow`

## Family 2: crest-medallion-final

### 必要產物

- `medallion_ring`
- `medallion_face`
- `glyph_safe_mask`
- `soft_shadow`
- `jade_inner_ring`

### 規則

- 應偏印章、符紋、紋章，不偏金屬獎章
- `ring / face / inner ring` 要與 jade header 同語系
- `face` 需要安全區，讓 glyph 可替換
- 陰影要柔和，不要黑方塊感

### 目標 slot

- `gdv3.crest.shadow`
- `gdv3.crest.ring`
- `gdv3.crest.innerRing`
- `gdv3.crest.face`
- `gdv3.crest.glow`

## Family 3: jade-rarity-badge-final

### 必要產物

- `badge_common`
- `badge_rare`
- `badge_epic`
- `badge_legendary`

### 規則

- 與 jade/parchment family 同語系
- 用扁平 ornament 表現稀有度，不用商業貼紙感
- 可讀性高，但不可跳 tone

### 目標 slot

- `gdv3.rarity.badge.common`
- `gdv3.rarity.badge.rare`
- `gdv3.rarity.badge.epic`
- `gdv3.rarity.badge.legendary`

## 驗證

```bash
node tools_node/capture-ui-screens.js --target GeneralDetailOverview --outDir artifacts/ui-qa/UI-2-0092
```

驗收重點：
- 不再引用 `proof/`
- jade / crest / badge 三者為同一套 family
- 9-slice 延展自然
- 視覺不再偏寫實玉石或黑金厚重金屬
