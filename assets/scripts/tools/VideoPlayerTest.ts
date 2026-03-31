// @spec-source → 見 docs/cross-reference-index.md
import {
    _decorator, Component, Node, VideoPlayer,
    UITransform, Canvas, find, Size, view, VideoClip,
    input, Input, EventKeyboard, KeyCode,
} from 'cc';

const { ccclass, property } = _decorator;

/**
 * VideoPlayer 全螢幕測試元件 v3
 *
 * 架構說明（Web 平台）：
 * - Cocos VideoPlayer 在 Web 上是原生 <video> DOM 元素，疊在 WebGL Canvas 之上
 * - 黑色遮罩改用純 CSS div（不用 WebGL Sprite），避免 WebGL 與 DOM 層級衝突
 * - VideoPlayer 節點直接掛在 Canvas 根節點（非任何有 UIOpacity 的父層下）
 * - _fixVideoCSS() 走訪所有 DOM 祖先層，強制清除 overflow:hidden / opacity 等剪裁屬性
 *
 * Unity 對照：等同於在 Unity WebGL build 中，直接在 HTML body 上疊加
 *            全螢幕 <video> 元素，繞過 Unity Canvas 的渲染層。
 *
 * 使用方式：
 * 1. 把此元件掛在 Canvas 下的任意節點
 * 2. 在 Inspector 填入 remoteURL（MP4 連結）或拖入 localClip
 * 3. 運行遊戲，按空白鍵播放，按 ESC 跳過
 */
@ccclass('VideoPlayerTest')
export class VideoPlayerTest extends Component {

    @property({ tooltip: '遠端影片 URL（H.264 MP4）' })
    public remoteURL: string = '';

    @property({ type: VideoClip, tooltip: '本地影片資源（優先於 remoteURL）' })
    public localClip: VideoClip | null = null;

    @property({ tooltip: '播放完畢後自動關閉' })
    public autoCloseOnComplete: boolean = true;

    @property({ tooltip: '允許跳過的秒數（0 = 不可跳過）' })
    public skipAfterSeconds: number = 2.0;

    // 內部狀態
    private _videoNode: Node | null = null;
    private _videoPlayer: VideoPlayer | null = null;
    private _cssOverlayDiv: HTMLElement | null = null;
    private _videoContainer: HTMLElement | null = null;  // <video> 容器 div（已搬到 body）
    private _nativeVideo: HTMLVideoElement | null = null; // <video> 元素本身，供最終清掃用
    private _isPlaying: boolean = false;
    private _playStartTime: number = 0;
    /** 影片結束（或跳過）後的回呼，在 overlay 開始淡出的瞬間觸發，場景特效與淡出同步進行 */
    private _onCompleteCallback: (() => void) | null = null;

    start() {
        console.log('[VideoPlayerTest] 就緒。按空白鍵播放影片，按 ESC 跳過。');
    }

    onEnable() {
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    }

    onDisable() {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    }

    private _onKeyDown(event: EventKeyboard) {
        if (event.keyCode === KeyCode.SPACE && !this._isPlaying) {
            this.playFullScreen();
        } else if (event.keyCode === KeyCode.ESCAPE && this._isPlaying) {
            this._trySkip();
        }
    }

    // ─────────────────────────────────────────
    //  公開 API
    // ─────────────────────────────────────────

    /**
     * 全螢幕播放影片。
     *
     * @param onComplete 影片播畢（或跳過）時的回呼。
     *   **觸發時機**: overlay 開始淡出的瞬間，此時黑幕正在 0.3s 淡出，
     *   遊戲場景特效可與淡出動畫同步播放，達到無縫銜接。 \
     *   Unity 對照: Timeline 的 Signal 或 PlayableDirector.stopped 事件。
     */
    public playFullScreen(onComplete?: () => void) {
        if (this._isPlaying) {
            console.warn('[VideoPlayerTest] 影片正在播放中');
            return;
        }
        if (!this.localClip && !this.remoteURL) {
            console.error('[VideoPlayerTest] 請設定 localClip 或 remoteURL');
            return;
        }

        console.log('[VideoPlayerTest] 開始播放...');
        this._isPlaying = true;
        this._playStartTime = Date.now() / 1000;
        this._onCompleteCallback = onComplete ?? null;

        // 1. 建立純 CSS 黑底遮罩（不走 WebGL，不干擾 DOM 分層）
        this._buildCssOverlay(0);

        // 2. CSS 遮罩淡入（0.3s）→ 建立 VideoPlayer
        setTimeout(() => {
            if (this._cssOverlayDiv) {
                this._cssOverlayDiv.style.opacity = '1';
            }
        }, 16);

        setTimeout(() => {
            this._buildVideoPlayer();
        }, 350);
    }

