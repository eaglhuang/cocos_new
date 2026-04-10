// @spec-source → 見 docs/cross-reference-index.md
/**
 * UIValidationRunner — UI 規格驗證器
 *
 * 在預覽建構完成後，自動檢查常見的 UI 問題：
 *   1. 九宮格 border 是否為整數像素
 *   2. 觸控熱區是否 ≥ 44×44px
 *   3. 文字是否可能溢出
 *   4. 缺少 skin slot 的節點清單
 *   5. 百分比寬度加總是否 ≤ 100%
 *
 * Unity 對照：EditorWindow 驗證器 + Automated UI testing
 */

import type { UILayoutSpec, UISkinManifest, UILayoutNodeSpec, SkinSlot } from './UISpecTypes';
import { resolveSize } from './UISpecTypes';

/** 單一驗證問題 */
export interface ValidationIssue {
    /** 嚴重度 */
    severity: 'error' | 'warning' | 'info';
    /** 節點路徑（如 "HeaderBar > ColName"） */
    path: string;
    /** 問題描述 */
    message: string;
    /** 建議修正 */
    suggestion?: string;
}

/** 驗證結果 */
export interface ValidationResult {
    /** 是否全部通過 */
    passed: boolean;
    /** 問題列表 */
    issues: ValidationIssue[];
    /** 統計 */
    stats: {
        totalNodes: number;
        errors: number;
        warnings: number;
    };
}

export class UIValidationRunner {

    private issues: ValidationIssue[] = [];
    private totalNodes = 0;

    /**
     * 執行完整驗證
     */
    validate(layout: UILayoutSpec, skin: UISkinManifest): ValidationResult {
        this.issues = [];
        this.totalNodes = 0;

        // 1. 驗證 skin 的九宮格
        this._validateSkinBorders(skin);

        // 2. 遞迴驗證節點樹
        const designWidth = layout.canvas.designWidth ?? 1920;
        const designHeight = layout.canvas.designHeight ?? 1024;
        this._validateNode(layout.root, '', designWidth, designHeight, skin);

        const errors = this.issues.filter(i => i.severity === 'error').length;
        const warnings = this.issues.filter(i => i.severity === 'warning').length;

        return {
            passed: errors === 0,
            issues: this.issues,
            stats: {
                totalNodes: this.totalNodes,
                errors,
                warnings,
            },
        };
    }

    // ── Skin 層級驗證 ───────────────────────────────────────

    private _validateSkinBorders(skin: UISkinManifest): void {
        for (const [slotId, slot] of Object.entries(skin.slots)) {
            if (slot.kind === 'label-style') continue;

            const border = (slot as any).border as [number, number, number, number] | undefined;
            if (border) {
                // 檢查 border 是否為整數
                for (let i = 0; i < 4; i++) {
                    if (!Number.isInteger(border[i])) {
                        this.issues.push({
                            severity: 'error',
                            path: `skin.${slotId}`,
                            message: `九宮格 border[${i}] = ${border[i]} 不是整數像素`,
                            suggestion: `改為 ${Math.round(border[i])}`,
                        });
                    }
                }

                // 檢查是否有狀態圖 border 不一致
                if (slot.kind === 'button-skin') {
                    // 按鈕的所有狀態圖應共用同一 border
                    // （此處只驗證 border 存在性，實際一致性需讀取多個 slot）
                }
            }
        }
    }

    // ── 節點樹遞迴驗證 ──────────────────────────────────────

