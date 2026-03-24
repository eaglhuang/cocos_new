import { AudioClip, AudioSource, Node, tween } from "cc";

/**
 * 音效系統
 *
 * 負責 BGM、單次音效、循環音效的統一管理。
 * 核心特性：50ms 防重複播放，避免同一音效在連擊時爆音。
 *
 * Unity 對照：
 *   - bgmSource   ≈ AudioSource 上的 PlayLoop
 *   - sfxSource   ≈ AudioSource.PlayOneShot（非循環）
 *   - loopSource  ≈ 另一個 AudioSource 用於持續循環的環境音效
 *
 * 使用方式：
 *   1. ServiceLoader.initialize(hostNode) 時自動呼叫 setup()
 *   2. 先 registerClip(name, clip) 快取 AudioClip
 *   3. 之後 playSfx(name) 即可播放
 */
export class AudioSystem {
    private bgmSource: AudioSource | null = null;
    /** 第二 BGM 軌，專用於 crossfade 漸進 */
    private bgmSourceB: AudioSource | null = null;
    /** 目前活躍 BGM 軌（'A' = bgmSource，'B' = bgmSourceB） */
    private activeBgm: 'A' | 'B' = 'A';
    /** 追蹤 BGM 目標音量，crossfade 漸进終點用 */
    private bgmVolume: number = 0.5;
    private sfxSource: AudioSource | null = null;
    private loopSource: AudioSource | null = null;

    /** 防重複播放時間戳記（key=音效名稱, value=上次播放 ms） */
    private lastPlayTime = new Map<string, number>();

    /** AudioClip 快取（name → clip），由外部 registerClip 或 loadClips 填入 */
    private clipCache = new Map<string, AudioClip>();

    /** 防重複播放的最小間隔（ms） */
    private static readonly DEBOUNCE_MS = 50;

    // ─────────────────────────────────────────
    //  初始化
    // ─────────────────────────────────────────

    /**
     * 由 ServiceLoader.initialize(hostNode) 呼叫。
     * AudioSource 必須掛載在活躍的 Node 上，不可用 new AudioSource()。
     *
     * Unity 對照：相當於在 GameManager 物件上掛 3 個 AudioSource 組件
     */
    public setup(hostNode: Node): void {
        this.bgmSource = hostNode.addComponent(AudioSource);
        this.bgmSource.loop = true;
        this.bgmSource.volume = 0.5;

        // 第二 BGM 軌：技能毳電時 crossfade 用，很始靜音
        this.bgmSourceB = hostNode.addComponent(AudioSource);
        this.bgmSourceB.loop = true;
        this.bgmSourceB.volume = 0;

        this.sfxSource = hostNode.addComponent(AudioSource);
        this.sfxSource.volume = 1.0;

        this.loopSource = hostNode.addComponent(AudioSource);
        this.loopSource.loop = true;
        this.loopSource.volume = 0.8;
    }

    // ─────────────────────────────────────────
    //  音效快取管理
    // ─────────────────────────────────────────

    /** 手動快取單個 AudioClip（由 BattleScene 在加載資源後呼叫） */
    public registerClip(name: string, clip: AudioClip): void {
        this.clipCache.set(name, clip);
    }

    /** 批次快取多個 AudioClip（key = 檔名不含副檔名） */
    public registerClips(clips: Record<string, AudioClip>): void {
        // ES2015 不支援 Object.entries，改用 Object.keys
        Object.keys(clips).forEach(name => {
            this.clipCache.set(name, clips[name]);
        });
    }

    public hasClip(name: string): boolean {
        return this.clipCache.has(name);
    }

    // ─────────────────────────────────────────
    //  BGM
    // ─────────────────────────────────────────

    public playBgm(clipOrName: AudioClip | string, volume = 0.5): void {
        if (!this.bgmSource) return;
        const clip = typeof clipOrName === "string"
            ? this.clipCache.get(clipOrName) ?? null
            : clipOrName;
        if (!clip) {
            console.warn(`[AudioSystem] BGM clip 不存在: ${clipOrName}`);
            return;
        }
        this.bgmVolume = volume;
        // 總是使用 bgmSource（A 軌）直接播放，無漸變
        this.bgmSourceB?.stop();
        this.activeBgm = 'A';
        this.bgmSource.clip = clip;
        this.bgmSource.volume = volume;
        this.bgmSource.play();
    }

