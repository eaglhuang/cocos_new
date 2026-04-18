<!-- doc_id: doc_spec_0172 -->
這是一個非常專業且具備工業級可行性的思路！你的核心邏輯——**「用傳統代碼/向量資料庫做決策，只用 LLM 做最後的『語言修飾』」**——正是目前地端遊戲 AI 最前沿的做法。

要完善這個「最小化 LLM」的 NPC 系統，我們可以從**架構解耦、效能優化、以及行為一致性**三個維度進一步強化。

## ---

**遊戲 NPC 行為與個性化系統架構**

為了達成你的需求，我們將系統分為三層：**記憶層 (Memory)**、**決策層 (Cognition)** 與 **語言層 (Expression)**。

### ---

**1\. 決策層優化：從「向量搜尋」升級為「效能導向的效用 AI (Utility AI)」**

向量搜尋（RAG）適合找「對話內容」，但用來決定「要不要去砍人」可能不夠精確且效能開銷仍高。建議引入 **Utility AI (效用 AI)** 作為輔助：

* **原理**：為每個行為（Action）寫一個簡單的數學公式，根據 NPC 的「人格係數」與「環境數值」算出得分。  
* **公式示例**：  
  $$Score \= (Weight\_{Personality} \\times Value\_{Environment}) \\times Mood\_{Modifier}$$  
* **優點**：這是純數學運算，一秒鐘可以跑幾萬次，完全不佔用 GPU。  
* **與 LLM 連動**：當 Utility AI 決定了行動（例如：Action: Trade）後，再將這個結果作為 Intent 丟給 LLM 去生成對話。

### **2\. 記憶層：短暫記憶與長期記憶的分離**

為了讓 NPC 有「思維判斷」，他必須記得你剛才對他做了什麼。

* **感官黑板 (Blackboard System)**：  
  * 這是一個暫存區，記錄 NPC 視野內「現在」發生了什麼（例如：玩家正拿著刀、玩家剛說了髒話）。  
  * 這是 NPC 決策的最直接依據。  
* **向量長期記憶 (Vector RAG)**：  
  * 只在玩家「發起對話」或「觸發重大事件」時調用。  
  * **優化技巧**：不要檢索整個資料庫，只針對該玩家的 PlayerID 進行 Metadata 過濾，搜尋速度會提升數倍。

### **3\. 語言層：極小模型的選擇與「預計算 (Prefix Caching)」**

既然 LLM 只是負責「翻譯」，你完全不需要 7B 或 14B 的模型。

* **模型建議**：  
  * **Qwen2-0.5B / 1.5B** 或 **Phi-3-mini**：這些模型在 4-bit 量化後，顯存佔用極低（不到 1GB），且在有限的 Prompt 指令下，語言風格非常穩定。  
* **核心技術：Prefix Caching (前綴緩存)**：  
  * 200 個 NPC 其實共享 80% 的 System Prompt（遊戲世界觀、基礎規則）。  
  * 使用支援 KV Cache 共享的推論引擎（如 vLLM 或 llama.cpp），這 80% 的內容只需要計算一次。這能將推論速度提升 2\~3 倍。

### ---

**4\. 配套技術：如何用「代碼」做輔助判斷？**

為了達到「最少利用地端 AI」，你可以實作一個 **「意圖過濾器 (Intent Filter)」**：

1. **關鍵字過濾**：如果玩家問的是遊戲功能（如「怎麼存檔？」、「地圖在哪？」），直接用傳統的 Regex 或關鍵字匹配，跳過 LLM，直接回傳預設對話。  
2. **狀態機器 (FSM)**：NPC 的日常行為（走動、睡覺）由狀態機控制。只有當狀態機進入「對話態」或「衝突態」時，才喚醒 LLM 服務。  
3. **非同步隊列 (Async Queue)**：  
   * 不要讓 200 個 NPC 同時去搶 GPU。  
   * 建立一個優先級隊列。玩家眼前的 NPC 優先級最高，遠處的 NPC 若需要產生對話，可以延遲 0.5 秒生成，玩家完全感覺不出來。

### ---

**5\. 實作邏輯範例 (Python/C\# 虛擬碼)**

這是一個結合了人格、情緒與環境的決策流程：

Python

def npc\_tick(npc, player\_action):  
    \# 1\. 傳統代碼過濾（快速、零成本）  
    if is\_essential\_function\_query(player\_action):  
        return get\_static\_response(player\_action)

    \# 2\. Utility AI 計算行為得分 (純數學)  
    \# 假設玩家試圖砍價  
    trade\_score \= (npc.greed \* 0.8) \+ (npc.mood \* 0.2)  
    anger\_score \= (npc.aggression \* 0.9) \- (npc.fondness\_to\_player \* 0.5)

    \# 3\. 決定行為  
    chosen\_action \= "Angry\_Refuse" if anger\_score \> trade\_score else "Negotiate"

    \# 4\. 只有當需要表現「靈魂」時，才調用 LLM  
    \# 傳給 LLM 的 context 被壓縮到極致  
    dialogue \= llm\_generate(  
        f"NPC:{npc.name}, Personality:{npc.voice\_tag}, Action:{chosen\_action}, Mood:{npc.mood}"  
    )  
    return dialogue

### **總結建議：**

1. **模型端**：鎖定 **1.5B 以下** 的模型。  
2. **架構端**：用 **Utility AI** 做骨架，用 **LLM** 做皮膚。  
3. **記憶端**：向量資料庫只存「關鍵事件」，不要存「每一句廢話」。  
4. **開發工具**：推薦使用 **ChromaDB**（地端極輕量向量庫）+ **llama.cpp**（支援超低顯存運行）。

這樣即便在一般的開發者電腦上，你也能讓這 200 個 NPC 顯得「有血有肉」，且遊戲 FPS 不會掉到個位數。針對這些技術細節，有沒有哪一個部分是你目前在實作上遇到比較大阻礙的？