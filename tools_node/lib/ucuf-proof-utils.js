'use strict';

const fs = require('fs');
const path = require('path');
const {
  PROJECT_ROOT,
  ensureDir,
  readJson,
  resolvePath,
  validateRecipe,
} = require('./ucuf-recipe-utils');

const FAMILY_OPTIONS = [
  { value: 'detail-split', label: 'detail-split', description: '左主體 + 右內容 + 可選 tab rail 的詳情頁 family' },
  { value: 'dialog-card', label: 'dialog-card', description: '標準彈窗 / modal family' },
  { value: 'rail-list', label: 'rail-list', description: '列表 / 格狀清單 + 可選預覽區 family' },
  { value: 'hud-overlay', label: 'hud-overlay', description: 'HUD / overlay family' },
  { value: 'peek-drawer', label: 'peek-drawer', description: '抽屜 / peek card family' },
];

const GENERATION_POLICY_OPTIONS = [
  { value: 'reuse-only', label: 'reuse-only', description: '完全重用既有 family / asset' },
  { value: 'param-tune', label: 'param-tune', description: '重用既有 family，但需要 layout / token 微調' },
  { value: 'generate-partial-asset', label: 'generate-partial-asset', description: '需要補局部資產' },
  { value: 'new-family-required', label: 'new-family-required', description: '既有 family 無法承接，需要新 family' },
];