    private _validateNode(
        spec: UILayoutNodeSpec,
        parentPath: string,
        parentWidth: number,
        parentHeight: number,
        skin: UISkinManifest,
    ): void {
        this.totalNodes++;
        const path = parentPath ? `${parentPath} > ${spec.name}` : spec.name;

        const w = resolveSize(spec.width, parentWidth);
        const h = resolveSize(spec.height, parentHeight);

        // ── 檢查觸控熱區 ────────────────────────────────────
        if (spec.type === 'button') {
            if (w < 44 || h < 44) {
                this.issues.push({
                    severity: 'warning',
                    path,
                    message: `按鈕尺寸 ${w}×${h} 小於最小觸控目標 44×44px`,
                    suggestion: '將寬高設為至少 44px 以確保手機觸控友善',
                });
            }
        }

        // ── 檢查百分比加總 ──────────────────────────────────
        if (spec.children && spec.layout?.type === 'horizontal') {
            let totalPct = 0;
            let hasPct = false;
            for (const child of spec.children) {
                if (typeof child.width === 'string' && child.width.endsWith('%')) {
                    totalPct += parseFloat(child.width);
                    hasPct = true;
                }
            }
            if (hasPct && totalPct > 100) {
                this.issues.push({
                    severity: 'error',
                    path,
                    message: `子節點百分比寬度加總 ${totalPct}% 超過 100%`,
                    suggestion: '調整各子節點的百分比寬度使加總 ≤ 100%',
                });
            }
        }

        // ── 檢查 skinSlot 是否存在 ──────────────────────────
        if (spec.skinSlot && !skin.slots[spec.skinSlot]) {
            this.issues.push({
                severity: 'warning',
                path,
                message: `skinSlot "${spec.skinSlot}" 在 skin manifest 中不存在`,
                suggestion: '將使用白模 fallback 顯示。若需正式圖，請在 skin 中新增此 slot',
            });
        }
        if (spec.styleSlot && !skin.slots[spec.styleSlot]) {
            this.issues.push({
                severity: 'info',
                path,
                message: `styleSlot "${spec.styleSlot}" 在 skin manifest 中不存在，將使用預設字型`,
            });
        }

        // ── 檢查 label 可能溢出 ─────────────────────────────
        if (spec.type === 'label' && spec.textKey) {
            // 簡易估算：中文每字約 fontSize 寬，英文約 fontSize × 0.6
            // 這裡只做保守預警
            if (w > 0 && w < 60 && spec.textKey) {
                this.issues.push({
                    severity: 'warning',
                    path,
                    message: `Label 寬度 ${w}px 極窄，文字 "${spec.textKey}" 可能溢出`,
                    suggestion: '增加寬度或使用 overflow: SHRINK',
                });
            }
        }

        // ── 檢查 label overflow 保護 ────────────────────────
        if (spec.type === 'label' && spec.styleSlot) {
            const slot = skin.slots[spec.styleSlot];
            if (slot && slot.kind === 'label-style') {
                const overflow = (slot as any).overflow as string | undefined;
                if (!overflow) {
                    this.issues.push({
                        severity: 'info',
                        path,
                        message: `styleSlot "${spec.styleSlot}" 未指定 overflow，builder 將自動套用 SHRINK`,
                        suggestion: '建議在 skin 中明確加上 "overflow": "SHRINK"',
                    });
                }
            }
        }

        // ── 檢查 Layout 容器子節點溢出 ──────────────────────
        if (spec.children && spec.layout) {
            const isVertical = spec.layout.type === 'vertical';
            const isHorizontal = spec.layout.type === 'horizontal';
            if (isVertical || isHorizontal) {
                const containerSize = isVertical ? h : w;
                const padStart = isVertical
                    ? (spec.layout.paddingTop ?? 0) : (spec.layout.paddingLeft ?? 0);
                const padEnd = isVertical
                    ? (spec.layout.paddingBottom ?? 0) : (spec.layout.paddingRight ?? 0);
                const layoutSpacing = spec.layout.spacing ?? 0;

                let totalChildSize = 0;
                let childCount = 0;
                for (const child of spec.children) {
                    const childSize = isVertical
                        ? resolveSize(child.height, h)
                        : resolveSize(child.width, w);
                    totalChildSize += childSize;
                    childCount++;
                }
                const totalSpacing = Math.max(0, childCount - 1) * layoutSpacing;
                const available = containerSize - padStart - padEnd;
                const totalRequired = totalChildSize + totalSpacing;

                if (available > 0 && totalRequired > available) {
                    const overflow = totalRequired - available;
                    this.issues.push({
                        severity: 'error',
                        path,
                        message: `Layout 子節點總尺寸 ${Math.round(totalRequired)}px 超出容器可用空間 ${Math.round(available)}px（溢出 ${Math.round(overflow)}px）`,
                        suggestion: '減少子節點尺寸、改用 Widget 彈性拉伸、或增加容器高度。builder 會在 runtime 自動縮減子節點。',
                    });
                }
            }
        }

        // ── 遞迴子節點 ──────────────────────────────────────
        if (spec.children) {
            for (const child of spec.children) {
                this._validateNode(child, path, w, h, skin);
            }
        }
        if (spec.itemTemplate) {
            this._validateNode(spec.itemTemplate, `${path} > [template]`, w, h as number, skin);
        }
    }

    /**
     * 格式化驗證結果為 Markdown 報告
     */
    static formatReport(result: ValidationResult): string {
        const lines: string[] = [];
        lines.push(`## UI 驗證報告`);
        lines.push('');
        lines.push(`- 節點總數：${result.stats.totalNodes}`);
        lines.push(`- 錯誤：${result.stats.errors}`);
        lines.push(`- 警告：${result.stats.warnings}`);
        lines.push(`- 結果：${result.passed ? '✅ 通過' : '❌ 未通過'}`);
        lines.push('');

        if (result.issues.length > 0) {
            lines.push('| 嚴重度 | 路徑 | 問題 | 建議修正 |');
            lines.push('|--------|------|------|----------|');
            for (const issue of result.issues) {
                const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
                lines.push(`| ${icon} ${issue.severity} | ${issue.path} | ${issue.message} | ${issue.suggestion ?? '-'} |`);
            }
        }

        return lines.join('\n');
    }
}
