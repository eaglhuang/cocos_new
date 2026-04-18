import { createScaffoldV2Suite } from './ucuf/scaffoldV2.test';
import { createValidateUiSpecsCliSuite } from './ucuf/validateUiSpecsCli.test';
import { TestRunner } from './TestRunner';

if (typeof window === 'undefined') {
    (async () => {
        const runner = new TestRunner();
        runner.register(createScaffoldV2Suite());
        runner.register(createValidateUiSpecsCliSuite());
        const summary = await runner.runAll();
        process.exit(summary.failed > 0 ? 1 : 0);
    })();
}
