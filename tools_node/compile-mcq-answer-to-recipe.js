#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT, getArg, hasFlag, readJson, resolvePath } = require('./lib/ucuf-recipe-utils');
const {
  buildMcqPackage,
  buildRecipeFromMcq,
  buildRecommendedAnswerSet,
  loadProof,
  screenBaseFromProof,
  validateAnswerSet,
  validateMcqPackage,
  writeJson,
} = require('./lib/ucuf-proof-utils');

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/compile-mcq-answer-to-recipe.js --proof <file> [options]',
    '',
    '必要參數：',
    '  --proof              proof-contract JSON 路徑',
    '',
    '常用選項：',
    '  --mcq                指定 MCQ package JSON 路徑；未指定時會從 proof 即時計算',
    '  --answers            指定 answer set JSON 路徑',
    '  --use-recommended    未提供答案時，直接使用 recommendedValue',
    '  --out                指定輸出 recipe JSON 路徑',
    '  --write              寫入檔案；未指定時為 dry-run',
    '  --help               顯示說明',
  ].join('\n'));
}

function loadMcqPackage(mcqArg, proof, proofPath) {
  if (!mcqArg) {
    return buildMcqPackage(proof, proofPath);
  }
  const mcqPath = resolvePath(mcqArg);
  if (!mcqPath || !fs.existsSync(mcqPath)) {
    throw new Error(`找不到 MCQ package：${mcqArg}`);
  }
  const mcqPackage = readJson(mcqPath);
  validateMcqPackage(mcqPackage);
  return mcqPackage;
}

function loadAnswerSet(answerArg, mcqPackage, useRecommended) {
  if (answerArg) {
    const answerPath = resolvePath(answerArg);
    if (!answerPath || !fs.existsSync(answerPath)) {
      throw new Error(`找不到 answer set：${answerArg}`);
    }
    const answerSet = readJson(answerPath);
    validateAnswerSet(answerSet, mcqPackage);
    return answerSet;
  }
  if (useRecommended) {
    return buildRecommendedAnswerSet(mcqPackage);
  }
  throw new Error('未提供 --answers，且未指定 --use-recommended');
}

function main() {
  if (hasFlag(process.argv, 'help')) {
    printHelp();
    return;
  }

  const proofArg = getArg(process.argv, 'proof');
  if (!proofArg) {
    printHelp();
    process.exit(1);
  }

  const dryRun = !hasFlag(process.argv, 'write');
  const { proof, proofPath } = loadProof(proofArg);
  const mcqPackage = loadMcqPackage(getArg(process.argv, 'mcq'), proof, proofPath);
  const answerSet = loadAnswerSet(getArg(process.argv, 'answers'), mcqPackage, hasFlag(process.argv, 'use-recommended'));
  const screenBase = screenBaseFromProof(proof.screenId);
  const outPath = resolvePath(getArg(process.argv, 'out')) || path.join(PROJECT_ROOT, 'artifacts', 'ui-source', screenBase, 'generated', `${screenBase}-screen.recipe.json`);
  const { recipe, metadata } = buildRecipeFromMcq(proof, proofPath, mcqPackage, answerSet);

  writeJson(outPath, recipe, dryRun);
  console.log(JSON.stringify({
    screenId: recipe.screenId,
    familyId: recipe.familyId,
    generationPolicy: recipe.generationPolicy,
    smokeRoute: recipe.smokeRoute,
    output: path.relative(PROJECT_ROOT, outPath),
    metadata,
  }, null, 2));
}

main();