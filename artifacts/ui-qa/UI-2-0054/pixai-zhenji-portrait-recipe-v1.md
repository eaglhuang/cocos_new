# PixAI 甄姬立繪配方 v1

本文件已從「單次 prompt 測試」升級為「甄姬穩臉 workflow 記錄」。目前最重要的結論不是單一咒語，而是：

- `Hoshino v2 + eye1.1` 可把眼睛拉回可用區
- 參考圖其實是 `identity lock`
- 最穩的主立繪參考圖不是半身，也不是完整到腳底的全身，而是 `近全身 / 頭到小腿`

## UI 版位判斷

- 用途：`GeneralDetail / GeneralPortrait` 主立繪
- 最佳參考圖構圖：`頭到小腿` 的近全身 anchor
- 不建議預設參考圖：
  - 純半身：臉很穩，但容易失去主立繪完整比例
  - 到腳底的完整全身：身體穩，但臉和眼睛容易模板化
- 建議比例：先出 `4:5`，之後再裁成 `1024x1024` 透明底
- 安全空間：角色腳下可略裁，但小腿以下仍應保留足夠裙擺與下身資訊
- 色調：魏國冷色系，銀白、淡紫、月白、冷金；避免大面積桃粉、暖橘

## 模型與 LoRA 結論

### PixAI 主模型

- 主推：`Hoshino v2`
- 次選：`Hoshino`
- 備用：`Haruka v2`
- 暫不建議拿 `Tsubaki.2` 當甄姬主底模

### 已驗證可用的 LoRA 組合

- `Anime style Girl / semi realistic woman`
  - 建議強度：`0.18`
- `eye1.1`
  - 已驗證比 `beautiful eyes` 與 `Concept Perfect Eyes XL` 更適合甄姬
  - 建議強度：`0.5`

### 不建議的做法

- 同時疊多個「整臉 / 美女 / 寫實女人」LoRA
- 在 prompt 裡塞太多眼型術語
- 用過高參考圖強度把構圖完全交給參考圖

## 甄姬角色定位

- 魏國冷月貴女，不是戰場主攻型女將
- 古典宮廷貴女結合儀式型輕甲
- 現代感放在妝容、膚質、五官修飾，不放在髮型與服裝輪廓
- 商業化訴求為成年、高級男性向、自然 `C cup` 以上視覺曲線
- 冷感應來自氣質與距離感，不應靠瞇眼、臭臉或病弱感達成

## 已驗證的 prompt 基線

### Prompt

```text
masterpiece, best quality, ultra detailed, zhen ji from Wei kingdom, Three Kingdoms noblewoman, full body, elegant standing pose, graceful and alluring, refined mature East Asian beauty, adult woman, noble and feminine, calm noble temperament, poised and emotionally restrained expression, beautiful medium-large eyes, gentle but distant gaze, calm and confident expression, soft upper eyelid fold, straight elegant brows, soft natural lips, pale luminous skin, slightly more mature face, more noble elegance, more refined aristocratic beauty, gentle melancholic expression, graceful and unattainable noblewoman, elegant feminine curves, natural C-cup bust silhouette, refined hourglass figure, graceful chest-waist contrast, tasteful sensuality, high-class feminine appeal, graceful mature bust line, elegant fitted chest silhouette, Wei palace noble lady, ceremonial light armor mixed with ancient Chinese court dress, fitted ceremonial bodice, silver-white and pale lavender long gown, moon-white silk, cool purple inner layers, cold gold details, delicate metal waist ornament, elegant layered floor-length skirt, no high slit, no exposed thigh, jade and pearl ornaments, phoenix hairpin, long black hair, luoshen-inspired grace, poetic sorrow, water-like elegance, cool moonlight tone, restrained saturation, historical Chinese noblewoman atmosphere, designed for game character portrait UI, clean isolated character, minimal plain background, full figure visible, bottom grounded silhouette
```

### Negative Prompt

```text
small eyes, tiny eyes, narrow eyes, sleepy eyes, half-closed eyes, droopy eyelids, angry face, mean face, harsh face, bitter expression, villain face, smug face, blank stare, lifeless eyes, childish face, overly cute, teen idol vibe, flat chest, boyish torso, childlike body, loli, underage, petite child proportions, doll face, plastic skin, heavy glam makeup, glossy beauty ad face, modern influencer face, playful smile, cheerful idol vibe, fashion model pose, overly seductive expression, vulgar sexy, exaggerated breasts, bikini armor, high slit, exposed thigh, wings, halo, fantasy goddess, phoenix wings, glowing eyes, sparkling eyes, star eyes, spiral eyes, crystal eyes, cheap mobile game style, sci-fi, neon colors, text, watermark, cropped head, cropped feet, bad hands
```

## 參考圖工作流結論

### identity anchor

- 可先用單張較成功的甄姬臉當 `identity anchor v1`
- 已驗證代表圖：
  - `C:\Users\User\Pictures\cocos專案\人物\甄姬\eye1.1\from-PixAI-1995992951636191160-2.png`

### 參考圖強度

- `0.55 ~ 0.7`
  - 主線立繪穩定區
- `0.8 ~ 0.9`
  - 比較像同角色變體 / 展示圖 / 活動卡
  - pose 與開口容易失控

### 參考圖裁切規則

- 半身 anchor：
  - 臉最穩，適合卡池展示、角色卡、大頭圖
- 近全身 anchor：
  - `目前主立繪最佳解`
  - 建議人物從頭到小腿，不要直接到腳底
- 完整全身 anchor：
  - 只在真的需要完整裙擺落地終點時使用
  - 臉在畫面中的權重太小時，PixAI 會把臉與眼睛模板化

## Gemini + PixAI 混合流程結論

### Gemini 的角色

- 負責穩住：
  - 臉
  - 上半身 pose
  - 服裝結構草圖
- 特別適合先做：
  - 半身 anchor
  - 近全身 anchor

### PixAI 的角色

- 負責拉高：
  - 材質
  - 布料光澤
  - 金屬細節
  - 卡池商品感

### 正式建議流程

1. 先用 Gemini 產出 `頭到小腿` 的甄姬 anchor
2. 再丟 PixAI，以 `Hoshino v2 + Anime style Girl 0.18 + eye1.1 0.5`
3. 參考圖強度先從 `0.6` 測起
4. 每輪出 4 張，接受 `3 張出 1 張好圖` 的可商用抽樣率

## 本輪驗證心得

- 甄姬這條線已不再是純 prompt 抽卡，而是可重複的 workflow
- `近全身 anchor + ref 0.6` 是目前最值得複製到其他女武將的規格
- 下一步應該把這條流程複製到第二位女武將，驗證通用性
