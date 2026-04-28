// doc_id: doc_other_0009 — CSS transition / keyframes -> Cocos motion draft
'use strict';

const MOTION_TOKENS = {
  instant: { durationMs: 80, easing: 'quadOut', emphasis: 'low' },
  fast: { durationMs: 120, easing: 'quadOut', emphasis: 'low' },
  standard: { durationMs: 180, easing: 'quadOut', emphasis: 'medium' },
  slow: { durationMs: 280, easing: 'cubicOut', emphasis: 'medium' },
  emphasis: { durationMs: 360, easing: 'backOut', emphasis: 'high' },
};

const SUPPORTED_PROPERTIES = new Set(['opacity', 'transform', 'scale', 'translate', 'color', 'background-color']);

function extractKeyframes(styleSheets) {
  const map = new Map();
  for (const sheet of styleSheets || []) {
    const re = /@keyframes\s+([a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\}\s*\}/g;
    let m;
    while ((m = re.exec(sheet)) !== null) {
      const name = m[1];
      const body = m[2] + '}';
      const frames = [];
      const frameRe = /(from|to|\d+%)\s*\{([^{}]*)\}/g;
      let fm;
      while ((fm = frameRe.exec(body)) !== null) {
        frames.push({ at: fm[1], body: fm[2].trim() });
      }
      map.set(name, frames);
    }
  }
  return map;
}

function extractMotion(el, node, style, keyframes) {
  const attrs = (el && el.attrs) || {};
  const nodeName = node && node.name;
  const motions = [];
  const warnings = [];

  if (style && style.transition) {
    const transition = parseTransition(style.transition);
    const token = nearestMotionToken(transition.durationMs);
    const unsupported = transition.properties.filter(p => !isSupportedProperty(p));
    const id = attrs['data-motion-id'] || safeId(`${nodeName}.transition`);
    motions.push({
      id,
      target: nodeName,
      trigger: attrs['data-motion-trigger'] || 'state-change',
      preset: presetForProperties(transition.properties),
      token: token.name,
      durationMs: token.durationMs,
      easing: normalizeEasing(transition.easing, token.easing),
      properties: transition.properties,
      source: 'css-transition',
    });
    if (Math.abs(token.durationMs - transition.durationMs) > 60) {
      warnings.push({ code: 'motion-token-missing', detail: `${nodeName}:${transition.durationMs}ms -> ${token.name}` });
    }
    for (const p of unsupported) {
      warnings.push({ code: 'motion-property-manual-review', detail: `${nodeName}:${p}` });
    }
  }

  const animationName = firstToken(style && (style.animationName || style.animation));
  if (animationName && animationName !== 'none') {
    const frames = keyframes && keyframes.get(animationName);
    const durationMs = parseDuration((style && style.animationDuration) || durationFromAnimation(style && style.animation) || '180ms');
    const token = nearestMotionToken(durationMs);
    if (!frames || frames.length === 0) {
      warnings.push({ code: 'motion-keyframes-missing', detail: `${nodeName}:${animationName}` });
    } else if (frames.length > 3) {
      warnings.push({ code: 'motion-keyframes-manual-rewrite', detail: `${nodeName}:${animationName}:${frames.length}` });
    } else {
      motions.push({
        id: attrs['data-motion-id'] || safeId(`${nodeName}.${animationName}`),
        target: nodeName,
        trigger: attrs['data-motion-trigger'] || 'onShow',
        preset: presetForKeyframes(frames),
        token: token.name,
        durationMs: token.durationMs,
        easing: normalizeEasing(style && style.animationTimingFunction, token.easing),
        properties: collectFrameProperties(frames),
        keyframes: frames,
        source: 'css-keyframes',
      });
    }
  }

  return { motions, warnings };
}

function buildMotionDraft(screenId, motions, warnings) {
  return {
    screenId,
    motionTokens: MOTION_TOKENS,
    motions: dedupe(motions || []),
    warnings: (warnings || []).filter(w => w && /^motion-/.test(w.code || '')),
    summary: {
      motionCount: dedupe(motions || []).length,
      tokenCount: Object.keys(MOTION_TOKENS).length,
      manualRewriteCount: (warnings || []).filter(w => w && /manual|missing/.test(w.code || '')).length,
    },
  };
}

