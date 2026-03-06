export declare enum CameraShortcutUIType {
    Snap = "snap-shortcut",
    WanderShortcut = "wander-shortcut"
}
interface ShowTipOptions {
    type: CameraShortcutUIType;
    duration: number;
}
export declare function showCameraShortcutTip(options: ShowTipOptions): void;
export declare function hideCameraShortcutTip(type: CameraShortcutUIType): void;
export {};
