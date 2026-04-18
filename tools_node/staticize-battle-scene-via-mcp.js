#!/usr/bin/env node

const DEFAULT_ENDPOINT = process.env.COCOS_MCP_URL || 'http://127.0.0.1:3000/mcp';
const DEFAULT_SCENE_PATH = 'db://assets/scenes/BattleScene.scene';
const DEFAULT_CANVAS_NAME = 'Canvas';
const FULLSCREEN_SIZE = { width: 1920, height: 1080 };
const WIDGET_ALIGN_ALWAYS = 2;

const HOST_SPECS = [
  {
    name: 'BattleLogPanel',
    scriptPath: 'db://assets/scripts/ui/components/BattleLogComposite.ts',
    componentHint: 'BattleLogComposite',
  },
  {
    name: 'BattleScenePanel',
    scriptPath: 'db://assets/scripts/ui/components/BattleScenePanel.ts',
    componentHint: 'BattleScenePanel',
  },
  {
    name: 'TigerTallyPanel',
    scriptPath: 'db://assets/scripts/ui/components/TigerTallyComposite.ts',
    componentHint: 'TigerTallyComposite',
  },
  {
    name: 'UnitInfoPanel',
    scriptPath: 'db://assets/scripts/ui/components/UnitInfoComposite.ts',
    componentHint: 'UnitInfoComposite',
  },
  {
    name: 'TigerTallyDetailPanel',
    scriptPath: 'db://assets/scripts/ui/components/TigerTallyDetailComposite.ts',
    componentHint: 'TigerTallyDetailComposite',
  },
  {
    name: 'ActionCommandPanel',
    scriptPath: 'db://assets/scripts/ui/components/ActionCommandComposite.ts',
    componentHint: 'ActionCommandComposite',
  },
];

const BATTLE_SCENE_PANEL_HOSTS = {
  battleHUDHost: 'HUD',
  tigerTallyHost: 'TigerTallyPanel',
  unitInfoHost: 'UnitInfoPanel',
  tigerTallyDetailHost: 'TigerTallyDetailPanel',
  battleLogHost: 'BattleLogPanel',
  actionCommandHost: 'ActionCommandPanel',
};

const BATTLE_SCENE_COMPONENT_HINT = 'BattleScene';
const BATTLE_SCENE_COMPONENT_REFS = {
  battleLogPanel: 'BattleLogPanel',
  battleScenePanel: 'BattleScenePanel',
};

function parseArgs(argv) {
  const args = {
    apply: false,
    scenePath: DEFAULT_SCENE_PATH,
    endpoint: DEFAULT_ENDPOINT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--apply') {
      args.apply = true;
      continue;
    }
    if (token === '--dry-run') {
      args.apply = false;
      continue;
    }
    if (token === '--scene' && argv[index + 1]) {
      args.scenePath = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--endpoint' && argv[index + 1]) {
      args.endpoint = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage: node tools_node/staticize-battle-scene-via-mcp.js [--apply] [--scene <db://...>] [--endpoint <url>]',
    '',
    'Without --apply, the script runs in dry-run mode and reports what would be created or rewired.',
  ].join('\n'));
}

class McpClient {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.id = 1;
  }

  async call(name, args = {}) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.id += 1,
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP HTTP ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    if (payload.error) {
      throw new Error(`MCP ${name} failed: ${payload.error.message}`);
    }

    const text = payload?.result?.content?.[0]?.text;
    if (!text) {
      return payload?.result ?? null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return { success: true, data: text };
    }
  }
}

function requireSuccess(toolName, result) {
  if (!result || result.success === false) {
    const message = result?.error || result?.message || 'unknown failure';
    throw new Error(`${toolName} returned failure: ${message}`);
  }
  return result;
}

function getObject(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value;
}

function getUuid(value) {
  const object = getObject(value);
  return object?.uuid || object?.data?.uuid || null;
}

function getArrayData(value) {
  if (Array.isArray(value?.data)) {
    return value.data;
  }
  if (Array.isArray(value?.data?.components)) {
    return value.data.components;
  }
  if (Array.isArray(value?.components)) {
    return value.components;
  }
  return [];
}

function normalizeComponentCandidates(component) {
  return [
    component?.type,
    component?.name,
    component?.className,
    component?.scriptName,
    component?.cid,
  ].filter(Boolean);
}

function getCustomComponentTypes(components) {
  return components
    .map((component) => normalizeComponentCandidates(component)[0] || component?.type || component?.cid || component?.name)
    .filter((candidate) => candidate && !String(candidate).startsWith('cc.'));
}

async function findNodeByName(client, name) {
  const result = await client.call('node_find_nodes', {
    pattern: name,
    exactMatch: true,
  });
  if (!result || result.success === false) {
    return null;
  }

  const nodes = Array.isArray(result.data) ? result.data : [];
  if (nodes.length === 0) {
    return null;
  }

  const canvasScoped = nodes.find((node) => String(node.path || '').includes(`/Canvas/${name}`));
  return canvasScoped || nodes[0];
}