    // ─────────────────────────────────────────
    //  私有：CSS 遮罩
    // ─────────────────────────────────────────

    /**
     * 建立純 CSS 全螢幕黑底遮罩。
     * 不使用 WebGL Sprite，避免 WebGL 繪製層與 <video> DOM 層交叉遮蔽。
     */
    private _buildCssOverlay(initialOpacity: number) {
        if (typeof document === 'undefined') return;

        this._cssOverlayDiv = document.createElement('div');
        this._cssOverlayDiv.id = 'vp-cutscene-overlay';
        Object.assign(this._cssOverlayDiv.style, {
            position: 'fixed',
            top: '0', left: '0',
            width: '100vw', height: '100vh',
            background: '#000',
            opacity: String(initialOpacity),
            zIndex: '9998',
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
        });
        document.body.appendChild(this._cssOverlayDiv);

        // 跳過提示文字
        if (this.skipAfterSeconds > 0) {
            const tip = document.createElement('div');
            Object.assign(tip.style, {
                position: 'absolute',
                bottom: '40px', left: '50%',
                transform: 'translateX(-50%)',
                color: 'rgba(220,220,220,0)',
                fontSize: '20px',
                fontFamily: 'sans-serif',
                transition: 'color 0.5s',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
            });
            tip.textContent = 'ESC 跳過';
            this._cssOverlayDiv.appendChild(tip);

            setTimeout(() => {
                if (this._isPlaying) {
                    tip.style.color = 'rgba(220,220,220,0.85)';
                }
            }, this.skipAfterSeconds * 1000);
        }
    }

    // ─────────────────────────────────────────
    //  私有：建立 VideoPlayer
    // ─────────────────────────────────────────

    /**
     * 建立 VideoPlayer 節點。
     *
     * 關鍵：直接掛在 Canvas 根節點（不套在任何 UIOpacity 父層下），
     * 否則 Cocos 會把父層 opacity 同步到 <video> CSS，造成畫面不可見。
     */
    private _buildVideoPlayer() {
        const canvasNode = this._findCanvas();
        if (!canvasNode) {
            console.error('[VideoPlayerTest] 找不到 Canvas 節點');
            return;
        }

        this._videoNode = new Node('VideoPlayerNode');
        canvasNode.addChild(this._videoNode);
        this._videoNode.setSiblingIndex(canvasNode.children.length - 1);

        const visibleSize = view.getVisibleSize();
        const transform = this._videoNode.addComponent(UITransform);
        transform.setContentSize(new Size(visibleSize.width, visibleSize.height));
        this._videoNode.setPosition(0, 0, 0);

        this._videoPlayer = this._videoNode.addComponent(VideoPlayer);
        this._videoPlayer.keepAspectRatio = true;
        this._videoPlayer.playOnAwake = false;
        this._videoPlayer.loop = false;

        if (this.localClip) {
            this._videoPlayer.resourceType = VideoPlayer.ResourceType.LOCAL;
            this._videoPlayer.clip = this.localClip;
            console.log('[VideoPlayerTest] 使用本地影片');
        } else {
            this._videoPlayer.resourceType = VideoPlayer.ResourceType.REMOTE;
            this._videoPlayer.remoteURL = this.remoteURL;
            console.log('[VideoPlayerTest] 使用遠端影片: ' + this.remoteURL);
        }

        this._videoPlayer.node.on(VideoPlayer.EventType.READY_TO_PLAY, this._onReadyToPlay, this);
        this._videoPlayer.node.on(VideoPlayer.EventType.COMPLETED, this._onCompleted, this);
        this._videoPlayer.node.on(VideoPlayer.EventType.ERROR, this._onError, this);
        this._videoPlayer.node.on(VideoPlayer.EventType.PLAYING, this._onPlaying, this);

        // 延遲播放，確保元件初始化完成
        this.scheduleOnce(() => {
            if (this._videoPlayer?.isValid) {
                this._videoPlayer.play();
                // 再等一幀讓 Cocos 建立 <video> DOM 元素，然後修正 CSS
                this.scheduleOnce(() => this._fixVideoCSS(), 0.15);
            }
        }, 0.1);
    }

