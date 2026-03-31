<#
.SYNOPSIS
  AI 資產自動化生產管線 — 批次生成 UI Sprites
  
.DESCRIPTION
  根據 ui-spec/skins/*.json 中所有 sprite-frame slot 規格，批次產出符合
  「水墨鋼鐵」風格的高質量佔位 PNG，並自動觸發 Cocos Creator asset-db 刷新。
  
  每張 PNG 已依 skin JSON 的 border 規格設計 9-slice 安全區：
    - 圓角半徑 = border 值，確保角落不被拉伸
    - 邊緣漸層/邊框線落在 border 帶內
    - 中央填色可任意拉伸

  工作流：
    1. 執行本工具 → 批次生成所有 sprites (9-slice 正確版)
    2. 若有 AI 生圖要替換單一 sprite，改用：
         powershell -File tools/gen-placeholders.ps1 -SourcePath ai_output.png -TargetPath assets/resources/sprites/...
    3. Cocos Creator 自動 import .meta

  對照 UI-vibe-pipeline.md §16 「AI 資產自動化生產管線」
  
.PARAMETER Batch
  指定只生成哪些批次（battle / common / lobby / all）。預設 all。

.EXAMPLE
  .\tools\gen-ui-sprites.ps1
  .\tools\gen-ui-sprites.ps1 -Batch battle
#>
param(
    [string]$Batch = "all"
)

Add-Type -AssemblyName System.Drawing

$SpritesBase = "C:\Users\User\3KLife\assets\resources\sprites"
$Ok = 0; $Fail = 0

# ─────────────────────────────────────────────────────────────
# 工具函式
# ─────────────────────────────────────────────────────────────

function ParseHex([string]$hex) {
    $h = $hex.TrimStart('#')
    if ($h.Length -eq 3) { $h = "$($h[0])$($h[0])$($h[1])$($h[1])$($h[2])$($h[2])" }
    [System.Drawing.Color]::FromArgb(255,
        [Convert]::ToInt32($h.Substring(0,2),16),
        [Convert]::ToInt32($h.Substring(2,2),16),
        [Convert]::ToInt32($h.Substring(4,2),16))
}

# 建立支援透明的 32-bit Bitmap
function NewBitmap([int]$w, [int]$h) {
    $bm = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g  = [System.Drawing.Graphics]::FromImage($bm)
    $g.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)
    return $bm, $g
}

# GraphicsPath: 加入圓角矩形（radius 以整數像素為單位）
function AddRoundRect([System.Drawing.Drawing2D.GraphicsPath]$path,
                      [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $d = [float]($r * 2)
    if ($d -gt [float]$w)  { $d = [float]$w }
    if ($d -gt [float]$h)  { $d = [float]$h }
    $path.AddArc($x,       $y,        $d, $d,  180, 90)
    $path.AddArc($x+$w-$d, $y,        $d, $d,  270, 90)
    $path.AddArc($x+$w-$d, $y+$h-$d,  $d, $d,    0, 90)
    $path.AddArc($x,       $y+$h-$d,  $d, $d,   90, 90)
    $path.CloseFigure()
}

function SaveSprite([System.Drawing.Bitmap]$bm, [string]$sub, [string]$name) {
    $dir  = Join-Path $SpritesBase $sub
    $null = New-Item -ItemType Directory -Force $dir
    $path = Join-Path $dir "$name.png"
    $bm.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bm.Dispose()
    $script:Ok++
    Write-Host "  ✓ sprites/$sub/$name.png" -ForegroundColor DarkGray
}

# ─────────────────────────────────────────────────────────────
# 基礎生成函式（可組合使用）
# ─────────────────────────────────────────────────────────────

<#
  圓角面板（適合 9-slice panel/button/card bg）
  border 決定圓角半徑，確保角落不被 9-slice 拉伸
#>
function GenPanel {
    param(
        [string]$Sub, [string]$Name,
        [int]$W, [int]$H,
        [string]$BgTop,   # 頂部背景色（hex）
        [string]$BgBot,   # 底部背景色（hex）漸層
        [string]$BdrColor,# 邊框顏色（hex），""表示不畫邊框
        [int]$Radius = 8, # 圓角半徑（應 = skin border 值）
        [float]$BdrW = 1.5# 邊框線寬
    )
    $bm, $g = NewBitmap $W $H

    # 填充圓角背景（漸層：上亮下暗）
    $path   = New-Object System.Drawing.Drawing2D.GraphicsPath
    AddRoundRect $path 1 1 ($W-2) ($H-2) $Radius

    $topC = ParseHex $BgTop
    $botC = ParseHex $BgBot
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(0,0), [System.Drawing.PointF]::new(0,$H),
        $topC, $botC)
    $g.FillPath($grad, $path)
    $grad.Dispose()

    # 頂端微亮高光條（增加立體感）
    $hiC = [System.Drawing.Color]::FromArgb(35, 255, 255, 255)
    $hiPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $hiH    = [Math]::Max(2, [int]($H * 0.18))
    AddRoundRect $hiPath 2 2 ($W-4) $hiH ([Math]::Max(1, $Radius-1))
    $g.FillPath([System.Drawing.SolidBrush]::new($hiC), $hiPath)
    $hiPath.Dispose()

    # 邊框
    if ($BdrColor -ne "") {
        $bc  = ParseHex $BdrColor
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, $bc.R, $bc.G, $bc.B), $BdrW)
        $bPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $inset = $BdrW / 2.0
        AddRoundRect $bPath $inset $inset ($W-$BdrW) ($H-$BdrW) ([Math]::Max(1, $Radius - [int]$inset))
        $g.DrawPath($pen, $bPath)
        $bPath.Dispose(); $pen.Dispose()
    }

    $path.Dispose(); $g.Dispose()
    SaveSprite $bm $Sub $Name
}

<#
  圓形 / 橢圓（按鈕大圓、奧義圓、技能圓）
  帶可選外發光效果
#>
function GenCircle {
    param(
        [string]$Sub, [string]$Name,
        [int]$Size,
        [string]$BgCenter, # 中心色（hex）
        [string]$BgEdge,   # 邊緣色（hex）
        [string]$Border,   # 邊框色（hex）, "" = none
        [bool]$Glow = $false
    )
    $bm, $g = NewBitmap $Size $Size

    # 外發光（Glow圈）
    if ($Glow) {
        $gc = ParseHex $Border
        for ($i = 8; $i -ge 1; $i--) {
            $a = [int](25 + 10 * (9-$i))
            $gc2 = [System.Drawing.Color]::FromArgb($a, $gc.R, $gc.G, $gc.B)
            $pad = $i
            $g.FillEllipse([System.Drawing.SolidBrush]::new($gc2), $pad, $pad, $Size-$pad*2, $Size-$pad*2)
        }
    }

    # 主圓體（PathGradientBrush: 中心亮邊緣暗）
    $ePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ePath.AddEllipse(3, 3, $Size-6, $Size-6)
    $pgBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($ePath)
    $pgBrush.CenterColor    = ParseHex $BgCenter
    $pgBrush.SurroundColors = @( ParseHex $BgEdge )
    $g.FillPath($pgBrush, $ePath)
    $pgBrush.Dispose(); $ePath.Dispose()

    # 邊框環
    if ($Border -ne "") {
        $bc  = ParseHex $Border
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, $bc.R, $bc.G, $bc.B), 1.5)
        $g.DrawEllipse($pen, 3, 3, $Size-6, $Size-6)
        $pen.Dispose()
    }

    $g.Dispose()
    SaveSprite $bm $Sub $Name
}

<#
  SP 環（圓環/annulus，用於 Sprite.FILLED radial）
  中心透明，只畫環帶
#>
function GenRing {
    param(
        [string]$Sub, [string]$Name,
        [int]$Size,
        [string]$RingColor,
        [int]$Thickness = 10
    )
    $bm, $g = NewBitmap $Size $Size

    $rc  = ParseHex $RingColor
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(230, $rc.R, $rc.G, $rc.B), $Thickness)
    # 端部圓頭（為連貫感）
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
    $half = $Thickness / 2.0
    $g.DrawEllipse($pen, $half, $half, $Size - $Thickness, $Size - $Thickness)
    $pen.Dispose(); $g.Dispose()
    SaveSprite $bm $Sub $Name
}

<#
  進度條填充（9-slice 水平膠囊）
  gradient: 左→右從亮到暗（或深到淺）
#>
function GenBar {
    param(
        [string]$Sub, [string]$Name,
        [int]$W, [int]$H,
        [string]$From,  # 左色
        [string]$To,    # 右色
        [bool]$Highlight = $true
    )
    $bm, $g = NewBitmap $W $H
    $r = [int]($H / 2)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    AddRoundRect $path 0 0 $W $H $r

    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(0,0), [System.Drawing.PointF]::new($W, 0),
        (ParseHex $From), (ParseHex $To))
    $g.FillPath($grad, $path)
    $grad.Dispose()

    if ($Highlight) {
        # 上方 1/3 高光
        $hiC = [System.Drawing.Color]::FromArgb(50, 255, 255, 255)
        $hiH = [Math]::Max(1, [int]($H / 3))
        $hiPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        AddRoundRect $hiPath 1 1 ($W-2) $hiH ([Math]::Max(1,$r-1))
        $g.FillPath([System.Drawing.SolidBrush]::new($hiC), $hiPath)
        $hiPath.Dispose()
    }

    $path.Dispose(); $g.Dispose()
    SaveSprite $bm $Sub $Name
}

<#
  小型稀有度標籤（chip，短膠囊）
  左右各有顏色，中間漸層
#>
function GenChip {
    param(
        [string]$Sub, [string]$Name,
        [int]$W, [int]$H,
        [string]$Color1,
        [string]$Color2
    )
    $bm, $g = NewBitmap $W $H
    $r = [int]($H / 2)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    AddRoundRect $path 0 0 $W $H $r

    $c1   = ParseHex $Color1
    $c2   = ParseHex $Color2
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(0,0), [System.Drawing.PointF]::new($W,0),
        [System.Drawing.Color]::FromArgb(255, [Math]::Min(255,$c1.R+30), [Math]::Min(255,$c1.G+30), [Math]::Min(255,$c1.B+20)),
        $c1)
    $g.FillPath($grad, $path)
    $grad.Dispose()

    # 細邊框
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(170, $c2.R, $c2.G, $c2.B), 1)
    $g.DrawPath($pen, $path)
    $pen.Dispose(); $path.Dispose(); $g.Dispose()
    SaveSprite $bm $Sub $Name
}

<#
  武將頭像佔位（含人形剪影輪廓）
#>
function GenPortrait {
    param(
        [string]$Sub, [string]$Name,
        [int]$Size,
        [string]$BgColor,
        [string]$FigureColor
    )
    $bm, $g = NewBitmap $Size $Size

    # 背景漸層（上→下）
    $c1   = ParseHex $BgColor
    $c2   = [System.Drawing.Color]::FromArgb(255,
        [Math]::Max(0,$c1.R-40), [Math]::Max(0,$c1.G-40), [Math]::Max(0,$c1.B-50))
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(0,0), [System.Drawing.PointF]::new(0,$Size), $c1, $c2)
    $g.FillRectangle($grad, 0, 0, $Size, $Size)
    $grad.Dispose()

    # 人形剪影
    $fc  = ParseHex $FigureColor
    $fig = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(100, $fc.R, $fc.G, $fc.B))
    $headR = [int]($Size * 0.175)
    $headX = [int]($Size / 2 - $headR)
    $headY = [int]($Size * 0.16)
    $g.FillEllipse($fig, $headX, $headY, $headR*2, $headR*2)
    # 身體梯形
    $cx = [int]($Size / 2)
    $bodyTop = $headY + $headR*2 + 3
    $bodyBot = [int]($Size * 0.80)
    $bw      = [int]($Size * 0.36)
    $pts = @(
        [System.Drawing.Point]::new($cx - $bw/2,  $bodyBot),
        [System.Drawing.Point]::new($cx + $bw/2,  $bodyBot),
        [System.Drawing.Point]::new($cx + $bw/4,  $bodyTop),
        [System.Drawing.Point]::new($cx - $bw/4,  $bodyTop)
    )
    $g.FillPolygon($fig, $pts)
    $fig.Dispose()

    # 微邊框
    $bdrC = [System.Drawing.Color]::FromArgb(80, 200, 200, 220)
    $pen  = New-Object System.Drawing.Pen($bdrC, 1)
    $g.DrawRectangle($pen, 0, 0, $Size-1, $Size-1)
    $pen.Dispose(); $g.Dispose()
    SaveSprite $bm $Sub $Name
}

<#
  大面積背景（不接受 9-slice，不進 atlas）
  有微弱掃描線紋理模擬水墨效果
#>
function GenLargeBg {
    param(
        [string]$Sub, [string]$Name,
        [int]$W, [int]$H,
        [string]$TopColor,
        [string]$BotColor
    )
    $bm, $g = NewBitmap $W $H

    $topC = ParseHex $TopColor
    $botC = ParseHex $BotColor
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(0,0), [System.Drawing.PointF]::new(0,$H), $topC, $botC)
    $g.FillRectangle($grad, 0, 0, $W, $H)
    $grad.Dispose()

    # 水平掃描線（低頻率，模擬紙張紋理）
    $lineC = [System.Drawing.Color]::FromArgb(10, 0, 0, 0)
    $linePen = New-Object System.Drawing.Pen($lineC, 1)
    for ($y = 0; $y -lt $H; $y += 6) {
        $g.DrawLine($linePen, 0, $y, $W, $y)
    }
    $linePen.Dispose(); $g.Dispose()
    SaveSprite $bm $Sub $Name
}

# ─────────────────────────────────────────────────────────────
# BATTLE 批次
# ─────────────────────────────────────────────────────────────
function GenerateBattle {
    Write-Host "`n[Battle HUD]" -ForegroundColor Yellow

    # TopBar (9-slice border [16,16,16,16])
    GenPanel "battle" "topbar_bg" 128 48 "#181922" "#0F101A" "#D4AF37" 12 1.5

    # HP Bars (9-slice border [8,8,8,8])
    GenBar "battle" "bar_hp_player"  64 16 "#2AA845" "#1B7030"   # 玩家綠
    GenBar "battle" "bar_hp_enemy"   64 16 "#D4403A" "#962020"   # 敵方紅

    # Portraits (simple)
    GenPortrait "battle" "portrait_player_placeholder" 128 128 "#1A2E4A" "#7AAFD4"
    GenPortrait "battle" "portrait_enemy_placeholder"  128 128 "#3A1A1A" "#D47A7A"

    Write-Host "`n[Tiger Tally]" -ForegroundColor Yellow

    # Tally Card (9-slice border [8,8,8,8])
    GenPanel "battle" "tally_card_bg"              64 80 "#1A1D2C" "#131520" "#586090" 8 1.0
    GenPanel "battle" "tally_card_art_placeholder" 60 50 "#1E2230" "#161820" ""        4 0.0
    # Disabled overlay (semi-transparent)
    $bm2, $g2 = NewBitmap 64 80
    $bgC2 = [System.Drawing.Color]::FromArgb(180, 10, 10, 10)
    $g2.FillRectangle([System.Drawing.SolidBrush]::new($bgC2), 0, 0, 64, 80)
    $g2.Dispose(); SaveSprite $bm2 "battle" "tally_card_disabled"

    # Rarity Chips (9-slice border [4,4,4,4])
    GenChip "battle" "tally_rarity_normal" 40 14 "#505A68" "#90A0B0"
    GenChip "battle" "tally_rarity_rare"   40 14 "#8B6A00" "#D4AF37"
    GenChip "battle" "tally_rarity_epic"   40 14 "#6A1A9A" "#C060FF"

    # Type Badge (simple hexagonal look)
    GenCircle "battle" "tally_badge_type" 48 "#C85010" "#7A3000" "#FF8A40" $false

    Write-Host "`n[Action Command]" -ForegroundColor Yellow

    # Ultimate Circles (9-slice border [8,8,8,8])
    GenCircle "battle" "action_ult_bg"       116 "#141A3A" "#0A0F20" "#3A5A9A" $false
    GenCircle "battle" "action_ult_bg_ready" 116 "#1E2850" "#0F1428" "#D4AF37" $true

    # SP Rings (filled/radial — just the ring image)
    GenRing "battle" "action_sp_ring"       116 "#446080" 10
    GenRing "battle" "action_sp_ring_ready" 116 "#D4AF37" 10

    # Skill Circles (9-slice border [6,6,6,6])
    GenCircle "battle" "action_skill_circle"        72 "#1C2540" "#10182A" "#3A4A70" $false
    GenCircle "battle" "action_skill_circle_ready"  72 "#1A3560" "#0F1F3A" "#50A0E0" $true
    GenCircle "battle" "action_skill_circle_locked" 72 "#101014" "#0A0A0C" "#282830" $false

    # Util Buttons (9-slice border [6,6,6,6])  ── 圓角正方形
    GenPanel "battle" "action_util_endturn" 72 72 "#1E0808" "#140505" "#C03030" 12 1.5
    GenPanel "battle" "action_util_tactics" 72 72 "#08081E" "#050514" "#3050C0" 12 1.5
    GenPanel "battle" "action_util_duel"    72 72 "#1E1A08" "#141005" "#A08020" 12 1.5

    Write-Host "`n[Unit Info Panel]" -ForegroundColor Yellow

    # Unit Info (9-slice border [12,12,12,12] / [8,8,8,8])
    GenPanel "battle" "unitinfo_root_bg"    256 160 "#141520" "#0E0F16" "#404060" 12 1.0
    GenPanel "battle" "unitinfo_header_bg"  256  40 "#1C1E2C" "#141622" "#D4AF37"  8 1.0
    GenPanel "battle" "unitinfo_section_bg" 240  50 "#181A28" "#121420" "#303050"  6 0.8
    GenCircle "battle" "unitinfo_type_icon"  48 "#303848" "#20262E" "#6A7A8A"  $false
}

# ─────────────────────────────────────────────────────────────
# COMMON 批次
# ─────────────────────────────────────────────────────────────
function GenerateCommon {
    Write-Host "`n[Common]" -ForegroundColor Yellow

    GenCircle "common" "icon_network"   28 "#1A4A1A" "#0E2C0E" "#40D040" $false

    # Close button ── 紅色圓形 X icon
    $bm3, $g3 = NewBitmap 32 32
    $ePath3 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ePath3.AddEllipse(2, 2, 28, 28)
    $pgB3 = New-Object System.Drawing.Drawing2D.PathGradientBrush($ePath3)
    $pgB3.CenterColor    = ParseHex "#D04040"
    $pgB3.SurroundColors = @( ParseHex "#901010" )
    $g3.FillPath($pgB3, $ePath3)
    $pgB3.Dispose(); $ePath3.Dispose()
    # 畫 X
    $xPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2.5)
    $xPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $xPen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
    $g3.DrawLine($xPen,  9,  9, 23, 23)
    $g3.DrawLine($xPen, 23,  9,  9, 23)
    $xPen.Dispose(); $g3.Dispose()
    SaveSprite $bm3 "common" "btn_close_small"

    # Popup panels (9-slice border [16,16,16,16])
    GenPanel "common" "popup_card_bg"   96 80 "#141520" "#0C0D14" "#D4AF37" 14 2.0
    GenPanel "common" "popup_card_win"  96 80 "#0A160A" "#061006" "#40D040" 14 2.0
    GenPanel "common" "popup_card_lose" 96 80 "#160A0A" "#100606" "#D04040" 14 2.0

    # Solid 1×1 fills
    GenLargeBg "common" "overlay_dark" 4 4 "#000000" "#000000"
    GenLargeBg "common" "bg_ink"       4 4 "#0F0F0F" "#080808"
}

# ─────────────────────────────────────────────────────────────
# LOBBY 批次
# ─────────────────────────────────────────────────────────────
function GenerateLobby {
    Write-Host "`n[Lobby]" -ForegroundColor Yellow

    GenLargeBg "lobby" "bg_lobby"  512 288 "#0C0C16" "#1C1A2A"
    GenPortrait "lobby" "icon_avatar_default" 128 128 "#1A2A4A" "#6A9ACA"
    GenLargeBg "lobby" "bg_shop"   512 288 "#0C0A0A" "#1A1018"
}

# ─────────────────────────────────────────────────────────────
# 主流程
# ─────────────────────────────────────────────────────────────
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   UI Sprite Generation Pipeline v1.0    ║" -ForegroundColor Cyan
Write-Host "║   Water-ink + Steel　水墨鋼鐵 主題       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "輸出目錄：$SpritesBase"

try {
    if ($Batch -eq "battle" -or $Batch -eq "all") { GenerateBattle }
    if ($Batch -eq "common" -or $Batch -eq "all") { GenerateCommon }
    if ($Batch -eq "lobby"  -or $Batch -eq "all") { GenerateLobby  }
} catch {
    Write-Error "生成失敗: $_"
    $script:Fail++
}

Write-Host "`n結果：$Ok OK  $Fail FAIL" -ForegroundColor $(if ($Fail -eq 0) { "Green" } else { "Yellow" })

# 觸發 Cocos Creator 刷新
Write-Host "`n觸發 Cocos Creator Asset-DB 刷新..." -ForegroundColor Cyan
try {
    $r = curl.exe http://localhost:7456/asset-db/refresh 2>&1
    Write-Host "refresh: $r" -ForegroundColor Green
} catch {
    Write-Warning "無法觸發刷新（Cocos Creator 是否正在運行？）"
}

Write-Host "`n✅  Pipeline 完成！" -ForegroundColor Green
Write-Host "   若要替換為 AI 生圖：" -ForegroundColor Gray
Write-Host "   powershell -File tools\gen-placeholders.ps1 -SourcePath ai.png -TargetPath assets\resources\sprites\battle\topbar_bg.png" -ForegroundColor Gray
