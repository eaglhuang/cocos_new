/**
 * add-generals-batch.js
 * DC-6-0001 — 將三國史籍人物批次新增至 generals-base.json，從 149 擴至 210+。
 * 用法：node tools_node/add-generals-batch.js
 */

"use strict";

const path = require("path");
const fs = require("fs");

const BASE_PATH = path.join(
  __dirname,
  "../assets/resources/data/master/generals-base.json"
);

/** 51+ 筆新武將（依史料還原，分 wei/shu/wu/enemy/neutral） */
const NEW_GENERALS = [
  // ── Shu 蜀漢 ─────────────────────────────────────────────────────────────
  { id: "peng-yong", name: "彭羕", faction: "shu", str: 45, int: 78, lea: 52, pol: 60, cha: 55, luk: 40, ep: 55, gender: "男", role: "Support" },
  { id: "liao-li", name: "廖立", faction: "shu", str: 42, int: 80, lea: 50, pol: 65, cha: 48, luk: 38, ep: 54, gender: "男", role: "Support" },
  { id: "li-yan", name: "李嚴", faction: "shu", str: 65, int: 72, lea: 68, pol: 70, cha: 60, luk: 50, ep: 64, gender: "男", role: "Hybrid" },
  { id: "ma-zhong", name: "馬忠", faction: "shu", str: 74, int: 68, lea: 72, pol: 55, cha: 58, luk: 62, ep: 65, gender: "男", role: "Combat" },
  { id: "wang-ping", name: "王平", faction: "shu", str: 72, int: 65, lea: 75, pol: 48, cha: 54, luk: 60, ep: 64, gender: "男", role: "Combat" },
  { id: "du-qiong", name: "杜瓊", faction: "shu", str: 30, int: 82, lea: 35, pol: 75, cha: 70, luk: 55, ep: 58, gender: "男", role: "Support" },
  { id: "fei-guan", name: "費觀", faction: "shu", str: 48, int: 70, lea: 55, pol: 72, cha: 65, luk: 52, ep: 60, gender: "男", role: "Support" },
  { id: "luo-xian", name: "羅憲", faction: "shu", str: 78, int: 65, lea: 76, pol: 58, cha: 60, luk: 55, ep: 65, gender: "男", role: "Combat" },
  { id: "chen-shou-shu", name: "陳壽（蜀）", faction: "shu", str: 25, int: 88, lea: 30, pol: 70, cha: 72, luk: 65, ep: 58, gender: "男", role: "Support" },
  { id: "gong-yan", name: "句扶", faction: "shu", str: 76, int: 60, lea: 74, pol: 50, cha: 55, luk: 58, ep: 62, gender: "男", role: "Combat" },
  { id: "liu-chen", name: "劉諶", faction: "shu", str: 68, int: 60, lea: 62, pol: 55, cha: 70, luk: 40, ep: 59, gender: "男", role: "Hybrid" },
  { id: "zhu-bao", name: "朱褒", faction: "shu", str: 55, int: 45, lea: 52, pol: 48, cha: 40, luk: 35, ep: 46, gender: "男", role: "Combat" },
  { id: "li-hui", name: "李恢", faction: "shu", str: 60, int: 72, lea: 68, pol: 65, cha: 58, luk: 55, ep: 63, gender: "男", role: "Hybrid" },
  { id: "meng-da", name: "孟達", faction: "shu", str: 62, int: 70, lea: 60, pol: 58, cha: 52, luk: 42, ep: 57, gender: "男", role: "Hybrid" },
  { id: "chen-zhi", name: "陳祗", faction: "shu", str: 35, int: 78, lea: 40, pol: 80, cha: 68, luk: 55, ep: 59, gender: "男", role: "Support" },
  { id: "zhang-yi-shu", name: "張翼（蜀）", faction: "shu", str: 72, int: 60, lea: 70, pol: 48, cha: 52, luk: 55, ep: 60, gender: "男", role: "Combat" },
  { id: "fu-tong", name: "傅彤", faction: "shu", str: 74, int: 50, lea: 65, pol: 42, cha: 60, luk: 48, ep: 57, gender: "男", role: "Combat" },
  { id: "zhang-bao-shu", name: "張苞", faction: "shu", str: 80, int: 52, lea: 70, pol: 40, cha: 65, luk: 55, ep: 61, gender: "男", role: "Combat" },
  { id: "guan-xing", name: "關興", faction: "shu", str: 78, int: 58, lea: 72, pol: 45, cha: 70, luk: 58, ep: 63, gender: "男", role: "Combat" },
  { id: "guan-suo", name: "關索", faction: "shu", str: 76, int: 50, lea: 68, pol: 40, cha: 62, luk: 52, ep: 58, gender: "男", role: "Combat" },

  // ── Wu 東吳 ──────────────────────────────────────────────────────────────
  { id: "bu-zhi", name: "步騭", faction: "wu", str: 55, int: 74, lea: 65, pol: 78, cha: 68, luk: 58, ep: 66, gender: "男", role: "Hybrid" },
  { id: "zhu-huan", name: "朱桓", faction: "wu", str: 76, int: 62, lea: 74, pol: 55, cha: 58, luk: 60, ep: 65, gender: "男", role: "Combat" },
  { id: "zhu-ran", name: "朱然", faction: "wu", str: 74, int: 68, lea: 76, pol: 58, cha: 62, luk: 62, ep: 67, gender: "男", role: "Combat" },
  { id: "ding-feng", name: "丁奉", faction: "wu", str: 78, int: 58, lea: 72, pol: 50, cha: 55, luk: 65, ep: 63, gender: "男", role: "Combat" },
  { id: "yu-fan", name: "虞翻", faction: "wu", str: 40, int: 85, lea: 45, pol: 75, cha: 62, luk: 50, ep: 60, gender: "男", role: "Support" },
  { id: "zhang-zhao", name: "張昭", faction: "wu", str: 35, int: 88, lea: 42, pol: 88, cha: 80, luk: 60, ep: 70, gender: "男", role: "Support" },
  { id: "gu-yong", name: "顧雍", faction: "wu", str: 32, int: 86, lea: 40, pol: 90, cha: 78, luk: 62, ep: 70, gender: "男", role: "Support" },
  { id: "chen-wu", name: "陳武", faction: "wu", str: 80, int: 55, lea: 70, pol: 45, cha: 60, luk: 55, ep: 61, gender: "男", role: "Combat" },
  { id: "pan-zhang", name: "潘璋", faction: "wu", str: 75, int: 52, lea: 68, pol: 42, cha: 48, luk: 50, ep: 56, gender: "男", role: "Combat" },
  { id: "ling-tong", name: "凌統", faction: "wu", str: 82, int: 58, lea: 72, pol: 48, cha: 65, luk: 60, ep: 64, gender: "男", role: "Combat" },
  { id: "sun-yi", name: "孫翊", faction: "wu", str: 72, int: 55, lea: 65, pol: 50, cha: 62, luk: 48, ep: 59, gender: "男", role: "Combat" },
  { id: "sun-huan", name: "孫桓", faction: "wu", str: 70, int: 60, lea: 68, pol: 55, cha: 65, luk: 52, ep: 62, gender: "男", role: "Combat" },
  { id: "zhu-ji", name: "朱績", faction: "wu", str: 68, int: 65, lea: 70, pol: 55, cha: 58, luk: 55, ep: 62, gender: "男", role: "Combat" },
  { id: "quan-cong", name: "全琮", faction: "wu", str: 72, int: 65, lea: 72, pol: 60, cha: 60, luk: 55, ep: 64, gender: "男", role: "Hybrid" },
  { id: "lv-dai", name: "呂岱", faction: "wu", str: 68, int: 70, lea: 72, pol: 65, cha: 58, luk: 58, ep: 65, gender: "男", role: "Hybrid" },
  { id: "sun-shao", name: "孫韶", faction: "wu", str: 70, int: 62, lea: 72, pol: 55, cha: 60, luk: 55, ep: 62, gender: "男", role: "Combat" },

  // ── Wei 魏 ───────────────────────────────────────────────────────────────
  { id: "wang-lang", name: "王朗", faction: "wei", str: 32, int: 80, lea: 38, pol: 85, cha: 72, luk: 58, ep: 62, gender: "男", role: "Support" },
  { id: "hua-xin", name: "華歆", faction: "wei", str: 35, int: 82, lea: 40, pol: 86, cha: 74, luk: 55, ep: 63, gender: "男", role: "Support" },
  { id: "zhong-hui", name: "鍾會", faction: "wei", str: 60, int: 88, lea: 72, pol: 75, cha: 68, luk: 45, ep: 68, gender: "男", role: "Hybrid" },
  { id: "deng-ai", name: "鄧艾", faction: "wei", str: 75, int: 84, lea: 80, pol: 65, cha: 58, luk: 62, ep: 71, gender: "男", role: "Combat" },
  { id: "guo-huai", name: "郭淮", faction: "wei", str: 72, int: 78, lea: 76, pol: 62, cha: 58, luk: 60, ep: 68, gender: "男", role: "Hybrid" },
  { id: "chen-tai", name: "陳泰", faction: "wei", str: 68, int: 76, lea: 74, pol: 65, cha: 62, luk: 58, ep: 67, gender: "男", role: "Hybrid" },
  { id: "hu-zun", name: "胡遵", faction: "wei", str: 70, int: 62, lea: 72, pol: 55, cha: 52, luk: 55, ep: 61, gender: "男", role: "Combat" },
  { id: "wang-ji", name: "王基", faction: "wei", str: 68, int: 74, lea: 75, pol: 65, cha: 60, luk: 58, ep: 67, gender: "男", role: "Hybrid" },
  { id: "sun-li", name: "孫禮", faction: "wei", str: 72, int: 65, lea: 70, pol: 60, cha: 58, luk: 55, ep: 63, gender: "男", role: "Combat" },
  { id: "wang-hun", name: "王渾", faction: "wei", str: 68, int: 60, lea: 68, pol: 58, cha: 55, luk: 52, ep: 60, gender: "男", role: "Combat" },
  { id: "wen-qin", name: "文欽", faction: "wei", str: 76, int: 55, lea: 68, pol: 45, cha: 50, luk: 45, ep: 57, gender: "男", role: "Combat" },

  // ── Enemy / 其他 ─────────────────────────────────────────────────────────
  { id: "gongsun-yuan", name: "公孫淵", faction: "enemy", str: 65, int: 60, lea: 68, pol: 55, cha: 50, luk: 38, ep: 56, gender: "男", role: "Hybrid" },
  { id: "ke-bi-neng", name: "軻比能", faction: "enemy", str: 78, int: 58, lea: 72, pol: 48, cha: 55, luk: 52, ep: 61, gender: "男", role: "Combat" },
  { id: "meng-huo", name: "孟獲", faction: "enemy", str: 80, int: 45, lea: 65, pol: 52, cha: 68, luk: 55, ep: 61, gender: "男", role: "Combat" },
  { id: "zhu-rong", name: "祝融", faction: "enemy", str: 75, int: 50, lea: 62, pol: 45, cha: 72, luk: 58, ep: 60, gender: "女", role: "Combat" },
  { id: "wu-tugu", name: "兀突骨", faction: "enemy", str: 88, int: 30, lea: 60, pol: 30, cha: 45, luk: 42, ep: 55, gender: "男", role: "Combat" },
  { id: "mu-lu-da-wang", name: "木鹿大王", faction: "enemy", str: 72, int: 40, lea: 62, pol: 35, cha: 50, luk: 48, ep: 52, gender: "男", role: "Combat" },
  { id: "e-huan", name: "鄂煥", faction: "enemy", str: 74, int: 35, lea: 58, pol: 30, cha: 42, luk: 45, ep: 50, gender: "男", role: "Combat" },
  { id: "sha-mo-ke", name: "沙摩柯", faction: "enemy", str: 82, int: 30, lea: 55, pol: 28, cha: 48, luk: 50, ep: 52, gender: "男", role: "Combat" },

  // ── Neutral 無主 ─────────────────────────────────────────────────────────
  { id: "mi-heng", name: "禰衡", faction: "neutral", str: 30, int: 90, lea: 28, pol: 55, cha: 78, luk: 25, ep: 51, gender: "男", role: "Support" },
  { id: "kong-rong", name: "孔融", faction: "neutral", str: 38, int: 85, lea: 42, pol: 80, cha: 82, luk: 45, ep: 62, gender: "男", role: "Support" },
  { id: "tian-chou", name: "田疇", faction: "neutral", str: 55, int: 75, lea: 60, pol: 68, cha: 65, luk: 52, ep: 62, gender: "男", role: "Hybrid" },
  { id: "guan-ning", name: "管寧", faction: "neutral", str: 25, int: 88, lea: 30, pol: 72, cha: 86, luk: 65, ep: 61, gender: "男", role: "Support" },
  { id: "hua-tuo", name: "華佗", faction: "neutral", str: 20, int: 95, lea: 22, pol: 68, cha: 80, luk: 70, ep: 61, gender: "男", role: "Support" },
  { id: "zuo-ci", name: "左慈", faction: "neutral", str: 22, int: 92, lea: 25, pol: 55, cha: 75, luk: 80, ep: 58, gender: "男", role: "Support" },
  { id: "yu-ji", name: "于吉", faction: "neutral", str: 18, int: 90, lea: 20, pol: 50, cha: 80, luk: 82, ep: 57, gender: "男", role: "Support" },
];

// ---- 主程式 ----

const raw = fs.readFileSync(BASE_PATH, "utf-8");
const parsed = JSON.parse(raw);
const isWrapped = !Array.isArray(parsed);
const existing = isWrapped ? parsed.data : parsed;

// 過濾掉已存在的 id
const existingIds = new Set(existing.map((g) => g.id));
const toAdd = NEW_GENERALS.filter((g) => !existingIds.has(g.id));

const merged = [...existing, ...toAdd];

if (isWrapped) {
  parsed.data = merged;
  parsed.updatedAt = new Date().toISOString();
  fs.writeFileSync(BASE_PATH, JSON.stringify(parsed, null, 2), "utf-8");
} else {
  fs.writeFileSync(BASE_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

console.log(`[add-generals-batch] 新增 ${toAdd.length} 筆，略過重複 ${NEW_GENERALS.length - toAdd.length} 筆。`);
console.log(`[add-generals-batch] generals-base.json 現有 ${merged.length} 筆。`);
if (merged.length >= 200) {
  console.log(`✅ 達到 200+ 目標（${merged.length} 筆）。`);
} else {
  console.warn(`⚠️  尚未達標，目前 ${merged.length} 筆。`);
}
