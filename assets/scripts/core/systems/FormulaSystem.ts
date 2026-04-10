// @spec-source → 見 docs/cross-reference-index.md
import {
  COUNTER_MULTIPLIER,
  DISADVANTAGE_MULTIPLIER,
  GAME_CONFIG,
  MIN_DAMAGE,
  TERRAIN_ATTACK_MOD,
  TERRAIN_DEFENSE_MOD,
  TerrainType,
  TroopType,
  TROOP_COUNTER_MAP,
} from "../config/Constants";

/**
 * 武將化身（單挑）攻擊力計算參數。
 * 對應規格書：數值系統.md E-12（武將屬性→兵種）與 E-14（武將化身數值）。
 *
 * 物理型：提供 str + lea → ATK = STR × 0.7 + LEA × 0.3
 * 謀略型：提供 int + lea → ATK = INT × 0.7 + LEA × 0.3
 * 備用：只提供 maxHp   → ATK = maxHp × 8%（舊公式，向後兼容）
 */
export interface GeneralCombatParams {
  /** 武力（物理型首選）*/
  str?: number;
  /** 智力（謀略型首選）*/
  int?: number;
  /** 統率（任意型皆使用）*/
  lea?: number;
  /** 運氣（暴擊與閃躲機率，對應 E-11）*/
  luk?: number;
  /** 備用：缺少六色屬性時以 maxHp × 8% 計算 */
  maxHp?: number;
}

export interface DamageContext {
  attackerAttack: number;
  defenderDefense: number;
  attackerType: TroopType;
  defenderType: TroopType;
  attackerTerrain: TerrainType;
  defenderTerrain: TerrainType;
  attackBonus?: number;
  defenseBonus?: number;
}

export class FormulaSystem {
  /**
   * 武將化身（單挑）攻擊力計算。
   * - 物理型（有 str + lea）：STR × 0.7 + LEA × 0.3  ← 對應 E-12
   * - 謀略型（有 int + lea）：INT × 0.7 + LEA × 0.3  ← 對應 E-12
   * - 備用（只有 maxHp）  ：maxHp × 8%             ← 舊 E-14 向後兼容
   */
  public calculateGeneralAttack(params: GeneralCombatParams, floorValue = 1): number {
    const { str, int: intelligence, lea, maxHp } = params;
    if (lea !== undefined) {
      if (str !== undefined) {
        // 物理型：武力 × 0.7 + 統率 × 0.3
        return Math.max(floorValue, Math.floor(str * 0.7 + lea * 0.3));
      }
      if (intelligence !== undefined) {
        // 謀略型：智力 × 0.7 + 統率 × 0.3
        return Math.max(floorValue, Math.floor(intelligence * 0.7 + lea * 0.3));
      }
    }
    // 備用：舊公式 maxHp × 8%
    return Math.max(floorValue, Math.floor((maxHp ?? 0) * 0.08));
  }

  public calculateDamage(context: DamageContext): number {
    const counterMultiplier = this.getCounterMultiplier(context.attackerType, context.defenderType);
    const attackTerrain = 1 + (TERRAIN_ATTACK_MOD[context.attackerTerrain] || 0);
    const defenseTerrain = 1 + (TERRAIN_DEFENSE_MOD[context.defenderTerrain] || 0);
    const attackBonus = 1 + (context.attackBonus || 0);
    const defenseBonus = 1 + (context.defenseBonus || 0);

    const effectiveAttack = context.attackerAttack * counterMultiplier * attackTerrain * attackBonus;
    const effectiveDefense = context.defenderDefense * defenseTerrain * defenseBonus;
    return Math.max(MIN_DAMAGE, Math.floor(effectiveAttack - effectiveDefense));
  }

  public calculateHeal(maxHp: number, ratio = 0.12, floorValue = 20): number {
    return Math.max(floorValue, Math.floor(maxHp * ratio));
  }

