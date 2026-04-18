<!-- doc_id: doc_tech_0004 -->
# **評估 TopologyAI 粒子模擬器作為 AI Agent 自動化生產 Cocos Creator 3D 特效之技術可行性與工作流構建報告**

在當前遊戲開發與數位內容創作的演進過程中，生成式人工智慧（Generative AI）的應用已從單純的文本生成跨越到複雜的視覺特效（VFX）領域。隨著 WebGL 技術的成熟以及像 TopologyAI 這樣的 AI 驅動型粒子模擬器的出現，開發者開始探索如何將這些基於瀏覽器的創意工具轉化為可供 AI Agent 使用的「技能」（Skill），進而自動化地在專業遊戲引擎（如 Cocos Creator）中生產高品質的 3D 粒子特效。本報告旨在深入探討 TopologyAI 的底層架構、Cocos Creator 3.x 的粒子系統機制，以及如何透過模型上下文協議（Model Context Protocol, MCP）構建一個無縫的自動化工作流，將數學邏輯轉化為可執行的遊戲資產。

## **TopologyAI 的架構核心與創意生成機制**

TopologyAI（由 Casberry 開發）本質上是一個基於 Three.js 的高效率 WebGL 粒子模擬環境，其核心目標在於「將科學視覺化」並測量 AI 模型在創意編碼中的極限 1。與傳統透過圖形界面（GUI）調整參數的粒子編輯器不同，TopologyAI 採用了「提示詞轉代碼」（Prompt-to-Code）的工作流，要求底層的語言模型（如 Claude 或 Gemini）扮演「創意計算藝術家與高性能 WebGL 著色器專家」的角色 2。

### **數學驅動的粒子動力學**

TopologyAI 的模擬邏輯建立在「數學勝過邏輯」（Math over Logic）的哲學之上 2。為了維持 60fps 的高流暢度，系統生成的 JavaScript 代碼必須嚴格避免垃圾回收（Garbage Collection, GC）機制。這意味著 AI 在生成代碼時，不能在主循環中使用 new 關鍵字來創建對象（例如 new THREE.Vector3()），而必須重複使用預分配的內存緩衝區 2。這種對性能的極致追求，使得 TopologyAI 生產的特效具有高度的數學美感與動態複雜性。

在模擬環境中，AI Agent 主要操控以下幾組關鍵變量來實現視覺效果：

| 變量名稱 | 數據類型 | 訪問權限 | 功能描述 |
| :---- | :---- | :---- | :---- |
| i | 整數 (Integer) | 只讀 | 當前粒子的索引編號，用於計算個別粒子的獨特軌跡 2。 |
| count | 整數 (Integer) | 只讀 | 粒子群體的總數，通常超過 20,000 個粒子 2。 |
| target | THREE.Vector3 | 只寫 | **關鍵對象**。AI 必須在此對象中設置粒子的 (x, y, z) 座標 2。 |
| color | THREE.Color | 只寫 | 用於定義粒子的顏色，支持 HSL 或 RGB 模式的動態變換 2。 |
| time | 浮點數 (Float) | 只讀 | 全局模擬時間，是所有動畫效果（如波動、旋轉）的時間基線 2。 |
| THREE | 對象 (Object) | 只讀 | 提供對完整的 Three.js 庫的訪問，包含所有矢量數學與幾何計算功能 2。 |

這種結構化的 API 設計，為 AI Agent 提供了一個清晰的「行動空間」。透過對 target 位置的週期性函數操作（如 $ \\sin(time) $ 或 $ \\cos(time) $），Agent 可以創造出從簡單的煙霧到複雜的分形星系等各類視覺現象 4。

### **導出能力與跨平台潛力**

TopologyAI 不僅僅是一個封閉的視覺玩具，其導出功能支持將模擬邏輯轉化為 Vanilla JavaScript、React Three Fiber 模組，甚至是 PLY、GLB 與 OBJ 等 3D 模型格式 2。特別是 PLY 導出，支持「點雲（輕量）」與「實體網格（細節）」兩種模式，這為將視覺效果捕獲並導入到其他引擎提供了初步的物理依據 2。然而，要實現「工作流自動化」，僅僅導出靜態模型是不夠的，必須將其內在的數學規律轉化為 Cocos Creator 能夠理解的組件參數。

