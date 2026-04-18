import { registerBattleSkillSmokeSuites } from './BattleSkillSmokeRegistry';
import { TestRunner } from './TestRunner';

if (typeof window === 'undefined') {
  (async () => {
    const runner = new TestRunner();
    registerBattleSkillSmokeSuites(runner);
    const summary = await runner.runAll();
    process.exit(summary.failed > 0 ? 1 : 0);
  })();
}
