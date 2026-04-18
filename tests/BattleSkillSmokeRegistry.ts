import { TestRunner } from './TestRunner';
import { createBattleSkillExecutorSuite } from './BattleSkillExecutor.test';
import { createBattleSkillSourceTranslatorSuite } from './BattleSkillSourceTranslator.test';
import { createBattleSkillTargetSelectorSuite } from './BattleSkillTargetSelector.test';
import { createBattleSkillDamageResolverSuite } from './BattleSkillDamageResolver.test';
import { createBattleControllerSkillTargetingSuite } from './BattleControllerSkillTargeting.test';
import { createBattleCombatRegressionSuite } from './BattleCombatRegression.test';
import { createBattleSkillProfileAutoTargetingSuite } from './BattleSkillProfileAutoTargeting.test';

export function registerBattleSkillSmokeSuites(runner: TestRunner): TestRunner {
  runner.register(createBattleSkillExecutorSuite());
  runner.register(createBattleSkillSourceTranslatorSuite());
  runner.register(createBattleSkillTargetSelectorSuite());
  runner.register(createBattleSkillDamageResolverSuite());
  runner.register(createBattleControllerSkillTargetingSuite());
  runner.register(createBattleCombatRegressionSuite());
  runner.register(createBattleSkillProfileAutoTargetingSuite());
  return runner;
}