## **Cocos Creator 3.x 粒子系統的技術圖譜**

要評估 TopologyAI 的方案是否適合 Cocos Creator，必須對目標引擎的 3D 粒子系統有透徹的了解。Cocos Creator 3.x 採用了完全重寫的高性能 3D 核心，擺脫了 Cocos2d-x 的架構限制，轉向以組件為中心的現代渲染管線 7。

### **模組化組件架構**

Cocos Creator 的 3D 粒子系統是由多個獨立的「功能模組」組成的，這與 TopologyAI 的單一函數循環截然不同 9。在 Cocos 中，一個粒子效果的行為是由多個數據結構共同定義的：

| 模組名稱 | 核心功能 | 關鍵序列化屬性 |
| :---- | :---- | :---- |
| **主模組 (Main Module)** | 定義粒子的基本生存期、初始狀態與播放控制 9。 | Duration, Capacity, StartLifetime, StartColor, StartSize, SimulationSpeed 9。 |
| **發射器模組 (Shape Module)** | 控制粒子產生的幾何區域與初始速度方向 9。 | ShapeType (Box, Sphere, Cone, Circle), Radius, Arc, RandomDirection 9。 |
| **隨時間變化速度 (Velocity Overtime)** | 模擬粒子發射後的動態受力與速度變換 9。 | Space (World/Local), X/Y/Z Curves, SpeedModifier 9。 |
| **隨時間變化大小/顏色 (Animator Modules)** | 控制粒子視覺屬性的生命週期演變 9。 | SizeOvertime, ColorOverLifeTime, RotationOvertime 9。 |
| **渲染模組 (Renderer)** | 決定粒子的繪製方式、材質與 GPU 加速選項 9。 | RenderMode (Billboard, Mesh), ParticleMaterial, TrailMaterial, UseGPU 9。 |

Cocos 的 3.0 版本特別強調了材質系統的統一性，粒子特效與普通的 3D 模型一樣，使用基於 EffectAsset 的著色器程序 12。這意味著如果 TopologyAI 的邏輯過於複雜，無法映射到標準的「隨時間變化」模組中，AI Agent 仍可以選擇生成自定義的 GLSL 著色器來實現同等效果 14。

### **渲染性能的權衡：CPU 與 GPU 模式**

在 Cocos Creator 中，粒子系統支持 CPU 與 GPU 兩類渲染器 9。CPU 渲染器透過對象池維護粒子，適合粒子數量較少但邏輯複雜（如 TrailModule）的情況；而 GPU 渲染器則將計算壓力轉移到圖形卡上，能夠支持極大規模的粒子群體，但限制了部分模組的使用 9。這一點與 TopologyAI 對 WebGL 性能的優化思維高度契合，為 AI Agent 提供了在不同目標設備（如移動端與 Mini Game 平台）之間進行性能平衡的空間 8。

## **構建 AI Agent 工作流與「技能」生成**

用戶提出的核心問題是：TopologyAI 是否適合給 AI Agent 產生「技能」（Skill）來自動生產 Cocos 特效？從 AI 工程的角度來看，這是一個關於「結構化知識包裝」的問題 18。

### **AI Agent 技能的定義與組成**

一個有效的 AI Agent 技能不僅僅是一段提示詞，它是一套教導 AI 如何執行任務的結構化知識 18。針對 Cocos 特效生產，一個「VFX 技能」應包含以下層級：

1. **觸發器與場景識別**：辨識何時需要從 TopologyAI 獲取創意，例如當用戶要求「超現實的能量球效果」時 19。  
2. **方法論與決策樹**：引導 Agent 決定是使用 Cocos 的標準粒子模組，還是編寫自定義的 Shader 19。  
3. **模板與結構化輸出**：提供 Cocos .prefab 或 .scene 文件的 JSON 結構模板，以便 Agent 直接生成可導入的文件 20。  
4. **安全檢查與性能限制**：內建針對移動端的優化規則，例如限制最大粒子數（Capacity）或禁用過於昂貴的拖尾效果（Trail） 9。

### **跨協議的自動化操作：MCP 的應用**

