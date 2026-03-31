/**
 * DeprecatedApiScanner — 靜態程式碼掃描測試
 *
 * 功能：掃描多個目錄（assets/scripts/、extensions/、tools/）下所有 .ts 檔案，
 *       確認不直接使用已知被標為棄用的 API 簽章。
 *
 * 設計原理：
 *   - 在 Node.js CLI 執行（tools/run-tests.js）
 *   - 每個「禁用規則」是一個 { id, pattern, whitelist, replacement, reason } 物件
 *   - pattern 支援 string（精確 substring）或 RegExp（彈性比對）
 *   - 純注解行（// …、* …）自動跳過，避免注解誤判
 *   - whitelist 使用路徑後綴精確比對（endsWith），避免誤豁免子字串
 *   - 若掃描到違規 → 該 test 標為 ❌，並列出所有問題檔案 + 行號
 *
 * Unity 對照：
 *   相當於 ReSharper / SonarQube 的自訂規則，在 CI 跑期間靜態分析
 *
 * 如何新增規則：
 *   在 DEPRECATED_RULES 陣列增加一筆，填入：
 *     id          唯一 key（方便 grep）
 *     pattern     禁用模式；string = 精確 substring，RegExp = 正規表達式
 *     whitelist   豁免的相對路徑（相對於 relativeBase），使用路徑後綴比對
 *     replacement 建議改用什麼
 *     reason      棄用原因 / keep.md 條目
 */

// fs / path 不以頂層 import 載入，避免 Cocos Creator 場景啟動時嘗試載入 Node.js 內建模組導致錯誤。
// 實際的 require('fs') / require('path') 只在函式內部執行，而這些函式只會在 Node.js CLI（run-tests.js）環境下被呼叫。
import { TestSuite, assert } from './TestRunner';

// ─────────────────────────────────────────────────────────────────────────────
//  棄用規則清單（新版本棄用 API 在此登錄）
// ─────────────────────────────────────────────────────────────────────────────

interface DeprecatedRule {
    id:          string;
    /**
     * 禁用模式：
     *   string  → 精確 substring 比對（快速、直覺）
     *   RegExp  → 正規表達式比對（適用需要邊界/選用空白等情境）
     */
    pattern:     string | RegExp;
    /**
     * 豁免清單：相對於 relativeBase 的路徑後綴。
     * 比對方式：normalize 後 endsWith，不使用 indexOf 避免誤豁免。
     * 例："assets/scripts/core/utils/MaterialUtils.ts"
     */
    whitelist:   string[];
    replacement: string;
    reason:      string;
}

