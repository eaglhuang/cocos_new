param(
    [Parameter(Mandatory = $true)]
    [string]$ReferencePath,

    [Parameter(Mandatory = $true)]
    [string]$CurrentPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [string]$Title = "UI Compare Board",
    [string]$LeftLabel = "Reference",
    [string]$RightLabel = "Current",
    [string]$Footer = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Resolve-FullPath {
    param([string]$PathValue)
    return [System.IO.Path]::GetFullPath($PathValue)
}

function New-Font {
    param(
        [float]$Size,
        [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular
    )

    $preferredFamilies = @("Microsoft JhengHei UI", "Microsoft JhengHei", "Segoe UI")
    foreach ($familyName in $preferredFamilies) {
        try {
            return New-Object System.Drawing.Font($familyName, $Size, $Style)
        } catch {
            continue
        }
    }

    return New-Object System.Drawing.Font([System.Drawing.FontFamily]::GenericSansSerif, $Size, $Style)
}

function Get-FitRect {
    param(
        [int]$ImageWidth,
        [int]$ImageHeight,
        [int]$BoxWidth,
        [int]$BoxHeight,
        [int]$OriginX,
        [int]$OriginY
    )

    $scale = [Math]::Min($BoxWidth / [double]$ImageWidth, $BoxHeight / [double]$ImageHeight)
    $drawWidth = [Math]::Max(1, [int][Math]::Round($ImageWidth * $scale))
    $drawHeight = [Math]::Max(1, [int][Math]::Round($ImageHeight * $scale))
    $offsetX = $OriginX + [int][Math]::Floor(($BoxWidth - $drawWidth) / 2)
    $offsetY = $OriginY + [int][Math]::Floor(($BoxHeight - $drawHeight) / 2)
    return [System.Drawing.Rectangle]::new($offsetX, $offsetY, $drawWidth, $drawHeight)
}

$referenceFull = Resolve-FullPath $ReferencePath
$currentFull = Resolve-FullPath $CurrentPath
$outputFull = Resolve-FullPath $OutputPath

if (!(Test-Path $referenceFull)) {
    throw "Reference image not found: $referenceFull"
}

if (!(Test-Path $currentFull)) {
    throw "Current image not found: $currentFull"
}

$outputDir = Split-Path -Parent $outputFull
if ($outputDir -and !(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$referenceImage = [System.Drawing.Image]::FromFile($referenceFull)
$currentImage = [System.Drawing.Image]::FromFile($currentFull)

try {
    $margin = 32
    $gutter = 24
    $headerHeight = 88
    $labelHeight = 38
    $footerHeight = if ([string]::IsNullOrWhiteSpace($Footer)) { 0 } else { 46 }
    $panelWidth = 920
    $panelHeight = 720

    $boardWidth = ($margin * 2) + ($panelWidth * 2) + $gutter
    $boardHeight = $headerHeight + ($margin * 2) + $labelHeight + $panelHeight + $footerHeight

    $bitmap = New-Object System.Drawing.Bitmap($boardWidth, $boardHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

        $bg = [System.Drawing.Color]::FromArgb(255, 242, 238, 229)
        $panelBg = [System.Drawing.Color]::FromArgb(255, 232, 223, 208)
        $frameColor = [System.Drawing.Color]::FromArgb(255, 140, 122, 102)
        $textColor = [System.Drawing.Color]::FromArgb(255, 45, 41, 38)
        $mutedColor = [System.Drawing.Color]::FromArgb(255, 107, 94, 78)

        $graphics.Clear($bg)

        $titleFont = New-Font -Size 22 -Style ([System.Drawing.FontStyle]::Bold)
        $labelFont = New-Font -Size 14 -Style ([System.Drawing.FontStyle]::Bold)
        $footerFont = New-Font -Size 12

        $textBrush = New-Object System.Drawing.SolidBrush($textColor)
        $mutedBrush = New-Object System.Drawing.SolidBrush($mutedColor)
        $framePen = New-Object System.Drawing.Pen($frameColor, 2)

        $graphics.DrawString($Title, $titleFont, $textBrush, $margin, 24)

        $leftX = $margin
        $rightX = $margin + $panelWidth + $gutter
        $imageY = $headerHeight + $labelHeight

        $leftPanelRect = [System.Drawing.Rectangle]::new($leftX, $imageY, $panelWidth, $panelHeight)
        $rightPanelRect = [System.Drawing.Rectangle]::new($rightX, $imageY, $panelWidth, $panelHeight)

        $panelBrush = New-Object System.Drawing.SolidBrush($panelBg)
        $graphics.FillRectangle($panelBrush, $leftPanelRect)
        $graphics.FillRectangle($panelBrush, $rightPanelRect)
        $graphics.DrawRectangle($framePen, $leftPanelRect)
        $graphics.DrawRectangle($framePen, $rightPanelRect)

        $graphics.DrawString($LeftLabel, $labelFont, $mutedBrush, $leftX, $headerHeight)
        $graphics.DrawString($RightLabel, $labelFont, $mutedBrush, $rightX, $headerHeight)

        $leftDrawRect = Get-FitRect -ImageWidth $referenceImage.Width -ImageHeight $referenceImage.Height -BoxWidth $panelWidth -BoxHeight $panelHeight -OriginX $leftX -OriginY $imageY
        $rightDrawRect = Get-FitRect -ImageWidth $currentImage.Width -ImageHeight $currentImage.Height -BoxWidth $panelWidth -BoxHeight $panelHeight -OriginX $rightX -OriginY $imageY

        $graphics.DrawImage($referenceImage, $leftDrawRect)
        $graphics.DrawImage($currentImage, $rightDrawRect)

        if ($footerHeight -gt 0) {
            $footerRect = [System.Drawing.RectangleF]::new($margin, $boardHeight - $footerHeight + 6, $boardWidth - ($margin * 2), $footerHeight - 10)
            $stringFormat = New-Object System.Drawing.StringFormat
            $stringFormat.Alignment = [System.Drawing.StringAlignment]::Near
            $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Near
            $graphics.DrawString($Footer, $footerFont, $mutedBrush, $footerRect, $stringFormat)
        }

        $bitmap.Save($outputFull, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
} finally {
    $referenceImage.Dispose()
    $currentImage.Dispose()
}

Write-Output "compare board saved: $outputFull"
