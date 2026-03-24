import { Animation, Node, Vec3 } from "cc";
import { StatusEffect, EVENT_NAMES } from "../config/Constants";
import { services } from "../managers/ServiceLoader";

// ─── JSON 資料型別（對應 resources/data/skills.json）────────────────────────

type VfxTarget = "caster" | "targets";

interface AnimStep    { type: "animation"; clip: string;     atTime: number }
interface AudioStep   { type: "audio";     clip: string;     atTime: number }
interface VfxStep     { type: "vfx";       blockId: string;  atTime: number; target?: VfxTarget; offsetY?: number }
interface DamageStep  { type: "damage";    multiplier: number; target: "single" | "all_enemies"; atTime: number }
interface BuffStep    { type: "buff";      buffId: string;   duration: number; target: "single" | "all_enemies"; atTime: number }
interface FloatStep   { type: "floatText"; text: string;     target?: VfxTarget; atTime: number }

type ActionStep = AnimStep | AudioStep | VfxStep | DamageStep | BuffStep | FloatStep;

/**
 * 技能定義（對應 resources/data/skills.json 的每一筆條目）。
 *
 * Unity 對照：類似 ScriptableObject 的技能資産（SkillSO）——
 * 只存資料，不包含行為；行為由 ActionSystem 讀取並執行。
 */
export interface SkillDef {
    readonly id:          string;
    readonly label:       string;
    readonly description: string;
    readonly costSp:      number;
    readonly steps:       ActionStep[];
}

// ─── Context ────────────────────────────────────────────────────────────────

/**
 * 技能演出上下文：描述施法者與目標的即時資訊。
 *
 * Unity 對照：類似 Skill.Use(context) 的 TargetingContext / AbilityContext，
 * 把「誰在哪裡打誰」的資訊包成一個結構傳進來，避免全域查詢。
 */
export interface ActionContext {
    /** 施法單位 ID，語意同 BuffSystem/BattleSystem 使用的 unitId */
    casterUnitId:   string;
    /** 施法者在場景的世界座標（與 cc.Vec3 同構，可直接 new Vec3(p.x, p.y, p.z)） */
    casterPos:      { x: number; y: number; z: number };
    /** 可選：施法者節點引用，用於 animation step 播放動畫 */
    casterNode?:    Node;
    /** 所有被施術目標的 unitId 列表 */
    targetUnitIds:  string[];
    /** 被施術目標的世界座標列表（與 targetUnitIds 索引對應） */
    targetPositions: { x: number; y: number; z: number }[];
}

// ─── ActionSystem ───────────────────────────────────────────────────────────

/**
 * 技能演出系統：讀取 JSON 時間軸，依序播放動畫、特效、音效、傷害與 Buff。
 *
 * Unity 對照：類似 PlayableDirector + Timeline。
 *   - Unity：每個 track 掛在 Timeline window，Play() 執行整段動線。
 *   - Cocos：每個 step 帶 atTime（秒），由 setTimeout 定時觸發，不需 Update 輪詢。
 *
 * 架構限制：ActionSystem 位於 core/systems/，禁止 import battle/ 或 ui/ 的任何內容。
 * 傷害/Buff step 透過 services().event.emit() 通知，由 BattleSystem / DuelSystem 接收處理。
 *
 * 使用範例：
 *   const ctx: ActionContext = {
 *       casterUnitId: 'zhang-fei',
 *       casterPos:    { x: 0, y: 0, z: 0 },
 *       casterNode:   this.node,
 *       targetUnitIds:  ['enemy-001'],
 *       targetPositions: [{ x: 3, y: 0, z: 0 }],
 *   };
 *   services().action.playSkill('zhang-fei-roar', ctx, () => console.log('done'));
 */
export class ActionSystem {
    private registry = new Map<string, SkillDef>();

    // ── Registry ──────────────────────────────────────────────────────────

    /**
     * 批量注冊技能定義。
     * 通常在 ResourceManager 載入 skills.json 後由 ServiceLoader 呼叫。
     */
    public registerSkills(defs: SkillDef[]): void {
        for (const def of defs) {
            this.registry.set(def.id, def);
        }
    }

    /** 查詢單一技能定義（如 UI 需要顯示技能說明）。 */
    public getSkill(id: string): SkillDef | undefined {
        return this.registry.get(id);
    }

    /** 列出所有已注冊的技能 ID（給編輯器工具或 debug 用）。 */
    public getAllSkillIds(): string[] {
        return Array.from(this.registry.keys());
    }

    // ── Playback ──────────────────────────────────────────────────────────

