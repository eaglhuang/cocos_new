import type {
    GeneralConfig,
    GeneralDetailCrestState,
    GeneralDetailStoryCellConfig,
    GeneralDetailStorySlot,
    GeneralStatsConfig,
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

const STORY_SLOT_ORDER: GeneralDetailStorySlot[] = [
    'origin',
    'faction',
    'role',
    'awakening',
    'bloodline',
    'future',
];

const STORY_SLOT_FALLBACK: Record<GeneralDetailStorySlot, (config: GeneralConfig) => string> = {
    origin: (config) => mask(config.historicalAnecdote, mask(config.title, '待補出身故事')),
    faction: (config) => mask(config.source, '待補陣營來歷'),
    role: (config) => buildRoleSummary(resolveStat(config, 'str'), resolveStat(config, 'int'), resolveStat(config, 'lea')),
    awakening: (config) => mask(config.awakeningTitle, '待補覺醒事件'),
    bloodline: (config) => mask(config.bloodlineRumor, mask(config.bloodlineId, '待補血脈傳聞')),
    future: (config) => formatRole(config.role),
};

const FACTION_DISPLAY: Record<string, string> = {
    player: '我方',
    enemy: '敵方',
};

const ROLE_DISPLAY: Record<string, string> = {
    Combat: '前線主將',
    Support: '輔助軍師',
    Hybrid: '複合型',
};

const STATUS_DISPLAY: Record<string, string> = {
    Active: '現役',
    Young: '年少',
    Retired: '退隱',
    Injured: '傷癒',
};

const TERRAIN_DISPLAY: Record<string, string> = {
    plain: '平原',
    river: '河道',
    mountain: '山地',
    fortress: '關塞',
    desert: '荒漠',
    forest: '林地',
    water: '水域',
};

const CREST_TITLE_DISPLAY: Record<GeneralDetailCrestState, string> = {
    placeholder: '命紋預留',
    rumored: '命紋傳聞',
    revealed: '命紋與因子',
    awakened: '祖紋與覺醒',
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
            title: mask(config.title, '待補人物稱號'),
            name: config.name,
            meta: `${formatFaction(config.faction)} | ${formatRole(config.role)} | ${formatStatus(config.status)}`,
        },
        summary: {
            epValue: config.ep !== undefined
                ? `${config.ep}${config.epRating ? ` 階 ${config.epRating}` : ''}`
                : '待補 EP',
            vitalityValue: config.vitality !== undefined && config.maxVitality !== undefined
                ? `${config.vitality} / ${config.maxVitality}`
                : '待補體力',
        },
        cards: {
            coreStatsSummary: [
                `武 ${formatStatValue(str)}`,
                `智 ${formatStatValue(int)}`,
                `統 ${formatStatValue(lea)}`,
                `政 ${formatStatValue(pol)}`,
                `魅 ${formatStatValue(cha)}`,
                `運 ${formatStatValue(luk)}`,
            ].join(' / '),
            roleSummary: buildRoleSummary(str, int, lea),
            traitSummary: buildTraitSummary(config, currentSp, maxSp),
            bloodlineTitle: '血脈名錄',
            bloodlineName: mask(config.bloodlineId, '待補血脈名'),
            awakeningLabel: mask(config.awakeningTitle, '待補覺醒稱號'),
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
    if (!faction) return '未定';
    return FACTION_DISPLAY[faction] ?? faction;
}

function formatRole(role: string | undefined): string {
    if (!role) return '未定';
    return ROLE_DISPLAY[role] ?? role;
}

function formatStatus(status: string | undefined): string {
    if (!status) return '未定';
    return STATUS_DISPLAY[status] ?? status;
}

function buildRoleSummary(str?: number, int?: number, lea?: number): string {
    const values = [
        { key: '勇武主攻', value: str ?? -1 },
        { key: '智略策士', value: int ?? -1 },
        { key: '統御領軍', value: lea ?? -1 },
    ].sort((left, right) => right.value - left.value);

    return values[0].value >= 0 ? values[0].key : '待補定位';
}

function buildTraitSummary(config: GeneralConfig, currentSp: number, maxSp: number): string {
    const parts: string[] = [];

    if (config.skillId) {
        parts.push(currentSp >= maxSp ? '戰法蓄能已滿' : `戰法蓄能 ${currentSp}/${maxSp}`);
    }

    if (config.preferredTerrain) {
        parts.push(`偏好 ${TERRAIN_DISPLAY[config.preferredTerrain] ?? config.preferredTerrain}`);
    }

    if (config.attackBonus !== undefined && config.attackBonus > 0) {
        parts.push(`攻擊 +${Math.floor(config.attackBonus * 100)}%`);
    }

    return parts.length > 0 ? parts.join(' / ') : '待補戰鬥特性';
}

function buildPersonalitySummary(config: GeneralConfig): string {
    if (config.parentsSummary && !config.parentsSummary.includes('??')) {
        return config.parentsSummary;
    }
    if (config.epRating) {
        return `EP 評級 ${config.epRating}`;
    }
    return '待補血脈性格';
}

function buildBloodlineBody(config: GeneralConfig): string {
    const lines = [
        `父脈：${mask(config.parentsSummary, '待補父母摘要')}`,
        `祖譜：${mask(config.ancestorsSummary, '待補祖譜摘要')}`,
    ];

    if (config.historicalAnecdote) {
        lines.push(`逸聞：${config.historicalAnecdote}`);
    }

    if (config.bloodlineRumor) {
        lines.push(`傳聞：${config.bloodlineRumor}`);
    }

    return lines.join('\n');
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
        return config.crestHint;
    }

    switch (crestState) {
        case 'awakened':
            return '祖紋靈獸已顯形，可接覺醒與血脈因子。';
        case 'revealed':
            return '命紋輪廓已確立，待補祖紋與因子細節。';
        case 'rumored':
            return '目前僅有傳聞與旁證，命紋仍待正式定稿。';
        default:
            return '命紋靈獸 / 祖紋命篆預留區';
    }
}

function buildStoryCells(config: GeneralConfig): GeneralDetailStoryCellConfig[] {
    const explicitCells = new Map<GeneralDetailStorySlot, string>();

    for (const cell of config.storyStripCells ?? []) {
        if (cell.slot && cell.text) {
            explicitCells.set(cell.slot, cell.text);
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

function mask(value: string | number | undefined, fallback: string): string {
    return value !== undefined && value !== '' ? `${value}` : fallback;
}
