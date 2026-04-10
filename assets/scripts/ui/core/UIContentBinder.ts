/**
 * UIContentBinder — Content Contract 綁定器（Phase F）
 *
 * 依據 ContentContractRef 驗證並映射內容資料到 UITemplateBinder。
 * 在 Panel 的 onReady 中使用，確保 content data 符合 family schema 約束。
 *
 * Unity 對照：
 *   - 類似 Editor 驗證 Prefab 的必填 [SerializeField] 清單，
 *     但在 runtime 以 warn 而非 error 的形式回報缺少欄位（保持遊戲可運行）。
 *
 * 使用範例：
 * ```typescript
 * const binder = new UIContentBinder();
 * const result = binder.validate(contractRef, data);
 * if (!result.valid) {
 *     console.warn('[Panel] 內容契約缺少必填欄位:', result.missing);
 * }
 * binder.bind(templateBinder, contractRef, data);
 * ```
 */

import { services } from '../../core/managers/ServiceLoader';
import type { ContentContractRef } from './UISpecTypes';
import type { UITemplateBinder } from './UITemplateBinder';

interface ContentContractSchemaField {
    type: string;
    required?: boolean;
    bindPath?: string;
    /** 允許的列舉值（當 type 為 string 時有效） */
    enum?: string[];
    /** 允許的數值範圍（當 type 為 number 時有效），[min, max] 含端點 */
    range?: [number, number];
    /** 正則模式驗證（當 type 為 string 時有效） */
    pattern?: string;
}

interface ContentContractSchema {
    schemaId: string;
    familyId: string;
    fields: Record<string, ContentContractSchemaField>;
}

interface UIContentBinderBindOptions {
    suppressUnresolvedWarnings?: boolean;
}

/** 驗證結果 */
export interface ContentValidationResult {
    /** 所有必填欄位是否都已提供 */
    valid: boolean;
    /** 缺少的必填欄位名稱清單 */
    missing: string[];
    /** 非錯誤的提示（例如：建議填寫的選填欄位） */
    warnings: string[];
}

/**
 * UIContentBinder
 *
 * 職責：
 * 1. 驗證 data 是否滿足 ContentContractRef 所宣告的 requiredFields
 * 2. 將 data 中的字串欄位透過 UITemplateBinder.setTexts() 注入對應的 Label 節點
 */
export class UIContentBinder {

    private _schemaCache = new Map<string, ContentContractSchema | null>();

    /**
     * 驗證 data 是否符合 contractRef 的 required field 約束。
     *
     * @param contractRef - Screen Spec 上宣告的 ContentContractRef
     * @param data - 要傳入畫面的資料物件
     * @returns ContentValidationResult，不丟例外（以 warn 形式回報）
     */
    validate(
        contractRef: ContentContractRef,
        data: Record<string, unknown>,
        schema?: ContentContractSchema | null,
    ): ContentValidationResult {
        const missing: string[] = [];
        const warnings: string[] = [];

        // 檢查所有 requiredFields
        for (const field of contractRef.requiredFields) {
            const value = data[field];
            if (value === undefined || value === null || value === '') {
                missing.push(field);
            }
        }

        // Schema 層級驗證：type / enum / range / pattern
        if (schema?.fields) {
            for (const [key, fieldSpec] of Object.entries(schema.fields)) {
                const value = data[key];
                if (value === undefined || value === null) continue;

                // type 檢查
                if (fieldSpec.type && typeof value !== fieldSpec.type) {
                    warnings.push(
                        `欄位 "${key}" 預期型別 ${fieldSpec.type}，實際為 ${typeof value}`,
                    );
                }

                // enum 檢查
                if (fieldSpec.enum && typeof value === 'string') {
                    if (!fieldSpec.enum.includes(value)) {
                        warnings.push(
                            `欄位 "${key}" 的值 "${value}" 不在允許列舉 [${fieldSpec.enum.join(', ')}] 中`,
                        );
                    }
                }

                // range 檢查
                if (fieldSpec.range && typeof value === 'number') {
                    const [min, max] = fieldSpec.range;
                    if (value < min || value > max) {
                        warnings.push(
                            `欄位 "${key}" 的值 ${value} 超出允許範圍 [${min}, ${max}]`,
                        );
                    }
                }

                // pattern 檢查
                if (fieldSpec.pattern && typeof value === 'string') {
                    const re = new RegExp(fieldSpec.pattern);
                    if (!re.test(value)) {
                        warnings.push(
                            `欄位 "${key}" 的值 "${value}" 不符合模式 ${fieldSpec.pattern}`,
                        );
                    }
                }
            }
        }

        // 檢查是否有 data 欄位不在 requiredFields 中（提示用）
        const requiredSet = new Set(contractRef.requiredFields);
        for (const key of Object.keys(data)) {
            if (!requiredSet.has(key)) {
                warnings.push(`欄位 "${key}" 未在 requiredFields 中宣告（可能是選填欄位）`);
            }
        }

        return {
            valid: missing.length === 0,
            missing,
            warnings,
        };
    }

