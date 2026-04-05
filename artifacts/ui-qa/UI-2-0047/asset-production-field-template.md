# UI-2-0047 Asset Production Field Template

## 用途

這份模板用來把量產素材從「一大段描述」改成「可重複填寫的欄位」，方便 Agent1 生圖、Agent2 QA、以及後續回填到 manifest / 任務卡。

## 建議欄位

| 欄位 | 說明 | 範例 |
|---|---|---|
| `asset_family` | 所屬 family | `F7-battle-micro-badge` |
| `presentation_role` | 在畫面中的角色 | `action-button` |
| `color_role` | 功能語意色票 | `cta-gold` |
| `carrier_type` | 底板 / 容器類型 | `round-metal-button` |
| `glyph_topic` | glyph 主題 | `spear / close / lock` |
| `overlay_need` | 是否需要 badge / glow / rarity overlay | `small-rarity-badge` |
| `state_set` | 需要輸出的狀態組 | `normal,selected,pressed,disabled` |
| `size_set` | 需要驗證的尺寸組 | `128,64,32` |
| `crop_mode` | portrait / card / torso 類型必填 | `head-shoulder-tight` |
| `value_signal` | 價值與稀有度訊號 | `premium-high` |
| `background_tone` | 放置背景語境 | `dark-battlefield` |
| `screen_context` | 實際掛載畫面 | `LobbyMain topbar / GeneralQuickView close button` |
| `qa_board_path` | compare board / reference board 路徑 | `artifacts/ui-qa/UI-2-0044/compare-board.png` |

## 最小必填組合

### Icon

- `asset_family`
- `presentation_role`
- `color_role`
- `carrier_type`
- `glyph_topic`
- `state_set`
- `size_set`
- `screen_context`

### Portrait

- `asset_family`
- `crop_mode`
- `value_signal`
- `overlay_need`
- `size_set`
- `screen_context`

### Card / Container / Torso

- `asset_family`
- `presentation_role`
- `value_signal`
- `background_tone`
- `size_set`
- `screen_context`

## 使用規則

1. 生圖前先填欄位，再寫 prompt。
2. QA 時不可只看 prompt，必須核對欄位是否完整。
3. 後續若要寫回 task card / manifest，欄位名稱保持一致。
