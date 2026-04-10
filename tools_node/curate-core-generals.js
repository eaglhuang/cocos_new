#!/usr/bin/env node
/**
 * curate-core-generals.js
 *
 * 1. 直接人工校準前 10 位核心武將的六維 / rarityTier / characterCategory / ep。
 * 2. 重寫前 50 位核心武將的 bloodlineRumor + storyStripCells，移除模板味。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.join(__dirname, '..');
const BASE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');
const LORE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-lore.json');
const STORIES_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-stories.json');
const BUILD_RUNTIME = path.join(__dirname, 'build-generals-runtime.js');

function loadWrapper(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    version: raw.version || '1.0.0',
    updatedAt: raw.updatedAt || new Date().toISOString(),
    data: Array.isArray(raw) ? raw : (Array.isArray(raw.data) ? raw.data : []),
  };
}

function writeWrapper(filePath, wrapper) {
  wrapper.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(wrapper, null, 2), 'utf8');
}

function toMap(list) {
  return new Map(list.map((item) => [item.id, item]));
}

function computeEp(record) {
  const stats = [record.str ?? 0, record.int ?? 0, record.lea ?? 0, record.pol ?? 0, record.cha ?? 0];
  const avg5 = stats.reduce((sum, value) => sum + value, 0) / stats.length;
  const maxStat = Math.max(...stats);
  return Math.round(avg5 * 0.8 + maxStat * 0.2);
}

function computeEpRating(ep) {
  if (ep >= 90) return 'S+';
  if (ep >= 85) return 'S';
  if (ep >= 80) return 'S-';
  if (ep >= 75) return 'A+';
  if (ep >= 70) return 'A';
  if (ep >= 65) return 'A-';
  if (ep >= 60) return 'B+';
  if (ep >= 55) return 'B';
  return 'C';
}

function story(origin, faction, role, awakening, bloodline, future) {
  return [
    { slot: 'origin', text: origin },
    { slot: 'faction', text: faction },
    { slot: 'role', text: role },
    { slot: 'awakening', text: awakening },
    { slot: 'bloodline', text: bloodline },
    { slot: 'future', text: future },
  ];
}

const TOP10_BASELINE = {
  'cao-cao': { str: 82, int: 94, lea: 92, pol: 96, cha: 90, luk: 86, rarityTier: 'legendary', characterCategory: 'titled' },
  'liu-bei': { str: 78, int: 84, lea: 88, pol: 82, cha: 96, luk: 88, rarityTier: 'legendary', characterCategory: 'titled' },
  'sun-quan': { str: 76, int: 86, lea: 89, pol: 88, cha: 90, luk: 85, rarityTier: 'legendary', characterCategory: 'titled' },
  'zhuge-liang': { str: 45, int: 99, lea: 96, pol: 97, cha: 92, luk: 90, rarityTier: 'legendary', characterCategory: 'famed' },
  'zhou-yu': { str: 74, int: 95, lea: 93, pol: 86, cha: 95, luk: 86, rarityTier: 'legendary', characterCategory: 'famed' },
  'guan-yu': { str: 97, int: 76, lea: 92, pol: 68, cha: 91, luk: 82, rarityTier: 'legendary', characterCategory: 'famed' },
  'zhang-fei': { str: 98, int: 52, lea: 88, pol: 38, cha: 74, luk: 76, rarityTier: 'legendary', characterCategory: 'famed' },
  'zhao-yun': { str: 96, int: 82, lea: 93, pol: 74, cha: 94, luk: 89, rarityTier: 'legendary', characterCategory: 'famed' },
  'lu-bu': { str: 100, int: 36, lea: 88, pol: 22, cha: 72, luk: 70, rarityTier: 'legendary', characterCategory: 'famed' },
  'sima-yi': { str: 68, int: 97, lea: 93, pol: 95, cha: 88, luk: 84, rarityTier: 'legendary', characterCategory: 'famed' },
};

const TOP50_STORY = {
  'cao-cao': {
    bloodlineRumor: '譙縣老人說，曹氏祖祠地底埋著一枚黑羽虎符；每逢兵荒，祠中銅燈便會自行偏向北方。曹操少年偷看過一次，從此連風聲都像軍令。',
    storyStripCells: story('橋畔機鋒識人', '奉天子號諸侯', '詭道裁局定勢', '官渡借火翻盤', '銅雀夜夢聽潮', '墳前誰解孟德'),
  },
  'liu-bei': {
    bloodlineRumor: '涿郡舊里相傳，劉家桑樹每逢霜降仍冒新芽，像替斷掉的宗枝續命。劉備幼時常在樹下編履，說自己不是等風，是在等肯認人的春雷。',
    storyStripCells: story('織席少年聽風', '桃園一誓成旗', '以仁心聚散兵', '長坂亂軍回首', '漢枝殘火未熄', '白帝孤燈仍明'),
  },
  'sun-quan': {
    bloodlineRumor: '江東舟子傳得很玄，孫家祖塚遇大潮時，封土會浮出細細鹽紋，像虎鬚又像龍鱗。孫權每逢大事摸一把鬍鬚，像是在聽潮水替祖輩投票。',
    storyStripCells: story('江東少年試虎', '承兄志穩東南', '鎮江表藏鋒守', '赤壁一火定吳', '紫髯映潮生紋', '建業鐘聲未歇'),
  },
  'zhuge-liang': {
    bloodlineRumor: '隆中井邊有樁怪談：夜深時把耳朵貼在井欄，能聽見木牛低鳴與旌旗擦風。諸葛亮年少曾笑說那不是鬼，是未來太吵，先從井底漏上來。',
    storyStripCells: story('隆中草廬觀星', '三顧門前雪靜', '羽扇落子驅兵', '空城琴聲壓敵', '臥龍井底藏脈', '五丈原燈難滅'),
  },
  'zhou-yu': {
    bloodlineRumor: '周家舊琴若在梅雨夜無人碰觸，弦上仍會自己泛出半闕商調。江東樂師都說，那不是濕氣，是周郎祖脈裡那點不肯熄的火還在校音。',
    storyStripCells: story('吳郡少年校曲', '孫郎席前定盟', '水火雙陣同調', '赤壁借勢封名', '琴灰裡藏潮火', '江東仍念周郎'),
  },
  'guan-yu': {
    bloodlineRumor: '解縣老人常說，關家舊刀鞘冬晨總先結霜，再慢慢滲成一道細紅線，像有人用指節描過刀背。關羽從不解釋，只在上馬前默默把鞘口按緊。',
    storyStripCells: story('解縣冷月磨刀', '桃園酒尚未冷', '青龍一線斷城', '樊城漢水成壁', '義氣入骨成紋', '麥城夜馬無聲'),
  },
  'zhang-fei': {
    bloodlineRumor: '燕地酒坊流傳，張家封壇若遇雷夜，甕蓋會自己跳三下。張飛少年嫌麻煩，乾脆提著酒甕去屋外淋雨，回來時竟說聽見甕裡有人替他擊鼓。',
    storyStripCells: story('涿郡屠坊舉鼎', '桃園怒笑同席', '一吼震散敵膽', '長坂橋頭獨立', '燕地戰鼓入骨', '酒盞底仍有雷'),
  },
  'zhao-yun': {
    bloodlineRumor: '常山獵戶說，趙家舊槍在月下不映人影，只映遠路。趙雲年少夜練時常見槍鋒替自己先走一步，像有位沉默祖先替他把險處都試過一次。',
    storyStripCells: story('常山白馬出塵', '轉身護主歸心', '七進七出如雪', '漢水回槍定軍', '銀甲映出古紋', '老將猶能照夜'),
  },
  'lu-bu': {
    bloodlineRumor: '并州邊騎篝火邊總有人發誓，呂家祖墳上方每逢朔月都停著一頭看不清眼睛的黑狼。呂布若在那晚開弓，箭去之前，風就先替他嚎了一聲。',
    storyStripCells: story('九原少年挽雕', '三易其主如電', '方天畫戟裂陣', '虎牢門前封神', '狼星夜照弓背', '下邳霜重難眠'),
  },
  'sima-yi': {
    bloodlineRumor: '河內鄉人常避著司馬家舊門，說門前那棵老柏逢盛暑也會結一層薄霜。司馬懿少年讀書倦了就去摸樹皮，回屋後字跡總比先前更冷、更穩。',
    storyStripCells: story('河內鷹眼藏拙', '曹帳深處養刃', '靜候人心反轉', '斷穀逼退蜀軍', '宣王舊夢成霜', '高平陵雪未化'),
  },
  'dian-wei': {
    bloodlineRumor: '己吾村口老井旁壓著一塊巨石，誰都說要十人才能挪。典韋少年嫌擋路，扛起來挪到一旁，還回頭問鄰里：你們到底是怕井，還是怕自己沒力？',
    storyStripCells: story('己吾徒手裂楊', '追仇一怒成名', '巨戟守帳如牆', '宛城斷後殉主', '惡來舊影附骨', '血戰聲仍未散'),
  },
  'xu-zhu': {
    bloodlineRumor: '譙地流言說，許家穀倉裡曾闖進過一頭餓虎，卻被一聲悶喝嚇得倒退三步。村裡老人都笑，那天不是虎闖進倉，是虎先被另一頭更大的東西撞見了。',
    storyStripCells: story('譙里壯士護鄉', '投曹帳作重盾', '虎癡立門鎮軍', '裸衣鏖戰成名', '山魄混進筋骨', '醉後仍守主座'),
  },
  'huang-zhong': {
    bloodlineRumor: '老兵夜談時說，黃家舊弓若久懸不動，弦上仍會偶爾輕鳴，像在數戰場上剩下的心跳。黃忠晚年只要摸過弓背，連院裡的麻雀都會忽然安靜。',
    storyStripCells: story('南陽老弓未朽', '長沙帳下藏名', '百步穿楊定膽', '定軍山頭斬夏', '弓魂久伏不散', '白髮仍壓少年'),
  },
  'ma-chao': {
    bloodlineRumor: '西涼牧人流傳，馬家舊廄有一匹從不吃草的白影，只在沙暴來前繞著木樁走圈。馬超年少每逢要出征，那白影總先往東南抬頭嘶一次。',
    storyStripCells: story('涼州白袍出關', '雪槍西風成名', '騎軍破陣如錐', '潼關殺氣貫日', '伏波後裔猶熱', '蹄痕仍向蜀路'),
  },
  'lu-xun': {
    bloodlineRumor: '陸氏書樓有個怪規矩：濕墨未乾時不可對窗。據說一旦讓江風吹過，字會自己換行。陸遜少年試過一次，紙上竟多出一句連他自己都不敢說出口的軍令。',
    storyStripCells: story('江東世族藏鋒', '危局受命而起', '焚營一計翻盤', '夷陵火海成名', '墨痕也會行軍', '木樓仍聞書氣'),
  },
  'taishi-ci': {
    bloodlineRumor: '北海舊獵戶說，太史家院牆常插著三支來路不明的箭，晨起看在東牆，午后又出現在西牆。太史慈從不拔掉，像故意留給自己看一種會移動的準頭。',
    storyStripCells: story('東萊長弓映海', '單騎報信救城', '勁弓先聲奪膽', '神亭鏖戰結義', '箭影自會回家', '故土仍認其名'),
  },
  'zhang-liao': {
    bloodlineRumor: '合肥夜營最怕風停。老卒說，只要一靜得過頭，就像又回到那夜八百騎破陣之前。張遼祖脈彷彿不愛鼓，只愛那一瞬間所有人同時屏息的空白。',
    storyStripCells: story('并州悍卒起身', '歸曹後磨鋒成', '突騎穿心奪勢', '合肥八百封膽', '夜營靜得像刀', '江北童子止啼'),
  },
  'xu-huang': {
    bloodlineRumor: '河東斧匠有句老話：徐家打斧不聽火色，只聽鐵鳴。若一錘下去聲音太直，就得再折一次。徐晃少年旁觀多年，後來領兵也總愛把敵陣先折出一道彎。',
    storyStripCells: story('河東鐵聲磨骨', '轉戰諸軍不慢', '斧鋒重在破穩', '解樊援軍立威', '舊鐵仍記寒鳴', '雪地也走正步'),
  },
  'cao-ren': {
    bloodlineRumor: '曹仁駐守城池時，城門木栓總比別處沉得多。守軍私下說那不是木料問題，是曹家某位祖先把守城時沒說完的狠話，全壓進門閂裡了。',
    storyStripCells: story('宗族悍將守門', '曹營堅壁成名', '死守不退為先', '江陵硬扛周瑜', '門閂壓著祖語', '殘城仍肯站直'),
  },
  'pang-tong': {
    bloodlineRumor: '襄陽酒客打趣，龐家屋脊若停了兩隻烏鴉，當晚就有人會說出不該太早說的妙計。龐統少年偏愛坐在屋下聽，像在偷抄天機又故意漏幾筆。',
    storyStripCells: story('襄陽酒肆聽局', '離鳳換主西行', '奇計多從側出', '落鳳坡前折翼', '屋脊常落黑羽', '遺策仍在轉彎'),
  },
  'guo-jia': {
    bloodlineRumor: '潁川士人說，郭家紙窗最怕病夜，因為每到半夢半醒之間，窗紗上總會先浮出棋盤格。郭嘉咳著笑過：不是天在提示，是我睡太淺，連局都先夢見了。',
    storyStripCells: story('潁川病骨藏鋒', '入曹幕後定機', '毒辣偏算人心', '北征南顧皆準', '病夜窗上浮局', '早逝更添餘響'),
  },
  'xun-yu': {
    bloodlineRumor: '荀家書室香灰最奇，燃盡後總結成一朵小小雲紋。有人說那是祖輩不肯散的清議。荀彧年少每回抖落香灰，案上章奏就忽然像站好了隊。',
    storyStripCells: story('潁川清議成骨', '奉漢室匡亂局', '王佐端坐中樞', '迎帝一議定名', '香灰自結雲紋', '空案仍有正氣'),
  },
  'jia-xu': {
    bloodlineRumor: '涼州商旅說，賈家舊燈從不爆芯，因為芯火總往內縮，像怕被人看見。賈詡自己聽了只笑：燈若太亮，夜裡就活不久；計若太直，亂世也一樣。',
    storyStripCells: story('涼州寒眼觀亂', '數易其主自保', '毒計專挑死角', '一策便換天下', '燈火總往內縮', '老狐仍留後手'),
  },
  'zhang-he': {
    bloodlineRumor: '張家舊甲掛久了也不生鏽，反倒在月下會泛一層像鳥羽的亮。軍中笑說那不是保養得好，是張郃祖脈不肯讓兵器忘記轉身與換翼的本事。',
    storyStripCells: story('河北宿將轉營', '投魏後更見巧', '善變陣如換羽', '木門雪夜追敵', '羽光藏在鐵裡', '老將亦能轉身'),
  },
  'yu-jin': {
    bloodlineRumor: '舊營中總有人說，于家祖上修過河堤，所以於禁看水勢比看人心還準。可也因此最怕大水，因為他比誰都明白，一旦決口，紀律會先被沖散。',
    storyStripCells: story('寒伍守規成性', '入魏以法立身', '軍令比刀還硬', '水厄一役失聲', '堤土壓進骨裡', '沉默比敗更重'),
  },
  'cao-cao-junior': {
    bloodlineRumor: '曹彰年少養過一隻金眼鷂，誰都馴不住，唯獨他伸手時會自己落腕。宮中內侍因此私下喚他黃鬚兒，說這一脈不是生來握筆，是生來抓住亂風。',
    storyStripCells: story('黃鬚少年好獵', '宗室鋒芒外放', '重騎先鋒破陣', '北地獵風成膽', '鷂影常停護腕', '皇城外更像虎'),
  },
  'xiahou-dun': {
    bloodlineRumor: '夏侯家祖墳旁的野鷹特別兇，卻從不掠過那口舊井。有人說那井裡照過一隻不肯閉上的眼。夏侯惇失目後再臨井邊，竟笑自己終於跟祖上對上了視線。',
    storyStripCells: story('宿將少年性烈', '宗盟起兵同進', '失目更添狠勁', '拔矢吞睛鎮眾', '井底仍照單眼', '餘威還壓前軍'),
  },
  'xiahou-yuan': {
    bloodlineRumor: '夏侯家馬廄最怪的不是快，而是靜。快馬出欄前總一聲不吭，像怕把時間驚跑。夏侯淵領輕騎時也一樣，等旁人察覺，風已經替他衝過半個坡面。',
    storyStripCells: story('箭疾勝過傳令', '宗軍驟馬馳援', '快戰不給喘息', '西線奔襲成名', '馬廄靜得可怕', '風聲總比旗早'),
  },
  'wei-yan': {
    bloodlineRumor: '漢中獵人傳聞，魏家舊鏡只能照出半張臉，另一半總落在陰影裡。魏延年少嫌晦氣把鏡砸了，碎片卻把同一張倔臉映成更多塊，看起來反而更像命。',
    storyStripCells: story('漢中野骨難馴', '從劉後屢建功', '奇兵專取險路', '子午一議成疤', '鏡裡總缺半面', '背影仍朝北望'),
  },
  'jiang-wei': {
    bloodlineRumor: '天水城外的雪若落在姜家舊槍上，第二天總比別處晚化。老人說那是槍記得北地寒氣，不肯讓持槍的人太快忘了自己曾站在哪一邊。',
    storyStripCells: story('天水寒槍初立', '折入蜀營續志', '文武兩端都硬', '北伐孤身再舉', '雪意纏在槍鋒', '遺志仍追孔明'),
  },
  'deng-ai': {
    bloodlineRumor: '鄉里都笑鄧家人說話慢，可山路上的腳印總比別人深。鄧艾幼時最愛拿樹枝在泥地畫坡線，說嘴慢沒關係，只要腿和腦先把路走完，話可以最後再到。',
    storyStripCells: story('寒門步算成路', '魏廷終識其能', '地勢就是兵書', '陰平偷渡封局', '泥地先畫蜀道', '山雨仍記腳痕'),
  },
  'zhong-hui': {
    bloodlineRumor: '鍾家筆架有個怪毛病，夜裡若無人寫字，最細那支筆會自己輕敲木座三下。僕役說那像催命，鍾會卻說不是催命，是催他別把鋒芒只藏在墨裡。',
    storyStripCells: story('神童落筆帶鋒', '魏廷愛其機敏', '筆陣能改兵陣', '伐蜀功高生變', '筆架夜敲三下', '才名終被心吞'),
  },
  'huang-gai': {
    bloodlineRumor: '黃家舊鼓皮上有一道燒不穿的黑痕，怎麼換火都在那裡。軍中都說那是祖上替後人留的記號：真要成事，先學會把疼收進鼓聲，再讓敵人聽見。',
    storyStripCells: story('老將忍氣藏鋒', '江東帳下沉穩', '苦肉只是表層', '赤壁假降成火', '鼓皮留著焦痕', '笑時仍像舊刀'),
  },
  'cheng-pu': {
    bloodlineRumor: '程家舊盔放在倉裡多年，雨夜仍會慢慢往外滲鹽味。江東老卒認得那是跟海風混久的味道，說程普祖脈不靠玄異，只靠一種活得夠久就自然變重的忠直。',
    storyStripCells: story('江東宿將壓艙', '佐孫氏渡風浪', '老成最穩軍心', '數戰之後更重', '盔裡還有海味', '老樹仍能擋風'),
  },
  'han-dang': {
    bloodlineRumor: '韓家舊箭簍常在江風裡輕碰作響，像有人在數剩下幾支命。韓當射箭不愛抬聲勢，因為他總覺得真正準的箭，離弦前就該安靜得像沒存在過。',
    storyStripCells: story('遼東勁卒南下', '追隨孫氏起事', '沉弓冷箭制場', '江面雨夜伏敵', '箭簍自數舊命', '靜的人最先中'),
  },
  'gan-ning': {
    bloodlineRumor: '巴郡漁火邊常有人說，甘家刀柄一沾夜露就會有鈴聲，像有人在黑水裡替他招手。甘寧嫌那聲太吵，後來乾脆把鈴掛自己身上，讓敵人先聽見恐懼。',
    storyStripCells: story('錦帆賊笑入江', '歸吳後改浪名', '快襲像夜魚翻', '百騎劫營成戲', '刀柄夜露有鈴', '江面還記狂笑'),
  },
  'ling-tong': {
    bloodlineRumor: '凌家祠堂的木柱上有一道被刀尖挑過的舊痕，逢祭日會比別處先發亮。長輩都不提那是誰留下的，只叫凌統記住：有些仇不必忘，但不能讓它先學會牽馬。',
    storyStripCells: story('少年披甲背恨', '承父名入軍行', '衝鋒也懂分寸', '逍遙津後更穩', '木柱留著舊痕', '終學放過自己'),
  },
  'zhou-tai': {
    bloodlineRumor: '周泰身上的疤若遇寒氣，會比常人先發白。營中醫者看過後只嘆：這人不是活著長疤，是疤替他記住每次本該死掉的地方，於是連祖脈都學會不退。',
    storyStripCells: story('寒卒以命換路', '江東危局撐身', '肉身就是城牆', '護主遍體成甲', '舊傷先替他醒', '疤痕比勳還重'),
  },
  'xu-sheng': {
    bloodlineRumor: '徐家漁村有句怪話：若要騙過大浪，先要騙過自己的腳步。徐盛幼時在濕沙上練走路，總要做到浪頭打來也看不清他是前進還是後退。',
    storyStripCells: story('琅邪客居江東', '入吳後穩紮營', '虛實最擅互換', '假城一役立威', '濕沙不留真步', '敵至時才知晚'),
  },
  'ding-feng': {
    bloodlineRumor: '丁家舊袍在雪天會特別沉，像裡面藏了看不見的水。丁奉年少總說那不是濕，是祖上替他把火藏在布裡，等最冷的那一夜再一起抖出來。',
    storyStripCells: story('寒門老卒藏火', '江東晚局撐梁', '寡兵也能翻桌', '雪中短兵封名', '舊袍總比雪重', '老來更會出手'),
  },
  'zhang-zhao': {
    bloodlineRumor: '張家舊竹簡最怕潮，可偏偏每到梅季就浮出一層淡淡墨香。東吳年輕人說那像書自己在喘氣；張昭聽了只冷哼，說那是舊道理忍太久，終於想出聲。',
    storyStripCells: story('江東名士立骨', '入吳後守典章', '諍臣專擋躁火', '殿上直言逆耳', '竹簡在雨季喘', '老臣不替人甜'),
  },
  'lu-meng': {
    bloodlineRumor: '軍中一直有種說法：呂蒙夜裡翻書時，燈火不往上跳，只往紙縫裡鑽，像怕漏掉哪個字。後來人人都知道，他不是忽然變聰明，是從某天開始不肯再只靠一把刀活。',
    storyStripCells: story('匹夫提刀入伍', '受孫權逼讀書', '文武兩端都補', '白衣渡江封局', '燈火愛鑽字縫', '病去仍留殺意'),
  },
  'sun-ce': {
    bloodlineRumor: '江東小兒夜啼，長輩常嚇一句：再哭，孫策騎風來。奇的是，這話對孩子真有用。像那一脈天生就帶著一股先聲奪人的勁，連傳說都跑得比馬快。',
    storyStripCells: story('少年挾勇逐鹿', '借父名起江東', '破城像擲短槍', '小霸王一戰定', '風總先替他到', '英氣停在江面'),
  },
  'sun-jian': {
    bloodlineRumor: '孫家祖地有塊斷石，雨後會浮出像虎爪的紋。鄉人說那是孫堅少時斬蛇後留下的影子，沒被帶走，便一直趴在地上替孫家鎮著某種不服輸的血性。',
    storyStripCells: story('吳地猛虎起身', '討賊先鋒成名', '身先士卒壓陣', '汜水之前取勢', '斷石伏著虎影', '江東家火由此'),
  },
  'dong-zhuo': {
    bloodlineRumor: '西涼客棧裡最不吉利的，是半夜聽見鍋鼎自己鳴。老販子都說那像董家祖灶在討債，因為這一脈煮熟過太多人心，最後連火都被養出一副暴脾氣。',
    storyStripCells: story('隴西肥火起灶', '乘亂入京挾帝', '暴威先壓朝廷', '焚洛一舉留毒', '鍋鼎夜裡自鳴', '長安灰仍帶腥'),
  },
  'yuan-shao': {
    bloodlineRumor: '袁氏祖宅最講究鏡台，據說每逢大宴，鏡面都會比平日更亮。可老僕私下說那不是貴氣，是太多人同時想看自己站在最中央，亮到最後反而誰都看不清誰。',
    storyStripCells: story('四世三公堆勢', '河北群望歸袁', '號令大於決斷', '官渡一敗成裂', '鏡台照不全人', '家聲先被風散'),
  },
  'liu-biao': {
    bloodlineRumor: '荊州舊地圖若攤在案上太久，紙邊會微微翹起，像江水自己想改道。劉表喜歡用玉鎮紙壓回去，彷彿只要壓得住角，便也能壓住四方觀望的人心。',
    storyStripCells: story('名士終坐荊州', '據長江而觀局', '善守卻少決斷', '江表安靜成病', '鎮紙總壓不平', '門下仍各自盤'),
  },
  'ma-teng': {
    bloodlineRumor: '涼州馬市常說，馬家帳篷裡最先醒的不是人，是鷹。馬騰年少每回遠行，老鷹總先繞營三圈才肯飛開，像在替這一脈看清風向，再准他們跨上馬背。',
    storyStripCells: story('西涼老鷹繞帳', '邊地豪氣結軍', '騎射把風撕開', '關中諸雄共局', '伏波餘熱仍燙', '父影壓在孟起'),
  },
  'gongsun-zan': {
    bloodlineRumor: '幽州草原上流傳，公孫家白馬夜奔時不踏草，只踏霜。公孫瓚少年不信，親自騎去看，回來後靴底真的乾淨得像從沒走過泥地，於是他更相信速度勝過停留。',
    storyStripCells: story('白馬將軍出塞', '北地豪氣成軍', '輕騎喜走直線', '界橋一役留痕', '霜地不沾馬蹄', '燕北仍念白影'),
  },
  'tao-qian': {
    bloodlineRumor: '徐州老倉裡有口舊木斗，夏天摸上去卻總是溫的。老人說那是陶家祖上留下的習慣：先顧糧，再談威。可亂世裡，糧能暖手，未必暖得住別人的刀。',
    storyStripCells: story('丹楊故吏成主', '徐州倉廩為先', '善撫民不善爭', '讓州一念留名', '木斗常帶餘溫', '仁厚也有代價'),
  },
};

function main() {
  const base = loadWrapper(BASE_PATH);
  const lore = loadWrapper(LORE_PATH);
  const stories = loadWrapper(STORIES_PATH);

  const baseMap = toMap(base.data);
  const loreMap = toMap(lore.data);
  const storiesMap = toMap(stories.data);

  let basePatched = 0;
  for (const [id, patch] of Object.entries(TOP10_BASELINE)) {
    const record = baseMap.get(id);
    if (!record) throw new Error(`找不到 top10 武將: ${id}`);
    Object.assign(record, patch);
    record.ep = computeEp(record);
    record.epRating = computeEpRating(record.ep);
    basePatched++;
  }

  let lorePatched = 0;
  for (const [id, patch] of Object.entries(TOP50_STORY)) {
    const loreRecord = loreMap.get(id);
    if (!loreRecord) throw new Error(`找不到 lore 武將: ${id}`);
    loreRecord.bloodlineRumor = patch.bloodlineRumor;
    loreRecord.storyStripCells = patch.storyStripCells;

    let storyRecord = storiesMap.get(id);
    if (!storyRecord) {
      storyRecord = { id, storyStripCells: [] };
      stories.data.push(storyRecord);
      storiesMap.set(id, storyRecord);
    }
    storyRecord.storyStripCells = patch.storyStripCells;
    lorePatched++;
  }

  writeWrapper(BASE_PATH, base);
  writeWrapper(LORE_PATH, lore);
  writeWrapper(STORIES_PATH, stories);

  childProcess.execFileSync(process.execPath, [BUILD_RUNTIME], { cwd: ROOT, stdio: 'inherit' });

  console.log(`[curate-core-generals] base patched: ${basePatched}`);
  console.log(`[curate-core-generals] lore/stories patched: ${lorePatched}`);
}

main();