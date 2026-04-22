/* 3KLife Character Detail — Shared Components */

// =========== DATA ===========
const ZHANG_FEI = {
  name: "張飛", nameEn: "Zhang Fei", courtesy: "翼德",
  faction: "蜀", factionTag: "燕人", title: "燕人武聖",
  rarity: "UR", stars: 4, maxStars: 5,
  level: 42, maxLevel: 60, exp: 18400, expMax: 24000,
  role: "先鋒", roleEn: "Vanguard",
  personality: ["戰意特聚", "平原適性"],
  personalityEn: ["Battle Focus", "Plains Affinity"],
  battlePos: ["前排突破", "破陣主攻"],
  battlePosEn: ["Front Breaker", "Formation Breaker"],
  // Talent (0-100)
  talent: { str: 98, lea: 88, cha: 74, int: 52, pol: 38, luk: 76 },
  // Prowess (0-2000+)
  prowess: { str: 1820, lea: 1540, cha: 1280, int: 890, pol: 640, luk: 1120 },
  prowessRank: "S",
  hp: 16800, maxHp: 16800, sp: 120, maxSp: 120,
  age: 34, vitality: 85, vitalityMax: 100,
  status: "Active",
  bloodline: {
    name: "燕血脈", awakening: 0.58, awakeningTrend: "覺醒傾向",
    personality: "燕地酒坊流傳",
    crestName: "祖紋", crestDetail: "已建立 14 人血統圖",
    impression: "燕地酒坊流傳",
    ep: 82, epRating: "良才美質",
    parents: { father: "張角", mother: "燕姬" },
  },
  skills: [
    { id: 1, name: "丈八蛇矛", nameEn: "Serpent Spear", type: "主動", typeEn: "Active", target: "單體",
      desc: "對單體造成 280% 物理傷害，附帶震懾效果 2 回合", level: 7, maxLevel: 10, tp: 45, icon: "矛" },
    { id: 2, name: "燕人咆哮", nameEn: "Yan Roar", type: "被動", typeEn: "Passive", target: "",
      desc: "全體步兵攻擊 +15%，受到智力傷害 −10%", level: 5, maxLevel: 10, tp: 0, icon: "吼" },
    { id: 3, name: "長坂橋嘯", nameEn: "Changban Bridge Roar", type: "奧義", typeEn: "Ultimate", target: "範圍",
      desc: "對前方全體造成 520% 真實傷害，50% 機率使敵方逃跑 2 回合", level: 4, maxLevel: 8, tp: 80, icon: "嘯", isUlt: true },
    { id: 4, name: "醉酒鞭撻", nameEn: "Drunken Lash", type: "主動", typeEn: "Active", target: "單體",
      desc: "攻擊單體造成 180% 傷害，自身受傷 +20% 但暴擊率 +40%", level: 3, maxLevel: 10, tp: 35, icon: "鞭" },
  ],
  unlearned: [
    { name: "烈焰衝鋒", requirement: "需紅色因子 Lv.3", icon: "焰" },
    { name: "義結金蘭", requirement: "需關羽同隊", icon: "義" },
  ],
  equipment: [
    { slot: "武器", name: "丈八蛇矛", rarity: "ur", enhance: 9, icon: "矛" },
    { slot: "頭盔", name: "虎頭鑌鐵盔", rarity: "ssr", enhance: 6, icon: "盔" },
    { slot: "鎧甲", name: "精鋼重甲", rarity: "sr", enhance: 4, icon: "甲" },
    { slot: "戰靴", name: "鐵蹄雲靴", rarity: "ssr", enhance: 5, icon: "靴" },
    { slot: "飾品", name: null, rarity: null, enhance: 0, icon: "鐲" },
    { slot: "玉飾", name: null, rarity: null, enhance: 0, icon: "玉" },
  ],
  aptitude: {
    troop:   [{ name: "步兵", en: "Infantry", grade: "S" }, { name: "騎兵", en: "Cavalry", grade: "A" }, { name: "弓兵", en: "Archer", grade: "C" }, { name: "機械", en: "Siege", grade: "D" }],
    terrain: [{ name: "平原", en: "Plains", grade: "S" }, { name: "山地", en: "Mountain", grade: "A" }, { name: "水域", en: "Water", grade: "D" }, { name: "林地", en: "Forest", grade: "B" }, { name: "沙漠", en: "Desert", grade: "C" }],
    weather: [{ name: "晴", en: "Clear", grade: "A" }, { name: "雨", en: "Rain", grade: "B" }, { name: "霧", en: "Fog", grade: "C" }, { name: "風", en: "Wind", grade: "A" }, { name: "夜", en: "Night", grade: "S" }, { name: "雷", en: "Thunder", grade: "B" }],
  },
  bio: "張飛，字翼德，幽州涿郡人。少年以屠豬賣酒為業，後於桃園與劉備、關羽義結金蘭，誓同生死。性烈如火，勇猛無雙——長坂橋前單槍匹馬，一聲怒吼令曹軍百萬退散；義釋嚴顏一事，足見其粗中有細，智勇兼備。然酒後失德，醉鞭督卒，終命喪部將之手，令千古扼腕。其一生豪烈，血脈中燕地武人的剛猛之氣，至今仍在後裔身上延燃。",
  storyStrip: [
    { num: "01", title: "涿 郡 屠 戶", en: "Butcher of Zhuo", color: "#5a4a38" },
    { num: "02", title: "桃 園 結 義", en: "Oath of the Peach Garden", color: "#6b2020" },
    { num: "03", title: "長 坂 怒 吼", en: "Roar at Changban", color: "#4a1414" },
    { num: "04", title: "義 釋 嚴 顏", en: "Mercy to Yan Yan", color: "#3a4a2a" },
    { num: "05", title: "醉 後 鞭 督", en: "Drunken Discipline", color: "#4a3020" },
    { num: "06", title: "燕 血 傳 承", en: "Legacy of Yan Blood", color: "#2a3a3a" },
  ],
};

