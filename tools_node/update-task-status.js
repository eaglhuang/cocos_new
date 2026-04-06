/**
 * update-task-status.js
 * 一次性腳本：修正 UI-2-0034 狀態、修復 UI-2-0093 notes 亂碼。
 * 執行：node tools_node/update-task-status.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TODO_PATH  = path.join(__dirname, '..', 'docs', 'ui-quality-todo.json');
const SHARD_PATH = path.join(__dirname, '..', 'docs', 'ui-quality-tasks', 'phase-g-agent1.json');

const TODAY = '2026-04-06';

// ── ui-quality-todo.json ──────────────────────────────────────────────────────

{
    const data = JSON.parse(fs.readFileSync(TODO_PATH, 'utf8'));

    for (const task of data.tasks) {
        // 1) UI-2-0034：status → done（notes 已記錄完成）
        if (task.id === 'UI-2-0034') {
            task.status = 'done';
            console.log('[update] UI-2-0034 status → done');
        }

        // 2) UI-2-0093：修正 notes 亂碼
        if (task.id === 'UI-2-0093') {
            task.notes =
                `${TODAY} | 狀態: in-progress | 處理: r16-layout-polish 收斂中；crest 模組與 header area 仍有空白 offset | 驗證: smoke-capture 待確認 | 阻塞: 依賴 DALL-E 3 資產最終交付`;
            console.log('[update] UI-2-0093 notes 修正');
        }
    }

    fs.writeFileSync(TODO_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log('[done] ui-quality-todo.json updated');
}

// ── phase-g-agent1.json shard ─────────────────────────────────────────────────

{
    const shard = JSON.parse(fs.readFileSync(SHARD_PATH, 'utf8'));

    for (const task of shard.tasks) {
        if (task.id === 'UI-2-0093') {
            task.notes =
                `${TODAY} | 狀態: in-progress | 處理: r16-layout-polish 收斂中；crest 模組與 header area 仍有空白 offset | 驗證: smoke-capture 待確認 | 阻塞: 依賴 DALL-E 3 資產最終交付`;
            console.log('[update] shard UI-2-0093 notes 修正');
        }
    }

    fs.writeFileSync(SHARD_PATH, JSON.stringify(shard, null, 2) + '\n', 'utf8');
    console.log('[done] phase-g-agent1.json updated');
}
