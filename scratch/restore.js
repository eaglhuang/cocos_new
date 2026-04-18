const fs = require('fs');
const contentToInsert = `- \`比較舊的/遊戲機制優化與策略建議.md (doc_spec_0065)\`
- \`比較舊的/遊戲機制推演與玩家歷程.md (doc_spec_0064)\`
- \`比較舊的/遊戲系統設計：運氣、刷寶、轉蛋優化.md (doc_spec_0061)\`
- \`比較舊的/遊戲經濟循環與女性角色設計.md (doc_spec_0063)\`
- \`比較舊的/養成循環與營收節奏探討.md (doc_spec_0066)\`

### 1.4 更舊的討論

- \`更舊的討論/策略戰場視覺與玩法融合設計.md (doc_spec_0082)\` (內容已納入戰法場景規格書.md § B，含 4 類場景戰法 + 智謀能量 HUD 構思)
- \`更舊的討論/三國傳承：賽馬娘養成融合提案.md (doc_spec_0076)\` → 已承接至 \`培育系統.md\` (doc_spec_0026) 與 \`結緣系統.md\` (doc_spec_0028)
- \`更舊的討論/模組化戰場系統開發策略.md (doc_spec_0089)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044) 與 \`戰場部署系統.md\` (doc_spec_0040)
- \`更舊的討論/策略遊戲視覺與系統設計.md (doc_spec_0080)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044) 與 \`兵種（虎符）系統.md\` (doc_spec_0012)
- \`更舊的討論/賽馬娘機制三國化轉化.md (doc_spec_0093)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044) 與 \`數值系統.md\` (doc_data_0001)
- \`更舊的討論/遊戲美術風格與市場區隔策略.md (doc_spec_0083)\` → 已承接至 \`美術風格規格書.md\` (doc_art_0002)
- \`更舊的討論/馬娘養成機制三國化設計.md (doc_spec_0079)\` → 已承接至 \`培育系統.md\` (doc_spec_0026) 與 \`教官系統（支援卡）.md\` (doc_spec_0027)

### 1.5 2026-04-11 本輪已整併

- \`20260410/三國傳承 雙層數值規格書.md (doc_spec_0046)\` → 已承接至 \`武將人物介面規格書.md\` (doc_ui_0012)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)
- \`20260410/子嗣成長系統：隱藏屬性設計.md (doc_spec_0047)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)、\`培育系統.md\` (doc_spec_0026)、\`武將人物介面規格書.md\` (doc_ui_0012)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)
- \`20260410/家族積分制：世家英靈成長規則.md (doc_spec_0050)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)
- \`20260410/英靈卡與家族血脈規則.md (doc_spec_0048)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)、\`血統理論系統.md\` (doc_spec_0011)
- \`20260410/英靈祭奠與世家系統規則.md (doc_spec_0049)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)、\`武將壽命系統.md\` (doc_spec_0018)
- \`最早的討論/三國武將養成與血統遺傳.md (doc_spec_0098)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)
- \`最早的討論/三國武將養成與遺傳系統設計.md (doc_spec_0099)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)
- \`最早的討論/武將血統繼承與養成系統綱要.md (doc_spec_0106)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)、\`武將壽命系統.md\` (doc_spec_0018)
- \`最早的討論/虎符系統借鑑賽馬娘設計.md (doc_spec_0108)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)、\`兵種（虎符）系統.md\` (doc_spec_0012)
- \`最早的討論/虎符系統平衡與養成策略.md (doc_spec_0107)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)、\`兵種（虎符）系統.md\` (doc_spec_0012)
- \`最早的討論/虎符系統設計與商業化探討.md (doc_spec_0109)\` → 已承接至 \`英靈世家系統.md\` (doc_spec_0022)、\`兵種（虎符）系統.md\` (doc_spec_0012)
- \`更舊的討論/三國傳承 UI 布局說明書.md (doc_spec_0074)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/遊戲視覺構圖與攝影機規格.md (doc_spec_0084)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/AAA 級遊戲畫面視覺描述指令.md (doc_spec_0094)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/AI 繪圖指令：三國冷色調戰場.md (doc_spec_0095)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/夜襲戰場視覺規格提案.md (doc_spec_0078)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/戰鬥畫面 AI 繪圖指令調整.md (doc_spec_0090)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/遊戲戰術設計與視覺規格.md (doc_spec_0087)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`比較舊的/關卡設計與美術挑戰建議.md (doc_spec_0068)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/三國傳承：軍師演武模式提案.md (doc_spec_0075)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/戰場互動矩陣與養成動力.md (doc_spec_0091)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/戰場反制矩陣：培育驅動玩法.md (doc_spec_0092)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)
- \`更舊的討論/我的想法是這樣的挑戰關卡必須是連環破 _ 例如要擊敗曹操 就必須先過 典韋 許褚 兩關, 第三關才....md (doc_spec_0077)\` → 已承接至 \`關卡設計系統.md\` (doc_spec_0044)

### 1.6 2026-04-11 第二輪已整併

- \`最早的討論/幕府大廳 UI 設計與優化.md (doc_spec_0120)\` → 已承接至 \`大廳系統.md\` (doc_spec_0002)
- \`最早的討論/革命幕府大廳 UI 與美術設計.md (doc_spec_0110)\` → 已承接至 \`大廳系統.md\` (doc_spec_0002)
- \`最早的討論/遊戲玩法：幕府議事廳設計.md (doc_spec_0116)\` → 已承接至 \`大廳系統.md\` (doc_spec_0002)、\`戰法場景規格書.md\` (doc_spec_0039)
- \`最早的討論/遊戲大廳世界地圖設計.md (doc_spec_0113)\` → 已承接至 \`大廳系統.md\` (doc_spec_0002)
- \`最早的討論/遊戲大廳氛圍替換系統.md (doc_spec_0114)\` → 已承接至 \`大廳系統.md\` (doc_spec_0002)
- \`最早的討論/輕量化動態大廳設計優化.md (doc_spec_0121)\` → 已承接至 \`大廳系統.md\` (doc_spec_0002)
- \`最早的討論/許願商城 UI 設計提案.md (doc_spec_0111)\` → 已承接至 \`大廳系統.md\` (doc_spec_0002)、\`經濟系統.md\` (doc_spec_0032)
- \`最早的討論/遊戲商城時間換價值設計.md (doc_spec_0117)\` → 已承接至 \`大廳系統.md\` (doc_spec_0002)、\`經濟系統.md\` (doc_spec_0032)
- \`更舊的討論/策略養成遊戲平衡與營運探討.md (doc_spec_0081)\` → 已承接至 \`治理模式他國AI系統.md\` (doc_spec_0020)、\`領地治理系統.md\` (doc_spec_0037)
- \`更舊的討論/遊戲機制優化與戰略閉環.md (doc_spec_0088)\` → 已承接至 \`治理模式他國AI系統.md\` (doc_spec_0020)
- \`更舊的討論/遊戲設計與市場分析建議.md (doc_spec_0085)\` → 已承接至 \`大廳系統.md\` (doc_spec_0002)、\`治理模式他國AI系統.md\` (doc_spec_0020)
- \`更舊的討論/遊戲開場設計：傳承與養成.md (doc_spec_0086)\` → 已承接至 \`治理模式他國AI系統.md\` (doc_spec_0020)
- \`最早的討論/遊戲系統、玩家與行銷分析.md (doc_spec_0115)\` → 已承接至 \`治理模式他國AI系統.md\` (doc_spec_0020)
- \`最早的討論/遊戲設計規格書：三國傳承.md (doc_spec_0118)\` → 已承接至 \`治理模式他國AI系統.md\` (doc_spec_0020)、\`大廳系統.md\` (doc_spec_0002)
- \`最早的討論/SLG 遊戲養成與商業化討論.md (doc_spec_0129)\` → 已承接至 \`治理模式他國AI系統.md\` (doc_spec_0020)

### 1.7 2026-04-11 第三輪已拍板回寫

- \`整併疑問書.md\` (doc_spec_0160) 的 \`Q1 ~ Q13\` → 已拍板並開始回寫至 \`英靈世家系統.md\` (doc_spec_0022)、\`兵種（虎符）系統.md\` (doc_spec_0012)、\`轉蛋系統.md\` (doc_spec_0042)、\`武將壽命系統.md\` (doc_spec_0018)、\`教官系統（支援卡）.md\` (doc_spec_0027)、\`大廳系統.md\` (doc_spec_0002)、\`治理模式他國AI系統.md\` (doc_spec_0020)、\`官職系統.md\` (doc_spec_0014)

### 1.8 2026-04-11 第四輪已整併

- \`最早的討論/打造三國生活感武將系統.md (doc_spec_0102)\` → 已回寫 \`武將日誌與離線互動系統.md\` (doc_spec_0015)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`名詞定義文件.md\` (doc_spec_0008)、\`UI 規格書.md\` (doc_ui_0027)、\`cross-ref-*\`。
- \`最早的討論/結合玩家日誌的動態敘事.md (doc_spec_0112)\` → 已回寫 \`武將日誌與離線互動系統.md\` (doc_spec_0015)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`UI 規格書.md\` (doc_ui_0027)、\`cross-ref-*\`。
- \`最早的討論/離線互動與武將人性化設計.md (doc_spec_0128)\` → 已回寫 \`武將日誌與離線互動系統.md\` (doc_spec_0015)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`名詞定義文件.md\` (doc_spec_0008)、\`UI 規格書.md\` (doc_ui_0027)、\`cross-ref-*\`。

### 1.9 2026-04-11 第五輪已整併

- \`最早的討論/兵符數值設計與平衡策略.md (doc_spec_0104)\` → 已回寫 \`兵種（虎符）系統.md\` (doc_spec_0012)、\`戰場部署系統.md\` (doc_spec_0040)、\`主戰場UI規格書.md\` (doc_ui_0001)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`名詞定義文件.md\` (doc_spec_0008)、\`cross-ref-*\`。
- \`最早的討論/兵符養成與AI委任機制.md (doc_spec_0105)\` → 已回寫 \`兵種（虎符）系統.md\` (doc_spec_0012)、\`戰場部署系統.md\` (doc_spec_0040)、\`主戰場UI規格書.md\` (doc_ui_0001)、\`武將人物介面規格書.md\` (doc_ui_0012)、\`cross-ref-*\`。
- \`最早的討論/名將挑戰賽：張飛盃賽制設計.md (doc_spec_0103)\` → 已回寫 \`名將挑戰賽系統.md\` (doc_spec_0007)、\`經濟系統.md\` (doc_spec_0032)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`UI 規格書.md\` (doc_ui_0027)、\`cross-ref-*\`。
- \`最早的討論/廢除部署點數設計討論.md (doc_spec_0122)\` → 已回寫 \`戰場部署系統.md\` (doc_spec_0040)、\`主戰場UI規格書.md\` (doc_ui_0001)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`cross-ref-*\`。
- \`最早的討論/戰場策略與棋盤格玩法融合.md (doc_spec_0125)\` → 已回寫 \`戰場部署系統.md\` (doc_spec_0040)、\`戰法場景規格書.md\` (doc_spec_0039)、\`主戰場UI規格書.md\` (doc_ui_0001)、\`cross-ref-*\`。
- \`最早的討論/遊戲資源管道與商業化設計.md (doc_spec_0119)\` → 已回寫 \`經濟系統.md\` (doc_spec_0032)、\`名將挑戰賽系統.md\` (doc_spec_0007)、\`UI 規格書.md\` (doc_ui_0027)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`cross-ref-*\`。

### 1.10 2026-04-11 第六輪已整併

- \`最早的討論/三國傳承：遊戲設計大綱.md (doc_spec_0100)\` → 已回寫 \`大廳系統.md\` (doc_spec_0002)、\`治理模式他國AI系統.md\` (doc_spec_0020)、\`經濟系統.md\` (doc_spec_0032)、\`keep.summary.md\` (doc_index_0012)、\`keep-shards/keep-core.md (doc_index_0006)\`。其中舊稿內的 \`虎符轉蛋\` 提案已依現行正式共識排除，維持 \`虎符僅由死亡結算產出\`。

### 1.11 2026-04-11 第七輪已整併

- \`最早的討論/戰棋遊戲的武將傳承與繁衍.md (doc_spec_0126)\` → 已回寫 \`結緣系統（配種）.md\` (doc_spec_0028)、\`教官系統（支援卡）.md\` (doc_spec_0027)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`名詞定義文件.md\` (doc_spec_0008)、\`keep.summary.md\` (doc_index_0012)、\`keep-shards/keep-core.md (doc_index_0006)\`、\`cross-ref-specs.md\` (doc_index_0002)。
- \`最早的討論/三國傳承：賽馬娘養成融合提案.md\` → 已回寫 \`結緣系統（配種）.md\` (doc_spec_0028)、\`教官系統（支援卡）.md\` (doc_spec_0027)、\`培育系統.md\` (doc_spec_0026)、\`轉蛋系統.md\` (doc_spec_0042)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`名詞定義文件.md\` (doc_spec_0008)、\`keep.summary.md\` (doc_index_0012)、\`keep-shards/keep-core.md (doc_index_0006)\`、\`cross-ref-specs.md\` (doc_index_0002)。
- \`最早的討論/戰術遊戲關卡設計規格書.md (doc_spec_0124)\` → 已回寫 \`關卡設計系統.md\` (doc_spec_0044)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`名詞定義文件.md\` (doc_spec_0008)、\`keep.summary.md\` (doc_index_0012)、\`keep-shards/keep-core.md (doc_index_0006)\`、\`cross-ref-specs.md\` (doc_index_0002)。
- \`最早的討論/賽馬娘式轉蛋系統平衡規劃.md (doc_spec_0127)\` → 已回寫 \`轉蛋系統.md\` (doc_spec_0042)、\`教官系統（支援卡）.md\` (doc_spec_0027)、\`Data Schema文件（本機端與Server端）.md\` (doc_tech_0013)、\`名詞定義文件.md\` (doc_spec_0008)、\`keep.summary.md\` (doc_index_0012)、\`keep-shards/keep-core.md (doc_index_0006)\`、\`cross-ref-specs.md\` (doc_index_0002)。其中舊稿中的 \`虎符轉蛋\` 與 \`DP\` 方案已依現行正式共識排除。

## 2. 仍待整併

### 2.1 更舊的討論

- 本輪已清空；所有「更舊的討論」檔案皆已獲整併。

### 2.2 比較舊的

- 本輪已清空；若後續有新增比較舊來源，再補入此節。

### 2.3 20260410
`;
let data = fs.readFileSync('docs/遊戲規格文件/討論來源整併狀態.md', 'utf8');
data = data.replace('- 本輪已整併完成，正式承接檔為 `英靈世家系統.md` (doc_spec_0022)', contentToInsert + '\n- 本輪已整併完成，正式承接檔為 `英靈世家系統.md` (doc_spec_0022)');
fs.writeFileSync('docs/遊戲規格文件/討論來源整併狀態.md', data);
console.log('Restoration and update complete!');
