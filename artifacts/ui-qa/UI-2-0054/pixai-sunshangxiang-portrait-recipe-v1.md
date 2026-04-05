# PixAI 孫尚香立繪配方 v1

本文件目標是把甄姬已驗證過的 `Gemini anchor + PixAI polish` workflow，複製到第二位女武將 `孫尚香`，並記錄「泛化角色描述」是否比直接點名角色更穩。

## 角色定位

- 吳國系女武將 archetype
- 比甄姬更有活力、英氣與攻擊性
- 走成年、高級男性向、卡池可販售女角
- 需要有一點女武將曲線鎧甲，但不能落到廉價裸露
- 表情不是冷月疏離，而是：
  - 俏皮
  - 任性
  - 自信
  - 眼神帶一點嚴肅英氣

## 與甄姬的差異化規則

- 甄姬賣點：冷月貴女、疏離、詩意、水感
- 孫尚香賣點：英氣、年輕活力、俐落、自信、帶一點任性
- 甄姬用冷月銀紫
- 孫尚香改用：
  - 暖白
  - 朱紅
  - 赤紅
  - 暖金
  - 深棕 / 黑褐收邊

## Anchor 構圖規格

- 首輪一樣不要直接做完整到腳底的遠距全身
- Gemini anchor 建議構圖：
  - `頭到小腿`
  - 直式 `4:5`
  - 臉占比需明顯高於遠距全身
- 姿勢建議：
  - 身體 3/4 朝向觀者
  - 一腳略前
  - 一手可輕扶腰側或披肩
  - 不拿大武器
  - 不做太激烈戰鬥 pose

## 最新有效的 Gemini 英文描述指令

這版刻意拿掉 `Sun Shangxiang` 與 `Wu kingdom princess` 之類的過強角色標籤，讓模型先穩定生成「對的 archetype」，再由後段 refine 回收成孫尚香語言。

```text
Please generate a near full-body character illustration of a East Asian beauty, from the Three Kingdoms, designed as a stable anchor for a game heroine portrait. She is a noble warrior, not a little girl and not a loli. She should feel youthful, confident, playful, slightly willful, and a little proud, with a lively but serious spirit. She must be attractive and feminine, but also clearly look like a noblewoman who can fight. Make her eyes slightly more serious and determined, with more heroic spirit and noble pride. She must feel warmer, more spirited, more playful, and more assertive than Zhen Ji.

Face and expression:

She is a mature East Asian beauty, around 22 to 28 years old, with refined facial features and beautiful medium-large eyes. Her expression should be playful and slightly willful, but her eyes should carry a touch of seriousness and heroic spirit. She should look confident, spirited, and a little mischievous, not cold like Zhen Ji, not weak, not sickly, not villainous, not childish, and not overly cute. She should feel like a high-class male-oriented collectible heroine with noble pride and energy.

Body:

Adult feminine body, natural C-cup visual silhouette or above, clear chest-waist contrast, elegant and attractive but not vulgar. Her body should feel athletic and healthy, with feminine curves and a slightly stronger presence than a palace noblewoman.

Outfit:

Ancient Chinese warrior-princess clothing, mixing noble dress with refined feminine armor. The design should include tasteful curved female armor lines, a fitted ceremonial breastplate, waist armor, shoulder armor, elegant layered skirts, and princess-like noble detailing. This is not bikini armor and not cheap sexy armor. The armor should emphasize feminine silhouette in a classy way. Main colors should be warm white, vermilion red, muted crimson, warm gold, and touches of dark brown or black for structure. Add jade ornaments, tassels, gold accessories, and fine Chinese decorative details. The overall feeling should be lively, noble, and warlike, but still beautiful and premium.

Hair and accessories:

Long dark brown or black-brown hair, possibly tied in a half-up warrior-princess style or a noble ponytail with ancient Chinese hair ornaments, gold hairpins, tassels, and elegant accessories. Avoid purple hair and avoid a dreamy fantasy goddess look.

Pose and composition:

Near full-body vertical 4:5 composition, showing the character clearly from head to calf. Stable standing pose, body slightly turned in 3/4 view, one leg slightly forward, one hand relaxed near the waist or lightly lifting part of her cape or skirt. No oversized weapon. No extreme action pose. The pose should feel elegant, spirited, and suitable for a game heroine portrait anchor.

Background:

Simple elegant palace terrace, courtyard, or noble architectural background with warm Three Kingdoms atmosphere. Keep the background soft and supportive, not dominant.
```

## Gemini prompt 使用心得

