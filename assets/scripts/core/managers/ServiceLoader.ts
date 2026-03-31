// @spec-source → 見 docs/cross-reference-index.md
import { Node } from "cc";
import { AudioSystem } from "../systems/AudioSystem";
import { BuffSystem } from "../systems/BuffSystem";
import { MaterialSystem } from "../systems/MaterialSystem";
import { EffectSystem } from "../systems/EffectSystem";
import { EventSystem } from "../systems/EventSystem";
import { FloatTextSystem } from "../systems/FloatTextSystem";
import { FormulaSystem } from "../systems/FormulaSystem";
import { I18nSystem } from "../systems/I18nSystem";
import { MemoryManager } from "../systems/MemoryManager";
import { PoolSystem } from "../systems/PoolSystem";
import { ResourceManager } from "../systems/ResourceManager";
import { ActionSystem } from "../systems/ActionSystem";
import { BattleSystem } from "../systems/BattleSystem";
import { NetworkService } from "../systems/NetworkService";
import { SyncManager } from "../systems/SyncManager";
import { SceneManager } from "./SceneManager";
import { GameManager } from "./GameManager";
import { UIManager } from "./UIManager";
import { normalizeVfxEffectTable } from "../config/VfxEffectConfig";

export class ServiceLoader {
    private static instance: ServiceLoader | null = null;

    public readonly event = new EventSystem();
    public readonly formula = new FormulaSystem();
    public readonly pool = new PoolSystem();
    public readonly resource = new ResourceManager();
    public readonly effect = new EffectSystem();
    public readonly buff = new BuffSystem();
    public readonly battle = new BattleSystem();
    public readonly scene = new SceneManager();
    public readonly game = new GameManager();
    public readonly ui = new UIManager();
    public readonly network = new NetworkService();
    public readonly sync = new SyncManager();
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
    /**
     * 記憶體管理器：追蹤所有經 ResourceManager 、VfxComposerTool 等入口載入的資源。
     * 目前為純追蹤空殼，預留完整擴充點（LRU弱引用、場景切換批次釋放、記憶體上限警示）。
     * Unity 對照：Addressables 的 AssetReference 追蹤 + Unity Profiler Memory Tracker。
     */
    public readonly memory = new MemoryManager();
    /**
     * 技能演出系統：從 skills.json 讀取時間軸定義，依序播放動畫、VFX、音效、傷害與 Buff。
     * 使用前需先呼叫 action.registerSkills(defs)（在 ResourceManager 載入 skills.json 後）。
     * Unity 對照：PlayableDirector + Timeline，技能 track 以 atTime 定義觸發時序。
     */
    public readonly action = new ActionSystem();

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
        // ResourceManager 連動 MemoryManager，使所有資源載入/釋放都通報記憶體管理器
        this.resource.bindMemoryManager(this.memory);
        // AudioSystem 需要 Node 才能掛 AudioSource，僅在有宿主節點時初始化
        if (hostNode) {
            this.audio.setup(hostNode);
        } else {
            console.warn("[ServiceLoader] 未傳入 hostNode，AudioSystem 未初始化（音效功能停用）");
        }

        // 啟動跨平台網路偵測與自動離線佇列同步服務
        this.network.setup(this.event);
        this.sync.setup(this.event, this.network);

        this.initialized = true;
    }

    /**
     * 非同步載入 skills.json 並注冊至 ActionSystem。
     * 建議在 BattleScene.start() 中 await 此函式，確保技能在戰鬥開始前已就緒。
     */
    public async loadSkills(): Promise<void> {
        try {
            const defs = await this.resource.loadJson<import('../systems/ActionSystem').SkillDef[]>('data/skills');
            this.action.registerSkills(defs);
        } catch (e) {
            console.warn('[ServiceLoader] skills.json 載入失敗，技能演出停用:', e);
        }
    }

    /**
     * 非同步載入 vfx-effects.json 並批量注冊至 EffectSystem。
     * 建議在 BattleScene.start() 中與 loadSkills() 一起 await。
     */
    public async loadVfxEffects(): Promise<void> {
        try {
            const rawTable = await this.resource.loadJson<unknown>('data/vfx-effects');
            const table = normalizeVfxEffectTable(rawTable);
            this.effect.registerEffects(table.effects);
        } catch (e) {
            console.warn('[ServiceLoader] vfx-effects.json 載入失敗，三位一體特效停用:', e);
        }
    }
}

export function services(): ServiceLoader {
    return ServiceLoader.getInstance();
}