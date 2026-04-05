/**
 * UITemplateResolver — Template → Layout 展開器
 *
 * 接收一份 UITemplateSpec 與參數值，將 compose 區段中引用的
 * Widget Fragments 載入並組合，最終產出一份完整的 UILayoutSpec。
 *
 * Unity 對照：Prefab Variant 的組裝流水線 — 選骨架、填參數、合碎片
 */
import { _decorator } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import type {
    UITemplateSpec,
    UITemplateComposeItem,
    UIWidgetFragmentSpec,
    UILayoutSpec,
    UILayoutNodeSpec,
    CanvasDef,
    SkinSlot,
} from './UISpecTypes';
import { DEFAULT_CANVAS } from './UISpecTypes';

const { ccclass } = _decorator;

@ccclass('UITemplateResolver')
export class UITemplateResolver {

    /** Widget Fragment 快取 */
    private _widgetCache = new Map<string, UIWidgetFragmentSpec>();

    /**
     * 將 Template 展開為完整的 UILayoutSpec
     *
     * @param template Template 定義
     * @param params   使用者傳入的參數值（覆蓋 Template 預設值）
     * @returns        完整的 UILayoutSpec，可直接餵給 UIPreviewBuilder.buildScreen()
     */
    async resolve(
        template: UITemplateSpec,
        params?: Record<string, string | number | boolean>,
    ): Promise<UILayoutSpec> {
        // 合併參數：Template 預設 + 使用者覆蓋
        const mergedParams = this._mergeParams(template, params);

        // 展開 compose 區段
        const children: UILayoutNodeSpec[] = [];
        for (const item of template.compose) {
            const node = await this._resolveComposeItem(item, mergedParams);
            if (node) children.push(node);
        }

        // 組裝為完整 Layout Spec
        const canvas: CanvasDef = template.canvas ?? { ...DEFAULT_CANVAS };
        const layout: UILayoutSpec = {
            id: `tpl-${template.id}`,
            version: template.version,
            canvas,
            root: {
                type: 'container',
                name: `${template.id}_Root`,
                width: canvas.designWidth ?? 1920,
                height: canvas.designHeight ?? 1080,
                widget: { top: 0, bottom: 0, left: 0, right: 0 },
                children,
            },
        };
        return layout;
    }

    /**
     * 收集 Template 中所有 Widget 的 defaultSkinSlots，
     * 可用於自動合併到 SkinManifest
     */
    async collectDefaultSkinSlots(
        template: UITemplateSpec,
    ): Promise<Record<string, SkinSlot>> {
        const allSlots: Record<string, SkinSlot> = {};
        const widgetIds = this._extractWidgetIds(template.compose);
        for (const wid of widgetIds) {
            const widget = await this._loadWidget(wid);
            if (widget.defaultSkinSlots) {
                Object.assign(allSlots, widget.defaultSkinSlots);
            }
        }
        return allSlots;
    }

    // ── 內部方法 ────────────────────────────────────────────────

    /** 合併 Template 預設參數與使用者覆蓋值 */
    private _mergeParams(
        template: UITemplateSpec,
        userParams?: Record<string, string | number | boolean>,
    ): Record<string, string | number | boolean> {
        const merged: Record<string, string | number | boolean> = {};

        // 先填入 Template 預設值
        if (template.params) {
            for (const [key, def] of Object.entries(template.params)) {
                if (def.default !== undefined) {
                    merged[key] = def.default;
                }
            }
        }

        // 使用者覆蓋
        if (userParams) {
            Object.assign(merged, userParams);
        }

        return merged;
    }

    /** 展開單一 compose item → UILayoutNodeSpec（遞迴） */
    private async _resolveComposeItem(
        item: UITemplateComposeItem,
        params: Record<string, string | number | boolean>,
    ): Promise<UILayoutNodeSpec | null> {
        // 條件判斷：若 condition 引用的參數為 falsy，跳過此 widget
        if (item.condition) {
            const condValue = this._resolveParamRef(item.condition, params);
            if (!condValue || condValue === '' || condValue === 'false') {
                return null;
            }
        }

        // 載入 Widget Fragment
        const widget = await this._loadWidget(item.widget);

        // 深拷貝 widget layout（避免修改快取）
        const node = JSON.parse(JSON.stringify(widget.layout)) as UILayoutNodeSpec;

        // 合併 Widget 自身參數與 compose item 傳入的參數
        const widgetParams = { ...params };
        if (item.params) {
            for (const [k, v] of Object.entries(item.params)) {
                const resolved = typeof v === 'string'
                    ? this._resolveParamRef(v, params)
                    : v;
                widgetParams[k] = resolved;
            }
        }

        // 遞迴替換節點樹中的 ${param} 佔位符
        this._applyParams(node, widgetParams);

        // 處理子 Widget 組合
        if (item.children && item.children.length > 0) {
            if (!node.children) node.children = [];
            for (const child of item.children) {
                const childNode = await this._resolveComposeItem(child, params);
                if (childNode) node.children.push(childNode);
            }
        }

        return node;
    }