const FAMILY_TEMPLATE_LIBRARY = {
  'detail-split': {
    visualZones: [
      { id: 'portrait', label: '左側主體展示區', family: 'panel-light', frameRecipeRef: 'panel-light-v1', notes: 'v0 image-first skeleton: 待人工確認 portrait / hero object 結構' },
      { id: 'header', label: '頂部 meta 區', family: 'dark-metal', frameRecipeRef: 'dark-metal-v1', notes: 'v0 image-first skeleton' },
      { id: 'tab-bar', label: '右側 tab rail', family: 'tab', frameRecipeRef: 'tab-v1', notes: 'v0 image-first skeleton' },
      { id: 'content', label: '右側主內容區', family: 'parchment', frameRecipeRef: 'parchment-v1', notes: 'v0 image-first skeleton' },
    ],
    componentIntents: [
      { zone: 'portrait', nodeHint: 'panel', notes: '主體展示 / 立繪承載區' },
      { zone: 'header', nodeHint: 'label', textKey: 'ui.title', notes: '標題 / meta' },
      { zone: 'tab-bar', nodeHint: 'tab-bar', bind: 'ui.selectedTab', notes: 'tab 切換' },
      { zone: 'content', nodeHint: 'panel', bind: 'ui.content', notes: '內容承載區' },
    ],
    contentSlots: [
      { id: 'title', type: 'label', placeholder: '標題' },
      { id: 'selectedTab', type: 'enum', placeholder: '當前 tab' },
      { id: 'content', type: 'label', placeholder: '主內容' },
    ],
  },
  'dialog-card': {
    visualZones: [
      { id: 'header', label: '彈窗標題列', family: 'dark-metal', frameRecipeRef: 'dark-metal-v1', notes: 'v0 image-first skeleton' },
      { id: 'body', label: '彈窗內容區', family: 'parchment', frameRecipeRef: 'parchment-v1', notes: 'v0 image-first skeleton' },
      { id: 'footer', label: '底部 CTA 區', family: 'gold-cta', frameRecipeRef: 'gold-cta-v1', notes: 'v0 image-first skeleton' },
    ],
    componentIntents: [
      { zone: 'header', nodeHint: 'label', textKey: 'ui.title', notes: '標題' },
      { zone: 'body', nodeHint: 'dialog', bind: 'ui.body', notes: '彈窗主體' },
      { zone: 'footer', nodeHint: 'button', textKey: 'common.confirm', bind: 'ui.canConfirm', notes: '確認 CTA' },
    ],
    contentSlots: [
      { id: 'title', type: 'label', placeholder: '標題' },
      { id: 'body', type: 'label', placeholder: '主內容' },
      { id: 'canConfirm', type: 'bool', placeholder: '可確認狀態', optional: true },
      { id: 'confirm-button', type: 'button', placeholder: '確認', family: 'gold-cta' },
    ],
  },
  'rail-list': {
    visualZones: [
      { id: 'header', label: '頂部標題列', family: 'dark-metal', frameRecipeRef: 'dark-metal-v1', notes: 'v0 image-first skeleton' },
      { id: 'tab-bar', label: '分類列 / filter rail', family: 'tab', frameRecipeRef: 'tab-v1', notes: 'v0 image-first skeleton' },
      { id: 'item-grid', label: '主列表 / grid 區', family: 'item-cell', frameRecipeRef: 'item-cell-v1', notes: 'v0 image-first skeleton' },
      { id: 'preview-panel', label: '右側 preview / detail 區', family: 'parchment', frameRecipeRef: 'parchment-v1', notes: 'v0 image-first skeleton' },
    ],
    componentIntents: [
      { zone: 'header', nodeHint: 'label', textKey: 'ui.title', notes: '標題' },
      { zone: 'tab-bar', nodeHint: 'tab-bar', bind: 'ui.selectedCategory', notes: '分類切換' },
      { zone: 'item-grid', nodeHint: 'scroll-list', bind: 'ui.items[]', notes: '列表 / grid' },
      { zone: 'preview-panel', nodeHint: 'panel', bind: 'ui.selectedItem', notes: 'preview / detail' },
    ],
    contentSlots: [
      { id: 'title', type: 'label', placeholder: '標題' },
      { id: 'selectedCategory', type: 'enum', placeholder: '選中分類' },
      { id: 'items', type: 'list', placeholder: '列表項目', minCount: 1, maxCount: 100 },
      { id: 'selectedItem', type: 'label', placeholder: '選中項目', optional: true },
    ],
  },
  'hud-overlay': {
    visualZones: [
      { id: 'top-bar', label: '頂部 HUD 列', family: 'dark-metal', frameRecipeRef: 'dark-metal-v1', notes: 'v0 image-first skeleton' },
      { id: 'left-overlay', label: '左側 overlay 區', family: 'none', notes: 'v0 image-first skeleton' },
      { id: 'right-overlay', label: '右側 overlay 區', family: 'none', notes: 'v0 image-first skeleton' },
    ],
    componentIntents: [
      { zone: 'top-bar', nodeHint: 'overlay', bind: 'ui.topBar', notes: '頂部資源 / 狀態列' },
      { zone: 'left-overlay', nodeHint: 'overlay', bind: 'ui.left', notes: '左側 overlay' },
      { zone: 'right-overlay', nodeHint: 'overlay', bind: 'ui.right', notes: '右側 overlay' },
    ],
    contentSlots: [
      { id: 'topBar', type: 'label', placeholder: '頂部 HUD 資訊' },
      { id: 'left', type: 'label', placeholder: '左側 HUD 資訊', optional: true },
      { id: 'right', type: 'label', placeholder: '右側 HUD 資訊', optional: true },
    ],
  },
  'peek-drawer': {
    visualZones: [
      { id: 'header', label: '抽屜標題列', family: 'dark-metal', frameRecipeRef: 'dark-metal-v1', notes: 'v0 image-first skeleton' },
      { id: 'drawer-body', label: '抽屜內容區', family: 'parchment', frameRecipeRef: 'parchment-v1', notes: 'v0 image-first skeleton' },
      { id: 'footer', label: '抽屜底部動作區', family: 'gold-cta', frameRecipeRef: 'gold-cta-v1', notes: 'v0 image-first skeleton' },
    ],
    componentIntents: [
      { zone: 'header', nodeHint: 'label', textKey: 'ui.title', notes: '標題' },
      { zone: 'drawer-body', nodeHint: 'panel', bind: 'ui.content', notes: '抽屜內容' },
      { zone: 'footer', nodeHint: 'button', textKey: 'common.close', notes: '關閉 / 確認' },
    ],
    contentSlots: [
      { id: 'title', type: 'label', placeholder: '標題' },
      { id: 'content', type: 'label', placeholder: '內容' },
      { id: 'close-button', type: 'button', placeholder: '關閉', family: 'gold-cta' },
    ],
  },
};

