/**
 * fix-generals-stories.js
 * 修正 generals.json 中的亂碼文字，並補全 Lu Bu / Zhao Yun 的故事欄位。
 * 執行方式：node tools_node/fix-generals-stories.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const GENERALS_PATH = path.join(__dirname, '..', 'assets', 'resources', 'data', 'generals.json');

// ── 正確故事內容 ────────────────────────────────────────────────────────────────

const STORIES = {
  'zhang-fei': {
    historicalAnecdote:
      '長坂之戰，曹軍萬騎追至橋畔。張飛獨立橋上，橫矛立馬，大喝一聲震天動地，曹騎無一人敢進。橋後濃煙滾滾，傳言煙中隱有甲士鬼影隨行——那一刻張飛究竟允諾了什麼，無人知曉，亦無人敢問。',
    bloodlineRumor:
      '涿郡傳言，張氏先祖曾從某無名戰神習武，那戰神留下的不只是刀法，還有一口能壓山河的聲線。張飛每次在戰場怒吼，地面隱隱微微顫動。',
    crestHint: '燕人武聖，長坂一吼封神',
    storyStripCells: [
      { slot: 'origin',    text: '涿郡屠戶之子，生來聲如洪鐘' },
      { slot: 'faction',   text: '義結金蘭，隨兄奔赴桃園誓言' },
      { slot: 'role',      text: '前陣猛將，一矛震懾萬軍魂魄' },
      { slot: 'awakening', text: '長坂橋畔，孤身一吼退萬騎' },
      { slot: 'bloodline', text: '燕地武脈，聲震山河的古老傳承' },
      { slot: 'future',    text: '吼聲未散，橋下仍有未解之謎' },
    ],
  },
  'guan-yu': {
    historicalAnecdote:
      '曹操封其為漢壽亭侯，賜金馬官爵，關羽盡皆收下卻一一封存，得知劉備下落後提刀單騎絕塵而去。曹軍幕僚言此人留不得，曹操卻止住：義士也，各為其主。多年後曹軍在華容道遇見那把未染血的刀，無人說清究竟是誰放走了誰。',
    bloodlineRumor:
      '河東解縣傳言，關氏先祖入山師承一隻自稱青龍之靈獸。那靈獸只傳了一招——非刀法，而是一種讓對手在出刀前便已心折的眼神。',
    crestHint: '青龍義絕，一騎絕塵千秋義',
    storyStripCells: [
      { slot: 'origin',    text: '河東解縣亡命，身負義烈之氣' },
      { slot: 'faction',   text: '桃園換帖，誓與大哥共死生' },
      { slot: 'role',      text: '青龍持戟，威懾千軍如山不動' },
      { slot: 'awakening', text: '夜讀春秋，悟得義重於萬鈞' },
      { slot: 'bloodline', text: '青龍血脈，眼神能折敵之膽魄' },
      { slot: 'future',    text: '神廟香火不絕，武聖尚未蓋棺' },
    ],
  },
  'lu-bu': {
    historicalAnecdote:
      '濮陽一役，曹操甫一接觸便知不妙打馬就走，呂布一戟揮來，戟刃劃過盔上纓穗差一寸便是人頭落地。事後曹操問謀士：彼若懂謀略天下何人能制？謀士沉默答：正因他不懂，主公才尚在。那一寸的距離，後世至今仍不知是天意還是呂布有意留手。',
    bloodlineRumor:
      '五原郡傳說，呂氏祖上曾在大漠守過一座獸神廟，祭祀戰神的坐騎——赤色之獸。呂布生來便能馴化任何烈馬，那是血裡的呼應，不是後天學的。',
    crestHint: '飛將修羅，一戟驚天覺醒待解',
    storyStripCells: [
      { slot: 'origin',    text: '五原邊地，武勇生於大漠荒野' },
      { slot: 'faction',   text: '三易其主，天下皆知其不可信' },
      { slot: 'role',      text: '飛將破陣，一戟足以定生死局' },
      { slot: 'awakening', text: '濮陽一戟，距皇霸只差一寸命' },
      { slot: 'bloodline', text: '獸神血裔，赤兔乃共鳴之戰獸' },
      { slot: 'future',    text: '修羅核未解，最終怒火待引燃' },
    ],
  },
  'cao-cao': {
    historicalAnecdote:
      '官渡決戰前夕，有幕僚秘密投書袁紹。曹操截獲後一一拆看，卻命人把那些書信盡數焚毀，連名字也不查。眾人以為是大度，唯有荀彧知道：那些名字他已默記在心，只是時機未到。三日後某條糧道出現了奇異的疏漏——曹操從未解釋那把火燒的究竟是什麼。',
    bloodlineRumor:
      '沛郡流傳曹氏先祖曾替漢高祖斷過一條龍脈，留下一半埋於地下說是日後子孫用。曹操年輕時曾獨自去挖那地方，挖了整整七日，出來後眼神便與從前不同了。',
    crestHint: '魏武霸道，天下一局待最後棋',
    storyStripCells: [
      { slot: 'origin',    text: '沛郡官宦，少年已有梟雄之相' },
      { slot: 'faction',   text: '奉天子令，以漢旗行霸主之實' },
      { slot: 'role',      text: '運籌帷幄，萬里戰局皆在掌中' },
      { slot: 'awakening', text: '官渡一燒，謀略境界破開天塹' },
      { slot: 'bloodline', text: '漢脈龍骨，霸道因子藏而未發' },
      { slot: 'future',    text: '天下未定，霸業仍在等最後落子' },
    ],
  },
  'zhao-yun': {
    historicalAnecdote:
      '長坂坡主帥潰敗，幼主阿斗陷入亂軍。趙雲一人七進七出，每次回頭都有新的曹騎攔路，每次他都殺了過去，臉上竟無一絲驚慌。劉備事後問他心中所想，趙雲沉默片刻答：臣只是不允許。那句話之後成了常山一族最嚴密的家訓，具體含義從未對外公開過。',
    bloodlineRumor:
      '常山有不傳外人的說法：趙氏先祖曾在山中見過一條白龍，那龍盯著他看了三息，只留下一個字便離去——「膽」。此後趙氏後裔在最危險的時刻，脈搏反而會慢下來。',
    crestHint: '常山白龍，一身是膽護主到底',
    storyStripCells: [
      { slot: 'origin',    text: '常山趙氏，靜水流深的邊地世家' },
      { slot: 'faction',   text: '數易陣營，終尋對的主而歸附' },
      { slot: 'role',      text: '孤膽長槍，亂軍護主的鐵臂膀' },
      { slot: 'awakening', text: '長坂七出，無畏者心生龍膽之火' },
      { slot: 'bloodline', text: '白龍傳膽，危境脈搏反慢的血裔' },
      { slot: 'future',    text: '白龍之約尚存，傳承者尚未現身' },
    ],
  },
};

// ── 主程式 ──────────────────────────────────────────────────────────────────────

function main() {
  const raw = fs.readFileSync(GENERALS_PATH, 'utf8');
  const generals = JSON.parse(raw);

  let patchCount = 0;

  for (const general of generals) {
    const story = STORIES[general.id];
    if (!story) continue;

    let patched = false;

    if (story.historicalAnecdote !== undefined) {
      general.historicalAnecdote = story.historicalAnecdote;
      patched = true;
    }
    if (story.bloodlineRumor !== undefined) {
      general.bloodlineRumor = story.bloodlineRumor;
      patched = true;
    }
    if (story.crestHint !== undefined) {
      general.crestHint = story.crestHint;
      patched = true;
    }
    if (story.storyStripCells !== undefined) {
      // 依 slot 名稱 patch（保留現有 slot 順序）
      const cellMap = new Map(story.storyStripCells.map(c => [c.slot, c.text]));
      if (general.storyStripCells && Array.isArray(general.storyStripCells)) {
        for (const cell of general.storyStripCells) {
          if (cellMap.has(cell.slot)) {
            cell.text = cellMap.get(cell.slot);
          }
        }
      } else {
        general.storyStripCells = story.storyStripCells;
      }
      patched = true;
    }

    if (patched) {
      patchCount++;
      console.log(`[fix] Patched: ${general.id} (${general.name})`);
    }
  }

  const output = JSON.stringify(generals, null, 2) + '\n';
  fs.writeFileSync(GENERALS_PATH, output, 'utf8');

  console.log(`\n[done] ${patchCount} general(s) patched. File saved.`);
}

main();
