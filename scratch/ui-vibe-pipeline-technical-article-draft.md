# 把 UI 規格變成 AI 可執行的工程語言：Cocos Creator 的 spec-driven pipeline

> 這篇文章想回答的不是「AI 能不能幫我做 UI」，而是「能不能把 UI 變成一條可驗證、可量產、可追溯的工程流程」。

## TL;DR

如果 UI 的生產方式還停留在「手工拖 Prefab、手工改字、手工截圖比對」，那每多一個畫面，失控成本就會線性上升。

`ui-vibe-pipeline` 想解決的不是單一畫面，而是整條 UI 生產線：把參考圖、規格、版面、皮膚、內容合約、驗證與 QA 串成一條可重複執行的流程。

這條流程的核心不是讓 AI 取代設計師或工程師，而是讓 AI 接手那些最容易出錯、最耗時間、最適合結構化的工作，最後把人類保留在審美與決策的關鍵節點上。

## 1. 為什麼 UI 會越做越亂

多數 UI 專案一開始都很像樣：幾個面板、幾個按鈕、幾張圖，大家都能手工處理。

但當畫面數量開始增加，問題會很快浮現：

1. 同一種框體在不同畫面被重做三次。
2. 同一段文案在不同 Prefab 裡各自維護。
3. 同一個版面在不同人手上長出不同版本。
4. 截圖 QA 只能靠人工對照，沒有結構化驗證。
5. 修改一個元件，會牽動一串看不見的依賴。

這種情況下，UI 不再是「畫面設計」，而是「資料、結構、資產、驗證」混在一起的手工活。

對 Unity 團隊來說，這很像把 Prefab、ScriptableObject、EditorWindow、素材路徑和 QA 檢查全塞進同一個工作步驟裡，最後只剩下「能做出來」，卻沒有「能穩定重做」的能力。

## 2. `ui-vibe-pipeline` 的核心想法

`ui-vibe-pipeline` 的定位，是把「給一張圖」一路推進到「可驗證的 screen package 與 QA 閉環」。

它不是單點工具，而是一條總控流程：

```text
參考圖 / Figma / 既有頁面
    ↓
proof draft
    ↓
family-map / MCQ
    ↓
normalized recipe
    ↓
task card / screen spec
    ↓
CompositePanel / ChildPanel scaffold
    ↓
靜態驗證
    ↓
Browser QA
    ↓
人類驗收
```

這樣做的好處是，任何一步失敗都知道是什麼壞掉，而不是只能看到「畫面不對」這種結果。

## 3. 三層 JSON，才是 UI 的真實來源

這條流程能成立，背後靠的是一個很重要的觀念：UI 的真實來源不是 Prefab，而是三層 JSON。

1. `layouts` 管結構、節點與 widget。
2. `skins` 管視覺、sprite、九宮格與顏色 token。
3. `screens` 管組裝，決定哪個 layout 搭哪個 skin。

這個設計的價值在於解耦。

- 如果你改的是結構，只動 layout。
- 如果你改的是外觀，只動 skin。
- 如果你改的是畫面組合，只動 screen。

Unity 團隊可以把它想成：

- Layout 類似 Prefab 結構描述
- Skin 類似 Theme / ScriptableObject 映射
- Screen 則像某個畫面的裝配入口

當這三層分開後，團隊就不需要再靠「誰記得這個 Prefab 當初怎麼拖」來維持真相。

## 4. 一條可驗證的工作流，才是真的自動化

`ui-vibe-pipeline` 最有價值的地方，不是它能不能產出文件，而是它能不能把流程拆到每一步都可檢查。

### 4.1 先做 proof draft

第一步不是生成最終 UI，而是先把參考圖轉成 proof draft。

這一步要回答的是：

- 哪些區塊是視覺主體？
- 哪些區塊是資訊文字？
- 哪些區塊需要互動？
- 哪些地方還不能確定，需要保留 unresolved notes？

這一步很重要，因為它會逼流程先承認不確定性，而不是硬把模糊內容寫成假確定。

### 4.2 再做 family-map 與 MCQ

當 proof draft 出來之後，下一步是把畫面對應到既有 family，能重用就重用。

真的推不出的部分，再轉成 MCQ，讓人類只回答需要拍板的地方。

