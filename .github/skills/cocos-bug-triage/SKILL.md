---
doc_id: doc_agentskill_0009
name: cocos-bug-triage
description: 'COMPLETE BUG INVESTIGATION WORKFLOW — Combines screenshot + log reading into a full triage pipeline. USE FOR: any bug report that has both visual symptoms AND runtime errors, especially CompositePanel / ChildPanel mount failures, screen spec wiring breaks, or battle scene UI crashes. This is the master debugging workflow that orchestrates cocos-screenshot and cocos-log-reader together.'
argument-hint: 'Describe the bug symptom briefly. Examples: GeneralDetailComposite mount fail, tab switch blank, BattleHUD crash. The skill will guide screenshot → log → root cause → fix.'
---

<!-- 此檔案為 .agents/skills/cocos-bug-triage/SKILL.md (doc_agentskill_0002) 的鏡像副本，供 GitHub Copilot 技能載入使用 -->
<!-- 主版本位於 c:\Users\User\3KLife\.agents\skills\cocos-bug-triage\SKILL.md -->

# Cocos Bug Triage（鏡像索引）

這是本專案的**標準 Bug 處理 SOP**，整合截圖與 log 分析。

## 完整流程

```
Phase 1: 視覺確認（截圖）→ Phase 2: Log 分析 → Phase 3: 根源定位 → Phase 4: 修復驗證
```

---

## Phase 1 — 視覺確認（PrintWindow 指定視窗截圖）

**不可用全螢幕截圖**，因為 Cocos Editor 可能在背後被 VS Code 遮擋。

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
if ($ok) { Write-Host "截圖完成: $out ($([int]((Get-Item $out).Length/1KB)) KB)" }
```

然後先走 thumbnail-first progressive zoom：

```powershell
$imgPath = "c:\Users\User\3KLife\temp\cocos-screenshot.png"
node tools_node/prepare-view-image.js --input $imgPath
# 若 125px 不足，再依序改跑：
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 250
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 500
```

再呼叫 `view_image { filePath: "c:\Users\User\3KLife\temp\cocos-screenshot.png" }`

> ⚠️ 先試 `125px`，足夠就停止；只有在前一級不足時才可放大。需要看 `>500px` 原圖時，必須先取得使用者明確同意。

---

## Phase 2 — Log 分析

```powershell
$log = Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Tail 300 -Encoding UTF8
Write-Host "=== ERROR ===" -ForegroundColor Red
$log | Where-Object { $_ -match "^\d{4}" -and $_ -match " - error:" } | Select-Object -Last 20
Write-Host "=== WARN ===" -ForegroundColor Yellow
$log | Where-Object { $_ -match "^\d{4}" -and $_ -match " - warn:" } | Select-Object -Last 10
Write-Host "=== LOG（最後執行到哪）===" -ForegroundColor Cyan
$log | Where-Object { $_ -match "^\d{4}" -and $_ -match " - log:" } | Select-Object -Last 10
Write-Host "=== GeneralDetail 相關 ===" -ForegroundColor Magenta
$log | Where-Object { $_ -match "GeneralDetailPanel|GeneralDetailComposite" } | Select-Object -Last 10
```

---

## Phase 3 — 根源定位

| 截圖症狀 | Log 關鍵字 | 修復方向 |
|---------|-----------|----------|
| "Cannot read properties of null (reading 'root')" | `TypeError: Cannot read` | 加 null guard；確認 JSON 路徑 |
| label 顯示變數名 | `has no textKey/text/bind` | 補 layout JSON 欄位 |
| buildScreen 完成但空白 | `root.children=0` | 檢查 layout JSON `children` |

Stack trace 格式：`at ClassName.method (file:///...OriginalFile.ts:LINE:COL)`  
根源 = stack 最底部（第一個 `at`）

---

## Phase 4 — 修復後驗證

1. `get_errors` → 確認無編譯錯誤  
2. Cocos Editor Ctrl+S 觸發 refresh  
3. 再次截圖 + 讀 log 確認修復

---

## 組件 Log Tag 速查

| Tag | 組件 | 關鍵訊息 |
|-----|------|---------|
| `[BattleHUD]` | 戰鬥 HUD | `_initialize: 開始載入` / `buildScreen 完成` |
| `[CompositePanel]` | UI 頁級宿主 | `buildScreen 開始` / `buildScreen 完成` / `mountChildPanel` |
| `[ChildPanel]` | slot 內容區 | `onDataUpdate` / `onRouteEnter` |
| `[UISpecLoader]` | JSON 載入器 | `loadLayout: 開始載入` / `載入失敗` |
| `[BoardRenderer]` | 棋盤渲染 | `棋盤建立完成 size=NxN` |
| `[BattleScene]` | 戰鬥場景 | `start() 開始執行` / `✅ start() 全部完成` |

---

## UCUFLogger 提醒

`assets/scripts/` 內**禁用裸 `console.log`**，統一使用 `UCUFLogger`（`assets/scripts/ui/core/UCUFLogger.ts`）。新增 debug 功能前先確認目標 `LogCategory` 存在或補 enum；不得自建平行 log 模組。

---

完整 SOP 請讀取主版：`.agents/skills/cocos-bug-triage/SKILL.md` (doc_agentskill_0002)
