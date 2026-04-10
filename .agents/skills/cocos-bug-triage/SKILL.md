---
name: cocos-bug-triage
description: 'COMPLETE BUG INVESTIGATION WORKFLOW — Combines screenshot + log reading into a full triage pipeline. USE FOR: any bug report that has both visual symptoms AND runtime errors. This is the master debugging workflow that orchestrates cocos-screenshot and cocos-log-reader together. Load this skill when user reports any battle scene / UI crash / abnormal behavior with both visual and runtime aspects.'
argument-hint: 'Describe the bug symptom briefly. The skill will guide screenshot → log → root cause → fix.'
---

# Cocos Bug Triage（完整 Bug 調查工作流）

## 概觀

這是本專案的**標準 Bug 處理 SOP**，整合截圖與 log 分析，代替使用者手動收集證據。

Unity 對照：就像 Unity 的 Console Window + Game View 同時看 — 截圖看畫面，log 看堆疊。

---

## 完整流程（必須按順序執行）

```
Phase 1: 視覺確認（cocos-screenshot）
    ↓
Phase 2: Log 分析（cocos-log-reader）
    ↓
Phase 3: 根源定位（程式碼）
    ↓
Phase 4: 修復與驗證
```

---

## Phase 1 — 視覺確認

### Step 1.1：截圖（PrintWindow 指定視窗，不受前台遮擋影響）

```powershell
Add-Type @"
using System; using System.Collections.Generic; using System.Drawing;
using System.Drawing.Imaging; using System.Runtime.InteropServices; using System.Text;
public class WinEnum {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    public static IntPtr FindByTitle(string keyword) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, _) => {
            if (!IsWindowVisible(hWnd)) return true;
            var sb = new StringBuilder(256); GetWindowText(hWnd, sb, 256);
            if (sb.ToString().IndexOf(keyword, StringComparison.OrdinalIgnoreCase) >= 0) { found = hWnd; return false; }
            return true;
        }, IntPtr.Zero); return found;
    }
    public static bool Snap(IntPtr hWnd, string path) {
        RECT r; GetWindowRect(hWnd, out r);
        int w = r.Right - r.Left, h = r.Bottom - r.Top;
        if (w <= 0 || h <= 0) return false;
        using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp)) {
            IntPtr hdc = g.GetHdc(); bool ok = PrintWindow(hWnd, hdc, 2); g.ReleaseHdc(hdc);
            if (!ok) return false; bmp.Save(path, ImageFormat.Png); return true;
        }
    }
}
"@ -ReferencedAssemblies System.Drawing
$hwnd = [WinEnum]::FindByTitle("Cocos Creator")
if ($hwnd -eq [IntPtr]::Zero) { Write-Error "找不到 Cocos Creator 視窗"; return }
$out = "c:\Users\User\3KLife\temp\cocos-screenshot.png"
$ok = [WinEnum]::Snap($hwnd, $out)
if ($ok) { Write-Host "截圖完成: $out ($([int]((Get-Item $out).Length/1KB)) KB)" } else { Write-Error "PrintWindow 失敗" }
```

> **提示**：若 `WinEnum` 已在同一 PowerShell session 載入，直接從 `$hwnd = ...` 開始即可。

### Step 1.2：縮圖採 thumbnail-first progressive zoom（硬規定，在 `view_image` 前必須執行）

```powershell
$imgPath = "c:\Users\User\3KLife\temp\cocos-screenshot.png"
node tools_node/prepare-view-image.js --input $imgPath
# 若 125px 不足，再依序改跑：
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 250
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 500
```

> ⚠️ 先試 `125px`，足夠就停止；只有在前一級不足時才可放大。需要看 `>500px` 原圖時，必須先取得使用者明確同意。

### Step 1.3：用 `view_image` 讀取截圖

```
filePath: c:\Users\User\3KLife\temp\cocos-screenshot.png
```

### Step 1.4：從截圖提取線索

填寫以下排查表（內部分析用）：

| 項目 | 觀察到的內容 |
|------|------------|
| Cocos 錯誤對話框 | 有 / 無，錯誤訊息文字 |
| 受影響的 UI 區域 | 例：HUD 右上角、TigerTallyPanel |
| 視覺症狀類型 | 例：節點位移 / label 顯示 key / 空白方塊 |
| 其他異常 | 例：3D 模型消失 / 顏色錯誤 |

---

## Phase 2 — Log 分析

### Step 2.1：快速掃 error/warn/log

```powershell
$log = Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Tail 300 -Encoding UTF8

Write-Host "=== ERROR ===" -ForegroundColor Red
$log | Where-Object { $_ -match "^\d{4}" -and $_ -match " - error:" } | Select-Object -Last 20

Write-Host "=== WARN ===" -ForegroundColor Yellow  
$log | Where-Object { $_ -match "^\d{4}" -and $_ -match " - warn:" } | Select-Object -Last 10

Write-Host "=== LOG（最後執行到哪）===" -ForegroundColor Cyan
$log | Where-Object { $_ -match "^\d{4}" -and $_ -match " - log:" } | Select-Object -Last 10
```

