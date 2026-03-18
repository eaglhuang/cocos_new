# 戰鬥場景自動生成器

## 安裝步驟

### 1. 編譯擴展（在擴展目錄執行）
```powershell
cd extensions/battle-scene-builder
tsc
```

### 2. 在 Cocos Creator 中啟用擴展
1. 打開 Cocos Creator 3.8
2. 選單：`擴展 → 擴展管理器`
3. 點擊「項目」標籤
4. 找到 `battle-scene-builder`，點擊「啟用」

### 3. 使用工具生成場景
1. 打開 `assets/demo.scene`
2. 在層級管理器中選中 `Canvas` 節點
3. 選單：`開發者 → 擴展 → Battle Scene Builder → 生成戰鬥場景`
4. 等待控制台顯示「✅ 戰鬥場景生成完成！」

## 生成後的節點結構

```
Canvas
├─ BattleScene      (需手動添加 BattleScene 元件)
│   └─ (空節點，用於掛載控制器)
│
├─ HUD              (需手動添加 BattleHUD 元件)
│   ├─ TurnLabel
│   ├─ DpLabel
│   ├─ PlayerSpBar
│   ├─ PlayerSpLabel
│   ├─ PlayerFortressBar
│   ├─ PlayerFortressLabel
│   ├─ EnemyFortressBar
│   ├─ EnemyFortressLabel
│   └─ StatusLabel
│
├─ Panel            (需手動添加 DeployPanel 元件)
│   ├─ BtnCavalry
│   ├─ BtnInfantry
│   ├─ BtnShield
│   ├─ BtnArcher
│   ├─ BtnSkill
│   ├─ BtnEndTurn
│   ├─ LaneButton1-5 (x5)
│   └─ SelectionLabel
│
└─ Popup            (需手動添加 ResultPopup 元件)
    ├─ Background
    ├─ TitleLabel
    ├─ DescLabel
    └─ BtnReplay
```

## 手動綁定步驟（必須完成）

### A. BattleScene 節點
1. 選中 `BattleScene` 節點
2. Inspector → Add Component → Custom Script → `BattleScene`
3. 綁定三個引用：
   - `hud` → 拖入 HUD 節點
   - `deployPanel` → 拖入 Panel 節點
   - `resultPopup` → 拖入 Popup 節點
   - `gridDebugLabel`（可選）→ 可創建一個空的 Label 用於調試

### B. HUD 節點
1. 選中 `HUD` 節點
2. Add Component → Custom Script → `BattleHUD`
3. 將所有子節點拖入對應屬性欄位：
   - `turnLabel` → TurnLabel
   - `dpLabel` → DpLabel
   - `playerSpBar` → PlayerSpBar
   - `playerSpLabel` → PlayerSpLabel
   - `playerFortressBar` → PlayerFortressBar
   - `playerFortressLabel` → PlayerFortressLabel
   - `enemyFortressBar` → EnemyFortressBar
   - `enemyFortressLabel` → EnemyFortressLabel
   - `statusLabel` → StatusLabel

### C. Panel 節點
1. 選中 `Panel` 節點
2. Add Component → Custom Script → `DeployPanel`
3. 綁定：
   - `btnCavalry` → BtnCavalry
   - `btnInfantry` → BtnInfantry
   - `btnShield` → BtnShield
   - `btnArcher` → BtnArcher
   - `btnSkill` → BtnSkill
   - `btnEndTurn` → BtnEndTurn
   - `laneButtons` → 展開數組，Size = 5，拖入 LaneButton1-5
   - `selectionLabel` → SelectionLabel

### D. Popup 節點
1. 選中 `Popup` 節點
2. Add Component → Custom Script → `ResultPopup`
3. 綁定：
   - `titleLabel` → TitleLabel
   - `descLabel` → DescLabel
   - `btnReplay` → BtnReplay
4. **確認 Popup 節點的 Active 取消勾選**（預設隱藏）

## 運行測試

1. 保存場景（Ctrl+S）
2. 點擊播放按鈕（或 Ctrl+P）
3. 應該會看到：
   - 左上角顯示回合數和 DP
   - 底部顯示部署按鈕
   - 點擊「結束回合」觸發戰鬥流程
   - 控制台應該會輸出戰鬥日誌

## 故障排除

### 問題：擴展無法載入
- 確認 `tsc` 成功編譯出 `dist/main.js`
- 檢查控制台是否有錯誤訊息
- 重啟 Cocos Creator 編輯器

### 問題：找不到擴展選單
- Cocos Creator 3.8 的擴展選單可能在：
  - `擴展 → Battle Scene Builder` 或
  - `開發者 → Battle Scene Builder`
- 若都沒有，嘗試在擴展管理器中卸載後重新啟用

### 問題：節點已存在
- 如果已經有同名節點，腳本會跳過創建
- 可以手動刪除舊節點後重新執行

### 問題：運行時報錯「找不到元件」
- 確認每個節點都已正確添加對應的 TypeScript 元件
- 確認所有屬性都已綁定到子節點
- 檢查 Inspector 中是否有紅色警告圖標（Missing Script）

## 簡化方案（如果擴展無法運行）

如果編輯器擴展有問題，可以使用**運行時初始化**方案：

1. 創建一個簡單的初始化腳本掛載到 Canvas
2. 遊戲啟動時自動創建所有節點
3. 缺點：不會保存到場景文件，每次運行都重新創建

需要這個備用方案嗎？
