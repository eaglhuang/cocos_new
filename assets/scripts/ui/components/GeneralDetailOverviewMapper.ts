import type {
    GeneralConfig,
    GeneralDetailCrestState,
    GeneralDetailRarityTier,
    GeneralDetailStoryCellConfig,
    GeneralDetailStorySlot,
    GeneralStatsConfig,
    CharacterCategory,
} from '../../core/models/GeneralUnit';

export interface GeneralDetailOverviewData {
    header: {
        title: string;
        name: string;
        meta: string;
    };
    summary: {
        epValue: string;
        vitalityValue: string;
    };
    cards: {
        coreStatsSummary: string;
        roleSummary: string;
        traitSummary: string;
        bloodlineTitle: string;
        bloodlineName: string;
        awakeningLabel: string;
        awakeningProgress: number;
        personalityValue: string;
        bloodlineBody: string;
        crestTitle: string;
        crestHint: string;
        crestState: GeneralDetailCrestState;
        storyCells: GeneralDetailStoryCellConfig[];
    };
}

export interface GeneralDetailOverviewContentState {
    headerTitle: string;
    headerName: string;
    headerMeta: string;
    rarityLabel: string;
    rarityTier: GeneralDetailRarityTier;
    portraitModeHint: string;
    overviewModeBadgeLabel: string;
    coreStatsTitle: string;
    coreStatsValue: string;
    roleTitle: string;
    roleValue: string;
    traitTitle: string;
    traitValue: string;
    bloodlineTitle: string;
    bloodlineName: string;
    awakeningLabel: string;
    awakeningProgress: number;
    personalityLabel: string;
    personalityValue: string;
    bloodlineCardTitle: string;
    bloodlineBody: string;
    crestTitle: string;
    crestHint: string;
    crestState: GeneralDetailCrestState;
    crestFaceResource?: string;
    crestGlyphPrimary: string;
    crestGlyphSecondary: string;
    storyCells: Record<GeneralDetailStorySlot, string>;
    portraitResource: string;
}

const STORY_SLOT_ORDER: GeneralDetailStorySlot[] = [
    'origin',
    'faction',
    'role',
    'awakening',
    'bloodline',
    'future',
];

const STORY_SLOT_FALLBACK: Record<GeneralDetailStorySlot, (config: GeneralConfig) => string> = {
    origin: (config) => shortenText(config.historicalAnecdote, 10) || shortenText(config.title, 8) || '出身',
    faction: (config) => shortenText(config.source, 10) || formatFaction(config.faction),
    role: (config) => buildRoleSummary(resolveStat(config, 'str'), resolveStat(config, 'int'), resolveStat(config, 'lea')),
    awakening: (config) => shortenText(config.awakeningTitle, 10) || '覺醒',
    bloodline: (config) => shortenText(config.bloodlineRumor, 10) || formatBloodlineDisplayName(config.bloodlineId, '血脈'),
    future: (config) => formatRole(config.role),
};

const FACTION_DISPLAY: Record<string, string> = {
    player: '蜀漢',
    enemy: '敵軍',
};

const ROLE_DISPLAY: Record<string, string> = {
    Combat: '先鋒',
    Support: '支援',
    Hybrid: '全能',
};

const STATUS_DISPLAY: Record<string, string> = {
    Active: '活躍',
    Young: '少壯',
    Retired: '退隱',
    Injured: '負傷',
};

const TERRAIN_DISPLAY: Record<string, string> = {
    plain: '平原',
    river: '河岸',
    mountain: '山地',
    fortress: '城塞',
    desert: '荒漠',
    forest: '林地',
    water: '水域',
};

const CREST_TITLE_DISPLAY: Record<GeneralDetailCrestState, string> = {
    placeholder: '命紋待啟',
    rumored: '命紋傳聞',
    revealed: '命紋顯現',
    awakened: '命紋覺醒',
};

