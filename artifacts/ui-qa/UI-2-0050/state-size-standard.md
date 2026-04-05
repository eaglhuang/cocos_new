# UI-2-0050 State / Size Standard

## Icon

### 最小狀態組

- `normal`
- `selected`
- `pressed`
- `disabled`

### 額外狀態

- `hover`：桌面互動較強的 UI
- `locked`：有明確鎖定機制時

### 最小尺寸組

- `128`
- `64`
- `32`

### 微型 badge 額外尺寸

- `24`

## Portrait

### 最小狀態組

- `proof-a`
- `proof-b`

說明
- portrait 通常不是按鈕態，而是構圖 proof 態。

### 最小尺寸組

- `512` 原稿
- `64` HUD / QuickView
- `32` micro-preview

## Card / Container / Torso

### 最小狀態組

- `base`
- `premium` 或 `tier-2`
- `locked`（若有）

### 最小尺寸組

- `512`
- `256`
- `128`

## 規則

1. 生圖前先決定 `state_set`
2. 驗圖前一定要確認 `size_set`
3. `disabled` 不是只降透明度，要降低材質價值感
4. `32` 是最容易暴露問題的尺寸，優先驗
