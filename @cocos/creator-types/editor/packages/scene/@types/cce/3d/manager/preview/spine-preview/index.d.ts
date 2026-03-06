import { InteractivePreview } from '../Interactive-preview';
import { Scene, sp } from 'cc';
interface ISpineData {
    trackIndex: number;
    trackTotals: number;
    loop: boolean;
    timeScale: number;
    useTint: boolean;
    debugSlots: boolean;
    debugBones: boolean;
    debugMesh: boolean;
    premultipliedAlpha: boolean;
    skin: {
        list: Record<string, string | number>;
        index: number;
    };
    animation: {
        list: Record<string, string | number>;
        index: number;
        durations: Array<number>;
    };
}
export declare class SpinePreview extends InteractivePreview {
    protected enableViewToggle: boolean;
    protected is2D: boolean;
    protected orthoScale: number;
    private skeletonComponent;
    private _animUpdateInterval;
    private _fps;
    private isPaused;
    private spineData;
    private currentAnimationIndex;
    private currentTime;
    private trackTotals;
    private trackIndex;
    /**
     * 创建必要的节点与组件
     */
    createNodes(scene: Scene): void;
    /**
     * 是否资源
     * @param uuid
     * @private
     */
    private releaseAsset;
    /**
     * 重置并复位摄像机视角
     */
    resetCameraView(): void;
    setTrackIndex(idx: number): Promise<void>;
    /**
     * 设置 Spine 数据并返回 ISpineData 结构的数据
     * @param uuid
     */
    setSpine(uuid: string): Promise<ISpineData | null>;
    /**
     * 清理资源和状态
     */
    close(): void;
    /**
     * 设置皮肤
     * @param index
     */
    setSkinIndex(index: number): void;
    /**
     * 设置动画
     * @param index
     */
    setAnimationIndex(index?: number): void;
    /**
     * 获取动画名称
     */
    private getAnimationNameByIndex;
    /**
     * 播放
     */
    play(): void;
    /**
     * 暂停
     * @param time - 暂停的时间
     */
    pause(time?: number): void;
    /**
     * 停止
     */
    stop(): void;
    /**
     * 跳到第一帧
     */
    rewind(): void;
    /**
     * 上一帧
     */
    prevPlay(): void;
    /**
     * 下一帧
     */
    nextPlay(): void;
    /**
     * 跳到最后一帧
     */
    forward(): void;
    /**
     * 设置 Spine 属性
     * @param funcName
     * @param value
     */
    setProperties<K extends keyof sp.Skeleton>(funcName: K, value: sp.Skeleton[K]): void;
    /**
     * 设置当前时间
     * @param time
     * @param current
     */
    setCurrentTime(time: number, current?: sp.spine.TrackEntry): void;
    /**
     * 广播动画数据进行同步
     * @private
     */
    private broadcastAnimationInfo;
    /**
     * 开始动画更新，用于更新 Spine 动画进度条
     * @private
     */
    private startAnimationUpdate;
    /**
     * 清除动画更新
     * @private
     */
    private clearAnimationUpdate;
    /**
     * 获取当前 Spine 动画状态
     * @private
     */
    private getCurrent;
    /**
     * 是否播放中
     * @private
     */
    private get isPlaying();
    /**
     * 更新
     * @private
     */
    private update;
}
export {};
