# 本專案美術高品質推進路線圖 v1

## 1. 核心判斷

目前專案最有機會拉開市場差異的，不是單純把人物立繪捲得更像市面手游，而是把 `三國 + 血脈傳承 + 英靈延續 + 虎符軍勢` 做成一套完整、可讀、可收藏、可量產的視覺系統。

換句話說，下一階段的高品質路線應該從：

- `人物好不好看`

推進成：

- `整個產品的視覺母語是否一致`
- `血脈世界觀是否已經滲透到人物 / UI / 故事 / 卡面 / 虎符 / 軍隊`
- `現有產能能否穩定量產`

## 2. 先決條件與產能現實

### 2.1 現有長板

- `2D 靜態圖` 可持續生產
- `3D AI 靜態建模` 可持續生產
- `shader / 材質調性 / 輪廓質感` 是戰場與建物的可用加分項
- `Gemini + PixAI` 已能跑出日常人物頁、血脈命鏡、角色 anchor 流程
- `ui-spec skeleton + wireframe + slot-map + codegen-ready` 已建立基底

### 2.2 現有短板

- 沒有穩定 `2D Spine`
- 沒有成熟 `3D 角色動畫`
- 特效仍弱，Unity 粒子轉 Cocos 尚未成熟
- 過於依賴單張圖運氣仍會造成 family 漂移

### 2.3 美術總監結論

所以高品質路線必須優先投資：

- `可量產的靜態世界觀資產`
- `符號系統`
- `shader / 光影 / 構圖 / UI 疊合`
- `角色內容層`

不應優先重押：

- 大量角色動畫
- 大量高階粒子表演
- 高頻長動態漫畫或複雜過場影片

## 3. 下一階段最值得推進的項目

以下按 `落地價值`、`對全專案加分幅度`、`符合現有產能` 排序。

### P0. 命紋視覺母語正式定稿

#### 目的

把 `六色因子 / 祖紋命篆 / 命紋靈獸 / 血脈徽記 / badge / crest / slot` 做成統一 family。

#### 為什麼最重要

- 這是血脈世界觀能否成立的根
- 會直接影響人物頁、命鏡、血統樹、虎符、英靈卡、特種軍隊
- 做完後後續所有圖都更容易穩定

#### 可交付

- `六色因子 -> 紋樣 / 材質 / 線條 / 發光語言` 對照表
- `6~12 個命紋靈獸 family`
- `crest / badge / panel-mark / ornament-mark` 尺寸與用途分級
- `角色符號 slot` 強制規則

#### 落地評估

高可行。以 2D 設計規格與 proof board 為主，不吃動畫。

### P1. 角色 roster 血脈化 retrofit

#### 目的

把已經有的男武將、女武將、小兵方向，正式接上血脈世界觀。

#### 重點

- 男武將仍吃歷史英雄感，但身上要有明確血脈符號
- 女武將仍維持男性向商品力，但要能承接 `血脈價值 / 命紋身份 / 後代品質`
- 小兵與特種軍隊要跟名將命紋同源

#### 可交付

- `男武將 5 人 family compare board`
- `女武將 3 人 family compare board`
- `小兵 4 兵種 family compare board`
- `角色服裝 slot retrofit guide`

#### 落地評估

高可行。以 prompt、compare board、proof 與審圖規則推進即可。

### P2. 日常人物頁 family 量產化

#### 目的

把目前已成形的 `General Detail v3` 變成真正可量產的人物頁 family。

#### 重點

- 每位名將至少要能落一版 `日常人物頁`
- `6 格故事條` 正式成為角色內容層
- `歷史趣聞 / 血脈傳聞` 的資料欄位與圖格 production 流程要成形

#### 可交付

- `daily hero profile` proof package
- `6 格故事條` 空白線稿模板
- `人物頁文案欄位 / story-slot` 規格
- `已持有 / 未持有` 視覺狀態規則

#### 落地評估

高可行。已經有 ui-spec skeleton，可直接走 Unity 類似 `Prefab + Variant + Content Slot` 的思路在 Cocos 落地。

### P3. 血脈命鏡 Loading / 覺醒 family 量產化

#### 目的

把 `血脈命鏡 v3` 從單張概念圖推進成一整套可輪播、可替換角色的內容系統。

#### 重點

- 用於 `Loading / 升星 / 二轉 / 覺醒`
- 對未持有武將有抽卡誘惑力
- tips 與故事條要能與角色資料池相接

#### 可交付

- `mirror loading family` 版型規則
- `角色專屬 tips 池`
- `未持有武將標記` 完整套件
- `右側英靈面` 的專屬化規則

#### 落地評估

中高可行。畫面美術要求較高，但 UI 結構已清楚，不吃複雜互動。

### P4. 英靈虎符 / 特種軍隊 / spirit tally 視覺整合

#### 目的

把 `角色 -> 血脈卡 -> 英靈虎符 -> 特種軍隊` 做成完整視覺鏈。

#### 重點

- 重複抽卡分流才會有戲劇性
- 特種軍隊才能成為第二賣點，而不是普通兵種 UI
- 這也是卡池商業化與戰鬥世界觀接軌的關鍵

#### 可交付

- `spirit tally detail` family proof
- `elite troop codex` proof
- `hero -> crest -> troop -> card` 映射表
- 英靈 / 軍勢 / 虎符的 icon / badge / card-face 規則

#### 落地評估

