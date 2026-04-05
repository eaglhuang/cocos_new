# **Cocos Creator 3D 粒子特效 AI 代理技能之市場現狀與技術實作深度報告**

隨著生成式人工智慧與代理式工作流（Agentic Workflows）在遊戲開發領域的滲透，傳統上依賴人工細緻調教的視覺特效（VFX）生產模式正經歷深刻變革。在 Cocos Creator 這一領先的跨平台遊戲引擎生態中，開發者對於能夠自動化生成、優化並部署 3D 粒子特效的「AI 代理技能」（Agent Skill）需求日益殷切 1。本報告旨在深度剖析目前自由市場（Free Market）中針對 Cocos 3D 粒子特效生成器的具體可行方案，探討模型上下文協議（Model Context Protocol, MCP）在編輯器控制中的核心作用，並評估現有技術資源在實際開發流程中的應用潛力。

## **遊戲開發 AI 代理之市場生態與技術演進**

在當前的 AI 代理市場中，技能的定義已超越單純的提示詞工程（Prompt Engineering），演變為一種結合了標準化通訊協議、特定領域知識庫以及工具調用能力的綜合體。對於 Cocos Creator 開發者而言，一個「具體可行」的 3D 粒子特效生成代理技能，必須能夠克服從自然語言描述到引擎組件參數（Component Properties）之間的語義鴻溝 3。

### **模型上下文協議 (MCP) 的崛起**

目前市場上最顯著的趨勢是模型上下文協議（MCP）的標準化。這一協議允許 AI 助手（如 Claude CLI、Cursor、VS Code Copilot）通過統一的接口與本地開發工具進行交互 3。在 MCP 市場中，Cocos Creator 的 AI 插件已開始出現，這標誌著引擎控制權從手動操作向程序化 AI 控制的轉型。

根據對 MCP 市場的觀測，目前已有開發者分享了高度集成的解決方案，這些方案將 Cocos Creator 轉變為一個 AI 可控的環境。這類插件通常提供超過百種工具，涵蓋場景、節點、組件及資源管理，為粒子特效的自動化生成奠定了基礎 3。

| 代理技能/插件名稱 | 開發者/來源 | 核心技術架構 | 市場定位與主要功能 |
| :---- | :---- | :---- | :---- |
| Cocos Creator AI Plugin | DaxianLee | MCP (Model Context Protocol) | 提供 158 種工具，實現 98% 編輯器控制，支持組件屬性自動化設置 3 |
| Aura for Cocos Creator | jiangkingwelcome | MCP / Funnel Architecture | 強調錯誤自我修復與行為準則，優化 Token 消耗，適合複雜場景生成 6 |
| vfx-particles Skill | Taozhuo | System Prompt / Agent Skill | 專注於 GPU 粒子、拖尾與程序化 VFX 的邏輯實現與 methodology 7 |
| agent-skill-creator | FrancyJGLisboa | Skill Framework | 支持將散亂的文檔與代碼快速封裝為跨平台的代理技能 4 |

3

### **自由市場中的技能分享現狀**

目前在 GitHub、MCP Market 以及 Skills Playground 等平台上，關於 Cocos 3D 粒子特效的討論與資源正呈現碎片化但高度專業化的特徵。雖然單一的「一鍵式粒子生成器」仍處於進化階段，但組合式的代理技能已具備可行性。例如，開發者可以通過安裝特定的 MCP 伺服器，使 AI 代理獲得操作 cc.ParticleSystem 的權限，再結合 VFX 領域的專業系統提示詞（System Prompts），實現從概念到實體的自動化路徑 8。

## **Cocos 3D 粒子系統的架構深度剖析**

若要使 AI 代理能夠精準生成粒子特效，代理本身必須理解 Cocos Creator 3D 粒子系統的內在邏輯。粒子系統在引擎中被視為特效表現的基石，用於模擬自然現象（如火、煙、水、雪）及抽象視覺效果（如光跡、速度線） 9。

### **模組化組件結構**

