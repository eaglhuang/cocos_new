/**
 * BattlePresentationTiming.ts
 *
 * 所有為了「戰場演出節奏」而存在的等待秒數 / 輪詢毫秒 / 提示時長，
 * 都集中在這個檔案維護。
 *
 * 調整原則：
 * 1. 想微調手感時，優先只改這裡。
 * 2. 這些數值允許設成 0，方便做極速 QA 或只驗證流程正確性。
 * 3. BattleScene / BattleUIBridge / TurnFlowManager / UnitRenderer 都應共用這份設定，避免雙路徑漂移。
 */

export const BATTLE_TURN_FLOW_TIMING = {
  /** 玩家部署完成後，自動進入回合推進前的等待秒數。 */
  autoAdvanceAfterDeploySec: 2.0,
  /** 敵方子回合開始前，保留給「敵軍思考中」提示的前置秒數。 */
  enemyThinkingLeadInSec: 2.0,
  /** 子回合邏輯跑完後，最少等待多久再開始檢查戰鬥視覺佇列。 */
  postSubturnVisualBufferSec: 2.3,
  /** 戰鬥視覺佇列的輪詢間隔秒數。 */
  combatDrainPollIntervalSec: 0.5,
  /** 戰鬥視覺佇列的最多輪詢次數，避免互動永久鎖死。 */
  combatDrainMaxPollAttempts: 12,
  /** 回合推進安全解鎖秒數；超時後會強制回到可操作狀態。 */
  advanceSafetyUnlockSec: 20,
  /** 回合開始 Banner 的去抖毫秒，避免短時間重複跳出。 */
  turnBannerDebounceMs: 2500,
  /** 回合開始 Banner 的 Toast 顯示秒數。 */
  turnBannerToastSec: 1.0,
  /** 玩家部署完成提示的顯示秒數。 */
  deployCompletedToastSec: 1.8,
  /** 敵軍思考提示的顯示秒數。 */
  enemyThinkingToastSec: 2.0,
  /** 一般短提示秒數。 */
  shortToastSec: 1.5,
  /** 需要多讀一點內容的摘要提示秒數。 */
  summaryToastSec: 2.0,
} as const;

export const BATTLE_VISUAL_TIMING = {
  /** 部署登場縮放動畫秒數。 */
  deployAppearSec: 0.22,
  /** 一般直線移動動畫秒數。 */
  moveAdvanceSec: 2.0,
  /** 換位推進動畫的最短秒數。 */
  swapAdvanceMinSec: 2.0,
  /** 死亡消融動畫秒數。 */
  deathDissolveSec: 0.4,
  /** 死亡時 UI 文字淡出秒數。 */
  deathLabelFadeSec: 0.3,
  /** Death async API 對外回報完成的秒數。 */
  deathAwaitSec: 0.4,
  /** 一般兵攻擊後，對外回報完成的秒數。 */
  attackAwaitSec: 0.28,
  /** 騎兵衝鋒後，對外回報完成的秒數。 */
  cavalryAttackAwaitSec: 0.4,
  /** 受擊動畫對外回報完成的秒數。 */
  hitAwaitSec: 0.32,
  /** 邊界扣血時的轉圈演出秒數。 */
  boundaryDamageSpinSec: 0.48,
  /** 主將飄字對外回報完成的秒數。 */
  generalValueAwaitSec: 0.12,
  /** 一般單位飄字對外回報完成的秒數。 */
  unitValueAwaitSec: 0.24,
  /** 等待移動動畫排空時，最多等待多久（毫秒）。 */
  movementIdleMaxWaitMs: 2500,
  /** 等待移動動畫排空時，輪詢間隔（毫秒）。 */
  movementIdlePollMs: 50,
  /** 受擊 Rim Flash 持續時間（毫秒）。 */
  hitRimFlashMs: 200,
  /** 傷害數字延後跳出的時間（毫秒），讓飄字對齊撞擊點。 */
  valuePopupDelayMs: 80,
  /** 一般攻擊前衝秒數。 */
  attackBumpForwardSec: 0.08,
  /** 一般攻擊命中頓幀秒數。 */
  attackHitStopSec: 0.08,
  /** 一般攻擊回位秒數。 */
  attackRecoverSec: 0.12,
  /** 受擊開始延遲秒數，確保攻擊方先撞上來。 */
  recoilStartDelaySec: 0.08,
  /** 受擊彈退秒數。 */
  recoilPushSec: 0.06,
  /** 受擊頓幀秒數。 */
  recoilHitStopSec: 0.06,
  /** 受擊回位秒數。 */
  recoilRecoverSec: 0.12,
  /** 騎兵起跳蓄勢秒數。 */
  cavalryLiftSec: 0.11,
  /** 騎兵前衝撞擊秒數。 */
  cavalryImpactSec: 0.08,
  /** 騎兵撞擊頓幀秒數。 */
  cavalryHitStopSec: 0.08,
  /** 騎兵收勢回位秒數。 */
  cavalryRecoverSec: 0.13,
  /** 飄字時小兵抖動上升秒數。 */
  unitValueSoldierPopUpSec: 0.06,
  /** 飄字時小兵抖動回落秒數。 */
  unitValueSoldierPopDownSec: 0.1,
  /** 飄字時主物件縮放壓縮秒數。 */
  unitValueScaleInSec: 0.08,
  /** 飄字時主物件縮放回彈秒數。 */
  unitValueScaleOutSec: 0.12,
} as const;