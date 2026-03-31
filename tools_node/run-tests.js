#!/usr/bin/env node
/**
 * run-tests.js — 驗收檢查入口（保留 npm test 相容性）
 *
 * 目前專案在 CLI 下最可靠的驗收守門為：
 *   1. TypeScript 語法掃描
 *   2. UI Spec 三層 JSON 契約驗證
 *   3. 既有 Unity 匯入回歸檢查（若存在）
 */

require('./run-acceptance.js');