要實現真正的自動化，AI Agent 需要能夠「觸摸」Cocos Creator 編輯器。這正是模型上下文協議（Model Context Protocol, MCP）發揮作用的地方 21。透過如 DaxianLee 開發的 Cocos Creator AI 插件，AI 助手（如 Claude CLI 或 Cursor）可以獲得對編輯器高達 98% 的控制權 22。

一個完整的自動化工作流可以被描述為以下過程：

* **創意探索階段**：AI Agent 使用其內置的 TopologyAI 技能，在 Web 環境中快速生成並迭代 Three.js 數學代碼，直到獲得滿意的視覺動態 1。  
* **參數映射與轉譯階段**：Agent 分析生成的 JavaScript 代碼中的數學公式。如果公式描述的是一個 $ \\cos $ 驅動的向外擴散，Agent 會將其轉譯為 Cocos ShapeModule 的 Radius 增長與 Speed 參數 23。  
* **指令執行階段**：Agent 透過 MCP 向 Cocos 編輯器發送 scene\_create\_node 與 component\_add\_component 等指令，直接在開發環境中建立特效節點 21。  
* **資源管理階段**：如果特效需要自定義貼圖或材質，Agent 可以透過 asset\_import 指令管理外部資源，並完成材質參數的綁定 21。

## **技術映射：將 JavaScript 數學轉化為 Cocos 屬性**

本報告的核心洞察在於，TopologyAI 的「數學邏輯」與 Cocos Creator 的「組件參數」之間存在著一個可轉譯的對映關係。AI Agent 的「技能」本質上就是一套轉譯算法。

### **屬性映射矩陣**

| TopologyAI (Three.js) 代碼特徵 | Cocos Creator 3.x 映射目標 | 轉譯策略與二階洞察 |
| :---- | :---- | :---- |
| i / count 引發的空間分佈 | **發射器形狀 (Shape Module)** | 如果粒子根據索引形成圓環，應設置 ShapeType \= CIRCLE 並調整 Radius 9。 |
| Math.sin(time \* f) \* a | **隨時間變化速度/大小 (Overtime Curves)** | 數學振幅 ![][image1] 被轉化為動態曲線的波峰值。AI 需生成一系列 Keyframes 來模擬週期性行為 9。 |
| color.setHSL(time % 1, 0.5, 0.5) | **隨生命週期顏色 (ColorOverLifeTime)** | 將 HSL 動態變換取樣為 5-8 個色標，生成 Cocos 梯度（Gradient）對象 9。 |
| target.lerp(new\_pos, 0.1) | **限制速度模組 (Limit Velocity)** | lerp 動作暗示了某種阻尼感，對應 Cocos 中的 Dampen 屬性 9。 |
| 高頻率的 THREE.Vector3 運算 | **自定義 Effect (Shader)** | 如果邏輯中包含複雜的分形或非線性受力，Agent 應生成一個 builtin-particle.effect 的變體，將數學搬移到頂點著色器中執行 14。 |

### **深度轉譯：從 JavaScript 到 GLSL**

一個關鍵的技術瓶頸在於，TopologyAI 的代碼運行在 CPU 端的 JavaScript 循環中，而高效的 Cocos 特效通常運行在 GPU 上。AI Agent 的技能必須具備「著色器轉譯」（Shader Transpilation）的能力 25。透過像 js2glsl 這樣的庫或 LLM 自身的翻譯能力，Agent 可以將 Three.js 的矢量數學轉換為 Cocos Creator 的 Cocos Effect 語法（YAML \+ GLSL 300 ES） 14。這不僅能實現視覺上的精確還原，還能確保在移動端設備上的極致性能 9。

## **面臨的挑戰與限制**

儘管工作流在理論上是可行的，但在實際應用中，AI Agent 仍需處理多個維度的複雜性與不確定性。

### **1\. 跨引擎的座標系差異**

Three.js 默認使用右手座標系，而 Cocos Creator 雖然也使用右手系，但在相機位置、世界原點以及粒子的空間模擬（SimulationSpace）設置上存在差異 9。如果 AI Agent 的技能未能正確處理這些空間轉換，可能會導致特效在 Cocos 中發生翻轉或位移錯誤 24。

