import {
  Faction,
  TroopType,
  EVENT_NAMES,
} from '../../core/config/Constants';
import { TroopUnit, TroopStats } from '../../core/models/TroopUnit';
import { BattleState } from '../models/BattleState';
import { services } from '../../core/managers/ServiceLoader';

/** troops.json 的 key 是 TroopType 字串，value 是 TroopStats */
export type TroopDataTable = Partial<Record<TroopType, TroopStats>>;

/** 各兵種預設數值（JSON 載入失敗時的後備） */
export const DEFAULT_TROOP_STATS: Record<TroopType, TroopStats> = {
  [TroopType.Cavalry]:  { hp: 100, attack: 40, defense: 20, moveRange: 2, attackRange: 1 },
  [TroopType.Infantry]: { hp: 120, attack: 35, defense: 25, moveRange: 1, attackRange: 1 },
  [TroopType.Shield]:   { hp: 150, attack: 20, defense: 35, moveRange: 1, attackRange: 1 },
  [TroopType.Archer]:   { hp:  80, attack: 30, defense: 15, moveRange: 1, attackRange: 2 },
  [TroopType.Pikeman]:  { hp: 110, attack: 32, defense: 22, moveRange: 1, attackRange: 1 },
  [TroopType.Engineer]: { hp:  80, attack: 15, defense: 10, moveRange: 1, attackRange: 1 },
  [TroopType.Medic]:    { hp:  90, attack:  0, defense: 15, moveRange: 1, attackRange: 0 },
  [TroopType.Navy]:     { hp: 100, attack: 30, defense: 20, moveRange: 1, attackRange: 1 },
};

export interface BattleUnitSpawnerContext {
  readonly state: BattleState;
  getDuelRejectedFaction(): Faction | null;
  getPlayerGeneralUnitId(): string | null;
  consumeTileBuff(unit: TroopUnit): void;
}

/** 負責建立並初始化 TroopUnit（兵種生成、懲罰/加成套用、Tile Buff 消耗）*/
export class BattleUnitSpawner {
  private troopData: TroopDataTable = {};
  private serial = 0;

  constructor(private readonly context: BattleUnitSpawnerContext) {}

  public resetForBattle(): void {
    this.serial = 0;
  }

  public setTroopData(data: TroopDataTable): void {
    this.troopData = data;
  }

  public spawnUnit(type: TroopType, faction: Faction, lane: number, depth: number, unitName?: string): TroopUnit {
    const stats = this.troopData[type] ?? DEFAULT_TROOP_STATS[type];
    const unit  = new TroopUnit(`${faction}-${type}-${++this.serial}`, type, faction, stats, unitName);
    unit.moveTo(lane, depth);

    // 拒絕單挑懲罰：新部署的小兵也要減半
    if (this.context.getDuelRejectedFaction() === faction) {
      const atkLoss = -Math.floor(unit.getEffectiveAttack() / 2);
      unit.attackBonus += atkLoss;
      const hpLoss = -Math.floor(unit.getEffectiveMaxHp() / 2);
      unit.maxHpBonus += hpLoss;
      unit.currentHp = Math.max(1, Math.floor(unit.currentHp / 2));
    }

    // 武將出陣期間，新部署的我方小兵也享受攻擊加倍
    if (faction === Faction.Player && this.context.getPlayerGeneralUnitId()) {
      unit.attackBonus += unit.attack;
    }

    this.context.state.addUnit(unit);
    services().event.emit(EVENT_NAMES.UnitDeployed, { unitId: unit.id, lane, depth, faction, type, unitName: unit.name });
    this.context.consumeTileBuff(unit);
    return unit;
  }
}
