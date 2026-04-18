---
doc_id: doc_agentskill_0012
name: cocos-screenshot
description: 'EDITOR PREVIEW SCREENSHOT SKILL — Capture the current Cocos Creator Editor window to a PNG file and inspect exactly what is already visible inside the Editor. USE FOR: visual symptoms when the user already has the target screen open in Cocos Editor / Editor Preview. DO NOT USE FOR: browser-driven QA, automatic browser target switching, reference-image comparison pipelines, compile errors, or pure log analysis. If the user wants browser screenshots, remind them to prepare the Browser Review environment and use cocos-preview-qa instead.'
argument-hint: 'No arguments needed. Use only after confirming the user has already opened the target content inside the Cocos Editor window.'
---

<!-- 此檔案為 .agents/skills/cocos-screenshot/SKILL.md (doc_agentskill_0005) 的鏡像副本，供 GitHub Copilot 技能載入使用 -->
<!-- 主版本位於 c:\Users\User\3KLife\.agents\skills\cocos-screenshot\SKILL.md -->

# Cocos Screenshot（Editor Preview / Editor 視窗截圖）

此技能適用於所有 **Cocos Editor 視窗內已顯示內容** 的視覺症狀：「畫面一團亂」、「UI 跑掉」、「怎麼了」、「CompositePanel mount fail」、看看截圖確認狀態。

## 先判斷是不是該用這個 skill

只有在下列條件成立時，才使用 `cocos-screenshot`：
- 使用者要看的是 **Cocos Editor 視窗目前畫面**
- 使用者已經把目標畫面開在 Editor / Editor Preview 裡
- Agent 不需要自動切瀏覽器 target，也不需要走參考圖比對 pipeline

如果使用者要的是 Browser Review 連續截圖、切換 target、與參考圖比對，應改用 `cocos-preview-qa`，並先提醒使用者準備 Browser Review 環境。

## 與 `cocos-preview-qa` 的最大差別

- `cocos-screenshot`: 截的是 **Cocos Editor 視窗**，只能反映 Editor 目前看到的內容
- `cocos-preview-qa`: 截的是 **瀏覽器 / Browser Review**，可以自動開頁、切 target、批次截圖、做 QA 比對
- 就算 Cocos Editor 開著，若使用者沒準備可跑瀏覽器的 Browser Review 環境，也不能拿 `cocos-screenshot` 代替 `cocos-preview-qa`

## 重要：必須用 PrintWindow，不可用全螢幕截圖

使用者在 VS Code 打字時 Cocos Editor 在背後，全螢幕只截到 VS Code。
`PrintWindow`（PW_RENDERFULLCONTENT=2）可直接截取背景視窗。

## 截圖指令（兩步驟）

**Step 1 — 執行 PowerShell 截圖（指定 Cocos Creator 視窗）：**
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

> 若 `WinEnum` 類別已在 session 中載入，直接從 `$hwnd = ...` 開始執行。

**Step 1b — 縮圖採 thumbnail-first progressive zoom（硬規定，在 view_image 前必須執行）：**
```powershell
$imgPath = "c:\Users\User\3KLife\temp\cocos-screenshot.png"
node tools_node/prepare-view-image.js --input $imgPath
# 若 125px 不足以判讀，才依序改跑：
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 250
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 500
```
> ⚠️ 規則是先試 `125px`，足夠就停止；只有在 `125px` 明確不夠時才可放大。需要看 `>500px` 原圖時，必須先取得使用者明確同意。

**Step 2 — 用 `view_image` 讀取：**
```
filePath: c:\Users\User\3KLife\temp\cocos-screenshot.png
```

## 完整 SOP

請讀取主技能檔案以取得完整分析指引：  
`.agents/skills/cocos-screenshot/SKILL.md` (doc_agentskill_0005)
