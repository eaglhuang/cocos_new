/**
 * BattleUIInitializer.ts — 戰鬥 UI 元件自動建立輔助函式
 *
 * [Phase-2] 從 BattleScene.ts 抽取的 ensure* 方法群。
 * 每個函式接受「現有值 + 場景/節點參數」，回傳建立後的元件（或 null）。
 * 呼叫端負責把回傳值寫回對應的 @property 欄位。
 *
 * Unity 對照：LevelUIBootstrap / UIAutoBinder（自動根據命名慣例找 Inspector 未綁定的元件）
 */

import { Node, Camera } from 'cc';
import { BattleHUDComposite } from '../../ui/components/BattleHUDComposite';
import { DeployComposite } from '../../ui/components/DeployComposite';
import type { DeployRuntimeApi } from '../../ui/components/DeployRuntimeApi';
import { ResultPopupComposite } from '../../ui/components/ResultPopupComposite';
import { BattleLogComposite } from '../../ui/components/BattleLogComposite';
import { BattleScenePanel } from '../../ui/components/BattleScenePanel';
import { BoardRenderer } from './BoardRenderer';
import { UnitRenderer } from './UnitRenderer';
import { GAME_CONFIG } from '../../core/config/Constants';
import { UCUFLogger, LogCategory } from '../../ui/core/UCUFLogger';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 統一 Deploy runtime：BattleScene 必須掛到新版 DeployComposite，缺失時直接 fail-fast。
 */
export async function ensureDeployPanelRuntime(
  deployHost: Node | null,
): Promise<DeployRuntimeApi> {
  if (!deployHost) {
    throw new Error('[BattleScene] ensureDeployPanelRuntime: BattleScene.deployHost 未綁定；必須指向掛有 DeployComposite 的 DeployPanelHost 節點');
  }

  const composite = deployHost.getComponent(DeployComposite);
  if (!composite) {
    throw new Error(`[BattleScene] ensureDeployPanelRuntime: ${deployHost.name} 缺少 DeployComposite；這是場景配置錯誤，不允許退回 legacy DeployPanel`);
  }

  await composite.mount();
  UCUFLogger.info(LogCategory.LIFECYCLE, '[BattleScene] ensureDeployPanelRuntime: 採用 DeployComposite');
  return composite;
}

/**
 * Inspector 未綁定時，驗證 HUD 和 ResultPopup host 是否存在且已掛好必要 composite。
 *
 * HUD / Popup 視為乾淨 host：執行期只要求容器節點存在，
 * 其底下內容由 BattleHUDComposite / ResultPopupComposite 自行建構。
 */
export function ensureHUD(
  existingHUD: BattleHUDComposite | null,
  existingResultPopup: ResultPopupComposite | null,
  canvas: Node | null,
): { hud: BattleHUDComposite | null; resultPopup: ResultPopupComposite | null } {
  let hud = existingHUD;
  let resultPopup = existingResultPopup;

  if (!hud) {
    const hudNode = canvas?.getChildByName("HUD");
    if (!hudNode) {
      throw new Error('[BattleScene] ensureHUD: 找不到 Canvas/HUD 節點；BattleScene.scene 必須提供靜態 HUD host');
    }

    const legacyHUD = hudNode.getComponent('BattleHUD');
    if (legacyHUD) {
      throw new Error('[BattleScene] ensureHUD: Canvas/HUD 仍掛 legacy BattleHUD；請改為 BattleHUDComposite');
    }

    hud = hudNode.getComponent(BattleHUDComposite);
    if (!hud) {
      throw new Error('[BattleScene] ensureHUD: Canvas/HUD 缺少 BattleHUDComposite；不允許執行期自動補件');
    }

    UCUFLogger.info(LogCategory.LIFECYCLE, '[BattleScene] ensureHUD: 採用既有 BattleHUDComposite');
  }

  if (!resultPopup) {
    const popupNode = canvas?.getChildByName("Popup");
    if (!popupNode) {
      throw new Error('[BattleScene] ensureHUD: 找不到 Canvas/Popup 節點；BattleScene.scene 必須提供靜態 Popup host');
    }

    const legacyPopup = popupNode.getComponent('ResultPopup');
    if (legacyPopup) {
      throw new Error('[BattleScene] ensureHUD: Canvas/Popup 仍掛 legacy ResultPopup；請改為 ResultPopupComposite');
    }

    resultPopup = popupNode.getComponent(ResultPopupComposite);
    if (!resultPopup) {
      throw new Error('[BattleScene] ensureHUD: Canvas/Popup 缺少 ResultPopupComposite；不允許執行期自動補件');
    }

    UCUFLogger.info(LogCategory.LIFECYCLE, '[BattleScene] ensureHUD: 採用既有 ResultPopupComposite');
  }

  return { hud, resultPopup };
}

