#!/usr/bin/env node
/**
 * scaffold-ui-spec-family.js
 *
 * 把新的 UI family 一次落成 layout / skin / screen 三層 JSON 骨架。
 *
 * 使用方式：
 *   node tools_node/scaffold-ui-spec-family.js --family-id relic-codex
 *   node tools_node/scaffold-ui-spec-family.js --family-id bloodline-awakening --ui-id BloodlineAwakening --tabs overview,lineage,ritual
 *   node tools_node/scaffold-ui-spec-family.js --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.dialog-card.json --dry-run
 *   node tools_node/scaffold-ui-spec-family.js --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.rail-list.json --dry-run
 *   node tools_node/scaffold-ui-spec-family.js --family-id spirit-tally-proto --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UI_SPEC_ROOT = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec');
const LAYOUT_DIR = path.join(UI_SPEC_ROOT, 'layouts');
const SKIN_DIR = path.join(UI_SPEC_ROOT, 'skins');
const SCREEN_DIR = path.join(UI_SPEC_ROOT, 'screens');

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/scaffold-ui-spec-family.js --family-id <slug> [options]',
    '',
    '必要參數：',
    '  --family-id       kebab-case family id，例如 spirit-tally-detail',
    '',
    '常用選項：',
    '  --config          讀取 proof-mapping JSON 設定檔，欄位可直接對應 Figma 09_Proof Mapping',
    '  --ui-id           UIManager 用的 UI ID，預設由 family-id 轉成 PascalCase',
    '  --layer           Screen layer，預設 Popup',
    '  --bundle          Screen / skin bundle，預設 lobby_ui',
    '  --atlas-policy    Skin atlas policy，預設 lobby',
    '  --tabs            逗號分隔 tab 名單，預設 overview,details,history',
    '  --rail-items      逗號分隔 rail-list 項目 id，預設 entry-alpha,entry-beta,entry-gamma,entry-delta',
    '  --title-key       標題 i18n key，預設 ui.<family-id>.title',
    '  --body-key        內容 i18n key，預設 <title-key>.body',
    '  --primary-key     主要 CTA i18n key，預設 ui.confirm',
    '  --secondary-key   次要 CTA i18n key，預設 ui.cancel',
    '  --template        目前支援 detail-split, dialog-card, rail-list，預設 detail-split',
    '  --force           允許覆蓋已存在檔案',
    '  --dry-run         只預覽，不寫入檔案',
    '  --help            顯示這份說明'
  ].join('\n'));
}

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || index + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toPascalCase(value) {
  return normalizeSlug(value)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function parseTabs(rawTabs) {
  const fallback = ['overview', 'details', 'history'];
  const tabs = String(rawTabs || '')
    .split(',')
    .map((part) => normalizeSlug(part))
    .filter(Boolean);
  return tabs.length > 0 ? tabs : fallback;
}

function parseRailItems(rawItems) {
  const fallback = ['entry-alpha', 'entry-beta', 'entry-gamma', 'entry-delta'];
  const items = String(rawItems || '')
    .split(',')
    .map((part) => normalizeSlug(part))
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function readJsonConfig(filePath) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(PROJECT_ROOT, filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw);
}

function pickValue(cliValue, configValue, fallback) {
  if (cliValue !== undefined && cliValue !== '') {
    return cliValue;
  }
  if (configValue !== undefined && configValue !== '') {
    return configValue;
  }
  return fallback;
}

function writeJson(filePath, json, dryRun) {
  const content = `${JSON.stringify(json, null, 2)}\n`;
  if (dryRun) {
    console.log(`--- ${path.relative(PROJECT_ROOT, filePath)} ---`);
    console.log(content);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[scaffold-ui-spec-family] 已寫入 ${path.relative(PROJECT_ROOT, filePath)}`);
}

function buildDetailSplitLayout(config) {
  const slotPrefix = config.slotPrefix;
  const tabButtons = config.tabs.map((tab, index) => ({
    type: 'button',
    name: `BtnTab${toPascalCase(tab)}`,
    width: '32%',
    height: 64,
    skinSlot: `${slotPrefix}.tab.${index === 0 ? 'active' : 'idle'}`,
    styleSlot: `${slotPrefix}.label.tab`,
    textKey: `${config.titleKey}.${tab}`,
    active: true
  }));

  const tabPanels = config.tabs.map((tab, index) => ({
    type: 'panel',
    name: `Panel${toPascalCase(tab)}`,
    widget: { top: 0, bottom: 0, left: 0, right: 0 },
    skinSlot: `${slotPrefix}.content.card`,
    active: index === 0,
    children: [
      {
        type: 'container',
        name: 'Content',
        widget: { top: 18, bottom: 18, left: 20, right: 20 },
        layout: { type: 'vertical', spacing: 12, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
        children: [
          {
            type: 'label',
            name: 'SectionTitle',
            width: '100%',
            height: 40,
            styleSlot: `${slotPrefix}.label.section`,
            textKey: `${config.titleKey}.${tab}.section`
          },
          {
            type: 'label',
            name: 'SectionBody',
            width: '100%',
            height: 160,
            skinSlot: `${slotPrefix}.field.bg`,
            styleSlot: `${slotPrefix}.label.body`,
            textKey: `${config.titleKey}.${tab}.body`
          },
          {
            type: 'panel',
            name: 'MetricCard',
            width: '100%',
            height: 120,
            skinSlot: `${slotPrefix}.metric.card`,
            children: [
              {
                type: 'container',
                name: 'Content',
                widget: { top: 16, bottom: 16, left: 18, right: 18 },
                layout: { type: 'vertical', spacing: 8, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                children: [
                  {
                    type: 'label',
                    name: 'MetricTitle',
                    width: '100%',
                    height: 28,
                    styleSlot: `${slotPrefix}.label.meta`,
                    textKey: `${config.titleKey}.${tab}.metric`
                  },
                  {
                    type: 'label',
                    name: 'MetricValue',
                    width: '100%',
                    height: 40,
                    styleSlot: `${slotPrefix}.label.value`,
                    textKey: `${config.titleKey}.${tab}.metricValue`
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }));

  return {
    id: config.layoutId,
    version: 1,
    canvas: {
      fitWidth: true,
      fitHeight: true,
      safeArea: true,
      designWidth: 1920,
      designHeight: 1080
    },
    root: {
      type: 'container',
      name: `${config.uiId}Root`,
      widget: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [
        {
          type: 'image',
          name: 'BackgroundFull',
          widget: { top: 0, bottom: 0, left: 0, right: 0 },
          skinSlot: `${slotPrefix}.bg.full`
        },
        {
          type: 'panel',
          name: 'ClickBlocker',
          widget: { top: 0, bottom: 0, left: 0, right: 0 },
          skinSlot: `${slotPrefix}.overlay.blocker`
        },
        {
          type: 'panel',
          name: 'ShellFill',
          widget: { top: 54, bottom: 54, left: 56, right: 56 },
          skinSlot: `${slotPrefix}.shell.fill`
        },
        {
          type: 'panel',
          name: 'ShellBleed',
          widget: { top: 54, bottom: 54, left: 56, right: 56 },
          skinSlot: `${slotPrefix}.shell.bleed`
        },
        {
          type: 'panel',
          name: 'ShellFrame',
          widget: { top: 54, bottom: 54, left: 56, right: 56 },
          skinSlot: `${slotPrefix}.shell.frame`
        },
        {
          type: 'container',
          name: 'ShellContent',
          widget: { top: 72, bottom: 72, left: 80, right: 80 },
          layout: { type: 'vertical', spacing: 24, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
          children: [
            {
              type: 'container',
              name: 'HeaderRow',
              width: '100%',
              height: 88,
              layout: { type: 'horizontal', spacing: 16, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
              children: [
                {
                  type: 'label',
                  name: 'TitleLabel',
                  width: '78%',
                  height: 88,
                  skinSlot: `${slotPrefix}.header.bg`,
                  styleSlot: `${slotPrefix}.label.title`,
                  textKey: config.titleKey
                },
                {
                  type: 'button',
                  name: 'BtnClose',
                  width: 88,
                  height: 88,
                  skinSlot: `${slotPrefix}.button.close`,
                  textKey: 'ui.close'
                }
              ]
            },
            {
              type: 'container',
              name: 'MainRow',
              width: '100%',
              height: 760,
              layout: { type: 'horizontal', spacing: 24, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
              children: [
                {
                  type: 'container',
                  name: 'LeftRail',
                  width: '36%',
                  height: '100%',
                  layout: { type: 'vertical', spacing: 20, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                  children: [
                    {
                      type: 'panel',
                      name: 'HeroCard',
                      width: '100%',
                      height: 440,
                      skinSlot: `${slotPrefix}.hero.card`,
                      children: [
                        {
                          type: 'image',
                          name: 'HeroPortrait',
                          widget: { top: 18, bottom: 18, left: 18, right: 18 },
                          skinSlot: `${slotPrefix}.hero.portrait`
                        }
                      ]
                    },
                    {
                      type: 'panel',
                      name: 'StoryCard',
                      width: '100%',
                      height: 300,
                      skinSlot: `${slotPrefix}.story.card`,
                      children: [
                        {
                          type: 'container',
                          name: 'Content',
                          widget: { top: 18, bottom: 18, left: 20, right: 20 },
                          layout: { type: 'vertical', spacing: 10, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                          children: [
                            {
                              type: 'label',
                              name: 'StoryTitle',
                              width: '100%',
                              height: 36,
                              styleSlot: `${slotPrefix}.label.section`,
                              textKey: `${config.titleKey}.story`
                            },
                            {
                              type: 'label',
                              name: 'StoryBody',
                              width: '100%',
                              height: 180,
                              skinSlot: `${slotPrefix}.field.bg`,
                              styleSlot: `${slotPrefix}.label.body`,
                              textKey: `${config.titleKey}.storyBody`
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  type: 'container',
                  name: 'RightPanel',
                  width: '64%',
                  height: '100%',
                  layout: { type: 'vertical', spacing: 20, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                  children: [
                    {
                      type: 'panel',
                      name: 'SummaryCard',
                      width: '100%',
                      height: 152,
                      skinSlot: `${slotPrefix}.summary.card`,
                      children: [
                        {
                          type: 'container',
                          name: 'Content',
                          widget: { top: 18, bottom: 18, left: 20, right: 20 },
                          layout: { type: 'vertical', spacing: 8, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                          children: [
                            {
                              type: 'label',
                              name: 'SummaryTitle',
                              width: '100%',
                              height: 32,
                              styleSlot: `${slotPrefix}.label.meta`,
                              textKey: `${config.titleKey}.summary`
                            },
                            {
                              type: 'label',
                              name: 'SummaryValue',
                              width: '100%',
                              height: 48,
                              styleSlot: `${slotPrefix}.label.value`,
                              textKey: `${config.titleKey}.summaryValue`
                            }
                          ]
                        }
                      ]
                    },
                    {
                      type: 'container',
                      name: 'TabBar',
                      width: '100%',
                      height: 64,
                      layout: { type: 'horizontal', spacing: 12, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                      children: tabButtons
                    },
                    {
                      type: 'container',
                      name: 'TabContent',
                      width: '100%',
                      height: 524,
                      children: tabPanels
                    }
                  ]
                }
              ]
            },
            {
              type: 'container',
              name: 'FooterRow',
              width: '100%',
              height: 72,
              layout: { type: 'horizontal', spacing: 16, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
              children: [
                {
                  type: 'button',
                  name: 'BtnPrimary',
                  width: 220,
                  height: 72,
                  skinSlot: `${slotPrefix}.button.primary`,
                  styleSlot: `${slotPrefix}.label.button`,
                  textKey: config.primaryKey
                },
                {
                  type: 'button',
                  name: 'BtnSecondary',
                  width: 220,
                  height: 72,
                  skinSlot: `${slotPrefix}.button.secondary`,
                  styleSlot: `${slotPrefix}.label.button`,
                  textKey: config.secondaryKey
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

function buildDetailSplitSkin(config) {
  const slotPrefix = config.slotPrefix;
  return {
    id: config.skinId,
    version: 1,
    bundle: config.bundle,
    atlasPolicy: config.atlasPolicy,
    slots: {
      [`${slotPrefix}.overlay.blocker`]: { kind: 'color-rect', color: '#00000000' },
      [`${slotPrefix}.bg.full`]: {
        kind: 'sprite-frame',
        path: 'ui-spec/placeholders/bg_ink_main',
        spriteType: 'sliced',
        border: [96, 360, 96, 420],
        allowAutoAtlas: false
      },
      [`${slotPrefix}.shell.fill`]: { kind: 'color-rect', color: '#161310E6' },
      [`${slotPrefix}.shell.bleed`]: { kind: 'color-rect', color: '#B8904A33' },
      [`${slotPrefix}.shell.frame`]: {
        kind: 'sprite-frame',
        path: 'ui-spec/placeholders/bg_ink_detail',
        spriteType: 'sliced',
        border: [96, 96, 96, 96],
        allowAutoAtlas: false
      },
      [`${slotPrefix}.header.bg`]: { kind: 'color-rect', color: '#2A2017CC' },
      [`${slotPrefix}.hero.card`]: { kind: 'color-rect', color: '#201914D9' },
      [`${slotPrefix}.hero.portrait`]: {
        kind: 'sprite-frame',
        path: 'ui-spec/placeholders/bg_ink_detail',
        spriteType: 'sliced',
        border: [96, 96, 96, 96],
        allowAutoAtlas: false
      },
      [`${slotPrefix}.story.card`]: { kind: 'color-rect', color: '#211913E0' },
      [`${slotPrefix}.summary.card`]: { kind: 'color-rect', color: '#251C15E0' },
      [`${slotPrefix}.content.card`]: { kind: 'color-rect', color: '#201813D9' },
      [`${slotPrefix}.metric.card`]: { kind: 'color-rect', color: '#2C2017CC' },
      [`${slotPrefix}.field.bg`]: { kind: 'color-rect', color: '#100D0ACC' },
      [`${slotPrefix}.tab.idle`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_parchment_normal',
        pressed: 'ui-spec/placeholders/btn_parchment_pressed',
        disabled: 'ui-spec/placeholders/btn_parchment_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.tab.active`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_gold_normal',
        pressed: 'ui-spec/placeholders/btn_gold_pressed',
        disabled: 'ui-spec/placeholders/btn_gold_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.button.primary`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_gold_normal',
        pressed: 'ui-spec/placeholders/btn_gold_pressed',
        disabled: 'ui-spec/placeholders/btn_gold_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.button.secondary`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_parchment_normal',
        pressed: 'ui-spec/placeholders/btn_parchment_pressed',
        disabled: 'ui-spec/placeholders/btn_parchment_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.button.close`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_close_normal',
        pressed: 'ui-spec/placeholders/btn_close_pressed',
        disabled: 'ui-spec/placeholders/btn_close_disabled',
        spriteType: 'simple'
      },
      [`${slotPrefix}.label.title`]: {
        kind: 'label-style',
        fontSize: 34,
        lineHeight: 38,
        color: '#F3E4C1',
        isBold: true,
        horizontalAlign: 'LEFT',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.section`]: {
        kind: 'label-style',
        fontSize: 26,
        lineHeight: 30,
        color: '#EAD3A1',
        isBold: true,
        horizontalAlign: 'LEFT',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.meta`]: {
        kind: 'label-style',
        fontSize: 22,
        lineHeight: 28,
        color: '#CBB089',
        horizontalAlign: 'LEFT',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.value`]: {
        kind: 'label-style',
        fontSize: 28,
        lineHeight: 34,
        color: '#FFF4DA',
        isBold: true,
        horizontalAlign: 'LEFT',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.body`]: {
        kind: 'label-style',
        fontSize: 22,
        lineHeight: 32,
        color: '#E6DAC7',
        horizontalAlign: 'LEFT',
        verticalAlign: 'TOP',
        overflow: 'RESIZE_HEIGHT'
      },
      [`${slotPrefix}.label.tab`]: {
        kind: 'label-style',
        fontSize: 22,
        lineHeight: 26,
        color: '#F8EFD7',
        isBold: true,
        horizontalAlign: 'CENTER',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.button`]: {
        kind: 'label-style',
        fontSize: 24,
        lineHeight: 28,
        color: '#2B1A0E',
        isBold: true,
        horizontalAlign: 'CENTER',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      }
    }
  };
}

function buildDialogCardLayout(config) {
  const slotPrefix = config.slotPrefix;

  return {
    id: config.layoutId,
    version: 1,
    canvas: {
      fitWidth: true,
      fitHeight: true,
      safeArea: true,
      designWidth: 1920,
      designHeight: 1080
    },
    root: {
      type: 'container',
      name: `${config.uiId}Root`,
      widget: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [
        {
          type: 'panel',
          name: 'Overlay',
          widget: { top: 0, bottom: 0, left: 0, right: 0 },
          skinSlot: `${slotPrefix}.overlay.mask`
        },
        {
          type: 'panel',
          name: 'DialogFill',
          widget: { hCenter: true, vCenter: true },
          width: 880,
          height: 660,
          skinSlot: `${slotPrefix}.dialog.fill`
        },
        {
          type: 'panel',
          name: 'DialogBleed',
          widget: { hCenter: true, vCenter: true },
          width: 880,
          height: 660,
          skinSlot: `${slotPrefix}.dialog.bleed`
        },
        {
          type: 'panel',
          name: 'DialogFrame',
          widget: { hCenter: true, vCenter: true },
          width: 880,
          height: 660,
          skinSlot: `${slotPrefix}.dialog.frame`
        },
        {
          type: 'container',
          name: 'DialogContent',
          widget: { hCenter: true, vCenter: true },
          width: 880,
          height: 660,
          children: [
            {
              type: 'container',
              name: 'HeaderRow',
              widget: { top: 36, left: 40, right: 40 },
              height: 76,
              layout: { type: 'horizontal', spacing: 16, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
              children: [
                {
                  type: 'label',
                  name: 'TitleLabel',
                  width: '82%',
                  height: 76,
                  styleSlot: `${slotPrefix}.label.title`,
                  textKey: config.titleKey
                },
                {
                  type: 'button',
                  name: 'BtnClose',
                  width: 72,
                  height: 72,
                  skinSlot: `${slotPrefix}.button.close`,
                  textKey: 'ui.close'
                }
              ]
            },
            {
              type: 'panel',
              name: 'BodyCard',
              widget: { top: 132, left: 40, right: 40 },
              height: 320,
              skinSlot: `${slotPrefix}.body.card`,
              children: [
                {
                  type: 'container',
                  name: 'Content',
                  widget: { top: 24, bottom: 24, left: 28, right: 28 },
                  layout: { type: 'vertical', spacing: 12, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                  children: [
                    {
                      type: 'label',
                      name: 'BodyLead',
                      width: '100%',
                      height: 42,
                      styleSlot: `${slotPrefix}.label.section`,
                      textKey: `${config.titleKey}.lead`
                    },
                    {
                      type: 'label',
                      name: 'BodyText',
                      width: '100%',
                      height: 180,
                      skinSlot: `${slotPrefix}.field.bg`,
                      styleSlot: `${slotPrefix}.label.body`,
                      textKey: config.bodyKey
                    }
                  ]
                }
              ]
            },
            {
              type: 'panel',
              name: 'RewardRow',
              widget: { top: 474, left: 40, right: 40 },
              height: 92,
              skinSlot: `${slotPrefix}.reward.card`,
              children: [
                {
                  type: 'container',
                  name: 'Content',
                  widget: { top: 16, bottom: 16, left: 20, right: 20 },
                  layout: { type: 'horizontal', spacing: 12, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                  children: [
                    {
                      type: 'image',
                      name: 'RewardIcon',
                      width: 60,
                      height: 60,
                      skinSlot: `${slotPrefix}.reward.icon`
                    },
                    {
                      type: 'label',
                      name: 'RewardLabel',
                      width: '100%',
                      height: 60,
                      styleSlot: `${slotPrefix}.label.meta`,
                      textKey: `${config.titleKey}.reward`
                    }
                  ]
                }
              ]
            },
            {
              type: 'container',
              name: 'FooterRow',
              widget: { bottom: 36, left: 40, right: 40 },
              height: 72,
              layout: { type: 'horizontal', spacing: 16, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
              children: [
                {
                  type: 'button',
                  name: 'BtnPrimary',
                  width: '48%',
                  height: 72,
                  skinSlot: `${slotPrefix}.button.primary`,
                  styleSlot: `${slotPrefix}.label.button`,
                  textKey: config.primaryKey
                },
                {
                  type: 'button',
                  name: 'BtnSecondary',
                  width: '48%',
                  height: 72,
                  skinSlot: `${slotPrefix}.button.secondary`,
                  styleSlot: `${slotPrefix}.label.button`,
                  textKey: config.secondaryKey
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

function buildDialogCardSkin(config) {
  const slotPrefix = config.slotPrefix;
  return {
    id: config.skinId,
    version: 1,
    bundle: config.bundle,
    atlasPolicy: config.atlasPolicy,
    slots: {
      [`${slotPrefix}.overlay.mask`]: { kind: 'color-rect', color: '#070707A8' },
      [`${slotPrefix}.dialog.fill`]: { kind: 'color-rect', color: '#18130FE8' },
      [`${slotPrefix}.dialog.bleed`]: { kind: 'color-rect', color: '#C19A5633' },
      [`${slotPrefix}.dialog.frame`]: {
        kind: 'sprite-frame',
        path: 'ui-spec/placeholders/bg_ink_detail',
        spriteType: 'sliced',
        border: [96, 96, 96, 96],
        allowAutoAtlas: false
      },
      [`${slotPrefix}.body.card`]: { kind: 'color-rect', color: '#241C16E5' },
      [`${slotPrefix}.reward.card`]: { kind: 'color-rect', color: '#201914D9' },
      [`${slotPrefix}.reward.icon`]: {
        kind: 'sprite-frame',
        path: 'ui-spec/placeholders/btn_default_normal',
        spriteType: 'sliced',
        border: [12, 12, 12, 12],
        allowAutoAtlas: false
      },
      [`${slotPrefix}.field.bg`]: { kind: 'color-rect', color: '#100D0ACC' },
      [`${slotPrefix}.button.primary`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_gold_normal',
        pressed: 'ui-spec/placeholders/btn_gold_pressed',
        disabled: 'ui-spec/placeholders/btn_gold_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.button.secondary`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_parchment_normal',
        pressed: 'ui-spec/placeholders/btn_parchment_pressed',
        disabled: 'ui-spec/placeholders/btn_parchment_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.button.close`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_close_normal',
        pressed: 'ui-spec/placeholders/btn_close_pressed',
        disabled: 'ui-spec/placeholders/btn_close_disabled',
        spriteType: 'simple'
      },
      [`${slotPrefix}.label.title`]: {
        kind: 'label-style',
        fontSize: 34,
        lineHeight: 38,
        color: '#F3E4C1',
        isBold: true,
        horizontalAlign: 'LEFT',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.section`]: {
        kind: 'label-style',
        fontSize: 24,
        lineHeight: 30,
        color: '#EAD3A1',
        isBold: true,
        horizontalAlign: 'LEFT',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.meta`]: {
        kind: 'label-style',
        fontSize: 22,
        lineHeight: 28,
        color: '#D6C2A0',
        horizontalAlign: 'LEFT',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.body`]: {
        kind: 'label-style',
        fontSize: 22,
        lineHeight: 34,
        color: '#E6DAC7',
        horizontalAlign: 'LEFT',
        verticalAlign: 'TOP',
        overflow: 'RESIZE_HEIGHT'
      },
      [`${slotPrefix}.label.button`]: {
        kind: 'label-style',
        fontSize: 24,
        lineHeight: 28,
        color: '#2B1A0E',
        isBold: true,
        horizontalAlign: 'CENTER',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      }
    }
  };
}

function buildRailListLayout(config) {
  const slotPrefix = config.slotPrefix;
  const itemRows = config.railItems.map((item, index) => ({
    type: 'button',
    name: `RailItem${toPascalCase(item)}`,
    width: '100%',
    height: 78,
    skinSlot: `${slotPrefix}.rail.item.${index === 0 ? 'active' : 'idle'}`,
    styleSlot: `${slotPrefix}.label.railItem`,
    textKey: `${config.titleKey}.${item}`,
    active: true
  }));

  return {
    id: config.layoutId,
    version: 1,
    canvas: {
      fitWidth: true,
      fitHeight: true,
      safeArea: true,
      designWidth: 1920,
      designHeight: 1080
    },
    root: {
      type: 'container',
      name: `${config.uiId}Root`,
      widget: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [
        {
          type: 'image',
          name: 'BackgroundFull',
          widget: { top: 0, bottom: 0, left: 0, right: 0 },
          skinSlot: `${slotPrefix}.bg.full`
        },
        {
          type: 'panel',
          name: 'ShellFill',
          widget: { top: 48, bottom: 48, left: 56, right: 56 },
          skinSlot: `${slotPrefix}.shell.fill`
        },
        {
          type: 'panel',
          name: 'ShellBleed',
          widget: { top: 48, bottom: 48, left: 56, right: 56 },
          skinSlot: `${slotPrefix}.shell.bleed`
        },
        {
          type: 'panel',
          name: 'ShellFrame',
          widget: { top: 48, bottom: 48, left: 56, right: 56 },
          skinSlot: `${slotPrefix}.shell.frame`
        },
        {
          type: 'container',
          name: 'ShellContent',
          widget: { top: 72, bottom: 72, left: 80, right: 80 },
          children: [
            {
              type: 'container',
              name: 'HeaderRow',
              widget: { top: 0, left: 0, right: 0 },
              height: 88,
              layout: { type: 'horizontal', spacing: 16, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
              children: [
                {
                  type: 'label',
                  name: 'TitleLabel',
                  width: '82%',
                  height: 88,
                  styleSlot: `${slotPrefix}.label.title`,
                  textKey: config.titleKey
                },
                {
                  type: 'button',
                  name: 'BtnClose',
                  width: 88,
                  height: 88,
                  skinSlot: `${slotPrefix}.button.close`,
                  textKey: 'ui.close'
                }
              ]
            },
            {
              type: 'container',
              name: 'MainRow',
              widget: { top: 120, bottom: 104, left: 0, right: 0 },
              layout: { type: 'horizontal', spacing: 24, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
              children: [
                {
                  type: 'panel',
                  name: 'RailPanel',
                  width: '31%',
                  height: '100%',
                  skinSlot: `${slotPrefix}.rail.panel`,
                  children: [
                    {
                      type: 'container',
                      name: 'Content',
                      widget: { top: 18, bottom: 18, left: 18, right: 18 },
                      layout: { type: 'vertical', spacing: 12, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                      children: [
                        {
                          type: 'label',
                          name: 'RailTitle',
                          width: '100%',
                          height: 40,
                          styleSlot: `${slotPrefix}.label.section`,
                          textKey: `${config.titleKey}.rail`
                        },
                        ...itemRows
                      ]
                    }
                  ]
                },
                {
                  type: 'container',
                  name: 'DetailColumn',
                  width: '69%',
                  height: '100%',
                  layout: { type: 'vertical', spacing: 20, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                  children: [
                    {
                      type: 'panel',
                      name: 'HeroCard',
                      width: '100%',
                      height: 260,
                      skinSlot: `${slotPrefix}.hero.card`,
                      children: [
                        {
                          type: 'image',
                          name: 'HeroPortrait',
                          widget: { top: 18, bottom: 18, left: 18, right: 18 },
                          skinSlot: `${slotPrefix}.hero.portrait`
                        }
                      ]
                    },
                    {
                      type: 'panel',
                      name: 'DetailCard',
                      width: '100%',
                      height: 280,
                      skinSlot: `${slotPrefix}.detail.card`,
                      children: [
                        {
                          type: 'container',
                          name: 'Content',
                          widget: { top: 20, bottom: 20, left: 24, right: 24 },
                          layout: { type: 'vertical', spacing: 10, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                          children: [
                            {
                              type: 'label',
                              name: 'DetailTitle',
                              width: '100%',
                              height: 38,
                              styleSlot: `${slotPrefix}.label.section`,
                              textKey: `${config.titleKey}.detail`
                            },
                            {
                              type: 'label',
                              name: 'DetailBody',
                              width: '100%',
                              height: 160,
                              skinSlot: `${slotPrefix}.field.bg`,
                              styleSlot: `${slotPrefix}.label.body`,
                              textKey: config.bodyKey
                            }
                          ]
                        }
                      ]
                    },
                    {
                      type: 'panel',
                      name: 'ActionBar',
                      width: '100%',
                      height: 96,
                      skinSlot: `${slotPrefix}.action.bar`,
                      children: [
                        {
                          type: 'container',
                          name: 'Content',
                          widget: { top: 12, bottom: 12, left: 16, right: 16 },
                          layout: { type: 'horizontal', spacing: 16, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 },
                          children: [
                            {
                              type: 'button',
                              name: 'BtnPrimary',
                              width: 220,
                              height: 72,
                              skinSlot: `${slotPrefix}.button.primary`,
                              styleSlot: `${slotPrefix}.label.button`,
                              textKey: config.primaryKey
                            },
                            {
                              type: 'button',
                              name: 'BtnSecondary',
                              width: 220,
                              height: 72,
                              skinSlot: `${slotPrefix}.button.secondary`,
                              styleSlot: `${slotPrefix}.label.button`,
                              textKey: config.secondaryKey
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

function buildRailListSkin(config) {
  const slotPrefix = config.slotPrefix;
  return {
    id: config.skinId,
    version: 1,
    bundle: config.bundle,
    atlasPolicy: config.atlasPolicy,
    slots: {
      [`${slotPrefix}.bg.full`]: {
        kind: 'sprite-frame',
        path: 'ui-spec/placeholders/bg_ink_main',
        spriteType: 'sliced',
        border: [96, 360, 96, 420],
        allowAutoAtlas: false
      },
      [`${slotPrefix}.shell.fill`]: { kind: 'color-rect', color: '#161310E6' },
      [`${slotPrefix}.shell.bleed`]: { kind: 'color-rect', color: '#B8904A33' },
      [`${slotPrefix}.shell.frame`]: {
        kind: 'sprite-frame',
        path: 'ui-spec/placeholders/bg_ink_detail',
        spriteType: 'sliced',
        border: [96, 96, 96, 96],
        allowAutoAtlas: false
      },
      [`${slotPrefix}.rail.panel`]: { kind: 'color-rect', color: '#211913E0' },
      [`${slotPrefix}.rail.item.idle`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_parchment_normal',
        pressed: 'ui-spec/placeholders/btn_parchment_pressed',
        disabled: 'ui-spec/placeholders/btn_parchment_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.rail.item.active`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_gold_normal',
        pressed: 'ui-spec/placeholders/btn_gold_pressed',
        disabled: 'ui-spec/placeholders/btn_gold_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.hero.card`]: { kind: 'color-rect', color: '#201914D9' },
      [`${slotPrefix}.hero.portrait`]: {
        kind: 'sprite-frame',
        path: 'ui-spec/placeholders/bg_ink_detail',
        spriteType: 'sliced',
        border: [96, 96, 96, 96],
        allowAutoAtlas: false
      },
      [`${slotPrefix}.detail.card`]: { kind: 'color-rect', color: '#241C16E5' },
      [`${slotPrefix}.action.bar`]: { kind: 'color-rect', color: '#201914D9' },
      [`${slotPrefix}.field.bg`]: { kind: 'color-rect', color: '#100D0ACC' },
      [`${slotPrefix}.button.primary`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_gold_normal',
        pressed: 'ui-spec/placeholders/btn_gold_pressed',
        disabled: 'ui-spec/placeholders/btn_gold_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.button.secondary`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_parchment_normal',
        pressed: 'ui-spec/placeholders/btn_parchment_pressed',
        disabled: 'ui-spec/placeholders/btn_parchment_disabled',
        spriteType: 'sliced',
        border: [12, 12, 12, 12]
      },
      [`${slotPrefix}.button.close`]: {
        kind: 'button-skin',
        normal: 'ui-spec/placeholders/btn_close_normal',
        pressed: 'ui-spec/placeholders/btn_close_pressed',
        disabled: 'ui-spec/placeholders/btn_close_disabled',
        spriteType: 'simple'
      },
      [`${slotPrefix}.label.title`]: {
        kind: 'label-style',
        fontSize: 34,
        lineHeight: 38,
        color: '#F3E4C1',
        isBold: true,
        horizontalAlign: 'LEFT',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.section`]: {
        kind: 'label-style',
        fontSize: 24,
        lineHeight: 30,
        color: '#EAD3A1',
        isBold: true,
        horizontalAlign: 'LEFT',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.railItem`]: {
        kind: 'label-style',
        fontSize: 20,
        lineHeight: 24,
        color: '#F8EFD7',
        isBold: true,
        horizontalAlign: 'CENTER',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.button`]: {
        kind: 'label-style',
        fontSize: 24,
        lineHeight: 28,
        color: '#2B1A0E',
        isBold: true,
        horizontalAlign: 'CENTER',
        verticalAlign: 'CENTER',
        overflow: 'SHRINK'
      },
      [`${slotPrefix}.label.body`]: {
        kind: 'label-style',
        fontSize: 22,
        lineHeight: 34,
        color: '#E6DAC7',
        horizontalAlign: 'LEFT',
        verticalAlign: 'TOP',
        overflow: 'RESIZE_HEIGHT'
      }
    }
  };
}

function buildScreenSpec(config) {
  return {
    id: config.screenId,
    version: 1,
    uiId: config.uiId,
    layer: config.layer,
    bundle: config.bundle,
    layout: config.layoutId,
    skin: config.skinId,
    validation: {
      devices: ['phone-16-9', 'phone-19_5-9', 'tablet-4-3'],
      allowMissingSkin: false
    }
  };
}

function buildScaffold(config) {
  if (config.template === 'detail-split') {
    return {
      layout: buildDetailSplitLayout(config),
      skin: buildDetailSplitSkin(config),
      screen: buildScreenSpec(config)
    };
  }
  if (config.template === 'dialog-card') {
    return {
      layout: buildDialogCardLayout(config),
      skin: buildDialogCardSkin(config),
      screen: buildScreenSpec(config)
    };
  }
  if (config.template === 'rail-list') {
    return {
      layout: buildRailListLayout(config),
      skin: buildRailListSkin(config),
      screen: buildScreenSpec(config)
    };
  }
  throw new Error(`目前只支援 template=detail-split、dialog-card 或 rail-list，收到 ${config.template}`);
}

function main() {
  if (hasFlag('help')) {
    printHelp();
    return;
  }

  const configPath = getArg('config');
  const fileConfig = configPath ? readJsonConfig(configPath) : {};
  const familyId = normalizeSlug(pickValue(getArg('family-id'), fileConfig.familyId, ''));
  if (!familyId) {
    printHelp();
    process.exit(1);
  }

  const defaultTitleKey = `ui.${familyId}.title`;
  const resolvedTitleKey = pickValue(getArg('title-key'), fileConfig.titleKey, defaultTitleKey);
  const config = {
    familyId,
    uiId: pickValue(getArg('ui-id'), fileConfig.uiId, toPascalCase(familyId)),
    layer: pickValue(getArg('layer'), fileConfig.layer, 'Popup'),
    bundle: pickValue(getArg('bundle'), fileConfig.bundle, 'lobby_ui'),
    atlasPolicy: pickValue(getArg('atlas-policy'), fileConfig.atlasPolicy, 'lobby'),
    titleKey: resolvedTitleKey,
    bodyKey: pickValue(getArg('body-key'), fileConfig.bodyKey, `${resolvedTitleKey}.body`),
    primaryKey: pickValue(getArg('primary-key'), fileConfig.primaryKey, 'ui.confirm'),
    secondaryKey: pickValue(getArg('secondary-key'), fileConfig.secondaryKey, 'ui.cancel'),
    template: pickValue(getArg('template'), fileConfig.template, 'detail-split'),
    tabs: parseTabs(pickValue(getArg('tabs'), Array.isArray(fileConfig.tabs) ? fileConfig.tabs.join(',') : fileConfig.tabs, 'overview,details,history')),
    railItems: parseRailItems(pickValue(getArg('rail-items'), Array.isArray(fileConfig.railItems) ? fileConfig.railItems.join(',') : fileConfig.railItems, 'entry-alpha,entry-beta,entry-gamma,entry-delta')),
    dryRun: hasFlag('dry-run'),
    force: hasFlag('force')
  };

  config.layoutId = `${familyId}-main`;
  config.skinId = `${familyId}-default`;
  config.screenId = `${familyId}-screen`;
  config.slotPrefix = familyId.replace(/-/g, '.');

  ensureDir(LAYOUT_DIR);
  ensureDir(SKIN_DIR);
  ensureDir(SCREEN_DIR);

  const layoutPath = path.join(LAYOUT_DIR, `${config.layoutId}.json`);
  const skinPath = path.join(SKIN_DIR, `${config.skinId}.json`);
  const screenPath = path.join(SCREEN_DIR, `${config.screenId}.json`);
  const targets = [layoutPath, skinPath, screenPath];
  const conflicts = targets.filter((filePath) => fs.existsSync(filePath));

  if (conflicts.length > 0 && !config.force) {
    console.error('[scaffold-ui-spec-family] 下列檔案已存在，若要覆蓋請加上 --force：');
    for (const filePath of conflicts) {
      console.error(`- ${path.relative(PROJECT_ROOT, filePath)}`);
    }
    process.exit(1);
  }

  const scaffold = buildScaffold(config);

  console.log(`[scaffold-ui-spec-family] family=${config.familyId} template=${config.template} tabs=${config.tabs.join(',')}`);
  if (config.dryRun) {
    console.log('[scaffold-ui-spec-family] dry-run 模式，不會寫入檔案');
  }

  writeJson(layoutPath, scaffold.layout, config.dryRun);
  writeJson(skinPath, scaffold.skin, config.dryRun);
  writeJson(screenPath, scaffold.screen, config.dryRun);

  if (!config.dryRun) {
    console.log('[scaffold-ui-spec-family] 完成，下一步可執行：');
    console.log('  node tools_node/validate-ui-specs.js');
  }
}

main();
