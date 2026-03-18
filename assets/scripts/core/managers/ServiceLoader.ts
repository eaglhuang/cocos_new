import { Node } from "cc";
import { AudioSystem } from "../systems/AudioSystem";
import { BuffSystem } from "../systems/BuffSystem";
import { MaterialSystem } from "../systems/MaterialSystem";
import { EffectSystem } from "../systems/EffectSystem";
import { EventSystem } from "../systems/EventSystem";
import { FloatTextSystem } from "../systems/FloatTextSystem";
import { FormulaSystem } from "../systems/FormulaSystem";
import { I18nSystem } from "../systems/I18nSystem";
import { PoolSystem } from "../systems/PoolSystem";
import { ResourceManager } from "../systems/ResourceManager";
import { BattleSystem } from "../systems/BattleSystem";
import { GameManager } from "./GameManager";
import { UIManager } from "./UIManager";

export class ServiceLoader {
    private static instance: ServiceLoader | null = null;

    public readonly event = new EventSystem();
    public readonly formula = new FormulaSystem();
    public readonly pool = new PoolSystem();
    public readonly resource = new ResourceManager();
    public readonly effect = new EffectSystem();
    public readonly buff = new BuffSystem();
    public readonly battle = new BattleSystem();
    public readonly game = new GameManager();
    public readonly ui = new UIManager();
    /** 音效系統：BGM、SFX、循環音效，含 50ms 防重複播放 */
    public readonly audio = new AudioSystem();
    /** 多國語系系統：t(key) 字串查詢 + 語系字型懶載入 / 卸載 */
    public readonly i18n = new I18nSystem();
    /**
     * 動態飄字系統：傷害數字、狀態效果、提示文字統一入口。
     * 需在 UnitRenderer.initialize() 後呼叫 setup(uiRoot, camera, canvas) 才能運作。
     */
    public readonly floatText = new FloatTextSystem();
    /**
     * 材質 / Shader 管理系統：per-unit Material 實例、Shader 預熱、服裝染色。
     * 需在 BattleScene.start() 中：
     *   1. registerShader() 登錄所有 Shader
     *   2. await material.warmupCritical(this.node) 預熱
     *   3. bindUnit() + applyOutfit() 為每個 unit 套用服裝
     */
    public readonly material = new MaterialSystem();

    private initialized = false;

    public static getInstance(): ServiceLoader {
        if (!this.instance) {
            this.instance = new ServiceLoader();
        }
        return this.instance;
    }

    /**
     * 初始化所有服務。
     *
     * @param hostNode 宿主節點（AudioSystem 的 AudioSource 必須掛在活躍節點上）
     *                 若不傳入則 AudioSystem 無法初始化（音效功能停用）。
     */
    public initialize(hostNode?: Node): void {
        if (this.initialized) return;

        this.battle.setEventSystem(this.event);
        this.game.setEventSystem(this.event);
        this.effect.setup(this.pool);

        // AudioSystem 需要 Node 才能掛 AudioSource，僅在有宿主節點時初始化
        if (hostNode) {
            this.audio.setup(hostNode);
        } else {
            console.warn("[ServiceLoader] 未傳入 hostNode，AudioSystem 未初始化（音效功能停用）");
        }

        this.initialized = true;
    }
}

export function services(): ServiceLoader {
    return ServiceLoader.getInstance();
}