# UI-2-0035 Icon Family Assignment

## 已開立 icon 量產需求單 × Family 指派

| 任務卡 | 範圍 | 主 family | 次 family / 例外 | 指派理由 |
|---|---|---|---|---|
| `UI-2-0027` | 戰場 UI 圖像資產需求總表 | `F7 戰場微型屬性 badge`、`F8 戰鬥功能按鈕`、`F6 裝備/收藏 cell`、`F5 資源掉落 cell` | `F1 墨刷導覽 glyph` 僅保留給 back / close / help 類低負載導覽 | 戰場不是一套萬用 icon 能包掉的畫面；至少要拆成「貼頭像的小 badge」「可點擊操作按鈕」「卡片/收藏物件」「獎勵資源格」四條生產線。 |
| `UI-2-0028` | `unitinfo.type.icon`、`log.btn.*`、戰場功能 icon | `unitinfo.type.icon -> F7`；`log.btn.auto/speed/setting/collapse -> F8` | `unitinfo.btn.close` 可用 `F1`；若 `unitinfo.type.icon` 需要更強可點擊感，可借 `F8` 的厚 carrier，但不可退化成 F5/F6 的物件縮圖 | 這張卡的 icon 都出現在深色戰場或半透明黑底上，最重視 24~32px 可讀性與即時辨識。 |
| `UI-2-0029` | BattleHUD portraits | 角色頭像本體不屬於 icon family；附掛角標應走 `F7` | QuickView close / help 類按鈕走 `F1` | 頭像是肖像資產，不是 icon；但凡是貼在頭像邊上的兵種、屬性、狀態角標，都要用 F7 的高對比厚邊策略。 |
| `UI-2-0030` | `tally.card.art`、`tally.card.rarity.*`、`tally.badge.type` | `tally.card.art` / `rarity` -> `F6`；`tally.badge.type` -> `F7` | 若之後某些卡面只顯示「狀態短字」而非兵種 symbol，可短暫借 `F2 印章狀態` | TigerTally 本質是「可收藏、可抽取、可比較價值」的卡片，不應用一般操作 icon 語言；只有角落兵種 badge 需要回到 F7。 |
| `UI-2-0031` | 戰場 fallback 規範 | 需保留原 family 的 fallback | 禁止用單一萬用 placeholder 取代所有 family | fallback 若不保留 family，畫面語言會瞬間斷裂；F7 要退到中性厚邊 badge，F8 要退到中性按鈕 glyph，F6/F5 則退到 cell 類 placeholder。 |
| `UI-2-0032` | `unitinfo_type_icon` v2 refinement | `F7` 為主 | 可少量借 `F8` 的金環與厚按壓感 | 這張卡是在修 BattleScene 第一顆 icon 母型，目標不是做成獎勵格物件，而是做成可貼在資訊面板 / 頭像邊的戰場 micro badge。 |

## 現行 ui-spec 契約 × Family 指派