Cocos Creator 的 3D 粒子系統是一個高度模組化的體系。每一個 cc.ParticleSystem 組件都包含一系列子模組，這些模組定義了粒子的生命週期、運動特徵與渲染表現 9。

1. **發射器模組 (ShapeModule)**：定義粒子產生的空間形狀，包括盒體（Box）、圓形（Circle）、錐體（Cone）、球體（Sphere）等。AI 代理需要根據特效類型（如爆炸需球形，噴泉需錐形）選擇合適的形狀 10。  
2. **動態更新模組 (Influencer Modules)**：包括 VelocityOvertime（隨時間的速度變化）、ForceOvertime（外力作用）、SizeOvertime（大小演變）以及 ColorOvertime（顏色漸變）。這些模組是特效質感的關鍵，AI 代理必須能夠精確計算並設置這些模組中的數值或曲線 10。  
3. **渲染模組 (RendererModule)**：決定粒子的表現形式，支持告示牌（Billboard）、拉伸告示牌（Stretched Billboard）或自定義 3D 模型。對於高性能需求的場景，AI 代理應傾向於使用合適的渲染模式以優化 DrawCalls 10。

### **物理模擬與數學模型**

在 AI 代理生成粒子的過程中，涉及大量的運動學計算。粒子在三維空間中的位置 ![][image1] 隨時間 ![][image2] 的變化，受初始位置 ![][image3]、初始速度 ![][image4] 及加速度 ![][image5] 的影響，其基本物理公式如下：

![][image6]  
在 Cocos 的 ForceOvertimeModule 中，加速度 ![][image5] 可以是恆定的（如模擬重力），也可以是隨時間變化的。具備專業物理技能的 AI 代理（如 particles-physics 技能）會利用這些公式來優化粒子的軌跡，使其更符合自然物理規律 12。

## **現有可行之 AI 代理技能與工具鏈分析**

針對用戶查詢的「具體可行」之方案，目前市場上存在兩條主要路徑：基於編輯器控制的「原生 MCP 方案」與基於資產導出的「跨平台模擬方案」。

### **路徑一：基於 MCP 的原生編輯器控制方案**

這是目前最符合專業開發流程的路徑。通過安裝如 DaxianLee 的 Cocos Creator AI 插件，AI 代理可以直接訪問編輯器的 API 3。

在這種模式下，代理技能不再是寫代碼，而是執行一系列指令。例如，當開發者要求 AI 「創建一個營火特效」時，具備技能的代理會執行以下動作：

* 調用 scene\_create\_node 在層級管理器中生成新節點 8。  
* 調用 component\_add\_component 為該節點添加 cc.ParticleSystem 8。  
* 針對 cc.ParticleSystem 的多個屬性進行設置，如將 Duration 設為 \-1 以實現循環，調整 StartColor 為橙紅色調，並啟用 SizeOvertimeModule 使火焰隨上升而縮小 11。  
* 加載 builtin-particle 材質並設置其 MainTexture 11。

這種方案的優勢在於生成的特效直接集成在 Cocos 項目中，無需二次導入，且開發者可以隨時接管手動微調 3。

### **路徑二：基於 Casberry/TopologyAI 的視覺原型方案**

另一種可行方案是利用如 Casberry (particles.casberry.in) 提供的 AI 粒子模擬器 14。這類工具雖然主要基於 Three.js，但其強大的 AI 代碼生成能力可以快速原型化複雜的粒子行為 16。

目前該工具已支持導出為 GLB、PLY 及 OBJ 等 3D 格式 16。對於需要特定「粒子形狀」或「靜態點雲特效」的 Cocos 開發者，可以先在 AI 模擬器中生成理想的視覺效果，導出為 GLB 模型，再將其作為 Cocos 3D 粒子系統中渲染模組（RendererModule）的自定義模型使用 17。這種路徑特別適合需要大量（如百萬級）粒子形成的複雜形狀視覺效果 15。