function hasMotionBlockers(motionDraft) {
  return !!(motionDraft && motionDraft.warnings && motionDraft.warnings.some(w => w.code === 'motion-target-missing'));
}

function parseTransition(value) {
  const raw = String(value || '').trim();
  const chunks = raw.split(',').map(s => s.trim()).filter(Boolean);
  const properties = [];
  let durationMs = 180;
  let easing = null;
  for (const chunk of chunks.length ? chunks : ['all 180ms']) {
    const parts = chunk.split(/\s+/).filter(Boolean);
    const prop = parts.find(p => !/^(\d+(?:\.\d+)?m?s|ease|linear|ease-in|ease-out|ease-in-out|cubic-bezier\()/.test(p)) || 'all';
    if (prop === 'all') properties.push('opacity', 'transform'); else properties.push(prop);
    const dur = parts.find(p => /^\d+(?:\.\d+)?m?s$/.test(p));
    if (dur) durationMs = parseDuration(dur);
    const ease = parts.find(p => /^(ease|linear|ease-in|ease-out|ease-in-out|cubic-bezier)/.test(p));
    if (ease) easing = ease;
  }
  return { properties: [...new Set(properties)], durationMs, easing };
}

function parseDuration(value) {
  const m = String(value || '').match(/(\d+(?:\.\d+)?)(ms|s)?/);
  if (!m) return 180;
  const n = parseFloat(m[1]);
  return m[2] === 's' ? Math.round(n * 1000) : Math.round(n);
}

function durationFromAnimation(value) {
  const m = String(value || '').match(/\b\d+(?:\.\d+)?m?s\b/);
  return m ? m[0] : null;
}

function nearestMotionToken(durationMs) {
  let bestName = 'standard';
  let best = MOTION_TOKENS.standard;
  let bestDist = Infinity;
  for (const [name, token] of Object.entries(MOTION_TOKENS)) {
    const dist = Math.abs(token.durationMs - durationMs);
    if (dist < bestDist) { bestName = name; best = token; bestDist = dist; }
  }
  return Object.assign({ name: bestName }, best);
}

function normalizeEasing(raw, fallback) {
  if (!raw) return fallback;
  const v = String(raw).trim();
  if (v === 'linear') return 'linear';
  if (v === 'ease-in') return 'quadIn';
  if (v === 'ease-out' || v === 'ease') return 'quadOut';
  if (v === 'ease-in-out') return 'quadInOut';
  return fallback;
}

function isSupportedProperty(prop) {
  if (SUPPORTED_PROPERTIES.has(prop)) return true;
  return prop === 'all';
}

function presetForProperties(properties) {
  const joined = (properties || []).join(' ');
  if (/opacity/.test(joined) && /transform|scale/.test(joined)) return 'scale-fade';
  if (/opacity/.test(joined)) return 'fade';
  if (/transform|translate/.test(joined)) return 'slide';
  if (/color/.test(joined)) return 'tint';
  return 'custom-motion';
}

function presetForKeyframes(frames) {
  const props = collectFrameProperties(frames).join(' ');
  return presetForProperties(props.split(/\s+/));
}

function collectFrameProperties(frames) {
  const set = new Set();
  for (const frame of frames || []) {
    const re = /([a-z-]+)\s*:/g;
    let m;
    while ((m = re.exec(frame.body || '')) !== null) set.add(m[1]);
  }
  return [...set];
}

function firstToken(value) {
  return String(value || '').split(/[\s,]+/).filter(Boolean)[0] || null;
}

function dedupe(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = item.id || JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function safeId(value) {
  return String(value || 'motion')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  MOTION_TOKENS,
  extractKeyframes,
  extractMotion,
  buildMotionDraft,
  hasMotionBlockers,
  nearestMotionToken,
};