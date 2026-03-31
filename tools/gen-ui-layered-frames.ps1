param(
    [string]$SkinPath = "C:\Users\User\3KLife\assets\resources\ui-spec\skins",
    [string]$FamilyFilter = "",
    [switch]$Preview,
    [switch]$Apply,
    [switch]$RefreshCocos,
    [string]$PreviewRoot = "C:\Users\User\3KLife\artifacts\ui-layered-frames\preview",
    [string]$ReportPath = "C:\Users\User\3KLife\artifacts\ui-layered-frames\apply-report.json",

    # Button preview customization parameters
    [int]$ButtonRadius = 10,
    [int]$ButtonRimCount = 6,
    [int]$ButtonRimAlpha = 140,
    [int]$ButtonHighlightAlpha = 36,
    [int]$ButtonInnerShadowAlpha = 48,
    [int]$ButtonBottomShadowAlpha = 32,
    [int]$ButtonGrimeAlpha = 0,
    [int]$ButtonAccentBorderAlpha = 100,
    [string]$ButtonInkMode = "blobs",
    [string]$ButtonTop = "",
    [string]$ButtonBottom = "",
    [string]$ButtonAccent = "",
    [string]$ButtonVariantOverride = ""
)

Add-Type -AssemblyName System.Drawing

$ProjectRoot = "C:\Users\User\3KLife"
$SourceFramePath = Join-Path $ProjectRoot "assets\resources\ui-spec\placeholders\bg_ink_detail.png"

function Ensure-Directory([string]$filePath) {
    $dir = Split-Path $filePath -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

function Parse-HexColor([string]$hex) {
    if ([string]::IsNullOrWhiteSpace($hex)) {
        return [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
    }

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

function New-BitmapPair([int]$width, [int]$height) {
    $bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    return @($bitmap, $graphics)
}

function Add-RoundRect([System.Drawing.Drawing2D.GraphicsPath]$path, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $d = [Math]::Min($r * 2, [Math]::Min($w, $h))
    if ($d -lt 1 -or $w -le 0 -or $h -le 0) {
        # Fallback to rectangle when rounding is not possible
        $path.AddRectangle([System.Drawing.RectangleF]::new($x, $y, $w, $h))
        return
    }

    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
}

function Fill-WashTexture([System.Drawing.Graphics]$graphics, [int]$width, [int]$height, [string]$baseTop, [string]$baseBottom, [string]$mistColor, [float]$radius, [int]$seedOffset = 0) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundRect $path 0 0 $width $height $radius

    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(0, 0),
        [System.Drawing.PointF]::new(0, $height),
        (Parse-HexColor $baseTop),
        (Parse-HexColor $baseBottom)
    )
    $graphics.FillPath($gradient, $path)
    $gradient.Dispose()

    $mist = Parse-HexColor $mistColor
    for ($i = 0; $i -lt 18; $i++) {
        $blobW = Get-Random -Minimum ([Math]::Max(24, [int]($width * 0.1))) -Maximum ([Math]::Max(40, [int]($width * 0.45)))
        $blobH = Get-Random -Minimum ([Math]::Max(12, [int]($height * 0.18))) -Maximum ([Math]::Max(22, [int]($height * 0.8)))
        $x = Get-Random -Minimum (-[int]($blobW * 0.25)) -Maximum ([int]($width - $blobW * 0.35))
        $y = Get-Random -Minimum (-[int]($blobH * 0.2)) -Maximum ([int]($height - $blobH * 0.35))
        $alpha = Get-Random -Minimum 10 -Maximum 38
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, $mist.R, $mist.G, $mist.B))
        $graphics.FillEllipse($brush, $x, $y, $blobW, $blobH)
        $brush.Dispose()
    }

    $highlightPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundRect $highlightPath 2 2 ($width - 4) ([Math]::Max(8, [int]($height * 0.28))) ([Math]::Max(4, $radius - 2))
    $highlightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(24, 255, 246, 220))
    $graphics.FillPath($highlightBrush, $highlightPath)
    $highlightBrush.Dispose()
    $highlightPath.Dispose()
    $path.Dispose()
}