async function getNodeInfo(client, uuid) {
  const result = requireSuccess('node_get_node_info', await client.call('node_get_node_info', { uuid }));
  return result.data || result;
}

async function resolveComponentType(client, nodeUuid, hint) {
  const response = requireSuccess('component_get_components', await client.call('component_get_components', { nodeUuid }));
  const components = getArrayData(response);
  const exactLower = hint.toLowerCase();

  for (const component of components) {
    const candidates = normalizeComponentCandidates(component);
    const exactMatch = candidates.find((candidate) => String(candidate).toLowerCase() === exactLower);
    if (exactMatch) {
      return exactMatch;
    }
  }

  for (const component of components) {
    const candidates = normalizeComponentCandidates(component);
    const partialMatch = candidates.find((candidate) => String(candidate).toLowerCase().includes(exactLower));
    if (partialMatch) {
      return partialMatch;
    }
  }

  if (!hint.startsWith('cc.')) {
    const customTypes = getCustomComponentTypes(components);
    if (customTypes.length === 1) {
      return customTypes[0];
    }
  }

  return null;
}

async function ensureBuiltInComponent(client, nodeUuid, componentType) {
  const existingType = await resolveComponentType(client, nodeUuid, componentType);
  if (existingType) {
    return existingType;
  }

  requireSuccess('component_add_component', await client.call('component_add_component', {
    nodeUuid,
    componentType,
  }));

  return componentType;
}

async function ensureScriptComponent(client, nodeUuid, scriptPath, componentHint) {
  const existingType = await resolveComponentType(client, nodeUuid, componentHint);
  if (existingType) {
    return existingType;
  }

  const beforeResponse = requireSuccess('component_get_components', await client.call('component_get_components', { nodeUuid }));
  const beforeCustomTypes = new Set(getCustomComponentTypes(getArrayData(beforeResponse)));

  const attachResult = await client.call('component_attach_script', {
    nodeUuid,
    scriptPath,
  });

  const attachedType = await resolveComponentType(client, nodeUuid, componentHint);
  if (attachedType) {
    return attachedType;
  }

  const afterResponse = requireSuccess('component_get_components', await client.call('component_get_components', { nodeUuid }));
  const afterCustomTypes = getCustomComponentTypes(getArrayData(afterResponse));
  const newCustomType = afterCustomTypes.find((candidate) => !beforeCustomTypes.has(candidate));
  if (newCustomType) {
    return newCustomType;
  }

  if (attachResult?.success === false) {
    const message = attachResult?.error || attachResult?.message || 'unknown failure';
    throw new Error(`component_attach_script reported failure for ${componentHint}: ${message}`);
  }

  throw new Error(`Attached ${componentHint} to ${nodeUuid}, but component_get_components could not resolve it`);
}

async function setComponentProperty(client, params) {
  requireSuccess('component_set_component_property', await client.call('component_set_component_property', params));
}

