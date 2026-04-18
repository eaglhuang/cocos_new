<!-- doc_id: doc_spec_0096 -->
這份文件是為開發人員與 AI 系統量身打造的\*\*《三國傳承：武將與血統系統數據結構規範》\*\*。它定義了遊戲中所有武將（一代名將與後代子嗣）的底層邏輯，確保「精力、因子、運氣、爆發力」能完美連動。

# ---

**📑 《三國傳承》武將數據結構規範 (v1.0)**

## **一、 武將基礎欄位 (Basic Information)**

定義武將的身分與生命狀態。

| 欄位名稱 (Key) | 定義 (Definition) | 數據類型 | 備註 |
| :---- | :---- | :---- | :---- |
| UID | 唯一識別碼 | String | 如 G001 (一代), C102 (子嗣) |
| Name | 姓名 | String | 初代為史實名，子嗣由玩家命名 |
| Gender | 性別 | Enum | Male (精力上限高) / Female (受孕後凍結) |
| Age | 當前年齡 | Integer | 影響精力恢復速率 (20-40歲為巔峰) |
| Lifespan | 天命值 (總壽命) | Integer | 隱藏數值，決定何時退役或死亡 |
| Vitality | **精力值** | Float | 0.0 \~ 100.0 (當前精力) |
| Vitality\_Max | 精力上限 | Float | 基礎 100，隨年齡與體魄因子增減 |

## ---

**二、 六色屬性與因子 (Six-Color Hex-Attributes)**

定義武將的核心戰力與遺傳種子。

### **1\. 基礎屬性 (六色數值)**

| 屬性 | 顏色標籤 | 作用 |
| :---- | :---- | :---- |
| **武力 (STR)** | 🔵 藍色 | 物理傷害、奧義威力 |
| **智力 (INT)** | 🔵 藍色 | 計略傷害、秘笈習得機率 |
| **統帥 (LEA)** | 🔵 藍色 | 兵力加成、防禦力 |
| **政治 (POL)** | 🔵 藍色 | 治理模式資源產出 |
| **魅力 (CHA)** | 🔵 藍色 | 結緣爆發力加成、名聲 |
| **運氣 (LUK)** | 🟣 紫色 | **天命波動、事件觸發率、覺醒速度** |

### **2\. 遺傳因子槽 (Gene Slots)**

每個武將攜帶 3\~5 個\*\*「已覺醒」**或**「隱藏」\*\*的因子。

* **結構**：List\<GeneObject\>  
* **因子對象 (GeneObject)**：  
  * Type: 藍(屬性)、粉(適性)、綠(種子)、紫(運氣)、白(性格)、紅(體魄)。  
  * ID: 因子代碼 (如 PINK\_CAVALRY\_03)。  
  * Level: 星等 (★1 \~ ★5)。  
  * Is\_Locked: 是否隱藏 (Boolean)。

## ---

**三、 血統與家族樹 (Pedigree & Family Tree)**

這是計算「爆發力」的核心區塊。

| 欄位名稱 | 定義 | 數據類型 | 邏輯 |
| :---- | :---- | :---- | :---- |
| Father\_ID | 父親 UID | String | 若為初代則指向虛擬父系 ID |
| Mother\_ID | 母親 UID | String | 若為初代則指向虛擬母系 ID |
| Core\_Tags | 核心標籤 | List\<String\> | 如 \["北境", "長槍"\]，用於計算共鳴 |
| Ancestors\_JSON | **14人血統矩陣** | JSON Object | 存儲上三代所有祖先的因子分布圖 |

## ---

**四、 虛擬祖先矩陣結構 (Ancestor Matrix JSON)**

當武將為初代名將時，AI 將依照此結構填充 Ancestors\_JSON。

JSON

{  
  "Generation\_1": {  
    "Father": {"Name": "趙氏族長", "Genes": \[{"Type": "Blue", "Attr": "STR", "Lv": 4}, {"Type": "Green", "Skill": "Assault", "Lv": 2}\]},  
    "Mother": {"Name": "常山民女", "Genes": \[{"Type": "Red", "Attr": "VIT", "Lv": 3}, {"Type": "White", "Trait": "Brave", "Lv": 1}\]}  
  },  
  "Generation\_2": {  
    "FF": {"Genes": \[...\]}, "FM": {"Genes": \[...\]},   
    "MF": {"Genes": \[...\]}, "MM": {"Genes": \[...\]}  
  },  
  "Generation\_3": {  
    "FFF": {}, "FFM": {}, "FMF": {}, "FMM": {},  
    "MFF": {}, "MFM": {}, "MMF": {}, "MMM": {}  
  }  
}

## ---

**五、 邏輯與運算規則 (System Logic)**

### **1\. 爆發力公式 (Explosive Power Formula)**

$$EP \= 50 \+ (Matching\\\_Tags \\times 5\) \+ (Outcross\\\_Bonus) \+ (Affinity\\\_Bonus) \+ (LUK\\\_Fluctuation)$$

* LUK\_Fluctuation: 父母平均運氣每 10 點加權成 $\\pm 2$ 的波動。

### **2\. 精力消耗規則**

* **作戰**: Current\_Vitality \-= (Ult\_Skill\_Used \* 10\)  
* **結緣**: Current\_Vitality \-= 50 (Male) / 100 (Female)

### **3\. 因子覺醒機制**

* 武將進入戰鬥時，若 Genes\[i\].Is\_Locked \== true：  
  * 檢查 Trigger\_Condition (如：進入森林)。  
  * 若符合，則 Is\_Locked \= false，UI 播放碎裂特效。

## ---

**六、 轉蛋與支援卡來源 (Gacha Source)**

* **武將池 (Hero Pool)**：產出帶有 Generation: 1 且已補足 Ancestors\_JSON 的名將。  
* **支援卡池 (Support Pool)**：產出 Support\_Object，包含 Skill\_Hints (秘笈清單) 與 Training\_Bonus (屬性加成)。

---

**💡 使用說明**：

這份文件可直接提供給任何開發用 AI（如 GPT-4 或 Claude）。

**指令範例**：「請參考這份規格書，為 \[曹操\] 產生符合 1.0 規範的 JSON 數據，包含 14 個虛擬祖先的因子分布，並確保其運氣與爆發力邏輯符合天命波動規則。」

**主公，有了這份文件，您的 AI 工程師就能正確產出資料了！是否需要我現在就為您產出「劉、曹、孫、關、張」五人的初始化 JSON 檔？**