高可行。結構性規格已建立，主要補齊 proof family 與圖資規則。

### P5. BattleScene 3D 靜態質感提升

#### 目的

把戰場從「可運作」往「像產品」推。

#### 重點

- 善用 `3D 模型 + shader`
- 不追求角色動畫量，而追求 `輪廓、材質、讀性、兵線識別`
- BattleHUD / 地面 / 兵模 / 武將 silhouette 要整體一致

#### 可交付

- `BattleScene style profile v2`
- `hero/troop silhouette benchmark`
- `shader ruleset`
- `Top HUD + world-space` 的配色 / 對比修正

#### 落地評估

中可行。需要 Agent1 的 capture 與場景 proof 配合，但投資報酬率高。

### P6. 家園 / 國家治理地圖 / 建物景觀 3D family

#### 目的

把目前很有潛力的 `3D 靜態建物` 做成第二條高品質長板。

#### 重點

- 家園、國家治理地圖、主城最適合吃 `AI 3D 建模 + shader`
- 這塊能直接拉開和只靠立繪的競品差異

#### 可交付

- `home/governance landmark` proof set
- `building silhouette family`
- `tile / node / landmark / monument` 分級規格
- `nation map` style profile

#### 落地評估

高可行。最符合現有 3D 靜態產能，且與動畫短板衝突小。

### P7. 商城 / 招募 / reward / bundle 的高級商品化

#### 目的

讓玩家願意抽、願意點、願意看，不能只靠角色本人。

#### 重點

- `招募 / TigerTally / chest / bundle / material pack` 要成 family
- 卡池與商城要共享高級感語言
- 這一塊直接影響轉化率

#### 可交付

- `reward container family board`
- `gacha/shop premium frame family`
- `bundle / chest / material pack` 分級套件
- `SSR / UR / LR` 的商品感階層規則

#### 落地評估

高可行。偏 2D 靜態包裝與 UI family，符合現有條件。

### P8. 血脈內容層量產

#### 目的

把 `血脈逸聞 / 命紋靈獸故事 / loading tips / 雙故事條` 做成內容工廠。

#### 重點

- 這是最能把世界觀做深的地方
- 也是你們最適合用靜態圖達成產品差異的地方

#### 可交付

- `角色專屬 tips pool`
- `歷史趣聞 / 血脈傳聞` 欄位規格
- `5~6 格故事條` storyboard 模板
- 命紋靈獸 family 故事庫

#### 落地評估

高可行。主要吃文案、靜態圖與欄位規格，不吃重動畫。

### P9. 特效與動態只做 baseline，不做鋪量

#### 目的

用最少成本補最必要的動態感。

#### 重點

- 只做 `命鏡裂隙 / 英靈顯現 / 血脈點亮 / CTA / 稀有度脈衝` baseline
- 不要先開大面積技能特效 overhaul
- 先讓 UI 與世界觀演出有呼吸感就好

#### 可交付

- `Cocos 粒子 baseline list`
- `命鏡 / 英靈 / badge glow` 小型 FX 規格
- `不做項目清單`

#### 落地評估

中可行。應該小規模投入，不宜重押。

## 4. 不建議現在就重押的方向

### 4.1 大量角色動畫

- 目前產能不匹配
- 很容易做了很多卻不穩
- 會拖慢更關鍵的 bloodline family 建立

### 4.2 大型高階技能影片鋪量

- 少量高光可以做
- 但不應當成主 production 線

### 4.3 重新發明整套 UI 美學

- 現在更好的做法是 `在既有可用 UI 上微調色調、命紋、徽記、故事層`
- 而不是把整套 UI 砍掉重設計

## 5. 建議的推進順序

### 第一批：一到兩週內最值得推進

1. `命紋靈獸 / 六色因子 / 祖紋命篆` contract 收斂到可生產
2. `角色血脈符號 slot` 套到男武將 / 女武將 / 小兵
3. `日常人物頁` 的 6 格故事條模板與角色資料欄位
4. `血脈命鏡` 的角色輪播規則與專屬 tips 池

### 第二批：接下來最有加分的量產項

1. `spirit tally / elite troop codex` proof 與 slot-map
2. `TigerTally / 招募 / 商店 / reward` 的 premium packaging family
3. `BattleScene` 的 silhouette / shader / world-space readability 修正

### 第三批：建立第二條長板

1. 家園 / 治理地圖 3D 建物 family
2. 地標 / monument / nation map landmark
3. 少量 baseline FX

## 6. 任務拆分建議

以下是最適合開成獨立卡的項目：

- `命紋徽記 family proof board`
- `角色血脈 retrofit checklist`
- `6 格故事條 production pack`
- `血脈命鏡角色輪播批次`
- `spirit tally / elite troop proof round`
- `BattleScene shader benchmark`
- `治理地圖 landmark family`
- `reward / bundle packaging family`
- `FX baseline 小清單`

## 7. 美術總監總結

本專案接下來的高品質路線，不應再只是「把圖畫得更像市面手游」，而是要讓玩家在 `人物、血脈、英靈、虎符、軍隊、Loading、故事條、商城包裝` 每一處都感受到同一個世界。

真正值得重押的是：

- `世界觀符號化`
- `靜態高質感量產`
- `角色內容層`
- `3D 靜態質感`

只要這四條線站穩，這個專案就不會只是另一款三國抽卡，而會長成有自己美術身份的產品。