| Screen / Layout | 相關 key | 建議 family | 使用條件 |
|---|---|---|---|
| `battle-hud-screen` / `battle-hud-main` | `hud.portrait.player`、`hud.portrait.enemy` | 頭像本體不套 family；附掛角標預留 `F7` | 深色戰場背景、頭像旁 24~32px badge、背景雜訊高。 |
| `battle-log-screen` / `battle-log-main` | `log.btn.auto`、`log.btn.speed`、`log.btn.setting`、`log.btn.collapse` | `F8` | 即時戰鬥控制列；需要厚 carrier 與粗 glyph。 |
| `action-command-screen` / `action-command-main` | `action.util.tactics`、`action.util.endturn`、`action.util.duel`、`action.sp.ring`、`action.ultimate.*` | `F8` | 主操作區、大圓/小圓按鈕、觸控優先。 |
| `tiger-tally-screen` / `tiger-tally-main` | `tally.card.art`、`tally.card.rarity.*`、`tally.badge.type` | `F6` + `F7` | 卡面主體與稀有度走 F6；角落兵種 badge 走 F7。 |
| `unit-info-panel-screen` / `unit-info-panel-main` | `unitinfo.type.icon`、`unitinfo.btn.close` | `F7` + `F1` | type icon 是貼面板的小 badge；close 是低負載導覽 glyph。 |
| `general-quickview-screen` / `general-quickview-main` | `quickview.portrait`、`quickview.btn.close` | 頭像本體不套 family；close 用 `F1` | popover 中的低負載關閉操作。 |
| `lobby-main-screen` / `lobby-main-main` | `lobby.icon.network`、`lobby.nav.btn` | `F8` 次主工具 glyph；若是純 back/help 則退 `F1` | 大廳頂欄與側欄的系統狀態 icon，不應畫成資源格小實物。 |
| `network-status-screen` / `network-status-main` | `netstat.icon.sprite` | `F8` 次主工具 glyph | 系統狀態型 icon；重點是訊號快讀，不是收藏價值。 |
| `gacha-main-screen` / `gacha-main` | `currency.icon.*`、`gacha.badge.rateup`、`gacha.btn.*` | `currency -> F3/F5`、`rateup -> F2`、`btn.* -> F1/F8` | inline 貨幣計數用 F3；若進 bundle / reward cell 則升到 F5；rate-up 與限定標籤最適合印章語言。 |
| `shop-main-screen` / `shop-main-main` | `shop.btn.close`、`shop.tab.btn` | `close -> F1`；tab 若 icon 化則 `F2` 或低裝飾 `F8` | 商城在羊皮紙 / light-surface 上，不宜用戰場厚重高彩 badge。 |
| `support-card-screen` / `support-card-main` | `card.portrait`、`card.star*`、`topbar.btn.back`、`filterbar.btn.filter`、`bottombar.btn.*` | `portrait/meta -> F6`、`back -> F1`、`filter/cta -> F8` | 收藏卡與星級是 F6 世界；工具與導覽按鈕再另用 F1/F8。 |
| `general-detail-screen` / `general-portrait-screen` | `general.portrait.placeholder` | 頭像本體不套 family；若之後補輔助 icon，優先 `F1` / `F3` | 這類畫面以角色展示與資訊閱讀為主，不應混進戰場 micro badge。 |

## 規格書情境 × Family 指派

| 規格書情境 | 建議 family | 具體條件 |
|---|---|---|
| `UI 規格書` 開場 / 信件 / Win95 導覽 | `F1` | back / close / help / next 等低資訊量操作。 |
| `UI 規格書` 因子六角圖、祖先矩陣、子嗣預測 | `F3` | 六角章、短標記、表格/資訊面板旁的 compact badge。 |
| `UI 規格書` 商業序列的 rate-up、倒數、限定標記 | `F2` | 短字、情緒色塊、促銷與緊迫感。 |
| `UI 規格書` 商城 / 轉蛋獎勵格、材料兌換格 | `F5` / `F6` | 可堆疊資源走 F5；可收藏、可稀有化的物件走 F6。 |
| `主戰場UI規格書` 頭像旁屬性或兵種角標 | `F7` | 深色戰場、24~32px、黏在頭像或卡面邊緣。 |
| `主戰場UI規格書` 奧義 / 計謀 / 單挑 / Auto / x2 / ⚙ | `F8` | 可點擊、觸控優先、需要強 tactile 感。 |
| `主戰場UI規格補充_v3` TigerTally `UnitTypeBadge` | `F7` | 32×32 圓形、色相分兵種、戰場角標語言。 |
| `主戰場UI規格書` Grid Indicators / 地形標示 | `F4` | 棋盤上的環境 / 地形記號，偏印記、描線、低彩。 |

## 最終規則

1. 先決定 icon 貼在哪種背景，再決定 family；不能先畫完再硬塞畫面。
2. `戰場附掛小 badge` 與 `戰場可點擊按鈕` 必須拆成兩套：`F7` 與 `F8`。
3. `可收藏物件`、`可抽取卡牌`、`有稀有度` 的一律先看 `F6`，不要誤用 F8。
4. `資源/材料/掉落` 若與數量同時出現，優先 `F5`，讓數字先被讀到。
5. `back / close / help / info` 等低資訊量導覽，不要濫用厚 carrier，回到 `F1` 最穩定。

## 更新記錄
- 2026-04-06 | UI-2-0032 已產出 v2a/v2b/v2c × 128/64/32，任務進入 QA 選型；以 BattleScene 真場景 / compare board 驗證三套稿後再決定採用或重開 refinement。

