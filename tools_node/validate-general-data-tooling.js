#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const paths = {
  extensionPackage: path.join(projectRoot, 'extensions/general-data-editor/package.json'),
  extensionMain: path.join(projectRoot, 'extensions/general-data-editor/src/main.js'),
  extensionPanel: path.join(projectRoot, 'extensions/general-data-editor/panels/default/index.js'),
  extensionSearch: path.join(projectRoot, 'extensions/general-data-editor/src/search.js'),
  runtimePanel: path.join(projectRoot, 'assets/scripts/ui/panels/GeneralDataDebugPanel.ts'),
  base: path.join(projectRoot, 'assets/resources/data/master/generals-base.json'),
  runtime: path.join(projectRoot, 'assets/resources/data/generals.json'),
  runtimeIndex: path.join(projectRoot, 'assets/resources/data/generals-index.json'),
  runtimeStories: path.join(projectRoot, 'assets/resources/data/generals-stories.json'),
};

const backups = new Map();

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function backupFile(filePath) {
  if (backups.has(filePath) || !fs.existsSync(filePath)) return;
  backups.set(filePath, fs.readFileSync(filePath));
}

function restoreFiles() {
  for (const [filePath, content] of backups.entries()) {
    fs.writeFileSync(filePath, content);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function testExtension() {
  console.log('▶ DC-7-0001 Extension smoke');

  ensure(fs.existsSync(paths.extensionPackage), '缺少 extension package.json');
  ensure(fs.existsSync(paths.extensionMain), '缺少 extension src/main.js');
  ensure(fs.existsSync(paths.extensionPanel), '缺少 extension panel index.js');
  ensure(fs.existsSync(paths.extensionSearch), '缺少 extension search.js');

  const pkg = readJson(paths.extensionPackage);
  ensure(pkg.name === 'general-data-editor', 'extension package name 錯誤');
  ensure(pkg.main === 'src/main.js', 'extension main path 錯誤');
  const panelMain = pkg.panels?.default?.main ?? pkg.contributions?.panels?.default?.main;
  ensure(panelMain === 'panels/default/index.js', 'panel main path 錯誤');
  ensure(Array.isArray(pkg.contributions?.menu) && pkg.contributions.menu.length >= 2, 'extension menu 缺失');

  const panelSource = fs.readFileSync(paths.extensionPanel, 'utf8');
  ensure(/field-name/.test(panelSource), 'extension panel 缺少名稱欄位');
  ensure(/field-rarity/.test(panelSource), 'extension panel 缺少稀有度欄位');
  ensure(/updateGeneralFields/.test(panelSource), 'extension panel 未呼叫 updateGeneralFields');
  ensure(/validateData/.test(panelSource), 'extension panel 未提供驗證入口');

  let openedPanel = null;
  let dialogInfo = null;
  global.Editor = {
    Panel: {
      open(id) {
        openedPanel = id;
      },
      define(definition) {
        return definition;
      },
    },
    Dialog: {
      info(title, options) {
        dialogInfo = { title, options };
      },
    },
    Message: {
      request() {
        throw new Error('不應在 extension main smoke 中直接呼叫 Editor.Message.request');
      },
    },
  };

  delete require.cache[require.resolve(paths.extensionMain)];
  const extensionModule = require(paths.extensionMain);

  ensure(extensionModule?.methods?.openPanel, 'extension 缺少 openPanel');
  ensure(extensionModule?.methods?.validateData, 'extension 缺少 validateData');
  ensure(typeof extensionModule.getGeneralsList === 'function', 'extension 缺少 getGeneralsList IPC');
  ensure(typeof extensionModule.searchGenerals === 'function', 'extension 缺少 searchGenerals IPC');
  ensure(typeof extensionModule.updateGeneralFields === 'function', 'extension 缺少 updateGeneralFields IPC');

  extensionModule.methods.openPanel();
  ensure(openedPanel === 'general-data-editor', 'openPanel 未開啟正確 panel');

  const validateOutput = await extensionModule.methods.validateData();
  ensure(/errors=0, warnings=0|驗證通過/.test(validateOutput), 'validateData 未回傳通過結果');
  ensure(dialogInfo?.title === '武將資料驗證結果', 'validateData 未顯示驗證對話框');

  const list = extensionModule.getGeneralsList();
  ensure(Array.isArray(list) && list.length >= 200, 'getGeneralsList 未回傳完整武將列表');
  const shuSmart = extensionModule.searchGenerals('陣營:shu and 智力 > 85');
  ensure(shuSmart.some((entry) => entry.uid === 'zhuge-liang'), 'searchGenerals 未支援 DSL 條件搜尋');

  const target = extensionModule.getGeneralDetail('zhao-yun') ?? extensionModule.getGeneralDetail(list[0].uid);
  ensure(target?.uid, 'getGeneralDetail 未回傳武將資料');

  backupFile(paths.base);
  backupFile(paths.runtime);
  backupFile(paths.runtimeIndex);
  backupFile(paths.runtimeStories);

  const saveResult = await extensionModule.updateGeneralFields({
    uid: target.uid,
    changes: {
      name: target.name,
      faction: target.faction,
      rarityTier: target.rarityTier,
      characterCategory: target.characterCategory,
      role: target.role,
      gender: target.gender,
      str: target.str,
      int: target.int,
      lea: target.lea,
      pol: target.pol,
      cha: target.cha,
      luk: target.luk,
      ep: target.ep,
    },
  });
  ensure(saveResult?.ok === true, 'updateGeneralFields 執行失敗');
  ensure(/errors=0, warnings=0|驗證通過/.test(saveResult.validateOutput), 'updateGeneralFields 後驗證未通過');
  ensure(/build-generals-runtime|generals.json:/.test(saveResult.validateOutput), 'updateGeneralFields 未觸發 runtime rebuild');

  console.log('✔ DC-7-0001 Extension smoke 通過');
}

function createCcMocks(sampleData, devValue) {
  class MockNode {
    constructor(name = '') {
      this.name = name;
      this.children = [];
      this.parent = null;
      this.active = true;
      this.destroyed = false;
      this._components = [];
      this._events = new Map();
    }

    addChild(child) {
      child.parent = this;
      this.children.push(child);
    }

    addComponent(Type) {
      const instance = new Type();
      instance.node = this;
      this._components.push(instance);
      return instance;
    }

    getComponent(Type) {
      return this._components.find((item) => item instanceof Type) ?? null;
    }

    getComponentInChildren(Type) {
      for (const child of this.children) {
        const found = child.getComponent(Type);
        if (found) return found;
      }
      return null;
    }

    on(event, handler, target) {
      const handlers = this._events.get(event) ?? [];
      handlers.push({ handler, target });
      this._events.set(event, handlers);
    }

    off(event) {
      this._events.delete(event);
    }

    destroy() {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((child) => child !== this);
        this.parent = null;
      }
      this.destroyed = true;
      this.active = false;
    }
  }

  class MockComponent {
    constructor() {
      this.node = new MockNode('component-root');
    }
  }

  class MockLabel {
    constructor() {
      this.node = new MockNode('label');
      this.string = '';
    }
  }

  class MockEditBox {
    constructor() {
      this.node = new MockNode('edit-box');
      this.string = '';
    }
  }
  MockEditBox.EventType = { TEXT_CHANGED: 'text-changed' };

  class MockButton {
    constructor() {
      this.node = new MockNode('button');
    }
  }
  MockButton.EventType = { CLICK: 'click' };

  class MockScrollView {
    constructor() {
      this.node = new MockNode('scroll-view');
    }
  }

  class MockJsonAsset {
    constructor(json) {
      this.json = json;
    }
  }

  const mockCatalog = {
    _index: new Map(),
    _loaded: false,
    lastUpdate: null,
    get isLoaded() {
      return this._loaded;
    },
    async load() {
      this._loaded = true;
    },
    getAllEntries() {
      return Array.from(this._index.values()).map((entry) => ({ ...entry }));
    },
    upsertEntry(entry) {
      this._index.set(entry.uid, { ...entry });
    },
    updateEntry(uid, patch) {
      this.lastUpdate = { uid, patch: { ...patch } };
      const next = { ...(this._index.get(uid) ?? {}), ...patch };
      this._index.set(uid, next);
      return { ...next };
    },
  };

  const ccModule = {
    _decorator: {
      ccclass: () => (klass) => klass,
      property: () => () => undefined,
    },
    Button: MockButton,
    Component: MockComponent,
    EditBox: MockEditBox,
    instantiate(template) {
      const clone = new MockNode(`${template?.name ?? 'template'}_clone`);
      const label = new MockLabel();
      clone._components.push(label);
      clone.getComponent = (Type) => clone._components.find((item) => item instanceof Type) ?? null;
      clone.getComponentInChildren = clone.getComponent;
      return clone;
    },
    JsonAsset: MockJsonAsset,
    Label: MockLabel,
    Node: MockNode,
    resources: {
      load(_resourcePath, _type, callback) {
        callback(null, { json: { data: sampleData } });
      },
    },
    ScrollView: MockScrollView,
  };

  return {
    ccModule,
    mockCatalog,
    envModule: { DEV: devValue },
  };
}

function loadRuntimePanelClass(devValue, sampleData) {
  const source = fs.readFileSync(paths.runtimePanel, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true,
    },
    fileName: paths.runtimePanel,
  });

  const { matchesGeneralQuery } = require(paths.extensionSearch);
  const { ccModule, mockCatalog, envModule } = createCcMocks(sampleData, devValue);
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    console,
    require(request) {
      if (request === 'cc') return ccModule;
      if (request === 'cc/env') return envModule;
      if (request.endsWith('DataCatalog')) {
        return {
          DataCatalog: {
            getInstance() {
              return mockCatalog;
            },
          },
        };
      }
      if (request.endsWith('GeneralSearch')) {
        return { matchesGeneralQuery };
      }
      throw new Error(`Unsupported mock require: ${request}`);
    },
  };

  vm.runInNewContext(transpiled.outputText, sandbox, { filename: 'GeneralDataDebugPanel.js' });
  return {
    GeneralDataDebugPanel: module.exports.GeneralDataDebugPanel,
    mockCatalog,
    ccModule,
  };
}

