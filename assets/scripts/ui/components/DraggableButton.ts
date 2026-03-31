// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, EventTouch, Node, UITransform, Vec3, Camera, geometry } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('DraggableButton')
export class DraggableButton extends Component {
    @property(Camera) mainCamera: Camera = null!;
}
