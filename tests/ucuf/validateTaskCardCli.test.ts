/**
 * validateTaskCardCli.test.ts — UCUF M11-P2 validator CLI integration tests
 *
 * 目的：確認 validate-ucuf-task-card.js 能正確偵測
 * tests/ucuf/fixtures/bad-task-card.md 中故意觸發的全部 10 條違規
 * (R-TC-01 ~ R-TC-10)。
 */

import { TestSuite, assert } from '../TestRunner';
import * as path from 'path';
import { spawnSync } from 'child_process';

const TOOL_PATH = path.resolve(__dirname, '../../tools_node/validate-ucuf-task-card.js');
const BAD_CARD_PATH = path.resolve(__dirname, 'fixtures/bad-task-card.md');

function runValidator(cardPath: string, extraArgs: string[] = []): {
    status: number;
    stdout: string;
    stderr: string;
} {
    const result = spawnSync(
        process.execPath,
        [TOOL_PATH, '--card', cardPath, ...extraArgs],
        { encoding: 'utf8', timeout: 10000 }
    );
    return {
        status: result.status ?? -1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    };
}

export function createValidateTaskCardCliSuite(): TestSuite {
    const suite = new TestSuite('M11: validate-ucuf-task-card CLI integration');

    // ─── 基本可用性 ──────────────────────────────────────────────────────────

    suite.test('T01: 無 --card 引數應 exit 1', () => {
        const r = spawnSync(process.execPath, [TOOL_PATH], { encoding: 'utf8', timeout: 5000 });
        assert.equals(1, r.status, '缺參數應 exit 1');
    });

    suite.test('T02: 不存在的卡路徑應 exit 1', () => {
        const r = runValidator('nonexistent-card.md');
        assert.equals(1, r.status, '找不到檔案應 exit 1');
    });

    // ─── bad-task-card.md 違規偵測 ────────────────────────────────────────

    suite.test('T03: 嚴格模式應 exit 1（有 failure）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        assert.equals(1, r.status, '--strict 有 failure 應 exit 1');
    });

    suite.test('T04: 非嚴格模式有 failure 仍應 exit 0（工具預設行為）', () => {
        const r = runValidator(BAD_CARD_PATH);
        // 工具在沒有 --strict 時，exit 0 但仍列出違規
        assert.equals(0, r.status, '非嚴格模式有違規但 exit 0');
    });

    suite.test('T05: 輸出應包含 R-TC-01（screen_id 為空）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-01'), `輸出應含 R-TC-01，實際輸出：\n${out}`);
    });

    suite.test('T06: 輸出應包含 R-TC-02（parent_panel 不合法）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-02'), `輸出應含 R-TC-02，實際輸出：\n${out}`);
    });

    suite.test('T07: 輸出應包含 R-TC-03（content_contract_schema 為空）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-03'), `輸出應含 R-TC-03，實際輸出：\n${out}`);
    });

    suite.test('T08: 輸出應包含 R-TC-04（fragments_owned 非陣列）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-04'), `輸出應含 R-TC-04，實際輸出：\n${out}`);
    });

    suite.test('T09: 輸出應包含 R-TC-05（data_sources_owned 為空陣列）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-05'), `輸出應含 R-TC-05，實際輸出：\n${out}`);
    });

    suite.test('T10: 輸出應包含 R-TC-06（skin_manifest 為空）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-06'), `輸出應含 R-TC-06，實際輸出：\n${out}`);
    });

    suite.test('T11: 輸出應包含 R-TC-07（verification_commands 為空）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-07'), `輸出應含 R-TC-07，實際輸出：\n${out}`);
    });

    suite.test('T12: 輸出應包含 R-TC-08（smoke_route 為空）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-08'), `輸出應含 R-TC-08，實際輸出：\n${out}`);
    });

    suite.test('T13: 輸出應包含 R-TC-09（deliverables 空條目警告）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-09'), `輸出應含 R-TC-09，實際輸出：\n${out}`);
    });

    suite.test('T14: 輸出應包含 R-TC-10（type 不合法）', () => {
        const r = runValidator(BAD_CARD_PATH, ['--strict']);
        const out = r.stdout + r.stderr;
        assert.isTrue(out.includes('R-TC-10'), `輸出應含 R-TC-10，實際輸出：\n${out}`);
    });

    // ─── JSON 模式 ────────────────────────────────────────────────────────

    suite.test('T15: --json 輸出應為合法 JSON 且 passed:false', () => {
        const r = runValidator(BAD_CARD_PATH, ['--json']);
        let parsed: { passed?: boolean; failures?: unknown[] };
        try {
            parsed = JSON.parse(r.stdout);
        } catch {
            assert.isTrue(false, `--json 輸出不是合法 JSON：${r.stdout}`);
            return;
        }
        assert.isFalse(parsed.passed ?? true, 'passed 應為 false');
        assert.isTrue(Array.isArray(parsed.failures) && parsed.failures.length >= 8,
            `failures 應有至少 8 筆，實際：${parsed.failures?.length}`);
    });

    return suite;
}
