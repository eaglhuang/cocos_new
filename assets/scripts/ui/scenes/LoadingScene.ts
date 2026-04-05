// @spec-source → 見 docs/cross-reference-index.md
import {
    _decorator,
    Component,
    director,
    sys,
    Enum,
    SpriteFrame,
    Sprite,
    Node,
    UITransform,
    Widget,
    resources,
} from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { UIScreenPreviewHost } from '../components/UIScreenPreviewHost';

const { ccclass, property } = _decorator;

enum LoadingPreviewTarget {
    Disabled = 0,
    LobbyMain = 1,
    ShopMain = 2,
    Gacha = 3,
    DuelChallenge = 4,
    BattleScene = 5,
}

/**
 * LoadingScene - 中繼轉場場景
 * 
 * 核心功能：
 * 1. 顯示動態載入進度 (白模)
 * 2. 徹底釋放前一個場景的資源 (releaseUnusedAssets)
 * 3. 確保轉場過程中記憶體不會疊加 (A -> Loading -> B)
 */
@ccclass('LoadingScene')
export class LoadingScene extends Component {

    @property({ tooltip: '背景圖的 resources 路徑（不含副檔名）' })
    public bgTexturePath: string = 'textures/bg_normal_day';

    @property({ tooltip: '開發用：啟用後停留在 LoadingScene.scene，改為載入指定 screen-driven preview，不執行正常場景切換。' })
    public previewMode = false;

    @property({
        type: Enum(LoadingPreviewTarget),
        tooltip: '開發用：選擇要在 LoadingScene.scene 中預覽的 screen-driven UI。',
    })
    public previewTarget: LoadingPreviewTarget = LoadingPreviewTarget.Disabled;

    private _bgNode: Node | null = null;
    private _bgSpriteFrame: SpriteFrame | null = null;
    private _previewHost: UIScreenPreviewHost | null = null;

    private _setCaptureState(status: 'loading' | 'ready' | 'error', screenId: string, error?: unknown): void {
        const globalScope = globalThis as any;
        globalScope.__UI_CAPTURE_STATE__ = {
            status,
            screenId,
            timestamp: Date.now(),
            error: error ? String(error) : undefined,
        };

        try {
            sys.localStorage.setItem('UI_CAPTURE_STATE', JSON.stringify(globalScope.__UI_CAPTURE_STATE__));
        } catch {
            // localStorage 在部分環境可能不可用，不影響主流程
        }
    }

    private _applyPreviewParamsFromQuery(): void {
        const globalScope = globalThis as any;
        const search = globalScope?.window?.location?.search as string | undefined;
        if (!search || search.length <= 1) {
            return;
        }

        const query = new URLSearchParams(search);
        const mode = query.get('previewMode') ?? query.get('PREVIEW_MODE');
        const target = query.get('previewTarget') ?? query.get('PREVIEW_TARGET');

        if (mode === 'true' || mode === '1') {
            this.previewMode = true;
        }
        if (target) {
            const targetValue = parseInt(target, 10);
            if (!Number.isNaN(targetValue)) {
                this.previewTarget = targetValue;
            }
        }
    }

    private _resolvePreviewScreenId(): string {
        switch (this.previewTarget) {
        case LoadingPreviewTarget.LobbyMain:
            return 'lobby-main-screen';
        case LoadingPreviewTarget.ShopMain:
            return 'shop-main-screen';
        case LoadingPreviewTarget.Gacha:
            return 'gacha-main-screen';
        case LoadingPreviewTarget.DuelChallenge:
            return 'duel-challenge-screen';
        case LoadingPreviewTarget.BattleScene:
            return 'battle-scene';
        case LoadingPreviewTarget.Disabled:
        default:
            return 'lobby-main-screen';
        }
    }

    onLoad() {
        this._applyPreviewParamsFromQuery();

        // [UI-2-0023] 支援從 sys.localStorage 注入 previewMode，方便 headless 自動化
        const storedPreviewMode = sys.localStorage.getItem('PREVIEW_MODE');
        if (storedPreviewMode === 'true') {
            this.previewMode = true;
            const storedTarget = sys.localStorage.getItem('PREVIEW_TARGET');
            if (storedTarget) {
                this.previewTarget = parseInt(storedTarget, 10);
            }
        }

        if (this.previewMode) {
            this._buildPreviewHost();
            return;
        }
        this._buildUI();
    }

    start() {
        if (this.previewMode) {
            void this._startPreview();
            return;
        }
        this._startTransition();
    }

    /** 動態建立白模 UI */
    private _buildUI() {
        const root = this._resolveRootNode();

        // 建立背景節點
        this._bgNode = new Node('LoadingBackground');
        this._bgNode.layer = root.layer;
        root.addChild(this._bgNode);

        const tf = this._bgNode.addComponent(UITransform);
        tf.setContentSize(1920, 1080);
        
        const widget = this._bgNode.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        // 載入背景圖
        this._loadBackground();
    }

    private _buildPreviewHost() {
        const root = this._resolveRootNode();
        let previewNode = root.getChildByName('UIScreenPreviewHost');
        if (!previewNode) {
            previewNode = new Node('UIScreenPreviewHost');
            previewNode.layer = root.layer;
            root.addChild(previewNode);
        }

        const tf = previewNode.getComponent(UITransform) ?? previewNode.addComponent(UITransform);
        tf.setContentSize(1920, 1080);

        const widget = previewNode.getComponent(Widget) ?? previewNode.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        this._previewHost = previewNode.getComponent(UIScreenPreviewHost) ?? previewNode.addComponent(UIScreenPreviewHost);
    }

