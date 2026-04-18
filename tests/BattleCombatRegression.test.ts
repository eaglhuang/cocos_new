import { Faction, TroopType } from '../assets/scripts/core/config/Constants';
import { BattleController } from '../assets/scripts/battle/controllers/BattleController';
import { BattleState } from '../assets/scripts/battle/models/BattleState';
import { BattleCombatResolver, type BattleCombatAction } from '../assets/scripts/battle/runtime/BattleCombatResolver';
import { BattleDuelResolver } from '../assets/scripts/battle/runtime/BattleDuelResolver';
import { executeBattleCombatPhase } from '../assets/scripts/battle/runtime/phases/BattleCombatPhase';
import { GeneralUnit } from '../assets/scripts/core/models/GeneralUnit';
import { TroopUnit } from '../assets/scripts/core/models/TroopUnit';
import { services } from '../assets/scripts/core/managers/ServiceLoader';
import { TestSuite, assert } from './TestRunner';

function createGeneral(id: string, faction: Faction, skillId: string): GeneralUnit {
    return new GeneralUnit({
        id,
        name: id,
        faction,
        hp: 1000,
        maxSp: 100,
        initialSp: 100,
        str: 100,
        int: 90,
        lea: 90,
        luk: 0,
        skillId,
        battlePrimarySkillId: skillId,
    });
}

function createTroop(id: string, faction: Faction, attackRange: number): TroopUnit {
    const unit = new TroopUnit(id, TroopType.Infantry, faction, {
        hp: 100,
        attack: 30,
        defense: 10,
        moveRange: 0,
        attackRange,
    });
    unit.moveTo(2, faction === Faction.Player ? 2 : 3);
    return unit;
}

export function createBattleCombatRegressionSuite(): TestSuite {
    const suite = new TestSuite('BattleCombatRegression');

    suite.test('executeBattleCombatPhase：已死亡 attacker 不應排入攻擊或後續處理', () => {
        services().initialize();
        const state = new BattleState();

        const deadAttacker = createTroop('dead-attacker', Faction.Player, 1);
        deadAttacker.currentHp = 0;
        const idleDefender = createTroop('idle-defender', Faction.Enemy, 0);

        state.addUnit(deadAttacker);
        state.addUnit(idleDefender);

        const counters = {
            build: 0,
            damageGeneral: 0,
            resolve: 0,
            reset: 0,
            generalKilled: 0,
            unitKilled: 0,
        };

        executeBattleCombatPhase({
            state,
            playerGeneralUnitId: null,
            enemyGeneralUnitId: null,
            buildAttackAction: (unit) => {
                counters.build += 1;
                if (unit.id === deadAttacker.id) {
                    return { attackerId: deadAttacker.id, targetId: idleDefender.id };
                }
                return null;
            },
            damageEnemyGeneral: () => {
                counters.damageGeneral += 1;
            },
            resolveCombat: () => {
                counters.resolve += 1;
            },
            resolveActionResetAfterAttack: () => {
                counters.reset += 1;
            },
            onGeneralUnitKilled: () => {
                counters.generalKilled += 1;
            },
            onUnitKilled: () => {
                counters.unitKilled += 1;
            },
        });

        assert.equals(0, counters.build);
        assert.equals(0, counters.damageGeneral);
        assert.equals(0, counters.resolve);
        assert.equals(0, counters.reset);
        assert.equals(0, counters.generalKilled);
        assert.equals(0, counters.unitKilled);
    });

    suite.test('resolveActionResetAfterAttack：已死亡 attacker 不應再產生 follow-up action', () => {
        services().initialize();
        const state = new BattleState();
        const attacker = createTroop('reset-attacker', Faction.Player, 1);
        attacker.currentHp = 0;
        state.addUnit(attacker);
        state.setActionReset({
            unitUid: attacker.id,
            battleSkillId: 'wei-zhen-reset',
            firstHitMultiplier: 2,
            firstHitPending: true,
            remainingExtraActions: 2,
        });

        const resolver = new BattleCombatResolver({
            state,
            getPlayerGeneralUnitId: () => null,
            getEnemyGeneralUnitId: () => null,
            setPlayerGeneralUnitId: () => {},
            setEnemyGeneralUnitId: () => {},
        });

        const actions: BattleCombatAction[] = [];
        resolver.resolveActionResetAfterAttack(attacker, true, actions);

        assert.equals(0, actions.length);
        assert.equals(null, state.getActionReset(attacker.id));
    });

    suite.test('BattleController：技能傷害打死武將化身時應清除 general unit id', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('guan-yu', Faction.Player, 'guan-yu-slash');
        const enemyGeneral = createGeneral('sima-yi', Faction.Enemy, 'sima-yi-shadow');
        ctrl.initBattle(playerGeneral, enemyGeneral);

        playerGeneral.currentHp = 1;
        const generalUnit = ctrl.placeGeneralOnBoard(2, 2);
        assert.isDefined(generalUnit);

        enemyGeneral.currentSp = enemyGeneral.maxSp;
        ctrl.advanceTurn();

        assert.equals(null, ctrl.playerGeneralUnitId);
        assert.isFalse(ctrl.state.units.has(generalUnit!.id));
    });

    suite.test('BattleDuelResolver：單挑攻擊力應使用注入 svc.formula，而非全域 services', () => {
        services().initialize();
        const playerGeneral = createGeneral('guan-yu', Faction.Player, 'guan-yu-slash');
        const enemyGeneral = createGeneral('sima-yi', Faction.Enemy, 'sima-yi-shadow');
        const state = new BattleState();
        state.reset(playerGeneral, enemyGeneral);
        playerGeneral.currentHp = 1;
        enemyGeneral.currentHp = 1;

        const resolver = new BattleDuelResolver({
            state,
            combatResolver: new BattleCombatResolver({
                state,
                getPlayerGeneralUnitId: () => null,
                getEnemyGeneralUnitId: () => null,
                setPlayerGeneralUnitId: () => {},
                setEnemyGeneralUnitId: () => {},
            }),
            getPlayerGeneralUnitId: () => null,
            getEnemyGeneralUnitId: () => null,
            setPlayerGeneralUnitId: () => {},
            setEnemyGeneralUnitId: () => {},
            checkVictory: () => ({ winner: null, reason: 'in-progress' } as any),
        });

        const originalCalculateGeneralAttack = services().formula.calculateGeneralAttack;
        let calculateGeneralAttackCalls = 0;
        services().formula.calculateGeneralAttack = () => {
            throw new Error('global formula should not be used');
        };

        try {
            const fakeSvc = {
                formula: {
                    calculateGeneralAttack: () => {
                        calculateGeneralAttackCalls += 1;
                        return 1;
                    },
                    rollDodge: () => false,
                    rollCrit: () => false,
                },
                event: {
                    emit: () => {},
                },
            } as any;

            resolver.resolveAcceptedGeneralDuel(Faction.Player, Faction.Enemy, fakeSvc);

            assert.equals(2, calculateGeneralAttackCalls);
            assert.isTrue(enemyGeneral.isDead());
        } finally {
            services().formula.calculateGeneralAttack = originalCalculateGeneralAttack;
        }
    });

    return suite;
}
