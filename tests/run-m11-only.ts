import { createAgentGovernanceSuite } from './ucuf/agentGovernance.test';
import { createFinalizeAgentTurnCliSuite } from './ucuf/finalizeAgentTurnCli.test';
import { createUcufRuntimeCheckCliSuite } from './ucuf/ucufRuntimeCheckCli.test';
import { TestRunner } from './TestRunner';

if (typeof window === 'undefined') {
    (async () => {
        const runner = new TestRunner();
        runner.register(createAgentGovernanceSuite());
        runner.register(createFinalizeAgentTurnCliSuite());
        runner.register(createUcufRuntimeCheckCliSuite());
        const summary = await runner.runAll();
        process.exit(summary.failed > 0 ? 1 : 0);
    })();
}