| 工具類型 | 適用場景 | 操作複雜度 | 生成質量 |
| :---- | :---- | :---- | :---- |
| 原生 MCP 代理 | 實時遊戲特效、UI 特效、交互式 VFX | 高（需配置伺服器環境） | 與引擎完美適配 |
| 跨平台模擬器 | 複雜視覺原型、點雲藝術、概念設計 | 低（網頁端操作） | 視覺衝擊力強，需手動適配 |
| 程序化腳本代理 | 批量生成相似特效、數據驅動 VFX | 中（需具備腳本撰寫能力） | 高度可定制 |

14

## **技術實作：如何構建與分享 Cocos 粒子 Agent Skill**

對於希望在市場中分享或自用粒子生成技能的專家，標準化的構建流程至關重要。利用 agent-skill-creator 這類開源工具，開發者可以將複雜的 Cocos 技術細節封裝成易用的 AI 技能 4。

### **技能封裝的關鍵要素**

一個高質量的 Cocos 3D 粒子代理技能需要包含以下核心內容：

1. **結構化的參考文檔 (References)**：技能應內置 Cocos Creator 3.x 粒子系統的 API 文檔與組件屬性說明。這使得 AI 助理在生成參數時不會出現名稱錯誤（如將 startSize 誤寫為 initial\_size） 4。  
2. **標準化的工具集 (Tools)**：基於 MCP 協議，定義粒子特有的工具。例如一個專門用於「設置粒子漸變色」的工具，可以簡化 AI 代理處理複雜 Color Gradient 數據結構的難度 8。  
3. **場景上下文感知 (Context Awareness)**：代理應具備查詢當前場景層級的能力，確保新生成的粒子系統被放置在正確的父節點下（如相機視錐體內或特定角色掛點上） 8。

### **效能優化的自動化審查**

在自由市場中，能夠提供「優化建議」的代理技能更具競爭力。Cocos Creator 的 3D 遊戲開發對性能極為敏感，特別是在行動端與小遊戲平台 9。一個成熟的代理技能應包含效能檢查邏輯，例如：

* **DrawCall 監控**：當檢測到場景中粒子系統過多時，提示開發者合併材質或優化渲染模式 18。  
* **粒子數量限制**：根據目標平台（高低端設備適配），動態調整 Total Particle 參數 13。  
* **GPU 粒子轉換建議**：對於數量巨大但邏輯簡單的特效，引導開發者使用 GPU 粒子以減輕 CPU 負擔 7。

## **市場缺失與二階需求洞察**

儘管 MCP 市場和 GitHub 上已出現了一些具體可行的組件，但針對 Cocos 3D 粒子特效的「全自動生成器」仍存在一些尚未完全滿足的技術缺口。

### **語義化視覺語言的轉譯難題**

目前的 AI 代理在處理「感覺」類描述（如「夢幻的、詭異的、神聖的」）時，仍依賴於隨機的參數組合。市場上缺乏一套成熟的「VFX 語義映射表」，能夠將情感化描述精確對應到 Cocos 的動態模組參數。例如，「神聖感」通常對應高亮度的粒子、向上的受力（ForceOvertime）以及特定的發光材質（Glow Effect），這類知識的結構化封裝是未來代理技能提升的關鍵方向 11。

### **資源依賴與路徑管理**

AI 生成粒子特效時，常需要外部紋理（Textures）或材質球（Materials）。目前的 Agent Skill 在處理本地資源庫路徑與自動資產導入方面仍有提升空間 20。若 AI 代理能自動在 assets/resources 下創建對應的特效目錄，並自動關聯正確的 .meta 文件，將大幅提升其「具體可行性」 21。

### **跨版本兼容性問題**

Cocos Creator 經歷了從 2.4 到 3.x 的重大架構變革，粒子系統的屬性名稱與結構發生了顯著變化 10。現有的許多在線分享技能若未明確標註版本，容易導致 AI 在 3.8 版本的項目中調用舊版的 API 導致報錯。因此，具備「版本感知」的代理技能是當前市場的高階需求 22。

## **深度實務指南：從零開始部署一個粒子 Agent Skill**

對於尋求立即應用方案的開發者，以下是基於現有研究材料總結的實施路徑。

### **環境準備與 MCP 配置**

