import type { GeneralConfig, GeneralStatsConfig } from '../../core/models/GeneralUnit';

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
        storyBeats: string[];
    };
}

const FACTION_DISPLAY: Record<string, string> = {
    player: '我方',
    enemy: '敵方',
};

const ROLE_DISPLAY: Record<string, string> = {
    Combat: '戰鬥',
    Support: '支援',
    Hybrid: '混合',
};

const STATUS_DISPLAY: Record<string, string> = {
    Active: '現役',
    Young: '年少',
    Retired: '退役',
    Injured: '負傷',
};

const TERRAIN_DISPLAY: Record<string, string> = {
    plain: '平原',
    river: '河川',
    mountain: '山地',
    fortress: '城塞',
    desert: '沙地',
    forest: '森林',
    water: '水域',
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

    return {
        header: {
            title: mask(config.title, '🔒 未定稱號'),
            name: config.name,
            meta: `${formatFaction(config.faction)} | ${formatRole(config.role)} | ${formatStatus(config.status)}`,
        },
        summary: {
            epValue: config.ep !== undefined
                ? `${config.ep}${config.epRating ? ` 級 ${config.epRating}` : ''}`
                : '🔒 未揭露',
            vitalityValue: config.vitality !== undefined && config.maxVitality !== undefined
                ? `${config.vitality} / ${config.maxVitality}`
                : '🔒 未公開',
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
            bloodlineTitle: '血脈摘要',
            bloodlineName: mask(config.bloodlineId, '未公開血脈'),
            awakeningLabel: mask(config.awakeningTitle, '未覺醒'),
            awakeningProgress: resolveAwakeningProgress(config.ep),
            personalityValue: buildPersonalitySummary(config),
            storyBeats: buildStoryBeats(config),
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
    return value !== undefined ? `${value}` : '??';
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
        { key: '前線主將', value: str ?? -1 },
        { key: '謀略中樞', value: int ?? -1 },
        { key: '軍勢核心', value: lea ?? -1 },
    ].sort((left, right) => right.value - left.value);

    return values[0].value >= 0 ? values[0].key : '定位待補';
}

function buildTraitSummary(config: GeneralConfig, currentSp: number, maxSp: number): string {
    const parts: string[] = [];

    if (config.skillId) {
        parts.push(currentSp >= maxSp ? '戰法可發動' : `戰法蓄能 ${currentSp}/${maxSp}`);
    }

    if (config.preferredTerrain) {
        parts.push(`偏好 ${TERRAIN_DISPLAY[config.preferredTerrain] ?? config.preferredTerrain}`);
    }

    if (config.attackBonus !== undefined && config.attackBonus > 0) {
        parts.push(`攻擊 +${Math.floor(config.attackBonus * 100)}%`);
    }

    return parts.length > 0 ? parts.join(' / ') : '特性待補';
}

function buildPersonalitySummary(config: GeneralConfig): string {
    if (config.parentsSummary && !config.parentsSummary.includes('🔒')) {
        return config.parentsSummary;
    }
    if (config.epRating) {
        return `EP 評級 ${config.epRating}`;
    }
    return '血脈性格待補';
}

function buildStoryBeats(config: GeneralConfig): string[] {
    return [
        mask(config.title, '少年起點'),
        mask(config.source, '出身來歷'),
        buildRoleSummary(resolveStat(config, 'str'), resolveStat(config, 'int'), resolveStat(config, 'lea')),
        mask(config.awakeningTitle, '命運轉折'),
        mask(config.bloodlineId, '血脈暗示'),
        formatRole(config.role),
    ];
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
