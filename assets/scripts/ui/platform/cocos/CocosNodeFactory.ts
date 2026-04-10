/**
 * CocosNodeFactory
 *
 * INodeFactory 的 Cocos Creator 3.x 具體實作。
 * 委派給已有的 UIPreviewNodeFactory 實作；此檔案作為引擎耦合的單一聚合點。
 *
 * 使用方式：
 *   const factory = new CocosNodeFactory(skinResolver, styleBuilder, layoutBuilder);
 *   const panel = await factory.buildPanel(parentNode, spec);
 *
 * Unity 對照：UnityNodeFactory（同介面，換 Unity API 實作）
 */
import { Node } from 'cc';
import { UIPreviewNodeFactory } from '../../core/UIPreviewNodeFactory';
import { UIPreviewStyleBuilder } from '../../core/UIPreviewStyleBuilder';
import { UIPreviewLayoutBuilder } from '../../core/UIPreviewLayoutBuilder';
import { UISkinResolver } from '../../core/UISkinResolver';
import type { INodeFactory, NodeHandle } from '../../core/interfaces/INodeFactory';
import type { UILayoutNodeSpec } from '../../core/UISpecTypes';

export class CocosNodeFactory implements INodeFactory {

    private readonly inner: UIPreviewNodeFactory;

    constructor(skinResolver: UISkinResolver, styleBuilder: UIPreviewStyleBuilder, layoutBuilder: UIPreviewLayoutBuilder) {
        this.inner = new UIPreviewNodeFactory(skinResolver, styleBuilder, layoutBuilder);
    }

    /** 同步更新 i18n 字串表（由外部在每次 buildScreen 前呼叫） */
    setI18nStrings(strings: Record<string, string>): void {
        this.inner.i18nStrings = strings;
    }

    async buildPanel(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        const node = new Node(spec.name ?? 'Panel');
        (parent as Node).addChild(node);
        await this.inner.buildPanel(node, spec);
        return node;
    }

    async buildLabel(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        const node = new Node(spec.name ?? 'Label');
        (parent as Node).addChild(node);
        await this.inner.buildLabel(node, spec);
        return node;
    }

    async buildButton(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        const node = new Node(spec.name ?? 'Button');
        (parent as Node).addChild(node);
        await this.inner.buildButton(node, spec);
        return node;
    }

    async buildImage(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        const node = new Node(spec.name ?? 'Image');
        (parent as Node).addChild(node);
        await this.inner.buildImage(node, spec);
        return node;
    }

    async buildScrollList(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle> {
        const node = new Node(spec.name ?? 'ScrollList');
        (parent as Node).addChild(node);
        await this.inner.buildScrollList(node, spec);
        return node;
    }

    createContainer(parent: NodeHandle, name: string): NodeHandle {
        const node = new Node(name);
        (parent as Node).addChild(node);
        return node;
    }
}
