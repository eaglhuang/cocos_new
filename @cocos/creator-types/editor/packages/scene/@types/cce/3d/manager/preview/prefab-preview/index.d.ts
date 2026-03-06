import { InteractivePreview } from '../Interactive-preview';
import { Scene } from 'cc';
export declare class PrefabPreview extends InteractivePreview {
    private lightComp;
    private canvasNode;
    createNodes(scene: Scene): void;
    setPrefab(uuid: string): Promise<null | undefined>;
    /**
     * 重置并复位摄像机视角
     */
    resetCameraView(): void;
}