    /**
     * 將 data 欄位映射到 UITemplateBinder 管理的 Label 節點。
     *
     * 映射規則：
     * - data 中值為 string 的欄位，嘗試透過 binder.setTexts 設定文字
     * - fieldId 直接對應 layout node id（kebab-case 轉換為 camelCase，或直接查找）
     * - 找不到對應節點時只發出 warn，不丟例外
     *
     * @param binder - 已完成 bind() 的 UITemplateBinder 實體
     * @param contractRef - Content Contract 引用（用於記錄 context）
     * @param data - 要注入的資料
     */
    async bind(
        binder: UITemplateBinder,
        contractRef: ContentContractRef,
        data: Record<string, unknown>,
        options: UIContentBinderBindOptions = {},
    ): Promise<void> {
        const schema = await this._loadSchema(contractRef.schemaId);
        const fallbackTextEntries: Record<string, string> = {};
        const unresolved: string[] = [];

        for (const [key, value] of Object.entries(data)) {
            const bindPath = schema?.fields?.[key]?.bindPath;

            if (typeof bindPath === 'string' && bindPath.trim().length > 0) {
                const label = binder.getLabelByPath(bindPath);
                if (label && (typeof value === 'string' || typeof value === 'number')) {
                    label.string = String(value);
                    continue;
                }

                const node = binder.getNodeByPath(bindPath);
                if (node) {
                    if (typeof value === 'boolean') {
                        node.active = value;
                    }
                    continue;
                }

                if (value !== undefined && value !== null && value !== '') {
                    unresolved.push(`${key} -> ${bindPath}`);
                }
                continue;
            }

            if (typeof value === 'string') {
                fallbackTextEntries[key] = value;
            }
        }

        if (Object.keys(fallbackTextEntries).length > 0) {
            binder.setTexts(fallbackTextEntries);
        }

        // 驗證並 warn 缺少必填欄位（不阻斷執行）
        const result = this.validate(contractRef, data, schema);
        if (!result.valid) {
            console.warn(
                `[UIContentBinder] family="${contractRef.familyId}" schema="${contractRef.schemaId}" ` +
                `缺少必填欄位: ${result.missing.join(', ')}`,
            );
        }

        if (result.warnings.length > 0) {
            console.warn(
                `[UIContentBinder] family="${contractRef.familyId}" schema="${contractRef.schemaId}" ` +
                `契約警告: ${result.warnings.join('; ')}`,
            );
        }

        if (unresolved.length > 0 && !options.suppressUnresolvedWarnings) {
            console.warn(
                `[UIContentBinder] family="${contractRef.familyId}" schema="${contractRef.schemaId}" ` +
                `找不到 bindPath 對應節點: ${unresolved.join(', ')}`,
            );
        }
    }

    private async _loadSchema(schemaId: string): Promise<ContentContractSchema | null> {
        if (this._schemaCache.has(schemaId)) {
            return this._schemaCache.get(schemaId) ?? null;
        }

        try {
            const schema = await services().resource.loadJson<ContentContractSchema>(
                `ui-spec/contracts/${schemaId}.schema`,
                { tags: ['UISpec'] },
            );
            this._schemaCache.set(schemaId, schema ?? null);
            return schema ?? null;
        } catch (error) {
            console.warn(`[UIContentBinder] 載入 content schema 失敗: ${schemaId}`, error);
            this._schemaCache.set(schemaId, null);
            return null;
        }
    }
}
