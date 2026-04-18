/**
 * ucufRuntimeCheckCli.test.ts — ucuf-runtime-check CLI regression tests
 */

import { TestSuite, assert } from '../TestRunner';
import { spawnSync } from 'child_process';
import * as path from 'path';

interface RuntimeCheckResult {
    status: number | null;
    stdout: string;
    stderr: string;
    json: {
        passed: boolean;
        errors: Array<{ ruleId: string; message: string }>;
        warnings: Array<{ ruleId: string; message: string }>;
    };
}

function runRuntimeCheck(screenId: string): RuntimeCheckResult {
    const scriptPath = path.resolve(__dirname, '../../tools_node/ucuf-runtime-check.js');
    const result = spawnSync(process.execPath, [scriptPath, '--screen', screenId, '--json'], {
        cwd: path.resolve(__dirname, '../..'),
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

export function createUcufRuntimeCheckCliSuite(): TestSuite {
    const suite = new TestSuite('M11: ucuf-runtime-check CLI regression');

    suite.test('button-skin slot 不應被誤判為缺失 skin slot', () => {
        const result = runRuntimeCheck('gacha-main-screen');

        assert.equals(0, result.status ?? -1, `CLI 應成功結束，stderr:\n${result.stderr}`);
        assert.isFalse(
            result.json.errors.some((entry) => entry.ruleId === 'RT-03' && entry.message.includes('gacha.btn.back')),
            'gacha.btn.back 不應再被誤判為缺失 slot',
        );
    });

    suite.test('themeStack 繼承 slot 不應被誤判為缺失 skin slot', () => {
        const result = runRuntimeCheck('general-detail-unified-screen');

        assert.equals(0, result.status ?? -1, `CLI 應成功結束，stderr:\n${result.stderr}`);
        assert.isFalse(
            result.json.errors.some((entry) => entry.ruleId === 'RT-03' && entry.message.includes('detail.bg.fullscreen')),
            'detail.bg.fullscreen 不應再被誤判為缺失 slot',
        );
    });

    return suite;
}