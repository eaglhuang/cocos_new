import { Faction } from '../assets/scripts/core/config/Constants';
import { BattleSkillTargetMode, BattleSkillTiming, SkillSourceType } from '../shared/skill-runtime';
import { resolveBattleSkillProfile } from '../assets/scripts/battle/skills/BattleSkillProfiles';
import { BattleSkillTargetSelector } from '../assets/scripts/battle/skills/BattleSkillTargetSelector';
import { TestSuite, assert } from './TestRunner';
import { createBattleSkillTestContext, createTestGeneral, createTestUnit } from './BattleSkillTestUtils';

export function createBattleSkillTargetSelectorSuite(): TestSuite {
  const suite = new TestSuite('BattleSkillTargetSelector');
  const selector = new BattleSkillTargetSelector();

  suite.test('EnemySingle：指定目標時只回傳該目標', () => {
    const target = createTestUnit('enemy-target', Faction.Enemy, 2, 3);
    const other = createTestUnit('enemy-other', Faction.Enemy, 3, 2);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [target, other],
    });

    const profile = resolveBattleSkillProfile('cao-cao-tactics');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.SeedTactic,
      ownerUid: Faction.Player,
      battleSkillId: 'cao-cao-tactics',
      targetMode: BattleSkillTargetMode.EnemySingle,
      timing: BattleSkillTiming.ActiveCast,
      targetUnitUid: 'enemy-target',
    }, profile!, bundle.context);

    assert.lengthEquals(1, targets);
    assert.equals('enemy-target', targets[0].id);
  });

  suite.test('EnemyAll：回傳全部敵軍作為固定範圍', () => {
    const enemyA = createTestUnit('enemy-a', Faction.Enemy, 2, 3);
    const enemyB = createTestUnit('enemy-b', Faction.Enemy, 3, 4);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [enemyA, enemyB],
    });

    const profile = resolveBattleSkillProfile('diao-chan-charm');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.Ultimate,
      ownerUid: Faction.Player,
      battleSkillId: 'diao-chan-charm',
      targetMode: BattleSkillTargetMode.EnemyAll,
      timing: BattleSkillTiming.ActiveCast,
    }, profile!, bundle.context);

    assert.lengthEquals(2, targets);
    assert.equals('enemy-a', targets[0].id);
    assert.equals('enemy-b', targets[1].id);
  });

  suite.test('AllyAll：回傳全部友軍作為固定範圍', () => {
    const allyA = createTestUnit('ally-a', Faction.Player, 1, 1);
    const allyB = createTestUnit('ally-b', Faction.Player, 2, 1);
    const enemy = createTestUnit('enemy-a', Faction.Enemy, 2, 4);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [allyA, allyB, enemy],
    });

    const profile = resolveBattleSkillProfile('liu-bei-rally');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.Ultimate,
      ownerUid: Faction.Player,
      battleSkillId: 'liu-bei-rally',
      targetMode: BattleSkillTargetMode.AllyAll,
      timing: BattleSkillTiming.ActiveCast,
    }, profile!, bundle.context);

    assert.lengthEquals(2, targets);
    assert.equals('ally-a', targets[0].id);
    assert.equals('ally-b', targets[1].id);
  });

  suite.test('EnemySingle：未指定目標時自動鎖定前線敵軍', () => {
    const frontline = createTestUnit('enemy-frontline', Faction.Enemy, 2, 1);
    const backline = createTestUnit('enemy-backline', Faction.Enemy, 1, 4);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [backline, frontline],
    });

    const profile = resolveBattleSkillProfile('cao-cao-tactics');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.SeedTactic,
      ownerUid: Faction.Player,
      battleSkillId: 'cao-cao-tactics',
      targetMode: BattleSkillTargetMode.EnemySingle,
      timing: BattleSkillTiming.ActiveCast,
    }, profile!, bundle.context);

    assert.lengthEquals(1, targets);
    assert.equals('enemy-frontline', targets[0].id);
  });

  suite.test('Line：只選取同 lane 且位於 anchor 之後的目標', () => {
    const anchor = createTestUnit('enemy-a', Faction.Enemy, 1, 2);
    const sameLane = createTestUnit('enemy-b', Faction.Enemy, 1, 4);
    const beforeAnchor = createTestUnit('enemy-c', Faction.Enemy, 1, 1);
    const otherLane = createTestUnit('enemy-d', Faction.Enemy, 2, 4);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [anchor, sameLane, beforeAnchor, otherLane],
    });

    const profile = resolveBattleSkillProfile('guan-yu-slash');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.SeedTactic,
      ownerUid: Faction.Player,
      battleSkillId: 'guan-yu-slash',
      targetMode: BattleSkillTargetMode.Line,
      timing: BattleSkillTiming.ActiveCast,
      targetUnitUid: 'enemy-a',
    }, profile!, bundle.context);

    assert.lengthEquals(2, targets);
    assert.equals('enemy-a', targets[0].id);
    assert.equals('enemy-b', targets[1].id);
  });

  suite.test('Line：未指定 anchor 時自動選擇最佳直線', () => {
    const laneTwoFront = createTestUnit('enemy-l2-front', Faction.Enemy, 2, 2);
    const laneTwoBack = createTestUnit('enemy-l2-back', Faction.Enemy, 2, 4);
    const laneOneSolo = createTestUnit('enemy-l1-solo', Faction.Enemy, 1, 1);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [laneTwoFront, laneTwoBack, laneOneSolo],
    });

    const profile = resolveBattleSkillProfile('guan-yu-slash');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.SeedTactic,
      ownerUid: Faction.Player,
      battleSkillId: 'guan-yu-slash',
      targetMode: BattleSkillTargetMode.Line,
      timing: BattleSkillTiming.ActiveCast,
    }, profile!, bundle.context);

    assert.lengthEquals(2, targets);
    assert.equals('enemy-l2-front', targets[0].id);
    assert.equals('enemy-l2-back', targets[1].id);
  });

  suite.test('Fan：角度邊界只納入 tip 與下一列左右翼', () => {
    const anchor = createTestUnit('enemy-tip', Faction.Enemy, 2, 3);
    const leftWing = createTestUnit('enemy-left', Faction.Enemy, 1, 4);
    const rightWing = createTestUnit('enemy-right', Faction.Enemy, 3, 4);
    const sameDepthAdjacent = createTestUnit('enemy-same-depth-adjacent', Faction.Enemy, 1, 3);
    const tooWide = createTestUnit('enemy-too-wide', Faction.Enemy, 0, 4);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [anchor, leftWing, rightWing, sameDepthAdjacent, tooWide],
    });

    const profile = resolveBattleSkillProfile('lu-bu-rampage');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.SeedTactic,
      ownerUid: Faction.Player,
      battleSkillId: 'lu-bu-rampage',
      targetMode: BattleSkillTargetMode.Fan,
      timing: BattleSkillTiming.ActiveCast,
      targetUnitUid: 'enemy-tip',
    }, profile!, bundle.context);

    assert.lengthEquals(3, targets);
    assert.equals('enemy-tip', targets[0].id);
    assert.equals('enemy-left', targets[1].id);
    assert.equals('enemy-right', targets[2].id);
  });

  suite.test('Area：以 targetTileId 為中心抓取半徑 1 內敵軍', () => {
    const center = createTestUnit('enemy-center', Faction.Enemy, 2, 3);
    const around = createTestUnit('enemy-around', Faction.Enemy, 3, 4);
    const far = createTestUnit('enemy-far', Faction.Enemy, 4, 6);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [center, around, far],
    });

    const profile = resolveBattleSkillProfile('zhuge-liang-storm');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.Ultimate,
      ownerUid: Faction.Player,
      battleSkillId: 'zhuge-liang-storm',
      targetMode: BattleSkillTargetMode.Area,
      timing: BattleSkillTiming.ActiveCast,
      targetTileId: '2,3',
    }, profile!, bundle.context);

    assert.lengthEquals(2, targets);
    assert.equals('enemy-center', targets[0].id);
    assert.equals('enemy-around', targets[1].id);
  });

  suite.test('Area：未指定中心格時自動選擇命中數最高區塊', () => {
    const clusterA1 = createTestUnit('enemy-a1', Faction.Enemy, 2, 3);
    const clusterA2 = createTestUnit('enemy-a2', Faction.Enemy, 3, 3);
    const clusterA3 = createTestUnit('enemy-a3', Faction.Enemy, 3, 4);
    const clusterB1 = createTestUnit('enemy-b1', Faction.Enemy, 0, 6);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [clusterA1, clusterA2, clusterA3, clusterB1],
    });

    const profile = resolveBattleSkillProfile('zhuge-liang-storm');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.Ultimate,
      ownerUid: Faction.Player,
      battleSkillId: 'zhuge-liang-storm',
      targetMode: BattleSkillTargetMode.Area,
      timing: BattleSkillTiming.ActiveCast,
    }, profile!, bundle.context);

    assert.lengthEquals(3, targets);
    assert.equals('enemy-a1', targets[0].id);
    assert.equals('enemy-a2', targets[1].id);
    assert.equals('enemy-a3', targets[2].id);
  });

  suite.test('AdjacentTiles：排除中心格，只取相鄰格位敵軍', () => {
    const center = createTestUnit('enemy-center', Faction.Enemy, 2, 3);
    const adjacent = createTestUnit('enemy-adjacent', Faction.Enemy, 3, 3);
    const diagonal = createTestUnit('enemy-diagonal', Faction.Enemy, 1, 2);
    const far = createTestUnit('enemy-far', Faction.Enemy, 4, 5);
    const bundle = createBattleSkillTestContext({
      playerGeneral: createTestGeneral('player-general', Faction.Player),
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [center, adjacent, diagonal, far],
    });

    const profile = resolveBattleSkillProfile('sun-quan-tide');
    assert.isDefined(profile);
    const targets = selector.selectTargets({
      sourceType: SkillSourceType.Ultimate,
      ownerUid: Faction.Player,
      battleSkillId: 'sun-quan-tide',
      targetMode: BattleSkillTargetMode.AdjacentTiles,
      timing: BattleSkillTiming.ActiveCast,
      targetTileId: '2,3',
    }, profile!, bundle.context);

    assert.lengthEquals(2, targets);
    assert.equals('enemy-diagonal', targets[0].id);
    assert.equals('enemy-adjacent', targets[1].id);
  });

  return suite;
}
