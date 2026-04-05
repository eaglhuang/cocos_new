#!/usr/bin/env node
/**
 * fix-mojibake-from-task-cards.js
 *
 * 從各任務卡 .md 的 YAML frontmatter 提取 id / title / notes / status / phase 等欄位，
 * 對比 ui-quality-todo.json 中含問號殘段的條目，批量補回正確中文內容。
 *
 * 策略：
 *   1. 讀取所有 docs/agent-briefs/tasks/*.md
 *   2. 解析 YAML frontmatter（自行實作，不依賴外部套件）
 *   3. 對每個有問題的 JSON 條目，用任務卡的 title / notes 覆寫
 *   4. 保留原有的 status / phase / priority / created 等（以 JSON 為主，除非卡也有更新版本）
 *
 * 用法：
 *   node tools_node/fix-mojibake-from-task-cards.js [--dry-run]
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN    = process.argv.includes('--dry-run');
const TASKS_DIR  = path.resolve(__dirname, '..', 'docs', 'agent-briefs', 'tasks');
const TODO_FILE  = path.resolve(__dirname, '..', 'docs', 'ui-quality-todo.json');

// ---------------------------------------------------------------------------
// 簡易 YAML frontmatter 解析器（只需支援單層 key: value 與 "quoted" values）
// ---------------------------------------------------------------------------
function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    const yamlBlock = match[1];
    const result = {};
    const lines = yamlBlock.split(/\r?\n/);
    let currentKey = null;
    let inList = false;
    let listBuffer = [];

    for (const line of lines) {
        // list item
        if (/^\s+-\s+/.test(line)) {
            if (currentKey && inList) {
                listBuffer.push(line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
            }
            continue;
        }
        // flush list
        if (inList && currentKey) {
            result[currentKey] = listBuffer;
            listBuffer = [];
            inList = false;
            currentKey = null;
        }
        // key: value
        const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
        if (!kvMatch) continue;
        const key = kvMatch[1];
        const val = kvMatch[2].trim();
        if (val === '' || val === null) {
            // might be a list
            currentKey = key;
            inList = true;
            listBuffer = [];
        } else {
            result[key] = val.replace(/^["']|["']$/g, '');
        }
    }
    if (inList && currentKey && listBuffer.length > 0) {
        result[currentKey] = listBuffer;
    }
    return result;
}

// ---------------------------------------------------------------------------
// 從 frontmatter 內的多行 notes 提取（notes 後面的值可能是多行引號字串）
// ---------------------------------------------------------------------------
function extractNotesFromFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;
    const yamlBlock = match[1];
    // 找 notes: "..." 或 notes: '...'（可能多行）
    const notesMatch = yamlBlock.match(/^notes:\s*["']?([\s\S]*?)["']?\s*$/m);
    if (!notesMatch) return null;
    // 簡單提取
    return notesMatch[1].trim();
}

// ---------------------------------------------------------------------------
// 根據節點類型判斷是否有「問號殘段」
// ---------------------------------------------------------------------------
function hasGarbage(str) {
    if (typeof str !== 'string') return false;
    return /\?{2,}/.test(str);
}

function taskHasGarbage(task) {
    // 檢查 key 本身是否有問號
    const badKey = Object.keys(task).some(k => k.includes('?'));
    // 檢查 title / description / notes
    return badKey || hasGarbage(task.title) || hasGarbage(task.description) || hasGarbage(task.notes);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function main() {
    // 1. 讀取所有任務卡
    const cardFiles = fs.readdirSync(TASKS_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(TASKS_DIR, f));

    const cardMap = new Map(); // id → frontmatter object
    for (const cf of cardFiles) {
        try {
            const content = fs.readFileSync(cf, 'utf8');
            const fm = parseFrontmatter(content);
            if (fm.id) {
                fm._rawContent = content;
                fm._file = cf;
                // 從 H1 標題提取 title，格式：# [UI-2-XXXX] 繁體標題
                const h1Match = content.match(/^#\s+(?:\[[\w-]+\]\s+)?(.+)$/m);
                if (h1Match) {
                    fm.title = h1Match[1].trim();
                }
                // 從 ## 目標 提取 description（取第一段非空行）
                const descMatch = content.match(/^##\s+目標\s*\r?\n+([^\r\n#][^\r\n]*)/m);
                if (descMatch) {
                    fm.descriptionExtracted = descMatch[1].trim();
                }
                cardMap.set(fm.id, fm);
            }
        } catch (e) {
            // skip parse errors
        }
    }
    console.log(`[fix-mojibake] 讀取任務卡 ${cardMap.size} 張`);

    // 2. 讀取 JSON
    const data = JSON.parse(fs.readFileSync(TODO_FILE, 'utf8'));
    let fixedCount = 0;
    const skipped = [];

    for (const task of data.tasks) {
        if (!taskHasGarbage(task)) continue;

        const card = cardMap.get(task.id);
        if (!card) {
            skipped.push(task.id);
            continue;
        }

        let changed = false;
        const before = { title: task.title, notes: task.notes };

        // --- title ---
        if (hasGarbage(task.title) && card.title && !hasGarbage(card.title)) {
            task.title = card.title;
            changed = true;
        }

        // --- description：從任務卡 ## 目標 section 提取 ---
        if (hasGarbage(task.description) && card.descriptionExtracted && !hasGarbage(card.descriptionExtracted)) {
            task.description = card.descriptionExtracted;
            changed = true;
        }

        // --- notes ---
        if ((hasGarbage(task.notes) || !task.notes) && card.notes && !hasGarbage(card.notes)) {
            task.notes = card.notes;
            changed = true;
        }

        // --- 移除 garbled key ---
        const badKeys = Object.keys(task).filter(k => k.includes('?') && k !== 'id');
        for (const bk of badKeys) {
            delete task[bk];
            changed = true;
        }

        if (changed) {
            fixedCount++;
            if (!DRY_RUN) {
                console.log(`  ✓ ${task.id}: "${task.title}"`);
            } else {
                console.log(`  [dry] ${task.id}: "${before.title}" → "${task.title}"`);
            }
        }
    }

    if (!DRY_RUN) {
        fs.writeFileSync(TODO_FILE, JSON.stringify(data, null, 2), 'utf8');
    }

    console.log(`\n修復 ${fixedCount} 個條目`);
    if (skipped.length > 0) {
        console.log(`無任務卡（跳過 ${skipped.length} 個）: ${skipped.join(', ')}`);
    }
}

main();