- 拿掉明確角色名與「吳國公主」標籤後，Gemini 的 archetype 更穩
- 臉與服裝不再那麼容易被舊記憶或過度角色模板綁住
- 這版 anchor 已更接近：
  - 英氣女武將
  - 任性俏皮
  - 有武裝感的高級女角

## PixAI 模型與 LoRA 建議

- 模型：`Hoshino v2`
- LoRA 1：`Anime style Girl / semi realistic woman`
  - 強度：`0.18`
- LoRA 2：`eye1.1`
  - 強度：`0.5`
- 參考圖強度：
  - 首輪建議：`0.6`

## PixAI Prompt

這版 prompt 不再把她往冷月貴女拉，而是更明確朝「俏皮任性 + 眼神帶英氣 + 女武將曲線鎧甲」推。

```text
masterpiece, best quality, ultra detailed, sun shangxiang from Three Kingdoms, noble warrior heroine, near full body, elegant standing pose, graceful but spirited, refined mature East Asian beauty, adult woman, noble and feminine, playful and slightly willful expression, slightly serious eyes, confident lively gaze, noble pride, beautiful medium-large eyes, straight elegant brows, soft natural lips, pale luminous skin, refined aristocratic beauty, elegant feminine curves, natural C-cup bust silhouette, refined hourglass figure, graceful chest-waist contrast, tasteful sensuality, high-class feminine appeal, athletic but feminine body line, ancient Chinese warrior-princess outfit, refined feminine armor, tasteful curved female armor lines, fitted ceremonial breastplate, waist armor, shoulder armor, elegant layered skirt, warm white, vermilion red, muted crimson, warm gold details, dark brown and black structural accents, jade and gold ornaments, dark brown hair, black-brown hair, elegant warrior hairstyle, lively noblewoman atmosphere, restrained saturation, historical Chinese heroine atmosphere, designed for game character portrait UI, clean isolated character, minimal plain background, near full figure visible, no high slit, no exposed thigh
```

## Negative Prompt

```text
small eyes, tiny eyes, narrow eyes, sleepy eyes, half-closed eyes, droopy eyelids, angry face, harsh face, villain face, blank stare, lifeless eyes, childish face, overly cute, idol vibe, loli, underage, flat chest, boyish torso, cheap mobile game style, vulgar sexy, exaggerated breasts, bikini armor, high slit, exposed thigh, fantasy goddess, wings, halo, sci-fi, neon colors, modern influencer face, heavy glam makeup, purple hair, dreamy fantasy look, text, watermark, cropped head, bad hands
```

## 這輪輸出評估

檢查資料夾：
- `C:\Users\User\Pictures\cocos專案\人物\孫尚香\Gemini_Generated_Image_x9yofgx9yofgx9yo.png`
- `C:\Users\User\Pictures\cocos專案\人物\孫尚香\from-PixAI-1996071471972544975-0.png`
- `C:\Users\User\Pictures\cocos專案\人物\孫尚香\from-PixAI-1996071471972544975-1.png`
- `C:\Users\User\Pictures\cocos專案\人物\孫尚香\from-PixAI-1996071471972544975-2.png`
- `C:\Users\User\Pictures\cocos專案\人物\孫尚香\from-PixAI-1996071471972544975-3.png`

### 可行結論

- `可行，而且比上一輪更接近目標`
- Gemini anchor 已明顯比上一輪更像英氣女武將
- PixAI 重繪後的服裝鎧甲結構、暖色 family、武裝感都有提升
- 這條 workflow 已證明可從甄姬複製到第二位女武將

### 目前仍有的問題

- 髮尾仍偶爾被 PixAI 拉出一點紫色殘留
- 個別張數仍會偏甜，英氣不夠銳
- 有些版本會稍微 generic 化

### 本輪排序

1. `from-PixAI-1996071471972544975-3.png`
2. `from-PixAI-1996071471972544975-1.png`
3. `from-PixAI-1996071471972544975-2.png`
4. `from-PixAI-1996071471972544975-0.png`

### 是否需要再多產幾批

- `不需要大量重抽`
- 這批已足夠證明流程可行
- 若要進正式母型，建議再補 `1 批` 就好，目標不是改大方向，而是：
  - 壓掉紫髮殘留
  - 讓眼神再多一點嚴肅英氣
  - 讓曲線鎧甲更穩定

## 成功判準

- 臉部穩定，不跑成 generic 美女模板
- 眼睛至少 4 張裡有 1 到 2 張達標
- 構圖保留近全身主立繪完整感
- 與甄姬相比，一眼看得出：
  - 更年輕
  - 更有活力
  - 更有武裝感
  - 但仍然是同一個商業世界觀
