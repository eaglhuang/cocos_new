/**
 * cc.mock.ts — Cocos Creator 引擎 API 的最小 Mock
 *
 * 僅供 Node.js 測試環境（tools/run-tests.js）使用。
 * Cocos Creator 在 Editor 中執行時，此檔案完全不被引用。
 *
 * 原則：只 mock 測試中被傳遞型別檢查需要的最小集合，
 * 不實作任何真實行為——測試目標是純 TypeScript 邏輯，不是引擎功能。
 *
 * Unity 對照：類似 UnityEngine 在 Editor Unit Test 時用 NSubstitute
 * 或 Moq 建立 stub（如 Substitute.For<Transform>()）。
 */

// ─── 基本型別 ───────────────────────────────────────────────────────────────

/** mock Vec3（只需建構函式，不需實際數學運算） */
export class Vec3 {
    constructor(public x = 0, public y = 0, public z = 0) {}
}

/** mock Color */
export class Color {
    constructor(public r = 255, public g = 255, public b = 255, public a = 255) {}
}

// ─── Node ───────────────────────────────────────────────────────────────────

/** mock Node.EventType（提供 NODE_DESTROYED 字串常量） */
const NodeEventType = {
    NODE_DESTROYED: 'node-destroyed',
} as const;

type NodeEventTypeKeys = typeof NodeEventType[keyof typeof NodeEventType];

/** mock Node — 支援 once() 監聽（供 EventSystem.onBind 測試用） */
export class Node {
    static readonly EventType = NodeEventType;

    private _handlers = new Map<string, Array<() => void>>();

    once(event: string, handler: () => void): void {
        const list = this._handlers.get(event) ?? [];
        list.push(handler);
        this._handlers.set(event, list);
    }

    getComponent<T>(_type: new (...a: unknown[]) => T): T | null { return null; }
    getComponentsInChildren<T>(_type: new (...a: unknown[]) => T): T[] { return []; }
    addComponent<T>(_type: new (...a: unknown[]) => T): T { return null as unknown as T; }
    setWorldPosition(_pos: Vec3): void { /* mock */ }
    get active(): boolean { return true; }
    set active(_v: boolean) { /* mock */ }
    set parent(_v: unknown) { /* mock */ }

    /** 測試輔助：手動觸發事件（模擬節點銷毀） */
    __emit(event: string): void {
        const list = this._handlers.get(event) ?? [];
        list.forEach(h => h());
        this._handlers.delete(event);
    }
}

// ─── Component ──────────────────────────────────────────────────────────────

/** mock Component — 只需 node 屬性 */
export class Component {
    public node = new Node();
}

// ─── Animation ──────────────────────────────────────────────────────────────

/** mock Animation — play() 是 no-op */
export class Animation {
    play(_clip?: string): void { /* mock */ }
}

// ─── ParticleSystem ─────────────────────────────────────────────────────────

/** mock CurveRange（粒子系統用到的曲線型別） */
export class CurveRange {
    constant = 0;
}

/** mock GradientRange（顏色曲線） */
export class GradientRange {
    color = new Color();
}

/** mock ParticleSystem（EffectSystem / ParticleUtils 中使用） */
export class ParticleSystem {
    startColor  = new GradientRange();
    startSpeed  = new CurveRange();
    startLifetime = new CurveRange();
    rateOverTime  = new CurveRange();
    startSize   = new CurveRange();
    gravityModifier = new CurveRange();
    loop = false;

    play(): void  { /* mock */ }
    stop(): void  { /* mock */ }
    clear(): void { /* mock */ }
}

// ─── AudioSource ────────────────────────────────────────────────────────────

/** mock AudioSource */
export class AudioSource {
    clip: unknown = null;
    volume = 1.0;
    loop   = false;

    play(): void   { /* mock */ }
    stop(): void   { /* mock */ }
    pause(): void  { /* mock */ }
    playOneShot(_clip: unknown, _volume?: number): void { /* mock */ }
}

// ─── AudioClip ──────────────────────────────────────────────────────────────

export class AudioClip {}

// ─── tween（空 no-op） ─────────────────────────────────────────────────────

export function tween(_target: unknown) {
    return {
        to:   (_dur: number, _props: unknown) => tween(_target),
        call: (_fn: () => void) => tween(_target),
        start: () => { /* mock */ },
    };
}

// ─── 其餘常用 exports（型別佔位） ────────────────────────────────────────────

export class Label        { string = ''; }
export class UITransform  {}
export class UIOpacity    { opacity = 255; }
export class Camera       {}
export class Graphics     {}
export const Layers       = { Enum: {} };
export const geometry     = {};
export const _decorator   = {
    ccclass: () => (_: unknown) => {},
    property: (_?: unknown) => (_: unknown, __?: unknown) => {},
};
