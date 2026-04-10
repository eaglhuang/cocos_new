#!/usr/bin/env node
/**
 * task-lock.js — 多 Agent 任務鎖定協議
 *
 * 用法:
 *   node tools_node/task-lock.js lock   <task-id> <agent-name>
 *   node tools_node/task-lock.js unlock <task-id> <agent-name>
 *   node tools_node/task-lock.js check  <task-id>
 *   node tools_node/task-lock.js list
 *
 * 鎖定檔存放: .task-locks/<task-id>.lock.json
 * 格式: { taskId, agentName, lockedAt, files: [] }
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./lib/project-config');

const projectRoot = config.ROOT;
const lockDir = config.paths.taskLocksDir;

function ensureLockDir() {
    if (!fs.existsSync(lockDir)) {
        fs.mkdirSync(lockDir, { recursive: true });
        // 確保 .gitignore 包含 .task-locks/
        const gitignorePath = path.join(projectRoot, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const content = fs.readFileSync(gitignorePath, 'utf8');
            if (!content.includes('.task-locks')) {
                fs.appendFileSync(gitignorePath, '\n# Agent task locks\n.task-locks/\n');
            }
        }
    }
}

function lockPath(taskId) {
    return path.join(lockDir, `${taskId}.lock.json`);
}

function lock(taskId, agentName) {
    ensureLockDir();
    const lp = lockPath(taskId);
    if (fs.existsSync(lp)) {
        const existing = JSON.parse(fs.readFileSync(lp, 'utf8'));
        if (existing.agentName === agentName) {
            console.log(`🔒 "${taskId}" 已由你 (${agentName}) 鎖定，更新時間戳`);
            existing.lockedAt = new Date().toISOString();
            fs.writeFileSync(lp, JSON.stringify(existing, null, 2), 'utf8');
            return;
        }
        console.error(`❌ 鎖定失敗: "${taskId}" 已被 "${existing.agentName}" 於 ${existing.lockedAt} 鎖定`);
        process.exit(1);
    }
    const lockData = {
        taskId,
        agentName,
        lockedAt: new Date().toISOString(),
        files: []
    };
    fs.writeFileSync(lp, JSON.stringify(lockData, null, 2), 'utf8');
    console.log(`🔒 已鎖定 "${taskId}" → ${agentName}`);
}

function unlock(taskId, agentName) {
    ensureLockDir();
    const lp = lockPath(taskId);
    if (!fs.existsSync(lp)) {
        console.log(`⚠️  "${taskId}" 未被鎖定，跳過`);
        return;
    }
    const existing = JSON.parse(fs.readFileSync(lp, 'utf8'));
    if (existing.agentName !== agentName) {
        console.error(`❌ 解鎖失敗: "${taskId}" 由 "${existing.agentName}" 鎖定，你是 "${agentName}"`);
        process.exit(1);
    }
    fs.unlinkSync(lp);
    console.log(`🔓 已解鎖 "${taskId}"`);
}

function check(taskId) {
    ensureLockDir();
    const lp = lockPath(taskId);
    if (!fs.existsSync(lp)) {
        console.log(`✅ "${taskId}" 未被鎖定，可安全操作`);
        return;
    }
    const existing = JSON.parse(fs.readFileSync(lp, 'utf8'));
    console.log(`🔒 "${taskId}" 已被 "${existing.agentName}" 鎖定`);
    console.log(`   鎖定時間: ${existing.lockedAt}`);
    if (existing.files && existing.files.length > 0) {
        console.log(`   修改檔案: ${existing.files.join(', ')}`);
    }
}

function listLocks() {
    ensureLockDir();
    const files = fs.readdirSync(lockDir).filter(f => f.endsWith('.lock.json'));
    if (files.length === 0) {
        console.log('✅ 目前無任何任務鎖定');
        return;
    }
    console.log(`🔒 ${files.length} 個任務被鎖定:\n`);
    for (const f of files) {
        const data = JSON.parse(fs.readFileSync(path.join(lockDir, f), 'utf8'));
        console.log(`  ${data.taskId} → ${data.agentName} (${data.lockedAt})`);
    }
}

// CLI
const [,, command, taskId, agentName] = process.argv;

switch (command) {
    case 'lock':
        if (!taskId || !agentName) { console.error('用法: task-lock.js lock <task-id> <agent-name>'); process.exit(1); }
        lock(taskId, agentName);
        break;
    case 'unlock':
        if (!taskId || !agentName) { console.error('用法: task-lock.js unlock <task-id> <agent-name>'); process.exit(1); }
        unlock(taskId, agentName);
        break;
    case 'check':
        if (!taskId) { console.error('用法: task-lock.js check <task-id>'); process.exit(1); }
        check(taskId);
        break;
    case 'list':
        listLocks();
        break;
    default:
        console.log('用法: task-lock.js <lock|unlock|check|list> [task-id] [agent-name]');
        process.exit(1);
}
