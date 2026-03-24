"use strict";

/**
 * S-6 Cyberpunk VFX 素材遷移工具
 *
 * 功能：
 *   讀取 config/cyberpunk-import.config.json 的映射表，
 *   將 input/cyberpunk/ 下的原始 PNG 重命名（ex_ 前綴）並複製到
 *   assets/bundles/vfx_core/textures/ 對應子資料夾。
 *
 * 使用方式：
 *   1. 從 Cyberpunk Demo 匯出 PNG，放入 tools/sprite-pipeline/input/cyberpunk/
 *   2. node tools/sprite-pipeline/import-cyberpunk-vfx.js
 *
 * 可選旗標：
 *   --dry-run   只顯示操作清單，不實際複製
 *   --overwrite 若目標已存在仍覆蓋（預設：跳過）
 *
 * Unity 對照：類似 Unity AssetDatabase.CopyAsset + ImportAsset 的手動版批次腳本。
 */

const fs = require("fs");
const path = require("path");

// ── 常數設定 ──────────────────────────────────────────
const PROJECT_ROOT  = path.resolve(__dirname, "..", "..");
const INPUT_DIR     = path.join(__dirname, "input", "cyberpunk");
const OUTPUT_BASE   = path.join(PROJECT_ROOT, "assets", "bundles", "vfx_core", "textures");
const CONFIG_PATH   = path.join(__dirname, "config", "cyberpunk-import.config.json");

// ── CLI 旗標 ──────────────────────────────────────────
const args      = process.argv.slice(2);
const DRY_RUN   = args.includes("--dry-run");
const OVERWRITE = args.includes("--overwrite");

// ── 工具函式 ──────────────────────────────────────────
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  if (!DRY_RUN) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ── 主流程 ────────────────────────────────────────────
function main() {
  // 1. 讀取設定
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`[錯誤] 找不到設定檔：${CONFIG_PATH}`);
    process.exit(1);
  }
  const config  = readJson(CONFIG_PATH);
  const entries = config.entries || [];

  if (entries.length === 0) {
    console.log("[跳過] config 中沒有任何 entries。");
    return;
  }

  // 2. 確認輸入資料夾存在
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`[錯誤] 找不到輸入資料夾：${INPUT_DIR}`);
    console.error(`請先建立資料夾並放入 Cyberpunk PNG：${INPUT_DIR}`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("[Dry Run 模式] 以下操作不會實際執行\n");
  }

  // 3. 統計
  let copied  = 0;
  let skipped = 0;
  let missing = 0;

  // 4. 逐一處理 entries
  for (const entry of entries) {
    const sourcePath = path.join(INPUT_DIR, entry.source);
    const destPath   = path.join(OUTPUT_BASE, entry.dest);
    const label      = `${entry.source} → vfx_core/textures/${entry.dest}`;

    // 來源不存在
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[缺少] ${label}`);
      missing++;
      continue;
    }

    // 目標已存在且不覆蓋
    if (fs.existsSync(destPath) && !OVERWRITE) {
      console.log(`[跳過] ${label}（目標已存在，加 --overwrite 強制覆蓋）`);
      skipped++;
      continue;
    }

    // 執行複製
    if (!DRY_RUN) {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(sourcePath, destPath);
    }
    console.log(`[${DRY_RUN ? "預覽" : "完成"}] ${label}${entry.note ? "　— " + entry.note : ""}`);
    copied++;
  }

  // 5. 結果摘要
  console.log("\n────────────────────────────────────────");
  console.log(`複製：${copied}　跳過：${skipped}　缺少：${missing}　合計：${entries.length}`);

  if (missing > 0) {
    console.log("\n[提醒] 有缺少的來源檔案：");
    console.log(`  → 請確認 PNG 已放入：${INPUT_DIR}`);
    console.log("  → 確認後再次執行本腳本（或加 --overwrite）");
  }

  if (!DRY_RUN && copied > 0) {
    console.log("\n[下一步]");
    console.log("  1. 在 Cocos Creator 按下 Ctrl+R 重新整理 Asset DB");
    console.log("  2. 確認每個 SpriteFrame 可在 Inspector 預覽");
    console.log("  3. 更新 assets/bundles/vfx_core/_MANIFEST.md 中對應素材的狀態為 🚧 WIP");
  }
}

main();
