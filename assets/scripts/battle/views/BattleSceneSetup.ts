// @spec-source → 見 docs/cross-reference-index.md
// [UCUF M9] 從 BattleScene.ts 提取的場景設置函數。
// 所有函數僅依賴傳入的 Cocos Node 參數，不持有 BattleScene 實例引用。
// Unity 對照：BattleCameraSetup + BattleSceneInitializer 靜態工具類別

import { Camera, Layers, Node, UITransform, Sprite, Button, Label, Color } from "cc";
import { UCUFLogger, LogCategory } from '../../ui/core/UCUFLogger';
import { BattleTactic, TroopType } from "../../core/config/Constants";
import { SceneBackground } from "./SceneBackground";
import type { DeployRuntimeApi } from "../../ui/components/DeployRuntimeApi";
import { resolveBattleSceneBackgroundId } from "../shared/BattleSceneMode";

// ─── 兵種名稱 ───────────────────────────────────────────────────────────────

/**
 * 將 TroopType enum 轉換為繁體中文兵種名稱。
 * Unity 對照：TroopNameResolver.Resolve(type)
 */
export function troopName(type: TroopType): string {
  if (type === TroopType.Cavalry)  return "騎兵";
  if (type === TroopType.Infantry) return "步兵";
  if (type === TroopType.Shield)   return "盾兵";
  if (type === TroopType.Archer)   return "弓兵";
  if (type === TroopType.Pikeman)  return "長槍兵";
  if (type === TroopType.Engineer) return "工兵";
  if (type === TroopType.Medic)    return "醫護兵";
  return "水軍";
}

// ─── 相機設置 ───────────────────────────────────────────────────────────────

/**
 * 為 3D 棋盤尋找或建立 Main Camera，並配置為 DEPTH_ONLY + PERSPECTIVE。
 * 同時將 Canvas 下的 UI Camera 設為 DEPTH_ONLY，讓 3D 底層正常透出。
 *
 * Unity 對照：BattleCameraSetup.ConfigureMainCamera()
 *
 * @param sceneRoot  `this.node.scene!` — 場景根節點
 * @param canvas     `this.getCanvasNode()` — Canvas 節點（可為 null）
 */
export function setupCameraForBoard(sceneRoot: Node, canvas: Node | null): void {
  // ── 尋找場景中預設的 Main Camera 來作為 3D 棋盤攝影機 ──────────────
  // 對照 Unity：直接調整預設的 Main Camera，不要再額外建新的 Camera 避免重複。
  let cam3dNode = sceneRoot.getChildByName("Main Camera");
  if (!cam3dNode) {
    UCUFLogger.warn(LogCategory.LIFECYCLE, '[BattleSceneSetup] 找不到 Main Camera，將回退建立新的 Camera');
    cam3dNode = new Node("Main Camera");
    sceneRoot.addChild(cam3dNode);
  }

  // 確保它在 DEFAULT layer
  cam3dNode.layer = Layers.Enum.DEFAULT;

  const cam = cam3dNode.getComponent(Camera) ?? cam3dNode.addComponent(Camera);

  // 透視投影，固定使用對齊示意圖後的相機參數
  cam.projection = Camera.ProjectionType.PERSPECTIVE;
  cam.fov        = 30;
  cam.near       = 0.5;
  cam.far        = 500;

  // 只渲染 DEFAULT layer 的節點（包含場景與棋盤 MeshRenderer）；
  // UI 會由 Canvas 下的 UI Camera 負責。
  cam.visibility     = Layers.Enum.DEFAULT;
  cam.targetTexture  = null;

  // DEPTH_ONLY：只清深度緩衝，讓 BGCamera（priority=-1）所畫的背景底圖透出來。
  // 對照 Unity：Main Camera ClearFlags = Depth only（背景已由 Background Camera 負責）。
  cam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;

  // ── 讓 Canvas 相機改用 DEPTH_ONLY，才能讓 3D 底層透出來 ──────────────
  if (canvas) {
    const uiCamNode = canvas.getChildByName("Camera");
    const uiCam = uiCamNode
      ? uiCamNode.getComponent(Camera)
      : canvas.getComponentInChildren(Camera);
    if (uiCam) {
      uiCam.clearFlags     = Camera.ClearFlag.DEPTH_ONLY;
      uiCam.targetTexture  = null;
    }
  }

  UCUFLogger.debug(LogCategory.LIFECYCLE,
    `[BattleSceneSetup] Main Camera 目前參數` +
    ` pos=(${cam3dNode.position.x.toFixed(3)}, ${cam3dNode.position.y.toFixed(3)}, ${cam3dNode.position.z.toFixed(3)})` +
    ` rot=(${cam3dNode.eulerAngles.x.toFixed(3)}, ${cam3dNode.eulerAngles.y.toFixed(3)}, ${cam3dNode.eulerAngles.z.toFixed(3)})` +
    ` fov=${cam.fov}°`,
  );
}

