import { BattleTactic, Faction, StatusEffect, TroopType } from '../assets/scripts/core/config/Constants';
import { BattleController } from '../assets/scripts/battle/controllers/BattleController';
import { GeneralUnit } from '../assets/scripts/core/models/GeneralUnit';
import { TroopUnit } from '../assets/scripts/core/models/TroopUnit';
import { BattleSkillTargetMode, SkillSourceType } from '../shared/skill-runtime';
import { TestSuite, assert } from './TestRunner';
import { services } from '../assets/scripts/core/managers/ServiceLoader';

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
        skillId,
        battlePrimarySkillId: skillId,
    });
}

function createGeneralWithSeedTactic(id: string, faction: Faction, tacticId: string): GeneralUnit {
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
        skillId: 'legacy-placeholder-skill',
        battlePrimarySkillId: 'legacy-placeholder-skill',
        tacticSlots: [
            {
                slotId: 'slot-1',
                tacticId,
                source: 'bloodline',
            },
        ],
    });
}

function createEnemyUnit(id: string, lane: number, depth: number): TroopUnit {
    const unit = new TroopUnit(id, TroopType.Infantry, Faction.Enemy, {
        hp: 100,
        attack: 30,
        defense: 10,
        moveRange: 1,
        attackRange: 1,
    });
    unit.moveTo(lane, depth);
    return unit;
}

