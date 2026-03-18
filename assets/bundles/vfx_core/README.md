# 核心特效積木庫 (VFX Core Bundle)

為了確保未來的特效能夠「被隨時組合、共用與釋放」，避免專案美術素材混亂，我們設立了 **VFX Core** 的特效積木架構。將所有從其他專案或未來新增的技能表現，拆解為最底層的「積木」，並封裝成小特效。

---

## 1. 剛搬入的技能特效 (已封裝為小特效積木)

目前我們從外部專案搬入的「狀態與增益/減益特效」資源已全數整理至此 Bundle 內，並透過代碼與 Shader 封裝成一套**「2.5D 狀態特效積木 (Status Effect Block)」**。

### 🧩 積木素材分類 (Asset Blocks)
這些素材不再是寫死給某一招技能，而是可以因應需求自由組合的「積木」：
- **`rings/` (法陣底座)**：支援自訂旋轉與發光。現有積木有 `tex_ring_addatk.png` (攻擊陣), `tex_ring_addlife.png` (治癒陣)。
- **`icons/` (中心主圖示)**：懸浮於單位上方的核心標誌。現有積木有 `tex_icon_addatk.png` (劍), `tex_icon_addlife.png` (愛心)。
- **`shapes/` (動態箭頭與符號)**：輔助說明的動態元素。現有積木有 `tex_shape_arrow_addatk.png` (單箭頭), `tex_shape_arrow_addlife.png` (雙箭頭)。

### ⚙️ 封裝組件 (Effect Component)
- **實作核心**: `BuffGainEffectPool.ts` 與專屬 Shader `vfx-buff-quad.effect`。
- **封裝概念**: 
  - 這套機制已經完全擺脫傳統 Cocos Sprite 或 Unity Canvas 的依賴，直接在 3D 空間內動態生成 Quad Mesh。
  - **模組化輸入**：只要傳入 `(Ring貼圖, Icon貼圖, Arrow貼圖, 顏色, 往上/往下)` 這五個參數，組件就會自動將其合成為一組擁有「法陣旋轉、圖示拋物線彈出、箭頭漂浮、漸隱與外發光(Outer Glow)」的完整小特效。
- **目前的積木實例 (Instances)**：
  1. **攻擊提升 (AtkGain)**：攻擊陣 + 劍圖示 + 單箭頭(向上) + 暖色調。
  2. **攻擊下降 (AtkLoss)**：攻擊陣 + 劍圖示 + 單箭頭(向下反轉) + 紅色調。
  3. **生命回復 (HpGain)**：治癒陣 + 心圖示 + 雙箭頭(向上) + 綠色螢光調。
  4. **受傷/扣血 (HpLoss)**：治癒陣 + 心圖示 + 雙箭頭(向下反轉) + 紅色調。

---

## 2. 特效積木的擴充與共用機制 (VFX Scalability)

為了維持架構彈性，未來任何新加入的技能特效，都必須遵守「特效積木」的歸檔與封裝流程。

### A. 為什麼要把特效拆成積木？ (Unity 的思維對照)
在 Unity 中，如果每個英雄的「開盾」都做一組全新的 Particle System Prefab，專案很快就會暴增上百個 Prefab，且材質(Materials)會大量重複。
我們現在的做法相當於：**把特效拆解為共用的 Texture 與 Shader (積木)，在 Runtime 時才透過配置檔去組合出最終的視覺**。這不僅做到資源極致複用，未來企劃想配出「防禦提升」的特效，只要拿「治癒陣 + 盾牌圖示 + 向上箭頭 + 藍色」即可瞬間完成。

### B. 後續擴充 SOP
未來拉入其他專案的特效時，請依照以下步驟歸檔：

1. **視覺拆解**：
   - 審視該特效是否可拆分成通用元素（例如：這個衝擊波的「底圖」是不是可以給其他技能當地裂使用？）。
   - 將拆下來的貼圖歸類至 `textures/` 下的對應分類 (`rings`, `icons`, `shapes`, 或新增 `trails` 拖尾、`particles` 粒子)。
2. **特效封裝 (Prefab / Script)**：
   - 將視覺機制封裝成如 `BuffGainEffectPool` 這種能接收外部參數的腳本，或者做成不含業務邏輯的 Prefab，由 `EffectSystem` 統一調度。
3. **註冊為積木指令**：
   - 在未來的技能設定檔 (JSON) 與 `EffectSystem` 內打通對接，確保這塊新積木能被其他業務邏輯透過代碼指令（如 `show_status_effect`、`play_trail`）直接釋放。