function kebabCase(value) {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function pascalCase(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join('');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, json, dryRun) {
  const content = `${JSON.stringify(json, null, 2)}\n`;
  if (dryRun) {
    console.log(`--- ${path.relative(PROJECT_ROOT, filePath)} ---`);
    console.log(content);
    return;
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function normalizeProofSource(proofSource) {
  if (!proofSource) {
    return '';
  }
  if (proofSource.startsWith('ref://') || proofSource.startsWith('figma://')) {
    return proofSource;
  }
  const resolved = resolvePath(proofSource);
  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`找不到 proof source：${proofSource}`);
  }
  return `ref://${path.relative(PROJECT_ROOT, resolved).replace(/\\/g, '/')}`;
}

function inferFamilyFromSource(screenId, proofSource) {
  const target = `${screenId} ${proofSource}`.toLowerCase();
  if (/hud|battle|overlay/.test(target)) return 'hud-overlay';
  if (/dialog|modal|confirm/.test(target)) return 'dialog-card';
  if (/drawer|peek/.test(target)) return 'peek-drawer';
  if (/detail|general|hero|character/.test(target)) return 'detail-split';
  return 'rail-list';
}

function buildProofDraftFromSource(options) {
  const screenId = String(options.screenId || '').trim();
  if (!screenId) {
    throw new Error('buildProofDraftFromSource 需要 screenId');
  }

  const familyId = options.familyId || inferFamilyFromSource(screenId, options.proofSource);
  const template = FAMILY_TEMPLATE_LIBRARY[familyId] || FAMILY_TEMPLATE_LIBRARY['rail-list'];

  return {
    $schema: '../../proof-contract.schema.json',
    version: '1.0',
    screenId,
    proofSource: normalizeProofSource(options.proofSource),
    capturedAt: new Date().toISOString().slice(0, 10),
    capturedBy: 'run-ui-vibe-workflow',
    confidence: 0.35,
    visualZones: template.visualZones,
    componentIntents: template.componentIntents,
    spacingRecipe: {
      containerPadding: 24,
      itemSpacing: 16,
      sectionGap: 32,
      unitBasis: 8,
    },
    contentSlots: template.contentSlots,
    notes: `Auto-generated v0 proof draft from proofSource. familyHint=${familyId}. 必須在正式生產前人工確認 visual zones / content slots / unresolved notes。`,
  };
}

function loadProof(proofArg) {
  const proofPath = resolvePath(proofArg);
  if (!proofPath || !fs.existsSync(proofPath)) {
    throw new Error(`找不到 proof：${proofArg}`);
  }

  const proof = readJson(proofPath);
  validateProof(proof);
  return { proof, proofPath };
}

function validateProof(proof) {
  const failures = [];
  ['version', 'screenId', 'proofSource', 'capturedAt', 'capturedBy'].forEach((field) => {
    if (!proof[field] || typeof proof[field] !== 'string') {
      failures.push(`缺少必要字串欄位: ${field}`);
    }
  });
  if (typeof proof.confidence !== 'number') {
    failures.push('confidence 必須是 number');
  }
  if (!Array.isArray(proof.visualZones) || proof.visualZones.length === 0) {
    failures.push('visualZones 必須為非空陣列');
  }
  if (!Array.isArray(proof.componentIntents)) {
    failures.push('componentIntents 必須為陣列');
  }
  if (!Array.isArray(proof.contentSlots) || proof.contentSlots.length === 0) {
    failures.push('contentSlots 必須為非空陣列');
  }
  if (!proof.spacingRecipe || typeof proof.spacingRecipe !== 'object') {
    failures.push('spacingRecipe 必須存在');
  }

  if (failures.length > 0) {
    throw new Error(`[ucuf-proof] proof 驗證失敗:\n- ${failures.join('\n- ')}`);
  }

  return proof;
}

function recipeScreenIdFromProof(screenId) {
  const base = kebabCase(screenId);
  return base.endsWith('-screen') ? base : `${base}-screen`;
}

function screenBaseFromProof(screenId) {
  return recipeScreenIdFromProof(screenId).replace(/-screen$/, '');
}

function getZoneIntentMap(proof) {
  const map = new Map();
  for (const intent of proof.componentIntents || []) {
    const key = kebabCase(intent.zone);
    const list = map.get(key) || [];
    list.push(intent);
    map.set(key, list);
  }
  return map;
}

function inferFamilyRecommendation(proof) {
  const zoneIds = (proof.visualZones || []).map((zone) => kebabCase(zone.id));
  const familySet = new Set((proof.visualZones || []).map((zone) => zone.family));
  const zoneIntentMap = getZoneIntentMap(proof);
  const hasTab = zoneIds.some((zoneId) => zoneId.includes('tab')) || Array.from(zoneIntentMap.values()).some((intents) => intents.some((item) => item.nodeHint === 'tab-bar'));
  const hasList = Array.from(zoneIntentMap.values()).some((intents) => intents.some((item) => item.nodeHint === 'scroll-list' || item.nodeHint === 'grid'));
  const hasPreview = zoneIds.some((zoneId) => /preview|detail|purchase|drawer/.test(zoneId));
  const hasPortrait = zoneIds.some((zoneId) => /portrait|hero|emblem|crest/.test(zoneId));
  const hasOverlay = Array.from(zoneIntentMap.values()).some((intents) => intents.some((item) => item.nodeHint === 'overlay'));
  const hasDialog = Array.from(zoneIntentMap.values()).some((intents) => intents.some((item) => item.nodeHint === 'dialog'));

  if (hasOverlay && !hasPortrait && !hasDialog) {
    return {
      familyId: 'hud-overlay',
      confidence: 0.9,
      reasons: ['偵測到 overlay 類節點，且畫面不是標準詳情或 dialog 結構'],
    };
  }

  if (hasPortrait && (hasTab || zoneIds.some((zoneId) => /summary|bloodline|story|content/.test(zoneId)))) {
    return {
      familyId: 'detail-split',
      confidence: 0.9,
      reasons: ['偵測到 portrait / detail 區塊，且畫面有 detail-split 常見結構'],
    };
  }

  if (hasDialog || (zoneIds.some((zoneId) => zoneId.includes('footer')) && familySet.has('gold-cta'))) {
    return {
      familyId: 'dialog-card',
      confidence: 0.82,
      reasons: ['畫面結構接近 modal / dialog，含 body 與 CTA 組合'],
    };
  }

  if (hasList && (hasTab || hasPreview || zoneIds.some((zoneId) => /grid|list|rail/.test(zoneId)))) {
    return {
      familyId: 'rail-list',
      confidence: 0.88,
      reasons: ['存在清單 / grid 區塊，並帶 tab 或 preview/detail 區塊，符合 rail-list 結構'],
    };
  }

  if (zoneIds.some((zoneId) => /drawer|peek/.test(zoneId))) {
    return {
      familyId: 'peek-drawer',
      confidence: 0.78,
      reasons: ['存在 drawer / peek card 相關區塊'],
    };
  }

  return {
    familyId: '',
    confidence: 0.3,
    reasons: ['無法從目前 proof 穩定推斷 family，需人工決策'],
  };
}

function defaultBundleForFamily(familyId) {
  if (familyId === 'hud-overlay') {
    return 'battle_ui';
  }
  return 'lobby_ui';
}

function defaultLayerForFamily(familyId) {
  switch (familyId) {
    case 'detail-split':
    case 'peek-drawer':
      return 'Popup';
    case 'dialog-card':
      return 'Modal';
    case 'hud-overlay':
      return 'HUD';
    case 'rail-list':
    default:
      return 'Game';
  }
}

function defaultValidationProfileForFamily(familyId) {
  switch (familyId) {
    case 'detail-split':
      return 'detail-split-popup-strict';
    case 'dialog-card':
      return 'dialog-card-popup-strict';
    case 'hud-overlay':
      return 'hud-overlay-strict';
    case 'peek-drawer':
      return 'peek-drawer-standard';
    case 'rail-list':
    default:
      return 'rail-list-game-standard';
  }
}

function defaultGenerationPolicyForFamily(familyId) {
  if (familyId === 'hud-overlay') {
    return 'param-tune';
  }
  return 'reuse-only';
}

function defaultSmokeRoute(proof, familyId) {
  const uiId = String(proof.screenId || '').trim() || 'UIScreen';
  if (familyId === 'detail-split') {
    return `LobbyScene -> open ${uiId} detail popup`;
  }
  if (familyId === 'hud-overlay') {
    return `BattleScene -> attach ${uiId} HUD`;
  }
  return `LobbyScene -> open ${uiId}`;
}

function buildMcqPackage(proof, proofPath) {
  const familyRecommendation = inferFamilyRecommendation(proof);
  const screenBase = screenBaseFromProof(proof.screenId);
  const recipeScreenId = recipeScreenIdFromProof(proof.screenId);

  const questions = [];
  const autoResolved = {
    screenId: recipeScreenId,
    uiId: proof.screenId,
    variantId: `${screenBase}-v1`,
    layoutId: `${screenBase}-main`,
    skinId: `${screenBase}-default`,
    contentSchemaId: `${screenBase}-content`,
    controllerKind: 'composite-panel',
    controllerClass: `${proof.screenId}Composite`,
    mapperClass: `${proof.screenId}Mapper`,
    bindPolicyClass: `${proof.screenId}BindPathPolicy`,
  };

  if (familyRecommendation.familyId && familyRecommendation.confidence >= 0.9) {
    autoResolved.familyId = familyRecommendation.familyId;
  } else {
    questions.push({
      id: 'familyId',
      field: 'familyId',
      prompt: '這張畫面屬於哪個 UCUF family？',
      inputKind: 'single-select',
      required: true,
      recommendedValue: familyRecommendation.familyId || 'rail-list',
      rationale: familyRecommendation.reasons,
      options: FAMILY_OPTIONS,
    });
  }

  const resolvedFamily = autoResolved.familyId || familyRecommendation.familyId || 'rail-list';
  autoResolved.bundle = defaultBundleForFamily(resolvedFamily);
  autoResolved.layer = defaultLayerForFamily(resolvedFamily);
  autoResolved.validationProfile = defaultValidationProfileForFamily(resolvedFamily);

  questions.push({
    id: 'generationPolicy',
    field: 'generationPolicy',
    prompt: '這張畫面目前應走哪種 generation policy？',
    inputKind: 'single-select',
    required: true,
    recommendedValue: defaultGenerationPolicyForFamily(resolvedFamily),
    rationale: ['這個欄位通常牽涉是否要補局部資產或只做參數微調，保留給人類確認'],
    options: GENERATION_POLICY_OPTIONS,
  });

  questions.push({
    id: 'smokeRoute',
    field: 'smokeRoute',
    prompt: '請確認最小 smoke route',
    inputKind: 'text',
    required: true,
    recommendedValue: defaultSmokeRoute(proof, resolvedFamily),
    placeholder: '例如 LobbyScene -> onClickShopMain() -> ShopMainComposite.show()',
    rationale: ['smoke route 常依專案實際入口而異，應由人類或既有 sample 最終確認'],
  });

  const answerTemplate = {
    kind: 'ui-mcq-answer-set',
    version: 1,
    screenId: proof.screenId,
    recipeScreenId,
    answers: Object.fromEntries(questions.map((question) => [question.id, question.recommendedValue || ''])),
  };

  return {
    kind: 'ui-mcq-package',
    version: 1,
    screenId: proof.screenId,
    recipeScreenId,
    proofPath: path.relative(PROJECT_ROOT, proofPath),
    proofSource: proof.proofSource,
    generatedAt: new Date().toISOString(),
    generatedBy: 'GitHubCopilot',
    familyRecommendation,
    autoResolved,
    questions,
    unresolvedFields: questions.map((question) => question.field),
    answerTemplate,
  };
}

function validateMcqPackage(packageJson) {
  const failures = [];
  if (!packageJson || packageJson.kind !== 'ui-mcq-package') {
    failures.push('kind 必須是 ui-mcq-package');
  }
  if (packageJson.version !== 1) {
    failures.push(`version 必須是 1，收到 ${packageJson.version}`);
  }
  if (!packageJson.screenId) {
    failures.push('screenId 不可為空');
  }
  if (!packageJson.autoResolved || typeof packageJson.autoResolved !== 'object') {
    failures.push('autoResolved 必須存在');
  }
  if (!Array.isArray(packageJson.questions)) {
    failures.push('questions 必須是陣列');
  }
  if (!packageJson.answerTemplate || packageJson.answerTemplate.kind !== 'ui-mcq-answer-set') {
    failures.push('answerTemplate 必須存在且 kind=ui-mcq-answer-set');
  }
  if (failures.length > 0) {
    throw new Error(`[ucuf-mcq] MCQ package 驗證失敗:\n- ${failures.join('\n- ')}`);
  }
  return packageJson;
}

function validateAnswerSet(answerSet, mcqPackage) {
  if (!answerSet || answerSet.kind !== 'ui-mcq-answer-set') {
    throw new Error('answer set.kind 必須是 ui-mcq-answer-set');
  }
  if (answerSet.version !== 1) {
    throw new Error(`answer set.version 必須是 1，收到 ${answerSet.version}`);
  }
  if (answerSet.screenId !== mcqPackage.screenId) {
    throw new Error(`answer set.screenId 必須等於 ${mcqPackage.screenId}`);
  }
  if (!answerSet.answers || typeof answerSet.answers !== 'object') {
    throw new Error('answer set.answers 必須存在');
  }
  return answerSet;
}

function buildRecommendedAnswerSet(mcqPackage) {
  return {
    kind: 'ui-mcq-answer-set',
    version: 1,
    screenId: mcqPackage.screenId,
    recipeScreenId: mcqPackage.recipeScreenId,
    answers: { ...(mcqPackage.answerTemplate?.answers || {}) },
  };
}

function matchBindForSlot(slot, proof) {
  const slotKey = String(slot.id || '').toLowerCase();
  const binds = (proof.componentIntents || [])
    .map((intent) => intent.bind)
    .filter((bind) => typeof bind === 'string' && bind.trim().length > 0);

  const direct = binds.find((bind) => bind.toLowerCase().endsWith(`.${slotKey}`) || bind.toLowerCase().includes(slotKey));
  if (direct) {
    return direct;
  }

  if (slot.type === 'list') {
    return binds.find((bind) => bind.endsWith('[]')) || `ui.${slot.id}[]`;
  }

  return `ui.${slot.id}`;
}

function inferDataSourceKind(slotType) {
  switch (slotType) {
    case 'list':
      return 'collection';
    case 'bool':
    case 'enum':
      return 'ui-state';
    case 'number':
      return 'summary';
    case 'image':
    case 'icon':
    case 'label':
    default:
      return 'entity';
  }
}

function inferDataSources(proof) {
  return (proof.contentSlots || [])
    .filter((slot) => slot.type !== 'button')
    .map((slot) => ({
      sourceId: slot.id,
      kind: inferDataSourceKind(slot.type),
      required: !slot.optional,
      bindPath: matchBindForSlot(slot, proof),
      owner: proof.screenId,
      description: slot.placeholder || '',
    }));
}

function chooseDataSourceForZone(intents, dataSources) {
  const binds = intents
    .map((intent) => intent.bind)
    .filter((bind) => typeof bind === 'string' && bind.trim().length > 0);

  const exact = dataSources.find((source) => binds.some((bind) => bind === source.bindPath || bind.startsWith(source.bindPath.replace(/\[\]$/, ''))));
  if (exact) {
    return exact.sourceId;
  }

  if (intents.some((intent) => intent.nodeHint === 'scroll-list' || intent.nodeHint === 'grid')) {
    return (dataSources.find((source) => source.kind === 'collection') || {}).sourceId || '';
  }

  if (binds.length > 0) {
    return dataSources[0] ? dataSources[0].sourceId : '';
  }

  return '';
}

function inferSlotMode(zoneId, intents) {
  if (intents.some((intent) => intent.nodeHint === 'tab-bar')) {
    return 'tab-routed';
  }
  if (intents.some((intent) => intent.nodeHint === 'scroll-list' || intent.nodeHint === 'grid')) {
    return 'list-host';
  }
  if (/header|toolbar|currency/.test(zoneId)) {
    return 'toolbar-host';
  }
  if (/footer|action|cta/.test(zoneId)) {
    return 'footer-host';
  }
  if (/preview|detail|purchase|drawer|panel/.test(zoneId)) {
    return 'preview-host';
  }
  return 'layout-native';
}

function inferRouteKeys(zone, intents) {
  if (!intents.some((intent) => intent.nodeHint === 'tab-bar')) {
    return undefined;
  }
  const note = String(zone.notes || '');
  const candidates = note
    .split(/\||\/|、|,|，/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && /[\u4e00-\u9fffA-Za-z0-9]/.test(item));
  return candidates.length > 0 ? candidates : undefined;
}

function inferSlots(proof, familyId, dataSources) {
  const zoneIntentMap = getZoneIntentMap(proof);

  return (proof.visualZones || []).map((zone) => {
    const zoneId = kebabCase(zone.id);
    const intents = zoneIntentMap.get(zoneId) || [];
    const mode = inferSlotMode(zoneId, intents);
    const slot = {
      slotId: pascalCase(zoneId),
      zoneId: `${familyId}.${zoneId}`,
      mode,
    };

    const dataSource = chooseDataSourceForZone(intents, dataSources);
    if (dataSource) {
      slot.dataSource = dataSource;
    }

    const routeKeys = inferRouteKeys(zone, intents);
    if (routeKeys && routeKeys.length > 0) {
      slot.routeKeys = routeKeys;
    }

    if (!['layout-native', 'toolbar-host', 'footer-host'].includes(mode)) {
      slot.childPanelClass = `${proof.screenId}${pascalCase(zoneId)}Child`;
    }

    return slot;
  });
}

function inferChromeFlags(proof) {
  const zoneIds = (proof.visualZones || []).map((zone) => kebabCase(zone.id));
  const hasButton = (proof.componentIntents || []).some((intent) => intent.nodeHint === 'button');
  const hasInput = (proof.componentIntents || []).some((intent) => intent.nodeHint === 'input');

  return {
    hasPortrait: zoneIds.some((zoneId) => /portrait|hero|emblem/.test(zoneId)),
    hasTopMeta: zoneIds.some((zoneId) => /header|meta|currency/.test(zoneId)),
    hasBottomSummary: zoneIds.some((zoneId) => /summary|bottom/.test(zoneId)),
    hasTabRail: zoneIds.some((zoneId) => zoneId.includes('tab')) || (proof.componentIntents || []).some((intent) => intent.nodeHint === 'tab-bar'),
    hasFooterActions: hasButton,
    hasOverviewSpecialSlot: zoneIds.some((zoneId) => zoneId.includes('overview')),
    hasSearchBar: hasInput || zoneIds.some((zoneId) => zoneId.includes('search')),
    hasSortHeader: zoneIds.some((zoneId) => zoneId.includes('sort')),
    hasLeftRail: zoneIds.some((zoneId) => /left-rail|category|filter/.test(zoneId)),
    hasRightPreview: zoneIds.some((zoneId) => /preview|purchase|detail/.test(zoneId)),
  };
}

function buildRecipeFromMcq(proof, proofPath, mcqPackage, answerSet) {
  validateMcqPackage(mcqPackage);
  validateAnswerSet(answerSet, mcqPackage);

  const answeredFamily = answerSet.answers.familyId || mcqPackage.autoResolved.familyId || mcqPackage.familyRecommendation.familyId || 'rail-list';
  const generationPolicy = answerSet.answers.generationPolicy || defaultGenerationPolicyForFamily(answeredFamily);
  const smokeRoute = answerSet.answers.smokeRoute || defaultSmokeRoute(proof, answeredFamily);
  const screenBase = screenBaseFromProof(proof.screenId);
  const dataSources = inferDataSources(proof);
  const slots = inferSlots(proof, answeredFamily, dataSources);

  const recipe = {
    recipeType: 'screen-recipe',
    recipeVersion: 1,
    screenId: mcqPackage.autoResolved.screenId || recipeScreenIdFromProof(proof.screenId),
    uiId: mcqPackage.autoResolved.uiId || proof.screenId,
    familyId: answeredFamily,
    variantId: mcqPackage.autoResolved.variantId || `${screenBase}-v1`,
    bundle: answerSet.answers.bundle || mcqPackage.autoResolved.bundle || defaultBundleForFamily(answeredFamily),
    layer: answerSet.answers.layer || mcqPackage.autoResolved.layer || defaultLayerForFamily(answeredFamily),
    controllerKind: mcqPackage.autoResolved.controllerKind || 'composite-panel',
    controllerClass: mcqPackage.autoResolved.controllerClass || `${proof.screenId}Composite`,
    layoutId: mcqPackage.autoResolved.layoutId || `${screenBase}-main`,
    skinId: mcqPackage.autoResolved.skinId || `${screenBase}-default`,
    contentSchemaId: mcqPackage.autoResolved.contentSchemaId || `${screenBase}-content`,
    mapperClass: mcqPackage.autoResolved.mapperClass || `${proof.screenId}Mapper`,
    bindPolicyClass: mcqPackage.autoResolved.bindPolicyClass || `${proof.screenId}BindPathPolicy`,
    dataSources,
    slots,
    chromeFlags: inferChromeFlags(proof),
    visualTheme: {
      skinFamily: `${answeredFamily}-default`,
      frameRecipe: mcqPackage.familyRecommendation.familyId === answeredFamily ? `${answeredFamily}-v1` : `${answeredFamily}-default`,
      tokenTheme: (answerSet.answers.bundle || mcqPackage.autoResolved.bundle || defaultBundleForFamily(answeredFamily)) === 'battle_ui' ? 'battle-ink-gold' : 'lobby-ink-gold',
      ornamentPolicy: generationPolicy,
    },
    generationPolicy,
    validationProfile: answerSet.answers.validationProfile || mcqPackage.autoResolved.validationProfile || defaultValidationProfileForFamily(answeredFamily),
    smokeRoute,
  };

  validateRecipe(recipe);

  return {
    recipe,
    metadata: {
      screenBase,
      proofPath: path.relative(PROJECT_ROOT, proofPath),
      answeredFamily,
      questionCount: mcqPackage.questions.length,
    },
  };
}

module.exports = {
  FAMILY_OPTIONS,
  buildProofDraftFromSource,
  buildMcqPackage,
  buildRecipeFromMcq,
  buildRecommendedAnswerSet,
  defaultBundleForFamily,
  defaultGenerationPolicyForFamily,
  defaultLayerForFamily,
  defaultSmokeRoute,
  defaultValidationProfileForFamily,
  inferFamilyFromSource,
  inferFamilyRecommendation,
  kebabCase,
  loadProof,
  normalizeProofSource,
  pascalCase,
  recipeScreenIdFromProof,
  screenBaseFromProof,
  validateAnswerSet,
  validateMcqPackage,
  writeJson,
  readText,
};