    /** 載入 Widget Fragment（帶快取） */
    private async _loadWidget(widgetId: string): Promise<UIWidgetFragmentSpec> {
        if (this._widgetCache.has(widgetId)) {
            return this._widgetCache.get(widgetId)!;
        }

        const spec = await services().resource.loadJson<UIWidgetFragmentSpec>(
            `ui-spec/fragments/widgets/${widgetId}`, { tags: ['UISpec'] },
        );

        if (!spec) {
            throw new Error(`[UITemplateResolver] Widget "${widgetId}" 不存在，請確認 fragments/widgets/${widgetId}.json`);
        }

        this._widgetCache.set(widgetId, spec);
        return spec;
    }

    /** 解析 "${paramName}" 引用 → 實際值 */
    private _resolveParamRef(
        value: string | number | boolean,
        params: Record<string, string | number | boolean>,
    ): string | number | boolean {
        if (typeof value !== 'string') return value;
        // 完整替換：整個字串就是一個 ${key}
        const fullMatch = value.match(/^\$\{(\w+)\}$/);
        if (fullMatch) {
            const key = fullMatch[1];
            return params[key] ?? value;
        }
        // 部分替換：字串中嵌入多個 ${key}
        return value.replace(/\$\{(\w+)\}/g, (_, key) => {
            const v = params[key];
            return v !== undefined ? String(v) : `\${${key}}`;
        });
    }

    /** 遞迴替換節點樹中的 ${param} 佔位符 */
    private _applyParams(
        node: UILayoutNodeSpec,
        params: Record<string, string | number | boolean>,
    ): void {
        // 替換字串型欄位
        const stringFields: (keyof UILayoutNodeSpec)[] = [
            'name', 'text', 'textKey', 'skinSlot', 'styleSlot', 'iconSlot', 'bind', 'onClick', 'id',
        ];
        for (const field of stringFields) {
            const val = (node as any)[field];
            if (typeof val === 'string' && val.includes('${')) {
                (node as any)[field] = this._resolveParamRef(val, params);
            }
        }

        // 處理 active 欄位：支援 "${paramName}" 解析為 boolean
        // 例如 panel-header 的 CloseButton: "active": "${closable}"
        if (typeof (node as any).active === 'string') {
            const raw = (node as any).active as string;
            if (raw.includes('${')) {
                const resolved = this._resolveParamRef(raw, params);
                // 轉換為 boolean：'false' / 0 / '' → false，其他 → true
                (node as any).active = resolved !== 'false' && resolved !== false && resolved !== 0 && resolved !== '';
            }
        }

        // 替換尺寸（可能是 "${width}" 字串）
        if (typeof node.width === 'string' && node.width.includes('${')) {
            const resolved = this._resolveParamRef(node.width, params);
            node.width = typeof resolved === 'number' ? resolved
                : typeof resolved === 'string' && !resolved.endsWith('%') ? parseInt(resolved, 10) || node.width
                : resolved as any;
        }
        if (typeof node.height === 'string' && node.height.includes('${')) {
            const resolved = this._resolveParamRef(node.height, params);
            node.height = typeof resolved === 'number' ? resolved
                : typeof resolved === 'string' && !resolved.endsWith('%') ? parseInt(resolved, 10) || node.height
                : resolved as any;
        }

        // 遞迴子節點
        if (node.children) {
            for (const child of node.children) {
                this._applyParams(child, params);
            }
        }
        if (node.itemTemplate) {
            this._applyParams(node.itemTemplate, params);
        }
    }

    /** 從 compose 樹中提取所有引用的 Widget ID */
    private _extractWidgetIds(items: UITemplateComposeItem[]): string[] {
        const ids = new Set<string>();
        const walk = (list: UITemplateComposeItem[]) => {
            for (const item of list) {
                ids.add(item.widget);
                if (item.children) walk(item.children);
            }
        };
        walk(items);
        return Array.from(ids);
    }

    /** 清除快取 */
    clearCache(): void {
        this._widgetCache.clear();
    }
}
