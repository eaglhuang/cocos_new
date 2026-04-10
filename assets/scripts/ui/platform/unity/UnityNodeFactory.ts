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
