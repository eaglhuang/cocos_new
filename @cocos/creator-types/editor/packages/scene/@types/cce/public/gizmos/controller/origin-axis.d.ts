import { Node, Color, Vec3, MeshRenderer, Camera } from 'cc';
import ControllerBase from './base';
export default class OriginAxisController extends ControllerBase {
    camera: Camera | null;
    xAxis: MeshRenderer | null;
    yAxis: MeshRenderer | null;
    zAxis: MeshRenderer | null;
    static changeCenterAxisVisible(controller: OriginAxisController | null, originAxis: {
        x_visible: boolean;
        y_visible: boolean;
        z_visible: boolean;
    }): void;
    constructor(rootNode: Node, camera: Camera);
    protected onCameraTransformChanged(): void;
    protected onShow(): void;
    protected onHide(): void;
    private appEditorLayer;
    private initShape;
    updateAxisLineTransform(): void;
    protected updateLineTransform(target: MeshRenderer | null, start: Vec3, end: Vec3): void;
    onDimensionChanged(): void;
    setColor(colors: Color[]): void;
    updateTransform(targetNode?: Node | null): void;
    setVisible(xAxisVisible: boolean, yAxisVisible: boolean, zAxisVisible: boolean): void;
}
