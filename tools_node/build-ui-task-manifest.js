const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const manifestPath = path.join(ROOT, 'docs', 'ui-quality-todo.json');
const indexPath = path.join(ROOT, 'docs', 'agent-briefs', 'tasks_index.md');
const shardRoot = path.join(ROOT, 'docs', 'ui-quality-tasks');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function mergeTasks(baseTasks, shardTasks) {
  const merged = [...baseTasks];
  const indexById = new Map();

  merged.forEach((task, index) => {
    if (task && task.id) {
      indexById.set(task.id, index);
    }
  });

  for (const task of shardTasks) {
    if (!task || !task.id) {
      continue;
    }
    if (indexById.has(task.id)) {
      merged[indexById.get(task.id)] = task;
    } else {
      indexById.set(task.id, merged.length);
      merged.push(task);
    }
  }

  return merged;
}

function buildSummary(tasks) {
  const summary = {};
  for (const task of tasks) {
    const status = task && typeof task.status === 'string' ? task.status : 'unknown';
    summary[status] = (summary[status] || 0) + 1;
  }
  return summary;
}

function formatCell(value) {
  return value == null ? '' : String(value).replace(/\|/g, '\\|');
}

function buildIndexMarkdown(tasks, summary) {
  const total = tasks.length;
  const orderedSummaryKeys = ['completed', 'done', 'in-progress', 'open'];
  const extraSummaryKeys = Object.keys(summary)
    .filter((key) => !orderedSummaryKeys.includes(key))
    .sort();
  const summaryKeys = [...orderedSummaryKeys.filter((key) => key in summary), ...extraSummaryKeys];

  const rows = tasks.map((task) => {
    const link = `[${task.id}](./tasks/${task.id}.md)`;
    return `| ${formatCell(task.id)} | ${formatCell(task.owner)} | ${formatCell(task.status)} | ${formatCell(task.priority)} | ${formatCell(task.phase)} | ${formatCell(task.type)} | ${link} |`;
  });

  return [
    '---',
    'title: UI Quality Tasks Index',
    `generated: ${new Date().toISOString().slice(0, 10)}`,
    'manifest: ../ui-quality-todo.json',
    '---',
    '',
    '# Tasks Index / UI Quality',
    '',
    '> `docs/ui-quality-tasks/*.json` 是可編輯 shard 來源。',
    '> `docs/ui-quality-todo.json` 與本檔由 `node tools_node/build-ui-task-manifest.js` 生成。',
    '> New UI tasks must also follow `template family -> content contract -> skin fragment -> smoke route -> docs backwrite`.',
    '> See [UI-task-card-template.md](./UI-task-card-template.md).',
    '',
    '## Summary',
    '',
    `- Total: ${total}`,
    ...summaryKeys.map((key) => `- ${key}: ${summary[key]}`),
    '',
    '## Tasks',
    '',
    '| ID | Owner | Status | Priority | Phase | Type | Link |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    ''
  ].join('\n');
}

function main() {
  const manifest = readJson(manifestPath);
  const shardFiles = walkJsonFiles(shardRoot);
  const shardTasks = [];

  for (const shardFile of shardFiles) {
    const shard = readJson(shardFile);
    if (shard.kind !== 'ui-quality-task-shard' || !Array.isArray(shard.tasks)) {
      continue;
    }
    shardTasks.push(...shard.tasks);
  }

  const mergedTasks = mergeTasks(Array.isArray(manifest.tasks) ? manifest.tasks : [], shardTasks);
  const summary = buildSummary(mergedTasks);
  const nextManifest = {
    ...manifest,
    tasks: mergedTasks,
    summary
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(indexPath, buildIndexMarkdown(mergedTasks, summary), 'utf8');

  console.log(
    JSON.stringify(
      {
        shardFiles: shardFiles.length,
        mergedTasks: mergedTasks.length,
        summary
      },
      null,
      2
    )
  );
}

main();
