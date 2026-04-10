/**
 * add-generals-batch2.js
 * DC-6-0001 — 第二批補充，確保達到 200+ 目標。
 * 用法：node tools_node/add-generals-batch2.js
 */

"use strict";

const path = require("path");
const fs = require("fs");

const BASE_PATH = path.join(
  __dirname,
  "../assets/resources/data/master/generals-base.json"
);

const EXTRA_GENERALS = [
  // ── Shu 補充 ─────────────────────────────────────────────────────────────
  { id: "liu-ba", name: "劉巴", faction: "shu", str: 30, int: 88, lea: 35, pol: 85, cha: 72, luk: 55, ep: 62, gender: "男", role: "Support" },
  { id: "qin-mi", name: "秦宓", faction: "shu", str: 28, int: 84, lea: 30, pol: 80, cha: 75, luk: 52, ep: 59, gender: "男", role: "Support" },
  { id: "yi-ji", name: "伊籍", faction: "shu", str: 40, int: 78, lea: 45, pol: 75, cha: 70, luk: 55, ep: 61, gender: "男", role: "Support" },
  { id: "fei-shi", name: "費詩", faction: "shu", str: 35, int: 76, lea: 38, pol: 72, cha: 68, luk: 50, ep: 58, gender: "男", role: "Support" },
  { id: "zhang-nan", name: "張南", faction: "shu", str: 70, int: 55, lea: 65, pol: 45, cha: 52, luk: 48, ep: 57, gender: "男", role: "Combat" },
  { id: "fu-shou", name: "傅肜", faction: "shu", str: 72, int: 48, lea: 62, pol: 40, cha: 55, luk: 45, ep: 55, gender: "男", role: "Combat" },

  // ── Wu 補充 ───────────────────────────────────────────────────────────────
  { id: "sun-sheng", name: "孫盛", faction: "wu", str: 45, int: 80, lea: 50, pol: 72, cha: 65, luk: 55, ep: 61, gender: "男", role: "Support" },
  { id: "wei-zhao", name: "韋昭", faction: "wu", str: 28, int: 85, lea: 30, pol: 75, cha: 70, luk: 58, ep: 59, gender: "男", role: "Support" },
  { id: "xue-zong", name: "薛綜", faction: "wu", str: 30, int: 82, lea: 35, pol: 78, cha: 68, luk: 52, ep: 58, gender: "男", role: "Support" },
  { id: "he-qi", name: "賀齊", faction: "wu", str: 76, int: 62, lea: 74, pol: 52, cha: 58, luk: 60, ep: 64, gender: "男", role: "Combat" },
  { id: "zhu-yi", name: "朱異", faction: "wu", str: 68, int: 62, lea: 68, pol: 50, cha: 52, luk: 45, ep: 58, gender: "男", role: "Combat" },
  { id: "hua-ge", name: "滑蓋", faction: "wu", str: 60, int: 58, lea: 62, pol: 50, cha: 50, luk: 48, ep: 55, gender: "男", role: "Combat" },

  // ── Wei 補充 ──────────────────────────────────────────────────────────────
  { id: "xu-huang", name: "徐晃", faction: "wei", str: 84, int: 62, lea: 78, pol: 50, cha: 60, luk: 60, ep: 67, gender: "男", role: "Combat" },
  { id: "yu-jin", name: "于禁", faction: "wei", str: 76, int: 68, lea: 80, pol: 55, cha: 52, luk: 45, ep: 64, gender: "男", role: "Combat" },
  { id: "le-jin", name: "樂進", faction: "wei", str: 82, int: 58, lea: 74, pol: 48, cha: 55, luk: 60, ep: 62, gender: "男", role: "Combat" },
  { id: "li-dian", name: "李典", faction: "wei", str: 74, int: 72, lea: 70, pol: 60, cha: 62, luk: 58, ep: 66, gender: "男", role: "Hybrid" },
  { id: "cao-ren", name: "曹仁", faction: "wei", str: 86, int: 65, lea: 82, pol: 55, cha: 65, luk: 62, ep: 70, gender: "男", role: "Combat" },
  { id: "cao-hong", name: "曹洪", faction: "wei", str: 80, int: 52, lea: 72, pol: 48, cha: 58, luk: 55, ep: 62, gender: "男", role: "Combat" },
  { id: "xiahou-yuan", name: "夏侯淵", faction: "wei", str: 85, int: 60, lea: 78, pol: 50, cha: 60, luk: 55, ep: 66, gender: "男", role: "Combat" },
  { id: "cao-zhang", name: "曹彰", faction: "wei", str: 90, int: 55, lea: 75, pol: 45, cha: 68, luk: 58, ep: 66, gender: "男", role: "Combat" },
  { id: "cao-zhi", name: "曹植", faction: "wei", str: 28, int: 95, lea: 30, pol: 65, cha: 92, luk: 50, ep: 62, gender: "男", role: "Support" },

  // ── Enemy 補充 ────────────────────────────────────────────────────────────
  { id: "yuan-shao", name: "袁紹", faction: "enemy", str: 62, int: 58, lea: 65, pol: 68, cha: 80, luk: 48, ep: 65, gender: "男", role: "Hybrid" },
  { id: "yuan-shu", name: "袁術", faction: "enemy", str: 55, int: 52, lea: 58, pol: 62, cha: 72, luk: 40, ep: 57, gender: "男", role: "Hybrid" },
  { id: "liu-biao", name: "劉表", faction: "enemy", str: 45, int: 68, lea: 55, pol: 78, cha: 75, luk: 50, ep: 62, gender: "男", role: "Support" },
];

// ---- 主程式 ----

const raw = fs.readFileSync(BASE_PATH, "utf-8");
const parsed = JSON.parse(raw);
const isWrapped = !Array.isArray(parsed);
const existing = isWrapped ? parsed.data : parsed;

const existingIds = new Set(existing.map((g) => g.id));
const toAdd = EXTRA_GENERALS.filter((g) => !existingIds.has(g.id));

const merged = [...existing, ...toAdd];

if (isWrapped) {
  parsed.data = merged;
  parsed.updatedAt = new Date().toISOString();
  fs.writeFileSync(BASE_PATH, JSON.stringify(parsed, null, 2), "utf-8");
} else {
  fs.writeFileSync(BASE_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

console.log(`[add-generals-batch2] 新增 ${toAdd.length} 筆，略過重複 ${EXTRA_GENERALS.length - toAdd.length} 筆。`);
console.log(`[add-generals-batch2] generals-base.json 現有 ${merged.length} 筆。`);
if (merged.length >= 200) {
  console.log(`✅ 達到 200+ 目標（${merged.length} 筆）。`);
} else {
  console.warn(`⚠️  尚未達標，目前 ${merged.length} 筆。`);
}