export function buildGeneralDetailOverview(config: GeneralConfig): GeneralDetailOverviewData {
    const str = resolveStat(config, 'str');
    const int = resolveStat(config, 'int');
    const lea = resolveStat(config, 'lea');
    const pol = resolveStat(config, 'pol');
    const cha = resolveStat(config, 'cha');
    const luk = resolveStat(config, 'luk');
    const maxSp = config.maxSp ?? 100;
    const currentSp = config.currentSp ?? config.initialSp ?? 0;
    const crestState = resolveCrestState(config);

    return {
        header: {
            title: mask(config.title, '燕人猛將'),
            name: mask(config.name, '張飛'),
            meta: buildHeaderMeta(config),
        },
        summary: {
            epValue: config.ep !== undefined
                ? `${config.ep}${config.epRating ? ` / ${config.epRating}` : ''}`
                : 'EP 未定',
            vitalityValue: config.vitality !== undefined && config.maxVitality !== undefined
                ? `${config.vitality} / ${config.maxVitality}`
                : '命力未定',
        },
        cards: {
            coreStatsSummary: [
                `武 ${formatStatValue(str)}`,
                `統 ${formatStatValue(lea)}`,
                `魅 ${formatStatValue(cha)}`,
                `智 ${formatStatValue(int)}`,
                `政 ${formatStatValue(pol)}`,
                `運 ${formatStatValue(luk)}`,
            ].join(' / '),
            roleSummary: buildRoleSummary(str, int, lea),
            traitSummary: buildTraitSummary(config, currentSp, maxSp),
            bloodlineTitle: '血脈概覽',
            bloodlineName: formatBloodlineDisplayName(config.bloodlineId, '震雷先鋒'),
            awakeningLabel: '覺醒傾向',
            awakeningProgress: resolveAwakeningProgress(config.ep),
            personalityValue: buildPersonalitySummary(config),
            bloodlineBody: buildBloodlineBody(config),
            crestTitle: CREST_TITLE_DISPLAY[crestState],
            crestHint: buildCrestHint(config, crestState),
            crestState,
            storyCells: buildStoryCells(config),
        },
    };
}

export function buildGeneralDetailOverviewContentState(config: GeneralConfig): GeneralDetailOverviewContentState {
    const overview = buildGeneralDetailOverview(config);
    return {
        headerTitle: overview.header.title,
        headerName: overview.header.name,
        headerMeta: overview.header.meta,
        rarityLabel: resolveRarityLabel(config),
        rarityTier: resolveRarityTier(config),
        portraitModeHint: '總覽模式 / 血脈命鏡',
        overviewModeBadgeLabel: '血脈總覽',
        coreStatsTitle: '核心屬性',
        coreStatsValue: overview.cards.coreStatsSummary,
        roleTitle: '戰場定位',
        roleValue: overview.cards.roleSummary,
        traitTitle: '性格氣質',
        traitValue: overview.cards.traitSummary,
        bloodlineTitle: overview.cards.bloodlineTitle,
        bloodlineName: overview.cards.bloodlineName,
        awakeningLabel: overview.cards.awakeningLabel,
        awakeningProgress: overview.cards.awakeningProgress,
        personalityLabel: '血脈性格',
        personalityValue: overview.cards.personalityValue,
        bloodlineCardTitle: '血脈',
        bloodlineBody: overview.cards.bloodlineBody,
        crestTitle: overview.cards.crestTitle,
        crestHint: overview.cards.crestHint,
        crestState: overview.cards.crestState,
        crestFaceResource: 'sprites/ui_families/general_detail/crest/proof/dragon_medallion_face_v1',
        crestGlyphPrimary: buildCrestGlyphPrimary(config),
        crestGlyphSecondary: buildCrestGlyphSecondary(config),
        storyCells: storyCellsToRecord(overview.cards.storyCells),
        portraitResource: `sprites/generals/${config.id.replace(/-/g, '_')}_portrait`,
    };
}

function resolveStat(config: GeneralConfig, key: keyof GeneralStatsConfig): number | undefined {
    const nested = config.stats?.[key];
    if (nested !== undefined) {
        return nested;
    }
    return config[key as keyof GeneralConfig] as number | undefined;
}

function formatStatValue(value: number | undefined): string {
    return value !== undefined ? `${value}` : '--';
}

function formatFaction(faction: string | undefined): string {
    if (!faction) return '陣營未定';
    return FACTION_DISPLAY[faction] ?? faction;
}

function formatRole(role: string | undefined): string {
    if (!role) return '定位未定';
    return ROLE_DISPLAY[role] ?? role;
}

function formatStatus(status: string | undefined): string {
    if (!status) return '狀態未定';
    return STATUS_DISPLAY[status] ?? status;
}

function buildHeaderMeta(config: GeneralConfig): string {
    const faction = formatFaction(config.faction);
    const role = formatRole(config.role);
    const status = config.status ? formatStatus(config.status) : '';
    const compact = [faction, role].filter((part) => part !== '' && !part.includes('未定'));

    if (compact.length > 0) {
        return compact.join('．');
    }

    if (status && !status.includes('未定')) {
        return status;
    }

    return '血脈總覽';
}

function buildRoleSummary(str?: number, int?: number, lea?: number): string {
    const values = [
        { key: '前排突破', value: str ?? -1 },
        { key: '破陣主攻', value: lea ?? -1 },
        { key: '策應補位', value: int ?? -1 },
    ].sort((left, right) => right.value - left.value);

    if (values[0].value < 0) {
        return '定位未定';
    }

    return values.slice(0, 2).map((item) => item.key).join(' / ');
}

