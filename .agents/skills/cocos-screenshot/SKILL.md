---
name: cocos-screenshot
description: 'EDITOR PREVIEW SCREENSHOT SKILL — Capture the current Cocos Creator Editor window to a PNG file and inspect exactly what is already visible inside the Editor. USE FOR: visual symptoms when the user already has the target screen open in Cocos Editor / Editor Preview. DO NOT USE FOR: browser-driven QA, automatic browser target switching, reference-image comparison pipelines, compile errors, or pure log analysis. If the user wants browser screenshots, remind them to prepare the Browser Review environment and use cocos-preview-qa instead.'
argument-hint: 'No arguments needed. Use only after confirming the user has already opened the target content inside the Cocos Editor window.'
---

# Cocos Screenshot（Editor Preview / Editor 視窗截圖）

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

## When to Use

凡是有**視覺症狀**都先截圖：
- 使用者說「看看目前畫面」、「一團亂」、「怎麼了」、「UI 跑掉了」
- 使用者傳圖前先自動截圖確認最新狀態
- Debug 工作流程的第一步（配合 `cocos-log-reader` 使用）
- 使用者已經把要看的畫面打開在 Cocos Editor 裡

**不適用：**
- 純 log 分析 → 用 `cocos-log-reader`
- Browser Review QA / 參考圖自動比對 → 用 `cocos-preview-qa`
- 編譯錯誤 → 用 `get_errors`

---

## 重要設計原理

**必須使用 Windows `PrintWindow` API，不可用全螢幕截圖。**

原因：使用者在 VS Code 打字時，Cocos Editor 在背後被遮擋，全螢幕截圖只會截到 VS Code。
`PrintWindow`（flag=2，即 PW_RENDERFULLCONTENT）可直接向 Cocos Editor 的視窗 DC 繪製，
即使視窗在最底層也能正確截圖（Electron / Chromium GPU 加速視窗同樣支援）。

---

## 截圖指令（每次執行前必須先執行）

```powershell
# Step 1：載入 Windows API + 截取 Cocos Creator 視窗
Add-Type @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

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
            var sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            if (sb.ToString().IndexOf(keyword, StringComparison.OrdinalIgnoreCase) >= 0) {
                found = hWnd; return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static bool Snap(IntPtr hWnd, string path) {
        RECT r; GetWindowRect(hWnd, out r);
        int w = r.Right - r.Left, h = r.Bottom - r.Top;
        if (w <= 0 || h <= 0) return false;
        using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp)) {
            IntPtr hdc = g.GetHdc();
            bool ok = PrintWindow(hWnd, hdc, 2);   // 2 = PW_RENDERFULLCONTENT
            g.ReleaseHdc(hdc);
            if (!ok) return false;
            bmp.Save(path, ImageFormat.Png);
            return true;
        }
    }
}
"@ -ReferencedAssemblies System.Drawing

$hwnd = [WinEnum]::FindByTitle("Cocos Creator")
if ($hwnd -eq [IntPtr]::Zero) { Write-Error "找不到 Cocos Creator 視窗"; return }

$out = "c:\Users\User\3KLife\temp\cocos-screenshot.png"
$ok  = [WinEnum]::Snap($hwnd, $out)
if ($ok) {
    $kb = [int]((Get-Item $out).Length / 1KB)
    Write-Host "截圖完成: $out ($kb KB)"
} else {
    Write-Error "PrintWindow 失敗"
}
```

> **提示**：若 PowerShell 工作階段中 `WinEnum` 類別已載入（同一 session），可跳過 `Add-Type` 區塊直接從 `$hwnd = ...` 開始執行。

## Step 1b：縮圖採 thumbnail-first progressive zoom（硬規定，在 view_image 前必須執行）

```powershell
$imgPath = "c:\Users\User\3KLife\temp\cocos-screenshot.png"
node tools_node/prepare-view-image.js --input $imgPath
# 若 125px 不足，再依序改跑：
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 250
# node tools_node/prepare-view-image.js --input $imgPath --maxWidth 500
```

> ⚠️ 先試 `125px`，足夠就停止；只有在前一級不足時才可放大。需要看 `>500px` 原圖時，必須先取得使用者明確同意。

## Step 2：使用 view_image 工具讀取截圖

執行完上面指令後，**必須立即呼叫 `view_image` 工具**：

```
filePath: c:\Users\User\3KLife\temp\cocos-screenshot.png
```

---

## 截圖分析要點

拿到截圖後分析以下項目：

### 1. 錯誤彈窗

| 特徵 | 代表意義 |
|------|----------|
| 黑色對話框 + "Error" 大字 | Cocos Editor runtime TypeError |
| "TypeError: Cannot read..." | null/undefined 存取，配合 log 找根源 |
| "Please open the console to see detailed errors" | 需要讀 log |

### 2. UI 版位問題

| 症狀 | 可能原因 |
|------|----------|
| 節點跑到場景外 / 位移 | Widget 設定錯誤 / Canvas 層級問題 |
| 文字顯示為 "label" 字樣 | layout JSON 缺 `textKey`/`text`/`bind` |
| 按鈕無貼圖（灰白方塊） | skin manifest slotId 對應不到 SpriteFrame |
| UI 疊在 3D 場景上 | 節點 Layer 不正確（應為 UI_2D 而非 DEFAULT） |
| 大量空白 / 缺元素 | buildScreen 失敗退回白模，配合 log 確認 |

### 3. 戰鬥場景特有症狀

| 症狀 | 可能原因 |
|------|----------|
| 棋盤不顯示 | `BoardRenderer.createBoard()` 失敗 |
| 血條不更新 | `ProgressBar` 未掛載到正確節點 |
| 3D 模型不顯示 | Camera Layer / Material 問題 |

---

## 注意事項

- 截圖儲存路徑固定為 `c:\Users\User\3KLife\temp\cocos-screenshot.png`
- 每次截圖會覆蓋舊檔案
- Cocos Editor **不需要在前台**，即使被 VS Code 遮擋也能正確截圖
- Cocos Editor **不能最小化**（最小化後 PrintWindow 會得到空白圖）
- 截圖約 600-900 KB（包含整個 Editor 視窗）
- 若 `Add-Type` 報錯「型別已存在」，直接跳過 Add-Type 從 `$hwnd` 開始執行
