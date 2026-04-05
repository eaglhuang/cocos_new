# PixAI vs Gemini Web vs Agent1 工作流 商業化比較

## 1. 比較對象

本次以甄姬樣本為主，比較三條產線：

- `PixAI`
  - 代表樣本：
    - [from-PixAI-1995992951636191160-2.png](C:\Users\User\Pictures\cocos專案\人物\甄姬\eye1.1\from-PixAI-1995992951636191160-2.png)
    - [from-PixAI-1995994320871706900-1.png](C:\Users\User\Pictures\cocos專案\人物\甄姬\eye1.1\Ref0.6\from-PixAI-1995994320871706900-1.png)
    - [from-PixAI-1995994695617735673-2.png](C:\Users\User\Pictures\cocos專案\人物\甄姬\eye1.1\Ref0.9\from-PixAI-1995994695617735673-2.png)
- `Gemini Web`
  - 代表樣本：
    - [Gemini_Generated_Image_立繪.png](C:\Users\User\Pictures\cocos專案\人物\甄姬\Gemini Web\Gemini_Generated_Image_立繪.png)
    - [Gemini_Generated_Image_半身.png](C:\Users\User\Pictures\cocos專案\人物\甄姬\Gemini Web\Gemini_Generated_Image_半身.png)
    - [Gemini_Generated_Image_商城.png](C:\Users\User\Pictures\cocos專案\人物\甄姬\Gemini Web\Gemini_Generated_Image_商城.png)
- `Agent1 工作流`
  - 代表樣本：
    - [zhen_ji_v1_main_portrait_800x1000_1775032843058_1.png](C:\Users\User\Pictures\cocos專案\人物\甄姬\Agent1工作流\zhen_ji_v1_main_portrait_800x1000_1775032843058_1.png)
    - [zhen_ji_v1_waist_up_closeup_800x1000_1775032881597_2.png](C:\Users\User\Pictures\cocos專案\人物\甄姬\Agent1工作流\zhen_ji_v1_waist_up_closeup_800x1000_1775032881597_2.png)
    - [zhen_ji_v1_gacha_showcase_800x1000_1775032922679_3.png](C:\Users\User\Pictures\cocos專案\人物\甄姬\Agent1工作流\zhen_ji_v1_gacha_showcase_800x1000_1775032922679_3.png)

## 2. 核心結論

如果目標是 `女武將卡池販售 / 角色詳情主立繪 / 商城高轉化展示`，目前最強仍然是 `PixAI`。

如果目標是 `較穩定、較節省、較快量產概念稿 / 劇情插圖 / 次要資產`，`Gemini Web` 與 `Agent1 工作流` 都有價值，但定位不同：

- `Gemini Web` 比較適合當 `高級歷史感插圖 / 端正國風展示`
- `Agent1 工作流` 比較適合當 `自動化量產概念圖 / 老派國風方向探索 / 批次生產底稿`

一句話總結：

- `PixAI`：最適合賣
- `Gemini Web`：最適合穩品牌氣質
- `Agent1 工作流`：最適合規模化與省成本

## 3. 分項分析

### PixAI

優點：

- 女性角色的 `卡池吸引力` 最強
- 比較容易做出你要的 `高級男性向、成熟、胸腰曲線、偏大漂亮眼睛`
- 在 `GeneralDetail / 卡池 / 商城` 這類 UI 場景，第一眼抓力最好
- 經過 `eye1.1 + identity anchor + 參考圖強度` 調整後，已經開始具備 `同角色穩臉` 的可用流程

缺點：

- 需要較多人工調參與反覆試錯
- 如果 prompt 或 LoRA 沒收好，很容易滑成：
  - 臭臉
  - 空洞眼
  - 廉價性感
  - 服裝開口失控
- 付費壓力明顯，若大量探索會有成本

商業化判斷：

- `最適合` 直接承擔變現主力
- 尤其適合：
  - 卡池女角主立繪
  - 招募展示
  - 商城 bundle / 高價值角色卡面
  - 角色詳情主視覺

### Gemini Web