function Draw-InnerBleed([System.Drawing.Graphics]$graphics, [int]$width, [int]$height, [int[]]$border, [string]$tone) {
    $color = Parse-HexColor $tone
    for ($i = 0; $i -lt 7; $i++) {
        $alpha = 24 - ($i * 2)
        if ($alpha -le 0) { continue }
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($alpha, $color.R, $color.G, $color.B), [float](3 + $i))
        $rectPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $inset = [float](2 + $i * 2)
        $radius = [Math]::Max(8, [Math]::Min($border[0], $border[3]) - $i)
        Add-RoundRect $rectPath $inset $inset ($width - $inset * 2) ($height - $inset * 2) $radius
        $graphics.DrawPath($pen, $rectPath)
        $rectPath.Dispose()
        $pen.Dispose()
    }
}

function Draw-NineSliceFrame([string]$sourcePath, [string]$targetPath, [int]$width, [int]$height, [int[]]$sourceBorder, [int[]]$destBorder) {
    Ensure-Directory $targetPath
    $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
    $pair = New-BitmapPair $width $height
    $bitmap = $pair[0]
    $graphics = $pair[1]

    $srcTop = $sourceBorder[0]; $srcRight = $sourceBorder[1]; $srcBottom = $sourceBorder[2]; $srcLeft = $sourceBorder[3]
    $dstTop = $destBorder[0]; $dstRight = $destBorder[1]; $dstBottom = $destBorder[2]; $dstLeft = $destBorder[3]
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
        $graphics.DrawImage($source, $dRects[$i], $sRects[$i], [System.Drawing.GraphicsUnit]::Pixel)
    }

    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $clearBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Transparent)
    $graphics.FillRectangle($clearBrush, $dstLeft, $dstTop, $dstMidWidth, $dstMidHeight)
    $clearBrush.Dispose()
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver

    $glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 255, 227, 170), 1.5)
    $innerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundRect $innerPath ($dstLeft - 0.5) ($dstTop - 0.5) ($dstMidWidth + 1) ($dstMidHeight + 1) ([Math]::Max(8, $dstLeft - 4))
    $graphics.DrawPath($glowPen, $innerPath)
    $innerPath.Dispose()
    $glowPen.Dispose()

    $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    $source.Dispose()
}

function Save-Bitmap([System.Drawing.Bitmap]$bitmap, [string]$targetPath) {
    Ensure-Directory $targetPath
    $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
}

function Add-EdgeShadow([System.Drawing.Graphics]$graphics, [System.Drawing.Drawing2D.GraphicsPath]$path, [int]$width, [int]$y, [int]$bandHeight, [int]$alphaStart, [int]$alphaEnd) {
    if ($bandHeight -le 0) { return }

    $safeStart = [Math]::Max(0, [Math]::Min(255, $alphaStart))
    $safeEnd = [Math]::Max(0, [Math]::Min(255, $alphaEnd))
    $rect = [System.Drawing.Rectangle]::new(0, $y, $width, $bandHeight)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(0, $y),
        [System.Drawing.PointF]::new(0, ($y + $bandHeight)),
        [System.Drawing.Color]::FromArgb($safeStart, 0, 0, 0),
        [System.Drawing.Color]::FromArgb($safeEnd, 0, 0, 0)
    )

    $previousClip = $graphics.Clip
    $graphics.SetClip($path, [System.Drawing.Drawing2D.CombineMode]::Intersect)
    $graphics.FillRectangle($brush, $rect)
    $graphics.Clip = $previousClip
    $brush.Dispose()
}

