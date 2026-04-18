/**
 * UnityNodeFactory (stub)
 *
 * INodeFactory 的 Unity 引擎 stub。
 * 實作以 TODO 佔位，供跨引擎移植時填充。
 *
 * Unity 對照：UIFactory / UIComponentBuilder
 */
import type { INodeFactory, NodeHandle } from '../../core/interfaces/INodeFactory';
import type { UILayoutNodeSpec } from '../../core/UISpecTypes';
import type {
    ICompositeRenderer,
    RadarChartConfig,
    GridConfig,
    ProgressBarConfig,
} from '../../core/interfaces/ICompositeRenderer';
import type { IScrollVirtualizer } from '../../core/interfaces/IScrollVirtualizer';

export class UnityNodeFactory implements INodeFactory {

    async buildPanel(_parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        throw new Error(`UnityNodeFactory.buildPanel not implemented for spec: ${spec.name}`);
    }

    async buildLabel(_parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        throw new Error(`UnityNodeFactory.buildLabel not implemented for spec: ${spec.name}`);
    }

    async buildButton(_parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        throw new Error(`UnityNodeFactory.buildButton not implemented for spec: ${spec.name}`);
    }

    async buildImage(_parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        throw new Error(`UnityNodeFactory.buildImage not implemented for spec: ${spec.name}`);
    }

    async buildScrollList(_parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        throw new Error(`UnityNodeFactory.buildScrollList not implemented for spec: ${spec.name}`);
    }

    createContainer(_parent: NodeHandle, name: string): NodeHandle {
        throw new Error(`UnityNodeFactory.createContainer not implemented for: ${name}`);
    }
}

// ─── UCUF M3 Unity Stubs ──────────────────────────────────────────────────────

/**
 * UnityCompositeRenderer (stub)
 *
 * ICompositeRenderer 的 Unity 引擎 stub（UCUF M3）。
 * 移植時以 Unity Shader / MeshRenderer / UIManipulator 取代。
 */
export class UnityCompositeRenderer implements ICompositeRenderer {

    async drawRadarChart(_parent: NodeHandle, _config: RadarChartConfig): Promise<NodeHandle> {
        throw new Error('UnityCompositeRenderer.drawRadarChart not implemented');
    }

    async drawGrid(_parent: NodeHandle, _config: GridConfig): Promise<NodeHandle> {
        throw new Error('UnityCompositeRenderer.drawGrid not implemented');
    }

    async drawProgressBar(_parent: NodeHandle, _config: ProgressBarConfig): Promise<NodeHandle> {
        throw new Error('UnityCompositeRenderer.drawProgressBar not implemented');
    }

    updateRadarChart(_chartNode: NodeHandle, _config: RadarChartConfig): void {
        throw new Error('UnityCompositeRenderer.updateRadarChart not implemented');
    }

    updateProgressBar(_barNode: NodeHandle, _current: number, _max: number): void {
        throw new Error('UnityCompositeRenderer.updateProgressBar not implemented');
    }
}

/**
 * UnityScrollVirtualizer (stub)
 *
 * IScrollVirtualizer 的 Unity 引擎 stub（UCUF M3）。
 * 移植時以 Unity ScrollRect + ObjectPool 取代。
 */
export class UnityScrollVirtualizer implements IScrollVirtualizer {

    onItemRender: ((index: number, node: NodeHandle) => void) | null = null;

    attach(_scrollNode: NodeHandle, _totalCount: number, _itemHeight: number, _bufferCount?: number): void {
        throw new Error('UnityScrollVirtualizer.attach not implemented');
    }

    detach(): void {
        throw new Error('UnityScrollVirtualizer.detach not implemented');
    }

    updateData(_totalCount: number): void {
        throw new Error('UnityScrollVirtualizer.updateData not implemented');
    }

    getVisibleRange(): { start: number; end: number } {
        throw new Error('UnityScrollVirtualizer.getVisibleRange not implemented');
    }

    recycleAll(): void {
        throw new Error('UnityScrollVirtualizer.recycleAll not implemented');
    }
}

