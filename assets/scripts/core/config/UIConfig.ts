/**
 * UIConfig.ts — UI 分層配置表
 *
 * 定義 UIID（UI 頁面唯一識別）、LayerType（層級語義）與 UIConfigEntry（資料驅動設定）。
 *
 * 架構對照 Unity：類似 Canvas Sort Order 分層，但每層有明確的行為語義：
 *  - Game   ↔ World Space Canvas（棋盤 HUD，常時顯示）
 *  - UI     ↔ Screen Space Overlay，全螢幕替換式主頁面
 *  - PopUp  ↔ 可堆疊的半遮蔽彈窗（例：道具詳情）
 *  - Dialog ↔ 帶遮罩的序列式對話框（一次一個，後者排隊等候）
 *  - System ↔ 最高優先系統通知（網路斷線、強制更新）
 *  - Notify ↔ Toast / Loading 指示器（短暫，自動消失）
 *
 * 參考來源：dgflash/oops-framework LayerManager 設計（M-1）
 */

// ─── UI 頁面唯一識別碼 ───────────────────────────────────────────────────────
export enum UIID {
    /** 戰鬥 HUD 主層（血量、SP 條、回合顯示） */
    BattleHUD = "BattleHUD",
    /** 部署面板 */
    DeployPanel = "DeployPanel",
    /** 戰鬥紀錄面板 */
    BattleLogPanel = "BattleLogPanel",
    /** 戰局結算彈窗 */
    ResultPopup = "ResultPopup",
    /** Toast 通知訊息 */
    Toast = "Toast",
    /** 系統級警示視窗 */
    SystemAlert = "SystemAlert",
}

// ─── 層級類型（決定開關行為語義） ────────────────────────────────────────────
export enum LayerType {
    /** 遊戲世界層：棋盤 UI，可多個同時顯示，簡單 show/hide */
    Game = "Game",
    /** 主頁面層：替換式，同時只有一個頁面可見 */
    UI = "UI",
    /** 彈窗層：堆疊式，可多個共存，按堆疊順序管理 */
    PopUp = "PopUp",
    /** 對話框層：佇列式，一次一個，含遮罩，其餘排隊 */
    Dialog = "Dialog",
    /** 系統層：最高優先，立即覆蓋顯示 */
    System = "System",
    /** 通知層：Toast / Loading 指示器 */
    Notify = "Notify",
}

// ─── 單一 UI 的設定結構 ───────────────────────────────────────────────────────
export interface UIConfigEntry {
    /** UI 所在的層級（決定 open/close 行為） */
    layer: LayerType;
    /**
     * 選填：Prefab 相對路徑（供未來 ResourceManager 動態載入使用，M-2 實作）
     * 目前版本使用 register() 手動綁定場景節點
     */
    prefab?: string;
    /** 選填：Asset Bundle 名稱（供未來動態載入使用） */
    bundle?: string;
    /** 是否在開啟時顯示半透明遮罩（適用 Dialog / System 層） */
    mask?: boolean;
    /** 是否在關閉時快取節點不 destroy（M-2 UI 快取機制） */
    cache?: boolean;
}

// ─── UI 設定表（資料驅動）────────────────────────────────────────────────────
export const UIConfig: Record<UIID, UIConfigEntry> = {
    [UIID.BattleHUD]:      { layer: LayerType.Game },
    [UIID.DeployPanel]:    { layer: LayerType.Game },
    [UIID.BattleLogPanel]: { layer: LayerType.Game },
    [UIID.ResultPopup]:    { layer: LayerType.Dialog, mask: true, cache: true },
    [UIID.Toast]:          { layer: LayerType.Notify },
    [UIID.SystemAlert]:    { layer: LayerType.System, mask: true },
};
