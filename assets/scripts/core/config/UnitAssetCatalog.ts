// @spec-source → 見 docs/cross-reference-index.md
import { TroopType } from './Constants';

/** 陣營子路徑（對應不同國家的兵種表現） */
export enum SubFaction {
  Shu = 'shu', // 綠色
  Wei = 'wei', // 藍色
  Wu  = 'wu',  // 紅色
}

/** 武將 ID 對應國籍子陣營（SHV/WEI/WU） */
export const GENERAL_SUBFACTION_MAP: Record<string, SubFaction> = {
  'zhang-fei': SubFaction.Shu,
  'guan-yu':   SubFaction.Shu,
  'zhao-yun':  SubFaction.Shu,
  'lu-bu':     SubFaction.Wu,  // 目前呂布先暫代吳國（紅色）
  'cao-cao':   SubFaction.Wei, // 曹操為魏國（藍色，待補素材）
};

export interface TroopUnitAssetEntry {
  glbPath: string;
  sceneUuid: string;
  /** 紅色（Wu 陣營）GLB 的 gltf-scene 子資產 UUID，供最後階段 fallback 使用 */
  sceneUuidRed?: string;
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
  /** RM (Roughness-Metallic) 貼圖的 Cocos sub-asset UUID。
   *  對應 GLB 內嵌的 _rm 圖（格式 R=AO, G=Roughness, B=Metallic）。
   *  用於 heroine-toon 的 controlMap，驅動金屬盔甲的外觀。
   *  若 GLB 沒有 RM 貼圖（如趙雲只有 basecolor），此欄位不填，metalMask 保持 0（無金屬）。
   */
  rmTexUuid?: string;
}

/** 
 * 取得特定子陣營的兵種 Prefab 路徑。
 * 規則：
 * - Shu (綠): units/troops/[type]/unit
 * - Wu (紅): units/troops/[type]/unit_red
 * - Wei (藍): units/troops/[type]/unit_blue (暫代，未來補齊素材)
 */
export function getTroopSubFactionPrefabPath(type: TroopType, subFaction: SubFaction): string {
  const basePath = `units/troops/${type}/unit`;
  switch (subFaction) {
    case SubFaction.Wu:  return `${basePath}_red`;
    case SubFaction.Wei: return `${basePath}_blue`;
    case SubFaction.Shu:
    default:             return basePath;
  }
}

export const TROOP_UNIT_ASSET_CATALOG: Partial<Record<TroopType, TroopUnitAssetEntry>> = {
  // yawPlayer / yawEnemy ??boardRenderer 不可????fallback 絕???
  // 計???：atan2(-forward.z, forward.x) ?local +X 對?????
  // boardYaw=0 ??player forward=(0,0,1) ??-90°；enemy forward=(0,0,-1) ??+90°
  [TroopType.Archer]: {
    glbPath: 'units/troops/archer/unit.glb',
    sceneUuid: '1f0c4d72-d0ff-48ae-ae2f-85f2cdf31bf2@8eac8',
    sceneUuidRed: 'f48b6302-243f-43d7-90d8-8649da72d815@a334d',
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
    sceneUuidRed: '707946d3-af2c-4297-b186-17f87c74ee74@5deb1',
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
    sceneUuidRed: '77910673-44f4-4298-918f-7288eb59d6b2@d438b',
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
    sceneUuidRed: '6f083553-6516-4611-be37-e228e0e82b16@891e1',
    prefabPath: 'units/troops/pikeman/unit',
    modelScale: 1.05,  // 長槍兵 GLB 本身比例偏小（約步兵 GLB 高度的 52%），需 1.05 對齊步兵視覺大小
    spacingX: 0.2,
    spacingZ: 0.22,
    heightOffset: -0.48,
    yawPlayer: -90,
    yawEnemy: 90,
    soldierYawOffset: 0,  // ?調????pikeman ??仍?請???90 ??-90
  },
  [TroopType.Cavalry]: {
    glbPath: 'units/troops/cavalry/unit.glb',
    sceneUuid: '990fb4a7-b2e2-4648-9a27-8d2178cef578@4483b',
    sceneUuidRed: 'fd8f7ea7-7f93-4aeb-9890-03f16a588792@f6087',
    prefabPath: 'units/troops/cavalry/unit',
    modelScale: 0.72,
    spacingX: 0.22,
    spacingZ: 0.24,
    heightOffset: -0.5,
    yawPlayer: -90,
    yawEnemy: 90,
    soldierYawOffset: -60,  // 騎兵 GLB ????30度修?(??-90 ?為 -60)，???格子???
    shadowScaleX: 0.45,
    shadowScaleZ: 0.20,     // 騎兵影??獨?長???(X??後?Z?左??
  },
};

export const HERO_UNIT_ASSET_CATALOG: Record<string, HeroUnitAssetEntry> = {
  'zhaoyun-no-helmet': {
    glbPath: 'units/heroes/zhaoyun-no-helmet/hero.glb',
    sceneUuid: '54784a75-869e-4212-8982-cd204da85838@e0623',
    prefabPath: 'units/heroes/zhaoyun-no-helmet/hero',
    modelScale: 1.3,
    heightOffset: -0.72,
    yawOffset: 0,
    // RM 貼圖（R=AO, G=Roughness, B=Metallic），對應 趙雲3dmodel_rm
    rmTexUuid: '54784a75-869e-4212-8982-cd204da85838@0089c',
  },
  'guanyu-general': {
    glbPath: 'units/heroes/guanyu/hero.glb',
    sceneUuid: '7b8d1ce1-8b9a-488f-85eb-ba4f05e50ad1@ff881',
    prefabPath: 'units/heroes/guanyu/hero',
    modelScale: 1.3,
    heightOffset: -0.72,
    yawOffset: 0,
    // RM 貼圖（R=AO, G=Roughness, B=Metallic），對應 fantasywarrior3dmodel_rm
    rmTexUuid: '7b8d1ce1-8b9a-488f-85eb-ba4f05e50ad1@0089c',
  },
  'pink-brown-general': {
    glbPath: 'units/heroes/pink-brown-general/hero.glb',
    sceneUuid: '84b8eb57-db41-4f5b-9a1f-f9658a733151@c6c49',
    prefabPath: 'units/heroes/pink-brown-general/hero',
    modelScale: 1.3,
    heightOffset: -0.72,
    yawOffset: 0,
    // RM 貼圖（R=AO, G=Roughness, B=Metallic），對應 fantasyarmoredfemale3dmodel_Clone1_rm
    rmTexUuid: '84b8eb57-db41-4f5b-9a1f-f9658a733151@0089c',
  },
  'blonde-general': {
    glbPath: 'units/heroes/blonde-general/hero.glb',
    prefabPath: 'units/heroes/blonde-general/hero',
    modelScale: 1.3,
    heightOffset: -0.72,
    yawOffset: 0,
  },
};

export const DEFAULT_PLAYER_HERO_ASSET_ID = 'guanyu-general';
export const DEFAULT_ENEMY_HERO_ASSET_ID = 'pink-brown-general';
