/**
 * GeneralDetailFormatters
 *
 * 將 legacy GeneralDetail runtime 的私有格式化工具提取為共用函式，
 * 供各 ChildPanel 類別直接導入使用。
 */
import type { GeneralConfig, GeneralGeneConfig } from '../../../core/models/GeneralUnit';

// ─── 顯示對照表 ───────────────────────────────────────────────────────────────

export const FACTION_DISPLAY: Record<string, string> = {
    player: '玩家',
    enemy: '敵方',
};

export const ROLE_DISPLAY: Record<string, string> = {
    Combat: '戰鬥武將',
    Support: '支援武將',
    Hybrid: '複合武將',
};

export const STATUS_DISPLAY: Record<string, string> = {
    'Active': '壯年',
    'Young': '未成年',
    'Retired': '隱居',
    'Injured': '重傷',
};

export const TERRAIN_DISPLAY: Record<string, string> = {
    plain: '平原',
    river: '河流',
    mountain: '山地',
    fortress: '城池',
    desert: '沙漠',
    forest: '林地',
    water: '水域',
};

export const SKILL_DISPLAY_NAME: Record<string, string> = {
    'zhang-fei-roar': '震吼（全體暈眩 1 回合）',
    'guan-yu-slash': '月牙刀斬（自動選最佳直線）',
    'lu-bu-rampage': '天下無雙（自動選最佳扇形）',
    'cao-cao-tactics': '兵不厭詐（自動鎖定前線）',
    'zhao-yun-pierce': '龍魂突刺（自動貫穿最佳列）',
    'zhuge-liang-storm': '諸葛風暴（自動選最大範圍）',
    'zhou-yu-inferno': '周瑜炎陣（自動點燃敵軍所在格）',
    'sun-quan-tide': '江潮列陣（自動掃蕩中心周邊）',
    'liu-bei-rally': '仁德號召（固定全軍支援）',
    'diao-chan-charm': '閉月傾城（固定全敵控制）',
    'cao-zhi-verse': '七步成章（自動選最佳扇形）',
    'guo-jia-foresight': '鬼謀先機（自動選最佳範圍）',
    'sima-yi-shadow': '司馬影策（固定全敵壓制）',
};

export const TACTIC_CATEGORY_DISPLAY: Record<string, string> = {
    charge: '突擊',
    formation: '陣型',
    ranged: '遠程',
    scheme: '計略',
    support: '支援',
    ambush: '伏擊',
    control: '控制',
    duel: '單挑',
    passive: '被動',
};

export const SKILL_SLOT_SOURCE_DISPLAY: Record<string, string> = {
    inborn: '天賦',
    bloodline: '血統',
    awakened: '覺醒',
    locked: '鎖定',
    template: '專屬',
    talisman: '虎符',
    education: '培育',
    event: '事件',
};

// ─── Formatter 函式 ───────────────────────────────────────────────────────────

export function mask(value: string | number | undefined, fallback = '🔒 未公開'): string {
    return value !== undefined && value !== '' ? `${value}` : fallback;
}

export function formatFaction(faction: string | undefined): string {
    if (!faction) return '🔒 未公開';
    return FACTION_DISPLAY[faction] ?? faction;
}

export function formatRole(role: string | undefined): string {
    if (!role) return '🔒 未分流';
    return ROLE_DISPLAY[role] ?? role;
}

export function formatStatus(status: string | undefined): string {
    if (!status) return '🔒 未公開';
    return STATUS_DISPLAY[status] ?? status;
}

export function formatStatValue(value: number | undefined): string {
    return value !== undefined ? `${value}` : '🔒 未公開';
}

export function buildRoleSummary(str?: number, int?: number, lea?: number): string {
    const values = [
        { key: '武力型', value: str ?? -1 },
        { key: '謀略型', value: int ?? -1 },
        { key: '統率型', value: lea ?? -1 },
    ].sort((l, r) => r.value - l.value);
    return values[0].value >= 0 ? values[0].key : '🔒 尚未判定';
}

export function formatGene(slotIndex: number, gene?: GeneralGeneConfig): string {
    if (!gene) return `因子槽 ${slotIndex}：🔒 未知因子`;
    if (gene.isLocked) {
        const dl = gene.discoveryLevel !== undefined ? `（發現等級 ${gene.discoveryLevel}）` : '';
        return `因子槽 ${slotIndex}：🔒 ${gene.displayName ?? gene.id ?? '未知因子'}${dl}`;
    }
    const parts = [
        gene.displayName ?? gene.id ?? `因子 ${slotIndex}`,
        gene.type ? `[${gene.type}]` : '',
        gene.level !== undefined ? `★${gene.level}` : '',
        gene.description ?? '',
    ].filter(Boolean);
    return `因子槽 ${slotIndex}：${parts.join(' ')}`;
}

export function formatList(values: string[] | undefined, fallback: string): string {
    if (!values || values.length === 0) return fallback;
    return values.map((v) => `• ${v}`).join('\n');
}

export function formatBulletList(values: string[], fallback: string): string {
    if (values.length === 0) return fallback;
    return values.map((value) => `• ${value}`).join('\n');
}

export function formatSkillSource(source: string | undefined): string {
    if (!source) return '未註記';
    return SKILL_SLOT_SOURCE_DISPLAY[source] ?? source;
}

export function formatTacticCategory(category: string | undefined): string {
    if (!category) return '戰法';
    return TACTIC_CATEGORY_DISPLAY[category] ?? category;
}

export function formatAptitudeMap(
    values: Record<string, string> | undefined,
    keys: string[],
    labels: Record<string, string>
): string {
    if (!values) return '🔒 尚未建立適性資料';
    return keys.map((k) => `${labels[k]}：${values[k] ?? '🔒'}`).join('\n');
}

export function resolveStat(config: GeneralConfig, key: string): number | undefined {
    const nested = (config.stats as Record<string, number> | undefined)?.[key];
    if (nested !== undefined) return nested;
    return (config as unknown as Record<string, number>)[key];
}
