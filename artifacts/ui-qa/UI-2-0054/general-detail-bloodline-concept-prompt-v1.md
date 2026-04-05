# 武將人物介紹示意圖 Gemini Prompt v1

這份文件不是正式 UI 定稿，而是給 Gemini Web 產出 `武將人物介紹示意圖` 的視覺 proof。

目的只有一個：

- 先驗證「角色主立繪 + 血脈面提示 + 歷史趣聞 / 血脈傳聞抽屜」這條方向，能不能在單張概念圖上成立。

## 目標畫面

- 畫面類型：`GeneralDetail / 武將人物介紹主畫面概念圖`
- 構圖方向：`左人物、右資訊、下方故事抽屜`
- 用途：只驗證 UI 分區、資訊密度、血脈世界觀元素是否成立
- 不驗證項目：最終字型、最終 icon、最終 shader、最終材質品質

## 版型規格

- 畫布比例：`16:9`
- 角色區：
  - 角色放左側約 `44%~48%` 寬
  - 人物為 `頭到小腿` 的近全身主立繪
  - 人物需佔角色區寬度約 `72%~78%`
- 資訊區：
  - 右側為角色名稱、稱號、稀有度、血統摘要、六色因子、戰法摘要
  - 右側資訊卡不應過度科幻，不用 HUD 線條
- 故事區：
  - 下方有一個可上滑 / 可展開的故事抽屜
  - 抽屜內有兩個明顯標籤：
    - `歷史趣聞`
    - `血脈傳聞`
  - 抽屜內容只需示意 `3 格靜態連環漫畫` 或 `漫畫縮略卡`

## 世界觀元素要求

- 角色主體仍然要好看、可賣，不可為了世界觀把人物做醜
- 人物身上必須可見 `祖紋命篆` 或 `命紋靈獸` 對應符號
- 人物上方或後方可以有淡淡的 `命紋靈獸虛影`
- 整體要有「表象面 + 血脈面」的雙層感，但不能做成恐怖或怪物化
- 氣質應偏 `古老、高級、神祕、帶血脈宿命感`
- 禁止做成：
  - 科技基因實驗室
  - 賽博 HUD
  - 西方奇幻召喚獸
  - 恐怖污染或裂臉

## Gemini 英文 Prompt

```text
Please generate a polished game UI concept illustration for a character detail screen in a Three Kingdoms fantasy strategy game. This is not a final production UI, but a high-quality concept mockup that shows the layout, visual hierarchy, and worldbuilding direction.

The screen should be in a 16:9 horizontal composition. The left side contains a near full-body character portrait, shown from head to calf, occupying about 45% of the screen width. The character should feel premium, collectible, elegant, and heroic. The right side contains structured information panels for the character name, title, rarity, bloodline summary, six-color factors, and combat traits. The bottom area contains a sliding story drawer with two visible tabs: one for historical anecdotes and one for bloodline rumors. Inside the drawer, show a small 3-panel static comic preview instead of long text.

The UI style should feel like ancient Chinese noble strategy game design with premium detail, subtle paper texture, jade-white, moon-silver, dark gold, ink green, and muted red accents. Avoid sci-fi HUD lines, cyberpunk interfaces, modern tech panels, or generic fantasy magic circles. The interface should feel elegant, readable, and premium, not overloaded.

Important worldbuilding elements:
- the character should have visible ancient sigil motifs on armor, belt, hair ornaments, jade pendant, or decorative accessories
- a faint ancestral beast spirit silhouette should appear above or behind the character
- the screen should imply two layers of identity: the public heroic self and the hidden bloodline self
- this bloodline feeling should be ancient, mysterious, noble, and fateful, not horror, not mutation, not monster transformation

The bottom story drawer should clearly show two sections:
- historical anecdote
- bloodline rumor

The overall UI should communicate that this is not just a normal Three Kingdoms gacha game, but a game about family lineage, ancestral destiny, inherited bloodlines, and heroic legacy.

Keep the layout clear and practical, like a believable game interface concept, not just an illustration poster.
```

## 建議 Negative Prompt

```text
sci-fi HUD, cyberpunk UI, futuristic lab, horror corruption, monster face, split face horror, western fantasy dragon, glowing neon circuitry, anime mobile homepage clutter, tiny unreadable UI, overly dense text wall, purple magic portal, demon wings, creepy mutation, grotesque anatomy, grotesque beast, cheap page game UI
```

## 建議首批測試角色

- `趙雲`
  - 最適合驗證「英雄光明面 + 血脈面」是否成立
- `甄姬`
  - 最適合驗證「女角商品感 + 血脈宿命感」能否共存
- `孫尚香`
  - 最適合驗證「英氣女武將 + 血脈符號 + UI 張力」

## 我建議你先怎麼測

第一輪先不要要求太多角色專屬細節，先看大方向：

1. 先用 `趙雲` 跑一張整體 UI 概念圖
2. 檢查這 5 件事：
   - 左右分區是不是清楚
   - 下方故事抽屜是不是成立
   - 命紋靈獸虛影會不會太奇幻
   - 祖紋命篆會不會太像科技符文
   - 整體還像不像真正可用的遊戲人物介面
3. 如果第一張方向成立，再分別做女角版與不同武將版

## 驗收標準

- 拿掉 Logo 後，觀者應看得出這是 `人物介紹介面`，不是海報
- 觀者應能看出這個遊戲重點是 `血脈 / 家族 / 傳承`
- 角色仍要有商品感，不能因世界觀元素而失去卡池吸引力
- UI 必須是可讀、可分區、可延伸的，不只是好看概念圖