    /**
     * 演出指定技能的完整時間軸序列。
     *
     * @param skillId    技能 ID（對應 generals.json 的 skillId）
     * @param ctx        演出上下文
     * @param onComplete 所有 step 執行完畢後的回呼（選填）
     */
    public playSkill(skillId: string, ctx: ActionContext, onComplete?: () => void): void {
        const def = this.registry.get(skillId);
        if (!def) {
            console.warn(`[ActionSystem] 找不到技能定義: '${skillId}'`);
            onComplete?.();
            return;
        }

        // 廣播技能啟動事件（BattleScene / GeneralPanel 可監聽來更新 SP 顯示）
        services().event.emit(EVENT_NAMES.GeneralSkillUsed, {
            skillId,
            casterUnitId: ctx.casterUnitId,
        });

        let maxTime = 0;
        for (const step of def.steps) {
            const ms = step.atTime * 1000;
            if (ms > maxTime) maxTime = ms;
            setTimeout(() => this.executeStep(step, ctx), ms);
        }

        if (onComplete) {
            // 在最後一個 step 後 100ms 觸發，確保所有副作用已執行
            setTimeout(onComplete, maxTime + 100);
        }
    }

    // ── Step Handlers ─────────────────────────────────────────────────────

    private executeStep(step: ActionStep, ctx: ActionContext): void {
        switch (step.type) {
            case "animation": this.doAnimation(step, ctx); break;
            case "audio":     this.doAudio(step);          break;
            case "vfx":       this.doVfx(step, ctx);       break;
            case "damage":    this.doDamage(step, ctx);    break;
            case "buff":      this.doBuff(step, ctx);      break;
            case "floatText": this.doFloatText(step, ctx); break;
        }
    }

    /**
     * 播放施法者身上的動畫 Clip。
     * Unity 對照：animator.Play("Skill")。
     * Cocos 使用 cc.Animation Component，Clip 名稱需與 Animation State 對應。
     */
    private doAnimation(step: AnimStep, ctx: ActionContext): void {
        const anim = ctx.casterNode?.getComponent(Animation);
        if (!anim) return;
        anim.play(step.clip);
    }

    /** 播放音效（防重複由 AudioSystem 內建 50ms guard 處理）。 */
    private doAudio(step: AudioStep): void {
        services().audio.playSfx(step.clip);
    }

    /**
     * 在施法者或目標位置播放 VFX Block。
     * target='caster'  → casterPos（預設）
     * target='targets' → 每個 targetPosition 各播一次
     */
    private doVfx(step: VfxStep, ctx: ActionContext): void {
        const positions = step.target === "targets"
            ? ctx.targetPositions
            : [ctx.casterPos];

        const offsetY = step.offsetY ?? 0;
        for (const p of positions) {
            services().effect.playBlock(
                step.blockId,
                new Vec3(p.x, p.y + offsetY, p.z),
            );
        }
    }

    /**
     * 透過事件通知傷害（BattleSystem / DuelSystem 接收後計算實際傷害值）。
     * 使用事件而非直接呼叫，保持 core/ 對 battle/ 的單向依賴。
     */
    private doDamage(step: DamageStep, ctx: ActionContext): void {
        const targetIds = step.target === "all_enemies"
            ? ctx.targetUnitIds
            : ctx.targetUnitIds.slice(0, 1);

        for (const targetUnitId of targetIds) {
            services().event.emit(EVENT_NAMES.GeneralSkillEffect, {
                type:         "damage",
                casterUnitId: ctx.casterUnitId,
                targetUnitId,
                multiplier:   step.multiplier,
            });
        }
    }

    /** 直接呼叫 BuffSystem 施加狀態效果（同為 core/ 層，無跨層引用問題）。 */
    private doBuff(step: BuffStep, ctx: ActionContext): void {
        const effect = step.buffId as StatusEffect;
        const targetIds = step.target === "all_enemies"
            ? ctx.targetUnitIds
            : ctx.targetUnitIds.slice(0, 1);

        for (const unitId of targetIds) {
            services().buff.applyBuff(unitId, effect, step.duration);
        }
    }

    /** 在施法者或目標位置顯示浮字提示（技能名稱或狀態文字）。 */
    private doFloatText(step: FloatStep, ctx: ActionContext): void {
        const positions = step.target === "targets"
            ? ctx.targetPositions
            : [ctx.casterPos];

        for (const p of positions) {
            services().floatText.show("status", step.text, new Vec3(p.x, p.y, p.z));
        }
    }
}
