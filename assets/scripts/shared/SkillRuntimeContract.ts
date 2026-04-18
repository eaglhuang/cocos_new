/**
 * Shared skill runtime draft contracts.
 *
 * 目的：作為戰法 / 奧義共用 runtime contract 的雛型，供 client / tooling / server 未來收斂。
 * 現階段為 draft，不代表所有欄位都已接線到正式 runtime。
 */

export enum SkillSourceType {
    TigerTally = 'tiger-tally',
    Mentor = 'mentor',
    Bloodline = 'bloodline',
    SceneGambit = 'scene-gambit',
    SeedTactic = 'seed-tactic',
    Ultimate = 'ultimate',
}

export enum BattleSkillTargetMode {
    Self = 'self',
    AllySingle = 'ally-single',
    EnemySingle = 'enemy-single',
    AllyAll = 'ally-all',
    EnemyAll = 'enemy-all',
    Line = 'line',
    Fan = 'fan',
    AroundSelf = 'around-self',
    Area = 'area',
    Tile = 'tile',
    AdjacentTiles = 'adjacent-tiles',
    GlobalStage = 'global-stage',
    ReactiveSourceTarget = 'reactive-source-target',
}

export enum BattleSkillTiming {
    ActiveCast = 'active-cast',
    StartOfBattle = 'start-of-battle',
    StartOfTurn = 'start-of-turn',
    OnAttack = 'on-attack',
    OnHit = 'on-hit',
    OnCounter = 'on-counter',
    OnKill = 'on-kill',
    OnDeath = 'on-death',
    OnEnterTile = 'on-enter-tile',
    EndOfTurn = 'end-of-turn',
}

export enum TacticModuleType {
    DirectDamage = 'direct-damage',
    LineDamage = 'line-damage',
    AreaDamage = 'area-damage',
    MovementModifier = 'movement-modifier',
    ForcedMove = 'forced-move',
    TileState = 'tile-state',
    BuffApply = 'buff-apply',
    DebuffApply = 'debuff-apply',
    HealRecover = 'heal-recover',
    LinkShare = 'link-share',
    CounterReaction = 'counter-reaction',
    ActionReset = 'action-reset',
    StealthReveal = 'stealth-reveal',
    ObstacleSpawn = 'obstacle-spawn',
    ConditionalTrigger = 'conditional-trigger',
}

export enum UltimateEffectFamily {
    SelfBurst = 'self-burst',
    TeamBuff = 'team-buff',
    TeamHeal = 'team-heal',
    EnemyMassDebuff = 'enemy-mass-debuff',
    SingleExecute = 'single-execute',
    AreaBurst = 'area-burst',
    ControlOverride = 'control-override',
    SpecialRule = 'special-rule',
}

export type SkillScalingStat = 'str' | 'int' | 'lea' | 'pol' | 'cha' | 'luk';
export type BattleSkillAutoAimMode =
    | 'frontmost-enemy'
    | 'densest-line'
    | 'densest-fan'
    | 'occupied-tile'
    | 'densest-area'
    | 'adjacent-ring'
    | 'all-enemies'
    | 'all-allies';

export interface JsonListEnvelope<T> {
    version?: string;
    updatedAt?: string;
    description?: string;
    data?: T[];
}

export interface CanonicalTacticDefinition {
    id: string;
    displayName: string;
    category?: string;
    battleSkillId?: string | null;
    sourceType?: SkillSourceType;
    targetMode?: BattleSkillTargetMode;
    timing?: BattleSkillTiming;
    manualTargeting?: boolean;
    autoAimMode?: BattleSkillAutoAimMode | null;
    tacticModules?: TacticModuleType[];
}

export interface CanonicalUltimateDefinition {
    id: string;
    templateId?: string;
    slot?: number;
    name: string;
    description?: string;
    unlockReincarnation?: number;
    vitalityCostPct?: number;
    scalingStat?: SkillScalingStat | null;
    exclusive?: boolean;
    inheritanceGeneId?: string;
    battleSkillId?: string | null;
    ultimateFamily?: UltimateEffectFamily | null;
    targetMode?: BattleSkillTargetMode;
    timing?: BattleSkillTiming;
    manualTargeting?: boolean;
    autoAimMode?: BattleSkillAutoAimMode | null;
}

export interface BattleSkillRequest {
    sourceType: SkillSourceType;
    ownerUid: string;
    generalTemplateId?: string | null;
    tacticId?: string | null;
    ultimateId?: string | null;
    battleSkillId: string;
    targetMode: BattleSkillTargetMode;
    timing: BattleSkillTiming;
    targetUnitUid?: string | null;
    targetTileId?: string | null;
    triggeredByUnitUid?: string | null;
    notes?: string;
}

export interface BattleSkillDefinitionDraft {
    id: string;
    sourceType: SkillSourceType;
    targetMode: BattleSkillTargetMode;
    timing: BattleSkillTiming;
    manualTargeting?: boolean;
    autoAimMode?: BattleSkillAutoAimMode | null;
    tacticModules?: TacticModuleType[];
    ultimateFamily?: UltimateEffectFamily | null;
    scalingStat?: SkillScalingStat | null;
    coefficient?: number;
    durationTurns?: number;
    maxTargets?: number;
    battleLogKey?: string | null;
    cinematicProfile?: string | null;
}

export interface SkillExecutionDelta {
    unitUid?: string;
    tileId?: string;
    deltaHp?: number;
    deltaSp?: number;
    addBuffs?: string[];
    removeBuffs?: string[];
    tileState?: string | null;
    forcedMoveSteps?: number;
    notes?: string;
}

export interface SkillExecutionResult {
    requestId: string;
    battleSkillId: string;
    applied: boolean;
    blockedReason?: string | null;
    deltas: SkillExecutionDelta[];
    battleLogLines: string[];
}

export function buildIdMap<T extends { id: string }>(items?: T[] | null): Map<string, T> {
    return new Map((items ?? []).map((item) => [item.id, item]));
}