function buildTraitSummary(config: GeneralConfig, currentSp: number, maxSp: number): string {
    const parts: string[] = [];

    if (config.skillId) {
        parts.push(currentSp >= maxSp ? '列陣直進' : `戰意回填 ${currentSp}/${maxSp}`);
    }

    if (config.preferredTerrain) {
        parts.push(`地形適應 ${TERRAIN_DISPLAY[config.preferredTerrain] ?? config.preferredTerrain}`);
    }

    if (config.attackBonus !== undefined && config.attackBonus > 0) {
        parts.push(`衝鋒增傷 +${Math.floor(config.attackBonus * 100)}%`);
    }

    if (parts.length === 0) {
        return '氣質描述待補';
    }

    return parts.slice(0, 2).join('\n');
}

function buildPersonalitySummary(config: GeneralConfig): string {
    const shortPersonality = shortenText(config.parentsSummary, 14);
    if (shortPersonality) {
        return shortPersonality;
    }
    if (config.epRating) {
        return `EP 評級 ${config.epRating}`;
    }
    return '豪烈直進 / 正面破敵';
}

function buildBloodlineBody(config: GeneralConfig): string {
    const lines: string[] = [];

    const parentLine = shortenText(config.parentsSummary, 12);
    const ancestorLine = shortenText(config.ancestorsSummary, 12);
    const impressionLine = shortenText(config.bloodlineRumor || config.historicalAnecdote, 14);

    if (parentLine) {
        lines.push(`父脈：${parentLine}`);
    }

    if (ancestorLine) {
        lines.push(`祖脈：${ancestorLine}`);
    }

    if (impressionLine) {
        lines.push(`印象：${impressionLine}`);
    }

    return lines.slice(0, 2).join('\n');
}

function resolveCrestState(config: GeneralConfig): GeneralDetailCrestState {
    if (config.crestState) {
        return config.crestState;
    }
    if (config.awakeningTitle && config.ep !== undefined && config.ep >= 90) {
        return 'awakened';
    }
    if (config.bloodlineRumor) {
        return 'rumored';
    }
    if (config.bloodlineId) {
        return 'revealed';
    }
    return 'placeholder';
}

function buildCrestHint(config: GeneralConfig, crestState: GeneralDetailCrestState): string {
    if (config.crestHint) {
        return shortenText(config.crestHint, 26);
    }

    switch (crestState) {
        case 'awakened':
            return '命紋已與祖脈共鳴，外圈與中紋同步亮起。';
        case 'revealed':
            return '命紋輪廓已清晰浮現，仍保留一層內斂霧光。';
        case 'rumored':
            return '僅能辨識輪廓與玉印氣息，細節仍待驗證。';
        default:
            return '命紋尚未顯形。';
    }
}

function buildStoryCells(config: GeneralConfig): GeneralDetailStoryCellConfig[] {
    const explicitCells = new Map<GeneralDetailStorySlot, string>();

    for (const cell of config.storyStripCells ?? []) {
        if (cell.slot && cell.text) {
            explicitCells.set(cell.slot, shortenText(cell.text, 15));
        }
    }

    return STORY_SLOT_ORDER.map((slot) => ({
        slot,
        text: explicitCells.get(slot) ?? STORY_SLOT_FALLBACK[slot](config),
    }));
}

function resolveAwakeningProgress(ep: number | undefined): number {
    if (ep === undefined) {
        return 0.35;
    }
    return Math.max(0.08, Math.min(1, ep / 100));
}

function resolveRarityTier(config: GeneralConfig): GeneralDetailRarityTier {
    // 手動指定永遠最高優先
    if (config.rarityTier) {
        return config.rarityTier;
    }

    // 角色分類 override：神話 → mythic，稱號特殊 → legendary
    const cat = config.characterCategory;
    if (cat === 'mythical') return 'mythic';
    if (cat === 'titled') return 'legendary';

    // 雙軸自動判定：maxStat 軸 + avg5 軸，取較高 tier
    const stats = [
        config.str ?? config.stats?.str ?? 0,
        config.int ?? config.stats?.int ?? 0,
        config.lea ?? config.stats?.lea ?? 0,
        config.pol ?? config.stats?.pol ?? 0,
        config.cha ?? config.stats?.cha ?? 0,
    ];
    const maxStat = Math.max(...stats);
    const avg5 = stats.reduce((s, v) => s + v, 0) / (stats.length || 1);

    // 若五維全為 0（資料尚未填入），fallback 用 EP
    if (maxStat === 0) {
        return resolveRarityTierByEp(config.ep ?? 0);
    }

    const tierFromMax = statToTier(maxStat, 95, 80, 65);
    const tierFromAvg = statToTier(avg5, 80, 65, 50);
    return higherTier(tierFromMax, tierFromAvg);
}