### **2\. 智能體在圖形任務上的成功率**

根據最新的學術基準測試（如 GameDevBench），AI Agent 在處理 3D 圖形與動畫任務時的成功率明顯低於一般的遊戲邏輯（成功率僅為 31.6%） 28。這說明「生成粒子特效」屬於高難度的多模態任務。為了提升可靠性，Agent 必須能夠訪問豐富的上下文，包含 Cocos 引擎的 API 參考文件、最佳實踐指南以及常見的報錯信息（如 UUID 壓縮失敗或腳本反序列化錯誤） 8。

### **3\. 性能監測與反饋循環**

一個自動化的工作流需要「閉環控制」。當 AI Agent 透過 MCP 在 Cocos 編輯器中生成特效後，它需要具備「觀察結果」的能力。目前的技術環境中，Agent 可能需要藉助截圖分析（Visual LLM）或讀取編輯器的運行日誌（Log）來判斷生成的特效是否符合預期，以及是否存在性能掉幀（FPS Drop） 21。這種「觀察-調整」的循環是技能進化的關鍵 18。

## **二階洞察：VFX 生產範式的轉變**

將 TopologyAI 與 Cocos Creator 結合並透過 AI Agent 自動化，預示著遊戲開發領域的一次根本性範式轉變。

### **從「編碼者」到「架構師」的轉型**

在這種自動化工作流中，開發者的角色從手動編寫 Shader 或調整數值轉變為「工作流架構師」 32。開發者需要設計不同的 Agent 角色：一個「視覺創意 Agent」負責在 TopologyAI 中進行藝術探索，一個「工程轉譯 Agent」負責代碼生成的精確性，以及一個「監管 Agent」負責整體的項目一致性與預算控制 32。這種「智能體集群」的模式能夠大幅降低特效生產的門檻，使非專業的美術人員也能夠產出具有高度技術含量的 3D 特效 17。

### **科學視覺化與遊戲娛樂的融合**

TopologyAI 的核心目標是科學視覺化 1。當這種精確的、基於物理法則的視覺表達能夠被自動轉化為遊戲引擎中的實體時，遊戲世界將展現出前所未有的「湧現性」（Emergence） 4。例如，一個動態的流體模擬可以直接從科學論文的數學公式轉化為遊戲中極具視覺衝擊力的「魔法水流」 35。

## **結論與行動建議**

綜合各項技術證據，本報告得出以下結論：

**TopologyAI 高度適合與 AI Agent 結合，構建自動化的 Cocos Creator VFX 生產工作流。**

其適合性體現在 TopologyAI 提供了一個純粹的數學環境，這對於 LLM 生成邏輯是友好的；而 Cocos Creator 3.x 提供了成熟的 MCP 擴展能力與高度模組化的粒子系統，這對於 Agent 的執行是友好的。然而，要實現這一願景，必須開發專門的「中介技能」（Mapping Skill），該技能需具備以下能力：

1. **數學屬性到 JSON 的自動對映**：將 Three.js 的動態變量精確映射到 Cocos 的組件數據結構中 9。  
2. **基於 Shader 的深度還原**：當標準模組無法滿足需求時，自動生成高效的 Cocos Effect 著色器 14。  
3. **基於 MCP 的實時編輯與優化**：透過與編輯器的雙向通信，實現特效的即時生成、預覽與性能修剪 21。

對於希望實施此方案的團隊，建議首選構建基於 Claude Code 或 Cursor 的 MCP 環境，並將 Cocos 3.8 的粒子 API 文檔作為 Agent 的「長期記憶」進行掛載，以克服 AI 在圖形任務上的天然短板，實現高品質特效的規模化生產。

#### **引用的著作**

