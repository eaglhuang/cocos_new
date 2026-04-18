#!/usr/bin/env node
'use strict';

const path = require('path');
const cp = require('child_process');
const { PROJECT_ROOT, getArg, hasFlag, resolvePath, writeJson } = require('./lib/ucuf-recipe-utils');
const {
  buildProofDraftFromSource,
  buildMcqPackage,
  buildRecipeFromMcq,
  buildRecommendedAnswerSet,
  loadProof,
  screenBaseFromProof,
} = require('./lib/ucuf-proof-utils');

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/run-ui-vibe-workflow.js --proof <file> [options]',
    '  node tools_node/run-ui-vibe-workflow.js --proof-source <image> --screen-id <ScreenId> [options]',
    '',
    '必要參數（二選一）：',
    '  --proof              proof-contract JSON 路徑',
    '  --proof-source       參考圖 / 截圖路徑或 ref:// 路徑',
    '  --screen-id          proof-source 模式必填，對應 CamelCase screenId',
    '',
    '常用選項：',
    '  --family             proof-source 模式可選，強制 family hint',
    '  --screen-dir         artifacts/ui-source/<screen> 工作目錄；未指定時自動推導',
    '  --answers            answer set JSON 路徑',
    '  --use-recommended    直接使用 recommendedValue 走完整流程',
    '  --write              寫入檔案並呼叫既有 recipe compilers',
    '  --help               顯示說明',
    '',
    '說明：',
    '  - 若用 --proof-source，會先自動產一份 v0 proof draft skeleton',
    '  - 會產生 proof、mcq package、answer template、recipe',
    '  - 若有答案（或使用 recommended），會再接上 screen spec 與 task-card-opener 流程（底層沿用既有 task card compiler）',
  ].join('\n'));
}

function execNode(scriptPath, args) {
  cp.execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
}

function main() {
  if (hasFlag(process.argv, 'help')) {
    printHelp();
    return;
  }

  const proofArg = getArg(process.argv, 'proof');
  const proofSourceArg = getArg(process.argv, 'proof-source');
  if (!proofArg && !proofSourceArg) {
    printHelp();
    process.exit(1);
  }

  const dryRun = !hasFlag(process.argv, 'write');
  let proof;
  let proofPath;

  if (proofArg) {
    ({ proof, proofPath } = loadProof(proofArg));
  } else {
    const screenId = getArg(process.argv, 'screen-id');
    if (!screenId) {
      throw new Error('使用 --proof-source 時，必須提供 --screen-id');
    }
    proof = buildProofDraftFromSource({
      screenId,
      proofSource: proofSourceArg,
      familyId: getArg(process.argv, 'family'),
    });
  }

  const screenBase = screenBaseFromProof(proof.screenId);
  const screenDir = resolvePath(getArg(process.argv, 'screen-dir')) || path.join(PROJECT_ROOT, 'artifacts', 'ui-source', screenBase, 'workflow-v1');
  if (!proofArg) {
    proofPath = path.join(screenDir, 'proof', `${screenBase}.proof.json`);
    writeJson(proofPath, proof, dryRun);
  }
  const mcqPath = path.join(screenDir, 'mcq', `${screenBase}.mcq.json`);
  const answerTemplatePath = path.join(screenDir, 'mcq', `${screenBase}.answers.template.json`);
  const recipePath = path.join(screenDir, 'generated', `${screenBase}-screen.recipe.json`);
  const screenSpecPath = path.join(screenDir, 'generated', `${screenBase}-screen.json`);
  const taskCardPath = path.join(screenDir, 'generated', `${screenBase}-task-card.md`);
  const taskShardPath = path.join(screenDir, 'generated', `${screenBase}-task-shard.json`);

  const mcqPackage = buildMcqPackage(proof, proofPath);
  writeJson(mcqPath, mcqPackage, dryRun);
  writeJson(answerTemplatePath, mcqPackage.answerTemplate, dryRun);

  let recipe = null;
  const shouldContinue = Boolean(getArg(process.argv, 'answers')) || hasFlag(process.argv, 'use-recommended');
  if (shouldContinue) {
    const answerSet = hasFlag(process.argv, 'use-recommended')
      ? buildRecommendedAnswerSet(mcqPackage)
      : require('./lib/ucuf-recipe-utils').readJson(resolvePath(getArg(process.argv, 'answers')));

    const built = buildRecipeFromMcq(proof, proofPath, mcqPackage, answerSet);
    recipe = built.recipe;
    writeJson(recipePath, recipe, dryRun);

    if (!dryRun) {
      execNode(path.join(PROJECT_ROOT, 'tools_node', 'compile-recipe-to-screen-spec.js'), [
        '--recipe', recipePath,
        '--write',
        '--out', screenSpecPath,
        '--screen-dir', screenDir,
        '--emit-intake',
        '--emit-asset-manifest',
      ]);

      execNode(path.join(PROJECT_ROOT, 'tools_node', 'task-card-opener.js'), [
        '--recipe', recipePath,
        '--write',
        '--out', taskCardPath,
        '--shard-out', taskShardPath,
      ]);

      execNode(path.join(PROJECT_ROOT, 'tools_node', 'compile-recipe-to-panel-scaffold.js'), [
        '--recipe', recipePath,
        '--write',
      ]);
    }
  }

  console.log(JSON.stringify({
    screenId: proof.screenId,
    screenDir: path.relative(PROJECT_ROOT, screenDir),
    outputs: {
      proof: path.relative(PROJECT_ROOT, proofPath),
      mcq: path.relative(PROJECT_ROOT, mcqPath),
      answersTemplate: path.relative(PROJECT_ROOT, answerTemplatePath),
      recipe: recipe ? path.relative(PROJECT_ROOT, recipePath) : '',
      screenSpec: recipe && !dryRun ? path.relative(PROJECT_ROOT, screenSpecPath) : '',
      taskCard: recipe && !dryRun ? path.relative(PROJECT_ROOT, taskCardPath) : '',
    },
    continuedToRecipe: Boolean(recipe),
  }, null, 2));
}

main();