# Skill: general-avatar-crop

武將頭像裁切工作流程。從立繪 PNG 裁切 256×256 頭+脖子頭像，並自動套用到戰場 HUD 左上角（主將）與右上角（敵將）。

---

## 概覽

| 項目 | 說明 |
|------|------|
| 輸入 | `assets/resources/sprites/generals/{id}_portrait.png` |
| 設定 | `assets/resources/data/general-avatar-crops.json` |
| 輸出 | `assets/resources/sprites/generals/avatars/{id}_avatar.png` |
| 尺寸 | 256×256 px（固定正方形） |
| 演算法 | Box-filter 面積平均縮放（pngjs，純 JS） |

HUD 載入優先順序：**avatar → portrait → placeholder**（`BattleHUDComposite._applyPortrait`）

---

## 快速操作

```bash
# 產生所有武將頭像
node tools_node/generate-general-avatars.js

# 只產生指定武將
node tools_node/generate-general-avatars.js cao-cao

# 驗證設定，不寫檔
node tools_node/generate-general-avatars.js --verify
```

---

## 新增武將頭像 SOP

### 1. 確認立繪存在

```
assets/resources/sprites/generals/{generalId}_portrait.png
```
命名規則：kebab-id 轉底線，例如 `cao-cao` → `cao_cao_portrait.png`。

### 2. 量測裁切座標

打開立繪，在影像編輯器（Photoshop / GIMP / Preview）中：
- 找到頭頂（含頭冠/羽毛/髮飾，要完整）
- 找到脖子/鎖骨底部
- 記錄 **x, y, w, h**（從圖像左上角算起，像素為單位）

重點：
- `y` 通常設 `0`，讓頭冠從最頂端開始
- `w/h` 比例接近 1:1 效果最好（縮放成正方形時不會歪斜）
- 頭偏一側時，`x` 向同側補償，使頭置中

### 3. 寫入裁切設定

編輯 `assets/resources/data/general-avatar-crops.json`：

```json
{
  "version": 1,
  "outputSize": 256,
  "crops": {
    "new-general": { "x": 150, "y": 0, "w": 500, "h": 480,
      "$note": "立繪尺寸 720×1280，站立姿，頭居中" }
  }
}
```

### 4. 驗證設定

```bash
node tools_node/generate-general-avatars.js new-general --verify
```
確認輸出無 `❌` 錯誤，特別檢查 `x+w` 是否超出圖寬、`y+h` 是否超出圖高。

### 5. 執行生成

```bash
node tools_node/generate-general-avatars.js new-general
```

### 6. 視覺驗收

開啟輸出的 `assets/resources/sprites/generals/avatars/new_general_avatar.png`：
- 頭頂完整（含冠、羽毛、髮飾）
- 脖子可見，下緣約到鎖骨/胸口
- 臉部不偏離中央太多

若不滿意，調整 `general-avatar-crops.json` 中的 x/y/w/h，重新執行步驟 4–6。

### 7. Cocos Creator 匯入

在 Cocos Creator 中對 `assets/resources/sprites/generals/avatars/` 按右鍵 → **Refresh Assets**，讓 `.meta` 更新。

---

## HUD 接線說明

`BattleHUDComposite.setPlayerGeneralId(generalId)` / `setEnemyGeneralId(generalId)` 傳入 kebab-id（例如 `"cao-cao"`）。

內部 `_applyPortrait` 自動依序嘗試：
1. `sprites/generals/avatars/{id}_avatar`（256×256 頭像）
2. `sprites/generals/{id}_portrait`（完整立繪）
3. `sprites/battle/portrait_player_placeholder` / `portrait_enemy_placeholder`

戰場左上角 = Player（主將）、右上角 = Enemy（敵將）。

---

## 現有武將裁切座標

| 武將 | 立繪尺寸 | x | y | w | h | 說明 |
|------|----------|---|---|---|---|------|
| cao-cao | 1024×1024 | 200 | 0 | 600 | 500 | 寬冠+披風，正中站立 |
| guan-yu | 768×1377 | 84 | 0 | 600 | 520 | 龍飾頭盔，細長直式 |
| lu-bu | 720×1280 | 110 | 0 | 500 | 530 | 超高紅羽毛，y 必須從 0 開始 |
| zhang-fei | 720×1280 | 100 | 0 | 520 | 480 | 蹲踞姿，頭巾寬 |
| zhao-yun | 1024×1024 | 100 | 0 | 800 | 500 | 衝刺動作，長髮橫飛 |
| zhen-ji | 447×559 | 50 | 0 | 347 | 280 | 小圖，正中站立 |

---

## 相關檔案

- `assets/resources/data/general-avatar-crops.json` — 裁切座標設定真相來源
- `tools_node/generate-general-avatars.js` — 生成工具
- `assets/scripts/ui/components/BattleHUDComposite.ts` — HUD 接線（`_applyPortrait`）
- `assets/resources/sprites/generals/avatars/` — 輸出目錄