/**
 * Inspector 未綁定時，在 Canvas 下尋找或建立 BattleLogPanel 節點。
 *
 * [UI-2-0023] host 必須在 addComponent 前設定正確 Canvas 尺寸，且 Widget 拉滿 Canvas，
 * 避免子面板 Widget.updateAlignment() 以錯誤父尺寸計算導致節點跑出螢幕外。
 */
export function ensureBattleLogPanel(
  existing: BattleLogComposite | null,
  canvas: Node | null,
): BattleLogComposite | null {
  if (existing) return existing;
  if (!canvas) {
    throw new Error('[BattleScene] ensureBattleLogPanel: 找不到 Canvas 節點；BattleScene.scene 必須提供靜態 BattleLogPanel host');
  }

  const node = canvas.getChildByName('BattleLogPanel');
  if (!node) {
    throw new Error('[BattleScene] ensureBattleLogPanel: 找不到 Canvas/BattleLogPanel 節點；BattleScene.scene 必須提供靜態 BattleLogPanel host');
  }

  const panel = node.getComponent(BattleLogComposite);
  if (!panel) {
    throw new Error('[BattleScene] ensureBattleLogPanel: Canvas/BattleLogPanel 缺少 BattleLogComposite；不允許執行期自動補件');
  }

  return panel;
}

/**
 * Inspector 未綁定時，在 Canvas 根節點下尋找或新建 BattleScenePanel 節點。
 * BattleScenePanel 是新版 UI 總調度器，串聯 TigerTallyPanel、ActionCommandPanel、UnitInfoPanel。
 */
export function ensureBattleScenePanel(
  existing: BattleScenePanel | null,
  canvas: Node | null,
): BattleScenePanel | null {
  if (existing) return existing;
  if (!canvas) {
    throw new Error('[BattleScene] ensureBattleScenePanel: 找不到 Canvas 節點；BattleScene.scene 必須提供靜態 BattleScenePanel host');
  }

  const node = canvas.getChildByName('BattleScenePanel');
  if (!node) {
    throw new Error('[BattleScene] ensureBattleScenePanel: 找不到 Canvas/BattleScenePanel 節點；BattleScene.scene 必須提供靜態 BattleScenePanel host');
  }

  const panel = node.getComponent(BattleScenePanel);
  if (!panel) {
    throw new Error('[BattleScene] ensureBattleScenePanel: Canvas/BattleScenePanel 缺少 BattleScenePanel component；不允許執行期自動補件');
  }

  UCUFLogger.info(LogCategory.LIFECYCLE, '[BattleScene] ensureBattleScenePanel: BattleScenePanel 已就緒');
  return panel;
}

/** 將棋盤放在場景最外層，與邏輯棋盤同步格數與間距。 */
export function ensureBoardRenderer(
  existing: BoardRenderer | null,
  scene: any,
  boardGapRatio: number,
  boardTargetDepth: number,
): BoardRenderer | null {
  let br = existing;
  if (!br) {
    let node: Node | null = scene?.getChildByName("BoardRenderer") ?? null;
    if (!node) {
      node = new Node("BoardRenderer");
      scene?.addChild(node);
    }
    br = node!.getComponent(BoardRenderer) ?? node!.addComponent(BoardRenderer);
  }

  if (br) {
    br.cols = GAME_CONFIG.GRID_LANES;
    br.rows = GAME_CONFIG.GRID_DEPTH;
    const totalCellFactor = br.rows + Math.max(0, br.rows - 1) * boardGapRatio;
    br.cellSize = boardTargetDepth / totalCellFactor;
    br.cellGap = br.cellSize * boardGapRatio;
    br.rebuildBoard();
  }

  return br;
}

/** 建立或初始化 UnitRenderer，注入 boardRenderer / camera / canvas 依賴。 */
export function ensureUnitRenderer(
  existing: UnitRenderer | null,
  scene: any,
  boardRenderer: BoardRenderer | null,
  camera: Camera | null,
  canvas: Node | null,
): UnitRenderer | null {
  let ur = existing;
  if (!ur) {
    let node: Node | null = scene?.getChildByName("UnitRenderer") ?? null;
    if (!node) {
      node = new Node("UnitRenderer");
      scene?.addChild(node);
    }
    ur = node!.getComponent(UnitRenderer) ?? node!.addComponent(UnitRenderer);
  }

  ur?.initialize(boardRenderer, camera, canvas);
  return ur;
}
