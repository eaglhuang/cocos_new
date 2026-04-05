# UI-2-0052 Asset Production Schema Spec

## 核心欄位

| 欄位 | 必填 | 說明 |
|---|---|---|
| `asset_family` | 是 | 所屬 family |
| `presentation_role` | 是 | 在畫面中的角色 |
| `color_role` | icon 必填 | 功能語意色票 |
| `carrier_type` | icon 必填 | 底板 / 容器類型 |
| `glyph_topic` | icon 必填 | glyph 主題 |
| `overlay_need` | 視情況 | badge / glow / rarity 等疊層 |
| `state_set` | 是 | 需要輸出的狀態組 |
| `size_set` | 是 | 需要驗證的尺寸組 |
| `crop_mode` | portrait 必填 | 裁切模式 |
| `value_signal` | 非 icon 常用 | 價值 / 稀有度訊號 |
| `background_tone` | 是 | 預期背景語境 |
| `screen_context` | 是 | 真實掛載畫面 |
| `qa_board_path` | 是 | QA 板路徑 |

## 最小 brief 結構

1. `family`
2. `role`
3. `color_role`
4. `state_set`
5. `size_set`
6. `screen_context`
7. `qa_board_path`

## 最小 QA 回填

1. 是否符合 `asset_family`
2. 是否符合 `color_role`
3. `32 / 64` 可讀性
4. 放回畫面是否成立
5. 是否保留 / 淘汰

## 與現有任務的對應

- `UI-2-0044`：Lobby icon 可直接套這份 schema
- `UI-2-0045`：武將介紹 / QuickView icon 可直接套這份 schema
- `UI-2-0038`：portrait 類可套 `crop_mode / value_signal`
