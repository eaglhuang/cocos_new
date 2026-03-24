import { _decorator, Component, Sprite, SpriteFrame, UITransform, resources } from "cc";

const { ccclass, property, executeInEditMode } = _decorator;

/**
 * SpriteFrameAnimator
 * 
 * 從 resources 資料夾動態載入一組 SpriteFrame，
 * 並以指定 FPS 播放，做為輕量的幀動畫控制器。
 * 
 * 類比 Unity: 類似 Animator + AnimationClip（逐幀 Sprite），
 * 但沒有狀態機——只做單迴圈播放。
 * 
 * 用法:
 *   - framesPath: SpriteFrame 所在的 resources 子路徑（如 "sprites/zhangfei/idle"）
 *   - fps: 播放速率（幀/秒）
 *   - autoCenter: 是否自動將 UITransform 尺寸設為第一幀大小
 */
@ccclass("SpriteFrameAnimator")
export class SpriteFrameAnimator extends Component {

    @property({ tooltip: "SpriteFrame 所在的 resources 子路徑（不含副檔名）" })
    public framesPath: string = "";

    @property({ tooltip: "幀動畫播放速率（幀/秒）" })
    public fps: number = 8;

    @property({ tooltip: "是否自動讓 UITransform 大小對齊第一幀尺寸" })
    public autoCenter: boolean = true;

    private _frames: SpriteFrame[] = [];
    private _currentIndex: number = 0;
    private _elapsed: number = 0;
    private _sprite: Sprite | null = null;

    onLoad(): void {
        this._sprite = this.getComponent(Sprite);
        this._loadFrames();
    }

    onDestroy(): void {
        this._frames = [];
    }

    update(dt: number): void {
        if (this._frames.length < 2 || !this._sprite) return;

        this._elapsed += dt;
        const interval = 1 / Math.max(this.fps, 1);
        if (this._elapsed >= interval) {
            this._elapsed -= interval;
            this._currentIndex = (this._currentIndex + 1) % this._frames.length;
            this._sprite.spriteFrame = this._frames[this._currentIndex];
        }
    }

    // ─── 公開 API ───────────────────────────────────────────────────────────

    /** 重新從頭播放 */
    public restart(): void {
        this._currentIndex = 0;
        this._elapsed = 0;
        if (this._sprite && this._frames.length > 0) {
            this._sprite.spriteFrame = this._frames[0];
        }
    }

    /** 切換幀路徑並重新載入（例如從 idle→attack） */
    public playPath(path: string): void {
        if (this.framesPath === path) return;
        this.framesPath = path;
        this._frames = [];
        this._loadFrames();
    }

    // ─── 內部 ────────────────────────────────────────────────────────────────

    private _loadFrames(): void {
        if (!this.framesPath) return;

        resources.loadDir(this.framesPath, SpriteFrame, (err, frames: SpriteFrame[]) => {
            if (err) {
                // 資料夾不存在或無幀，靜默忽略（Demo 階段美術尚未就緒時常見）
                return;
            }
            if (!frames || frames.length === 0) return;

            // 依名稱排序確保播放順序穩定
            this._frames = frames.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            this._currentIndex = 0;
            this._elapsed = 0;

            if (this._sprite) {
                this._sprite.spriteFrame = this._frames[0];
            }

            if (this.autoCenter) {
                const ut = this.getComponent(UITransform);
                const first = this._frames[0];
                if (ut && first && first.rect) {
                    ut.setContentSize(first.rect.width, first.rect.height);
                }
            }
        });
    }
}