// ─── 場景背景 ───────────────────────────────────────────────────────────────

/**
 * 在場景根節點下建立或取得 SceneBackground 元件，並載入指定背景。
 * 回傳建立的元件，由呼叫端存入 `this.sceneBackground`。
 *
 * Unity 對照：SceneBackgroundManager.Initialize(backgroundId)
 *
 * @param sceneRoot    `this.node.scene!` — 場景根節點
 * @param backgroundId 來自 encounters.json 或 fallback 值
 */
export async function initSceneBackground(
  sceneRoot: Node,
  backgroundId: string,
): Promise<SceneBackground | null> {
  let bgNode = sceneRoot.getChildByName("SceneBackground");
  if (!bgNode) {
    bgNode = new Node("SceneBackground");
    sceneRoot.addChild(bgNode);
  }

  const bg = bgNode.getComponent(SceneBackground) ?? bgNode.addComponent(SceneBackground);
  await bg.loadBackground(backgroundId);
  return bg;
}

/**
 * 解析戰場背景底圖。
 * - 明確傳入的 backgroundId 優先。
 * - 水淹戰法優先切換為水域底圖。
 * - 夜襲 / 伏兵類戰法沒有指定背景時，預設切換為夜景底圖。
 * - 其餘情況回退為一般白天底圖。
 */
export function resolveSceneBackgroundId(
  explicitBackgroundId: string | null | undefined,
  encounterBackgroundId: string | null | undefined,
  battleTactic: BattleTactic,
): string {
  return resolveBattleSceneBackgroundId(explicitBackgroundId, encounterBackgroundId, battleTactic);
}

// ─── Debug UI：背景切換按鈕 ─────────────────────────────────────────────────

/**
 * 在 Canvas 下動態建立一個 Debug 用的背景切換按鈕（僅於非 Capture 模式下啟用）。
 *
 * Unity 對照：BattleSceneDebugUI.AddBackgroundSwitchButton()
 *
 * @param canvas          `getCanvasNode()` — Canvas 節點（可為 null，無 Canvas 則跳過）
 * @param sceneBackground  目前的 SceneBackground 元件（可為 null）
 * @param deployRuntime    目前的 deploy runtime，用於顯示 toast（可為 null）
 */
export function addBackgroundSwitchUI(
  canvas: Node | null,
  sceneBackground: SceneBackground | null,
  deployRuntime: DeployRuntimeApi | null,
): void {
  if (!canvas) return;

  let debugRoot = canvas.getChildByName("DebugUI");
  if (!debugRoot) {
    debugRoot = new Node("DebugUI");
    debugRoot.layer = Layers.Enum.UI_2D;
    canvas.addChild(debugRoot);
  }

  const btnNode = new Node("BtnSwitchBG");
  btnNode.layer = Layers.Enum.UI_2D;
  debugRoot.addChild(btnNode);
  btnNode.setPosition(800, 480, 0); // 右上角

  const tf = btnNode.addComponent(UITransform);
  tf.setContentSize(160, 50);

  const sprite = btnNode.addComponent(Sprite);
  sprite.type = Sprite.Type.SIMPLE;
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.color = new Color(40, 40, 40, 200);

  const labelNode = new Node("Label");
  labelNode.layer = Layers.Enum.UI_2D;
  btnNode.addChild(labelNode);
  const lbl = labelNode.addComponent(Label);
  lbl.string = "切換背景";
  lbl.fontSize = 20;

  const btn = btnNode.addComponent(Button);
  let isNight = false;
  btn.node.on(Button.EventType.CLICK, () => {
    isNight = !isNight;
    const bgId = isNight ? "bg_normal_night" : "bg_normal_day";
    sceneBackground?.loadBackground(bgId).then(() => {
      deployRuntime?.showToast(`背景已切換為：${isNight ? "夜晚" : "白天"}`);
    });
  });
}
