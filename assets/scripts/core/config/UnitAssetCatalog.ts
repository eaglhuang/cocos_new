import { TroopType } from './Constants';

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
  soldierYawOffset?: number;
  shadowScaleX?: number;
  shadowScaleZ?: number;
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
  // yawPlayer / yawEnemy ??boardRenderer 不可?��???fallback 絕�???
  // 計�??��?：atan2(-forward.z, forward.x) �?local +X 對�??��??��?
  // boardYaw=0 ?��?player forward=(0,0,1) ??-90°；enemy forward=(0,0,-1) ??+90°
  [TroopType.Archer]: {
    glbPath: 'units/troops/archer/unit.glb',
    sceneUuid: '1f0c4d72-d0ff-48ae-ae2f-85f2cdf31bf2@8eac8',
    prefabPath: 'units/troops/archer/unit',
    modelScale: 0.55,
    spacingX: 0.2,
    spacingZ: 0.22,
    heightOffset: -0.46,
    yawPlayer: -90,
    yawEnemy: 90,
  },
  [TroopType.Infantry]: {
    glbPath: 'units/troops/infantry/unit.glb',
    sceneUuid: '1b99b2a5-d40e-43df-8af5-da6e859906c9@60f3f',
    prefabPath: 'units/troops/infantry/unit',
    modelScale: 0.55,
    spacingX: 0.18,
    spacingZ: 0.2,
    heightOffset: -0.46,
    yawPlayer: -90,
    yawEnemy: 90,
  },
  [TroopType.Shield]: {
    glbPath: 'units/troops/shield/unit.glb',
    sceneUuid: 'bb322a56-41aa-4a18-ab9f-73b70887df45@65a61',
    prefabPath: 'units/troops/shield/unit',
    modelScale: 0.55,
    spacingX: 0.18,
    spacingZ: 0.2,
    heightOffset: -0.44,
    yawPlayer: -90,
    yawEnemy: 90,
  },
  [TroopType.Pikeman]: {
    glbPath: 'units/troops/pikeman/unit.glb',
    sceneUuid: 'd6488080-8639-41f1-ad70-4aa7b32a6149@c7354',
    prefabPath: 'units/troops/pikeman/unit',
    modelScale: 0.65,  // 調大長槍兵，使其和步兵視覺大小一致
    spacingX: 0.2,
    spacingZ: 0.22,
    heightOffset: -0.48,
    yawPlayer: -90,
    yawEnemy: 90,
    soldierYawOffset: 0,  // ?�調?��???pikeman ?��?仍�?請�???90 ??-90
  },
  [TroopType.Cavalry]: {
    glbPath: 'units/troops/cavalry/unit.glb',
    sceneUuid: '990fb4a7-b2e2-4648-9a27-8d2178cef578@4483b',
    prefabPath: 'units/troops/cavalry/unit',
    modelScale: 0.72,
    spacingX: 0.22,
    spacingZ: 0.24,
    heightOffset: -0.5,
    yawPlayer: -90,
    yawEnemy: 90,
    soldierYawOffset: -60,  // 騎兵 GLB ?��???30度修�?(??-90 ?�為 -60)，�?�?��?�格子�???
    shadowScaleX: 0.45,
    shadowScaleZ: 0.20,     // 騎兵影�??�獨?�長?��?�?(X?��?後�?Z?�左??
  },
};

export const HERO_UNIT_ASSET_CATALOG: Record<string, HeroUnitAssetEntry> = {
  'zhaoyun-no-helmet': {
    glbPath: 'units/heroes/zhaoyun-no-helmet/hero.glb',
    prefabPath: 'units/heroes/zhaoyun-no-helmet/hero',
    modelScale: 1.3,
    heightOffset: -0.72,
    yawOffset: 0,
  },
  'pink-brown-general': {
    glbPath: 'units/heroes/pink-brown-general/hero.glb',
    prefabPath: 'units/heroes/pink-brown-general/hero',
    modelScale: 1.3,
    heightOffset: -0.72,
    yawOffset: 0,
  },
  'blonde-general': {
    glbPath: 'units/heroes/blonde-general/hero.glb',
    prefabPath: 'units/heroes/blonde-general/hero',
    modelScale: 1.3,
    heightOffset: -0.72,
    yawOffset: 0,
  },
};

export const DEFAULT_PLAYER_HERO_ASSET_ID = 'zhaoyun-no-helmet';
export const DEFAULT_ENEMY_HERO_ASSET_ID = 'pink-brown-general';
