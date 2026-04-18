/**
 * finalizeAgentTurnCli.test.ts — UCUF M11 finalize-agent-turn CLI integration tests
 */

import { TestSuite, assert } from '../TestRunner';
import { spawnSync } from 'child_process';
import * as path from 'path';

interface StubMap {
    [scriptName: string]: {
        status?: number;
        ok?: boolean;
        stdout?: string;
        stderr?: string;
    };
}

function runFinalizeAgentTurn(args: string[], stubs?: StubMap): { status: number | null; stdout: string; stderr: string; json: any } {
    const scriptPath = path.resolve(__dirname, '../../tools_node/finalize-agent-turn.js');
    const result = spawnSync(process.execPath, [scriptPath, ...args, '--json'], {
        cwd: path.resolve(__dirname, '../..'),
        env: {
            ...process.env,
            ...(stubs ? { FINALIZE_AGENT_TURN_TEST_STUBS: JSON.stringify(stubs) } : {}),
        },
        encoding: 'utf8',
    });

    const stdout = result.stdout || '';
    return {
        status: result.status,
        stdout,
        stderr: result.stderr || '',
        json: JSON.parse(stdout),
    };
}

export function createFinalizeAgentTurnCliSuite(): TestSuite {
    const suite = new TestSuite('M11: finalize-agent-turn CLI integration');

    suite.test('skip-ucuf 會回傳 skipped gate', () => {
        const result = runFinalizeAgentTurn([
            '--workflow', 'plain-workflow',
            '--task', 'skip-test',
            '--skip-ucuf',
            '--files', 'tests/run-cli.ts',
        ]);

        assert.equals(0, result.status ?? -1, `CLI 應成功結束，stderr:\n${result.stderr}`);
        assert.isTrue(result.json.ucufGate.skipped === true, 'ucufGate.skipped 應為 true');
        assert.isTrue(result.json.ucufGate.passed === true, 'skip 時應視為 passed');
    });

    suite.test('UCUF workflow 且所有 gate 成功時回傳 passed=true', () => {
        const result = runFinalizeAgentTurn([
            '--workflow', 'ucuf-batch',
            '--task', 'pass-test',
            '--files', 'tests/run-cli.ts',
        ], {
            'validate-ui-specs.js': { status: 0, stdout: 'ok' },
            'ucuf-runtime-check.js': { status: 0, stdout: '{"errors":[]}' },
            'ucuf-conflict-detect.js': { status: 0, stdout: 'ok' },
            'check-encoding-touched.js': { status: 0, stdout: 'ok' },
        });

        assert.equals(0, result.status ?? -1, `CLI 應成功結束，stderr:\n${result.stderr}`);
        assert.isTrue(result.json.ucufGate.passed === true, 'ucufGate.passed 應為 true');
        assert.equals(0, result.json.ucufGate.errors.length, '不應有 gate errors');
    });

    suite.test('validate-ui-specs gate 失敗時會反映到 ucufGate.errors', () => {
        const result = runFinalizeAgentTurn([
            '--workflow', 'ucuf-batch',
            '--task', 'validate-fail',
            '--files', 'tests/run-cli.ts',
        ], {
            'validate-ui-specs.js': { status: 1, stderr: 'validator failed' },
            'ucuf-runtime-check.js': { status: 0, stdout: '{"errors":[]}' },
            'ucuf-conflict-detect.js': { status: 0, stdout: 'ok' },
            'check-encoding-touched.js': { status: 0, stdout: 'ok' },
        });

        assert.equals(0, result.status ?? -1, `CLI 應成功結束，stderr:\n${result.stderr}`);
        assert.isFalse(result.json.ucufGate.passed, 'gate 失敗時 passed 應為 false');
        assert.isTrue(
            result.json.ucufGate.errors.some((msg: string) => msg.includes('validate-ui-specs')),
            'errors 應包含 validate-ui-specs 失敗訊息',
        );
    });

    suite.test('未指定 --files 時 encoding 失敗改列 warning 不阻擋 gate', () => {
        const result = runFinalizeAgentTurn([
            '--workflow', 'plain-workflow',
            '--task', 'encoding-warning',
        ], {
            'validate-ui-specs.js': { status: 0, stdout: 'ok' },
            'check-encoding-touched.js': { status: 1, stderr: 'encoding failed' },
        });

        assert.equals(0, result.status ?? -1, `CLI 應成功結束，stderr:\n${result.stderr}`);
        assert.isTrue(result.json.ucufGate.passed === true, '僅 warning 時 gate 應仍通過');
        assert.isTrue(
            result.json.ucufGate.warnings.some((msg: string) => msg.includes('check-encoding-touched')),
            'warnings 應包含 encoding 失敗訊息',
        );
    });

    suite.test('runtime-check 失敗時優先解析 JSON 第一個錯誤', () => {
        const result = runFinalizeAgentTurn([
            '--workflow', 'ucuf-batch',
            '--task', 'runtime-fail',
            '--files', 'tests/run-cli.ts',
        ], {
            'validate-ui-specs.js': { status: 0, stdout: 'ok' },
            'ucuf-runtime-check.js': {
                status: 1,
                stdout: JSON.stringify({
                    errors: [
                        { ruleId: 'RT-01', message: 'runtime mismatch' },
                    ],
                }),
            },
            'ucuf-conflict-detect.js': { status: 0, stdout: 'ok' },
            'check-encoding-touched.js': { status: 0, stdout: 'ok' },
        });

        assert.equals(0, result.status ?? -1, `CLI 應成功結束，stderr:\n${result.stderr}`);
        assert.isFalse(result.json.ucufGate.passed, 'runtime-check 失敗時 gate 應為 false');
        assert.isTrue(
            result.json.ucufGate.errors.some((msg: string) => msg.includes('RT-01: runtime mismatch')),
            '應優先使用 runtime JSON 內的第一個錯誤摘要',
        );
    });

    suite.test('budget baseline 可排除已知大型檔案，避免 budget hard-stop 失真', () => {
        const result = runFinalizeAgentTurn([
            '--workflow', 'plain-workflow',
            '--task', 'budget-baseline',
            '--skip-ucuf',
            '--budget-baseline', 'tests/fixtures/finalize-agent-turn/budget-baseline.json',
            '--files',
            'docs/asset-audit.json',
            'docs/universal-composite-ui-framework-plan.md',
            'docs/doc-id-registry.json',
        ]);

        assert.equals(0, result.status ?? -1, `CLI 應成功結束，stderr:\n${result.stderr}`);
        assert.equals('ok', result.json.budgetStatus, 'baseline 排除後 budgetStatus 應為 ok');
        assert.isTrue(result.json.budgetBaseline.active === true, 'budget baseline 應啟用');
        assert.equals(3, result.json.budgetBaseline.excludedCount, '應排除三個已知大型檔案');
    });

    suite.test('task-scope 會併入 task lock 內的 files，縮小 budget 範圍', () => {
        const result = runFinalizeAgentTurn([
            '--workflow', 'plain-workflow',
            '--task', 'UI-2-0108',
            '--task-scope',
            '--task-lock-dir', 'tests/fixtures/finalize-agent-turn/task-locks',
            '--skip-ucuf',
        ]);

        assert.equals(0, result.status ?? -1, `CLI 應成功結束，stderr:\n${result.stderr}`);
        assert.isTrue(result.json.taskScope.active === true, 'task scope 應啟用');
        assert.equals(2, result.json.taskScope.fileCount, '應帶入兩個 task-scoped files');
        assert.equals(2, result.json.turnUsage.totals.files, 'turn usage 應只統計 task lock files');
    });

    return suite;
}