function Add-ButtonGrime([System.Drawing.Graphics]$graphics, [int]$width, [int]$height, [int]$alpha, [string]$accentHex) {
    if ($alpha -le 0) { return }

    $accent = Parse-HexColor $accentHex
    for ($i = 0; $i -lt 10; $i++) {
        $blobW = Get-Random -Minimum ([Math]::Max(18, [int]($width * 0.06))) -Maximum ([Math]::Max(36, [int]($width * 0.18)))
        $blobH = Get-Random -Minimum ([Math]::Max(5, [int]($height * 0.04))) -Maximum ([Math]::Max(16, [int]($height * 0.12)))
        $x = Get-Random -Minimum 8 -Maximum ([Math]::Max(9, $width - $blobW - 8))
        $y = Get-Random -Minimum 8 -Maximum ([Math]::Max(9, $height - $blobH - 8))
        $blobAlpha = Get-Random -Minimum ([Math]::Max(1, [int]($alpha * 0.35))) -Maximum ([Math]::Max(2, $alpha))
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($blobAlpha, $accent.R, $accent.G, $accent.B))
        $graphics.FillEllipse($brush, $x, $y, $blobW, $blobH)
        $brush.Dispose()
    }

    for ($i = 0; $i -lt 5; $i++) {
        $lineAlpha = Get-Random -Minimum ([Math]::Max(1, [int]($alpha * 0.4))) -Maximum ([Math]::Max(2, [int]($alpha * 0.8)))
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($lineAlpha, 255, 250, 232), 1)
        $y = Get-Random -Minimum 10 -Maximum ([Math]::Max(11, $height - 10))
        $x1 = Get-Random -Minimum 12 -Maximum ([Math]::Max(13, [int]($width * 0.45)))
        $x2 = Get-Random -Minimum ([int]($width * 0.55)) -Maximum ([Math]::Max([int]($width * 0.56), $width - 12))
        $graphics.DrawLine($pen, $x1, $y, $x2, ($y + (Get-Random -Minimum -2 -Maximum 3)))
        $pen.Dispose()
    }
}

function Add-ButtonInkStrokes([System.Drawing.Graphics]$graphics, [System.Drawing.Drawing2D.GraphicsPath]$path, [int]$width, [int]$height, [int]$alpha) {
    if ($alpha -le 0) { return }

    $baseColor = Parse-HexColor '#2E1A0C'
    $previousClip = $graphics.Clip
    $graphics.SetClip($path, [System.Drawing.Drawing2D.CombineMode]::Intersect)

    for ($i = 0; $i -lt 4; $i++) {
        $strokeW = Get-Random -Minimum ([Math]::Max(120, [int]($width * 0.26))) -Maximum ([Math]::Max(220, [int]($width * 0.52)))
        $strokeH = Get-Random -Minimum ([Math]::Max(10, [int]($height * 0.07))) -Maximum ([Math]::Max(18, [int]($height * 0.14)))
        $x = Get-Random -Minimum (-20) -Maximum ([Math]::Max(1, $width - [int]($strokeW * 0.35)))
        $y = Get-Random -Minimum ([int]($height * 0.18)) -Maximum ([Math]::Max([int]($height * 0.2) + 1, [int]($height * 0.62)))
        $blobAlpha = Get-Random -Minimum ([Math]::Max(1, [int]($alpha * 0.45))) -Maximum ([Math]::Max(2, [int]($alpha * 0.95)))

        $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            [System.Drawing.PointF]::new($x, 0),
            [System.Drawing.PointF]::new(($x + $strokeW), 0),
            [System.Drawing.Color]::FromArgb(0, $baseColor.R, $baseColor.G, $baseColor.B),
            [System.Drawing.Color]::FromArgb($blobAlpha, $baseColor.R, $baseColor.G, $baseColor.B)
        )
        $blend = New-Object System.Drawing.Drawing2D.ColorBlend
        $blend.Colors = @(
            [System.Drawing.Color]::FromArgb(0, $baseColor.R, $baseColor.G, $baseColor.B),
            [System.Drawing.Color]::FromArgb($blobAlpha, $baseColor.R, $baseColor.G, $baseColor.B),
            [System.Drawing.Color]::FromArgb([int]($blobAlpha * 0.75), $baseColor.R, $baseColor.G, $baseColor.B),
            [System.Drawing.Color]::FromArgb(0, $baseColor.R, $baseColor.G, $baseColor.B)
        )
        $blend.Positions = @(0.0, 0.18, 0.78, 1.0)
        $brush.InterpolationColors = $blend
        $graphics.FillEllipse($brush, $x, $y, $strokeW, $strokeH)
        $brush.Dispose()
    }

    for ($i = 0; $i -lt 5; $i++) {
        $lineAlpha = Get-Random -Minimum ([Math]::Max(1, [int]($alpha * 0.28))) -Maximum ([Math]::Max(2, [int]($alpha * 0.6)))
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($lineAlpha, 255, 232, 182), 1)
        $y = Get-Random -Minimum ([int]($height * 0.2)) -Maximum ([Math]::Max([int]($height * 0.22), [int]($height * 0.72)))
        $x1 = Get-Random -Minimum 24 -Maximum ([Math]::Max(25, [int]($width * 0.28)))
        $length = Get-Random -Minimum ([int]($width * 0.16)) -Maximum ([Math]::Max([int]($width * 0.17), [int]($width * 0.34)))
        $x2 = [Math]::Min($width - 24, $x1 + $length)
        $graphics.DrawLine($pen, $x1, $y, $x2, ($y + (Get-Random -Minimum -1 -Maximum 2)))
        $pen.Dispose()
    }

    $graphics.Clip = $previousClip
}