  /**
   * 取得武將化身單挑的暴擊機率（純計算，不擲骰子）。
   * 公式：BASE_CRIT + LUK / 200，上限 50%（對應 E-11）
   */
  public getCritChance(luk = 0): number {
    const raw = GAME_CONFIG.GENERAL_BASE_CRIT_CHANCE + luk / 200;
    return Math.min(raw, GAME_CONFIG.GENERAL_MAX_CRIT_CHANCE);
  }

  /**
   * 取得武將化身單挑的閃躲機率（純計算，不擲骰子）。
   * 公式：BASE_DODGE + LUK / 400，上限 40%（對應 E-14）
   */
  public getDodgeChance(luk = 0): number {
    const raw = GAME_CONFIG.GENERAL_BASE_DODGE_CHANCE + luk / 400;
    return Math.min(raw, GAME_CONFIG.GENERAL_MAX_DODGE_CHANCE);
  }

  /**
   * 擲暴擊骰子：回傳 true 表示觸發暴擊。
   * 僅用於武將化身單挑對成0（resolveAcceptedGeneralDuel）。
   */
  public rollCrit(luk = 0): boolean {
    return Math.random() < this.getCritChance(luk);
  }

  /**
   * 擲閃躲骰子：回傳 true 表示武將閃障。
   * 僅用於武將化身對戰（對其中一次攻擊進行閃躲判定）。
   */
  public rollDodge(luk = 0): boolean {
    return Math.random() < this.getDodgeChance(luk);
  }

  public getCounterMultiplier(attackerType: TroopType, defenderType: TroopType): number {
    if (TROOP_COUNTER_MAP[attackerType] === defenderType) {
      return COUNTER_MULTIPLIER;
    }

    if (TROOP_COUNTER_MAP[defenderType] === attackerType) {
      return DISADVANTAGE_MULTIPLIER;
    }

    return 1;
  }

  // ─── 生產 / 政務公式（Phase 2，對應規格書 §3.3 公式層平衡設計原則）─────────────

  /**
   * 內政產出計算（政務）。
   * 公式：floor( sqrt(pol) × multiplier × aptitudeBonus )
   *
   * 設計原則（§3.3）：使用開根號型曲線收斂頂端差距，避免高政值武將產出失衡。
   * - pol=100 時 base ≈ 100；pol=50 時 base ≈ 70.7（差距 1.41×，而非線性 2×）
   *
   * @param pol           政治屬性值
   * @param multiplier    基礎乘數（預設 10，可依建築等級等外部因素傳入）
   * @param aptitudeBonus 適性加乘（S=1.2, A=1.1, B=1.0, C=0.9；預設 1.0）
   */
  public calculateAdminOutput(pol: number, multiplier = 10, aptitudeBonus = 1.0): number {
    return Math.floor(Math.sqrt(Math.max(0, pol)) * multiplier * aptitudeBonus);
  }

  /**
   * 外交 / 商業產出計算（魅力）。
   * 公式：floor( sqrt(cha) × multiplier × aptitudeBonus )
   *
   * 設計原則（§3.3）：與 calculateAdminOutput 同邏輯；cha 用於外交、招募、市場收益等場合。
   *
   * @param cha           魅力屬性值
   * @param multiplier    基礎乘數（預設 10）
   * @param aptitudeBonus 適性加乘（S=1.2, A=1.1, B=1.0, C=0.9；預設 1.0）
   */
  public calculateDiplomacyOutput(cha: number, multiplier = 10, aptitudeBonus = 1.0): number {
    return Math.floor(Math.sqrt(Math.max(0, cha)) * multiplier * aptitudeBonus);
  }

  /**
   * 將兵種適性等級字串轉換為公式層乘數。
   * 規格書 §3.3：S=1.2x, A=1.1x, B=1.0x, C=0.9x, D=0.8x
   *
   * @param grade 適性等級字串（'S'|'A'|'B'|'C'|'D'）
   * @returns 乘數值（1.0 為無加減成）
   */
  public static aptitudeMultiplier(grade: string): number {
    switch (grade?.toUpperCase()) {
      case 'S': return 1.2;
      case 'A': return 1.1;
      case 'B': return 1.0;
      case 'C': return 0.9;
      case 'D': return 0.8;
      default:  return 1.0;
    }
  }
}