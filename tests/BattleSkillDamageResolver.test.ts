import { Faction } from '../assets/scripts/core/config/Constants';
import { BattleSkillDamageResolver } from '../assets/scripts/battle/skills/BattleSkillDamageResolver';
import { resolveBattleSkillProfile } from '../assets/scripts/battle/skills/BattleSkillProfiles';
import { TestSuite, assert } from './TestRunner';
import { createBattleSkillTestContext, createTestGeneral, createTestUnit } from './BattleSkillTestUtils';

export function createBattleSkillDamageResolverSuite(): TestSuite {
  const suite = new TestSuite('BattleSkillDamageResolver');
  const resolver = new BattleSkillDamageResolver();

  suite.test('ignoreDefense：只忽略防禦減免段，不改變主屬性係數', () => {
    const profile = resolveBattleSkillProfile('cao-cao-tactics');
    assert.isDefined(profile);
    const caster = createTestGeneral('cao-cao', Faction.Player, { str: 40, int: 110, lea: 80 });
    const defender = createTestUnit('enemy', Faction.Enemy, 2, 3, { defense: 40 });
    const bundle = createBattleSkillTestContext({
      playerGeneral: caster,
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [defender],
    });

    const damage = resolver.resolveDamage(profile!, caster, defender, bundle.context, 0);
    assert.equals(55, damage);
  });

  suite.test('linear-step：後續命中必須穩定遞減，不受掃描順序漂移', () => {
    const profile = resolveBattleSkillProfile('guan-yu-slash');
    assert.isDefined(profile);
    const caster = createTestGeneral('guan-yu', Faction.Player, { str: 100, lea: 90 });
    const target = createTestUnit('enemy', Faction.Enemy, 2, 3);
    const bundle = createBattleSkillTestContext({
      playerGeneral: caster,
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [target],
    });

    const firstHit = resolver.resolveDamage(profile!, caster, target, bundle.context, 0);
    const secondHit = resolver.resolveDamage(profile!, caster, target, bundle.context, 1);
    const thirdHit = resolver.resolveDamage(profile!, caster, target, bundle.context, 2);
    assert.equals(72, firstHit);
    assert.equals(63, secondHit);
    assert.equals(55, thirdHit);
  });
  suite.test('defensePenetrationRatio：tally-defense-pierce 穿甲後傷害高於無穿甲', () => {
    const profile = resolveBattleSkillProfile('tally-defense-pierce');
    assert.isDefined(profile);
    // str:100, lea:80 → floor(100*0.7+80*0.3)=94; coeff 1.0 → scaledAttack=94
    // defense=40; with penetration=0.5 → defenderDefense=floor(40*0.5)=20
    // damage = max(1, 94-20) = 74
    const caster = createTestGeneral('test-pierce', Faction.Player, { str: 100, lea: 80 });
    const target = createTestUnit('enemy', Faction.Enemy, 2, 3, { defense: 40 });
    const bundle = createBattleSkillTestContext({
      playerGeneral: caster,
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [target],
    });
    const damage = resolver.resolveDamage(profile!, caster, target, bundle.context, 0);
    assert.equals(74, damage);
  });

  suite.test('critBonus：tally-hundred-steps 傷害含 flat 50% 爆擊加成', () => {
    const profile = resolveBattleSkillProfile('tally-hundred-steps');
    assert.isDefined(profile);
    // str:100, lea:80 → base=94; coeff 1.2 → scaledAttack=floor(94*1.2)=112
    // defense=20; baseDamage=max(1,112-20)=92; critBonus=0.5 → max(1,floor(92*1.5))=138
    const caster = createTestGeneral('test-hundred', Faction.Player, { str: 100, lea: 80 });
    const target = createTestUnit('enemy', Faction.Enemy, 2, 3, { defense: 20 });
    const bundle = createBattleSkillTestContext({
      playerGeneral: caster,
      enemyGeneral: createTestGeneral('enemy-general', Faction.Enemy),
      units: [target],
    });
    const damage = resolver.resolveDamage(profile!, caster, target, bundle.context, 0);
    assert.equals(138, damage);
  });
  return suite;
}