### Step 2.2：根據截圖線索過濾特定組件

範例（替換為實際組件名）：
```powershell
Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Tail 400 -Encoding UTF8 |
  Where-Object { $_ -match "BattleHUD|BattleScene|TigerTally|UIPreviewBuilder" } |
  Select-Object -Last 50
```

### Step 2.3：讀 stack trace

從 log 的 `error:` 行開始，找到完整 stack trace：
- 每一行的格式：`at ClassName.method (file:///...OriginalFile.ts:LINE:COL)`
- **根源 = stack trace 最底部那一行**（第一個出現的 `at`）
- 忽略 `packer-driver/chunks/XX/` 這段路徑，直接看後面的 `OriginalFile.ts:LINE`

---

## Phase 3 — 根源定位

### 常見錯誤模式對照表

| 截圖症狀 | Log 關鍵字 | 根源 | 修復方向 |
|---------|-----------|------|----------|
| Error 對話框 "Cannot read properties of null (reading 'root')" | `TypeError: Cannot read` | JSON 載入失敗 / node 已 destroy | 加 null guard；確認 JSON 路徑 |
| label 顯示變數名（如 "label", "TurnLabel"） | `has no textKey/text/bind` | layout JSON 缺 `textKey` | 補 layout JSON 欄位 |
| UI 顯示在 3D 空間中 | 無特定 log | 節點 Layer 錯誤 | 設定 node.layer = UI_2D |
| buildScreen 完成但畫面空白 | `buildScreen 完成 root.children=0` | root 節點無子節點 | 檢查 layout JSON 的 `children` |
| ProgressBar 不更新 | `找不到 PlayerFortressBar 節點` | 節點名稱與 JSON 不符 | 對齊 JSON 中的 `name` 欄位 |

### 根源定位步驟

1. 從 stack trace 取得檔案名 + 行號
2. `read_file` 讀取對應行號前後各 20 行
3. 找到實際呼叫 `.xxx` 的位置
4. grep 該物件在哪裡被賦值（可能為 null 的地方）

---

## Phase 4 — 修復與驗證

### 修復前

```powershell
# 確認相關 JSON 是否存在（常見根源）
Test-Path "c:\Users\User\3KLife\assets\resources\ui-spec\layouts\{layoutId}.json"
Test-Path "c:\Users\User\3KLife\assets\resources\ui-spec\skins\{skinId}.json"
```

### 修復

依據根源分類處理：

**A. JSON 缺失/路徑錯誤**
```powershell
Get-ChildItem "c:\Users\User\3KLife\assets\resources\ui-spec\layouts\" -Filter "*.json" | Select-Object Name
```
→ 確認 `screen.json` 中的 `layout` 欄位對應到實際存在的檔案

**B. 程式碼 null 存取**  
→ 用 `replace_string_in_file` 加 null guard + 詳細 log

**C. layout JSON 缺欄位**  
→ 讀取對應 JSON，補 `textKey`/`text`/`bind` 欄位

### 修復後驗證

```
1. get_errors → 確認無新 compile error
2. 在 Cocos Editor 中 Ctrl+S 觸發 refresh
3. 再次執行 Phase 1（截圖）→ Phase 2（log）確認修復
```

---

## 快速識別：這是哪種 Bug？

```
使用者說「一團亂/畫面怪怪的/UI 跑掉了」
    → Phase 1 截圖 → 看 Error 對話框
        有 Error 對話框 → Phase 2 讀 log error: 行
        沒有 Error → 看 warn: 行（通常是缺 binding）
            → 對照截圖症狀 → Phase 3 表格

使用者說「某元件不顯示/功能失效」
    → Phase 2 過濾那個組件名 → 看最後輸出到哪一步
        有 log: "xxx 完成" → 問題在完成後的邏輯
        沒有 "完成" → async 中途失敗 → 看 catch 輸出
```

---

## 本專案 Key 組件 Log Tag 速查

| Tag | 組件 | 關鍵初始化訊息 |
|-----|------|--------------|
| `[BattleScene]` | 戰鬥場景入口 | `start() 開始執行` / `✅ start() 全部完成` |
| `[BattleHUD]` | 戰鬥 HUD | `_initialize: 開始載入` / `buildScreen 完成` / `onBuildComplete 完成` |
| `[UIPreviewBuilder]` | UI 建構器基類 | `buildScreen 開始` / `buildScreen 完成` |
| `[UISpecLoader]` | JSON 載入器 | `loadLayout: 開始載入` / `載入失敗 — loadJson 回傳 null` |
| `[BoardRenderer]` | 棋盤渲染 | `棋盤建立完成 size=NxN` |
| `[BattleScenePanel]` | UI 總調度 | `BattleScenePanel 已就緒` |
| `[BuffGainEffectPool]` | Buff 特效池 | `✅ 初始化完成` |
