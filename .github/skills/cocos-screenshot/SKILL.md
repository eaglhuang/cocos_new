---
name: cocos-screenshot
description: 'SCREENSHOT SKILL — Capture the current Cocos Creator Editor screen to a PNG file, then view it. USE FOR: seeing what the user currently sees in Cocos Editor without needing them to screenshot manually. Always call this when user says "畫面" / "看看" / "一團亂" / "怎麼了" or any visual symptom. DO NOT USE FOR: compile errors (use get_errors instead), log analysis (use cocos-log-reader instead).'
argument-hint: 'No arguments needed. Just invoke this skill and the screenshot will be taken and shown automatically.'
---

<!-- 此檔案為 .agents/skills/cocos-screenshot/SKILL.md 的鏡像副本，供 GitHub Copilot 技能載入使用 -->
<!-- 主版本位於 c:\Users\User\3KLife\.agents\skills\cocos-screenshot\SKILL.md -->

# Cocos Screenshot（鏡像索引）

此技能適用於所有**視覺症狀**：「畫面一團亂」、「UI 跑掉」、「怎麼了」、看看截圖確認狀態。

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

**Step 2 — 用 `view_image` 讀取：**
```
filePath: c:\Users\User\3KLife\temp\cocos-screenshot.png
```

## 完整 SOP

請讀取主技能檔案以取得完整分析指引：  
`.agents/skills/cocos-screenshot/SKILL.md`
