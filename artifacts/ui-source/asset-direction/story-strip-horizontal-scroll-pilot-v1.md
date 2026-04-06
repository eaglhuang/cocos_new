# Story Strip Horizontal Scroll Pilot v1

對應任務：
- `UI-2-0089` AI 生圖 ArtRecipe 治理
- `UI-2-0091` Pilot Asset Direction
- `UI-2-0087` Golden Preview Baseline + Compare Board

用途：
- 把 `GeneralDetailBloodlineV3` 的底部故事帶，從「口頭 prompt」升級成可量產的資產導演規格。
- 讓後續角色只換 `角色敘事內容 / 辨識元素 / 來源圖`，不再每次重新摸索載體。

## Family 定義

- family id: `story-strip-horizontal-scroll`
- 用途：遊戲 UI 底部的低高度橫向連續敘事帶
- 載體：`GeneralDetailBloodlineV3` 的 `gdv3.story.art`
- 呈現：`一張 master art 長條圖 + 六個無字 overlay slot`

Unity 對照：
- 這比較像先定義一個可重用的 `StoryStrip Prefab family`，再讓每個角色只換貼圖與 slot metadata。

## 載體規格

- 最終 strip 輸出比例：極寬、極矮
- 目前 pilot proof：`5632 x 360`
- 主體安全區：畫面中下 `60%`
- 危險區：
  - 上緣 20%：不要放頭部、旗尖、武器主要辨識點
  - 左右 5%：不要放關鍵臉部與主要事件節點
- 禁止構圖：
  - 六張直式卡片
  - 六張海報拼貼
  - 每格都像獨立封面

## 角色一致性策略

- 角色辨識優先順序：
  1. 武器
  2. 頭巾 / 甲胄輪廓
  3. 軍旗 / 陣營色
  4. 體態 / 騎乘姿態
  5. 臉
- 若沒有角色一致性 reference / LoRA：
  - 預設走弱臉化
  - 允許側臉、背影、遠景、剪影
  - 不鼓勵正臉特寫

## 六段語意槽位

- `origin`
- `faction`
- `role`
- `awakening`
- `bloodline`
- `future`

注意：
- 這六格是語意槽位，不是六張獨立卡片。
- AI 生圖要畫成一張完整長卷，UI 端只保留無字 overlay 定位。

## Pilot 目前輸入與輸出

原始 AI 圖：
- `C:/Users/User/Downloads/Gemini_Generated_Image_tvltx7tvltx7tvlt.png`

proof strip：
- `assets/resources/sprites/ui_families/general_detail/story_strip/proof/zhangfei_story_strip_master_v1.png`
- `assets/resources/sprites/ui_families/general_detail/story_strip/proof/zhangfei_story_strip_master_v2_adaptive.png`

目前判斷：
- `v1` 問題：統一裁切帶太高，張飛頭部被切。
- `v2 adaptive` 改善：每格獨立 crop window，已能保住頭部與馬頭。

## 下一步

1. 建立至少 1 張 compare board，把 `正確參考 / AI 原圖 / strip v1 / strip v2 adaptive / runtime` 放一起。
2. 將這套 crop recipe 轉成工具化 config，而不是每次手調 PowerShell。
3. 等角色一致性 reference 成熟後，把 `proof-only` 轉成正式商業素材流程。