// =========== STYLES ===========
const cStyles = {
  // Rarity colors
  rarityColors: { N: "#E0E0E0", R: "#4CAF50", SR: "#2196F3", SSR: "#9C27B0", UR: "#FFC107", LR: "#D32F2F" },
  gradeColors: { S: "#FFD700", A: "#86E1A5", B: "#6fa8ff", C: "#B0A880", D: "#FF6B6B" },
};

// =========== TAB RAIL ===========
function TabRail({ activeTab, onTabChange }) {
  const tabs = [
    { id: "overview", label: "將", en: "GEN" },
    { id: "stats",    label: "屬", en: "STAT" },
    { id: "tactics",  label: "技", en: "TACT" },
    { id: "bloodline",label: "命", en: "FATE" },
    { id: "equip",    label: "寶", en: "GEAR" },
    { id: "aptitude", label: "適", en: "APT" },
  ];
  return React.createElement("div", { style: tabRailStyles.rail }, tabs.map(t =>
    React.createElement("button", {
      key: t.id,
      onClick: () => onTabChange(t.id),
      style: {
        ...tabRailStyles.btn,
        ...(activeTab === t.id ? tabRailStyles.btnActive : {}),
      }
    },
      React.createElement("span", { style: tabRailStyles.label }, t.label),
      React.createElement("span", { style: tabRailStyles.en }, t.en),
    )
  ));
}

const tabRailStyles = {
  rail: {
    position: "absolute", right: 0, top: 280, bottom: 0, width: 310,
    display: "flex", flexDirection: "column", justifyContent: "center", gap: 24,
    padding: "0 10px", zIndex: 20,
  },
  btn: {
    width: 290, height: 290, borderRadius: "50%", border: "6px solid #4D4635",
    background: "linear-gradient(180deg, #20201F, #111)", cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 0, transition: "all 150ms",
  },
  btnActive: {
    border: "6px solid #D4AF37",
    background: "linear-gradient(180deg, rgba(212,175,55,.2), rgba(138,110,31,.1))",
    boxShadow: "0 0 24px rgba(212,175,55,.4), inset 0 0 16px rgba(212,175,55,.2)",
  },
  label: {
    fontFamily: "var(--font-headline)", fontSize: 60, fontWeight: 700,
    color: "#FFE088", lineHeight: 1,
  },
  en: {
    fontFamily: "var(--font-label)", fontSize: 24, fontWeight: 600,
    color: "#B0A880", letterSpacing: ".15em", textTransform: "uppercase", lineHeight: 1,
    marginTop: 8,
  },
};

