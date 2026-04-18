import { TestSuite, assert } from './TestRunner';
import { listBattleSkillProfiles, requiresBattleSkillManualTargeting } from '../assets/scripts/battle/skills/BattleSkillProfiles';

export function createBattleSkillProfileAutoTargetingSuite(): TestSuite {
    const suite = new TestSuite('BattleSkillProfileAutoTargeting');

    suite.test('初始與既有戰技 profile 都應維持自動選目標', () => {
        const profiles = listBattleSkillProfiles();
        assert.isTrue(profiles.length > 0, 'Expected at least one battle skill profile');

        for (const profile of profiles) {
            assert.isDefined(profile.battleSkillId);
            assert.isFalse(
                requiresBattleSkillManualTargeting(profile.battleSkillId),
                `Expected ${profile.battleSkillId} to stay auto-targeted`
            );
            assert.isFalse(
                profile.manualTargeting ?? false,
                `Expected ${profile.battleSkillId} manualTargeting to remain false`
            );
            assert.isDefined(profile.autoAimMode, `Expected ${profile.battleSkillId} to define autoAimMode`);
        }
    });

    return suite;
}