1. AI Particles Simulator : r/threejs \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/threejs/comments/1qxexvk/ai\_particles\_simulator/](https://www.reddit.com/r/threejs/comments/1qxexvk/ai_particles_simulator/)  
2. AI Particle Simulator | Professional 3D Swarm Simulator by Casberry ..., 檢索日期：4月 2, 2026， [https://particles.casberry.in/](https://particles.casberry.in/)  
3. Free AI-Driven Particle Simulator for Three.js just Awesome : r/TopologyAI \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/TopologyAI/comments/1rphayo/free\_aidriven\_particle\_simulator\_for\_threejs\_just/](https://www.reddit.com/r/TopologyAI/comments/1rphayo/free_aidriven_particle_simulator_for_threejs_just/)  
4. Beautiful Simulations from the Community : r/threejs \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/threejs/comments/1rr4fej/beautiful\_simulations\_from\_the\_community/](https://www.reddit.com/r/threejs/comments/1rr4fej/beautiful_simulations_from_the_community/)  
5. Updates on AI Particles Simulator : r/threejs \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/threejs/comments/1rudal7/updates\_on\_ai\_particles\_simulator/](https://www.reddit.com/r/threejs/comments/1rudal7/updates_on_ai_particles_simulator/)  
6. GitHub \- hunar4321/particle-life: A simple program to simulate artificial life using attraction/reuplsion forces between many particles, 檢索日期：4月 2, 2026， [https://github.com/hunar4321/particle-life](https://github.com/hunar4321/particle-life)  
7. Cocos Creator 3.0 User Manual, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.0/manual/en/](https://docs.cocos.com/creator/3.0/manual/en/)  
8. Cocos Creator User Manual 3.8, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.8/manual/en/](https://docs.cocos.com/creator/3.8/manual/en/)  
9. 3D Particle System Overview \- Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.8/manual/en/particle-system/overview.html](https://docs.cocos.com/creator/3.8/manual/en/particle-system/overview.html)  
10. Main Module (Particle System) \- Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.8/manual/en/particle-system/main-module.html](https://docs.cocos.com/creator/3.8/manual/en/particle-system/main-module.html)  
11. Particle System Function Introduction \- Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.5/manual/en/particle-system/module.html](https://docs.cocos.com/creator/3.5/manual/en/particle-system/module.html)  
12. It's Time For A New Dimension \- Cocos Creator 3.0 Tech Preview, 檢索日期：4月 2, 2026， [https://www.cocos.com/en/post/its-time-for-a-new-dimension-cocos-creator-3-0-tech-preview](https://www.cocos.com/en/post/its-time-for-a-new-dimension-cocos-creator-3-0-tech-preview)  
13. Break Out Of 2D Development With Our Upcoming Cocos Creator 3D Update\!, 檢索日期：4月 2, 2026， [https://www.cocos.com/en/post/break-out-of-2d-development-with-our-upcoming-cocos-creator-3d-update](https://www.cocos.com/en/post/break-out-of-2d-development-with-our-upcoming-cocos-creator-3d-update)  
14. Effect Syntax Guide | Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.2/manual/en/material-system/effect-syntax.html](https://docs.cocos.com/creator/3.2/manual/en/material-system/effect-syntax.html)  
15. Effect Syntax Guide | Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.4/manual/en/shader/effect-syntax.html](https://docs.cocos.com/creator/3.4/manual/en/shader/effect-syntax.html)  
16. Effect Overview | Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.4/manual/en/shader/index.html](https://docs.cocos.com/creator/3.4/manual/en/shader/index.html)  
17. Cocos Creator \- Efficient and lightweight cross-platform 3D/2D graphics engine, 檢索日期：4月 2, 2026， [https://www.cocos.com/en/creator](https://www.cocos.com/en/creator)  
18. Building Agent Skills for Real-World Workflows \- Voxel51, 檢索日期：4月 2, 2026， [https://voxel51.com/blog/building-agent-skills-workflows](https://voxel51.com/blog/building-agent-skills-workflows)  
19. Claude Skills Explained: My Workflow for Creating Reusable AI Agents with Cursor and Claude Code \- ChatPRD, 檢索日期：4月 2, 2026， [https://www.chatprd.ai/how-i-ai/claude-skills-explained](https://www.chatprd.ai/how-i-ai/claude-skills-explained)  
20. Prefab \- Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.8/manual/en/asset/prefab.html](https://docs.cocos.com/creator/3.8/manual/en/asset/prefab.html)  
21. cocos-mcp-server/FEATURE\_GUIDE\_EN.md at main \- GitHub, 檢索日期：4月 2, 2026， [https://github.com/DaxianLee/cocos-mcp-server/blob/main/FEATURE\_GUIDE\_EN.md](https://github.com/DaxianLee/cocos-mcp-server/blob/main/FEATURE_GUIDE_EN.md)  
22. Cocos Creator AI Plugin: AI Editor Control via MCP ... \- MCP Market, 檢索日期：4月 2, 2026， [https://mcpmarket.com/server/cocos-creator-ai-plugin](https://mcpmarket.com/server/cocos-creator-ai-plugin)  
23. How to convert a Shadertoy shader for Cocos Creator 3.8.6 (Web build)?, 檢索日期：4月 2, 2026， [https://forum.cocosengine.org/t/how-to-convert-a-shadertoy-shader-for-cocos-creator-3-8-6-web-build/62289](https://forum.cocosengine.org/t/how-to-convert-a-shadertoy-shader-for-cocos-creator-3-8-6-web-build/62289)  
24. How To Copy A Shader Into Your Cocos Creator Project, 檢索日期：4月 2, 2026， [https://www.cocos.com/en/post/how-to-copy-a-shader-into-your-cocos-creator-project](https://www.cocos.com/en/post/how-to-copy-a-shader-into-your-cocos-creator-project)  
25. GitHub \- jdavidberger/js2glsl: Convert from javascript functions to GL shader source, 檢索日期：4月 2, 2026， [https://github.com/jdavidberger/js2glsl](https://github.com/jdavidberger/js2glsl)  
26. Particle System | Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.8/manual/en/particle-system/index.html](https://docs.cocos.com/creator/3.8/manual/en/particle-system/index.html)  
27. A Detailed Explanation Of The Cocos Creator Particle System. Zero Code Needed\!, 檢索日期：4月 2, 2026， [https://forum.cocosengine.org/t/a-detailed-explanation-of-the-cocos-creator-particle-system-zero-code-needed/56179](https://forum.cocosengine.org/t/a-detailed-explanation-of-the-cocos-creator-particle-system-zero-code-needed/56179)  
28. GameDevBench: Evaluating Agentic Capabilities Through Game Development \- arXiv, 檢索日期：4月 2, 2026， [https://arxiv.org/html/2602.11103](https://arxiv.org/html/2602.11103)  
29. Introduction to the Build Process and FAQ | Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.4/manual/en/editor/publish/build-guide.html](https://docs.cocos.com/creator/3.4/manual/en/editor/publish/build-guide.html)  
30. Build Process with FAQ \- Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/2.3/manual/en/editor/publish/build-guide.html](https://docs.cocos.com/creator/2.3/manual/en/editor/publish/build-guide.html)  
31. Cocos EngineErrorMapCocos Creator Engine Errors 0100 %s not \- 稀土掘金, 檢索日期：4月 2, 2026， [https://juejin.cn/post/6963512552546369549](https://juejin.cn/post/6963512552546369549)  
32. Game ai workflow : r/aigamedev \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/aigamedev/comments/1s53q8t/game\_ai\_workflow/](https://www.reddit.com/r/aigamedev/comments/1s53q8t/game_ai_workflow/)  
33. The Rise Of AI Agents In Game Development: From Automation To Real Co-dev | GIANTY, 檢索日期：4月 2, 2026， [https://www.gianty.com/the-rise-of-ai-agents-in-game-development/](https://www.gianty.com/the-rise-of-ai-agents-in-game-development/)  
34. I'm rebuilding my Unreal particle system experience with threejs and webGPU. Here's what 1m particles forming an emergent system look like. \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/threejs/comments/1s4v3q8/im\_rebuilding\_my\_unreal\_particle\_system/](https://www.reddit.com/r/threejs/comments/1s4v3q8/im_rebuilding_my_unreal_particle_system/)  
35. GitHub \- axoloto/RealTimeParticles: Minimalist real-time 3D particles simulator (Boids, Fluids, Clouds) based on OpenGL/OpenCL frameworks, 檢索日期：4月 2, 2026， [https://github.com/axoloto/RealTimeParticles](https://github.com/axoloto/RealTimeParticles)  
36. Leveraging Agentic AI in Games | Databricks Blog, 檢索日期：4月 2, 2026， [https://www.databricks.com/blog/leveraging-agentic-ai-games](https://www.databricks.com/blog/leveraging-agentic-ai-games)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAXCAYAAAAyet74AAAAqElEQVR4XmNgGAUDBhiB2A6IjwPxJyAuBWJdIOZGV/QfiJuhbBDwAOJ/QCwCUwQC2kD8HIiVkMSCGCCaYRrBjClAvAaIWWCCQDCJAaIQDoyB+CsQmyKJaQLxWyC+iiQGVyiJJObHADFtKQPErZ0gQWkgfsCAqnA+A0RhERDPA+IImAQ/EL8H4g1A/AiIVYH4FhA/A+JgmCIYEGCAmMoB5bMCsThCehgBAEoqG1t26s/RAAAAAElFTkSuQmCC>
---

## [2026-04-17 進度更新] 路線 C（Procedural Shader）

- C-1 `water-ripple.effect`：已完成
  - BattleScene 已改為「僅 FloodAttack 掛載」
  - 已完成 Flood vs Normal 對照截圖驗證
- C-2 `lightning-arc.effect`：已完成
  - 任務卡：`docs/tasks/battle-vfx-lightning-arc_task.md`
  - QA 流程：沿用 `capture-ui-screens` + 125px 縮圖檢視 + regression 比對
- C-3 `poison-fog.effect`：已完成
  - 任務卡：`docs/tasks/battle-vfx-poison-fog_task.md`
  - 掛載點：`BattleTactic.AmbushAttack` / `ambush-field`
  - 驗收：`artifacts/ui-qa/poison-fog-check/BattleScene.png`
- C-4 `wind-vortex.effect`：已完成
  - 任務卡：`docs/tasks/battle-vfx-wind-vortex_task.md`
  - 掛載點：`BattleTactic.RockSlide` / `hazard-rock`
  - 驗收：`artifacts/ui-qa/wind-vortex-check/BattleScene.png`
- C-5 `ice-crystal.effect`：已完成
  - 任務卡：`docs/tasks/battle-vfx-ice-crystal_task.md`
  - 掛載點：`BattleTactic.FloodAttack` / `river-current`
  - 驗收：`artifacts/ui-qa/ice-crystal-check/BattleScene.png`
## [2026-04-17 續更] 路線 C-2（lightning-arc.effect）

- 狀態：已完成並掛載到 NightRaid 場勢。
- 程式掛點：`assets/scripts/battle/views/BoardRenderer.ts`
- 驗收輸出：
  - `artifacts/ui-qa/lightning-arc-check/BattleScene.png`
  - `artifacts/ui-qa/lightning-arc-check-normal/BattleScene.png`
- 任務卡：`docs/tasks/battle-vfx-lightning-arc_task.md`（status: done）

## [2026-04-17 續更] 路線 C-3（poison-fog.effect）

- 狀態：已完成並掛載到 AmbushAttack 場勢。
- 程式掛點：`assets/scripts/battle/views/BoardRenderer.ts`
- 驗收輸出：
  - `artifacts/ui-qa/poison-fog-check/BattleScene.png`
  - `artifacts/ui-qa/poison-fog-check-normal/BattleScene.png`
- 任務卡：`docs/tasks/battle-vfx-poison-fog_task.md`（status: done）

## [2026-04-17 續更] 路線 C-4（wind-vortex.effect）

- 狀態：已完成並掛載到 RockSlide 場勢。
- 程式掛點：`assets/scripts/battle/views/BoardRenderer.ts`
- 驗收輸出：
  - `artifacts/ui-qa/wind-vortex-check/BattleScene.png`
  - `artifacts/ui-qa/wind-vortex-check-normal/BattleScene.png`
- 任務卡：`docs/tasks/battle-vfx-wind-vortex_task.md`（status: done）

## [2026-04-17 續更] 路線 C-5（ice-crystal.effect）

- 狀態：已完成並掛載到 FloodAttack 場勢（river-current overlay）。
- 程式掛點：`assets/scripts/battle/views/BoardRenderer.ts`
- 驗收輸出：
  - `artifacts/ui-qa/ice-crystal-check/BattleScene.png`
  - `artifacts/ui-qa/ice-crystal-check-normal/BattleScene.png`
- 任務卡：`docs/tasks/battle-vfx-ice-crystal_task.md`（status: done）
