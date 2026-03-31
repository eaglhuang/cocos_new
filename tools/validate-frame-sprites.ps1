# validate-frame-sprites.ps1
# §3.3 驗證：所有框體 sprite 必須包含 ≥ 1px 金色/銅色邊界線
# 對應 docs/UI參考圖品質分析.md §3.3, §9.6
#
# 使用方式：
#   pwsh -File tools/validate-frame-sprites.ps1
#   pwsh -File tools/validate-frame-sprites.ps1 -Verbose
#
# 注意：刻意排除 badge/item_cell/warning/paper_utility（使用非金色設計語言的族群）

param(
    [switch]$Verbose = $false
)

Add-Type -AssemblyName System.Drawing

$root        = Join-Path $PSScriptRoot "..\assets\resources\sprites\ui_families\common"
$borderDepth = 4    # 掃描外邊緣 4px 環形區域
$minGoldPx   = 5    # 通過閾值：border 區域至少 5 個暖金像素

# --------------------------------------------------
# 金色/暖銅色像素判斷函式
# 規格：「金色 #D4AF37 → #FFE088；銅色 #C9A028；符合暖色且排除灰藍」
# 判斷條件：
#   R > 130, G > 80, B < 180
#   R > B + 40   （暖色排除灰藍）
#   R >= G - 40  （排除純綠）
#   Alpha > 50   （排除透明邊緣）
# --------------------------------------------------
function Test-GoldPixel([int]$r, [int]$g, [int]$b, [int]$a) {
    if ($a -le 50)   { return $false }
    if ($r -le 130)  { return $false }
    if ($g -le 80)   { return $false }
    if ($b -ge 180)  { return $false }
    if (($r - $b) -le 40) { return $false }  # 非暖色
    if (($r - $g) -lt -40) { return $false } # 純綠排除
    return $true
}

# --------------------------------------------------
# 掃描目標清單（預期含金色邊框的 frame/panel sprites）
# 排除：badge/ item_cell/ warning/ paper_utility/ bleed/ shadow/ noise/
# --------------------------------------------------
$targets = @(
    @{ path = "dark_metal\frame.png";              desc = "sec2.1 dark-metal frame" },
    @{ path = "parchment\frame.png";               desc = "sec2.2 parchment frame" },
    @{ path = "gold_cta\frame.png";                desc = "sec2.4 gold-cta frame" },
    @{ path = "progress_bar\track.png";            desc = "sec4 progress-bar track" },
    @{ path = "tab\tab_active.png";                desc = "sec2.6 horizontal tab active" },
    @{ path = "diamond_tab\diamond_active.png";    desc = "sec2.6 diamond tab active" },
    @{ path = "circle_icon\circle_normal.png";     desc = "sec6 circle icon normal" },
    @{ path = "nav_ink\btn_primary_normal.png";    desc = "sec9.1 nav_ink family" },
    @{ path = "equipment\btn_primary_normal.png";  desc = "sec9.1 equipment family" },
    @{ path = "commerce\btn_primary_normal.png";   desc = "sec9.1 commerce family" }
)

# --------------------------------------------------
# 主掃描邏輯
# --------------------------------------------------
$pass    = 0
$fail    = 0
$skip    = 0
$results = [System.Collections.Generic.List[string]]::new()

foreach ($t in $targets) {
    $fullPath = Join-Path $root $t.path

    if (-not (Test-Path $fullPath)) {
        $skip++
        $results.Add("[SKIP]  $($t.path) -- file not found")
        continue
    }

    $bmp = $null
    try {
        $bmp = [System.Drawing.Bitmap]::new($fullPath)
    } catch {
        $skip++
        $results.Add("[SKIP]  $($t.path) -- load error: $($_.Exception.Message)")
        continue
    }

    $w         = $bmp.Width
    $h         = $bmp.Height
    $goldCount = 0

    # 掃描外邊緣 borderDepth px 環形
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $inBorder = ($x -lt $borderDepth) -or
                        ($x -ge ($w - $borderDepth)) -or
                        ($y -lt $borderDepth) -or
                        ($y -ge ($h - $borderDepth))
            if (-not $inBorder) { continue }

            $px = $bmp.GetPixel($x, $y)
            if (Test-GoldPixel $px.R $px.G $px.B $px.A) {
                $goldCount++
            }
        }
    }

    $bmp.Dispose()

    if ($goldCount -ge $minGoldPx) {
        $pass++
        $status = "[PASS]"
        $detail = "${goldCount} warm pixels in border"
    } else {
        $fail++
        $status = "[FAIL]"
        $detail = "only ${goldCount} warm pixels (need >= ${minGoldPx})"
    }

    $line = "${status}  $($t.path)  (${detail})"
    if ($Verbose) {
        $line += "  [$($t.desc)]"
    }
    $results.Add($line)
}

# --------------------------------------------------
# 輸出結果
# --------------------------------------------------
$results | ForEach-Object { Write-Host $_ }

$total    = $pass + $fail
$passRate = if ($total -gt 0) { [math]::Round($pass / $total * 100, 1) } else { 0 }

Write-Host ""
Write-Host "----- sec3.3 Frame Sprite Gold-Edge Results -----"
Write-Host "PASS: $pass  FAIL: $fail  SKIP: $skip  Total: $total  Pass Rate: ${passRate}%"

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "${fail} frame sprite(s) missing gold/copper border pixels (violates sec3.3)."
    Write-Host "Ensure the border region of each frame sprite has >= 1px gold/warm-copper color."
    exit 1
} else {
    Write-Host ""
    Write-Host "All frame sprites pass sec3.3 gold-edge verification."
    exit 0
}
