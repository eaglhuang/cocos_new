"use strict";

/**
 * General Data Editor — Extension Main Entry
 * DC-7-0001 | 資料中心架構規格書.md §5 M1-B
 *
 * 此為 Cocos Editor Extension 主體，天生不打包進遊戲包。
 * 功能：搜尋/篩選武將、單筆欄位編輯、rarityTier/characterCategory 快速切換、
 *       儲存時觸發 validate-generals-data.js。
 */

const path = require("path");
const fs = require("fs");
const childProcess = require("child_process");
const { matchesGeneralQuery } = require("./search");

/** 專案根目錄 */
const projectRoot = path.join(__dirname, "../../../");
/** 武將主資料路徑 */
const GENERALS_BASE_PATH = path.join(
  projectRoot,
  "assets/resources/data/master/generals-base.json"
);
/** 驗證工具路徑 */
const VALIDATE_SCRIPT = path.join(
  projectRoot,
  "tools_node/validate-generals-data.js"
);
const BUILD_RUNTIME_SCRIPT = path.join(
  projectRoot,
  "tools_node/build-generals-runtime.js"
);

/**
 * 載入 generals-base.json，回傳武將陣列。
 * @returns {object[]}
 */
function loadGeneralsBase() {
  if (!fs.existsSync(GENERALS_BASE_PATH)) {
    console.warn("[GeneralDataEditor] generals-base.json 不存在：", GENERALS_BASE_PATH);
    return [];
  }
  const raw = fs.readFileSync(GENERALS_BASE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.data ?? [];
}

function normalizeGeneralRecord(g) {
  return {
    id: g.id ?? g.uid ?? "",
    uid: g.id ?? g.uid ?? "",
    name: g.name ?? "",
    alias: Array.isArray(g.alias) ? g.alias : [],
    faction: g.faction ?? "",
    rarityTier: g.rarityTier ?? "",
    characterCategory: g.characterCategory ?? "",
    role: g.role ?? "",
    gender: g.gender ?? "",
    str: g.str ?? 0,
    int: g.int ?? 0,
    lea: g.lea ?? 0,
    pol: g.pol ?? 0,
    cha: g.cha ?? 0,
    luk: g.luk ?? 0,
    ep: g.ep ?? 0,
    troopAptitude: g.troopAptitude ? { ...g.troopAptitude } : {},
    terrainAptitude: g.terrainAptitude ? { ...g.terrainAptitude } : {},
    weatherAptitude: g.weatherAptitude ? { ...g.weatherAptitude } : {},
  };
}

function loadGeneralsBaseWrapper() {
  if (!fs.existsSync(GENERALS_BASE_PATH)) {
    return { version: '1.0.0', updatedAt: new Date().toISOString(), data: [] };
  }
  const raw = fs.readFileSync(GENERALS_BASE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return { version: '1.0.0', updatedAt: new Date().toISOString(), data: parsed };
  }
  parsed.data = Array.isArray(parsed.data) ? parsed.data : [];
  return parsed;
}

/**
 * 將武將陣列寫回 generals-base.json。
 * @param {object[]} generals
 */
function saveGeneralsBase(generals) {
  const wrapper = loadGeneralsBaseWrapper();
  wrapper.data = generals;
  wrapper.updatedAt = new Date().toISOString();
  const raw = JSON.stringify(wrapper, null, 2);
  fs.writeFileSync(GENERALS_BASE_PATH, raw, "utf-8");
  console.log("[GeneralDataEditor] generals-base.json 已儲存，共", generals.length, "筆。");
}

/**
 * 執行 validate-generals-data.js，回傳 Promise<string>（輸出文字）。
 * @returns {Promise<string>}
 */
function runValidate() {
  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn(process.execPath, [VALIDATE_SCRIPT], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let out = "";
    let err = "";
    proc.stdout.on("data", (chunk) => { out += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { err += chunk.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      const result = [out, err].filter(Boolean).join("\n");
      if (code === 0) {
        resolve(result || "驗證通過，零 error。");
      } else {
        resolve(`[驗證失敗 exit=${code}]\n${result}`);
      }
    });
  });
}

function runBuildRuntime() {
  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn(process.execPath, [BUILD_RUNTIME_SCRIPT], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let out = "";
    let err = "";
    proc.stdout.on("data", (chunk) => { out += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { err += chunk.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      const result = [out, err].filter(Boolean).join("\n");
      if (code === 0) {
        resolve(result || "runtime build 完成。");
      } else {
        resolve(`[runtime build 失敗 exit=${code}]\n${result}`);
      }
    });
  });
}

function getGeneralsList() {
  const all = loadGeneralsBase();
  return all.map(normalizeGeneralRecord);
}

function searchGenerals(query) {
  const all = loadGeneralsBase().map(normalizeGeneralRecord);
  return all.filter((record) => matchesGeneralQuery(record, query ?? ""));
}

function getGeneralDetail(uid) {
  const all = loadGeneralsBase();
  const found = all.find((g) => (g.id ?? g.uid) === uid);
  return found ? normalizeGeneralRecord(found) : null;
}

async function updateGeneralFields({ uid, changes }) {
  const all = loadGeneralsBase();
  const idx = all.findIndex((g) => (g.id ?? g.uid) === uid);
  if (idx === -1) {
    return { ok: false, validateOutput: `找不到 uid=${uid}` };
  }

  for (const [field, value] of Object.entries(changes ?? {})) {
    all[idx][field] = value;
  }
  saveGeneralsBase(all);
  const validateOutput = await runValidate();
  const buildOutput = await runBuildRuntime();
  return { ok: true, validateOutput: `${validateOutput}\n\n${buildOutput}` };
}

module.exports = {
  load() {
    console.log("[GeneralDataEditor] Extension 載入完成。");
  },

  unload() {
    console.log("[GeneralDataEditor] Extension 已卸載。");
  },

  methods: {
    /** 開啟武將資料編輯器 Panel */
    openPanel() {
      // eslint-disable-next-line no-undef
      try {
        Editor.Panel.open("general-data-editor");
      } catch (error) {
        console.warn("[GeneralDataEditor] 開啟 general-data-editor 失敗，改嘗試 general-data-editor.default", error);
        // eslint-disable-next-line no-undef
        Editor.Panel.open("general-data-editor.default");
      }
    },

    /** 執行資料驗證並將結果記錄到 Console */
    async validateData() {
      console.log("[GeneralDataEditor] 執行武將資料驗證...");
      const output = await runValidate();
      console.log("[GeneralDataEditor] 驗證結果：\n" + output);
      // eslint-disable-next-line no-undef
      Editor.Dialog.info("武將資料驗證結果", { detail: output, buttons: ["確認"] });
      return output;
    },
    getGeneralsList,
    searchGenerals,
    getGeneralDetail,

    /**
     * 更新單筆武將欄位並寫回檔案，觸發驗證。
     * @param {{ uid: string, field: string, value: unknown }} payload
     * @returns {Promise<{ ok: boolean, validateOutput: string }>}
     */
    async updateGeneralField({ uid, field, value }) {
      return updateGeneralFields({ uid, changes: { [field]: value } });
    },

    async updateGeneralFields(payload) {
      return updateGeneralFields(payload);
    },
  },
};
