/**
 * INodeFactory
 *
 * 引擎無關的 UI 節點建構介面。
 * 具體實作位於 platform/cocos/CocosNodeFactory.ts（Cocos Creator） 或
 * platform/unity/UnityNodeFactory.ts（Unity stub）。
 *
 * 設計原則：
 *   - 所有方法只接受 UILayoutNodeSpec（純資料），不持有引擎場景狀態
 *   - 回傳 Promise，允許需要非同步 asset 載入的實作
 *   - 不含 skin / style 邏輯（由 IStyleApplicator 負責）
 *
 * Unity 對照：UIFactory / UIComponentBuilder helper 的介面層
 */
import type { UILayoutNodeSpec } from '../UISpecTypes';

/** 節點的引擎無關句柄，具體型別由平台實作決定 */
export type NodeHandle = unknown;

export interface INodeFactory {
    /**
     * 建構面板容器節點（可帶背景 skin）。
     * Cocos: Node + UITransform; Unity: RectTransform + optional Image
     */
    buildPanel(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle>;

    /**
     * 建構標籤文字節點（含可選背景）。
     * Cocos: Node + Label + optional Background child; Unity: Text + Image
     */
    buildLabel(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle>;

    /**
     * 建構按鈕節點（含背景 + 可選文字子節點）。
     * Cocos: Node + Button + Sprite; Unity: Button + Image + optional Text
     */
    buildButton(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle>;

    /**
     * 建構圖片節點（Sprite）。
     * Cocos: Node + Sprite; Unity: Image
     */
    buildImage(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle>;

    /**
     * 建構捲動列表節點（ScrollView + Content + 可選 VerticalLayout）。
     * Cocos: ScrollView component; Unity: ScrollRect
     */
    buildScrollList(parent: NodeHandle, spec: UILayoutNodeSpec): Promise<NodeHandle>;

    /**
     * 建立空容器節點（用於分組佈局）。
     * Cocos: Node + UITransform; Unity: empty RectTransform
     */
    createContainer(parent: NodeHandle, name: string): NodeHandle;
}
