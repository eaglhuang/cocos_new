param(
    [string]$SourcePath = "C:\Users\User\3KLife\assets\resources\ui-spec\placeholders\bg_ink_detail.png"
)

Add-Type -AssemblyName System.Drawing

$ProjectRoot = "C:\Users\User\3KLife"

function Parse-HexColor([string]$hex) {
    $value = $hex.TrimStart('#')
    if ($value.Length -eq 6) {
        return [System.Drawing.Color]::FromArgb(
            255,
            [Convert]::ToInt32($value.Substring(0, 2), 16),
            [Convert]::ToInt32($value.Substring(2, 2), 16),
            [Convert]::ToInt32($value.Substring(4, 2), 16)
        )
    }

    if ($value.Length -eq 8) {
        return [System.Drawing.Color]::FromArgb(
            [Convert]::ToInt32($value.Substring(0, 2), 16),
            [Convert]::ToInt32($value.Substring(2, 2), 16),
            [Convert]::ToInt32($value.Substring(4, 2), 16),
            [Convert]::ToInt32($value.Substring(6, 2), 16)
        )
    }

    throw "Unsupported color format: $hex"
}

function Ensure-Directory([string]$filePath) {
    $dir = Split-Path $filePath -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

function Draw-NineSliceVariant(
    [System.Drawing.Bitmap]$source,
    [string]$targetPath,
    [int]$width,
    [int]$height,
    [int[]]$sourceBorder,
    [int[]]$destBorder,
    [string]$centerOverlay
) {
    Ensure-Directory $targetPath

    $canvas = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $srcTop = $sourceBorder[0]
    $srcRight = $sourceBorder[1]
    $srcBottom = $sourceBorder[2]
    $srcLeft = $sourceBorder[3]

    $dstTop = $destBorder[0]
    $dstRight = $destBorder[1]
    $dstBottom = $destBorder[2]
    $dstLeft = $destBorder[3]

    $srcMidWidth = $source.Width - $srcLeft - $srcRight
    $srcMidHeight = $source.Height - $srcTop - $srcBottom
    $dstMidWidth = $width - $dstLeft - $dstRight
    $dstMidHeight = $height - $dstTop - $dstBottom

    $sRects = @(
        [System.Drawing.Rectangle]::new(0, 0, $srcLeft, $srcTop),
        [System.Drawing.Rectangle]::new($srcLeft, 0, $srcMidWidth, $srcTop),
        [System.Drawing.Rectangle]::new($source.Width - $srcRight, 0, $srcRight, $srcTop),
        [System.Drawing.Rectangle]::new(0, $srcTop, $srcLeft, $srcMidHeight),
        [System.Drawing.Rectangle]::new($srcLeft, $srcTop, $srcMidWidth, $srcMidHeight),
        [System.Drawing.Rectangle]::new($source.Width - $srcRight, $srcTop, $srcRight, $srcMidHeight),
        [System.Drawing.Rectangle]::new(0, $source.Height - $srcBottom, $srcLeft, $srcBottom),
        [System.Drawing.Rectangle]::new($srcLeft, $source.Height - $srcBottom, $srcMidWidth, $srcBottom),
        [System.Drawing.Rectangle]::new($source.Width - $srcRight, $source.Height - $srcBottom, $srcRight, $srcBottom)
    )

    $dRects = @(
        [System.Drawing.Rectangle]::new(0, 0, $dstLeft, $dstTop),
        [System.Drawing.Rectangle]::new($dstLeft, 0, $dstMidWidth, $dstTop),
        [System.Drawing.Rectangle]::new($width - $dstRight, 0, $dstRight, $dstTop),
        [System.Drawing.Rectangle]::new(0, $dstTop, $dstLeft, $dstMidHeight),
        [System.Drawing.Rectangle]::new($dstLeft, $dstTop, $dstMidWidth, $dstMidHeight),
        [System.Drawing.Rectangle]::new($width - $dstRight, $dstTop, $dstRight, $dstMidHeight),
        [System.Drawing.Rectangle]::new(0, $height - $dstBottom, $dstLeft, $dstBottom),
        [System.Drawing.Rectangle]::new($dstLeft, $height - $dstBottom, $dstMidWidth, $dstBottom),
        [System.Drawing.Rectangle]::new($width - $dstRight, $height - $dstBottom, $dstRight, $dstBottom)
    )

    for ($i = 0; $i -lt $sRects.Count; $i++) {
        $g.DrawImage($source, $dRects[$i], $sRects[$i], [System.Drawing.GraphicsUnit]::Pixel)
    }

    if ($centerOverlay) {
        $overlayColor = Parse-HexColor $centerOverlay
        $overlayBrush = New-Object System.Drawing.SolidBrush($overlayColor)
        $g.FillRectangle($overlayBrush, $dstLeft, $dstTop, $dstMidWidth, $dstMidHeight)
        $overlayBrush.Dispose()
    }

    $canvas.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $canvas.Dispose()
}

if (-not (Test-Path $SourcePath)) {
    throw "Source frame not found: $SourcePath"
}

$sourceImage = [System.Drawing.Bitmap]::FromFile($SourcePath)
$sourceBorder = @(176, 176, 176, 176)

$variants = @(
    @{
        Name = "section-card"
        Path = Join-Path $ProjectRoot "assets\resources\sprites\common\popup_card_bg.png"
        Width = 256
        Height = 192
        Border = @(40, 40, 40, 40)
        Overlay = $null
    },
    @{
        Name = "section-card-win"
        Path = Join-Path $ProjectRoot "assets\resources\sprites\common\popup_card_win.png"
        Width = 256
        Height = 192
        Border = @(40, 40, 40, 40)
        Overlay = "#244E2A88"
    },
    @{
        Name = "section-card-lose"
        Path = Join-Path $ProjectRoot "assets\resources\sprites\common\popup_card_lose.png"
        Width = 256
        Height = 192
        Border = @(40, 40, 40, 40)
        Overlay = "#5B1F2088"
    },
    @{
        Name = "drawer-root"
        Path = Join-Path $ProjectRoot "assets\resources\sprites\battle\unitinfo_root_bg.png"
        Width = 420
        Height = 560
        Border = @(56, 56, 56, 56)
        Overlay = $null
    },
    @{
        Name = "header-strip"
        Path = Join-Path $ProjectRoot "assets\resources\sprites\battle\unitinfo_header_bg.png"
        Width = 320
        Height = 112
        Border = @(28, 40, 28, 40)
        Overlay = "#00000022"
    },
    @{
        Name = "section-battle"
        Path = Join-Path $ProjectRoot "assets\resources\sprites\battle\unitinfo_section_bg.png"
        Width = 320
        Height = 184
        Border = @(36, 36, 36, 36)
        Overlay = "#00000018"
    }
)

Write-Host "Applying approved UI frame variants..." -ForegroundColor Cyan
foreach ($variant in $variants) {
    Draw-NineSliceVariant -source $sourceImage -targetPath $variant.Path -width $variant.Width -height $variant.Height -sourceBorder $sourceBorder -destBorder $variant.Border -centerOverlay $variant.Overlay
    Write-Host ("  ✓ {0}" -f $variant.Name) -ForegroundColor DarkGray
}

$sourceImage.Dispose()

Write-Host "Refreshing Cocos Creator Asset DB..." -ForegroundColor Cyan
curl.exe http://localhost:7456/asset-db/refresh