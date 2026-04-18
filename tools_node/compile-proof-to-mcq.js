#!/usr/bin/env node
'use strict';

const path = require('path');
const { PROJECT_ROOT, getArg, hasFlag, resolvePath } = require('./lib/ucuf-recipe-utils');
const {
  buildMcqPackage,
  loadProof,
  screenBaseFromProof,
  validateMcqPackage,
  writeJson,
} = require('./lib/ucuf-proof-utils');

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/compile-proof-to-mcq.js --proof <file> [options]',
    '',
    '必要參數：',
    '  --proof                proof-contract JSON 路徑',
    '',
    '常用選項：',
    '  --out                  指定輸出 MCQ package JSON 路徑',
    '  --answers-template-out 指定 answers template JSON 路徑',
    '  --write                寫入檔案；未指定時為 dry-run',
    '  --help                 顯示說明',
  ].join('\n'));
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
  const screenBase = screenBaseFromProof(proof.screenId);
  const outPath = resolvePath(getArg(process.argv, 'out')) || path.join(PROJECT_ROOT, 'artifacts', 'ui-source', screenBase, 'mcq', `${screenBase}.mcq.json`);
  const answersTemplatePath = resolvePath(getArg(process.argv, 'answers-template-out')) || path.join(PROJECT_ROOT, 'artifacts', 'ui-source', screenBase, 'mcq', `${screenBase}.answers.template.json`);
  const mcqPackage = buildMcqPackage(proof, proofPath);

  validateMcqPackage(mcqPackage);
  writeJson(outPath, mcqPackage, dryRun);
  writeJson(answersTemplatePath, mcqPackage.answerTemplate, dryRun);

  const summary = {
    screenId: mcqPackage.screenId,
    recipeScreenId: mcqPackage.recipeScreenId,
    recommendedFamily: mcqPackage.familyRecommendation.familyId || '',
    questionCount: mcqPackage.questions.length,
    output: path.relative(PROJECT_ROOT, outPath),
    answersTemplate: path.relative(PROJECT_ROOT, answersTemplatePath),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();