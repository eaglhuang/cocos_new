# UI-2-0054 全專案角色視覺總綱與美術品質優先序

這個資料夾收斂全專案目前最需要定案的美術總監決策，重點不是再多做一張圖，而是先把「角色長什麼樣、戰場怎麼表現、哪幾件事最先做最加分」正式講清楚。

## 這輪結論

- 戰場主表現應以 `3D 模型 / prefab` 為主，不能退回用 2D 立繪直接取代戰場武將。
- 2D 角色立繪仍然非常重要，但應主攻 `HUD portrait`、`GeneralDetail`、`QuickView`、`TigerTally / card art`、`Shop / Gacha` 等高辨識與高商業價值畫面。
- 全專案最值得優先投入的，是先建立一致的角色視覺北極星與戰場 world-space 觀感，而不是零散補單張圖。

## 交付文件

- [notes.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0054\notes.md)
- [project-art-direction-priority-plan.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0054\project-art-direction-priority-plan.md)
- [character-visual-direction-decision.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0054\character-visual-direction-decision.md)
- [market-positioning-differentiation-matrix.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0054\market-positioning-differentiation-matrix.md)
- [motion-cinematic-potential-assessment.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0054\motion-cinematic-potential-assessment.md)
- [pixai-zhenji-portrait-recipe-v1.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0054\pixai-zhenji-portrait-recipe-v1.md)
- [pixai-sunshangxiang-portrait-recipe-v1.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0054\pixai-sunshangxiang-portrait-recipe-v1.md)
- [bloodline-vignette-script-samples.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0054\bloodline-vignette-script-samples.md)
- [general-detail-bloodline-concept-prompt-v1.md](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0054\general-detail-bloodline-concept-prompt-v1.md)
- [UI-2-0065 production roadmap](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0065\project-art-direction-production-roadmap-v1.md)
- [UI-2-0073 toolchain blueprint](C:\Users\User\3KLife\artifacts\ui-qa\UI-2-0073\figma-cocos-playwright-production-blueprint-v1.md)

## 正式規格同步

- 本輪已把 `祖紋命篆 / 命紋靈獸 / 歷史趣聞 / 血脈傳聞 / 血脈卡 / 英靈虎符` 正式回寫到系統規格書。
- 同步更新的正式文件包含：
  - [新手開場規格書.md](C:\Users\User\3KLife\docs\系統規格書\新手開場規格書.md)
  - [血統理論系統.md](C:\Users\User\3KLife\docs\系統規格書\血統理論系統.md)
  - [武將人物介面規格書.md](C:\Users\User\3KLife\docs\系統規格書\武將人物介面規格書.md)
  - [同名武將系統.md](C:\Users\User\3KLife\docs\系統規格書\同名武將系統.md)
  - [兵種（虎符）系統.md](C:\Users\User\3KLife\docs\系統規格書\兵種（虎符）系統.md)
  - [血統樹14人UI規格書.md](C:\Users\User\3KLife\docs\系統規格書\血統樹14人UI規格書.md)
  - [名詞定義文件.md](C:\Users\User\3KLife\docs\系統規格書\名詞定義文件.md)
  - [UI 規格書.md](C:\Users\User\3KLife\docs\UI 規格書.md)
  - [cross-reference-index.md](C:\Users\User\3KLife\docs\cross-reference-index.md)
  - [血脈命鏡過場載入規格書.md](C:\Users\User\3KLife\docs\系統規格書\血脈命鏡過場載入規格書.md)

## 使用方式

- 先看 `character-visual-direction-decision.md`
  - 確認人物立繪風格與戰場 3D / 2D 政策。
- 再看 `project-art-direction-priority-plan.md`
  - 確認全專案先做哪些項目最能大幅加分。
- 再看 `market-positioning-differentiation-matrix.md`
  - 確認我們和市場主流的差異化主軸、不要學什麼、該強化什麼。
- 再看 `motion-cinematic-potential-assessment.md`
  - 確認奧義短片與漫畫劇情分鏡哪個更適合先投資，以及如何混合使用。
- 再看 `pixai-zhenji-portrait-recipe-v1.md`
  - 直接拿去 PixAI 測甄姬第一輪，驗證模型 / LoRA / prompt 是否能穩定畫出我們要的女武將方向。
- 再看 `bloodline-vignette-script-samples.md`
  - 確認 `血脈逸聞 + 命紋靈獸` 是否能成為角色內容層，並直接拿 3 位武將樣本驗證這條線有沒有產品味。
- 再看 `general-detail-bloodline-concept-prompt-v1.md`
  - 直接拿去 Gemini Web 測「武將人物介紹示意圖」，先驗證 `GeneralDetail + 血脈面 + 歷史趣聞 / 血脈傳聞抽屜` 的畫面語言是否成立。
- 再看 `血脈命鏡過場載入規格書.md`
  - 確認 `日常人物頁 v2` 與 `血脈命鏡過場 v2` 已正式拆成兩條產品線：前者主打資訊與角色，後者主打命格與世界觀。
- `notes.md`
  - 作為後續 proof、review-round 與交接入口。
