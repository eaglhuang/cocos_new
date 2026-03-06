import { Color, Label, Node, Size, Sprite, UITransform, Vec2, Vec3 } from 'cc';
import { RectangleController } from '../../node/rectangle-controller';
import type { IRectangleControllerOption } from '../../utils/defines';
export default class LODController extends RectangleController {
    static readonly BACKGROUND_CONTENT_SIZE: Size;
    static readonly BACKGROUND_COLOR: Color;
    static readonly FONT_COLOR: Color;
    static readonly FONT_SIZE = 80;
    static readonly LINE_HEIGHT = 80;
    label: Label;
    labelUITransform: UITransform;
    sprite: Sprite;
    spriteUITransform: UITransform;
    constructor(rootNode: Node, opts?: IRectangleControllerOption);
    private get2DCanvas;
    setString(str: string): void;
    initShape(): void;
    initLODContent(): void;
    updateSize(center: Readonly<Vec3>, size: Vec2): void;
    adjustControllerSize(): void;
}
