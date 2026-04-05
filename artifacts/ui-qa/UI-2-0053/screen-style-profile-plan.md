# Screen Style Profile Plan

## 為什麼每個主畫面都要有 style profile

如果 `UI-2-0047` 到 `UI-2-0052` 解的是「素材如何量產」，那 `style profile` 解的是「這批素材回到哪張畫面時，誰該亮、誰該退、誰可以用哪種 family」。

對照 Unity，`style profile` 很像每個主 Scene / Canvas 都有一份自己的 art bible + prefab usage contract。沒有這份文件時，即使每個 icon、card、portrait 各自都合格，拼回畫面還是會失焦。

## 與既有 schema 的關係

- `UI-2-0052`
  - 定義的是「單一素材 brief 必填欄位」
- `style profile`
  - 定義的是「整張畫面如何使用這些素材欄位」

簡單說：

- `asset schema` 管單一圖
- `style profile` 管整張畫面

之後任何生圖 brief 都應先引用 `screen style profile`，再往下填 `asset_family / color_role / state_set / size_set`。

## 每張 style profile 的最小欄位

| 欄位 | 說明 |
|---|---|
| `screen_id` | 對應 ui-spec screen 或 composite id |
| `screen_role` | 這張畫面的主要任務 |
| `tone_pair` | 深淺與材質主配對 |
| `background_depth` | 背景能不能搶主體、要退到哪裡 |
| `primary_families` | 這張畫面最常用的 family |
| `secondary_families` | 只限局部使用的 family |
| `accent_roles` | 金 / 紅 / 綠 / 青 / 紫等語意色如何分配 |
| `cta_tier_map` | 哪些元件能當 Tier A / B / C 焦點 |
| `text_hierarchy` | 主標、區塊標、數值、輔助字的固定層級 |
| `icon_family_map` | 各 slot 群組對應哪種 icon family |
| `non_icon_family_map` | portrait / card / container / torso 走哪條語言 |
| `state_size_policy` | 這張畫面最少要驗哪些狀態與尺寸 |
| `do_not_mix` | 明確禁止混用的 family 或材質 |
| `screen_context` | 真正掛載的 screen / scene |
| `qa_board_path` | 對應 compare board / placement QA 的資料夾 |
| `placement_gate` | 何種條件下才可進實景 placement QA |

## 額外欄位

不是每張畫面都要一樣，但以下兩類常需要補：

### 有 3D 場景或世界空間 UI 的畫面

- `style_zones`
- `world_space_policy`
- `scene_vs_hud_balance`

### 以卡片、商城、收藏為主的畫面

- `card_language`
- `value_signal_policy`
- `reward_container_policy`

## 第一批應補的主畫面

| 畫面 | 優先度 | 為什麼現在就要補 |
|---|---|---|
| `BattleScene` | P1 | 是最複雜的多 zone 畫面，沒有 profile 就會一直局部合理、整體失衡 |
| `LobbyMain` | P1 | 導覽、avatar、network、nav entry 已開始生圖，必須固定主入口語言 |
| `GeneralDetail` | P1 | 深色資訊面板 + portrait + tab + stat block，最容易混 family |
| `GeneralQuickView` | P1 | 是 BattleScene 與角色系統交界面，需要明確定義 popover 語言 |
| `ShopMain` | P1 | light-surface / parchment 系統最容易被戰場語言污染 |
| `Gacha` | P1 | 稀有、rate-up、CTA、bundle 容器都在同頁，缺 profile 很容易失控 |
| `TigerTally` | P1 | 已有 card art / rarity / badge 規格，但還缺畫面級 profile |

## 建議的補件順序

1. `BattleScene`
   - 先固定最複雜畫面的 tone pair 與 zone 階層。
2. `LobbyMain`
   - 讓 Lobby icon、avatar、nav entry 有畫面級母規則。
3. `GeneralDetail` + `GeneralQuickView`
   - 讓角色資訊系統共享同一套層級。
4. `ShopMain` + `Gacha`
   - 把淺面板、促銷、rare / CTA 的關係正式講清楚。
5. `TigerTally`
   - 補齊戰場卡片子畫面的獨立 profile。

## Screen Style Profile 模板

```md
# <screen-id> Style Profile

- `screen_role`:
- `tone_pair`:
- `background_depth`:
- `primary_families`:
- `secondary_families`:
- `accent_roles`:
- `cta_tier_map`:
- `text_hierarchy`:
- `icon_family_map`:
- `non_icon_family_map`:
- `state_size_policy`:
- `do_not_mix`:
- `screen_context`:
- `qa_board_path`:
- `placement_gate`:
```

## BattleScene 需要額外描述的欄位

- `style_zones`
- `battlefield_readability`
- `world_space_policy`
- `player_enemy_neutral_palette`
- `cta_vs_info_brightness_ladder`
- `2d_hud_vs_3d_scene_balance`

## 版本門檻

之後每張 style profile 建議也走版本門檻：

- `v1`
  - desk audit 完成，先把畫面母規則講清楚
- `v2`
  - compare board 與 family 路線對齊
- `v3`
  - placement QA 對照真畫面
- `v4`
  - 正式批准為後續任務的引用來源

## 這張卡對後續任務的實際影響

- `UI-2-0044`
  - Lobby icon brief 之後應繼承 LobbyMain profile
- `UI-2-0045`
  - 武將介紹 / QuickView icon brief 之後應繼承角色系統 profile
- `UI-2-0038`
  - A2 portrait 不只要符合 family，也要符合 BattleScene / QuickView profile
- `UI-2-0039`
  - TigerTally card art 除了 A4/A5 選型，還要符合 TigerTally profile
