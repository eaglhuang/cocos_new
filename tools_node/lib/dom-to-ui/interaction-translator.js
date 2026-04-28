// doc_id: doc_other_0009 — declarative HTML interaction -> UCUF interaction draft
'use strict';

function extractInteraction(el, node, opts) {
  const attrs = (el && el.attrs) || {};
  const tag = el && el.tag;
  const nodeName = node && node.name;
  const warnings = [];
  const actions = [];

  if (attrs.onclick) {
    warnings.push({
      code: 'manual-adapter-required',
      detail: `${nodeName}: inline onclick is not executed; rewrite as data-ucuf-action`,
    });
  }

  let type = attrs['data-ucuf-action'] || attrs['data-action'] || null;
  let target = attrs['data-target'] || attrs['data-open-panel'] || attrs['aria-controls'] || hrefTarget(attrs.href);
  if (!type && attrs['data-open-panel']) type = 'openPanel';
  if (!type && attrs['data-tab']) type = 'tabSwitch';
  if (!type && (attrs.role === 'tab' || attrs['aria-selected'] != null)) type = 'tabSwitch';
  if (!type && tag === 'button' && target) type = 'openPanel';
  if (!type && tag === 'a' && target) type = 'routePush';
  if (!type && (tag === 'dialog' || attrs.role === 'dialog')) type = 'dialogRoot';
  if (type === 'close' || type === 'closeModal' || attrs['data-close']) {
    type = 'closeModal';
    target = target || attrs['data-close'] || 'self';
  }
  if (type === 'open' || type === 'open-panel') type = 'openPanel';
  if (type === 'tab' || type === 'tab-switch') type = 'tabSwitch';
  if (type === 'route' || type === 'push') type = 'routePush';

  if (type && type !== 'dialogRoot') {
    const id = attrs['data-interaction-id'] || safeId(`${nodeName}.${type}`);
    const action = {
      id,
      trigger: nodeName,
      event: attrs['data-event'] || 'click',
      type,
      target: target || attrs['data-tab'] || null,
      requires: splitList(attrs['data-requires']),
      smoke: buildSmoke(type, target || attrs['data-tab']),
    };
    actions.push(action);
    if (!action.target && requiresTarget(type)) {
      warnings.push({ code: 'interaction-target-missing', detail: `${nodeName}:${type}` });
    }
  }

  if (type === 'dialogRoot') {
    actions.push({
      id: attrs['data-interaction-id'] || safeId(`${nodeName}.dialogRoot`),
      trigger: nodeName,
      event: 'mount',
      type: 'dialogRoot',
      target: nodeName,
      requires: [],
      smoke: { expectNodeVisible: nodeName },
    });
  }

  return { actions, warnings };
}

function buildInteractionDraft(screenId, actions, warnings) {
  const unique = [];
  const seen = new Set();
  for (const a of actions || []) {
    const key = a.id || JSON.stringify(a);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(a);
  }
  return {
    screenId,
    actions: unique,
    warnings: (warnings || []).filter(w => w && /^interaction-|manual-adapter/.test(w.code || '')),
    summary: {
      actionCount: unique.length,
      missingTargetCount: (warnings || []).filter(w => w && w.code === 'interaction-target-missing').length,
      manualAdapterCount: (warnings || []).filter(w => w && w.code === 'manual-adapter-required').length,
    },
  };
}

function hasInteractionBlockers(interactionDraft) {
  return !!(interactionDraft && interactionDraft.warnings && interactionDraft.warnings.some(w => w.code === 'interaction-target-missing'));
}

function hrefTarget(href) {
  if (!href) return null;
  const raw = String(href).trim();
  return raw.startsWith('#') && raw.length > 1 ? raw.slice(1) : null;
}

function splitList(value) {
  if (!value) return [];
  return String(value).split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
}

function requiresTarget(type) {
  return type === 'openPanel' || type === 'tabSwitch' || type === 'routePush';
}

function buildSmoke(type, target) {
  if (type === 'openPanel') return { expectPanelVisible: target || null };
  if (type === 'tabSwitch') return { expectActiveTab: target || null };
  if (type === 'routePush') return { expectRouteTarget: target || null };
  if (type === 'closeModal') return { expectPanelClosed: target || 'self' };
  return {};
}

function safeId(value) {
  return String(value || 'interaction')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  extractInteraction,
  buildInteractionDraft,
  hasInteractionBlockers,
};