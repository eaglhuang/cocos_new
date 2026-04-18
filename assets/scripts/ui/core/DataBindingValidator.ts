// @spec-source → docs/UCUF規範文件.md §3  (UCUF M5)
/**
 * DataBindingValidator — UCUF 資料綁定驗證器
 *
 * UCUF M5：驗證 CompositePanel ↔ ChildPanel 資料流的三類問題：
 *
 *   missing-source   content state 缺少某個 ChildPanel 需要的 dataSource key
 *   format-mismatch  ChildPanel.validateDataFormat() 回傳錯誤訊息
 *   unused-key       content state 有 key 但沒有任何 ChildPanel 消費
 *
 * 呼叫方（CompositePanel）在 applyContentState() 時可選擇性傳入此 validator：
 *   validator.validate(state, panelEntries)
 * 回傳 [] 表示無問題，否則回傳 BindingIssue 陣列供記錄/顯示。
 *
 * Unity 對照：Editor OnValidate() 的 binding 層，僅在 DEBUG_MODE 下執行。
 */

import { UCUFLogger, LogCategory } from './UCUFLogger';

// ─── 結果型別 ──────────────────────────────────────────────────────────────────

export type BindingIssueKind = 'missing-source' | 'format-mismatch' | 'unused-key';

export interface BindingIssue {
    kind:       BindingIssueKind;
    dataSource: string;
    message:    string;
}

/** ChildPanel 提供給 validator 的最小契約 */
export interface IPanelDataContract {
    dataSource:         string;
    validateDataFormat: (data: unknown) => string | null;
}

// ─── 主類別 ────────────────────────────────────────────────────────────────────

export class DataBindingValidator {

    /**
     * 驗證 content state 與 ChildPanel 集合之間的資料綁定健康度。
     *
     * @param state   applyContentState 傳入的資料字典
     * @param panels  ChildPanel 集合（需提供 dataSource + validateDataFormat）
     * @returns       所有發現的問題陣列（空陣列 = 通過）
     */
    static validate(
        state:  Record<string, unknown>,
        panels: Iterable<IPanelDataContract>,
    ): BindingIssue[] {
        const issues:    BindingIssue[] = [];
        const consumed = new Set<string>();

        for (const panel of panels) {
            const ds   = panel.dataSource;
            const data = state[ds];
            consumed.add(ds);

            // missing-source：state 缺少此 panel 所需的 dataSource
            if (data === undefined) {
                const issue: BindingIssue = {
                    kind:       'missing-source',
                    dataSource: ds,
                    message:    `[DataBindingValidator] missing-source: ChildPanel "${ds}" 在 content state 中找不到對應資料`,
                };
                issues.push(issue);
                UCUFLogger.warn(LogCategory.DATA, issue.message);
                continue;
            }

            // format-mismatch：validateDataFormat() 回傳錯誤訊息
            let errMsg: string | null = null;
            try {
                errMsg = panel.validateDataFormat(data);
            } catch (e) {
                errMsg = 'validateDataFormat threw an exception';
                UCUFLogger.warn(LogCategory.DATA, `[DataBindingValidator] validateDataFormat 拋出例外 dataSource="${ds}":`, e);
            }
            if (errMsg !== null) {
                const issue: BindingIssue = {
                    kind:       'format-mismatch',
                    dataSource: ds,
                    message:    `[DataBindingValidator] format-mismatch: ChildPanel "${ds}" validateDataFormat() 回傳錯誤：${errMsg}`,
                };
                issues.push(issue);
                UCUFLogger.warn(LogCategory.DATA, issue.message);
            }
        }

        // unused-key：state 中有 key 但沒有任何 ChildPanel 消費
        for (const key of Object.keys(state)) {
            if (!consumed.has(key)) {
                const issue: BindingIssue = {
                    kind:       'unused-key',
                    dataSource: key,
                    message:    `[DataBindingValidator] unused-key: state key "${key}" 未被任何 ChildPanel 消費`,
                };
                issues.push(issue);
                UCUFLogger.warn(LogCategory.DATA, issue.message);
            }
        }

        return issues;
    }
}
