<!-- doc_id: doc_spec_0090 -->
這是一份根據最新視覺進度調整後的 **AAA 級最終繪圖指令 (Ultimate Prompt)**。我已經精確修正了主將與小兵的比例限制，並移除了所有干擾性的開發字樣（A、B、C、D），同時保留了您對 UI 質感與戰場融合度的高度要求。

# ---

**🎨 《三國傳承》核心戰鬥畫面：最終視覺規格書 (Final Production Prompt)**

## **1\. 核心構圖與攝影機參數 (Camera & Composition)**

* **視角定位**：固定 2.5D Isometric 視角，攝影機向下俯視 **40 度**。  
* **戰術棋盤**：畫面中央為一個 **5x8（5 列 8 行）** 的石磚棋盤格。格線刻印在飽經戰火的黃土地表，與風化的碎石、灰塵、血跡自然融合，不具備漂浮感。  
* **視覺重心**：棋盤佔據畫布中心約 **65%** 區域，對角線由左下延伸至右上。

## **2\. 單位比例與立牌系統 (Unit Scale & Scale Ratio)**

* **實體厚度感**：所有角色均為具備 2cm 厚度質感的精美「立牌」，底座為沉穩的圓形石盤/金屬盤。  
* **精確比例 (Important\!)**：  
  * **主將規模**：雙方主將（左下張飛、右上曹操）的大小設定為**一般小兵的 2 倍高度**。嚴格禁止超過 3 倍，以維持戰場寫實感。  
  * **小兵規模**：包含步兵、盾兵、弓兵、騎兵。其中**藍色騎兵與紅色騎兵的大小必須完全對稱一致**。盾兵大小應與一般步兵持平。  
* **角色細節**：  
  * **我方 (左下)**：張飛立牌，手持丈八蛇矛，綠色鬥氣粒子特效，金色圓盤底座。  
  * **敵方 (右上)**：曹操立牌，暗紅色華麗長袍，黑色玄武岩底座。

## **3\. UI 布局與質感 (High-End Screen-Space UI)**

* **左方兵種按鈕 (Expanded)**：垂直排列的寬版按鈕，寬度為一般按鈕的兩倍。**兵種精美圖片佈滿整個按鈕背景**，兵種文字（步兵、槍兵等）以精緻書寫體半透明覆蓋於按鈕底沿。  
* **右下操作區 (Fatal Four)**：四顆垂直排列矩形按鈕，質感為「重金屬鑄造與古玉鑲嵌」。  
  1. **計謀策略**  
  2. **武將單挑**  
  3. **發動技能**（琥珀質感，金光滿溢）  
  4. **回合結束**  
  * 按鈕左側有一根垂直的琉璃技能能量條，內部噴發金色粒子。  
* **中上狀態欄**：極細長的戰力比較條（左藍右紅）。**條狀正下方標註「第10回合：我方」字樣。**  
* **下方支援列**：五個水平排列小頭像。**第四個位置顯示醒目的「上鎖狀態」鎖頭圖示。**

## **4\. 特效與環境裝飾 (FX & Environment)**

* **技能特效 (Active FX)**：畫面中增加一些兵種技能表現，例如弓兵射出的流光箭矢、步兵周圍的半透明防禦護盾粒子、或騎兵衝鋒留下的塵土軌跡。  
* **懸浮 Buff**：棋盤格上方懸浮綠色「攻 X 2」與紅色「攻 / 2」粒子文字，帶有數位擴散煙霧。  
* **環境物件**：棋盤邊緣散落斷裂旗幟、殘破盾牌、插在土裡的長槍，與背景遠方的史詩古城煙硝融為一體。

## **5\. 視覺清晰度 (Visual Sanitization)**

* **完全清除**：畫面上嚴禁出現任何 A.1, B.1, C, D 或 等開發輔助文字。  
* **色彩層次**：武將與特效（高飽和） \> 棋盤與小兵 \> 戰場雜物 \> 遠景（低對比、大氣透視）。

### ---

**💡 AI 繪圖建議咒語 (Midjourney / SDXL):**

AAA mobile game UI screenshot, Three Kingdoms war, 2.5D isometric, 5x8 tactical grid carved on dusty battlefield ground. Premium acrylic character standees. Scale Ratio: Generals are exactly 2 times the size of soldiers. Blue cavalry and red cavalry must be identical in size. Left-bottom: Zhang Fei (Green aura). Right-top: Cao Cao (Red aura). FX: magic arrows and glowing shields on soldiers. UI: wide troop buttons on left with full-size illustrations. Bottom-center bar text: "第10回合：我方". Bottom-right: 4 ornate heavy metal buttons with golden energy tube. Cinematic lighting, Unreal Engine 5 render, 8k, no letters A B C D.

**主公，這份規格書已經將比例與細節精確鎖定。您貼給 AI 後，是否需要我預備一份「戰鬥結算畫面」的 UI 布局描述？**