    /**
     * 修正 <video> DOM 可見性。
     *
     * 核心策略：把 <video> 的容器 div 直接搬到 document.body 下，
     * 完全脫離 Cocos DOM 樹，不再修改任何祖先 CSS。
     * 這樣不會污染 Cocos 遊戲容器的 overflow/width/height，
     * 解決「清理後遊戲解析度跑掉」的問題。
     *
     * Unity 對照：等同於把 <video> 元素放到 document.body 的最頂層，
     * 而非塞在 Unity canvas 的 DOM 容器內。
     */
    private _fixVideoCSS() {
        if (!this._videoPlayer?.isValid) return;

        const nativeVideo = (this._videoPlayer as any).nativeVideo as HTMLVideoElement | null;
        if (!nativeVideo) {
            console.warn('[VideoPlayerTest] nativeVideo 不存在（非 Web 平台），跳過 CSS 修正');
            return;
        }

        const container = nativeVideo.parentElement;
        if (!container) return;

        // 把整個容器 div 搬離 Cocos DOM 樹，直接掛到 body
        // 這樣完全不影響任何 Cocos 祖先層的 CSS
        document.body.appendChild(container);
        this._videoContainer = container;  // 儲存參照，供 cleanup 使用（不依賴 nativeVideo.parentElement）
        this._nativeVideo = nativeVideo;   // 儲存 <video> 本身，供最終清掃用

        // 設定容器為全螢幕 fixed（現在是 body 的直接子節點，無干擾）
        Object.assign(container.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: '9999',
            background: '#000',
            overflow: 'visible',
        });

