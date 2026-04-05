# UI-2-0044 Lobby Icon Spec

## 目標畫面

- `LobbyMain`

## 目標 slot

- `lobby.icon.network`
- `lobby.avatar`
- `lobby.nav.btn` 對應的入口 icon

## Family 切分

### L1 Network Status

- `asset_family`: `L1-lobby-status`
- `presentation_role`: `status-indicator`
- `color_role`: `info-cyan`
- `carrier_type`: `micro-round-status`
- `state_set`: `normal,disabled`
- `size_set`: `64,32`

### L2 Avatar Placeholder

- `asset_family`: `L2-lobby-avatar-placeholder`
- `presentation_role`: `avatar-placeholder`
- `color_role`: `neutral-ink`
- `size_set`: `128,56,32`

### L3 Nav Entry Icon

- `asset_family`: `L3-lobby-nav-entry`
- `presentation_role`: `nav-entry`
- `color_role`: `paper-black` or `cta-gold` for highlighted entry
- `carrier_type`: `nav-ink-button-compatible`
- `state_set`: `normal,selected,pressed,disabled`
- `size_set`: `128,64,32`

## 規則

- Lobby icon 不可沿用 BattleScene 的厚重戰場 badge。
- Network icon 要偏乾淨、清楚，不要做成獎勵圖示。
- Nav icon 要和 `nav_ink` 按鈕相容，不能搶過文字標籤。

## Screen Context

- 深色 / 墨色按鈕底
- avatar 放在 topbar 左側資訊區
- network 放在 topbar 小型狀態位
