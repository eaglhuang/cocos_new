# UI-2-0045 General / QuickView Icon Spec

## 目標畫面

- `general-detail`
- `general-quickview`
- `general-portrait`

## 目標 slot

- `quickview.btn.close`
- `quickview.portrait`
- `general.portrait.placeholder`

## Family 切分

### G1 Utility Close Icon

- `asset_family`: `G1-general-utility`
- `presentation_role`: `close-button`
- `color_role`: `neutral-ink`
- `carrier_type`: `small-paper-utility`
- `state_set`: `normal,pressed,disabled`
- `size_set`: `64,32`

### G2 Portrait Placeholder

- `asset_family`: `G2-general-portrait-placeholder`
- `presentation_role`: `portrait-placeholder`
- `color_role`: `paper-black`
- `crop_mode`: `head-shoulder-tight`
- `size_set`: `128,72,64,32`

### G3 Info Badge / Tab Marker

- `asset_family`: `G3-general-info-badge`
- `presentation_role`: `info-badge`
- `color_role`: `cta-gold` for highlight, `paper-black` for default
- `size_set`: `64,32,24`

## 規則

- 不能用 BattleScene 的高對比戰場 badge 風格。
- 不能做成 reward icon 或稀有度 loot icon。
- 武將介紹系統要偏 parchment / detail family，乾淨、穩定、資訊可讀。

## Screen Context

- 淺底 parchment panel
- 黑字 / 深墨字為主
- 只有少數 highlight 使用金色
