/**
 * UIEvents.ts — UI 內部事件總線常數
 *
 * 設計原則：
 *  - 所有「子面板 → 協調器」的通訊均透過這裡定義的事件名稱，
 *    以 services().event.emit / on 傳遞，取代過去的函式指標（onCardSelect）
 *    或 node.emit 臨時字串。
 *  - 命名空間前綴「ui:」用於與戰鬥邏輯事件（EVENT_NAMES）隔離，
 *    避免全域事件名稱衝突。
 *
 * Unity 對照：UIMessageBus / MessageChannel (UGUI 常見解耦模式)
 */

/** 虎符卡片被點擊時發送，payload: { index: number; data: TallyCardData } */
export const UI_EVENT_CARD_SELECTED   = 'ui:card-selected';

/** 拖拽放開，請求部署兵種，payload: { troopType: TroopType; worldPos: Vec3 } */
export const UI_EVENT_DEPLOY_REQUEST  = 'ui:deploy-request';

/** 玩家要求結束回合，payload: void */
export const UI_EVENT_END_TURN        = 'ui:end-turn';

/** 玩家要求開啟計謀，payload: void */
export const UI_EVENT_TACTICS         = 'ui:tactics';

/** 奧義技能按鈕被點擊，payload: { skillIndex: number } */
export const UI_EVENT_ULTIMATE_SKILL  = 'ui:ultimate-skill';

/** 虎符卡片長按開始拖曳，payload: { ev: EventTouch; data: TallyCardData } */
export const UI_EVENT_CARD_DRAG_START = 'ui:card-drag-start';

/**
 * 所有 UI 事件常數的集合，方便 import 一次使用。
 *
 * @example
 * ```typescript
 * import { UI_EVENTS } from '../core/UIEvents';
 * services().event.emit(UI_EVENTS.CardSelected, { index, data });
 * services().event.on(UI_EVENTS.CardSelected, handler);
 * ```
 */
export const UI_EVENTS = {
  CardSelected:   UI_EVENT_CARD_SELECTED,
  CardDragStart:  UI_EVENT_CARD_DRAG_START,
  DeployRequest:  UI_EVENT_DEPLOY_REQUEST,
  EndTurn:        UI_EVENT_END_TURN,
  Tactics:        UI_EVENT_TACTICS,
  UltimateSkill:  UI_EVENT_ULTIMATE_SKILL,
} as const;

export type UIEventName = typeof UI_EVENTS[keyof typeof UI_EVENTS];
