import { Vec3, Vec2, Node, Texture2D } from 'cc';
import { GizmoMouseEvent } from '../gizmo-operation';
import ControllerBase from './base';
declare class ImageController extends ControllerBase {
    private _center;
    private _size;
    private _imageNode;
    private _imageMR;
    constructor(rootNode: Node, opts?: any);
    initShape(opts?: any): void;
    setTexture(texture: Texture2D | null): void;
    setTextureByUUID(uuid: string): void;
    updateSize(center: Vec3, size: Vec2): void;
    protected onMouseDown(event: GizmoMouseEvent): boolean | void;
    protected onMouseMove(event: GizmoMouseEvent): boolean | void;
    protected onMouseUp(event: GizmoMouseEvent): boolean | void;
}
export default ImageController;
