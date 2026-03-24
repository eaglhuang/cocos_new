export interface VfxEffectNotifyDef {
    readonly type: 'floatText';
    readonly textKey: string;
    readonly color?: string;
}

export interface VfxEffectDef {
    readonly blockId: string;
    readonly audio?: string;
    readonly notify?: VfxEffectNotifyDef;
    readonly lifetime?: number;
}

export interface VfxEffectTable {
    version: number;
    effects: Record<string, VfxEffectDef>;
}

export const CURRENT_VFX_EFFECT_TABLE_VERSION = 1;

export const DEFAULT_VFX_EFFECTS: Record<string, VfxEffectDef> = {
    hit_enemy: {
        blockId: 'impact_shock',
        audio: 'hurt',
        notify: { type: 'floatText', textKey: '⚔', color: '#FF4444' },
        lifetime: 1.5,
    },
    hit_miss: {
        blockId: 'impact_sparkle',
        audio: 'feijian',
        notify: { type: 'floatText', textKey: 'Miss', color: '#AAAAAA' },
        lifetime: 1.5,
    },
    crit_hit: {
        blockId: 'fire_burst',
        audio: 'boom',
        notify: { type: 'floatText', textKey: '暴擊！', color: '#FF8800' },
        lifetime: 2.0,
    },
    buff_gain_atk: {
        blockId: 'ring_addatk',
        audio: 'buff',
        notify: { type: 'floatText', textKey: '攻擊力提升！', color: '#FF6B35' },
        lifetime: 2.5,
    },
    buff_gain_def: {
        blockId: 'ring_addlife',
        audio: 'heal',
        notify: { type: 'floatText', textKey: '防禦力提升！', color: '#55AAFF' },
        lifetime: 2.5,
    },
    unit_death: {
        blockId: 'impact_ring',
        audio: 'boom',
        notify: { type: 'floatText', textKey: '戰敗！', color: '#FF2222' },
        lifetime: 2.0,
    },
    heal: {
        blockId: 'glow_soft',
        audio: 'heal',
        notify: { type: 'floatText', textKey: '回復！', color: '#00FF88' },
        lifetime: 2.0,
    },
    stun_apply: {
        blockId: 'lightning_purple',
        audio: 'thunder',
        notify: { type: 'floatText', textKey: '暈眩！', color: '#CCAAFF' },
        lifetime: 2.0,
    },
    skill_zhang_fei: {
        blockId: 'fire_burst',
        audio: 'fireball',
        notify: { type: 'floatText', textKey: '虎嘯！', color: '#FF6600' },
        lifetime: 2.5,
    },
    skill_guan_yu: {
        blockId: 'impact_shock',
        audio: 'feijian',
        notify: { type: 'floatText', textKey: '青龍偃月！', color: '#00AAFF' },
        lifetime: 2.5,
    },
    skill_lu_bu: {
        blockId: 'fire_ringwave',
        audio: 'boom',
        notify: { type: 'floatText', textKey: '天下無雙！', color: '#FF2200' },
        lifetime: 3.0,
    },
    skill_cao_cao: {
        blockId: 'ring_addatk',
        audio: 'buff',
        notify: { type: 'floatText', textKey: '奇謀佈陣！', color: '#FFDD00' },
        lifetime: 3.0,
    },
};

export function normalizeVfxEffectTable(raw: unknown): VfxEffectTable {
    const migrated = migrateToLatestSchema(raw);
    const source = asRecord(migrated.effects);
    const effects: Record<string, VfxEffectDef> = {};
    const keys = new Set<string>([
        ...Object.keys(DEFAULT_VFX_EFFECTS),
        ...Object.keys(source),
    ]);

    keys.forEach(key => {
        const normalized = normalizeEffectDef(asRecord(source[key]), DEFAULT_VFX_EFFECTS[key]);
        if (normalized) {
            effects[key] = normalized;
        }
    });

    return {
        version: CURRENT_VFX_EFFECT_TABLE_VERSION,
        effects,
    };
}

function migrateToLatestSchema(raw: unknown): VfxEffectTable {
    const root = asRecord(raw);
    const sourceVersion = detectSchemaVersion(root);

    if (sourceVersion > CURRENT_VFX_EFFECT_TABLE_VERSION) {
        console.warn(
            `[VfxEffectConfig] 偵測到較新的 schema version=${sourceVersion}，` +
            `目前客戶端只支援到 ${CURRENT_VFX_EFFECT_TABLE_VERSION}，改用內建 fallback。`,
        );
        return {
            version: CURRENT_VFX_EFFECT_TABLE_VERSION,
            effects: cloneEffects(DEFAULT_VFX_EFFECTS),
        };
    }

    if (sourceVersion <= 0) {
        return migrateV0ToV1(root);
    }

    return {
        version: CURRENT_VFX_EFFECT_TABLE_VERSION,
        effects: asRecord(root.effects) as Record<string, VfxEffectDef>,
    };
}

function migrateV0ToV1(root: Record<string, unknown>): VfxEffectTable {
    return {
        version: CURRENT_VFX_EFFECT_TABLE_VERSION,
        effects: root as Record<string, unknown> as Record<string, VfxEffectDef>,
    };
}

function detectSchemaVersion(root: Record<string, unknown>): number {
    const explicitVersion = toFiniteNumber(root.version, NaN);
    if (Number.isFinite(explicitVersion)) {
        return Math.floor(explicitVersion);
    }

    if (isRecord(root.effects)) {
        return 1;
    }

    return 0;
}

function normalizeEffectDef(
    raw: Record<string, unknown>,
    fallback?: VfxEffectDef,
): VfxEffectDef | null {
    const blockId = pickString(raw.blockId, fallback?.blockId);
    if (!blockId) {
        return null;
    }

    const notify = normalizeNotify(asRecord(raw.notify), fallback?.notify);
    const lifetime = toPositiveNumber(raw.lifetime, fallback?.lifetime ?? 2.0);
    const audio = pickString(raw.audio, fallback?.audio);

    return {
        blockId,
        ...(audio ? { audio } : {}),
        ...(notify ? { notify } : {}),
        lifetime,
    };
}

function normalizeNotify(
    raw: Record<string, unknown>,
    fallback?: VfxEffectNotifyDef,
): VfxEffectNotifyDef | undefined {
    const type = pickString(raw.type, fallback?.type);
    const textKey = pickString(raw.textKey, fallback?.textKey);
    if (type !== 'floatText' || !textKey) {
        return fallback ? { ...fallback } : undefined;
    }

    const color = pickString(raw.color, fallback?.color);
    return {
        type: 'floatText',
        textKey,
        ...(color ? { color } : {}),
    };
}

function cloneEffects(source: Record<string, VfxEffectDef>): Record<string, VfxEffectDef> {
    const clone: Record<string, VfxEffectDef> = {};
    Object.entries(source).forEach(([key, value]) => {
        clone[key] = {
            ...value,
            ...(value.notify ? { notify: { ...value.notify } } : {}),
        };
    });
    return clone;
}

function pickString(value: unknown, fallback?: string): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function toPositiveNumber(value: unknown, fallback: number): number {
    const numeric = toFiniteNumber(value, fallback);
    return numeric > 0 ? numeric : fallback;
}

function toFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}