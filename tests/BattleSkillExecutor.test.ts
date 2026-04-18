import { createDefaultBattleSkillExecutor } from '../assets/scripts/battle/skills/BattleSkillResolverFactory';
import { BattleSkillTargetMode, BattleSkillTiming, SkillSourceType } from '../shared/skill-runtime';
import { TestSuite, assert } from './TestRunner';
import { createBattleSkillTestContext, createTestGeneral, createTestUnit } from './BattleSkillTestUtils';

import { Faction, StatusEffect } from '../assets/scripts/core/config/Constants';

function createRequest(
    battleSkillId: string,
    ownerUid: Faction,
    targetMode: BattleSkillTargetMode,
    targetUnitUid?: string,
    targetTileId?: string,
    sourceType: SkillSourceType = SkillSourceType.SeedTactic,
) {
    return {
        sourceType,
        ownerUid,
        generalTemplateId: `${ownerUid}-general`,
        battleSkillId,
        targetMode,
        timing: BattleSkillTiming.ActiveCast,
        targetUnitUid,
        targetTileId,
    };
}

export function createBattleSkillExecutorSuite(): TestSuite {
    const suite = new TestSuite('BattleSkillExecutor');

    suite.test('zhang-fei-roar：對所有敵軍施加暈眩並解除盾牆', () => {
        const executor = createDefaultBattleSkillExecutor();
        const enemyA = createTestUnit('enemy-a', Faction.Enemy, 1, 4);
        const enemyB = createTestUnit('enemy-b', Faction.Enemy, 3, 4);
        enemyA.isShieldWallActive = true;
        enemyB.isShieldWallActive = true;

        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('player-general', Faction.Player),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [enemyA, enemyB],
        });

        const result = executor.execute(
            createRequest('zhang-fei-roar', Faction.Player, BattleSkillTargetMode.EnemyAll),
            bundle.context,
        );
        assert.isTrue(result.applied);
        assert.lengthEquals(2, bundle.buffLog);
        assert.equals(StatusEffect.Stun, bundle.buffLog[0].effect);
        assert.isFalse(enemyA.isShieldWallActive);
        assert.isFalse(enemyB.isShieldWallActive);
    });

    suite.test('guan-yu-slash：直線選區按深度順序命中並套用傷害衰減', () => {
        const executor = createDefaultBattleSkillExecutor();
        const enemyA = createTestUnit('enemy-a', Faction.Enemy, 2, 2);
        const enemyB = createTestUnit('enemy-b', Faction.Enemy, 2, 3);
        const enemyC = createTestUnit('enemy-c', Faction.Enemy, 2, 4);
        const sideEnemy = createTestUnit('enemy-side', Faction.Enemy, 1, 3);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('guan-yu', Faction.Player, { str: 100, lea: 90 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [enemyA, enemyB, enemyC, sideEnemy],
        });

        const result = executor.execute(
            createRequest('guan-yu-slash', Faction.Player, BattleSkillTargetMode.Line, 'enemy-a'),
            bundle.context,
        );
        assert.isTrue(result.applied);
        assert.lengthEquals(3, bundle.damageLog);
        assert.equals('enemy-a', bundle.damageLog[0].unitId);
        assert.equals('enemy-b', bundle.damageLog[1].unitId);
        assert.equals('enemy-c', bundle.damageLog[2].unitId);
        assert.greaterOrEqual(bundle.damageLog[2].damage, bundle.damageLog[1].damage);
        assert.greaterOrEqual(bundle.damageLog[1].damage, bundle.damageLog[0].damage);
        assert.equals(28, enemyA.currentHp);
        assert.equals(37, enemyB.currentHp);
        assert.equals(45, enemyC.currentHp);
        assert.equals(100, sideEnemy.currentHp);
    });

    suite.test('lu-bu-rampage：扇形選區只命中錐形邊界內的目標', () => {
        const executor = createDefaultBattleSkillExecutor();
        const anchor = createTestUnit('enemy-anchor', Faction.Enemy, 2, 3);
        const leftWing = createTestUnit('enemy-left', Faction.Enemy, 1, 4);
        const rightWing = createTestUnit('enemy-right', Faction.Enemy, 3, 4);
        const outsideSameDepth = createTestUnit('enemy-outside-same-depth', Faction.Enemy, 1, 3);
        const outsideTooWide = createTestUnit('enemy-outside-wide', Faction.Enemy, 0, 4);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('lu-bu-proxy', Faction.Player, { str: 130, lea: 95 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [anchor, leftWing, rightWing, outsideSameDepth, outsideTooWide],
        });

        const result = executor.execute(
            createRequest('lu-bu-rampage', Faction.Player, BattleSkillTargetMode.Fan, 'enemy-anchor'),
            bundle.context,
        );
        assert.isTrue(result.applied);
        assert.lengthEquals(3, bundle.damageLog);
        assert.equals('enemy-anchor', bundle.damageLog[0].unitId);
        assert.equals('enemy-left', bundle.damageLog[1].unitId);
        assert.equals('enemy-right', bundle.damageLog[2].unitId);
        assert.equals(21, anchor.currentHp);
        assert.equals(30, leftWing.currentHp);
        assert.equals(39, rightWing.currentHp);
        assert.equals(100, outsideSameDepth.currentHp);
        assert.equals(100, outsideTooWide.currentHp);
    });

    suite.test('cao-cao-tactics：單體技優先命中指定目標並忽略防禦段', () => {
        const executor = createDefaultBattleSkillExecutor();
        const defender = createTestUnit('enemy-high-def', Faction.Enemy, 2, 3, { defense: 40 });
        const otherEnemy = createTestUnit('enemy-other', Faction.Enemy, 3, 3);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('cao-cao-proxy', Faction.Player, { str: 40, int: 110, lea: 80 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [defender, otherEnemy],
        });

        const result = executor.execute(
            createRequest('cao-cao-tactics', Faction.Player, BattleSkillTargetMode.EnemySingle, 'enemy-high-def'),
            bundle.context,
        );
        assert.isTrue(result.applied);
        assert.lengthEquals(1, bundle.damageLog);
        assert.equals('enemy-high-def', bundle.damageLog[0].unitId);
        assert.equals(45, defender.currentHp);
        assert.equals(100, otherEnemy.currentHp);
    });

    suite.test('zhuge-liang-storm：以 targetTileId 為中心命中範圍內敵軍', () => {
        const executor = createDefaultBattleSkillExecutor();
        const center = createTestUnit('enemy-center', Faction.Enemy, 2, 3);
        const adjacent = createTestUnit('enemy-adjacent', Faction.Enemy, 2, 4);
        const diagonal = createTestUnit('enemy-diagonal', Faction.Enemy, 3, 4);
        const far = createTestUnit('enemy-far', Faction.Enemy, 4, 6);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('zhuge-liang', Faction.Player, { str: 40, int: 120, lea: 95 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [center, adjacent, diagonal, far],
        });

        const result = executor.execute(
            createRequest('zhuge-liang-storm', Faction.Player, BattleSkillTargetMode.Area, undefined, '2,3', SkillSourceType.Ultimate),
            bundle.context,
        );
        assert.isTrue(result.applied);
        assert.lengthEquals(3, bundle.damageLog);
        assert.equals('enemy-center', bundle.damageLog[0].unitId);
        assert.equals('enemy-adjacent', bundle.damageLog[1].unitId);
        assert.equals('enemy-diagonal', bundle.damageLog[2].unitId);
        assert.equals(30, center.currentHp);
        assert.equals(38, adjacent.currentHp);
        assert.equals(46, diagonal.currentHp);
        assert.equals(100, far.currentHp);
    });

    suite.test('sun-quan-tide：相鄰格位模式不命中中心格單位', () => {
        const executor = createDefaultBattleSkillExecutor();
        const center = createTestUnit('enemy-center', Faction.Enemy, 2, 3);
        const adjacent = createTestUnit('enemy-adjacent', Faction.Enemy, 3, 3);
        const diagonal = createTestUnit('enemy-diagonal', Faction.Enemy, 1, 2);
        const far = createTestUnit('enemy-far', Faction.Enemy, 4, 5);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('sun-quan', Faction.Player, { str: 55, int: 100, lea: 85 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [center, adjacent, diagonal, far],
        });

        const result = executor.execute(
            createRequest('sun-quan-tide', Faction.Player, BattleSkillTargetMode.AdjacentTiles, undefined, '2,3', SkillSourceType.Ultimate),
            bundle.context,
        );
        assert.isTrue(result.applied);
        assert.lengthEquals(2, bundle.damageLog);
        assert.equals('enemy-diagonal', bundle.damageLog[0].unitId);
        assert.equals('enemy-adjacent', bundle.damageLog[1].unitId);
        assert.equals(100, center.currentHp);
        assert.equals(46, diagonal.currentHp);
        assert.equals(53, adjacent.currentHp);
        assert.equals(100, far.currentHp);
    });

    suite.test('liu-bei-rally：固定支援範圍會治療全體友軍', () => {
        const executor = createDefaultBattleSkillExecutor();
        const allyA = createTestUnit('ally-a', Faction.Player, 1, 1, { hp: 120 });
        const allyB = createTestUnit('ally-b', Faction.Player, 2, 1, { hp: 90 });
        allyA.takeDamage(50);
        allyB.takeDamage(25);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('liu-bei', Faction.Player, { hp: 1200, cha: 110 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [allyA, allyB],
        });

        const result = executor.execute(
            createRequest('liu-bei-rally', Faction.Player, BattleSkillTargetMode.AllyAll, undefined, undefined, SkillSourceType.Ultimate),
            bundle.context,
        );
        assert.isTrue(result.applied);
        assert.lengthEquals(2, bundle.healLog);
        assert.equals(120, allyA.currentHp);
        assert.equals(90, allyB.currentHp);
    });

    suite.test('diao-chan-charm：固定敵軍範圍會套用控制效果', () => {
        const executor = createDefaultBattleSkillExecutor();
        const enemyA = createTestUnit('enemy-a', Faction.Enemy, 1, 4);
        const enemyB = createTestUnit('enemy-b', Faction.Enemy, 3, 4);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('diao-chan', Faction.Player, { cha: 120 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [enemyA, enemyB],
        });

        const result = executor.execute(
            createRequest('diao-chan-charm', Faction.Player, BattleSkillTargetMode.EnemyAll, undefined, undefined, SkillSourceType.Ultimate),
            bundle.context,
        );
        assert.isTrue(result.applied);
        assert.lengthEquals(2, bundle.buffLog);
        assert.equals(StatusEffect.Stun, bundle.buffLog[0].effect);
        assert.equals(StatusEffect.Stun, bundle.buffLog[1].effect);
    });

    suite.test('sima-yi-shadow：固定全敵範圍技能會命中全部敵軍', () => {
        const executor = createDefaultBattleSkillExecutor();
        const enemyA = createTestUnit('enemy-a', Faction.Enemy, 1, 3);
        const enemyB = createTestUnit('enemy-b', Faction.Enemy, 2, 4);
        const enemyC = createTestUnit('enemy-c', Faction.Enemy, 3, 5);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('sima-yi', Faction.Player, { int: 115, lea: 95 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [enemyA, enemyB, enemyC],
        });

        const result = executor.execute(
            createRequest('sima-yi-shadow', Faction.Player, BattleSkillTargetMode.EnemyAll, undefined, undefined, SkillSourceType.Ultimate),
            bundle.context,
        );
        assert.isTrue(result.applied);
        assert.lengthEquals(3, bundle.damageLog);
        assert.isTrue(enemyA.currentHp < 100);
        assert.isTrue(enemyB.currentHp < 100);
        assert.isTrue(enemyC.currentHp < 100);
    });

    suite.test('lian-huan-chain：會建立主目標到相鄰敵軍的傷害共享連結', () => {
        const executor = createDefaultBattleSkillExecutor();
        const primary = createTestUnit('enemy-primary', Faction.Enemy, 2, 3);
        const linkedA = createTestUnit('enemy-linked-a', Faction.Enemy, 2, 4);
        const linkedB = createTestUnit('enemy-linked-b', Faction.Enemy, 3, 3);
        const far = createTestUnit('enemy-far', Faction.Enemy, 4, 6);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('link-caster', Faction.Player, { int: 100 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [primary, linkedA, linkedB, far],
        });

        const result = executor.execute(
            createRequest('lian-huan-chain', Faction.Player, BattleSkillTargetMode.EnemySingle, 'enemy-primary'),
            bundle.context,
        );

        assert.isTrue(result.applied);
        assert.lengthEquals(1, bundle.linkLog);
        assert.equals('enemy-primary', bundle.linkLog[0].primaryUnitId);
        assert.lengthEquals(2, bundle.linkLog[0].linkedUnitIds);
        assert.contains(bundle.linkLog[0].linkedUnitIds.join(','), 'enemy-linked-a');
        assert.contains(bundle.linkLog[0].linkedUnitIds.join(','), 'enemy-linked-b');
        assert.notContains(bundle.linkLog[0].linkedUnitIds.join(','), 'enemy-far');
    });

    suite.test('you-qi-counter：會為指定友軍掛上近戰反擊狀態', () => {
        const executor = createDefaultBattleSkillExecutor();
        const allyFront = createTestUnit('ally-front', Faction.Player, 2, 2);
        const allyBack = createTestUnit('ally-back', Faction.Player, 2, 1);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('counter-caster', Faction.Player, { int: 110 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [allyFront, allyBack],
        });

        const result = executor.execute(
            createRequest('you-qi-counter', Faction.Player, BattleSkillTargetMode.AllySingle, 'ally-front'),
            bundle.context,
        );

        assert.isTrue(result.applied);
        assert.lengthEquals(1, bundle.counterLog);
        assert.equals('ally-front', bundle.counterLog[0].unitId);
        assert.equals('you-qi-counter', bundle.counterLog[0].battleSkillId);
        assert.equals(2, bundle.counterLog[0].counterRatio);
        assert.isTrue(bundle.counterLog[0].meleeOnly);
    });

    suite.test('wei-zhen-reset：會為指定友軍掛上首擊加倍與擊殺再行動狀態', () => {
        const executor = createDefaultBattleSkillExecutor();
        const allyFront = createTestUnit('ally-front', Faction.Player, 2, 2);
        const bundle = createBattleSkillTestContext({
            playerGeneral: createTestGeneral('reset-caster', Faction.Player, { str: 110 }),
            enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
            units: [allyFront],
        });

        const result = executor.execute(
            createRequest('wei-zhen-reset', Faction.Player, BattleSkillTargetMode.AllySingle, 'ally-front'),
            bundle.context,
        );

        assert.isTrue(result.applied);
        assert.lengthEquals(1, bundle.resetLog);
        assert.equals('ally-front', bundle.resetLog[0].unitId);
        assert.equals(2, bundle.resetLog[0].firstHitMultiplier);
        assert.equals(1, bundle.resetLog[0].extraActions);
    });

    return suite;
}
