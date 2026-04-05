# UI-2-0049 Family Batch Production Spec

## 目的

把量產流程從「缺哪張補哪張」改成「先做 family kit，再衍生單張素材」。

## Family Kit 最小結構

### Icon Family

- `carrier.normal`
- `carrier.selected`
- `carrier.pressed`
- `carrier.disabled`
- `glyph.set`
- `overlay.badge.optional`
- `size_set`

### Portrait Family

- `crop.rule`
- `frame.rule`
- `badge.safe-zone`
- `background.tone`
- `size_set`

### Card / Container / Torso Family

- `silhouette.rule`
- `material.rule`
- `value.signal`
- `background.rule`
- `size_set`

## 生產順序

1. 先定 family 名稱與功能角色
2. 先畫 carrier / frame / crop rule
3. 再畫 glyph / 主圖 / 主輪廓
4. 最後才加 badge / overlay / 光效
5. 同步出狀態組與尺寸組

## 命名模板

### Icon

`<screen>_<family>_<topic>_<state>_<size>.png`

例子
- `lobby_nav_battle_normal_128.png`
- `general_close_utility_disabled_64.png`

### Portrait

`<screen>_<character>_<crop>_<variant>_<size>.png`

### Container / Card

`<family>_<tier>_<variant>_<size>.png`

## 分層規則

- `carrier`：底板、外框、金屬 / 紙 / 墨刷材質
- `glyph`：功能語意
- `badge`：狀態 / 稀有度 / NEW / lock

不可做法
- 把三層全部畫死在一起，導致後續難以量產

## 適用建議

### Lobby

- 以 `status-icon family` + `nav-entry family` 雙軌處理

### 武將介紹

- 以 `utility-icon family` + `portrait-placeholder family` 雙軌處理

### Battle

- `micro-badge family`
- `action-button family`
- `resource-pin family`

## QA 要求

- 每個 family kit 都要有 reference board
- 每個 family kit 都要有最小 compare board
- 每個 family 至少驗一組 `32px` 縮圖