優點：

- `歷史感 / 端正感 / 高級國風感` 很穩
- 服裝、甲片、材質與裝飾的整體完成度高
- 比較不容易滑成低俗頁遊感
- 視覺上更像「成熟產品插畫」而不是在抽運氣

缺點：

- 女角魅力偏 `端莊與典雅`，不是你現在最需要的 `男性向卡池吸引力`
- 眼神與臉型較保守，較難打出「一眼想抽」的刺激感
- 容易偏向：
  - 古典仕女
  - 歷史系女官
  - 高雅插圖
  而不是主力販售女角

商業化判斷：

- `適合品牌形象與劇情視覺`
- 比較適合：
  - 劇情插圖
  - 女官 / 皇后 / 宮廷角色
  - 官方宣傳圖
  - 偏正統國風的展示頁
- `不建議` 單獨取代 PixAI 去扛卡池變現

### Agent1 工作流

優點：

- 最大優勢是 `自動化與量產能力`
- 方向一致、流程可複製，對專案長期成本有利
- 很有 `老派國風 / 舊式三國插圖 / 水墨概念稿` 的味道
- 如果後續持續調教，適合快速生成大量角色方向探索稿

缺點：

- 目前樣本整體偏 `老派、平、保守`
- 女角的眼睛、臉部精緻度、胸腰曲線商品感，不如 PixAI
- 更像：
  - 概念稿
  - 舊式卡牌插圖
  - 歷史題材插畫
  而不是現在市場最能變現的女武將卡池立繪

商業化判斷：

- `最適合降成本與加速流程`
- 比較適合：
  - 草圖探索
  - 批次產大量概念稿
  - 劇情事件插圖
  - 男武將 / NPC / 次級角色方向探索
- 目前 `不建議` 單獨作為女角卡池最終出圖主力

## 4. 三者對商業化的定位

### 若只看「哪個最會賣」

排序：

1. `PixAI`
2. `Gemini Web`
3. `Agent1 工作流`

### 若只看「哪個最符合你們主要客群的懷舊三國氣質」

排序：

1. `Gemini Web`
2. `Agent1 工作流`
3. `PixAI`

### 若只看「哪個最適合長期大量生產」

排序：

1. `Agent1 工作流`
2. `Gemini Web`
3. `PixAI`

## 5. 專案建議

目前最合理的不是三選一，而是 `分工`。

### 建議分工

- `PixAI`
  - 專門負責 `卡池女角主立繪 / 招募 / 商城高價值圖`
- `Gemini Web`
  - 專門負責 `劇情插圖 / 品牌形象 / 宮廷感較重的正式宣傳圖`
- `Agent1 工作流`
  - 專門負責 `大量概念探索 / 批次生產 / 次要角色 / 風格模板量產`

### 付費決策建議

目前不建議直接停掉 `PixAI`。

原因：

- 你們已經在 PixAI 找到 `甄姬 identity anchor` 與 `穩臉流程`
- 它仍然是目前三條線裡最接近 `高轉化女角商品圖` 的工具
- Gemini 與 Agent1 都很有價值，但暫時還無法完整接替 PixAI 在 `主賣女角` 這個位置

比較務實的作法是：

- 繼續保留 PixAI，但縮小使用範圍
- 只把 PixAI 用在：
  - 真正要上架變現的女角
  - 角色詳情主立繪
  - 招募 / 商城關鍵圖
- 其餘探索與次要資產，優先交給 Gemini Web 或 Agent1

這樣能把 PixAI 的付費成本集中在最值得花錢的地方。

## 6. 下一步

若要正式做付費決策，建議下一輪做同規格對照：

1. 同一個角色，例如甄姬
2. 同一個需求：
   - 主線立繪
   - 半身近景
   - 招募展示卡
3. 三條產線各出一版
4. 用同一張 UI mockup 實際落版比較：
   - `GeneralDetail`
   - `QuickView`
   - `卡池招募頁`

真正影響商業化的，不只是單張圖，而是 `放進 UI 後誰最像會讓玩家想抽`。