function Add-ButtonSurfaceOverlay([System.Drawing.Graphics]$graphics, [System.Drawing.Drawing2D.GraphicsPath]$path, [int]$width, [int]$height, [int]$alpha, [string]$accentHex) {
    if ($alpha -le 0) { return }

    switch ($ButtonInkMode) {
        'horizontal-ink' { Add-ButtonInkStrokes $graphics $path $width $height $alpha }
        default { Add-ButtonGrime $graphics $width $height $alpha $accentHex }
    }
}

function Render-Fill([string]$targetPath, [int]$width, [int]$height, [int[]]$border, [string]$recipe) {
    $pair = New-BitmapPair $width $height
    $bitmap = $pair[0]
    $graphics = $pair[1]
    $radius = [Math]::Max(8, [Math]::Min($border[0], $border[3]))

    switch ($recipe) {
        'tab_plate' {
            Fill-WashTexture $graphics $width $height '#4F3D1F' '#23190D' '#F7D88A' $radius
        }
        'action_plate' {
            Fill-WashTexture $graphics $width $height '#342617' '#140F0C' '#DFAF4A' $radius
        }
        default {
            Fill-WashTexture $graphics $width $height '#191411' '#0E0C0B' '#8F7A60' $radius
        }
    }

    $graphics.Dispose()
    Save-Bitmap $bitmap $targetPath
}

function Render-Bleed([string]$targetPath, [int]$width, [int]$height, [int[]]$border, [string]$recipe) {
    $pair = New-BitmapPair $width $height
    $bitmap = $pair[0]
    $graphics = $pair[1]
    $tone = if ($recipe -eq 'tab_plate') { '#A17A2B' } else { '#6D5946' }
    Draw-InnerBleed $graphics $width $height $border $tone
    $graphics.Dispose()
    Save-Bitmap $bitmap $targetPath
}

function Render-Accent([string]$targetPath, [int]$width, [int]$height, [int[]]$border, [string]$recipe) {
    $pair = New-BitmapPair $width $height
    $bitmap = $pair[0]
    $graphics = $pair[1]
    $radius = [Math]::Max(8, [Math]::Min($border[0], $border[3]))

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundRect $path 3 3 ($width - 6) ($height - 6) $radius
    $penColor = if ($recipe -eq 'action_plate') { '#F5C85D' } else { '#FFE2A0' }
    $penBase = Parse-HexColor $penColor
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(125, $penBase.R, $penBase.G, $penBase.B), 2.5)
    $graphics.DrawPath($pen, $path)
    $path.Dispose()
    $pen.Dispose()

    $graphics.Dispose()
    Save-Bitmap $bitmap $targetPath
}

function Render-BakedPanel([string]$targetPath, [int]$width, [int]$height, [int[]]$border, [string]$recipe, [bool]$goldAccent = $false) {
    $pair = New-BitmapPair $width $height
    $bitmap = $pair[0]
    $graphics = $pair[1]
    $radius = [Math]::Max(8, [Math]::Min($border[0], $border[3]))
    Fill-WashTexture $graphics $width $height '#1A1412' '#0F0D0C' '#87715B' $radius
    Draw-InnerBleed $graphics $width $height $border '#6A5543'

    if ($goldAccent) {
        $accentPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        Add-RoundRect $accentPath 2 2 ($width - 4) ($height - 4) $radius
        $gold = Parse-HexColor '#E0BF6A'
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(95, $gold.R, $gold.G, $gold.B), 1.75)
        $graphics.DrawPath($pen, $accentPath)
        $pen.Dispose()
        $accentPath.Dispose()
    }

    $graphics.Dispose()
    Save-Bitmap $bitmap $targetPath
}