開發者需首先安裝支持 MCP 的 AI 編輯器（如 Cursor 或 Claude Code）。接著，克隆 DaxianLee 的 cocos-mcp-server 到本地，並通過編輯器的配置文件（如 .cursorrules 或 .claude/skills）進行掛載 3。

在配置文件中，必須明確告知 AI 代理如何訪問 Cocos 的 API Source。這通常涉及到在 Cocos Creator 中執行「Update VS Code API Source」，以生成 creator.d.ts 文件，這為 AI 提供了完整的代碼補全與類型檢查上下文 24。

### **提示詞工程 (Prompt Engineering) 的優化策略**

在與 AI 代理溝通時，應採用「模塊化描述法」。例如：

* **第一步：定義發射源**。「請在場景根節點下創建一個直徑為 2 米的圓環形粒子發射器。」 8  
* **第二步：設定外觀特徵**。「使用增強模式渲染，粒子應具有從亮黃色到透明的過渡。」 10  
* **第三步：添加動態行為**。「加入噪聲干擾（Noise）以模擬真實火焰的抖動，並設置向上的恆定力。」 10

這種循序漸進的引導，結合 MCP 提供的實時反饋（如通過 Cocos Log Bridge 查看是否有報錯），能顯著提高生成成功率 25。

## **結論與未來展望**

總結而言，目前自由市場中確實存在具體可行的 Cocos 3D 粒子特效生成方案，其核心在於「MCP 控制器 \+ 專業 VFX 系統提示詞」的組合應用。雖然尚無一體化的商業級產品，但通過 DaxianLee、Aura 等開源 MCP 項目與 Taozhuo 等人的專業技能分享，開發者已經可以實現高度自動化的粒子系統生產流程 3。

未來的發展趨勢將朝著「AI 原生特效資產」演進。隨著 ComfyUI-3D-Pack 與 DimensionX 等 3D 生成技術的成熟，AI 代理將不僅僅是調整現有組件參數，而是能夠實時生成自定義的粒子著色器（Shaders）與程序化紋理，從而突破引擎內置功能的限制 1。

對於 Cocos 開發團隊而言，擁抱這類 Agent Skill 不僅是提高開發效率的手段，更是應對日益複雜的 3D 視覺表現需求、實現跨平台性能平衡的必然選擇。在這一進程中，標準化協議（如 MCP）的普及與社區專業技能的持續分享將發揮不可替代的作用。

#### **引用的著作**

