"use strict";

const { matchesGeneralQuery } = require("../../src/search.js");

const TROOP_APTITUDE_KEYS = ['CAVALRY', 'INFANTRY', 'ARCHER', 'SIEGE', 'ENGINEER', 'NAVY'];
const TERRAIN_APTITUDE_KEYS = ['PLAIN', 'MOUNTAIN', 'RIVER', 'FOREST', 'DESERT'];
const WEATHER_APTITUDE_KEYS = ['SUNNY', 'RAINY', 'FOG', 'WINDY', 'NIGHT', 'THUNDER'];

function formatAliasList(alias) {
  return Array.isArray(alias) ? alias.join(', ') : '';
}

function parseAliasList(text) {
  return Array.from(new Set(
    String(text ?? '')
      .split(/[\n,，、]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  ));
}

function normalizeAptitudeKey(key, kind) {
  const upper = String(key ?? '').trim().toUpperCase();
  if (!upper) return '';
  if (kind === 'terrain' && upper === 'WATER') return 'RIVER';
  return upper;
}

function formatAptitudeMap(map, orderedKeys) {
  const source = map && typeof map === 'object' ? map : {};
  const printed = new Set();
  const lines = [];
  for (const key of orderedKeys) {
    if (source[key]) {
      lines.push(`${key}:${String(source[key]).toUpperCase()}`);
      printed.add(key);
    }
  }
  for (const [key, value] of Object.entries(source)) {
    if (!printed.has(key) && value) {
      lines.push(`${key}:${String(value).toUpperCase()}`);
    }
  }
  return lines.join('\n');
}

function parseAptitudeMap(text, kind) {
  const result = {};
  const tokens = String(text ?? '')
    .split(/[\r\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const parts = token.split(/[:=]/, 2);
    if (parts.length < 2) continue;
    const key = normalizeAptitudeKey(parts[0], kind);
    const grade = String(parts[1] ?? '').trim().toUpperCase();
    if (!key || !grade) continue;
    result[key] = grade;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * General Data Editor — Default Panel
 * DC-7-0001 | 資料中心架構規格書.md §5 M1-B
 *
 * Cocos Editor 3.8 Panel — HTML/JS 格式（不使用 Vue SFC）。
 * 透過 Editor.Message.request / Editor.Message.send 與 main.js IPC 溝通。
 */

// ---- Panel HTML Template ----
const PANEL_HTML = /* html */ `
<style>
  :host { display: grid; grid-template-columns: minmax(360px, 1.2fr) minmax(320px, 1fr); gap: 10px; padding: 10px; font-size: 13px; box-sizing: border-box; height: 100%; }
  .panel { display: flex; flex-direction: column; min-height: 0; }
  #toolbar { display: flex; gap: 8px; margin-bottom: 8px; }
  #toolbar input { flex: 1; padding: 4px 8px; border: 1px solid var(--color-default-border, #555); background: var(--color-normal-fill, #333); color: var(--color-normal-text, #eee); border-radius: 3px; }
  #toolbar button { padding: 4px 12px; cursor: pointer; }
  #status { color: var(--color-info-fill, #aaa); margin-bottom: 4px; font-size: 11px; }
  #result-list { flex: 1; overflow-y: auto; border: 1px solid var(--color-default-border, #555); border-radius: 3px; min-height: 0; }
  table { width: 100%; border-collapse: collapse; }
  th { position: sticky; top: 0; background: var(--color-normal-fill, #333); padding: 4px 8px; text-align: left; font-weight: bold; }
  tr:nth-child(even) { background: var(--color-hover-fill, #2a2a2a); }
  tr.selected { background: rgba(120, 170, 220, 0.22); }
  td { padding: 3px 8px; }
  tr:hover { background: rgba(120, 170, 220, 0.12); cursor: pointer; }
  .form-grid { display: grid; grid-template-columns: 110px 1fr; gap: 8px 10px; align-items: center; }
  .form-grid input, .form-grid select, .form-grid textarea { width: 100%; box-sizing: border-box; padding: 4px 6px; border: 1px solid var(--color-default-border, #555); background: var(--color-normal-fill, #333); color: var(--color-normal-text, #eee); border-radius: 3px; }
  .form-grid textarea { min-height: 72px; resize: vertical; }
  .toolbar-inline { display: flex; gap: 8px; margin-top: 10px; }
  .section-title { font-weight: bold; margin-bottom: 8px; }
  .hint { color: var(--color-info-fill, #999); font-size: 11px; margin-bottom: 8px; }
  .query-help { margin-bottom: 8px; padding: 8px; border: 1px solid var(--color-default-border, #444); border-radius: 4px; background: var(--color-normal-fill, #272727); }
  .query-help .title { font-size: 12px; font-weight: bold; margin-bottom: 4px; }
  .query-help .syntax { color: var(--color-info-fill, #b5b5b5); font-size: 11px; line-height: 1.45; }
  .quick-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .quick-buttons button { padding: 3px 8px; font-size: 11px; cursor: pointer; }
  #validate-output { margin-top: 8px; padding: 6px; background: var(--color-normal-fill, #222); border: 1px solid var(--color-default-border, #444); border-radius: 3px; font-size: 11px; white-space: pre-wrap; max-height: 100px; overflow-y: auto; }
</style>
<div class="panel">
  <div id="toolbar">
    <input id="search-box" type="text" placeholder="中文相似搜尋 / 智力 > 90 or 武力 < 10 / faction:shu" />
    <button id="btn-validate">驗證資料</button>
    <button id="btn-refresh">重新載入</button>
  </div>
  <div class="query-help">
    <div class="title">查詢語法提示</div>
    <div class="syntax">可直接輸入中文模糊查詢（例：關俞）或條件語法（例：智力 &gt; 90 or 武力 &lt; 20）。支援欄位：武力/智力/統率/政治/魅力/運氣/稀有度/陣營。</div>
    <div class="quick-buttons">
      <button id="btn-preset-int-high">智力 &gt; 90</button>
      <button id="btn-preset-str-low">武力 &lt; 20</button>
      <button id="btn-preset-shu-int">陣營:shu and 智力 &gt; 85</button>
      <button id="btn-preset-rare">稀有度:legendary or 稀有度:mythic</button>
      <button id="btn-preset-support">角色:Support</button>
      <button id="btn-preset-clear">清空</button>
    </div>
  </div>
  <div id="status">載入中…</div>
  <div id="result-list">
    <table>
      <thead><tr><th>uid</th><th>名稱</th><th>勢力</th><th>武/智/統</th><th>稀有度</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <div id="validate-output" hidden></div>
</div>
<div class="panel">
  <div class="section-title">武將欄位編輯表單</div>
  <div class="hint">下拉選單用於 enum 欄位；別名用逗號或換行分隔，適性欄位格式為 KEY:等級，一行一筆。儲存後會寫回 \`master/generals-base.json\`。</div>
  <div class="form-grid">
    <label for="field-uid">uid</label><input id="field-uid" type="text" disabled />
    <label for="field-name">名稱</label><input id="field-name" type="text" />
    <label for="field-alias">別名</label><textarea id="field-alias" placeholder="例：蔡文姬, 胡笳才女"></textarea>
    <label for="field-faction">陣營</label><select id="field-faction"></select>
    <label for="field-rarity">稀有度</label><select id="field-rarity"></select>
    <label for="field-category">分類</label><select id="field-category"></select>
    <label for="field-role">角色</label><select id="field-role"></select>
    <label for="field-gender">性別</label><select id="field-gender"></select>
    <label for="field-str">武力</label><input id="field-str" type="number" />
    <label for="field-int">智力</label><input id="field-int" type="number" />
    <label for="field-lea">統率</label><input id="field-lea" type="number" />
    <label for="field-pol">政治</label><input id="field-pol" type="number" />
    <label for="field-cha">魅力</label><input id="field-cha" type="number" />
    <label for="field-luk">運氣</label><input id="field-luk" type="number" />
    <label for="field-ep">EP</label><input id="field-ep" type="number" />
    <label for="field-troop-aptitude">兵種適性</label><textarea id="field-troop-aptitude" placeholder="CAVALRY:A\nINFANTRY:B\nARCHER:B"></textarea>
    <label for="field-terrain-aptitude">地形適性</label><textarea id="field-terrain-aptitude" placeholder="PLAIN:A\nRIVER:B\nFOREST:B"></textarea>
    <label for="field-weather-aptitude">天氣適性</label><textarea id="field-weather-aptitude" placeholder="SUNNY:A\nFOG:B\nNIGHT:B"></textarea>
  </div>
  <div class="toolbar-inline">
    <button id="btn-save">儲存變更</button>
    <button id="btn-reset">重設表單</button>
  </div>
</div>
`;

// ---- Panel 定義 ----
module.exports = Editor.Panel.define({
  template: PANEL_HTML,
  style: "",

  $: {
    searchBox: "#search-box",
    btnValidate: "#btn-validate",
    btnRefresh: "#btn-refresh",
    btnPresetIntHigh: "#btn-preset-int-high",
    btnPresetStrLow: "#btn-preset-str-low",
    btnPresetShuInt: "#btn-preset-shu-int",
    btnPresetRare: "#btn-preset-rare",
    btnPresetSupport: "#btn-preset-support",
    btnPresetClear: "#btn-preset-clear",
    status: "#status",
    tbody: "#tbody",
    validateOutput: "#validate-output",
    uidInput: "#field-uid",
    nameInput: "#field-name",
    aliasInput: "#field-alias",
    factionSelect: "#field-faction",
    raritySelect: "#field-rarity",
    categorySelect: "#field-category",
    roleSelect: "#field-role",
    genderSelect: "#field-gender",
    strInput: "#field-str",
    intInput: "#field-int",
    leaInput: "#field-lea",
    polInput: "#field-pol",
    chaInput: "#field-cha",
    lukInput: "#field-luk",
    epInput: "#field-ep",
    troopAptitudeInput: "#field-troop-aptitude",
    terrainAptitudeInput: "#field-terrain-aptitude",
    weatherAptitudeInput: "#field-weather-aptitude",
    btnSave: "#btn-save",
    btnReset: "#btn-reset",
  },

  /** 全量武將快取 */
  _allGenerals: [],
  _selectedUid: null,

  ready() {
    this._allGenerals = [];
    this._selectedUid = null;
    this._initSelectOptions();
    this._loadGenerals();

    this.$.searchBox.addEventListener("input", () => {
      this._filterAndRender(this.$.searchBox.value);
    });

    this.$.btnRefresh.addEventListener("click", () => {
      this._loadGenerals();
    });

    this.$.btnPresetIntHigh.addEventListener("click", () => {
      this._applyQuickQuery("智力 > 90");
    });
    this.$.btnPresetStrLow.addEventListener("click", () => {
      this._applyQuickQuery("武力 < 20");
    });
    this.$.btnPresetShuInt.addEventListener("click", () => {
      this._applyQuickQuery("陣營:shu and 智力 > 85");
    });
    this.$.btnPresetRare.addEventListener("click", () => {
      this._applyQuickQuery("稀有度:legendary or 稀有度:mythic");
    });
    this.$.btnPresetSupport.addEventListener("click", () => {
      this._applyQuickQuery("角色:Support");
    });
    this.$.btnPresetClear.addEventListener("click", () => {
      this._applyQuickQuery("");
    });

    this.$.btnValidate.addEventListener("click", async () => {
      this.$.validateOutput.hidden = false;
      this.$.validateOutput.textContent = "驗證中…";
      const result = await Editor.Message.request("general-data-editor", "validateData");
      this.$.validateOutput.textContent = result ?? "（無輸出）";
    });

    this.$.btnSave.addEventListener("click", () => {
      this._saveSelected();
    });

    this.$.btnReset.addEventListener("click", () => {
      this._resetForm();
    });
  },

  close() {},

  methods: {
    async _loadGenerals() {
      this.$.status.textContent = "載入中…";
      try {
        const list = await Editor.Message.request("general-data-editor", "getGeneralsList");
        this._allGenerals = Array.isArray(list) ? list : [];
        this._filterAndRender(this.$.searchBox.value);
      } catch (error) {
        this._allGenerals = [];
        const message = error && error.message ? error.message : String(error);
        this.$.status.textContent = '載入失敗';
        this.$.validateOutput.hidden = false;
        this.$.validateOutput.textContent = `讀取武將列表失敗\n${message}`;
        console.error('[GeneralDataEditor] _loadGenerals failed', error);
      }
    },

    _initSelectOptions() {
      this._fillSelect(this.$.factionSelect, ['wei', 'shu', 'wu', 'enemy', 'neutral', 'player', 'other']);
      this._fillSelect(this.$.raritySelect, ['common', 'rare', 'epic', 'legendary', 'mythic']);
      this._fillSelect(this.$.categorySelect, ['civilian', 'general', 'famed', 'mythical', 'titled']);
      this._fillSelect(this.$.roleSelect, ['Combat', 'Support', 'Hybrid', 'Commander']);
      this._fillSelect(this.$.genderSelect, ['男', '女', '未知']);
    },

    _fillSelect(select, values) {
      select.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join('');
    },

    _filterAndRender(query) {
      const q = (query ?? "").trim();
      const allGenerals = Array.isArray(this._allGenerals) ? this._allGenerals : [];
      let list = allGenerals;
      if (q !== "") {
        list = list.filter((g) => matchesGeneralQuery(g, q));
      }

      this.$.status.textContent = `顯示 ${list.length} / ${allGenerals.length} 筆`;
      this._renderTable(list);
    },

    _applyQuickQuery(query) {
      this.$.searchBox.value = query;
      this._filterAndRender(query);
    },

    _renderTable(list) {
      const tbody = this.$.tbody;
      tbody.innerHTML = "";
      for (const g of list) {
        const tr = document.createElement("tr");
        if (this._selectedUid === g.uid) tr.classList.add('selected');
        tr.innerHTML = `
          <td>${g.uid}</td>
          <td>${g.name}</td>
          <td>${g.faction}</td>
          <td>${g.str}/${g.int}/${g.lea}</td>
          <td>${g.rarityTier}</td>
        `;
        tr.addEventListener('click', () => this._selectGeneral(g.uid));
        tbody.appendChild(tr);
      }
    },

    _selectGeneral(uid) {
      this._selectedUid = uid;
      const allGenerals = Array.isArray(this._allGenerals) ? this._allGenerals : [];
      const record = allGenerals.find((g) => g.uid === uid);
      if (!record) return;
      this.$.uidInput.value = record.uid ?? '';
      this.$.nameInput.value = record.name ?? '';
      this.$.aliasInput.value = formatAliasList(record.alias);
      this.$.factionSelect.value = record.faction ?? 'wei';
      this.$.raritySelect.value = record.rarityTier ?? 'common';
      this.$.categorySelect.value = record.characterCategory ?? 'general';
      this.$.roleSelect.value = record.role ?? 'Combat';
      this.$.genderSelect.value = record.gender ?? '未知';
      this.$.strInput.value = record.str ?? 0;
      this.$.intInput.value = record.int ?? 0;
      this.$.leaInput.value = record.lea ?? 0;
      this.$.polInput.value = record.pol ?? 0;
      this.$.chaInput.value = record.cha ?? 0;
      this.$.lukInput.value = record.luk ?? 0;
      this.$.epInput.value = record.ep ?? 0;
      this.$.troopAptitudeInput.value = formatAptitudeMap(record.troopAptitude, TROOP_APTITUDE_KEYS);
      this.$.terrainAptitudeInput.value = formatAptitudeMap(record.terrainAptitude, TERRAIN_APTITUDE_KEYS);
      this.$.weatherAptitudeInput.value = formatAptitudeMap(record.weatherAptitude, WEATHER_APTITUDE_KEYS);
      this._filterAndRender(this.$.searchBox.value);
    },

    _resetForm() {
      if (this._selectedUid) {
        this._selectGeneral(this._selectedUid);
      }
    },

    async _saveSelected() {
      if (!this._selectedUid) {
        this.$.status.textContent = '請先從左側列表選一位武將';
        return;
      }

      const changes = {
        name: this.$.nameInput.value.trim(),
        alias: parseAliasList(this.$.aliasInput.value),
        faction: this.$.factionSelect.value,
        rarityTier: this.$.raritySelect.value,
        characterCategory: this.$.categorySelect.value,
        role: this.$.roleSelect.value,
        gender: this.$.genderSelect.value,
        str: Number(this.$.strInput.value),
        int: Number(this.$.intInput.value),
        lea: Number(this.$.leaInput.value),
        pol: Number(this.$.polInput.value),
        cha: Number(this.$.chaInput.value),
        luk: Number(this.$.lukInput.value),
        ep: Number(this.$.epInput.value),
        troopAptitude: parseAptitudeMap(this.$.troopAptitudeInput.value, 'troop'),
        terrainAptitude: parseAptitudeMap(this.$.terrainAptitudeInput.value, 'terrain'),
        weatherAptitude: parseAptitudeMap(this.$.weatherAptitudeInput.value, 'weather'),
      };

      this.$.status.textContent = '儲存中…';
      const result = await Editor.Message.request('general-data-editor', 'updateGeneralFields', {
        uid: this._selectedUid,
        changes,
      });

      this.$.validateOutput.hidden = false;
      this.$.validateOutput.textContent = result?.validateOutput ?? '儲存失敗';
      if (result?.ok) {
        await this._loadGenerals();
        this._selectGeneral(this._selectedUid);
      }
    },
  },
});
