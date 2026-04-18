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
import { ResourceManager } from '../../core/systems/ResourceManager';
import type { UILayoutSpec, UISkinManifest, UIScreenSpec, UISkinFragment, UILayoutNodeSpec, UITemplateSpec, UIWidgetFragmentSpec, FrameRecipe, SkinSlot } from './UISpecTypes';
import { CURRENT_SPEC_VERSION } from './UISpecTypes';

const { ccclass } = _decorator;

@ccclass('UISpecLoader')
export class UISpecLoader {

    constructor(private _rm: ResourceManager) {}

    // ── 快取層 ──────────────────────────────────────────────────
    private _layoutCache = new Map<string, UILayoutSpec>();
    private _skinCache = new Map<string, UISkinManifest>();
    private _screenCache = new Map<string, UIScreenSpec>();
    private _templateCache = new Map<string, UITemplateSpec>();
    private _widgetCache = new Map<string, UIWidgetFragmentSpec>();
    private _recipeCache = new Map<string, FrameRecipe>();
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
        const layoutResourcePath = layoutId.startsWith('fragments/')
            ? `ui-spec/${layoutId}`
            : `ui-spec/layouts/${layoutId}`;
        const rawSpec = await this._rm.loadJson<any>(
            layoutResourcePath, { tags: ['UISpec'] }
        );

        let spec: UILayoutSpec | null = null;
        if (rawSpec && rawSpec.root) {
            spec = rawSpec as UILayoutSpec;
        } else if (rawSpec && typeof rawSpec === 'object') {
            // fragments/layouts/*.json 可能直接是 root node spec（無 canvas/root 外層）
            // 這裡寬鬆正規化，避免不同 fragment 形狀導致 runtime 直接中斷。
            spec = {
                id: (rawSpec as any).id ?? layoutId,
                version: (rawSpec as any).version ?? 1,
                canvas: {
                    fitWidth: true,
                    fitHeight: true,
                    safeArea: true,
                    designWidth: 1920,
                    designHeight: 1080,
                },
                root: rawSpec as UILayoutNodeSpec,
            };
        }

        // ⚠️ null guard：loadJson 在資源不存在時可能回傳 null
        // 這是造成 "Cannot read properties of null (reading 'root')" 的根源
        if (!spec) {
            console.error(`[UISpecLoader] loadLayout: 載入 "${layoutId}" 失敗 — loadJson 回傳 null/undefined，請確認 Resources/${layoutResourcePath}.json 是否存在`);
            throw new Error(`[UISpecLoader] layout "${layoutId}" 不存在或載入失敗`);
        }
        if (!spec.root) {
            console.error(`[UISpecLoader] loadLayout: "${layoutId}" 的 JSON 沒有 root 欄位，spec=`, spec);
            throw new Error(`[UISpecLoader] layout "${layoutId}" 缺少 root 欄位`);
        }

        console.log(`[UISpecLoader] loadLayout: "${layoutId}" 載入成功，開始解析 $ref 引用`);
        // M9: specVersion forward-compat guard
        if (typeof (spec as any).specVersion === 'number' && (spec as any).specVersion > CURRENT_SPEC_VERSION) {
            console.warn(`[UISpecLoader] loadLayout: "${layoutId}" specVersion=${(spec as any).specVersion} 超過引擎支援上限 ${CURRENT_SPEC_VERSION}，部分功能可能無法正常運作`);
        }
        // 遞迴處理佈局碎片引用 ($ref)
        await this._resolveLayoutRefs(spec.root);