function Render-FieldBg([string]$targetPath, [int]$width, [int]$height, [int[]]$border, [string]$variant) {
    $pair = New-BitmapPair $width $height
    $bitmap = $pair[0]
    $graphics = $pair[1]
    $radius = [Math]::Max(8, [Math]::Min($border[0], $border[3]))

    switch ($variant) {
        'title' { Fill-WashTexture $graphics $width $height '#2E2418' '#15100E' '#C9A85E' $radius }
        'name'  { Fill-WashTexture $graphics $width $height '#221A14' '#100E0D' '#A89473' $radius }
        'meta'  { Fill-WashTexture $graphics $width $height '#181514' '#0E0D0C' '#7B6A58' $radius }
        default { Fill-WashTexture $graphics $width $height '#191613' '#0E0D0C' '#8A775F' $radius }
    }

    $penColor = Parse-HexColor '#8F785D'
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(55, $penColor.R, $penColor.G, $penColor.B), 1.25)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundRect $path 1.5 1.5 ($width - 3) ($height - 3) $radius
    $graphics.DrawPath($pen, $path)
    $path.Dispose()
    $pen.Dispose()

    $graphics.Dispose()
    Save-Bitmap $bitmap $targetPath
}

function Render-TabButton([string]$targetPath, [int]$width, [int]$height, [int[]]$border, [string]$state) {
    $pair = New-BitmapPair $width $height
    $bitmap = $pair[0]
    $graphics = $pair[1]
    $radius = [Math]::Max(12, [Math]::Min($border[0], $border[3]))
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundRect $path 1 1 ($width - 2) ($height - 2) $radius

    switch ($state) {
        'active' {
            $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.PointF]::new(0, 0), [System.Drawing.PointF]::new(0, $height), (Parse-HexColor '#CDA04A'), (Parse-HexColor '#4C3410'))
            $borderColor = '#FFE3A3'
            $innerColor = '#FFF1C6'
        }
        'disabled' {
            $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.PointF]::new(0, 0), [System.Drawing.PointF]::new(0, $height), (Parse-HexColor '#4A4032'), (Parse-HexColor '#231F1B'))
            $borderColor = '#8B7A63'
            $innerColor = '#7E715E'
        }
        default {
            $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.PointF]::new(0, 0), [System.Drawing.PointF]::new(0, $height), (Parse-HexColor '#8E6A2E'), (Parse-HexColor '#2B1D0C'))
            $borderColor = '#D1AF6A'
            $innerColor = '#F2D8A2'
        }
    }

    $graphics.FillPath($grad, $path)
    $grad.Dispose()

    for ($i = 0; $i -lt 5; $i++) {
        $alpha = 20 - ($i * 3)
        if ($alpha -le 0) { continue }
        $penBase = Parse-HexColor $borderColor
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($alpha, $penBase.R, $penBase.G, $penBase.B), [float](1.5 + $i))
        $outlinePath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $inset = [float](2 + $i)
        Add-RoundRect $outlinePath $inset $inset ($width - $inset * 2) ($height - $inset * 2) ([Math]::Max(10, $radius - $i))
        $graphics.DrawPath($pen, $outlinePath)
        $outlinePath.Dispose()
        $pen.Dispose()
    }

    $highlight = Parse-HexColor $innerColor
    $highlightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(45, $highlight.R, $highlight.G, $highlight.B))
    $graphics.FillRectangle($highlightBrush, 10, 8, $width - 20, [Math]::Max(10, [int]($height * 0.18)))
    $highlightBrush.Dispose()
    $path.Dispose()

    $graphics.Dispose()
    Save-Bitmap $bitmap $targetPath
}