        // <video> 本身撐滿容器
        Object.assign(nativeVideo.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '100vw',
            height: '100vh',
            objectFit: 'contain',
            background: '#000',
            display: 'block',
            visibility: 'visible',
            opacity: '1',
        });

        console.log('[VideoPlayerTest] <video> 已搬到 body 層，應可看到畫面');
    }

    // ─────────────────────────────────────────
    //  事件回呼
    // ─────────────────────────────────────────

    private _onReadyToPlay() {
        console.log('[VideoPlayerTest] 影片就緒，時長: ' + this._videoPlayer?.duration?.toFixed(1) + 's');
    }

    private _onPlaying() {
        console.log('[VideoPlayerTest] 影片播放中...');
    }

    private _onCompleted() {
        console.log('[VideoPlayerTest] 影片播放完畢，autoCloseOnComplete=' + this.autoCloseOnComplete);
        if (this.autoCloseOnComplete) {
            this._closePlayer();
        } else {
            console.warn('[VideoPlayerTest] autoCloseOnComplete=false，不會自動關閉。請按 ESC 或手動呼叫 _closePlayer()。');
        }
    }

    private _onError() {
        console.error('[VideoPlayerTest] 影片播放錯誤！請確認格式為 H.264 MP4');
        this._closePlayer();
    }

    // ─────────────────────────────────────────
    //  控制
    // ─────────────────────────────────────────

    private _trySkip() {
        if (!this._isPlaying) return;
        const elapsed = Date.now() / 1000 - this._playStartTime;
        if (this.skipAfterSeconds > 0 && elapsed < this.skipAfterSeconds) {
            console.log('[VideoPlayerTest] 還需 ' + (this.skipAfterSeconds - elapsed).toFixed(1) + 's 後才能跳過');
            return;
        }
        console.log('[VideoPlayerTest] 跳過影片');
        this._closePlayer();
    }

    private _closePlayer() {
        console.log('[VideoPlayerTest] _closePlayer() 開始。videoPlayer.isValid=' +
            this._videoPlayer?.isValid + ' cssOverlay=' + !!this._cssOverlayDiv + ' videoContainer=' + !!this._videoContainer);
        this._isPlaying = false;

        // 立即隱藏 <video> DOM（stop() 後瀏覽器會跳回第 0 幀，需先隱藏）
        if (this._videoPlayer?.isValid) {
            const nativeVideo = (this._videoPlayer as any).nativeVideo as HTMLVideoElement | null;
            if (nativeVideo) {
                nativeVideo.style.visibility = 'hidden';
                console.log('[VideoPlayerTest] nativeVideo visibility=hidden 設定完成');
            } else {
                console.warn('[VideoPlayerTest] nativeVideo 為 null（平台不支援或尚未建立）');
            }
            // 使用已儲存的 container 參照（stop() 後 nativeVideo.parentElement 可能為 null）
            if (this._videoContainer) {
                this._videoContainer.style.visibility = 'hidden';
                console.log('[VideoPlayerTest] videoContainer visibility=hidden 設定完成');
            } else {
                console.warn('[VideoPlayerTest] _videoContainer 為 null（_fixVideoCSS 未執行？）');
            }
            this._videoPlayer.stop();
            console.log('[VideoPlayerTest] videoPlayer.stop() 完成');
        } else {
            console.warn('[VideoPlayerTest] videoPlayer 不存在或已失效，跳過 stop()');
        }

        // CSS 遮罩淡出
        if (this._cssOverlayDiv) {
            this._cssOverlayDiv.style.opacity = '0';
            console.log('[VideoPlayerTest] cssOverlay 淡出中...');
        } else {
            console.warn('[VideoPlayerTest] cssOverlay 不存在');
        }

        // ─── 回呼：在 overlay 開始淡出的瞬間立即觸發 ─────────────────────
        // 不等 350ms 清理完成，讓場景特效與黑幕淡出同步進行，達到無縫銜接。
        // Unity 對照：相當於 Timeline 的 Signal Emitter 在最後一幀發送信號，
        //             Director.stopped 事件此時才觸發，而畫面已恢復可見狀態。
        const cb = this._onCompleteCallback;
        this._onCompleteCallback = null;
        if (cb) {
            console.log('[VideoPlayerTest] onComplete 回呼觸發（overlay 淡出中，場景可立即恢復）');
            cb();
        }
        // 同時發送 node 事件，供外部元件監聽（鬆耦合）
        this.node.emit('video-completed');

        // 等淡出完成再清理
        console.log('[VideoPlayerTest] 350ms 後執行 _cleanup()...');
        setTimeout(() => this._cleanup(), 350);
    }

    private _cleanup() {
        console.log('[VideoPlayerTest] _cleanup() 開始。cssOverlay=' + !!this._cssOverlayDiv +
            ' videoContainer=' + !!this._videoContainer + ' videoNode.isValid=' + this._videoNode?.isValid);

        // 1. 先移除 CSS 遮罩，讓遊戲畫面立即可見
        if (this._cssOverlayDiv) {
            this._cssOverlayDiv.remove();
            this._cssOverlayDiv = null;
            console.log('[VideoPlayerTest] cssOverlay 已移除');
        } else {
            console.warn('[VideoPlayerTest] cssOverlay 為 null，跳過移除');
        }

        // 2. 移除 <video> 容器（使用儲存的參照，不依賴 nativeVideo.parentElement）
        if (this._videoContainer) {
            // 確認確實在 DOM 中
            const inDom = document.body.contains(this._videoContainer);
            console.log('[VideoPlayerTest] videoContainer 在 body 中: ' + inDom);
            this._videoContainer.remove();
            this._videoContainer = null;
            console.log('[VideoPlayerTest] videoContainer 已移除');
        } else {
            console.warn('[VideoPlayerTest] videoContainer 為 null，跳過移除（可能 Cocos stop() 已清掉）');
        }

        // 3. 銷毀 Cocos 節點（放最後，讓 Cocos 自己清理剩餘資源）
        if (this._videoNode?.isValid) {
            this._videoNode.destroy();
            this._videoNode = null;
            console.log('[VideoPlayerTest] videoNode 已銷毀');
        }
        this._videoPlayer = null;

        // 4. 延遲最終清掃：Cocos destroy() 是延遲執行（下一幀），
        //    destroy 觸發的 VideoPlayer onDestroy 可能把 <video> 容器重新塞回 DOM。
        //    200ms 後確認 nativeVideo 是否還掛在 DOM 上，若是就連容器一起移除。
        const nativeVideoRef = this._nativeVideo;
        this._nativeVideo = null;
        setTimeout(() => {
            if (nativeVideoRef && nativeVideoRef.parentElement) {
                console.log('[VideoPlayerTest] 最終清掃：Cocos deferred destroy 後仍有殘留容器，強制移除');
                nativeVideoRef.parentElement.remove();
            }
            console.log('[VideoPlayerTest] 清理完成');
        }, 200);
    }

    // ─────────────────────────────────────────
    //  工具
    // ─────────────────────────────────────────

    private _findCanvas(): Node | null {
        let node: Node | null = this.node;
        while (node) {
            if (node.getComponent(Canvas)) return node;
            node = node.parent;
        }
        return find('Canvas');
    }

    onDestroy() {
        if (this._isPlaying) this._closePlayer();
        else this._cleanup();
    }
}
