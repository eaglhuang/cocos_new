/**
 * cc.mock.ts — Cocos Creator 引擎 API 的最小 Mock
 */

export class Vec3 { constructor(public x = 0, public y = 0, public z = 0) {} }
export class Color { constructor(public r = 255, public g = 255, public b = 255, public a = 255) {} }

// ─── 基礎 UI 類型 (必須在 Node 之前) ──────────────────────────────────────────

export class UITransform {
    width = 0; height = 0; anchorX = 0.5; anchorY = 0.5;
    setContentSize(w: number, h: number): void { this.width = w; this.height = h; }
    getContentSize() { return { width: this.width, height: this.height }; }
    setAnchorPoint(x: number, y: number): void { this.anchorX = x; this.anchorY = y; }
}

export class Label {
    static readonly HorizontalAlign = { LEFT: 0, CENTER: 1, RIGHT: 2 };
    static readonly VerticalAlign   = { TOP: 0, CENTER: 1, BOTTOM: 2 };
    static readonly Overflow        = { NONE: 0, CLAMP: 1, SHRINK: 2, RESIZE_HEIGHT: 3 };
    string = ''; fontSize = 20; color = new Color(); horizontalAlign = 0; verticalAlign = 0; overflow = 0;
    getComponent<T>(_type: any): T | null { return null; }
}

export class Layout {
    static readonly Type = { NONE: 0, HORIZONTAL: 1, VERTICAL: 2, GRID: 3 };
    static readonly ResizeMode = { NONE: 0, CONTAINER: 1, CHILDREN: 2 };
    static readonly VerticalDirection = { TOP_TO_BOTTOM: 0, BOTTOM_TO_TOP: 1 };
    type = 0; resizeMode = 0; spacingY = 0; paddingTop = 0; verticalDirection = 0; isValid = true;
    updateLayout(_force?: boolean): void { /* mock */ }
}

export class Button { static readonly EventType = { CLICK: 'click' }; }
export class Sprite {}
export class UIOpacity { opacity = 255; }
export class Prefab {}

// ─── Node ───────────────────────────────────────────────────────────────────

export class Node {
    static readonly EventType = { NODE_DESTROYED: 'node-destroyed' };
    public children: Node[] = [];
    private _parent: Node | null = null;
    public layer = 1;
    private _handlers = new Map<string, Array<(arg?: any) => void>>();
    private _components: any[] = [];

    constructor(public name: string = "") {}

    get parent(): Node | null { return this._parent; }
    set parent(v: Node | null) {
        if (this._parent) {
            const idx = this._parent.children.indexOf(this);
            if (idx !== -1) this._parent.children.splice(idx, 1);
        }
        this._parent = v;
        if (v && v.children.indexOf(this) === -1) v.children.push(this);
    }

    addComponent<T>(type: any): T {
        const comp = new type() as any;
        comp.node = this;
        this._components.push(comp);
        return comp;
    }

    getComponent<T>(type: any): T | null {
        if (!type || typeof type !== 'function') return null;
        return this._components.find(c => c instanceof type) || null;
    }

    addChild(node: Node): void { node.parent = this; }
    getChildByName(name: string): Node | null { return this.children.find(c => c.name === name) || null; }
    
    removeAllChildren(): void {
        const kids = this.children.slice();
        kids.forEach(c => c.parent = null);
        this.children = [];
    }

    on(event: string, handler: (arg?: any) => void): void {
        const list = this._handlers.get(event) ?? [];
        list.push(handler);
        this._handlers.set(event, list);
    }

    once(event: string, handler: () => void): void { this.on(event, handler); }

    setPosition(_x: any, _y?: number, _z?: number): void {}
    setWorldPosition(_pos: any): void {}
    setRotationFromEuler(_x: number, _y: number, _z: number): void {}
    setScale(_v: any, _y?: number, _z?: number): void {}
    get active(): boolean { return true; }
    set active(_v: boolean) {}
    get isValid(): boolean { return true; }

    __emit(event: string, arg?: any): void {
        const list = this._handlers.get(event) ?? [];
        list.forEach(h => h(arg));
    }
}

export class Component {
    public node = new Node();
    public isValid = true;
    scheduleOnce(fn: () => void, _delay: number): void { fn(); }
}

export function instantiate(noP: any): Node {
    if (noP instanceof Node) return new Node(noP.name + " (Clone)");
    return new Node("New Instance");
}

export function tween(_target: any) {
    return {
        to: (_duration?: number, _props?: Record<string, unknown>) => tween(_target),
        call: (_fn?: () => void) => tween(_target),
        start: () => {},
    };
}

// ─── 系統 ───────────────────────────────────────────────────────────────────

export const Layers = { Enum: { DEFAULT: 1 } };
export const geometry = {};
export const gfx = { CullMode: { NONE: 0 } };
export const _decorator = {
    ccclass: () => (_: any) => {},
    property: () => (_: any, __: any) => {},
    requireComponent: () => (_: any, __: any) => {},
};

export const sys = {
    isBrowser: false,
    NetworkType: { NONE: 0, LAN: 1, WWAN: 2 },
    getNetworkType(): number { return 1; },
    localStorage: {
        _data: new Map<string, string>(),
        getItem(key: string): string | null { return this._data.get(key) ?? null; },
        setItem(key: string, val: string): void { this._data.set(key, val); },
        removeItem(key: string): void { this._data.delete(key); },
        clear(): void { this._data.clear(); }
    }
};

// 補齊 Animation 等
export class Animation { play(): void {} }
export class Camera {}
export class Graphics {}
export class ParticleSystem { startColor: any; play(): void {} }
export class AudioSource {
    loop = false;
    volume = 1;
    clip: AudioClip | null = null;
    play(): void {}
    pause(): void {}
    stop(): void {}
    playOneShot(_clip: AudioClip, _volumeScale?: number): void {}
}
export class AudioClip {}
export class CurveRange { constant = 0; }
export class GradientRange { color = new Color(); }
