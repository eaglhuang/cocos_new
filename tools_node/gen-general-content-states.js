/**
 * gen-general-content-states.js
 * 從 generals.json 自動產生 general-detail-overview-states-v1.json 的 states 欄位。
 * 執行：node tools_node/gen-general-content-states.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { resolveRarityTier, loadThresholds } = require('./lib/rarity-resolver');

loadThresholds(); // 載入 rarity-thresholds.json 門檻（若存在）

const GENERALS_PATH   = path.join(__dirname, '..', 'assets', 'resources', 'data', 'generals.json');
const STATES_PATH     = path.join(__dirname, '..', 'assets', 'resources', 'ui-spec', 'content', 'general-detail-overview-states-v1.json');

// ── 與 Mapper 相同的輔助函數（Node.js 版本） ────────────────────────────────────

const FACTION_DISPLAY = { player: '蜀漢', enemy: '敵軍' };
const ROLE_DISPLAY    = { Combat: '先鋒', Support: '支援', Hybrid: '全能' };
const STATUS_DISPLAY  = { Active: '活躍', Young: '少壯', Retired: '退隱', Injured: '負傷' };
const TERRAIN_DISPLAY = {
    plain: '平原', river: '河岸', mountain: '山地',
    fortress: '城塞', desert: '荒漠', forest: '林地', water: '水域',
};
const CREST_TITLE = {
    placeholder: '命紋待啟', rumored: '命紋傳聞',
    revealed: '命紋顯現', awakened: '命紋覺醒',
};
const RARITY_LABEL = {
    mythic: 'UR / 神話', legendary: 'SSR / 傳說',
    epic: 'SR / 史詩', rare: 'R / 稀有', common: 'N / 常規',
};

function fmt(v, fb) { return (v !== undefined && v !== '') ? `${v}` : fb; }

function shorten(text, max) {
    if (!text) return '';
    // 中文字可能是多字節，但本專案目標 JS 引擎均以 UTF-16 計 length
    return text.length > max ? text.slice(0, max) : text;
}

function stat(g, k) {
    return g.stats?.[k] ?? g[k] ?? 0;
}

function fmtStat(v) { return v ? `${v}` : '--'; }

function resolveCrestState(g) {
    if (g.crestState) return g.crestState;
    if (g.awakeningTitle && g.ep >= 90) return 'awakened';
    if (g.bloodlineRumor) return 'rumored';
    if (g.bloodlineId)    return 'revealed';
    return 'placeholder';
}

function buildCoreStatsValue(g) {
    const s = (k) => fmtStat(stat(g, k));
    return `武 ${s('str')} / 統 ${s('lea')} / 魅 ${s('cha')}\n智 ${s('int')} / 政 ${s('pol')} / 運 ${s('luk')}`;
}

function buildRoleValue(g) {
    const byScore = [
        { k: '前排突破', v: stat(g,'str') },
        { k: '破陣主攻', v: stat(g,'lea') },
        { k: '策應補位', v: stat(g,'int') },
    ].sort((a,b)=>b.v-a.v);
    return byScore.slice(0,2).map(x=>x.k).join('\n');
}

function buildTraitValue(g) {
    const maxSp = g.maxSp ?? 100;
    const curSp = g.currentSp ?? g.initialSp ?? 0;
    const parts = [];
    if (g.skillId) {
        parts.push(curSp >= maxSp ? '列陣直進' : `戰意回填 ${curSp}/${maxSp}`);
    }
    if (g.preferredTerrain) {
        parts.push(`地形適應 ${TERRAIN_DISPLAY[g.preferredTerrain] ?? g.preferredTerrain}`);
    }
    if (g.attackBonus > 0) {
        parts.push(`衝鋒增傷 +${Math.floor(g.attackBonus * 100)}%`);
    }
    return parts.slice(0,2).join('\n') || '氣質描述待補';
}

function buildBloodlineBody(g) {
    const lines = [];
    const parentLine  = shorten(g.parentsSummary, 12);
    const ancestorLine = shorten(g.ancestorsSummary, 12);
    // 使用 bloodlineRumor 作為傳說印象行（最多 18 字）
    const rumor = shorten(g.bloodlineRumor, 18);
    if (parentLine)  lines.push(`父脈：${parentLine}`);
    if (ancestorLine) lines.push(`祖脈：${ancestorLine}`);
    if (rumor)        lines.push(`傳說：${rumor}`);
    return lines.slice(0,3).join('\n');
}

function buildCrestHint(g, crestState) {
    if (g.crestHint) return shorten(g.crestHint, 26);
    switch (crestState) {
        case 'awakened': return '命紋已與祖脈共鳴，外圈與中紋同步亮起。';
        case 'revealed': return '命紋輪廓已清晰浮現，仍保留一層內斂霧光。';
        case 'rumored':  return '僅能辨識輪廓與玉印氣息，細節仍待驗證。';
        default:         return '命紋尚未顯形。';
    }
}

function buildStoryCells(g) {
    const cells = {};
    const SLOTS = ['origin','faction','role','awakening','bloodline','future'];
    // 使用 generals.json 中的 storyStripCells（最多 15 字）
    const cellMap = new Map((g.storyStripCells ?? []).map(c => [c.slot, c.text]));
    for (const slot of SLOTS) {
        cells[slot] = shorten(cellMap.get(slot) ?? '', 15);
    }
    return cells;
}

function buildCrestGlyphPrimary(g, crestState) {
    // 從 awakeningTitle 取第一字，或用血脈/輪廓字
    const title = g.awakeningTitle || '';
    return title.charAt(0) || (crestState === 'awakened' ? '覺' : '命');
}

function buildCrestGlyphSecondary(g) {
    // 血脈 ID 後綴，或 awakeningTitle
    if (g.bloodlineId) {
        return g.bloodlineId.replace(/^BL_[A-Z]+_/, '').replace(/_/g,' ').slice(0,8);
    }
    return shorten(g.awakeningTitle, 8) || '祖紋';
}

function buildPersonalityValue(g) {
    const p = shorten(g.parentsSummary, 14);
    if (p) return p;
    if (g.epRating) return `EP 評級 ${g.epRating}`;
    return '豪烈直進 / 正面破敵';
}

function buildAwakeningProgress(ep) {
    if (ep === undefined) return 0.35;
    return Math.max(0.08, Math.min(1, ep / 100));
}

function buildStateKey(g) {
    // smoke-zhang-fei 格式
    return `smoke-${g.id}`;
}

// ── 主程式 ──────────────────────────────────────────────────────────────────────

function main() {
    const generals = JSON.parse(fs.readFileSync(GENERALS_PATH, 'utf8'));

    const existingFile = JSON.parse(fs.readFileSync(STATES_PATH, 'utf8'));
    const newStates = {};

    for (const g of generals) {
        const key        = buildStateKey(g);
        const rarity     = resolveRarityTier(g);
        const crestState = resolveCrestState(g);
        const coreStats  = buildCoreStatsValue(g);
        const roleVal    = buildRoleValue(g);
        const traitVal   = buildTraitValue(g);
        const bloodBody  = buildBloodlineBody(g);
        const crestHint  = buildCrestHint(g, crestState);
        const storyCells = buildStoryCells(g);
        const factionLabel = FACTION_DISPLAY[g.faction] ?? g.faction ?? '陣營未定';
        const roleLabel    = ROLE_DISPLAY[g.role]       ?? g.role      ?? '定位未定';
        const statusLabel  = STATUS_DISPLAY[g.status]   ?? g.status    ?? '狀態未定';

        newStates[key] = {
            headerTitle:           fmt(g.title, '武將'),
            headerName:            fmt(g.name, g.id),
            headerMeta:            `${factionLabel} | ${roleLabel} | ${statusLabel}`,
            portraitModeHint:      '總覽模式 / 血脈命鏡',
            overviewModeBadgeLabel:'血脈總覽',
            coreStatsTitle:        '核心屬性',
            coreStatsValue:        coreStats,
            roleTitle:             '戰場定位',
            roleValue:             roleVal,
            traitTitle:            '性格氣質',
            traitValue:            traitVal,
            bloodlineTitle:        '血脈識別',
            bloodlineName:         fmt(g.bloodlineId?.replace(/^BL_[A-Z]+_/,'').replace(/_/g,' '), '未鑑定血脈'),
            awakeningLabel:        `覺醒方向｜${fmt(g.awakeningTitle, '覺醒傾向')}`,
            awakeningProgress:     buildAwakeningProgress(g.ep),
            personalityLabel:      '血脈性格',
            personalityValue:      buildPersonalityValue(g),
            bloodlineCardTitle:    '血脈摘要',
            bloodlineBody:         bloodBody,
            crestTitle:            CREST_TITLE[crestState],
            crestHint:             crestHint,
            crestState:            crestState,
            crestGlyphPrimary:     buildCrestGlyphPrimary(g, crestState),
            crestGlyphSecondary:   buildCrestGlyphSecondary(g),
            crestFaceResource:     'sprites/ui_families/general_detail/crest/proof/dragon_medallion_face_v1',
            storyCells:            storyCells,
            rarityLabel:           RARITY_LABEL[rarity] ?? 'N / 常規',
            rarityTier:            rarity,
            portraitResource:      `sprites/generals/${g.id.replace(/-/g,'_')}_portrait`,
        };

        console.log(`[gen] ${key} → rarityTier=${rarity}, crestState=${crestState}`);
    }

    const output = {
        id: existingFile.id,
        version: (existingFile.version ?? 2) + 1,
        states: newStates,
    };

    fs.writeFileSync(STATES_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`\n[done] Wrote ${Object.keys(newStates).length} states to ${STATES_PATH}`);
    console.log(`[info] version bumped to ${output.version}`);
}

main();