const DEPRECATED_RULES: DeprecatedRule[] = [
    {
        id:      'mr.setMaterial(mat,index)',
        // RegExp：確保前面有 . 分隔符，方法名稱後允許選用空白
        pattern: /\.setMaterial\s*\(/,
        whitelist: [
            'assets/scripts/core/utils/MaterialUtils.ts',        // wrapper 本身豁免
            'assets/scripts/tools/tests/DeprecatedApiScanner.ts', // 規則定義字串，非實際呼叫
        ],
        replacement: 'setMaterialSafe(mr, mat, index) 來自 core/utils/MaterialUtils.ts',
        reason:      'Cocos 3.8.8 ts(6387)，keep.md 引擎 API 注意事項',
    },
    // ── Cocos Bundle 安全性規則：防止 Node.js 副作用進入遊戲 Bundle ──────────
    //
    // assets/scripts/ 下所有 .ts 都會被 Cocos 打包進 scene bundle。
    // bundle 載入時會立即評估所有模組頂層程式碼（類似 Unity 的靜態初始化器）。
    // 以下模式若出現在 bundle 裡，會讓 Cocos Editor 預覽進程崩潰或場景卡住。

    {
        id:      'process.exit() in bundle',
        // process.exit 在 Cocos 場景 bundle 中直接執行 → 殺掉 Electron 預覽進程
        pattern: /process\.exit\s*\(/,
        whitelist: [
            // run-cli.ts 已用 `if (typeof window === 'undefined')` 包住，安全豁免
            'assets/scripts/tools/tests/run-cli.ts',
            'assets/scripts/tools/tests/DeprecatedApiScanner.ts',  // 規則定義字串
        ],
        replacement: '移至 tools/ 目錄（bundle 外）或用 `if (typeof window === "undefined")` 包住',
        reason:      'process.exit() 在 Cocos bundle 載入時執行，會殺掉 Electron 預覽進程，導致場景無限卡在 loading',
    },
    {
        id:      'top-level import of node:fs / node:path',
        // 靜態 import 不論環境都會在 bundle 評估時被要求解析
        // → Cocos 無法提供 node: 內建模組 → 拋出 "Can not load module node:fs"
        pattern: /^import\s+.*from\s+['"]node:/m,
        whitelist: [
            'assets/scripts/tools/tests/DeprecatedApiScanner.ts',  // 規則定義字串
        ],
        replacement: '改用函式內部的 require()，並確保只在 Node.js 環境（typeof window === "undefined"）下執行',
        reason:      'Cocos Creator 不提供 Node.js 內建模組，頂層 import 使場景 Console 報 "Can not load module node:fs"',
    },
    {
        id:      'top-level static import of fs/path',
        // `import * as fs from 'fs'` 等同 `import * as fs from 'node:fs'`，同樣問題
        pattern: /^import\s+\*\s+as\s+(fs|path)\s+from\s+['"](fs|path)['"]/m,
        whitelist: [
            'assets/scripts/tools/tests/DeprecatedApiScanner.ts',  // 規則定義字串
        ],
        replacement: '改用函式內部的 require("fs") / require("path")，並包覆 typeof window === "undefined" guard',
        reason:      '頂層 import fs/path 在 Cocos bundle 載入時觸發 Node.js 模組解析，導致場景 Console 錯誤',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
//  掃描器實作
// ─────────────────────────────────────────────────────────────────────────────

interface Violation {
    file:    string;   // 相對於 relativeBase 的路徑
    line:    number;
    content: string;   // 該行去除前後空白
}

/** 收集目錄（含子目錄）下所有 .ts 檔案路徑（排除 node_modules 與 .d.ts） */
function scanDirectory(dir: string): string[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    if (!fs.existsSync(dir)) return [];
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // 跳過 node_modules：第三方套件不是專案代碼，不應被掃描
            if (entry.name === 'node_modules') continue;
            files.push(...scanDirectory(full));
        } else if (entry.isFile() && full.endsWith('.ts') && !full.endsWith('.d.ts')) {
            // 排除 .d.ts：宣告檔不是執行期代碼，node:xxx 是合法的型別聲明
            files.push(full);
        }
    }
    return files;
}

/**
 * 判斷該行是否為純注解，若是則跳過（避免注解中出現 API 名稱被誤判為違規）。
 * 覆蓋：// 單行注解、* 區塊注解行、 /* 開頭
 */
function isCommentLine(line: string): boolean {
    const t = line.trimStart();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/** 統一的 pattern 比對函式，支援 string 和 RegExp */
function matchesPattern(line: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
        return line.indexOf(pattern) !== -1;
    }
    return pattern.test(line);
}

/**
 * 豁免清單比對：normalize 兩端後使用 endsWith。
 *   relative = "assets/scripts/core/utils/MaterialUtils.ts"
 *   w        = "assets/scripts/core/utils/MaterialUtils.ts"  → 精確後綴，通過
 * 避免舊版 indexOf 可能的誤豁免（如路徑含相同子字串的不同檔案）。
 */
function isWhitelisted(relative: string, whitelist: string[]): boolean {
    const norm = relative.replace(/\\/g, '/');
    return whitelist.some(w => {
        const wNorm = w.replace(/\\/g, '/');
        // 允許純後綴比對（含路徑分隔符保護，避免 "Utils.ts" 豁免到 "OtherUtils.ts"）
        return norm === wNorm || norm.endsWith('/' + wNorm) || norm.endsWith(wNorm);
    });
}

function scanForRule(
    files: string[],
    rule: DeprecatedRule,
    relativeBase: string
): Violation[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const violations: Violation[] = [];
    for (const file of files) {
        const relative = path.relative(relativeBase, file).replace(/\\/g, '/');

        if (isWhitelisted(relative, rule.whitelist)) continue;

        const lines = fs.readFileSync(file, 'utf-8').split('\n');
        lines.forEach((lineContent, idx) => {
            if (isCommentLine(lineContent)) return;  // 跳過純注解行
            if (matchesPattern(lineContent, rule.pattern)) {
                violations.push({ file: relative, line: idx + 1, content: lineContent.trim() });
            }
        });
    }
    return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
//  建立 TestSuite
// ─────────────────────────────────────────────────────────────────────────────

export interface ScannerOptions {
    /** 要掃描的目錄清單（絕對路徑），可跨多個根目錄 */
    scanRoots:    string[];
    /**
     * 計算 violation 相對路徑的基準目錄（通常是 projectRoot）。
     * whitelist 的路徑也應相對於此。
     */
    relativeBase: string;
}

export function createDeprecatedApiSuite(options: ScannerOptions): TestSuite {
    const { scanRoots, relativeBase } = options;

    const suite = new TestSuite('Deprecated API Scanner');

    // 從所有掃描根目錄收集 .ts 檔案
    const allFiles: string[] = [];
    for (const root of scanRoots) {
        allFiles.push(...scanDirectory(root));
    }

    for (const rule of DEPRECATED_RULES) {
        suite.test(`[${rule.id}] 不應直接使用棄用 API`, () => {
            const violations = scanForRule(allFiles, rule, relativeBase);
            if (violations.length > 0) {
                const lines = violations.map(v => `  ${v.file}:${v.line} → ${v.content}`);
                const patternStr = rule.pattern instanceof RegExp
                    ? rule.pattern.toString()
                    : `"${rule.pattern}"`;
                throw new Error(
                    `發現 ${violations.length} 處直接使用棄用 API ${patternStr}：\n` +
                    lines.join('\n') +
                    `\n\n→ 請改用：${rule.replacement}\n→ 原因：${rule.reason}`
                );
            }
            assert.isTrue(true);  // 無違規 = 通過
        });
    }

    // 基本健全性：確認有足量的 .ts 檔案被掃描到
    suite.test('掃描目錄含有足量的 .ts 原始碼檔案', () => {
        assert.greaterOrEqual(
            10,
            allFiles.length,
            `掃描到的 .ts 檔案數量不足（${allFiles.length}），請確認目錄路徑`
        );
    });

    return suite;
}
