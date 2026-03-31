
/**
 * 腳本使用 node:fs / node:path。
 * 注意：這些模組僅在 Node.js (Editor/CLI) 環境可用。
 * 在 Cocos 預覽網頁環境下會跳過執行。
 */

type TroopDefaults = {
  modelScale: number;
  spacingX: number;
  spacingZ: number;
  heightOffset: number;
  yawPlayer: number;
  yawEnemy: number;
};

type HeroDefaults = {
  modelScale: number;
  heightOffset: number;
  yawOffset: number;
};

type TroopCatalogEntry = TroopDefaults & {
  glbPath: string;
  sceneUuid: string;
  prefabPath?: string;
};

type HeroCatalogEntry = HeroDefaults & {
  glbPath: string;
  sceneUuid?: string;
  prefabPath?: string;
};

const TROOP_ENUM_KEYS: Record<string, string> = {
  archer: 'TroopType.Archer',
  infantry: 'TroopType.Infantry',
  shield: 'TroopType.Shield',
  pikeman: 'TroopType.Pikeman',
  cavalry: 'TroopType.Cavalry',
};

const TROOP_DEFAULTS: Record<string, TroopDefaults> = {
  archer: { modelScale: 0.11, spacingX: 0.52, spacingZ: 0.54, heightOffset: -0.34, yawPlayer: 180, yawEnemy: 0 },
  infantry: { modelScale: 0.11, spacingX: 0.5, spacingZ: 0.52, heightOffset: -0.34, yawPlayer: 180, yawEnemy: 0 },
  shield: { modelScale: 0.12, spacingX: 0.5, spacingZ: 0.52, heightOffset: -0.34, yawPlayer: 180, yawEnemy: 0 },
  pikeman: { modelScale: 0.13, spacingX: 0.54, spacingZ: 0.56, heightOffset: -0.34, yawPlayer: 180, yawEnemy: 0 },
  cavalry: { modelScale: 0.095, spacingX: 0.68, spacingZ: 0.7, heightOffset: -0.34, yawPlayer: 180, yawEnemy: 0 },
};

const HERO_DEFAULTS: Record<string, HeroDefaults> = {
  'zhaoyun-no-helmet': { modelScale: 0.34, heightOffset: -0.54, yawOffset: 180 },
  'pink-brown-general': { modelScale: 0.34, heightOffset: -0.54, yawOffset: 180 },
  'blonde-general': { modelScale: 0.34, heightOffset: -0.54, yawOffset: 180 },
};

const DEFAULT_PLAYER_HERO_ASSET_ID = 'zhaoyun-no-helmet';
const DEFAULT_ENEMY_HERO_ASSET_ID = 'pink-brown-general';

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(3).replace(/0+$/g, '').replace(/\.$/g, '');
}

async function exists(filePath: string): Promise<boolean> {
  if (typeof window !== 'undefined') return false;
  const fs = require('node:fs').promises;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function pickSceneUuid(meta: any): string | undefined {
  const subMetas = meta?.subMetas ?? {};
  for (const subMeta of Object.values<any>(subMetas)) {
    if (subMeta?.importer === 'gltf-scene' || subMeta?.name === 'unit.prefab' || subMeta?.name === 'hero.prefab') {
      return subMeta.uuid;
    }
  }
  return undefined;
}

async function buildTroopEntries(projectPath: string): Promise<Array<{ enumKey: string; entry: TroopCatalogEntry }>> {
  const path = require('node:path');
  const fs = require('node:fs').promises;
  const troopsRoot = path.join(projectPath, 'assets', 'resources', 'units', 'troops');
  const entries = await fs.readdir(troopsRoot, { withFileTypes: true });
  const result: Array<{ enumKey: string; entry: TroopCatalogEntry }> = [];

  for (const dirent of entries) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const unitId = dirent.name;
    const enumKey = TROOP_ENUM_KEYS[unitId];
    const defaults = TROOP_DEFAULTS[unitId];
    if (!enumKey || !defaults) {
      continue;
    }

    const glbPath = path.join(troopsRoot, unitId, 'unit.glb');
    const metaPath = `${glbPath}.meta`;
    if (!(await exists(metaPath))) {
      continue;
    }

    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    const sceneUuid = pickSceneUuid(meta);
    if (!sceneUuid) {
      console.warn(`[UnitAssetOrganizer] 找不到 troop scene uuid: ${unitId}`);
      continue;
    }

    const prefabFilePath = path.join(troopsRoot, unitId, 'unit.prefab');
    const prefabPath = await exists(prefabFilePath) ? `units/troops/${unitId}/unit` : undefined;

    result.push({
      enumKey,
      entry: {
        glbPath: `units/troops/${unitId}/unit.glb`,
        sceneUuid,
        prefabPath,
        ...defaults,
      },
    });
  }

  result.sort((a, b) => a.enumKey.localeCompare(b.enumKey));
  return result;
}