1. Particle System | Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.8/manual/en/particle-system/index.html](https://docs.cocos.com/creator/3.8/manual/en/particle-system/index.html)  
2. Particle System \- Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.3/manual/en/particle-system/](https://docs.cocos.com/creator/3.3/manual/en/particle-system/)  
3. Cocos Creator AI Plugin: AI Editor Control via MCP Server, 檢索日期：4月 2, 2026， [https://mcpmarket.com/server/cocos-creator-ai-plugin](https://mcpmarket.com/server/cocos-creator-ai-plugin)  
4. GitHub \- FrancyJGLisboa/agent-skill-creator: Turn any workflow into reusable AI agent skills that install on 14+ tools — Claude Code, Copilot, Cursor, Windsurf, Codex, Gemini, Kiro, and more. One SKILL.md, every platform., 檢索日期：4月 2, 2026， [https://github.com/FrancyJGLisboa/agent-skill-creator](https://github.com/FrancyJGLisboa/agent-skill-creator)  
5. Agent skills generator : r/GithubCopilot \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/GithubCopilot/comments/1rmfdhu/agent\_skills\_generator/](https://www.reddit.com/r/GithubCopilot/comments/1rmfdhu/agent_skills_generator/)  
6. Aura for Cocos Creator: AI Coding Assistant & MCP Service, 檢索日期：4月 2, 2026， [https://mcpmarket.com/server/aura-3](https://mcpmarket.com/server/aura-3)  
7. Vfx Particles — AI Coding Skill | Skills Playground, 檢索日期：4月 2, 2026， [https://skillsplayground.com/skills/taozhuo-game-dev-skills-vfx-particles/](https://skillsplayground.com/skills/taozhuo-game-dev-skills-vfx-particles/)  
8. cocos-mcp-server/FEATURE\_GUIDE\_EN.md at main · DaxianLee ..., 檢索日期：4月 2, 2026， [https://github.com/DaxianLee/cocos-mcp-server/blob/main/FEATURE\_GUIDE\_EN.md](https://github.com/DaxianLee/cocos-mcp-server/blob/main/FEATURE_GUIDE_EN.md)  
9. 3D Particle System Overview \- Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.8/manual/en/particle-system/overview.html](https://docs.cocos.com/creator/3.8/manual/en/particle-system/overview.html)  
10. Particle System Function Introduction \- Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.5/manual/en/particle-system/module.html](https://docs.cocos.com/creator/3.5/manual/en/particle-system/module.html)  
11. A Detailed Explanation Of The Cocos Creator Particle System. Zero Code Needed\!, 檢索日期：4月 2, 2026， [https://forum.cocosengine.org/t/a-detailed-explanation-of-the-cocos-creator-particle-system-zero-code-needed/56179](https://forum.cocosengine.org/t/a-detailed-explanation-of-the-cocos-creator-particle-system-zero-code-needed/56179)  
12. Particles Physics — AI Coding Skill \- Claude Skills Playground, 檢索日期：4月 2, 2026， [https://skillsplayground.com/skills/bbeierle12-skill-mcp-claude-particles-physics/](https://skillsplayground.com/skills/bbeierle12-skill-mcp-claude-particles-physics/)  
13. ParticleSystem Component Reference \- Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/2.4/manual/en/components/particle-system.html](https://docs.cocos.com/creator/2.4/manual/en/components/particle-system.html)  
14. Free AI-Driven Particle Simulator for Three.js just Awesome : r/TopologyAI \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/TopologyAI/comments/1rphayo/free\_aidriven\_particle\_simulator\_for\_threejs\_just/](https://www.reddit.com/r/TopologyAI/comments/1rphayo/free_aidriven_particle_simulator_for_threejs_just/)  
15. Beautiful Simulations from the Community : r/threejs \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/threejs/comments/1rr4fej/beautiful\_simulations\_from\_the\_community/](https://www.reddit.com/r/threejs/comments/1rr4fej/beautiful_simulations_from_the_community/)  
16. AI Particles Simulator : r/threejs \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/threejs/comments/1qxexvk/ai\_particles\_simulator/](https://www.reddit.com/r/threejs/comments/1qxexvk/ai_particles_simulator/)  
17. Updates on AI Particles Simulator : r/threejs \- Reddit, 檢索日期：4月 2, 2026， [https://www.reddit.com/r/threejs/comments/1rudal7/updates\_on\_ai\_particles\_simulator/](https://www.reddit.com/r/threejs/comments/1rudal7/updates_on_ai_particles_simulator/)  
18. Skill Grading Report: theone-cocos-standards \- Score 90/100 (A) · Issue \#1 \- GitHub, 檢索日期：4月 2, 2026， [https://github.com/The1Studio/theone-training-skills/issues/1](https://github.com/The1Studio/theone-training-skills/issues/1)  
19. CocosCyberpunk \- Cocos Store, 檢索日期：4月 2, 2026， [https://store.cocos.com/app/en/detail/4543](https://store.cocos.com/app/en/detail/4543)  
20. Introduction to the Build Process and FAQ | Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.4/manual/en/editor/publish/build-guide.html](https://docs.cocos.com/creator/3.4/manual/en/editor/publish/build-guide.html)  
21. Project Structure | Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.7/manual/en/getting-started/project-structure/index.html](https://docs.cocos.com/creator/3.7/manual/en/getting-started/project-structure/index.html)  
22. Cocos Creator 3.6.0 Build Template and settings.json Upgrade Guide, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/3.8/manual/en/release-notes/build-template-settings-upgrade-guide-v3.6.html](https://docs.cocos.com/creator/3.8/manual/en/release-notes/build-template-settings-upgrade-guide-v3.6.html)  
23. cocos/cocos4: COCOS 4 \- GitHub, 檢索日期：4月 2, 2026， [https://github.com/cocos/cocos4](https://github.com/cocos/cocos4)  
24. Coding Environment Setup | Cocos Creator, 檢索日期：4月 2, 2026， [https://docs.cocos.com/creator/2.4/manual/en/getting-started/coding-setup.html](https://docs.cocos.com/creator/2.4/manual/en/getting-started/coding-setup.html)  
25. Collaboration Tools MCP Servers \- Page 12, 檢索日期：4月 2, 2026， [https://mcpmarket.com/categories/collaboration-tools?page=12](https://mcpmarket.com/categories/collaboration-tools?page=12)  
26. Game Development MCP Servers \- Page 5, 檢索日期：4月 2, 2026， [https://mcpmarket.com/categories/game-development?page=5](https://mcpmarket.com/categories/game-development?page=5)  
27. Taozhuo Claude Code Skills, 檢索日期：4月 2, 2026， [https://skillsplayground.com/skills/by/taozhuo/](https://skillsplayground.com/skills/by/taozhuo/)  
28. 【生成AIニュース+】『VibeVoice』『Pine AI』『PixelSmile LoRA』『LTX 2.3 Multifunctional』『Another』『ComfyUI-Dynamic-Si \- note, 檢索日期：4月 2, 2026， [https://note.com/toshia\_fuji/n/n06a492aebae7](https://note.com/toshia_fuji/n/n06a492aebae7)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAAA00lEQVR4XmNgGAXoQASI/xPAYUDMDNOADYAkJzJAFOsBMQcUSwJxEFR8OhCzwjSgA5DirQwQhSxociAAEv8HxB7oEjDgwgBR8BtdAgpgXilCl4CBVgaIgqvoEgwQF4Hk3gOxDpocHMCcPx9dAgiMGSByZUDMiCYHBzA/bgbiWVB8Ayp2nAGPRhgAGfAKiJOBOASK3YBYGFkRLsDDADFgDQP2GCAIooH4KwPEryQDkN9AAQcKfVCKJBmANIE0gwwhGFDIQI0BNa3D8B5kRaNgFNAUAACOQjNeSzk0OgAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAdCAYAAABmH3YuAAAAnUlEQVR4XmNgGMpAD4g70QVBQBqIHwDxXTRxMHAB4n9AvAZdAgSKgPg/EJcjCwYB8SMg/gWVfAfEK4CYGySpCcQhQPweilOB2AqIGUGSMADSVYUsAAMgVSDHgByFAUSA+DkQK6FLgIAxEO9hgDoCHUQDcSsSHxRKzDDOJCC2YYDYXQbErDAJENAF4itAfA6I5yFLwIAkEAugC454AAACFxhOIwApcgAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAbCAYAAACTHcTmAAABLElEQVR4XmNgGAVDGpwC4v9APBuImYGYEYiFgXgrVPwiQinx4DkDRLMfmrg4EF+HypEMQJreArEmmjgvEB9mgMjzoMnhBdwMEE2T0CUYIC4HyZHsUiUG7F4Hgc0MELk96BKEgAsDdq9zMiAMlECTIwhagfg9EC8A4llQvAGIfwFxLgPEcJIAyOugmI9Gl0ADrEC8EYgjgHgOlI8TeDJAvGiMLoEGXBkgyQsEQC7PQJLDACCvgwwVRJdAAqCMMB+IWZDEQOEMSjUYAOZ1QslFEogfool9AmJ9ZAFYFixkgBj4kwGiEVfixmboVwa0IFMD4tcMiEQNw0XIipAAUYaSCmBZFRmALAFZRhHwYECN/RwkObIBKF0uB2IdIO4EYn5UafKBAhD7QOlRMBQBAOrbOvIUcsb6AAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAaCAYAAAC3g3x9AAABQ0lEQVR4Xu2TzypFURTGP6GUK5RClAEvIH9GzFAGDEyvB2BiYCIzZeARTJRMzU1QbhkaKxPFQzBR+L67tmvvdc65zo2Bwf3Vr9Paa5112nvtA7T5Kz5yPE0qgMcoJ+/pUFIR0U23YIXbdCBN1+mhh7CacdqZprMs0Dda9YmAPnoOa1qKUfpMz3wioC0u+8Vm9NFbegHbXkwXPQ7P0qiJmt3RQZdbpxNurRR79IXOhLgDdmZ+4qXRQN7pUogX6QOdalQYk7AhVtx6hlXYtdgIcY1uNrLGCD2CfVxn3hRNWg1P6DydTtMYo09RrIu9G8UZNAw1vKI3Lifm6GsUa8tF16xOL75/rWuXE2uw3BdqqDq9V4he2IdN2JPXsBaehRzQfr8YaHnLP+GHMgy7u79Cf8wO7PJfIv9oWmaWrqD4aNr8Jz4B/KQ4gAnhTEEAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAbCAYAAACjkdXHAAAA4klEQVR4Xu2SwQpBQRSGj2JFSUopRUoWlra2ljaytSYvIG8hS9nayANYKBZWLGTrAXgCCyn8pznMOBnXA9yvvqYz/z13mnMvUYiPHDzozX+owgt86OAfZmQa2YjKAtnABZnmhMp+0ocxWbk5+xn7qZAdUpNMc9HGfqJwAgdSN8g08/ACqcMdzEhdgzdZAznCNmyJfGdu7rgPfaMAp3DsyPWVzEu88HccyuqSInONkdp/k4Rr2FX7DA9wDpcw7gZ8Shpu4R323FCyElzBPSyTHSTl4YnsL8jySS90xp6dPCTEzxPP4S0WBkWCUwAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUgAAABLCAYAAAAS9x4pAAAH+0lEQVR4Xu3cX6gtVR3A8V+kUJRKFEUkXJIyrCylPxokgRUkaEX2EJQgWiTigxT9sQe9IIHiQ2EFFcUlREXRB5FCUupAPfTnoYLihhldRQqUkKQEE631de1199rrzMyeffY+d+9zzvcDP+45s+ZwZ/aa/Vv/ZiZCkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiTtYy9J8Y4UWyleOVskSQfTy1L8KsW/U/wvTJCS1OkrYYKUpE4mSEnqYYKUpB4mSEnqYYKUpB4mSEnqYYKUpB4mSEnqsa4E+YHIN6s/meKmFK+YLZak9Xl9ikMp7k7xaIoLJ9tOrnfaRd9J8fLIjzs+m+KOOHH/tyQN4hHDrnhXvdMuOpbinZOfj6R4IcWHjpdKK/SLFJe2G3s8nOK97UZpCZ+JnFx/0BYMeG2Kl05+vjVMkBpwW4rHBuLKFKce33vWaSm+GXmoMgaJ9B/txjW6Irafb4nfp/j6dNe1+VmKP6f4UYrvR547e/fMHhGfiNljv2y2eF/7Y+QEyeezE39J8dM48fOg2iMuSvGpyBcJ8zFfSvHJSVwd+eL712S/GknxxsitcRfe2tKWMc/DkIbEugnOS3FL5B4E51nO+9Mp7krxfIqbY73zUx9L8cUU/5nE9bF9UeGsFN+KfA4/T/GG2eJtSt2UXtRexTVYhucPNWUF+7w6uhMgZYxqDrUFUu01Kf4U3T2m96R4JvJFWJwUeUhztNpWOyNyT/GfbUHkv+XvXtcWrAlDLM7tt21BckpMv3xtUloUX9Ay77UT9JBY0GAxo8UXnZ782ERe6obEuihWnjcB58oizw8j19FfZ4uP45qmnHquMZq5b/IzDcq8RkUHGJPj9E4+2hYkl8S0lS5KAvx2ta1Gb5P9t5rtBWX0WjfBVuTjOdJsB8monEdXD2QR/P0yixBfi/6kdkHkYfhYy5zTpiRIrlUaNY6H86Hx6ELjRnl9bTMP/r2YjmSuje0jJOlF9D5IDlxEXV8Y5rwo+021jf2fju09IoYyJJUHI/8N85ddQzkWduix0nNdN46TxqEreR2OPO1AAlrWsgmyNFT8W7sqcrKbN21BPZfba0rd8HtbN/NsQoJkyoHeH7fqlM+FOiyYQuDcCKZPuHbfHLkOKGP/Ovp65lK8KnJLzIXShe1PxezqM/szpGmHyX+I7Rdf1363R3eCXQeOkfPhc6i9KcXfU3w5xi9CDVk2QTLVwbF+odlOz3FMAqfxauuGaOtmnk1IkDSuzB+jjFbq65fFt/Y8uz47aa4yvK4vMPCFuiHFIynOacoej+EhGq32VvSXl3mhecMaWnVWbsfG4Zjfk6pxfBzHkZhNgh+PvBr838n2iyN/KelNX1jtt4hlEyRDa46VoXbBPFx9FwG9wWtSPBB5seatk+01bmfZiv66mWfdCZI57Pqc+65flN5i19SRNArJgYvodzEdlhBcXH24IFk06MJixryLsswbrfvLxjE+F3mYVp97jWRT32PHz0OfTZ9lE2RJ5mW1lgbsl9PiF7H4VXpJ1EO7slu2DdXNPMvUGbdOjYk+fAZbMXtL0xMx7SG2aIC3YueNgXR8eE2iHGsoQbKA07eYUGxKgqQneyyGVzBZjKqPk59Pr35vMedavrBjgs+yva+xCz0n9qe+6D1dl+L+mT2myb6gjliJL8ri2lDdFN+N7cc6L3Yb863MJ5bbsYjPRZ4C6vr/qd929VpaSBmecO/fWEMJckyrvQkJsvRG7omcfPpwi1ObIHfSE1y2Bwk+MxYUzo18/x7/1ihvE2TdIy7zdUN1M88664zeZTvfWuqR86rrcRW9ZR1w9ES4sLoWKYb0zUEy9Pxx5Cc7Cm64boekmzAHyReHY3h/W9BoEzk/tyvJY6wqQTK/y1woQ+xWV4Ks/0/qpu5pkWzauplnXQmSY2UlugvnyXnVd0Uw18pnVXrQzNf6OKEWwgXFhbXIc6zoW8UmodHDKUM4bsOok2WxCavY5Qbx9hxafMnaBMmK8qJWlSCJD7cFE10Jsp4OoG6Y/gB1c29VNtaJTpAkRRamGLVcHLONMotSXENlmojGrvSYyyil4DNrG3SpE70PLqTyKOE3Jr+XlcF5+hJceSKHLyUt9uHJv6113gfJl+T8yMmCc39L5CTZdZzgPNsE2Z73GKtIkGU6pG9KoCtB1g0Anzm9/1I3zDMu6kQnyNIolKj//7M7ymnQ8PnJ76DB/vXkZ2nXccHRE+l7koZkO9RacxF/pN24oQ5HXsmmx8XwneHtTqwiQX41xQfbjZU7Y1onb4zux+84jqG6mWdVCZKh/dsjN9ZjG+ZF0cPselBB2lX0YPgyHm0LRuBvSTJj5wrXjeP8SeQ5TnpcnPdOkJR20vNcxKHIw83zIj9pcvNs8UqsIkFyXLwIpPT66M3Pm4+W9hRafW7Ybd/YM4Sh3ZFYrgejvY1n8M+sfi/XBInybdV2ac+jd8Urz8YOkS6NfHOvDi4WBJ9N8b5qW1lxXkXvVNooLLiQ+Mbg3j3fKH6wkSDpLdZvcypz2iwqSZIq5Z7UTXkFniRtBOYgefEtCXKR+WxJ2vfoPbKizfPUkqQJFvlYtGtfpydJBxo33rNgM/RmJEk6cHhLOzfftw8L+MZvSQca98z+LcVnY/a9jpfHzt6SJEn7BvfMti+YKLHss+qSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJGni/1GT3A1nPqB0AAAAAElFTkSuQmCC>