function Render-Button([string]$targetPath, [int]$width, [int]$height, [int[]]$border, [string]$state, [string]$variant) {
    $pair = New-BitmapPair $width $height
    $bitmap = $pair[0]
    $graphics = $pair[1]

    # allow overriding variant via global param
    if (-not [string]::IsNullOrWhiteSpace($ButtonVariantOverride)) { $variant = $ButtonVariantOverride }

    # radius: prefer explicit ButtonRadius if provided
    if ($ButtonRadius -gt 0) { $radius = $ButtonRadius } else { $radius = [Math]::Max(10, [Math]::Min($border[0], $border[3])) }

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundRect $path 1 1 ($width - 2) ($height - 2) $radius

    switch ($variant) {
        'secondary' {
            $top = '#3A3A3A'
            $bottom = '#1D1D1D'
            $accent = '#BFB6A0'
        }
        'action' {
            $top = '#6A2E2E'
            $bottom = '#2D1616'
            $accent = '#E0A060'
        }
        'gold' {
            $top = '#FFE6B0'
            $bottom = '#C88E2E'
            $accent = '#FFDFA0'
        }
        default {
            $top = '#E6C77A'
            $bottom = '#8C5F2A'
            $accent = '#FFF3CF'
        }
    }

    # apply explicit color overrides if provided
    if (-not [string]::IsNullOrWhiteSpace($ButtonTop)) { $top = $ButtonTop }
    if (-not [string]::IsNullOrWhiteSpace($ButtonBottom)) { $bottom = $ButtonBottom }
    if (-not [string]::IsNullOrWhiteSpace($ButtonAccent)) { $accent = $ButtonAccent }

    switch ($state) {
        'active' {
            $gradTop = $accent
            $gradBottom = $bottom
        }
        'disabled' {
            $gradTop = '#4A4A4A'
            $gradBottom = '#2A2A2A'
        }
        default {
            $gradTop = $top
            $gradBottom = $bottom
        }
    }

    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.PointF]::new(0, 0), [System.Drawing.PointF]::new(0, $height), (Parse-HexColor $gradTop), (Parse-HexColor $gradBottom))
    $graphics.FillPath($grad, $path)
    $grad.Dispose()

    # top and bottom edge shadows to avoid a flat mobile-looking gradient
    Add-EdgeShadow $graphics $path $width 0 ([Math]::Max(8, [int]($height * 0.24))) $ButtonInnerShadowAlpha 0
    Add-EdgeShadow $graphics $path $width ([Math]::Max(0, $height - [Math]::Max(10, [int]($height * 0.28)))) ([Math]::Max(10, [int]($height * 0.28))) 0 $ButtonBottomShadowAlpha

    # configurable surface treatment: classic grime blobs or reference-like horizontal ink strokes
    Add-ButtonSurfaceOverlay $graphics $path $width $height $ButtonGrimeAlpha $accent

    # Metallic rim strokes (configurable count and alpha)
    $rimCount = [Math]::Max(1, [int]$ButtonRimCount)
    $step = [int]([Math]::Max(1, [Math]::Floor($ButtonRimAlpha / $rimCount)))
    for ($i = 0; $i -lt $rimCount; $i++) {
        $alpha = [Math]::Max(0, $ButtonRimAlpha - ($i * $step))
        $penColor = Parse-HexColor $accent
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($alpha, $penColor.R, $penColor.G, $penColor.B), [float](1 + $i * 0.5))
        $outlinePath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $inset = [float](1 + $i)
        Add-RoundRect $outlinePath $inset $inset ($width - $inset * 2) ($height - $inset * 2) ([Math]::Max(6, $radius - $i))
        $graphics.DrawPath($pen, $outlinePath)
        $outlinePath.Dispose()
        $pen.Dispose()
    }

    # subtle highlight (configurable alpha)
    $hAlpha = [Math]::Max(0, [int]$ButtonHighlightAlpha)
    $highlightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($hAlpha, 255, 255, 255))
    $graphics.FillRectangle($highlightBrush, 8, 6, $width - 16, [Math]::Max(8, [int]($height * 0.18)))
    $highlightBrush.Dispose()

    # small inner accent for primary/gold variants
    if ($variant -in @('gold','action','default')) {
        $accentPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        Add-RoundRect $accentPath 3 3 ($width - 6) ($height - 6) ([Math]::Max(6, $radius - 2))
        $gold = Parse-HexColor $accent
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($ButtonAccentBorderAlpha, $gold.R, $gold.G, $gold.B), 1.25)
        $graphics.DrawPath($pen, $accentPath)
        $pen.Dispose()
        $accentPath.Dispose()
    }

    $path.Dispose()
    $graphics.Dispose()
    Save-Bitmap $bitmap $targetPath
}

function Get-FamilyRecipe([string]$slotId) {
    if ($slotId -like 'detail.tab*') { return 'tab_plate' }
    if ($slotId -like 'detail.action*') { return 'action_plate' }
    if ($slotId -like 'detail.field*') { return 'field_wash' }
    return 'ornate_panel'
}

