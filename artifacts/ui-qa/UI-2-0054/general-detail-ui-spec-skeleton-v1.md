# 日常人物頁 ui-spec skeleton v1

對應任務：[UI-2-0059](C:\Users\User\3KLife\docs\agent-briefs\tasks\UI-2-0059.md)

## 已建立檔案

- [general-detail-bloodline-v3-main.json](C:\Users\User\3KLife\assets\resources\ui-spec\layouts\general-detail-bloodline-v3-main.json)
- [general-detail-bloodline-v3-default.json](C:\Users\User\3KLife\assets\resources\ui-spec\skins\general-detail-bloodline-v3-default.json)
- [general-detail-bloodline-v3-screen.json](C:\Users\User\3KLife\assets\resources\ui-spec\screens\general-detail-bloodline-v3-screen.json)

## 元件骨架

### 左側

- `PortraitCarrier`
- `PortraitImage`

### 右側主資訊卡

- `HeaderRow`
- `TopSummaryRow`
- `BloodlineRow`
- `BloodlineSummaryFields`
- `BloodlineCrest`

### 下方故事帶

- `StoryStripRail`
- `StoryCell01~06`

## Slot-map 結論

- 左人物為獨立大圖 slot，適合直接餵 Gemini / PixAI 成品去裁切。
- 右側資訊卡是穩定模組式結構，適合後續拆成 `header / stats / role / trait / bloodline / crest` 子 fragment。
- 故事帶 6 格是固定 cell，對現有產能最友善。

## 可行性評估

### 好拆

- 主立繪大圖
- 右側資訊模組
- 血脈 crest 卡
- 6 格 story strip

### 中度成本

- 右側血脈區要做得像「深層人格」而不是另一張卡，需要 skin family 持續收斂
- crest family 需要和 `UI-2-0057 / UI-2-0058` 同步進化

### 不建議現在做重

- 常駐大虛影
- 自動滑動故事 strip
- 日常頁上大量命紋動效