這裡的原則很直接：

- 能自動推的，不要再問一次。
- 只有需要決策的欄位，才丟給人。
- 同一份真相要一路往下接，不要中途長出第二套資料。

### 4.3 再收斂成 normalized recipe

MCQ 回答後，流程要回到結構化結果，也就是 normalized recipe。

這一步的角色，是把分散的決策收斂成可以直接拿去產出 screen spec、task shard 與 scaffold 的資料。

### 4.4 最後進驗證閉環

真正的完成不是「看起來差不多」，而是：

- 靜態驗證過了
- contract 對上了
- scaffold 生出來了
- Browser QA 看過了
- 仍保留可追溯的殘差與阻塞項

這種流程最大的差別是，它把 UI 從「感覺問題」變成「可診斷問題」。

## 5. Agent 負責什麼，人類負責什麼

這類流程最常見的誤解，是以為只要有 Agent，整個 UI 就能全自動完成。

實際上不是。

Agent 最適合做的是：

- 參考圖分解
- 欄位收斂
- family 推薦
- 文件與 task shard 的初稿
- scaffold 與驗證流程的機械化工作
- 迭代整理與比對

人類應該保留的是：

- 風格定調
- 關鍵審美判斷
- 有歧義時的拍板
- 最終驗收

換句話說，Agent 不是來取代 UI 團隊，而是把團隊從大量重工中解放出來，讓真正重要的判斷不被瑣碎流程淹沒。

## 6. 這條流程真正帶來的收益

如果這條生產線跑順了，收益不是單一畫面更漂亮，而是整個團隊的工作方式改變。

1. 新畫面能更快從參考圖起步。
2. 規格不再散落在多份文件與多個 Prefab 裡。
3. 修改結構與修改外觀可以分開處理。
4. QA 不再只靠人工記憶。
5. 美術資產替換不會每次都把流程打斷。
6. 需要擴大量產時，不會每張圖都重新發明一次做法。

這也是 `ui-vibe-pipeline` 最值得寫成技術文章的原因：它不是單一技巧，而是一種 UI 生產方法論。

## 7. 從工具面看，這條管線如何落地

如果用專案裡的腳本來對照，這條流程大概會長得像這樣：

- `tools_node/intake-ui-screen.js`：把參考圖或輸入來源收進來
- `tools_node/compile-proof-to-family-map.js`：把 proof draft 轉成 family-map
- `tools_node/compile-family-map-to-asset-tasks.js`：把 family-map 變成資產工作項
- `tools_node/scaffold-ui-spec-family.js`：產出可落地的 UI spec 骨架
- `tools_node/validate-ui-specs.js`：做結構與內容合約驗證
- `tools_node/headless-snapshot-test.js`：做快照回歸
- `tools_node/capture-ui-screens.js`：把實際畫面抓出來驗證

這些工具的價值，不在於單點自動化，而在於它們一起把 UI 生產從「手工搬運」變成「可重做的系統」。

## 8. 給 Unity 背景讀者的一個對照

如果你熟 Unity，可以這樣理解：

- `CompositePanel` 有點像一個畫面的總導演
- `ChildPanel` 像是可插拔的子模組
- `layout` 像 Prefab 結構
- `skin` 像 Theme / ScriptableObject 的視覺配置
- `screen` 像某個畫面的裝配入口

差別在於，Cocos Creator 這條流程更強調「規格先行」與「驗證閉環」。

不是先把東西拖出來再補說明，而是先讓規格成為真相，再讓畫面去服從規格。

## 9. 文章可以怎麼收尾

如果把這件事講到最後，可以用一句很直接的話收尾：

> 真正成熟的 UI 流程，不是做得快一次，而是每次都能重做，而且結果可驗證。

對 Cocos Creator 團隊來說，`ui-vibe-pipeline` 的價值就在這裡。它把 UI 從一個個手工專案，變成一條可以被設計、被追蹤、被驗證的工程流程。

這不是 AI 魔法，而是工程化。

## 建議配圖

1. 一張「參考圖 → proof draft → family-map → QA」流程圖。
2. 一張三層 JSON 的架構圖。
3. 一張傳統手工流程與 Agent 流程的對照圖。
4. 一張 Browser QA 的畫面截圖，展示驗證閉環。
