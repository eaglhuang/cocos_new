const fs = require('fs');

// 1. Update 兵種（虎符）系統.md
let tallyPath = 'docs/遊戲規格文件/系統規格書/兵種（虎符）系統.md';
let tallyContent = fs.readFileSync(tallyPath, 'utf8');

// Insert Rule 1 & Rule 4 into Section A
tallyContent = tallyContent.replace(
  '5. **裝備唯一限制**：每個武將僅能裝備**一個**特殊虎符部隊，不可疊加。',
  `5. **裝備唯一限制**：每個武將僅能裝備**一個**特殊虎符部隊，不可疊加。
6. **沒收與降忠**：君主可以強行沒收手下武將當前配戴的虎符，但這項行為會導致該武將的忠誠度大幅下降。沒收的虎符君主可自由再次賞賜。
7. **敵方天生裝備**：敵方陣營（AI）的武將如果星級達到三星（★★★）以上，天生就會自動裝備並帶著對應的虎符（特殊部隊）出戰。`
);

// Delete SMART from Base Troop table
tallyContent = tallyContent.replace(
  /\| 智將 \| SMART \| 低 \| 低 \| 1 \| 3（中遠程） \| 計策特化：不直接肉搏，以計策\/Debuff 為主要輸出 \|\r?\n/,
  ''
);

// Clean up references to SMART troop
tallyContent = tallyContent.replace(
  /\| 智將 \| SMART \| 「智將」 \| \|\r?\n/g, // if it exists in translations
  ''
);
tallyContent = tallyContent.replace(
  /\| UI_TROOP_SMART \| 「智將」 \| \|\r?\n/,
  ''
);
tallyContent = tallyContent.replace(
  /\| 智將 \|/g,
  '| 弓兵 |' // change the special troops base class to archers
);
tallyContent = tallyContent.replace(
  /CAVALRY \| INFANTRY \| ARCHER \| SHIELD \| PIKE \| NAVY \| SIEGE \| SMART \| MECHANICAL/g,
  'CAVALRY | INFANTRY | ARCHER | SHIELD | PIKE | NAVY | SIEGE | MECHANICAL'
);
tallyContent = tallyContent.replace(
  /\/\/ 智將被近戰剋制（無護衛時）\r?\nif \(attacker\.type in \[CAVALRY, INFANTRY, PIKE\] && defender\.type == SMART\): damage × 1\.4\r?\n/,
  ''
);


fs.writeFileSync(tallyPath, tallyContent, 'utf8');

// 2. Update 俘虜處理系統.md
let powPath = 'docs/遊戲規格文件/系統規格書/俘虜處理系統.md';
let powContent = fs.readFileSync(powPath, 'utf8');

// Insert Rule 2
powContent = powContent.replace(
  /4\. \*\*社交話題\*\*(.*)/,
  `4. **社交話題**：「我放走了呂布」vs「我把呂布關了一輩子」

### 補充：虎符沒收與轉移規則
- **投降才易主**：敵軍將領被俘虜後，玩家只有成功使其「投降」（選擇『勸降』或『招募』）才能奪得該武將身上裝備的虎符。
- **放走不掉裝**：若選擇「放走」，該將領會將虎符帶走，玩家無法獲得。
- **死亡回歸君主**：若在戰場上將其殺死（或後續任何死亡狀況），該員的虎符將不會掉落給擊殺者，而是會啟動「虎符永存定律」——自動飛回該敵將的原君主手中。`
);
fs.writeFileSync(powPath, powContent, 'utf8');

// 3. Update 轉蛋系統.md
let gachaPath = 'docs/遊戲規格文件/系統規格書/轉蛋系統.md';
let gachaContent = fs.readFileSync(gachaPath, 'utf8');

gachaContent = gachaContent.replace(
  /3\. 名將生前退役只進教官 \/ 傳承路徑，不直接從轉蛋或退役流程拿卡。/,
  `3. 名將生前退役只進教官 / 傳承路徑，不直接從轉蛋或退役流程拿卡。
3-b. **轉蛋預設無虎符**：玩家從轉蛋獲得的武將，基本出廠都不會自帶虎符軍隊。唯有透過長期培育且該武將死亡結算時，才會留下專屬的虎符遺產。`
);
fs.writeFileSync(gachaPath, gachaContent, 'utf8');

console.log('Successfully updated the 3 files according to the new user rules.');

