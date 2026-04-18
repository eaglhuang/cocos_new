// @spec-source → 見 docs/cross-reference-index.md
/**
 * UISkinResolver — Skin Slot 解析器
 *
 * 將 skin manifest 中的 slot 名稱（如 "general.header.bg"）
 * 解析為實際的 SpriteFrame、LabelStyle 或 ButtonSkin。
 *
 * 當美術替換 PNG 時，只要檔案路徑不變，此模組自動取得新圖。
 * Auto Atlas 打包時會自動將散圖合成大圖，runtime 透路徑載入即可。
 *
 * Unity 對照：SpriteAtlas.GetSprite + Theme.Resolve
 */
import { _decorator, SpriteFrame, Color } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import type { UISkinManifest, SkinSlot, SkinLabelSlot, SkinButtonSlot } from './UISpecTypes';

const { ccclass } = _decorator;

/** 解析後的文字樣式（可直接套用於 Label） */
export interface ResolvedLabelStyle {
    fontSize: number;
    lineHeight: number;
    color: Color;
    isBold: boolean;
    horizontalAlign: number;   // Label.HorizontalAlign 的數值
    verticalAlign: number;     // Label.VerticalAlign 的數值
    overflow: number;          // Label.Overflow 的數值
    outlineColor?: Color;
    outlineWidth?: number;
    /** 字型資源路徑（Bundle 內，空 = 系統預設字型） */
    fontPath?: string;
}

/** 解析後的按鈕皮膚 */
export interface ResolvedButtonSkin {
    normal: SpriteFrame | null;
    pressed: SpriteFrame | null;
    hover: SpriteFrame | null;
    disabled: SpriteFrame | null;
    selected: SpriteFrame | null;
    border?: [number, number, number, number];
}

@ccclass('UISkinResolver')
export class UISkinResolver {

    private _manifest: UISkinManifest | null = null;
    private _spriteCache = new Map<string, SpriteFrame | null>();
    private _tokens: any = null;

    /** 設定當前使用的 skin manifest */
    setManifest(manifest: UISkinManifest, tokens: any = null): void {
        this._manifest = manifest;
        this._tokens = tokens || { colors: {} }; // 確保 tokens 與 colors 不會是 undefined
        this._spriteCache.clear();
    }

    /** 取得 slot 定義（原始 JSON 數據） */
    getSlot(slotId: string): SkinSlot | null {
        return this._manifest?.slots[slotId] ?? null;
    }

    /**
     * 解析 SpriteFrame
     * 若 slot 不存在或載入失敗，回傳 null（由呼叫端決定 fallback）
     */
    async getSpriteFrame(slotId: string): Promise<SpriteFrame | null> {
        if (this._spriteCache.has(slotId)) {
            return this._spriteCache.get(slotId)!;
        }

        const slot = this.getSlot(slotId);
        if (!slot || slot.kind === 'label-style') return null;

        const path = slot.kind === 'sprite-frame' ? slot.path : (slot as SkinButtonSlot).normal;
        if (!path) return null;

        try {
            const frame = await services().resource.loadSpriteFrame(path);
            // 防禦：瀏覽器模式下 SpriteFrame 可能載入成功但內部 texture 為 null，
            // 直接賦給 Sprite 會導致 _applySpriteSize 存取 texture.width 崩潰
            if (!frame || !frame.texture) {
                console.warn(`[UISkinResolver] SpriteFrame texture 無效: ${slotId} → ${path}`);
                this._spriteCache.set(slotId, null);
                return null;
            }
            this._spriteCache.set(slotId, frame);
            return frame;
        } catch (e) {
            if (path.startsWith('ui-spec/placeholders/')) {
                console.log(`[UISkinResolver] placeholder SpriteFrame 缺失，沿用呼叫端 fallback: ${slotId} → ${path}`);
            } else {
                console.warn(`[UISkinResolver] 載入 SpriteFrame 失敗: ${slotId} → ${path}`, e);
            }
            this._spriteCache.set(slotId, null);
            return null;
        }
    }

    /**
     * 解析 LabelStyle
     * 將 JSON 定義轉換為可直接套用的 ResolvedLabelStyle
     */
    getLabelStyle(slotId: string): ResolvedLabelStyle | null {
        const slot = this.getSlot(slotId);
        if (!slot || slot.kind !== 'label-style') return null;

        const s = slot as SkinLabelSlot;
        const preset = s.style ? this._resolveTypographyPreset(s.style) : null;
        const fontSize = s.fontSize ?? preset?.fontSize;
        if (!fontSize) {
            return null;
        }

        const lineHeight = s.lineHeight ?? preset?.lineHeight ?? Math.ceil(fontSize * 1.4);
        const outlineWidth = s.outlineWidth ?? preset?.outlineWidth;
        const outlineColor = s.outlineColor ?? preset?.outlineColor;

        return {
            fontSize,
            lineHeight,
            color: this.resolveColor(s.color),
            isBold: s.isBold ?? preset?.fontWeight === 'bold',
            horizontalAlign: this._parseHAlign(s.horizontalAlign),
            verticalAlign: this._parseVAlign(s.verticalAlign),
            overflow: this._parseOverflow(s.overflow),
            outlineColor: outlineColor ? this.resolveColor(outlineColor) : undefined,
            outlineWidth,
            fontPath: s.font ?? this._resolveFontPathFromStyle(s.style, preset),
        };
    }