        this._layoutCache.set(layoutId, spec);
        return spec;
    }

    /**
     * 遞迴處理佈局中的 $ref 並載入對應碎片。
     * Unity 對照：Prefab 部份載入與合併。
     */
    /** 不可被 $ref 覆寫的欄位（覆寫代表邏輯矛盾） */
    private static readonly _IMMUTABLE_REF_KEYS: ReadonlySet<string> = new Set(['type']);

    private async _resolveLayoutRefs(node: UILayoutNodeSpec): Promise<void> {
        if (node.$ref) {
            try {
                // 載入碎片片段
                const fragment = await this._rm.loadJson<UILayoutNodeSpec>(
                    `ui-spec/${node.$ref}`, { tags: ['UISpec'] }
                );

                // Immutable key guard: 如果 node 與 fragment 都有且值不同 → 警告
                for (const key of UISpecLoader._IMMUTABLE_REF_KEYS) {
                    const nodeVal = (node as any)[key];
                    const fragVal = (fragment as any)[key];
                    if (nodeVal !== undefined && fragVal !== undefined && nodeVal !== fragVal) {
                        console.warn(
                            `[UISpecLoader] ⚠️ $ref immutable key 衝突: ` +
                            `"${node.$ref}" 的 ${key}="${fragVal}" 被 node override 為 "${nodeVal}"。` +
                            `這通常代表使用錯誤，請確認 $ref 指向正確的 fragment。`
                        );
                    }
                }

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
     *
     * Phase G (UI-2-0085)：若 manifest 含 themeStack，自動進行四層合併：
     *   base → family → stateOverrides → 本 manifest（後者覆寫前者）。
     * 不含 themeStack 時退回 Phase F 的 flat merge，完全向後相容。
     *
     * Unity 對照：Prefab Variant 的 Material Override Chain
     */
    async loadSkin(skinId: string): Promise<UISkinManifest> {
        if (this._skinCache.has(skinId)) {
            return this._skinCache.get(skinId)!;
        }
        const manifest = await this._rm.loadJson<UISkinManifest>(
            `ui-spec/skins/${skinId}`, { tags: ['UISpec'] }
        );
        if (!manifest) {
            throw new Error(`[UISpecLoader] loadSkin: 找不到 skin "${skinId}"，請確認 assets/resources/ui-spec/skins/${skinId}.json 是否存在`);
        }

        // Phase F：$fragments 合併（flat merge，向後相容）
        if (manifest.$fragments && manifest.$fragments.length > 0) {
            for (const fragId of manifest.$fragments) {
                try {
                    const fragment = await this._rm.loadJson<UISkinFragment>(
                        `ui-spec/fragments/skins/${fragId}`, { tags: ['UISpec'] }
                    );
                    Object.assign(manifest.slots, fragment.slots);
                } catch (e) {
                    console.warn(`[UISpecLoader] skin 載入碎片失敗: ${fragId}`, e);
                }
            }
        }

        // Phase G (UI-2-0085)：themeStack layered merge chain
        // 僅當 manifest 有 themeStack 才進行疊層合併；否則維持現有行為。
        if (manifest.themeStack) {
            const mergedSlots = await this._buildThemeStackSlots(manifest, new Set([skinId]));
            manifest.slots = mergedSlots;
        }

        this._skinCache.set(skinId, manifest);
        return manifest;
    }

    /**
     * 建立 themeStack 疊層合併後的 slots。
     *
     * 優先序（由低到高）：
     *   1. base skin（全域設計 token / 預設 slot）
     *   2. family skin（family 共用 slot，如 dark-metal 共用框邊）
     *   3. stateOverrides skin 清單（低→高，後者覆寫前者）
     *   4. 本 manifest 自身 slot（最高優先，screen-level 自訂）
     *
     * @param manifest 已載入的本 manifest（含 themeStack）
     * @param visited  已訪問的 skin id Set（防止循環引用）
     *
     * Unity 對照：MaterialPropertyBlock 疊層，後者 Override 前者
     */
    private async _buildThemeStackSlots(
        manifest: UISkinManifest,
        visited: Set<string>
    ): Promise<Record<string, SkinSlot>> {
        const chain: Array<Record<string, SkinSlot>> = [];
        const stack = manifest.themeStack!;

        const safePush = async (refId: string, layerLabel: string) => {
            if (!refId) return;
            if (visited.has(refId)) {
                console.warn(`[UISpecLoader] themeStack 循環引用，跳過 ${layerLabel} skin: ${refId}`);
                return;
            }
            visited.add(refId);
            const skin = await this.loadSkin(refId);
            chain.push(skin.slots);
        };

        // 1. base（最低優先）
        if (stack.base) await safePush(stack.base, 'base');
        // 2. family
        if (stack.family) await safePush(stack.family, 'family');
        // 3. stateOverrides（由 index 0 到末尾，後者優先）
        for (const soId of stack.stateOverrides ?? []) {
            await safePush(soId, 'stateOverride');
        }
        // 4. 本 manifest 自身（最高優先）
        chain.push(manifest.slots);

        // 合併：後者 key 覆寫前者，未衝突的 key 全部保留
        return Object.assign({}, ...chain);
    }

    /**
     * 載入 FrameRecipe（高品質框體視覺語法契約）
     * @param recipeId recipe 檔案的基底名（不含 .recipe.json），如 "dark-metal"
     *
     * 檔案路徑：assets/resources/ui-spec/recipes/families/{recipeId}.recipe.json
     *
     * Unity 對照：Material asset 的視覺語意契約描述
     */
    async loadRecipe(recipeId: string): Promise<FrameRecipe> {
        if (this._recipeCache.has(recipeId)) {
            return this._recipeCache.get(recipeId)!;
        }
        const recipe = await this._rm.loadJson<FrameRecipe>(
            `ui-spec/recipes/families/${recipeId}.recipe`, { tags: ['UISpec'] }
        );
        if (!recipe) {
            throw new Error(
                `[UISpecLoader] recipe "${recipeId}" 不存在，` +
                `請確認 assets/resources/ui-spec/recipes/families/${recipeId}.recipe.json 是否存在`
            );
        }
        this._recipeCache.set(recipeId, recipe);
        return recipe;
    }

    /**
     * 載入 Screen Spec
     * @param screenId screen JSON 的 id
     */
    async loadScreen(screenId: string): Promise<UIScreenSpec> {
        if (this._screenCache.has(screenId)) {
            return this._screenCache.get(screenId)!;
        }
        const spec = await this._rm.loadJson<UIScreenSpec>(
            `ui-spec/screens/${screenId}`, { tags: ['UISpec'] }
        );
        if (!spec) {
            throw new Error(`[UISpecLoader] loadScreen: 找不到 screen "${screenId}"，請確認 assets/resources/ui-spec/screens/${screenId}.json 是否存在`);
        }
        // M9: specVersion forward-compat guard
        if (typeof (spec as any).specVersion === 'number' && (spec as any).specVersion > CURRENT_SPEC_VERSION) {
            console.warn(`[UISpecLoader] loadScreen: "${screenId}" specVersion=${(spec as any).specVersion} 超過引擎支援上限 ${CURRENT_SPEC_VERSION}，部分功能可能無法正常運作`);
        }
        this._screenCache.set(screenId, spec);
        return spec;
    }

    /**
     * 載入設計風格參數（全域 Design Tokens）
     */
    async loadDesignTokens(): Promise<any> {
        if (this._designTokens) return this._designTokens;
        this._designTokens = await this._rm.loadJson<any>(
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
        return this._rm.loadJson<Record<string, string>>(
            `i18n/${locale}`, { tags: ['i18n'] }
        );
    }

    // ── 快取管理 ────────────────────────────────────────────────

    /**
     * 載入 Template Spec
     * @param templateId template JSON 的 id
     */
    async loadTemplate(templateId: string): Promise<UITemplateSpec> {
        if (this._templateCache.has(templateId)) {
            return this._templateCache.get(templateId)!;
        }
        const spec = await this._rm.loadJson<UITemplateSpec>(
            `ui-spec/templates/${templateId}`, { tags: ['UISpec'] }
        );
        if (!spec) {
            throw new Error(`[UISpecLoader] template "${templateId}" 不存在`);
        }
        this._templateCache.set(templateId, spec);
        return spec;
    }

    /**
     * 載入 Widget Fragment Spec
     * @param widgetId widget JSON 的 id
     */
    async loadWidget(widgetId: string): Promise<UIWidgetFragmentSpec> {
        if (this._widgetCache.has(widgetId)) {
            return this._widgetCache.get(widgetId)!;
        }
        const spec = await this._rm.loadJson<UIWidgetFragmentSpec>(
            `ui-spec/fragments/widgets/${widgetId}`, { tags: ['UISpec'] }
        );
        if (!spec) {
            throw new Error(`[UISpecLoader] widget "${widgetId}" 不存在`);
        }
        this._widgetCache.set(widgetId, spec);
        return spec;
    }

    /** 清除所有快取（場景切換時呼叫） */
    clearCache(): void {
        this._layoutCache.clear();
        this._skinCache.clear();
        this._screenCache.clear();
        this._templateCache.clear();
        this._widgetCache.clear();
        this._recipeCache.clear();
        this._designTokens = null;
    }
}