async function testRuntimePanel() {
  console.log('▶ DC-7-0002 Runtime panel smoke');

  const sampleData = [
    {
      id: 'zhuge-liang',
      name: '諸葛亮',
      faction: 'shu',
      rarityTier: 'legendary',
      characterCategory: 'famed',
      role: 'Support',
      gender: '男',
      str: 45,
      int: 99,
      lea: 96,
      pol: 97,
      cha: 92,
      luk: 88,
      ep: 88,
      layerKey: 'L1',
    },
    {
      id: 'zhao-yun',
      name: '趙雲',
      faction: 'shu',
      rarityTier: 'legendary',
      characterCategory: 'famed',
      role: 'Combat',
      gender: '男',
      str: 96,
      int: 82,
      lea: 93,
      pol: 74,
      cha: 94,
      luk: 89,
      ep: 89,
      layerKey: 'L1',
    },
  ];

  const releaseLoad = loadRuntimePanelClass(false, sampleData);
  const releasePanel = new releaseLoad.GeneralDataDebugPanel();
  releasePanel.onLoad();
  ensure(releasePanel.node.destroyed === true, 'DEV=false 時 Runtime Panel 未 destroy');

  const devLoad = loadRuntimePanelClass(true, sampleData);
  const PanelClass = devLoad.GeneralDataDebugPanel;
  const panel = new PanelClass();
  panel.searchInput = new devLoad.ccModule.EditBox();
  panel.resultScroll = new devLoad.ccModule.ScrollView();
  panel.resultList = new devLoad.ccModule.Node('result-list');
  panel.statusLabel = new devLoad.ccModule.Label();
  panel.selectedUidLabel = new devLoad.ccModule.Label();
  panel.nameInput = new devLoad.ccModule.EditBox();
  panel.strInput = new devLoad.ccModule.EditBox();
  panel.intInput = new devLoad.ccModule.EditBox();
  panel.leaInput = new devLoad.ccModule.EditBox();
  panel.polInput = new devLoad.ccModule.EditBox();
  panel.chaInput = new devLoad.ccModule.EditBox();
  panel.lukInput = new devLoad.ccModule.EditBox();
  panel.epInput = new devLoad.ccModule.EditBox();
  panel.factionValueLabel = new devLoad.ccModule.Label();
  panel.rarityValueLabel = new devLoad.ccModule.Label();
  panel.categoryValueLabel = new devLoad.ccModule.Label();
  panel.roleValueLabel = new devLoad.ccModule.Label();

  await panel._loadRuntimeData();
  ensure(panel._records.size === 2, 'Runtime Panel 未載入 generals-base 測試資料');
  ensure(devLoad.mockCatalog.getAllEntries().length === 2, 'Runtime Panel 未回填 DataCatalog');

  await panel.search('陣營:shu and 角色:Support');
  ensure(/找到 1 筆/.test(panel.statusLabel.string), 'Runtime Panel 搜尋 DSL 結果不正確');
  ensure(panel.resultList.children.length === 1, 'Runtime Panel 未渲染正確數量的搜尋結果');

  panel.selectGeneral('zhuge-liang');
  ensure(panel.selectedUidLabel.string.includes('zhuge-liang'), 'Runtime Panel 未載入選中武將欄位');
  panel.strInput.string = '50';
  panel.epInput.string = '90';
  panel.applySelectedChanges();
  ensure(devLoad.mockCatalog.lastUpdate?.uid === 'zhuge-liang', 'Runtime Panel 未更新 DataCatalog');
  ensure(devLoad.mockCatalog.lastUpdate?.patch?.str === 50, 'Runtime Panel 數值修改未反映到 DataCatalog');
  ensure(panel.statusLabel.string.length > 0, 'Runtime Panel 狀態文字未更新');

  console.log('✔ DC-7-0002 Runtime panel smoke 通過');
}

async function main() {
  try {
    await testExtension();
    await testRuntimePanel();
    console.log('✅ General Data Tooling 驗收通過');
  } finally {
    restoreFiles();
  }
}

main().catch((error) => {
  restoreFiles();
  console.error('❌ General Data Tooling 驗收失敗');
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});