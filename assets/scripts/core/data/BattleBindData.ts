// @spec-source → docs/cross-reference-index.md (DATA-1-0001)
/**
 * BattleBindData — 戰鬥場景 UI 動態欄位的資料契約 (Data Schema Contract)
 *
 * 本檔案定義所有戰鬥場景 layout JSON 中 `bind` 欄位的對應 TypeScript 介面。
 * 作用等同於 Unity `MonoBehaviour` 的每個 `public` / `[SerializeField]` 欄位的
 * ViewModel 合約，明確說明資料來自哪個系統。
 *
 * 資料來源：
 *   - BattleStateData  → BattleController / EventBus（battleState.xxx）
 *   - UnitDisplayData  → UnitInfoPanel / TigerTallyPanel（unit.xxx）
 *   - TallyUnitData    → TigerTallyPanel（tally[n].xxx）
 *   - BattleActionData → ActionCommandPanel（battle.xxx）
 *   - BattleLogData    → BattleLogPanel（battleLog.xxx）
 *
 * Unity 對照：
 *   BattleStateData ≈ GameManager.Instance.currentBattleState（ViewModel）
 *   UnitDisplayData ≈ UnitCardData（ScriptableObject 或 DTO）
 *   TallyUnitData   ≈ HandCard.CardData（展示用快照）
 */

// ─── HUD 狀態（battle-hud-main.json / battleState.xxx）────────────────────────

/**
 * 戰鬥 HUD 狀態資料
 * bind 路徑前綴：battleState.
 */
export interface BattleStateData {
    /** 玩家顯示名（bind: battleState.playerName） */
    playerName: string;
    /** 玩家要塞 HP 字串，格式 "now/max"（bind: battleState.playerFortressHp） */
    playerFortressHp: string;
    /** 當前回合字串，格式 "第 N 回合"（bind: battleState.turnCount） */
    turnCount: string;
    /** 糧草字串，格式 "🌾 糧草 now/max"（bind: battleState.food） */
    food: string;
    /** 戰鬥狀態說明（bind: battleState.statusMessage） */
    statusMessage: string;
    /** 敵方要塞 HP 字串（bind: battleState.enemyFortressHp） */
    enemyFortressHp: string;
    /** 敵方顯示名（bind: battleState.enemyName） */
    enemyName: string;
}

// ─── 兵種卡片資料（unit-info-panel-main.json / unit.xxx）─────────────────────

/**
 * 兵種資訊面板顯示資料
 * bind 路徑前綴：unit.
 */
export interface UnitDisplayData {
    /** 兵種名稱（bind: unit.name） */
    name: string;
    /** 兵種副標題（bind: unit.unitSub） */
    unitSub: string;
    /** 攻擊值字串，格式 "攻擊: N"（bind: unit.atk） */
    atk: string;
    /** 防禦值字串，格式 "防禦: N"（bind: unit.def） */
    def: string;
    /** HP 值字串，格式 "生命: N"（bind: unit.hp） */
    hp: string;
    /** 速度值字串（bind: unit.spd） */
    spd: string;
    /** 糧草費用字串，格式 "糧草: N"（bind: unit.cost） */
    cost: string;
    /** 兵種描述（bind: unit.desc） */
    desc: string;
}

// ─── 虎符卡片資料（tiger-tally-main.json / tally[n].xxx）────────────────────

/**
 * 虎符卡片單張資料（1-4 張）
 * bind 路徑前綴：tally[0..3].（n = 0-based index）
 */
export interface TallyUnitData {
    /** 攻擊值字串（bind: tally[n].atk） */
    atk: string;
    /** HP 值字串（bind: tally[n].hp） */
    hp: string;
    /** 兵種徽章文字，如 "CV" 代表騎兵（bind: tally[n].unitTypeBadge） */
    unitTypeBadge: string;
    /** 兵種顯示名稱（bind: tally[n].unitName） */
    unitName: string;
    /** 糧草費用字串（bind: tally[n].cost） */
    cost: string;
}

// ─── 行動指令資料（action-command-main.json / battle.xxx）──────────────────

/**
 * 行動指令面板資料
 * bind 路徑前綴：battle.
 */
export interface BattleActionData {
    /** 終極技名稱（bind: battle.ultName） */
    ultName: string;
    /** SP 百分比字串，格式 "N%"（bind: battle.spPct） */
    spPct: string;
}

// ─── 戰鬥日誌資料（battle-log-main.json / battleLog.xxx）─────────────────────

/**
 * 戰鬥日誌面板資料
 * bind 路徑前綴：battleLog.
 */
export interface BattleLogData {
    /** 戰鬥日誌訊息（bind: battleLog.message） */
    message: string;
}