    private _resolveRootNode(): Node {
        const canvas = director.getScene()?.getComponentInChildren('cc.Canvas') as any;
        return canvas ? canvas.node : this.node;
    }

    private _loadBackground() {
        if (!this.bgTexturePath || !this._bgNode || !this._bgNode.isValid) return;

        // 💡 Cocos 3.x 技巧：resources.load 載入 SpriteFrame。
        const path = this.bgTexturePath;
        
        console.log(`[LoadingScene] 嘗試載入背景: ${path}`);
        
        resources.load<SpriteFrame>(path, SpriteFrame, (err, sf) => {
            if (!this._bgNode || !this._bgNode.isValid || !this.isValid) return;
            if (err) {
                // 備援：嘗試強制 /spriteFrame 後綴
                resources.load<SpriteFrame>(path + '/spriteFrame', SpriteFrame, (err2, sf2) => {
                    if (err2) {
                        console.warn(`[LoadingScene] 背景圖載入失敗: ${path}，Fallback 黑畫面。`);
                        return;
                    }
                    this._applySpriteFrame(sf2);
                });
                return;
            }
            this._applySpriteFrame(sf);
        });
    }

    private _applySpriteFrame(sf: SpriteFrame) {
        if (!this._bgNode || !this._bgNode.isValid || !this.isValid) return;

        this._bgSpriteFrame = sf;
        this._bgSpriteFrame.addRef();
        
        let spr = this._bgNode.getComponent(Sprite);
        if (!spr) spr = this._bgNode.addComponent(Sprite);
        spr.spriteFrame = this._bgSpriteFrame;
    }

    private async _startPreview(): Promise<void> {
        if (!this._previewHost) {
            this._buildPreviewHost();
        }

        const fallbackScreenId = this._resolvePreviewScreenId();
        this._setCaptureState('loading', fallbackScreenId);

        try {
            switch (this.previewTarget) {
            case LoadingPreviewTarget.LobbyMain:
                await this._previewLobbyMain();
                this._setCaptureState('ready', 'lobby-main-screen');
                return;
            case LoadingPreviewTarget.ShopMain:
                await this._previewShopMain();
                this._setCaptureState('ready', 'shop-main-screen');
                return;
            case LoadingPreviewTarget.Gacha:
                await this._previewGacha();
                this._setCaptureState('ready', 'gacha-main-screen');
                return;
            case LoadingPreviewTarget.DuelChallenge:
                await this._previewDuelChallenge();
                this._setCaptureState('ready', 'duel-challenge-screen');
                return;
            case LoadingPreviewTarget.BattleScene:
                await this._previewBattleScene();
                return;
            case LoadingPreviewTarget.Disabled:
            default:
                console.warn('[LoadingScene] previewMode=true 但 previewTarget 未指定，預設載入 lobby-main-screen');
                await this._previewLobbyMain();
                this._setCaptureState('ready', 'lobby-main-screen');
                return;
            }
        } catch (error) {
            this._setCaptureState('error', fallbackScreenId, error);
            throw error;
        }
    }

    private async _previewLobbyMain(): Promise<void> {
        console.log('[LoadingScene] Preview target -> lobby-main-screen');
        await this._previewHost?.showScreen('lobby-main-screen');
    }

    private async _previewShopMain(): Promise<void> {
        console.log('[LoadingScene] Preview target -> shop-main-screen');
        await this._previewHost?.showScreen('shop-main-screen');
    }

    private async _previewGacha(): Promise<void> {
        console.log('[LoadingScene] Preview target -> gacha-main-screen');
        await this._previewHost?.showScreen('gacha-main-screen');
    }

    private async _previewDuelChallenge(): Promise<void> {
        console.log('[LoadingScene] Preview target -> duel-challenge-screen');
        await this._previewHost?.showScreen('duel-challenge-screen');
    }

    private async _previewBattleScene(): Promise<void> {
        console.log('[LoadingScene] Preview target -> BattleScene.scene');
        await new Promise<void>((resolve, reject) => {
            director.loadScene('BattleScene', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }

    private async _startTransition() {
        const target = services().scene.getTargetScene();
        if (!target.name) return;

        console.log(`[LoadingScene] 資源清理完畢，開始預載入 ${target.name}...`);

        // 徹底釋放舊資源
        // @ts-ignore
        const resBundle = resources as any;
        if (typeof resBundle.releaseAll === 'function') resBundle.releaseAll();

        if (sys.isNative) {
            // @ts-ignore
            if (typeof garbageCollect === 'function') garbageCollect();
        }

        // 預載入目標場景
        director.preloadScene(target.name, (completedCount, totalCount) => {
            // 此處可更新進度條 UI
        }, async (error) => {
            if (error) {
                console.error(`[LoadingScene] 載入場景 ${target.name}失敗:`, error);
                return;
            }

            // ⚠️ 關鍵：切換前釋放 LoadingScene 自身的資源
            if (this._bgSpriteFrame) {
                this._bgSpriteFrame.decRef();
                this._bgSpriteFrame = null;
            }

            // 正式進入目標場景
            director.loadScene(target.name);
        });
    }
}
