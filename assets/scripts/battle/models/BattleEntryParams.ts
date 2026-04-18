// @spec-source → 見 docs/cross-reference-index.md
// [統一戰場入口] 定義從任何路徑進入 BattleScene 時的參數介面。
// Unity 對照：BattleEntryData / BattleSessionConfig

import { Weather, BattleTactic } from '../../core/config/Constants';

/**
 * 統一的戰場入口參數。
 * 無論從大廳正式進入、QA 工具 preview、或「再來一場」replay，
 * BattleScene.start() 都透過此介面取得完整的戰鬥設定。
 */
export interface BattleEntryParams {
  /** 入口來源：lobby = 大廳正式入口, preview = QA 工具 / preview target 5, replay = 再來一場 */
  entrySource: 'lobby' | 'preview' | 'replay';

  /** 遭遇戰 ID（對應 encounters.json） */
  encounterId: string;

  /** 我軍主將 ID */
  playerGeneralId: string;
  /** 敵軍主將 ID */
  enemyGeneralId: string;

  /** 我軍裝備 ID 列表（預留） */
  playerEquipment?: string[];
  /** 敵軍裝備 ID 列表（預留） */
  enemyEquipment?: string[];

  /** 虎符卡組 ID 列表。為空時使用 demo 預設卡組 */
  selectedCardIds?: string[];

  /** 天氣 */
  weather: Weather;
  /** 戰場戰法 */
  battleTactic: BattleTactic;
  /** 背景 ID（覆蓋 encounter 設定；為空時由 encounter 決定） */
  backgroundId?: string;
}

/** QA 工具 / preview target 5 使用的預設參數 */
export const DEFAULT_BATTLE_ENTRY_PARAMS: BattleEntryParams = {
  entrySource: 'preview',
  encounterId: 'encounter-001',
  playerGeneralId: 'zhang-fei',
  enemyGeneralId: 'lu-bu',
  playerEquipment: [],
  enemyEquipment: [],
  selectedCardIds: [],
  weather: Weather.Clear,
  battleTactic: BattleTactic.Normal,
};

// ─── 中文映射表（用於 log 輸出）─────────────────────────────────────────────

const WEATHER_LABEL: Record<Weather, string> = {
  [Weather.Clear]: '晴天',
  [Weather.Rain]: '雨天',
  [Weather.Fog]: '霧',
  [Weather.Snow]: '雪',
  [Weather.Sandstorm]: '沙暴',
  [Weather.Night]: '夜戰',
};

const TACTIC_LABEL: Record<BattleTactic, string> = {
  [BattleTactic.Normal]: '普通',
  [BattleTactic.FireAttack]: '火攻',
  [BattleTactic.FloodAttack]: '水淹',
  [BattleTactic.RockSlide]: '落石',
  [BattleTactic.AmbushAttack]: '伏擊',
  [BattleTactic.NightRaid]: '夜襲',
};

const SOURCE_TAG: Record<BattleEntryParams['entrySource'], string> = {
  lobby: '大廳進入戰場',
  preview: 'QA工具進入戰場',
  replay: '再來一場',
};

const PARAM_TAG: Record<BattleEntryParams['entrySource'], string> = {
  lobby: '正式參數',
  preview: '預設參數',
  replay: '重播參數',
};

/**
 * 將 BattleEntryParams 格式化為 console log 用的完整字串。
 *
 * 範例輸出：
 * ```
 * [大廳進入戰場] 正式參數為：我軍主將(張飛) 帶虎符軍隊: 虎豹騎/陷陣營/大戟士/連弩手,
 *   敵軍 呂布, 天氣: 晴天, 遭遇戰: encounter-001, 戰法: 普通
 * ```
 */
export function formatBattleEntryLog(
  params: BattleEntryParams,
  extra?: {
    playerName?: string;
    enemyName?: string;
    encounterName?: string;
    cardNames?: string[];
  },
): string {
  const tag = SOURCE_TAG[params.entrySource] ?? params.entrySource;
  const paramTag = PARAM_TAG[params.entrySource] ?? '參數';
  const pName = extra?.playerName ?? params.playerGeneralId;
  const eName = extra?.enemyName ?? params.enemyGeneralId;
  const encName = extra?.encounterName ?? params.encounterId;
  const cards = extra?.cardNames?.join('/') || '(預設卡組)';
  const weather = WEATHER_LABEL[params.weather] ?? params.weather;
  const tactic = TACTIC_LABEL[params.battleTactic] ?? params.battleTactic;
  const pEquip = params.playerEquipment?.length ? params.playerEquipment.join('/') : '(無裝備)';
  const eEquip = params.enemyEquipment?.length ? params.enemyEquipment.join('/') : '(無裝備)';

  return `[${tag}] ${paramTag}為：我軍主將(${pName}) 裝備: ${pEquip}, 帶虎符軍隊: ${cards}, 敵軍 ${eName} 裝備: ${eEquip}, 天氣: ${weather}, 遭遇戰: ${encName}, 戰法: ${tactic}`;
}
