// @spec-source → 見 docs/cross-reference-index.md
/**
 * UISpecLoader — 三層 JSON 契約的載入器
 *
 * 從 assets/resources/ui-spec/ 載入 layout / skin / screen JSON，
 * 並快取已載入的規格，避免重複載入。
 *
 * Unity 對照：AssetDatabase.LoadAssetAtPath + 物件快取
 */
import { _decorator } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import type { UILayoutSpec, UISkinManifest, UIScreenSpec, UISkinFragment, UILayoutNodeSpec } from './UISpecTypes';

const { ccclass } = _decorator;

@ccclass('UISpecLoader')
export class UISpecLoader {

    // ── 快取層 ──────────────────────────────────────────────────
    private _layoutCache = new Map<string, UILayoutSpec>();
    private _skinCache = new Map<string, UISkinManifest>();
    private _screenCache = new Map<string, UIScreenSpec>();
    private _designTokens: any = null;

    // ── 載入方法 ────────────────────────────────────────────────

    /**
     * 載入 Layout Spec
     * @param layoutId layout JSON 的 id（不含路徑與副檔名）
     */
    async loadLayout(layoutId: string): Promise<UILayoutSpec> {
        if (this._layoutCache.has(layoutId)) {
            return this._layoutCache.get(layoutId)!;
        }
        console.log(`[UISpecLoader] loadLayout: 開始載入 "${layoutId}"`);
        const spec = await services().resource.loadJson<UILayoutSpec>(
            `ui-spec/layouts/${layoutId}`, { tags: ['UISpec'] }
        );

        // ⚠️ null guard：loadJson 在資源不存在時可能回傳 null
        // 這是造成 "Cannot read properties of null (reading 'root')" 的根源
        if (!spec) {
            console.error(`[UISpecLoader] loadLayout: 載入 "${layoutId}" 失敗 — loadJson 回傳 null/undefined，請確認 Resources/ui-spec/layouts/${layoutId}.json 是否存在`);
            throw new Error(`[UISpecLoader] layout "${layoutId}" 不存在或載入失敗`);
        }
        if (!spec.root) {
            console.error(`[UISpecLoader] loadLayout: "${layoutId}" 的 JSON 沒有 root 欄位，spec=`, spec);
            throw new Error(`[UISpecLoader] layout "${layoutId}" 缺少 root 欄位`);
        }

        console.log(`[UISpecLoader] loadLayout: "${layoutId}" 載入成功，開始解析 $ref 引用`);
        // 遞迴處理佈局碎片引用 ($ref)
        await this._resolveLayoutRefs(spec.root);

        this._layoutCache.set(layoutId, spec);
        return spec;
    }

    /**
     * 遞迴處理佈局中的 $ref 並載入對應碎片。
     * Unity 對照：Prefab 部份載入與合併。
     */
    private async _resolveLayoutRefs(node: UILayoutNodeSpec): Promise<void> {
        if (node.$ref) {
            try {
                // 載入碎片片段
                const fragment = await services().resource.loadJson<UILayoutNodeSpec>(
                    `ui-spec/${node.$ref}`, { tags: ['UISpec'] }
                );
                // 合併屬性：保留當前節點 overrides，碎片作為基礎。
                // 合併邏輯: 除了 $ref 以外，fragment 屬性作為 fallback
                const originalRef = node.$ref;
                delete node.$ref;
                
                const merged = { ...fragment, ...node };
                Object.assign(node, merged);
                
                // 為了避免重複，清除已解析的 $ref 欄位（雖然這裏已經 delete 過一次，但 Object.assign 又帶回來的話再清一次）
                delete (node as any).$ref;
                node.id = originalRef; // 用碎片路徑作為節點 id 的一部分，方便除錯
                
            } catch (e) {
                console.warn(`[UISpecLoader] 佈局載入 $ref 失敗: ${node.$ref}`, e);
            }
        }

        // 遞迴處理子節點
        if (node.children) {
            await Promise.all(node.children.map(child => this._resolveLayoutRefs(child)));
        }
        
        // 亦處理 itemTemplate
        if (node.itemTemplate) {
            await this._resolveLayoutRefs(node.itemTemplate);
        }
        
        // 以及 items (如果有 $ref 定義的話，但目前 ButtonGroupItem 暫不支援 $ref)
    }

    /**
     * 載入 Skin Manifest
     * @param skinId skin JSON 的 id
     */
    async loadSkin(skinId: string): Promise<UISkinManifest> {
        if (this._skinCache.has(skinId)) {
            return this._skinCache.get(skinId)!;
        }
        const manifest = await services().resource.loadJson<UISkinManifest>(
            `ui-spec/skins/${skinId}`, { tags: ['UISpec'] }
        );

        // 如果 skin 引用了碎片，載入並合併
        if (manifest.$fragments && manifest.$fragments.length > 0) {
            for (const fragId of manifest.$fragments) {
                try {
                    const fragment = await services().resource.loadJson<UISkinFragment>(
                        `ui-spec/fragments/skins/${fragId}`, { tags: ['UISpec'] }
                    );
                    Object.assign(manifest.slots, fragment.slots);
                } catch (e) {
                    console.warn(`[UISpecLoader] skin 載入碎片失敗: ${fragId}`, e);
                }
            }
        }

        this._skinCache.set(skinId, manifest);
        return manifest;
    }

    /**
     * 載入 Screen Spec
     * @param screenId screen JSON 的 id
     */
    async loadScreen(screenId: string): Promise<UIScreenSpec> {
        if (this._screenCache.has(screenId)) {
            return this._screenCache.get(screenId)!;
        }
        const spec = await services().resource.loadJson<UIScreenSpec>(
            `ui-spec/screens/${screenId}`, { tags: ['UISpec'] }
        );
        this._screenCache.set(screenId, spec);
        return spec;
    }

    /**
     * 載入設計風格參數（全域 Design Tokens）
     */
    async loadDesignTokens(): Promise<any> {
        if (this._designTokens) return this._designTokens;
        this._designTokens = await services().resource.loadJson<any>(
            'ui-spec/ui-design-tokens', { tags: ['UISpec'] }
        );
        return this._designTokens;
    }

    /**
     * 載入完整的畫面規格（Screen + Layout + Skin）
     * @returns 三層規格的組合包
     */
    async loadFullScreen(screenId: string): Promise<{
        screen: UIScreenSpec;
        layout: UILayoutSpec;
        skin: UISkinManifest;
    }> {
        const screen = await this.loadScreen(screenId);
        const [layout, skin] = await Promise.all([
            this.loadLayout(screen.layout),
            this.loadSkin(screen.skin),
        ]);
        return { screen, layout, skin };
    }

    /**
     * 載入 i18n 語系字串
     * @param locale 語系碼（如 'zh-TW'、'en-US'）
     */
    async loadI18n(locale: string): Promise<Record<string, string>> {
        return services().resource.loadJson<Record<string, string>>(
            `i18n/${locale}`, { tags: ['i18n'] }
        );
    }

    // ── 快取管理 ────────────────────────────────────────────────

    /** 清除所有快取（場景切換時呼叫） */
    clearCache(): void {
        this._layoutCache.clear();
        this._skinCache.clear();
        this._screenCache.clear();
        this._designTokens = null;
    }
}