// =========== PANEL WRAPPER ===========
function Panel({ title, titleEn, children, style, headerStyle }) {
  return React.createElement("div", { style: { ...panelStyles.wrap, ...style } },
    title && React.createElement("div", { style: { ...panelStyles.head, ...headerStyle } },
      React.createElement("span", { style: panelStyles.ttl }, title),
      titleEn && React.createElement("span", { style: panelStyles.en }, titleEn),
    ),
    React.createElement("div", { style: panelStyles.body }, children)
  );
}
const panelStyles = {
  wrap: {
    background: "linear-gradient(180deg, rgba(32,32,31,.92), rgba(21,21,19,.95))",
    border: "1.5px solid #4D4635", borderRadius: 10,
    boxShadow: "0 6px 20px rgba(0,0,0,.5)", overflow: "hidden",
  },
  head: {
    padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "linear-gradient(180deg, #3F6A62, #2A4B44)",
    borderBottom: "2px solid #D4AF37",
  },
  ttl: {
    fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 700,
    color: "#F5F1E8", letterSpacing: ".2em",
  },
  en: {
    fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: ".25em",
    color: "#A4D2D0", textTransform: "uppercase",
  },
  body: { padding: "12px 16px" },
};

// =========== SECTION LABEL ===========
function SectionLabel({ children, en }) {
  return React.createElement("div", { style: sLabelStyles.wrap },
    React.createElement("div", { style: sLabelStyles.bar }),
    React.createElement("span", { style: sLabelStyles.text }, children),
    en && React.createElement("span", { style: sLabelStyles.en }, en),
  );
}
const sLabelStyles = {
  wrap: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  bar: { width: 3, height: 14, background: "#3F6A62", borderRadius: 1 },
  text: { fontFamily: "var(--font-headline)", fontSize: 15, fontWeight: 700, color: "#FFE088", letterSpacing: ".2em" },
  en: { fontFamily: "var(--font-label)", fontSize: 9, color: "#B0A880", letterSpacing: ".2em", textTransform: "uppercase" },
};

// =========== GRADE BADGE ===========
function GradeBadge({ grade, size }) {
  const s = size || 32;
  const color = cStyles.gradeColors[grade] || "#B0A880";
  const isStar = grade === "S";
  return React.createElement("div", {
    style: {
      width: s, height: s, borderRadius: s/2, display: "grid", placeItems: "center",
      background: isStar ? `radial-gradient(circle at 35% 30%, ${color}, #8A6E1F)` : `radial-gradient(circle at 35% 30%, ${color}55, ${color}22)`,
      border: `1.5px solid ${color}`, fontFamily: "var(--font-headline)", fontSize: s * 0.5,
      fontWeight: 800, color: isStar ? "#2D1E00" : color,
      boxShadow: isStar ? `0 0 8px ${color}44` : "none",
    }
  }, grade);
}

// =========== STAT BAR ===========
function StatBar({ label, value, maxValue, color, showVal }) {
  const pct = Math.min(100, (value / maxValue) * 100);
  return React.createElement("div", { style: statBarStyles.wrap },
    React.createElement("span", { style: statBarStyles.label }, label),
    React.createElement("div", { style: statBarStyles.track },
      React.createElement("div", { style: { ...statBarStyles.fill, width: pct + "%", background: color || "linear-gradient(90deg, #D4AF37, #FFE088)" } })
    ),
    showVal !== false && React.createElement("span", { style: statBarStyles.val }, value),
  );
}
const statBarStyles = {
  wrap: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  label: { fontFamily: "var(--font-headline)", fontSize: 13, fontWeight: 600, color: "#B0A880", letterSpacing: ".15em", width: 36, textAlign: "right" },
  track: { flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,.06)", border: "1px solid #4D4635", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, transition: "width 400ms" },
  val: { fontFamily: "var(--font-num)", fontSize: 14, fontWeight: 700, color: "#FFE088", width: 50, textAlign: "right" },
};

window.ZHANG_FEI = ZHANG_FEI;
window.cStyles = cStyles;
window.TabRail = TabRail;
window.Panel = Panel;
window.SectionLabel = SectionLabel;
window.GradeBadge = GradeBadge;
window.StatBar = StatBar;
