/**
 * validateUiSpecsCli.test.ts — UCUF M9/M10 validator CLI integration tests
 *
 * 目的：直接驗證 tools_node/validate-ui-specs.js 的真實 CLI 行為，
 * 補上純 inline stub 之外的整合層守門。
 */

import { TestSuite, assert } from '../TestRunner';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

function mkdirp(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, value: unknown): void {
    mkdirp(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function createFixtureRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ucuf-validate-ui-specs-'));
    const uiSpecRoot = path.join(root, 'ui-spec');
    mkdirp(path.join(uiSpecRoot, 'layouts'));
    mkdirp(path.join(uiSpecRoot, 'skins'));
    mkdirp(path.join(uiSpecRoot, 'screens'));
    mkdirp(path.join(uiSpecRoot, 'contracts'));
    mkdirp(path.join(uiSpecRoot, 'content'));
    mkdirp(path.join(uiSpecRoot, 'fragments'));
    mkdirp(path.join(uiSpecRoot, 'recipes', 'families'));
    return root;
}

function writeBaseSpec(root: string, options?: {
    layoutRoot?: Record<string, unknown>;
    screenExtra?: Record<string, unknown>;
    createFragmentIds?: string[];
    createContract?: boolean;
    contractFields?: Record<string, unknown>;
    contractRequiredFields?: string[];
    contentState?: Record<string, unknown>;
}): void {
    const uiSpecRoot = path.join(root, 'ui-spec');

    writeJson(path.join(uiSpecRoot, 'layouts', 'test-layout.json'), {
        id: 'test-layout',
        version: 1,
        canvas: {
            designWidth: 1920,
            designHeight: 1080,
            fitWidth: true,
            fitHeight: true,
            safeArea: true,
        },
        root: options?.layoutRoot ?? {
            type: 'container',
            name: 'Root',
            children: [
                {
                    type: 'label',
                    name: 'FixtureLabel',
                    text: 'fixture',
                },
            ],
        },
    });

    writeJson(path.join(uiSpecRoot, 'skins', 'test-skin.json'), {
        id: 'test-skin',
        slots: {},
    });

    if (options?.createContract) {
        writeJson(path.join(uiSpecRoot, 'contracts', 'test-content.schema.json'), {
            schemaId: 'test-content',
            familyId: 'test-family',
            fields: options.contractFields ?? {
                tabs: { type: 'array' },
            },
            requiredFields: options.contractRequiredFields ?? ['tabs'],
        });
        writeJson(path.join(uiSpecRoot, 'content', 'test-content.json'), {
            states: {
                default: options.contentState ?? {
                    tabs: [],
                },
            },
        });
    }

    const screen = {
        id: 'test-screen',
        version: 1,
        uiId: 'TestUI',
        layer: 'UI_2D',
        bundle: 'resources',
        layout: 'test-layout',
        skin: 'test-skin',
        ...(options?.screenExtra ?? {}),
    };
    writeJson(path.join(uiSpecRoot, 'screens', 'test-screen.json'), screen);

    for (const fragmentId of options?.createFragmentIds ?? []) {
        writeJson(path.join(uiSpecRoot, 'fragments', `${fragmentId}.json`), {
            id: fragmentId,
            root: { type: 'container', name: `${fragmentId}-root` },
        });
    }
}

function runValidator(root: string, args: string[] = []): { status: number | null; output: string } {
    const validatorPath = path.resolve(__dirname, '../../tools_node/validate-ui-specs.js');
    const result = spawnSync(
        process.execPath,
        [
            validatorPath,
            '--strict',
            '--project-root', root,
            '--ui-spec-root', path.join(root, 'ui-spec'),
            ...args,
        ],
        {
            encoding: 'utf8',
        },
    );
    return {
        status: result.status,
        output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    };
}

export function createValidateUiSpecsCliSuite(): TestSuite {
    const suite = new TestSuite('M10: validate-ui-specs CLI integration');

    suite.test('R26 CLI: lazySlot 缺少 defaultFragment 時輸出 warning', () => {
        const root = createFixtureRoot();
        writeBaseSpec(root, {
            layoutRoot: {
                type: 'container',
                name: 'Root',
                children: [
                    {
                        type: 'container',
                        name: 'SlotMain',
                        lazySlot: true,
                    },
                ],
            },
        });

        const result = runValidator(root, ['--rules', 'lazy-slot-has-fragment']);
        assert.equals(0, result.status ?? -1, `CLI 應成功結束，output:\n${result.output}`);
        assert.contains(result.output, 'lazy-slot-has-fragment', '應包含 R26 warning');
    });

    suite.test('R27 CLI: dataSource 未宣告於 requiredFields 時輸出 warning', () => {
        const root = createFixtureRoot();
        writeBaseSpec(root, {
            createContract: true,
            contractFields: {
                tabs: { type: 'array' },
            },
            contractRequiredFields: ['tabs'],
            contentState: {
                tabs: [],
            },
            layoutRoot: {
                type: 'container',
                name: 'Root',
                children: [
                    {
                        type: 'label',
                        name: 'TitleLabel',
                        dataSource: 'data.missingField',
                    },
                ],
            },
            screenExtra: {
                contentRequirements: {
                    schemaId: 'test-content',
                    familyId: 'test-family',
                    requiredFields: ['tabs'],
                },
                content: {
                    source: 'test-content',
                    state: 'default',
                },
            },
        });

        const result = runValidator(root, ['--rules', 'dataSource-declared']);
        assert.equals(0, result.status ?? -1, `CLI 應成功結束，output:\n${result.output}`);
        assert.contains(result.output, 'dataSource-declared', '應包含 R27 warning');
        assert.contains(result.output, 'missingField', '應指出缺失欄位');
    });

    suite.test('R28 CLI: tabRouting fragment 不存在時輸出 warning', () => {
        const root = createFixtureRoot();
        writeBaseSpec(root, {
            layoutRoot: {
                type: 'container',
                name: 'Root',
                children: [
                    {
                        type: 'container',
                        name: 'SlotMain',
                        lazySlot: true,
                        defaultFragment: 'default-fragment',
                    },
                ],
            },
            screenExtra: {
                tabRouting: {
                    Overview: {
                        slotId: 'SlotMain',
                        fragment: 'ghost-fragment',
                    },
                },
            },
            createFragmentIds: ['default-fragment'],
        });

        const result = runValidator(root, ['--rules', 'composite-panel-tab-route-integrity']);
        assert.equals(0, result.status ?? -1, `CLI 應成功結束，output:\n${result.output}`);
        assert.contains(result.output, 'composite-panel-tab-route-integrity', '應包含 R28 warning');
        assert.contains(result.output, 'ghost-fragment', '應指出缺失 fragment');
    });

    suite.test('R25 CLI: specVersion 超過上限時輸出 warning', () => {
        const root = createFixtureRoot();
        writeBaseSpec(root, {
            screenExtra: {
                specVersion: 999,
            },
        });

        const result = runValidator(root, ['--rules', 'spec-version-mismatch']);
        assert.equals(0, result.status ?? -1, `CLI 應成功結束（warning 不 exit 1），output:\n${result.output}`);
        assert.contains(result.output, 'spec-version-mismatch', '應包含 R25 warning rule ID');
        assert.contains(result.output, '999', '應顯示偵測到的 specVersion 值');
    });

    return suite;
}