# UI Proof Template

這個資料夾是所有 `AI UI proof` 的固定生產母板。

目標：

1. 先收斂畫面方向
2. 再收斂結構線稿
3. 最後把 proof 轉成 `wireframe / slot-map / codegen-ready`

## 標準資料夾結構

- `00_brief/`
  - design brief / prompt / reference notes
- `01_proof/`
  - AI 初稿 proof
- `02_select/`
  - 挑選後的候選圖
- `03_wireframe/`
  - 結構線稿
- `04_slotmap/`
  - slot-map、badge、CTA、story cell、crest 命名
- `05_codegen/`
  - layout / skin / screen JSON、prefab scaffold、TS scaffold

## 命名規則

### proof

- `01_{screen}_{variant}_v1_{source}.png`
- `02_{screen}_{variant}_v2_{source}.png`

例：

- `01_general-detail_public_v1_gemini.png`
- `02_bloodline-mirror_awaken_v2_pixai.png`

### wireframe

- `09_{screen}_wireframe_base_v1.png`
- `10_{screen}_wireframe_v1.png`

### slot-map

- `20_{screen}_slotmap_v1.png`

### codegen 預覽

- `30_{screen}_layout-preview_v1.png`
- `31_{screen}_skin-preview_v1.png`

## 生產順序

1. `00_brief`
   - 寫 prompt、acceptance、世界觀限制
2. `01_proof`
   - 產 AI 初稿
3. `02_select`
   - 挑 1~3 張進下一輪
4. `03_wireframe`
   - 畫空白線稿 base
   - 再畫 screen-specific wireframe
5. `04_slotmap`
   - 定 slot / panel / badge / story cell / CTA / crest
6. `05_codegen`
   - 對應 layout / skin / screen JSON

## Toolchain Bridge

- `00_brief` -> 提示詞 / acceptance / 世界觀限制
- `01_proof` -> AI proof
- `02_select` -> 挑 1~3 張進 Figma
- `03_wireframe` -> 空白線稿 + 結構線稿
- `04_slotmap` -> slot / badge / CTA / story cell / crest
- `05_codegen` -> 對應 `layout / skin / screen JSON`

推薦工具鏈：

- `Figma`
  - 做 component / token / variant 規格化
- `cocos-creator MCP`
  - 讀 node tree / prefab / scene，建立 scaffold
- `Playwright MCP`
  - 做 screenshot capture / regression QA

## 原則

- `proof` 不直接等於實作
- 先有 `wireframe`，再有 `slot-map`
- AI 要產碼時，至少要同時看到：
  - proof 圖
  - blank wireframe base
  - wireframe
  - slot-map
  - 對應 JSON

## 參考

- [UI-2-0073 README](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0073\README.md)
- [量產流程藍圖 v1](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0073\figma-cocos-playwright-production-blueprint-v1.md)