/** EP-based fallback（相容原有資料） */
function resolveRarityTierByEp(ep: number): GeneralDetailRarityTier {
    if (ep >= 90) return 'legendary';
    if (ep >= 75) return 'epic';
    if (ep >= 60) return 'rare';
    return 'common';
}

const TIER_RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };

function statToTier(value: number, legendary: number, epic: number, rare: number): GeneralDetailRarityTier {
    if (value >= legendary) return 'legendary';
    if (value >= epic) return 'epic';
    if (value >= rare) return 'rare';
    return 'common';
}

function higherTier(a: GeneralDetailRarityTier, b: GeneralDetailRarityTier): GeneralDetailRarityTier {
    return (TIER_RANK[a] ?? 0) >= (TIER_RANK[b] ?? 0) ? a : b;
}

function resolveRarityLabel(config: GeneralConfig): string {
    if (config.rarityLabel) {
        return config.rarityLabel;
    }

    switch (resolveRarityTier(config)) {
        case 'mythic':
            return 'UR / 神話';
        case 'legendary':
            return 'SSR / 傳說';
        case 'epic':
            return 'SR / 史詩';
        case 'rare':
            return 'R / 稀有';
        default:
            return 'N / 常規';
    }
}

function storyCellsToRecord(storyCells: GeneralDetailStoryCellConfig[]): Record<GeneralDetailStorySlot, string> {
    return {
        origin: storyCells.find((cell) => cell.slot === 'origin')?.text ?? '',
        faction: storyCells.find((cell) => cell.slot === 'faction')?.text ?? '',
        role: storyCells.find((cell) => cell.slot === 'role')?.text ?? '',
        awakening: storyCells.find((cell) => cell.slot === 'awakening')?.text ?? '',
        bloodline: storyCells.find((cell) => cell.slot === 'bloodline')?.text ?? '',
        future: storyCells.find((cell) => cell.slot === 'future')?.text ?? '',
    };
}

function mask(value: string | number | undefined, fallback: string): string {
    return value !== undefined && value !== '' ? `${value}` : fallback;
}

function shortenText(value: string | undefined, maxLength: number): string {
    if (!value) {
        return '';
    }

    const normalized = value
        .replace(/[|｜]/g, ' / ')
        .replace(/[，,、；;]/g, ' / ')
        .replace(/\s+/g, ' ')
        .trim();

    if (normalized === '') {
        return '';
    }

    const firstSegment = normalized
        .split('/')
        .map((segment) => segment.trim())
        .find((segment) => segment !== '');
    const compact = firstSegment ?? normalized;
    if (compact.length <= maxLength) {
        return compact;
    }

    return `${compact.slice(0, Math.max(0, maxLength - 1))}…`;
}

function buildCrestGlyphPrimary(config: GeneralConfig): string {
    const token = extractBloodlineTokens(config).at(-1);
    return token ? translateBloodlineToken(token) : config.name.slice(0, 1);
}

function buildCrestGlyphSecondary(config: GeneralConfig): string {
    const tokens = extractBloodlineTokens(config).map((token) => translateBloodlineToken(token));
    if (tokens.length === 0) {
        return '血脈命紋';
    }
    return `${tokens.join('')}命紋`;
}

function formatBloodlineDisplayName(value: string | undefined, fallback: string): string {
    if (!value) {
        return fallback;
    }

    if (!/[A-Za-z]/.test(value)) {
        return shortenText(value, 8) || fallback;
    }

    const tokens = value
        .split(/[_-]+/)
        .map((token) => token.trim().toUpperCase())
        .filter((token) => token !== '' && token !== 'BL');

    if (tokens.length === 0) {
        return fallback;
    }

    const meaningfulTokens = tokens.length > 1 ? tokens.slice(1) : tokens;
    const translated = meaningfulTokens.map((token) => translateBloodlineToken(token)).join('');
    if (translated === '') {
        return fallback;
    }

    return translated.endsWith('血脈') ? translated : `${translated}血脈`;
}

function extractBloodlineTokens(config: GeneralConfig): string[] {
    const source = config.bloodlineId ?? '';
    return source
        .split(/[_-]+/)
        .map((token) => token.trim().toUpperCase())
        .filter((token) => token !== '' && token !== 'BL');
}

function translateBloodlineToken(token: string): string {
    const table: Record<string, string> = {
        QUN: '群',
        SHU: '蜀',
        WEI: '魏',
        WU: '吳',
        HAN: '漢',
        YAN: '燕',
        LONG: '龍',
        HU: '虎',
        FENG: '鳳',
        FEIJIANG: '飛將',
        BAQUAN: '霸拳',
        QIN: '秦',
        CHU: '楚',
        ZHAO: '昭',
    };
    return table[token] ?? token.slice(0, 1);
}