    /**
     * 解析 ButtonSkin（含所有狀態圖）
     */
    async getButtonSkin(slotId: string): Promise<ResolvedButtonSkin | null> {
        const slot = this.getSlot(slotId);
        if (!slot || slot.kind !== 'button-skin') return null;

        const s = slot as SkinButtonSlot;

        const loadFrame = async (path: string | undefined): Promise<SpriteFrame | null> => {
            if (!path) return null;
            try {
                const frame = await services().resource.loadSpriteFrame(path);
                return (frame && frame.texture) ? frame : null;
            } catch {
                return null;
            }
        };

        const [normal, pressed, hover, disabled, selected] = await Promise.all([
            loadFrame(s.normal),
            loadFrame(s.pressed),
            loadFrame(s.hover),
            loadFrame(s.disabled),
            loadFrame(s.selected),
        ]);

        return { normal, pressed, hover, disabled, selected, border: s.border };
    }

    // ── 輔助解析 ────────────────────────────────────────────────

    /** Hex 字串或 Token → cc.Color */
    public resolveColor(hex: string): Color {
        if (!hex) return Color.WHITE;
        if (hex.startsWith('#')) {
            // 直接是色碼，跳過 Token 檢查
        } else if (this._tokens && this._tokens.colors && this._tokens.colors[hex]) {
            hex = this._tokens.colors[hex];
        }
        
        // 確保 hex 是有效色碼
        if (!hex.startsWith('#')) {
            // token 名稱無法解析（tokens 未初始化或 key 不存在），回傳透明 fallback 而非誤解析為怪色
            console.warn(`[UISkinResolver] resolveColor: token "${hex}" 未找到（tokens loaded: ${!!this._tokens}），使用透明 fallback`);
            return new Color(0, 0, 0, 0);
        }

        const cleanHex = hex.replace('#', '');
        if (cleanHex.length < 6) return Color.WHITE;

        const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
        const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
        const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
        const a = cleanHex.length >= 8 ? parseInt(cleanHex.substring(6, 8), 16) : 255;
        return new Color(r, g, b, a);
    }

    private _parseHAlign(align?: string): number {
        switch (align) {
            case 'CENTER': return 1;
            case 'RIGHT':  return 2;
            default:       return 0; // LEFT
        }
    }

    private _parseVAlign(align?: string): number {
        switch (align) {
            case 'CENTER': return 1;
            case 'BOTTOM': return 2;
            default:       return 0; // TOP
        }
    }

    private _parseOverflow(overflow?: string): number {
        switch (overflow?.toUpperCase()) {
            case 'NONE':          return 0; // Label.Overflow.NONE — 僅在明確指定時啟用
            case 'CLAMP':         return 1;
            case 'SHRINK':        return 2;
            case 'RESIZE_HEIGHT': return 3;
            default:              return 2; // SHRINK — 未指定時預設自動縮小，防止文字溢出
        }
    }

    private _resolveTypographyPreset(style?: string): Record<string, any> | null {
        if (!style) {
            return null;
        }

        const typography = this._tokens?.typography;
        if (!typography || typeof typography !== 'object') {
            return null;
        }

        const preset = typography[style];
        if (!preset || typeof preset !== 'object') {
            return null;
        }

        return preset as Record<string, any>;
    }

    private _resolveFontPathFromStyle(style?: string, preset?: Record<string, any> | null): string | undefined {
        if (preset?.font && typeof preset.font === 'string') {
            return preset.font;
        }

        const typography = this._tokens?.typography;
        if (!style || !typography || typeof typography !== 'object') {
            return undefined;
        }

        if (style.startsWith('headline')) {
            return typography.headlineFont;
        }
        if (style.startsWith('body')) {
            return typography.bodyFont;
        }
        if (style.startsWith('label')) {
            return typography.labelFont;
        }
        return undefined;
    }

    /** 清除 sprite 快取 */
    clearCache(): void {
        this._spriteCache.clear();
    }

    /**
     * 並行預載一批 slot 的 SpriteFrame，填入 _spriteCache。
     * 應在 buildScreen() 前呼叫（如 CompositePanel.mount()），
     * 讓後續 getSpriteFrame() 直接命中快取而不阻塞節點建構。
     *
     * @param slotIds 要預載的 slot id 清單（通常是 Object.keys(skin.slots)）
     *
     * Unity 對照：AssetBundle.LoadAllAssetsAsync<Sprite>()
     */
    async preloadSlots(slotIds: string[]): Promise<void> {
        await Promise.all(slotIds.map(id => this.getSpriteFrame(id)));
    }
}
