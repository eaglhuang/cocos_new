# Agent1 Generation Brief: UI-2-0044 Lobby Icon

## 目標

為 `LobbyMain` 產出第一批 icon 候選稿，重點是讓 Lobby 有自己的 icon family，而不是直接借用戰場 icon。

## 要求輸出

### 1. Network Icon

- family: `L1-lobby-status`
- role: `status-indicator`
- color_role: `info-cyan`
- size: `64`, `32`
- variants: `v1a`, `v1b`

### 2. Avatar Placeholder

- family: `L2-lobby-avatar-placeholder`
- role: `avatar-placeholder`
- tone: `neutral-ink`
- size: `128`, `56`
- variants: `v1a`, `v1b`

### 3. Nav Entry Icon

- family: `L3-lobby-nav-entry`
- role: `nav-entry`
- topics: `battle`, `generals`, `gacha`, `shop`
- state_set: `normal,selected,pressed,disabled`
- size: `128`, `64`, `32`

## 禁止

- 不可做成戰場 action badge
- 不可做成抽卡稀有度 icon
- 不可過度發光或過度厚重

## QA

- 回填到 `artifacts/ui-qa/UI-2-0044/`
- 至少附 `compare-board` 與 `64/32` 縮圖驗證