export function createBattleControllerSkillTargetingSuite(): TestSuite {
    const suite = new TestSuite('BattleControllerSkillTargeting');

    suite.test('triggerGeneralSkill：會把 targetUnitUid 帶進 line resolver，且成功後才消耗 SP', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('guan-yu', Faction.Player, 'guan-yu-slash');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;

        const anchor = createEnemyUnit('enemy-anchor', 2, 3);
        const behind = createEnemyUnit('enemy-behind', 2, 4);
        const side = createEnemyUnit('enemy-side', 1, 4);
        ctrl.state.addUnit(anchor);
        ctrl.state.addUnit(behind);
        ctrl.state.addUnit(side);

        const didCast = ctrl.triggerGeneralSkill({
            targetMode: BattleSkillTargetMode.Line,
            targetUnitUid: 'enemy-anchor',
        });

        assert.isTrue(didCast);
        assert.equals(0, playerGeneral.currentSp);
        assert.isTrue(anchor.currentHp < 100);
        assert.isTrue(behind.currentHp < 100);
        assert.equals(100, side.currentHp);
    });

    suite.test('triggerGeneralSkill：若 target 非敵軍，施放失敗且不消耗 SP', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('cao-cao', Faction.Player, 'cao-cao-tactics');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;

        const invalidTarget = new TroopUnit('player-ally', TroopType.Infantry, Faction.Player, {
            hp: 100,
            attack: 30,
            defense: 10,
            moveRange: 1,
            attackRange: 1,
        });
        invalidTarget.moveTo(2, 2);
        ctrl.state.addUnit(invalidTarget);

        const didCast = ctrl.triggerGeneralSkill({
            targetMode: BattleSkillTargetMode.EnemySingle,
            targetUnitUid: 'player-ally',
        });

        assert.isFalse(didCast);
        assert.equals(playerGeneral.maxSp, playerGeneral.currentSp);
        assert.equals(100, invalidTarget.currentHp);
    });

    suite.test('triggerGeneralSkill：有 tacticSlots 時會優先走 canonical seed tactic translator', async () => {
        services().initialize();
        const ctrl = new BattleController();
        await ctrl.loadData();
        const playerGeneral = createGeneralWithSeedTactic('zhao-yun', Faction.Player, 'tactic-cavalry-shock');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;

        const anchor = createEnemyUnit('enemy-anchor', 2, 2);
        const behind = createEnemyUnit('enemy-behind', 2, 4);
        const side = createEnemyUnit('enemy-side', 1, 3);
        ctrl.state.addUnit(anchor);
        ctrl.state.addUnit(behind);
        ctrl.state.addUnit(side);

        const didCast = ctrl.triggerGeneralSkill();

        assert.isTrue(didCast);
        assert.equals(0, playerGeneral.currentSp);
        assert.isTrue(anchor.currentHp < 100);
        assert.isTrue(behind.currentHp < 100);
        assert.equals(100, side.currentHp);
    });

    suite.test('triggerGeneralSkill：不帶 target 也會自動選最佳直線目標', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('guan-yu', Faction.Player, 'guan-yu-slash');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;

        const laneTwoFront = createEnemyUnit('enemy-l2-front', 2, 2);
        const laneTwoBack = createEnemyUnit('enemy-l2-back', 2, 4);
        const laneOneSolo = createEnemyUnit('enemy-l1-solo', 1, 1);
        ctrl.state.addUnit(laneTwoFront);
        ctrl.state.addUnit(laneTwoBack);
        ctrl.state.addUnit(laneOneSolo);

        const didCast = ctrl.triggerGeneralSkill({
            targetMode: BattleSkillTargetMode.Line,
        });

        assert.isTrue(didCast);
        assert.equals(0, playerGeneral.currentSp);
        assert.isTrue(laneTwoFront.currentHp < 100);
        assert.isTrue(laneTwoBack.currentHp < 100);
        assert.equals(100, laneOneSolo.currentHp);
    });

    suite.test('triggerPlayerBattleSkill：奧義可透過 targetTileId 走 area resolver', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('zhuge-liang', Faction.Player, 'cao-cao-tactics');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;

        const center = createEnemyUnit('enemy-center', 2, 3);
        const adjacent = createEnemyUnit('enemy-adjacent', 3, 4);
        const far = createEnemyUnit('enemy-far', 4, 6);
        ctrl.state.addUnit(center);
        ctrl.state.addUnit(adjacent);
        ctrl.state.addUnit(far);

        const didCast = ctrl.triggerPlayerBattleSkill('zhuge-liang-storm', SkillSourceType.Ultimate, {
            targetMode: BattleSkillTargetMode.Area,
            targetTileId: '2,3',
        });

        assert.isTrue(didCast);
        assert.equals(0, playerGeneral.currentSp);
        assert.isTrue(center.currentHp < 100);
        assert.isTrue(adjacent.currentHp < 100);
        assert.equals(100, far.currentHp);
    });

    suite.test('triggerPlayerBattleSkill：奧義不帶 targetTileId 也會自動選最佳範圍', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('zhuge-liang', Faction.Player, 'cao-cao-tactics');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;

        const clusterA1 = createEnemyUnit('enemy-a1', 2, 3);
        const clusterA2 = createEnemyUnit('enemy-a2', 3, 3);
        const clusterA3 = createEnemyUnit('enemy-a3', 3, 4);
        const isolated = createEnemyUnit('enemy-b1', 0, 6);
        ctrl.state.addUnit(clusterA1);
        ctrl.state.addUnit(clusterA2);
        ctrl.state.addUnit(clusterA3);
        ctrl.state.addUnit(isolated);

        const didCast = ctrl.triggerPlayerBattleSkill('zhuge-liang-storm', SkillSourceType.Ultimate, {
            targetMode: BattleSkillTargetMode.Area,
        });

        assert.isTrue(didCast);
        assert.equals(0, playerGeneral.currentSp);
        assert.isTrue(clusterA1.currentHp < 100);
        assert.isTrue(clusterA2.currentHp < 100);
        assert.isTrue(clusterA3.currentHp < 100);
        assert.equals(100, isolated.currentHp);
    });

    suite.test('triggerPlayerBattleSkill：固定支援型奧義不帶目標也會治療全體友軍', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('liu-bei', Faction.Player, 'liu-bei-rally');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;

        const allyA = new TroopUnit('ally-a', TroopType.Infantry, Faction.Player, {
            hp: 120,
            attack: 30,
            defense: 10,
            moveRange: 1,
            attackRange: 1,
        });
        allyA.moveTo(1, 1);
        allyA.takeDamage(50);
        const allyB = new TroopUnit('ally-b', TroopType.Infantry, Faction.Player, {
            hp: 90,
            attack: 28,
            defense: 10,
            moveRange: 1,
            attackRange: 1,
        });
        allyB.moveTo(2, 1);
        allyB.takeDamage(20);
        ctrl.state.addUnit(allyA);
        ctrl.state.addUnit(allyB);

        const didCast = ctrl.triggerPlayerBattleSkill('liu-bei-rally', SkillSourceType.Ultimate, {
            targetMode: BattleSkillTargetMode.AllyAll,
        });

        assert.isTrue(didCast);
        assert.equals(0, playerGeneral.currentSp);
        assert.equals(120, allyA.currentHp);
        assert.equals(90, allyB.currentHp);
    });

    suite.test('triggerTigerTallySkill：可透過 tiger tally request 直接發動虎符戰法', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('tiger-tally-owner', Faction.Player, 'legacy-placeholder-skill');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;

        const target = createEnemyUnit('enemy-target', 2, 3);
        ctrl.state.addUnit(target);

        const result = ctrl.triggerTigerTallySkill(
            {
                tacticId: 'tiger-tally-defense-pierce',
                battleSkillId: 'tally-defense-pierce',
                targetMode: BattleSkillTargetMode.EnemySingle,
                unitType: 'infantry',
                unitName: '無視防禦',
                abilities: ['穿甲'],
                source: { sourceType: '名將遺贈虎符', origin: '測試來源' },
            },
            playerGeneral.id,
            {
                battleSkillId: 'tally-defense-pierce',
                tacticId: 'tiger-tally-defense-pierce',
                targetMode: BattleSkillTargetMode.EnemySingle,
                targetUnitUid: target.id,
            },
        );

        assert.isTrue(result.applied);
        assert.equals('tally-defense-pierce', result.battleSkillId);
        assert.equals(playerGeneral.maxSp, playerGeneral.currentSp);
        assert.isTrue(target.currentHp < 100);
        assert.equals(1, result.deltas.length);
        assert.isTrue(result.battleLogLines.length > 0);
    });

    suite.test('triggerPlayerBattleSkill：連環計建立傷害連結後，主目標受擊會同步分攤給相鄰敵軍', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('pang-tong', Faction.Player, 'cao-cao-tactics');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;

        const primary = createEnemyUnit('enemy-primary', 2, 3);
        const linked = createEnemyUnit('enemy-linked', 3, 3);
        const far = createEnemyUnit('enemy-far', 4, 6);
        ctrl.state.addUnit(primary);
        ctrl.state.addUnit(linked);
        ctrl.state.addUnit(far);

        const didLink = ctrl.triggerPlayerBattleSkill('lian-huan-chain', SkillSourceType.Ultimate, {
            targetMode: BattleSkillTargetMode.EnemySingle,
            targetUnitUid: 'enemy-primary',
        });

        assert.isTrue(didLink);
        assert.equals(0, playerGeneral.currentSp);

        playerGeneral.currentSp = playerGeneral.maxSp;
        const didDamage = ctrl.triggerPlayerBattleSkill('cao-cao-tactics', SkillSourceType.Ultimate, {
            targetMode: BattleSkillTargetMode.EnemySingle,
            targetUnitUid: 'enemy-primary',
        });

        assert.isTrue(didDamage);
        assert.isTrue(primary.currentHp < 100);
        assert.isTrue(linked.currentHp < 100);
        assert.equals(100, far.currentHp);
    });

    suite.test('triggerPlayerBattleSkill：反擊 stance 會在近戰受擊存活後自動反擊並附加虛弱', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('guo-jia', Faction.Player, 'cao-cao-tactics');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;
        enemyGeneral.currentSp = 0;

        const guardedUnit = new TroopUnit('guarded-unit', TroopType.Medic, Faction.Player, {
            hp: 140,
            attack: 28,
            defense: 12,
            moveRange: 0,
            attackRange: 0,
        });
        guardedUnit.moveTo(2, 2);

        const meleeEnemy = new TroopUnit('melee-enemy', TroopType.Infantry, Faction.Enemy, {
            hp: 120,
            attack: 36,
            defense: 8,
            moveRange: 0,
            attackRange: 1,
        });
        meleeEnemy.moveTo(2, 3);

        ctrl.state.addUnit(guardedUnit);
        ctrl.state.addUnit(meleeEnemy);

        const didCast = ctrl.triggerPlayerBattleSkill('you-qi-counter', SkillSourceType.Ultimate, {
            targetMode: BattleSkillTargetMode.AllySingle,
            targetUnitUid: 'guarded-unit',
        });

        assert.isTrue(didCast);
        assert.equals(0, playerGeneral.currentSp);

        const guardedInitialHp = guardedUnit.currentHp;
        const enemyInitialHp = meleeEnemy.currentHp;
        ctrl.advanceTurn();

        assert.isTrue(guardedUnit.currentHp < guardedInitialHp);
        assert.isTrue(guardedUnit.currentHp > 0);
        assert.isTrue(meleeEnemy.currentHp < enemyInitialHp);
        assert.isTrue(services().buff.hasBuff('melee-enemy', StatusEffect.Weak));
    });

    suite.test('triggerPlayerBattleSkill：再行動 stance 會讓首擊加倍且擊殺後追加一次攻擊', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('guan-yu', Faction.Player, 'cao-cao-tactics');
        const enemyGeneral = createGeneral('lu-bu', Faction.Enemy, 'lu-bu-rampage');
        ctrl.initBattle(playerGeneral, enemyGeneral);
        playerGeneral.currentSp = playerGeneral.maxSp;
        enemyGeneral.currentSp = 0;

        const vanguard = new TroopUnit('player-vanguard', TroopType.Infantry, Faction.Player, {
            hp: 120,
            attack: 40,
            defense: 10,
            moveRange: 0,
            attackRange: 2,
        });
        vanguard.moveTo(2, 2);

        const frontEnemy = new TroopUnit('front-enemy', TroopType.Infantry, Faction.Enemy, {
            hp: 60,
            attack: 18,
            defense: 5,
            moveRange: 0,
            attackRange: 1,
        });
        frontEnemy.moveTo(2, 3);

        const backEnemy = new TroopUnit('back-enemy', TroopType.Infantry, Faction.Enemy, {
            hp: 100,
            attack: 18,
            defense: 5,
            moveRange: 0,
            attackRange: 1,
        });
        backEnemy.moveTo(2, 4);

        ctrl.state.addUnit(vanguard);
        ctrl.state.addUnit(frontEnemy);
        ctrl.state.addUnit(backEnemy);

        const didCast = ctrl.triggerPlayerBattleSkill('wei-zhen-reset', SkillSourceType.Ultimate, {
            targetMode: BattleSkillTargetMode.AllySingle,
            targetUnitUid: 'player-vanguard',
        });

        assert.isTrue(didCast);
        assert.equals(0, playerGeneral.currentSp);

        ctrl.advanceTurn();

        assert.isTrue(frontEnemy.isDead());
        assert.isTrue(backEnemy.currentHp < 100);
    });

    suite.test('initBattle：FloodAttack 會在中線建立 river current，並推進進入河道的單位', () => {
        const originalRandom = Math.random;
        Math.random = () => 0;
        try {
            services().initialize();
            const ctrl = new BattleController();
            const playerGeneral = createGeneral('sun-jian', Faction.Player, 'sun-jian-blade');
            const enemyGeneral = createGeneral('zhang-liao', Faction.Enemy, 'zhang-liao-rush');
            ctrl.initBattle(playerGeneral, enemyGeneral, undefined, undefined, BattleTactic.FloodAttack);

            const riverCell = ctrl.state.getCell(2, 3);
            const riverEffect = ctrl.state.getTileEffect(2, 3);
            assert.equals('river', riverCell!.terrain);
            assert.isDefined(riverEffect);
            assert.equals('river-current', riverEffect!.state);
            assert.equals(1, riverEffect!.forcedMoveSteps!);

            const runner = new TroopUnit('player-runner', TroopType.Cavalry, Faction.Player, {
                hp: 100,
                attack: 30,
                defense: 10,
                moveRange: 1,
                attackRange: 1,
            });
            runner.moveTo(2, 1);
            ctrl.state.addUnit(runner);

            playerGeneral.currentSp = 0;
            enemyGeneral.currentSp = 0;
            ctrl.advanceTurn();

            assert.equals(3, runner.depth);
        } finally {
            Math.random = originalRandom;
        }
    });

    suite.test('initBattle：RockSlide 會建立阻擋格，阻止單位往前推進', () => {
        const originalRandom = Math.random;
        Math.random = () => 0;
        try {
            services().initialize();
            const ctrl = new BattleController();
            const playerGeneral = createGeneral('xu-huang', Faction.Player, 'xu-huang-crush');
            const enemyGeneral = createGeneral('ma-chao', Faction.Enemy, 'ma-chao-charge');
            ctrl.initBattle(playerGeneral, enemyGeneral, undefined, undefined, BattleTactic.RockSlide);

            const rockEffect = ctrl.state.getTileEffect(2, 4);
            assert.isDefined(rockEffect);
            assert.isTrue(rockEffect!.blocksMovement === true);

            const runner = new TroopUnit('player-shield', TroopType.Shield, Faction.Player, {
                hp: 150,
                attack: 20,
                defense: 35,
                moveRange: 1,
                attackRange: 1,
            });
            runner.moveTo(2, 3);
            ctrl.state.addUnit(runner);

            playerGeneral.currentSp = 0;
            enemyGeneral.currentSp = 0;
            ctrl.advanceTurn();

            assert.equals(3, runner.depth);
        } finally {
            Math.random = originalRandom;
        }
    });

    suite.test('initBattle：FireAttack 會建立持續傷害 hazard tile', () => {
        services().initialize();
        const ctrl = new BattleController();
        const playerGeneral = createGeneral('zhou-yu', Faction.Player, 'zhou-yu-blaze');
        const enemyGeneral = createGeneral('cao-ren', Faction.Enemy, 'cao-ren-guard');
        ctrl.initBattle(playerGeneral, enemyGeneral, undefined, undefined, BattleTactic.FireAttack);

        const fireEffect = ctrl.state.getTileEffect(2, 3);
        assert.isDefined(fireEffect);
        assert.equals('hazard-fire', fireEffect!.state);
        assert.equals(15, fireEffect!.damagePerTurn!);
    });

    suite.test('initBattle：AmbushAttack / NightRaid 會注入 scene flags', () => {
        services().initialize();
        const ambushCtrl = new BattleController();
        ambushCtrl.initBattle(
            createGeneral('gan-ning', Faction.Player, 'gan-ning-raid'),
            createGeneral('yuan-shao', Faction.Enemy, 'yuan-shao-line'),
            undefined,
            undefined,
            BattleTactic.AmbushAttack,
        );
        assert.equals(2, ambushCtrl.state.sceneFlags.stealthOpenTurns);
        assert.isFalse(ambushCtrl.state.sceneFlags.nightRaid);

        const nightCtrl = new BattleController();
        nightCtrl.initBattle(
            createGeneral('zhang-he', Faction.Player, 'zhang-he-shadow'),
            createGeneral('liu-bei', Faction.Enemy, 'liu-bei-rally'),
            undefined,
            undefined,
            BattleTactic.NightRaid,
        );
        assert.isTrue(nightCtrl.state.sceneFlags.nightRaid);
        assert.equals(2, nightCtrl.state.sceneFlags.nightRaidOpenTurns);
        assert.equals(0, nightCtrl.state.sceneFlags.stealthOpenTurns);
    });

    suite.test('AmbushAttack：前 2 回合敵軍會忽略我方隱匿單位，之後恢復索敵', () => {
        const originalRandom = Math.random;
        Math.random = () => 0;
        try {
            services().initialize();
            const ctrl = new BattleController();
            const playerGeneral = createGeneral('huang-zhong', Faction.Player, 'huang-zhong-shot');
            const enemyGeneral = createGeneral('xiahou-dun', Faction.Enemy, 'xiahou-dun-charge');
            ctrl.initBattle(playerGeneral, enemyGeneral, undefined, undefined, BattleTactic.AmbushAttack);

            const hiddenUnit = new TroopUnit('hidden-unit', TroopType.Infantry, Faction.Player, {
                hp: 120,
                attack: 10,
                defense: 10,
                moveRange: 0,
                attackRange: 0,
            });
            hiddenUnit.moveTo(2, 2);
            ctrl.state.addUnit(hiddenUnit);

            const enemyUnit = new TroopUnit('enemy-unit', TroopType.Infantry, Faction.Enemy, {
                hp: 300,
                attack: 30,
                defense: 10,
                moveRange: 0,
                attackRange: 1,
            });
            enemyUnit.moveTo(2, 3);
            ctrl.state.addUnit(enemyUnit);

            playerGeneral.currentSp = 0;
            enemyGeneral.currentSp = 0;

            const initialHp = hiddenUnit.currentHp;
            ctrl.advanceTurn();
            assert.equals(initialHp, hiddenUnit.currentHp);
            assert.equals(1, ctrl.state.sceneFlags.stealthOpenTurns);

            ctrl.advanceTurn();
            assert.equals(initialHp, hiddenUnit.currentHp);
            assert.equals(0, ctrl.state.sceneFlags.stealthOpenTurns);

            ctrl.advanceTurn();
            assert.isTrue(hiddenUnit.currentHp < initialHp);
        } finally {
            Math.random = originalRandom;
        }
    });

    suite.test('NightRaid：前 2 回合我方有先制增傷，敵軍遠程視野縮短 1 格', () => {
        const originalRandom = Math.random;
        Math.random = () => 0;
        try {
            services().initialize();
            const ctrl = new BattleController();
            const playerGeneral = createGeneral('zhang-he', Faction.Player, 'zhang-he-shadow');
            const enemyGeneral = createGeneral('liu-bei', Faction.Enemy, 'liu-bei-rally');
            ctrl.initBattle(playerGeneral, enemyGeneral, undefined, undefined, BattleTactic.NightRaid);

            const playerUnit = new TroopUnit('player-archer', TroopType.Archer, Faction.Player, {
                hp: 100,
                attack: 30,
                defense: 10,
                moveRange: 0,
                attackRange: 2,
            });
            playerUnit.moveTo(2, 2);
            ctrl.state.addUnit(playerUnit);

            const enemyUnit = new TroopUnit('enemy-archer', TroopType.Archer, Faction.Enemy, {
                hp: 200,
                attack: 20,
                defense: 10,
                moveRange: 0,
                attackRange: 2,
            });
            enemyUnit.moveTo(2, 4);
            ctrl.state.addUnit(enemyUnit);

            playerGeneral.currentSp = 0;
            enemyGeneral.currentSp = 0;

            const playerInitialHp = playerUnit.currentHp;
            const enemyInitialHp = enemyUnit.currentHp;
            ctrl.advanceTurn();

            assert.isTrue(enemyUnit.currentHp < enemyInitialHp);
            assert.equals(playerInitialHp, playerUnit.currentHp);
            assert.equals(1, ctrl.state.sceneFlags.nightRaidOpenTurns);

            ctrl.advanceTurn();
            assert.equals(0, ctrl.state.sceneFlags.nightRaidOpenTurns);
            assert.isFalse(ctrl.state.sceneFlags.nightRaid);
        } finally {
            Math.random = originalRandom;
        }
    });

    return suite;
}
