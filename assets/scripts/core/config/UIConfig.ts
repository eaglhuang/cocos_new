// @spec-source → 見 docs/cross-reference-index.md
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
    // ── 戰鬥場景 UI（LayerType.Game） ────────────────────────────────────────
    /** 戰鬥 HUD 主層（血量、SP 條、回合顯示） */
    BattleHUD = "BattleHUD",
    /** 部署面板 */
    DeployPanel = "DeployPanel",
    /** 戰鬥紀錄面板 */
    BattleLogPanel = "BattleLogPanel",
    /** 虎符面板（武將選擇確認） */
    TigerTallyPanel = "TigerTallyPanel",
    /** 行動指令面板（出兵/撤退/技能按鈕組） */
    ActionCommandPanel = "ActionCommandPanel",

    // ── 主頁面層（LayerType.UI）── 替換式，同時只有一個可見 ──────────────────
    /** 大廳主頁面 */
    LobbyMain = "LobbyMain",
    /** 商城主頁面 */
    ShopMain = "ShopMain",
    /** 抽卡主頁面（籌碼選擇、活動資訊） */
    GachaMain = "GachaMain",
    /** 抽卡演出畫面 */
    Gacha = "Gacha",
    /** 武將列表頁面 */
    GeneralList = "GeneralList",
    /** 血脈命鏡覺醒動畫頁面 */
    BloodlineMirrorAwakening = "BloodlineMirrorAwakening",

    // ── 彈窗層（LayerType.PopUp）── 堆疊式 ───────────────────────────────────
    /** 武將詳情彈窗（基本資訊、技能、裝備） */
    GeneralDetail = "GeneralDetail",
    /** 武將詳情 v3 血脈版本彈窗 */
    GeneralDetailBloodline = "GeneralDetailBloodline",
    /** 武將立繪全屏彈窗 */
    GeneralPortrait = "GeneralPortrait",
    /** 武將快速預覽小卡彈窗 */
    GeneralQuickView = "GeneralQuickView",
    /** 兵種資訊面板彈窗 */
    UnitInfoPanel = "UnitInfoPanel",
    /** 虎符詳情抽屜（戰場右側） */
    TigerTallyDetailPanel = "TigerTallyDetailPanel",
    /** 援助武將詳情彈窗 */
    SupportCard = "SupportCard",
    /** 靈符詳情彈窗 */
    SpiritTallyDetail = "SpiritTallyDetail",
    /** 精英兵種圖鑑彈窗 */
    EliteTroopCodex = "EliteTroopCodex",

    // ── 對話框層（LayerType.Dialog）── 佇列式、帶遮罩 ────────────────────────
    /** 對決挑戰確認對話框 */
    DuelChallenge = "DuelChallenge",
    /** 戰局結算彈窗 */
    ResultPopup = "ResultPopup",

    // ── 系統層（LayerType.System）── 最高優先 ────────────────────────────────
    /** 系統級警示視窗 */
    SystemAlert = "SystemAlert",
    /** 網路連線狀態提示（斷線 / 重連中） */
    NetworkStatus = "NetworkStatus",
    /** 血脈命鏡載入過場 */
    BloodlineMirrorLoading = "BloodlineMirrorLoading",

    // ── 通知層（LayerType.Notify）── Toast / Loading 指示器 ──────────────────
    /** Toast 通知訊息 */
    Toast = "Toast",
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
    // ── 戰鬥場景 UI（Game 層） ────────────────────────────────────────────────
    [UIID.BattleHUD]:          { layer: LayerType.Game },
    [UIID.DeployPanel]:        { layer: LayerType.Game },
    [UIID.BattleLogPanel]:     { layer: LayerType.Game },
    [UIID.TigerTallyPanel]:    { layer: LayerType.Game,   prefab: "ui/tiger-tally" },
    [UIID.ActionCommandPanel]: { layer: LayerType.Game,   prefab: "ui/action-command" },

    // ── 主頁面層（UI 層） ─────────────────────────────────────────────────────
    [UIID.LobbyMain]:                  { layer: LayerType.UI, prefab: "ui/lobby-main" },
    [UIID.ShopMain]:                   { layer: LayerType.UI, prefab: "ui/shop-main" },
    [UIID.GachaMain]:                  { layer: LayerType.UI, prefab: "ui/gacha-main" },
    [UIID.Gacha]:                      { layer: LayerType.UI, prefab: "ui/gacha" },
    [UIID.GeneralList]:                { layer: LayerType.UI, prefab: "ui/general-list" },
    [UIID.BloodlineMirrorAwakening]:   { layer: LayerType.UI, prefab: "ui/bloodline-mirror-awakening" },

    // ── 彈窗層（PopUp 層） ────────────────────────────────────────────────────
    [UIID.GeneralDetail]:          { layer: LayerType.PopUp, prefab: "ui/general-detail" },
    [UIID.GeneralDetailBloodline]: { layer: LayerType.PopUp, prefab: "ui/general-detail-bloodline" },
    [UIID.GeneralPortrait]:        { layer: LayerType.PopUp, prefab: "ui/general-portrait" },
    [UIID.GeneralQuickView]:       { layer: LayerType.PopUp, prefab: "ui/general-quickview" },
    [UIID.UnitInfoPanel]:          { layer: LayerType.PopUp, prefab: "ui/unit-info-panel" },
    [UIID.TigerTallyDetailPanel]:  { layer: LayerType.PopUp, prefab: "ui/tiger-tally-detail-panel" },
    [UIID.SupportCard]:            { layer: LayerType.PopUp, prefab: "ui/support-card" },
    [UIID.SpiritTallyDetail]:      { layer: LayerType.PopUp, prefab: "ui/spirit-tally-detail" },
    [UIID.EliteTroopCodex]:        { layer: LayerType.PopUp, prefab: "ui/elite-troop-codex" },

    // ── 對話框層（Dialog 層） ─────────────────────────────────────────────────
    [UIID.DuelChallenge]: { layer: LayerType.Dialog, mask: true, prefab: "ui/duel-challenge" },
    [UIID.ResultPopup]:   { layer: LayerType.Dialog, mask: true, cache: true },

    // ── 系統層（System 層） ───────────────────────────────────────────────────
    [UIID.SystemAlert]:            { layer: LayerType.System, mask: true },
    [UIID.NetworkStatus]:          { layer: LayerType.System, prefab: "ui/network-status" },
    [UIID.BloodlineMirrorLoading]: { layer: LayerType.System, prefab: "ui/bloodline-mirror-loading" },

    // ── 通知層（Notify 層） ───────────────────────────────────────────────────
    [UIID.Toast]: { layer: LayerType.Notify },
};