function Get-SizeHint([string]$slotId) {
    switch -Wildcard ($slotId) {
        'detail.header*' { return @(442, 196) }
        'detail.summary.card*' { return @(286, 92) }
        'detail.summary*' { return @(596, 92) }
        'detail.tabbar.rail*' { return @(112, 960) }
        'detail.tab.active*' { return @(96, 84) }
        'detail.tab.idle*' { return @(96, 84) }
        'detail.content*' { return @(720, 760) }
        'detail.section*' { return @(620, 184) }
        'detail.footer*' { return @(620, 88) }
        'detail.tree.node*' { return @(180, 65) }
        'detail.action*' { return @(180, 72) }
        'detail.field.title.bg' { return @(420, 68) }
        'detail.field.name.bg' { return @(420, 44) }
        'detail.field.meta.bg' { return @(420, 54) }
        'detail.field.bg' { return @(620, 40) }
        default { return @(512, 160) }
    }
}

function Get-TargetFile([string]$slotPath, [bool]$isPreview) {
    if ([string]::IsNullOrWhiteSpace($slotPath)) { return $null }

    $sp = $slotPath.ToString()
    # strip common suffixes like '/spriteFrame' or '/sprite_frame'
    $sp = $sp -replace '/?spriteFrame$',''
    $sp = $sp -replace '/?sprite_frame$',''
    $sp = $sp.TrimEnd('/')

    if ($isPreview) {
        return Join-Path $PreviewRoot (($sp -replace '/', '\\') + '.png')
    }

    return Join-Path $ProjectRoot ('assets\resources\' + ($sp -replace '/', '\\') + '.png')
}

function Collect-SkinFiles([string]$skinPath) {
    if (Test-Path $skinPath -PathType Leaf) {
        return @($skinPath)
    }

    return Get-ChildItem -Path $skinPath -Filter *.json | ForEach-Object { $_.FullName }
}

$generated = New-Object System.Collections.Generic.List[object]
$skinFiles = Collect-SkinFiles $SkinPath
$sourceBorder = @(176, 176, 176, 176)

foreach ($skinFile in $skinFiles) {
    $json = $null
    try {
        $jsonText = Get-Content -Path $skinFile -Raw
        $json = $jsonText | ConvertFrom-Json
    } catch {
        Write-Host ("Warning: failed to parse JSON: {0} -- {1}" -f $skinFile, $_.Exception.Message) -ForegroundColor Yellow
        continue
    }

    if (-not $json.slots) {
        Write-Host ("Warning: no slots in skin: {0}" -f $skinFile) -ForegroundColor Yellow
        continue
    }

    foreach ($slotProperty in $json.slots.PSObject.Properties) {
        $slotId = $slotProperty.Name
        $slot = $slotProperty.Value

        if ($FamilyFilter -and -not ($slotId.StartsWith($FamilyFilter))) {
            continue
        }

        if ($slot.kind -eq 'sprite-frame') {
            $targetFile = Get-TargetFile $slot.path $Preview.IsPresent
            $sizeHint = Get-SizeHint $slotId
            $border = if ($slot.border) { @($slot.border[0], $slot.border[1], $slot.border[2], $slot.border[3]) } else { @(24, 24, 24, 24) }
            $recipe = Get-FamilyRecipe $slotId

            if ($slotId -match '\.frame$') {
                Draw-NineSliceFrame $SourceFramePath $targetFile $sizeHint[0] $sizeHint[1] $sourceBorder $border
                $generated.Add([pscustomobject]@{ slot = $slotId; file = $targetFile; kind = 'frame'; recipe = $recipe }) | Out-Null
                continue
            }

            if ($slotId -match '\.fill$') {
                Render-Fill $targetFile $sizeHint[0] $sizeHint[1] $border $recipe
                $generated.Add([pscustomobject]@{ slot = $slotId; file = $targetFile; kind = 'fill'; recipe = $recipe }) | Out-Null
                continue
            }

            if ($slotId -match '\.bleed$') {
                Render-Bleed $targetFile $sizeHint[0] $sizeHint[1] $border $recipe
                $generated.Add([pscustomobject]@{ slot = $slotId; file = $targetFile; kind = 'bleed'; recipe = $recipe }) | Out-Null
                continue
            }

            if ($slotId -match '\.accent$') {
                Render-Accent $targetFile $sizeHint[0] $sizeHint[1] $border $recipe
                $generated.Add([pscustomobject]@{ slot = $slotId; file = $targetFile; kind = 'accent'; recipe = $recipe }) | Out-Null
                continue
            }

            if ($slotId -like 'detail.field*.bg') {
                $variant = if ($slotId -like '*title*') { 'title' } elseif ($slotId -like '*name*') { 'name' } elseif ($slotId -like '*meta*') { 'meta' } else { 'field' }
                Render-FieldBg $targetFile $sizeHint[0] $sizeHint[1] $border $variant
                $generated.Add([pscustomobject]@{ slot = $slotId; file = $targetFile; kind = 'field'; recipe = $variant }) | Out-Null
                continue
            }

            if ($slotId -in @('detail.header.bg', 'detail.summary.bg', 'detail.summary.card', 'detail.tabbar.bg', 'detail.content.bg', 'detail.section.bg', 'detail.footer.bg', 'detail.tree.node')) {
                $goldAccent = $slotId -like 'detail.summary.card' -or $slotId -like 'detail.section.bg'
                Render-BakedPanel $targetFile $sizeHint[0] $sizeHint[1] $border $recipe $goldAccent
                $generated.Add([pscustomobject]@{ slot = $slotId; file = $targetFile; kind = 'baked'; recipe = $recipe }) | Out-Null
                continue
            }
        }

        if ($slot.kind -eq 'button-skin') {
            $border = if ($slot.border) { @($slot.border[0], $slot.border[1], $slot.border[2], $slot.border[3]) } else { @(24, 24, 24, 24) }
            $sizeHint = Get-SizeHint $slotId
            $normalFile = Get-TargetFile $slot.normal $Preview.IsPresent
            $pressedFile = Get-TargetFile $slot.pressed $Preview.IsPresent
            $disabledFile = Get-TargetFile $slot.disabled $Preview.IsPresent

            # Decide variant from slotId or metadata
            $variant = 'default'
            if ($slotId -match 'primary' -or ($slot.labelColor -and $slot.labelColor -match 'D4AF37')) { $variant = 'gold' }
            elseif ($slotId -match 'secondary') { $variant = 'secondary' }
            elseif ($slotId -match 'action') { $variant = 'action' }

            if ($slotId -like '*tab*') {
                Render-TabButton $normalFile $sizeHint[0] $sizeHint[1] $border 'idle'
                Render-TabButton $pressedFile $sizeHint[0] $sizeHint[1] $border 'active'
                Render-TabButton $disabledFile $sizeHint[0] $sizeHint[1] $border 'disabled'
                $generated.Add([pscustomobject]@{ slot = "$slotId.normal"; file = $normalFile; kind = 'button'; recipe = 'tab_idle' }) | Out-Null
                $generated.Add([pscustomobject]@{ slot = "$slotId.pressed"; file = $pressedFile; kind = 'button'; recipe = 'tab_active' }) | Out-Null
                $generated.Add([pscustomobject]@{ slot = "$slotId.disabled"; file = $disabledFile; kind = 'button'; recipe = 'tab_disabled' }) | Out-Null
            } else {
                # Generic metal button
                Render-Button $normalFile $sizeHint[0] $sizeHint[1] $border 'normal' $variant
                Render-Button $pressedFile $sizeHint[0] $sizeHint[1] $border 'active' $variant
                Render-Button $disabledFile $sizeHint[0] $sizeHint[1] $border 'disabled' $variant
                $generated.Add([pscustomobject]@{ slot = "$slotId.normal"; file = $normalFile; kind = 'button'; recipe = 'metal_normal' }) | Out-Null
                $generated.Add([pscustomobject]@{ slot = "$slotId.pressed"; file = $pressedFile; kind = 'button'; recipe = 'metal_active' }) | Out-Null
                $generated.Add([pscustomobject]@{ slot = "$slotId.disabled"; file = $disabledFile; kind = 'button'; recipe = 'metal_disabled' }) | Out-Null
            }
        }
    }
}

Ensure-Directory $ReportPath
$reportJson = $generated | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ReportPath, $reportJson, $utf8NoBom)

Write-Host ("Generated {0} layered-frame assets." -f $generated.Count) -ForegroundColor Green
Write-Host ("Report: {0}" -f $ReportPath) -ForegroundColor DarkGray

if ($RefreshCocos) {
    Write-Host 'Refreshing Cocos Creator Asset DB...' -ForegroundColor Cyan
    curl.exe http://localhost:7456/asset-db/refresh | Out-Null
}