async function buildHeroEntries(projectPath: string): Promise<Array<{ heroId: string; entry: HeroCatalogEntry }>> {
  const path = require('node:path');
  const fs = require('node:fs').promises;
  const heroesRoot = path.join(projectPath, 'assets', 'resources', 'units', 'heroes');
  const entries = await fs.readdir(heroesRoot, { withFileTypes: true });
  const result: Array<{ heroId: string; entry: HeroCatalogEntry }> = [];

  for (const dirent of entries) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const heroId = dirent.name;
    const defaults = HERO_DEFAULTS[heroId] ?? { modelScale: 0.34, heightOffset: -0.54, yawOffset: 180 };
    const glbPath = path.join(heroesRoot, heroId, 'hero.glb');
    const metaPath = `${glbPath}.meta`;
    const prefabFilePath = path.join(heroesRoot, heroId, 'hero.prefab');
    const prefabPath = await exists(prefabFilePath) ? `units/heroes/${heroId}/hero` : undefined;
    const fs = require('node:fs').promises;
    const sceneUuid = await exists(metaPath)
      ? pickSceneUuid(JSON.parse(await fs.readFile(metaPath, 'utf8')))
      : undefined;

    if (!prefabPath && !sceneUuid) {
      continue;
    }

    result.push({
      heroId,
      entry: {
        glbPath: `units/heroes/${heroId}/hero.glb`,
        prefabPath,
        sceneUuid,
        ...defaults,
      },
    });
  }

  result.sort((a, b) => a.heroId.localeCompare(b.heroId));
  return result;
}

function renderTroopEntry(enumKey: string, entry: TroopCatalogEntry): string {
  const prefabPathLine = entry.prefabPath ? `\n    prefabPath: '${entry.prefabPath}',` : '';
  return `  [${enumKey}]: {\n    glbPath: '${entry.glbPath}',\n    sceneUuid: '${entry.sceneUuid}',${prefabPathLine}\n    modelScale: ${formatNumber(entry.modelScale)},\n    spacingX: ${formatNumber(entry.spacingX)},\n    spacingZ: ${formatNumber(entry.spacingZ)},\n    heightOffset: ${formatNumber(entry.heightOffset)},\n    yawPlayer: ${formatNumber(entry.yawPlayer)},\n    yawEnemy: ${formatNumber(entry.yawEnemy)},\n  },`;
}

function renderHeroEntry(heroId: string, entry: HeroCatalogEntry): string {
  const prefabPathLine = entry.prefabPath ? `\n    prefabPath: '${entry.prefabPath}',` : '';
  const sceneUuidLine = entry.sceneUuid ? `\n    sceneUuid: '${entry.sceneUuid}',` : '';
  return `  '${heroId}': {\n    glbPath: '${entry.glbPath}',${sceneUuidLine}${prefabPathLine}\n    modelScale: ${formatNumber(entry.modelScale)},\n    heightOffset: ${formatNumber(entry.heightOffset)},\n    yawOffset: ${formatNumber(entry.yawOffset)},\n  },`;
}

function renderCatalogFile(
  troopEntries: Array<{ enumKey: string; entry: TroopCatalogEntry }>,
  heroEntries: Array<{ heroId: string; entry: HeroCatalogEntry }>,
): string {
  const troopBlock = troopEntries.map(item => renderTroopEntry(item.enumKey, item.entry)).join('\n');
  const heroBlock = heroEntries.map(item => renderHeroEntry(item.heroId, item.entry)).join('\n');

  return `import { TroopType } from './Constants';

export interface TroopUnitAssetEntry {
  glbPath: string;
  sceneUuid: string;
  prefabPath?: string;
  modelScale: number;
  spacingX: number;
  spacingZ: number;
  heightOffset: number;
  yawPlayer: number;
  yawEnemy: number;
}

export interface HeroUnitAssetEntry {
  glbPath: string;
  sceneUuid?: string;
  prefabPath?: string;
  modelScale: number;
  heightOffset: number;
  yawOffset: number;
}

export const TROOP_UNIT_ASSET_CATALOG: Partial<Record<TroopType, TroopUnitAssetEntry>> = {
${troopBlock}
};

export const HERO_UNIT_ASSET_CATALOG: Record<string, HeroUnitAssetEntry> = {
${heroBlock}
};

export const DEFAULT_PLAYER_HERO_ASSET_ID = '${DEFAULT_PLAYER_HERO_ASSET_ID}';
export const DEFAULT_ENEMY_HERO_ASSET_ID = '${DEFAULT_ENEMY_HERO_ASSET_ID}';
`;
}

export const methods = {
  async regenerateUnitAssetCatalog() {
    try {
      // @ts-ignore
      const projectPath = Editor.Project?.path as string;
      if (!projectPath) {
        throw new Error('無法取得專案路徑');
      }

      const troopEntries = await buildTroopEntries(projectPath);
      const heroEntries = await buildHeroEntries(projectPath);
      const path = require('node:path');
      const fs = require('node:fs').promises;
      const outputPath = path.join(projectPath, 'assets', 'scripts', 'core', 'config', 'UnitAssetCatalog.ts');
      const content = renderCatalogFile(troopEntries, heroEntries);
      await fs.writeFile(outputPath, content, 'utf8');

      // @ts-ignore
      await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/scripts/core/config/UnitAssetCatalog.ts');
      console.log(`[UnitAssetOrganizer] 已重建 UnitAssetCatalog，共 ${troopEntries.length} 個 troop，${heroEntries.length} 個 hero`);
    } catch (error) {
      console.error('[UnitAssetOrganizer] 重建失敗', error);
    }
  },
};

export function load() {
  console.log('[UnitAssetOrganizer] 擴展已載入');
}

export function unload() {
  console.log('[UnitAssetOrganizer] 擴展已卸載');
}