async function ensureCanvasHost(client, canvasUuid, canvasLayer, spec, apply) {
  let node = await findNodeByName(client, spec.name);
  let status = 'existing';

  if (node) {
    const path = String(node.path || '');
    if (!path.includes(`/Canvas/${spec.name}`)) {
      const nodeUuid = getUuid(node);
      if (!nodeUuid) {
        throw new Error(`${spec.name} already exists at ${path}, but its uuid could not be resolved`);
      }

      if (!apply) {
        return { name: spec.name, status: 'wrong-parent', uuid: nodeUuid, path };
      }

      requireSuccess('node_move_node', await client.call('node_move_node', {
        nodeUuid,
        newParentUuid: canvasUuid,
      }));

      node = await findNodeByName(client, spec.name);
      status = 'moved';
    }
  }

  if (!node) {
    status = 'missing';
    if (!apply) {
      return { name: spec.name, status };
    }

    const created = requireSuccess('node_create_node', await client.call('node_create_node', {
      name: spec.name,
      parentUuid: canvasUuid,
      nodeType: '2DNode',
      components: ['cc.UITransform', 'cc.Widget'],
    }));

    node = created.data || created;
    status = 'created';
  }

  const nodeUuid = getUuid(node);
  if (!nodeUuid) {
    throw new Error(`Could not resolve uuid for ${spec.name}`);
  }

  if (!apply) {
    return { name: spec.name, status, uuid: nodeUuid };
  }

  await client.call('node_set_node_property', {
    uuid: nodeUuid,
    property: 'layer',
    value: canvasLayer,
  });

  await ensureBuiltInComponent(client, nodeUuid, 'cc.UITransform');
  await ensureBuiltInComponent(client, nodeUuid, 'cc.Widget');

  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.UITransform',
    property: 'contentSize',
    propertyType: 'size',
    value: FULLSCREEN_SIZE,
  });

  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.Widget',
    property: 'isAlignTop',
    propertyType: 'boolean',
    value: true,
  });
  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.Widget',
    property: 'isAlignBottom',
    propertyType: 'boolean',
    value: true,
  });
  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.Widget',
    property: 'isAlignLeft',
    propertyType: 'boolean',
    value: true,
  });
  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.Widget',
    property: 'isAlignRight',
    propertyType: 'boolean',
    value: true,
  });
  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.Widget',
    property: 'top',
    propertyType: 'number',
    value: 0,
  });
  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.Widget',
    property: 'bottom',
    propertyType: 'number',
    value: 0,
  });
  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.Widget',
    property: 'left',
    propertyType: 'number',
    value: 0,
  });
  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.Widget',
    property: 'right',
    propertyType: 'number',
    value: 0,
  });
  await setComponentProperty(client, {
    nodeUuid,
    componentType: 'cc.Widget',
    property: 'alignMode',
    propertyType: 'integer',
    value: WIDGET_ALIGN_ALWAYS,
  });

  const componentType = await ensureScriptComponent(client, nodeUuid, spec.scriptPath, spec.componentHint);
  return { name: spec.name, status, uuid: nodeUuid, componentType };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = new McpClient(args.endpoint);

  const sceneOpenResult = requireSuccess('scene_open_scene', await client.call('scene_open_scene', {
    scenePath: args.scenePath,
  }));

  const currentScene = requireSuccess('scene_get_current_scene', await client.call('scene_get_current_scene'));
  const canvasNode = await findNodeByName(client, DEFAULT_CANVAS_NAME);
  if (!canvasNode) {
    throw new Error('Could not find Canvas in the opened BattleScene');
  }

  const canvasInfo = await getNodeInfo(client, canvasNode.uuid);
  const canvasLayer = canvasInfo.layer ?? canvasInfo.data?.layer ?? 0;

  const summary = {
    apply: args.apply,
    endpoint: args.endpoint,
    scenePath: args.scenePath,
    opened: sceneOpenResult.message || 'ok',
    scene: currentScene.data,
    createdHosts: [],
    rewiredPanelHosts: [],
    rewiredBattleSceneRefs: [],
    pendingHosts: [],
    saved: false,
  };

  const hostState = new Map();
  hostState.set('HUD', await findNodeByName(client, 'HUD'));

  for (const spec of HOST_SPECS) {
    const ensured = await ensureCanvasHost(client, canvasNode.uuid, canvasLayer, spec, args.apply);
    summary.createdHosts.push(ensured);
    const nodeData = ensured.uuid ? { uuid: ensured.uuid, name: spec.name } : await findNodeByName(client, spec.name);
    hostState.set(spec.name, nodeData);
    if (!nodeData?.uuid) {
      summary.pendingHosts.push(spec.name);
    }
  }

  const battleScenePanelNode = hostState.get('BattleScenePanel');
  if (!battleScenePanelNode?.uuid) {
    if (!args.apply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    throw new Error('BattleScenePanel host is unresolved after ensureCanvasHost');
  }

  const battleScenePanelType = args.apply
    ? await resolveComponentType(client, battleScenePanelNode.uuid, 'BattleScenePanel')
    : 'BattleScenePanel';

  for (const [property, hostName] of Object.entries(BATTLE_SCENE_PANEL_HOSTS)) {
    const hostNode = hostState.get(hostName);
    if (!hostNode?.uuid) {
      if (!args.apply) {
        continue;
      }
      throw new Error(`Could not resolve ${hostName} for BattleScenePanel.${property}`);
    }

    summary.rewiredPanelHosts.push({ property, hostName, uuid: hostNode.uuid });

    if (args.apply) {
      await setComponentProperty(client, {
        nodeUuid: battleScenePanelNode.uuid,
        componentType: battleScenePanelType,
        property,
        propertyType: 'node',
        value: hostNode.uuid,
      });
    }
  }

  const battleSceneNode = await findNodeByName(client, 'BattleScene');
  if (!battleSceneNode?.uuid) {
    throw new Error('Could not resolve BattleScene root node');
  }

  const battleSceneComponentType = args.apply
    ? await resolveComponentType(client, battleSceneNode.uuid, BATTLE_SCENE_COMPONENT_HINT)
    : BATTLE_SCENE_COMPONENT_HINT;

  for (const [property, hostName] of Object.entries(BATTLE_SCENE_COMPONENT_REFS)) {
    const hostNode = hostState.get(hostName);
    if (!hostNode?.uuid) {
      if (!args.apply) {
        continue;
      }
      throw new Error(`Could not resolve ${hostName} for BattleScene.${property}`);
    }

    summary.rewiredBattleSceneRefs.push({ property, hostName, uuid: hostNode.uuid });

    if (args.apply) {
      await setComponentProperty(client, {
        nodeUuid: battleSceneNode.uuid,
        componentType: battleSceneComponentType,
        property,
        propertyType: 'component',
        value: hostNode.uuid,
      });
    }
  }

  if (args.apply) {
    requireSuccess('scene_save_scene', await client.call('scene_save_scene'));
    summary.saved = true;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});