    public stopBgm(): void {
        this.bgmSource?.stop();
        this.bgmSourceB?.stop();
    }
    public pauseBgm(): void {
        const src = this.activeBgm === 'A' ? this.bgmSource : this.bgmSourceB;
        src?.pause();
    }
    public resumeBgm(): void {
        const src = this.activeBgm === 'A' ? this.bgmSource : this.bgmSourceB;
        src?.play();
    }
    public setBgmVolume(v: number): void {
        this.bgmVolume = v;
        const src = this.activeBgm === 'A' ? this.bgmSource : this.bgmSourceB;
        if (src) src.volume = v;
    }

    /**
     * 漸變切換 BGM：新 BGM 漸入的同時舊 BGM 漸出，無硬切斷感。
     *
     * Unity 對照：用兩個 AudioSource + Mathf.Lerp(volume) 實現 Cross-Fade。
     *   from 軌：to(duration, { volume: 0 })
     *   to   軌：to(duration, { volume: bgmVolume })
     *
     * @param clipOrName  目標 AudioClip 或已注冊的名稱
     * @param duration    漸變時長（秒，預設 1.5）
     */
    public crossfadeTo(clipOrName: AudioClip | string, duration: number = 1.5): void {
        if (!this.bgmSource || !this.bgmSourceB) return;

        const clip = typeof clipOrName === 'string'
            ? this.clipCache.get(clipOrName) ?? null
            : clipOrName;
        if (!clip) {
            console.warn(`[AudioSystem] crossfadeTo clip 不存在: ${clipOrName}`);
            return;
        }

        const from = this.activeBgm === 'A' ? this.bgmSource : this.bgmSourceB;
        const to   = this.activeBgm === 'A' ? this.bgmSourceB : this.bgmSource;

        // 開始漸變：to 軌從靖音漸入新曲目
to.clip = clip;
        to.volume = 0;
        to.play();

        tween(from).to(duration, { volume: 0 }).call(() => from.stop()).start();
        tween(to).to(duration, { volume: this.bgmVolume }).start();

        this.activeBgm = this.activeBgm === 'A' ? 'B' : 'A';
    }

    // ─────────────────────────────────────────
    //  單次音效（SFX）
    // ─────────────────────────────────────────

    /**
     * 播放單次音效，50ms 內同名音效不重複觸發。
     *
     * Unity 對照：AudioSource.PlayOneShot(clip, volume)
     *
     * @param name   AudioClip 快取名稱（無副檔名）
     * @param volume 音量 0~1，預設 1.0
     */
    public playSfx(name: string, volume = 1.0): void {
        if (!this.sfxSource) return;

        // 防重複播放（會在連擊時造成音爆）
        const now = Date.now();
        const last = this.lastPlayTime.get(name) ?? 0;
        if (now - last < AudioSystem.DEBOUNCE_MS) return;
        this.lastPlayTime.set(name, now);

        const clip = this.clipCache.get(name);
        if (!clip) {
            console.warn(`[AudioSystem] SFX clip 不存在: ${name}`);
            return;
        }
        this.sfxSource.playOneShot(clip, volume);
    }

    /**
     * 播放單次音效（較長防重複間隔版本，適合技能音效）
     * @param cooldownMs 防重複的冷卻時間（ms），預設 300ms
     */
    public playSfxWithCooldown(name: string, volume = 1.0, cooldownMs = 300): void {
        if (!this.sfxSource) return;
        const now = Date.now();
        const last = this.lastPlayTime.get(name) ?? 0;
        if (now - last < cooldownMs) return;
        this.lastPlayTime.set(name, now);

        const clip = this.clipCache.get(name);
        if (!clip) {
            console.warn(`[AudioSystem] SFX clip 不存在: ${name}`);
            return;
        }
        this.sfxSource.playOneShot(clip, volume);
    }

    // ─────────────────────────────────────────
    //  循環音效（環境音、持續 Buff 音效）
    // ─────────────────────────────────────────

    public playLoopSfx(name: string, volume = 0.8): void {
        if (!this.loopSource) return;
        const clip = this.clipCache.get(name);
        if (!clip) {
            console.warn(`[AudioSystem] Loop clip 不存在: ${name}`);
            return;
        }
        this.loopSource.clip = clip;
        this.loopSource.volume = volume;
        this.loopSource.play();
    }

    public stopLoopSfx(): void { this.loopSource?.stop(); }

    // ─────────────────────────────────────────
    //  清理
    // ─────────────────────────────────────────

    public clearCache(): void {
        this.clipCache.clear();
        this.lastPlayTime.clear();
    }
}
