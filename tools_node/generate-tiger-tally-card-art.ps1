param()

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$spriteDir = Join-Path $repoRoot 'assets\resources\sprites\battle'
$qaDir = Join-Path $repoRoot 'artifacts\ui-qa\UI-2-0100'
$previewDir = Join-Path $qaDir 'preview'
$reportPath = Join-Path $qaDir 'generation-report.json'

foreach ($dir in @($spriteDir, $qaDir, $previewDir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

$canvasWidth = 512
$canvasHeight = 288
$strokeThin = 14.0
$strokeBold = 26.0
$specs = @(
    [PSCustomObject]@{
        Key = 'cavalry'
        Accent = [System.Drawing.Color]::FromArgb(220, 198, 148, 54)
        Highlight = [System.Drawing.Color]::FromArgb(255, 255, 241, 196)
        Mist = [System.Drawing.Color]::FromArgb(72, 98, 66, 28)
        Ground = [System.Drawing.Color]::FromArgb(84, 64, 40, 18)
        Silhouette = [System.Drawing.Color]::FromArgb(236, 18, 14, 10)
    },
    [PSCustomObject]@{
        Key = 'infantry'
        Accent = [System.Drawing.Color]::FromArgb(220, 86, 130, 168)
        Highlight = [System.Drawing.Color]::FromArgb(255, 236, 245, 255)
        Mist = [System.Drawing.Color]::FromArgb(72, 40, 62, 82)
        Ground = [System.Drawing.Color]::FromArgb(84, 40, 56, 76)
        Silhouette = [System.Drawing.Color]::FromArgb(236, 16, 22, 28)
    },
    [PSCustomObject]@{
        Key = 'shield'
        Accent = [System.Drawing.Color]::FromArgb(220, 128, 142, 154)
        Highlight = [System.Drawing.Color]::FromArgb(255, 246, 249, 252)
        Mist = [System.Drawing.Color]::FromArgb(72, 52, 58, 64)
        Ground = [System.Drawing.Color]::FromArgb(84, 50, 54, 60)
        Silhouette = [System.Drawing.Color]::FromArgb(236, 18, 20, 22)
    },
    [PSCustomObject]@{
        Key = 'archer'
        Accent = [System.Drawing.Color]::FromArgb(220, 88, 144, 120)
        Highlight = [System.Drawing.Color]::FromArgb(255, 240, 255, 228)
        Mist = [System.Drawing.Color]::FromArgb(72, 40, 68, 58)
        Ground = [System.Drawing.Color]::FromArgb(84, 40, 60, 50)
        Silhouette = [System.Drawing.Color]::FromArgb(236, 14, 18, 16)
    }
)

function New-Canvas {
    param(
        [int]$Width,
        [int]$Height
    )

    $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function New-Pen {
    param(
        [System.Drawing.Color]$Color,
        [single]$Width
    )

    $pen = New-Object System.Drawing.Pen $Color, $Width
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    return $pen
}

function Add-CommonBackground {
    param(
        [System.Drawing.Graphics]$Graphics,
        [object]$Spec
    )

    $mistRects = @(
        @{ X = 18; Y = 72; W = 228; H = 120 },
        @{ X = 156; Y = 82; W = 238; H = 112 },
        @{ X = 292; Y = 90; W = 176; H = 110 }
    )

    foreach ($rect in $mistRects) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse($rect.X, $rect.Y, $rect.W, $rect.H)
        $mistBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
        $mistBrush.CenterColor = $Spec.Mist
        $mistBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $Spec.Mist))
        $Graphics.FillPath($mistBrush, $path)
        $mistBrush.Dispose()
        $path.Dispose()
    }

    $groundPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $groundPath.AddBezier(0, 234, 118, 212, 290, 218, 512, 248)
    $groundPath.AddLine(512, 248, 512, 288)
    $groundPath.AddLine(512, 288, 0, 288)
    $groundPath.CloseFigure()
    $groundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(0, 208),
        [System.Drawing.PointF]::new(0, 288),
        [System.Drawing.Color]::FromArgb(0, $Spec.Ground),
        $Spec.Ground
    )
    $Graphics.FillPath($groundBrush, $groundPath)
    $groundBrush.Dispose()
    $groundPath.Dispose()

    $sweepPen = New-Pen ([System.Drawing.Color]::FromArgb(28, $Spec.Highlight)) ([single]4)
    $Graphics.DrawBezier($sweepPen, 18, 202, 138, 164, 302, 176, 490, 214)
    $sweepPen.Dispose()

    $midGlowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $midGlowPath.AddEllipse(48, 76, 356, 120)
    $midGlowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $midGlowPath
    $midGlowBrush.CenterColor = [System.Drawing.Color]::FromArgb(72, $Spec.Highlight)
    $midGlowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $Spec.Highlight))
    $Graphics.FillPath($midGlowBrush, $midGlowPath)
    $midGlowBrush.Dispose()
    $midGlowPath.Dispose()
}

function Add-MidBandPlate {
    param(
        [System.Drawing.Graphics]$Graphics,
        [object]$Spec,
        [int]$X,
        [int]$Y,
        [int]$W,
        [int]$H
    )

    $expandedWidth = [Math]::Min($canvasWidth - 8, [Math]::Round($W * 1.18))
    $expandedHeight = [Math]::Min($canvasHeight - 24, [Math]::Round($H * 1.24))
    $expandedX = [Math]::Max(4, [Math]::Round($X - (($expandedWidth - $W) / 2)))
    $expandedY = [Math]::Max(20, [Math]::Round($Y - (($expandedHeight - $H) / 2)))

    if (($expandedX + $expandedWidth) -gt ($canvasWidth - 4)) {
        $expandedX = $canvasWidth - 4 - $expandedWidth
    }
    if (($expandedY + $expandedHeight) -gt ($canvasHeight - 12)) {
        $expandedY = $canvasHeight - 12 - $expandedHeight
    }

    $outerRect = New-Object System.Drawing.Rectangle $expandedX, $expandedY, $expandedWidth, $expandedHeight
    $innerRect = New-Object System.Drawing.Rectangle ($expandedX + 6), ($expandedY + 8), ($expandedWidth - 12), ($expandedHeight - 16)

    $plateBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(236, $Spec.Accent))
    $bandBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(244, $Spec.Highlight))
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(56, 0, 0, 0))
    $Graphics.FillRectangle($shadowBrush, ($outerRect.X + 8), ($outerRect.Y + 8), $outerRect.Width, $outerRect.Height)
    $Graphics.FillRectangle($plateBrush, $outerRect)
    $Graphics.FillRectangle($bandBrush, $innerRect)

    $bandPen = New-Pen ([System.Drawing.Color]::FromArgb(156, $Spec.Silhouette)) ([single]4)
    $accentPen = New-Pen ([System.Drawing.Color]::FromArgb(220, $Spec.Accent)) ([single]6)
    $Graphics.DrawRectangle($accentPen, $outerRect)
    $Graphics.DrawRectangle($bandPen, $innerRect)

    $plateBrush.Dispose()
    $bandBrush.Dispose()
    $shadowBrush.Dispose()
    $bandPen.Dispose()
    $accentPen.Dispose()
}

function Add-FilledSilhouettePath {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.Drawing2D.GraphicsPath]$Path,
        [System.Drawing.Color]$FillColor
    )

    $brush = New-Object System.Drawing.SolidBrush $FillColor
    $Graphics.FillPath($brush, $Path)
    $brush.Dispose()
}

function Add-BannerMarks {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.Color]$Color,
        [int]$StartX,
        [int]$BaseY,
        [int]$Count,
        [int]$Gap,
        [int]$Height
    )

    $pen = New-Pen $Color ([single]4)
    for ($i = 0; $i -lt $Count; $i++) {
        $x = $StartX + ($i * $Gap)
        $Graphics.DrawLine($pen, $x, ($BaseY - $Height), $x, $BaseY)
        $Graphics.DrawLine($pen, $x, ($BaseY - $Height), ($x + 14), ($BaseY - $Height + 10))
    }
    $pen.Dispose()
}

function Invoke-ShadowedLines {
    param(
        [System.Drawing.Graphics]$Graphics,
        [object]$Spec,
        [scriptblock]$Body
    )

    $shadowPen = New-Pen ([System.Drawing.Color]::FromArgb(148, 0, 0, 0)) ([single]($strokeBold + 10))
    & $Body $shadowPen 10 10
    $shadowPen.Dispose()

    $bodyPen = New-Pen $Spec.Silhouette ([single]($strokeBold + 2))
    & $Body $bodyPen 0 0
    $bodyPen.Dispose()

    $edgePen = New-Pen ([System.Drawing.Color]::FromArgb(255, $Spec.Highlight)) ([single]($strokeThin - 2))
    & $Body $edgePen 0 0
    $edgePen.Dispose()
}

function Add-CavalryArt {
    param([System.Drawing.Graphics]$Graphics, [object]$Spec)

    Add-MidBandPlate $Graphics $Spec 20 72 400 138

    $bodyBrush = New-Object System.Drawing.SolidBrush $Spec.Silhouette
    $highlightBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(212, $Spec.Highlight))
    $Graphics.FillEllipse($highlightBrush, 74, 110, 214, 86)
    $Graphics.FillEllipse($bodyBrush, 98, 118, 154, 70)

    $horseHead = New-Object System.Drawing.Drawing2D.GraphicsPath
    $horseHead.AddPolygon(@(
        [System.Drawing.PointF]::new(208, 106),
        [System.Drawing.PointF]::new(282, 98),
        [System.Drawing.PointF]::new(332, 128),
        [System.Drawing.PointF]::new(324, 162),
        [System.Drawing.PointF]::new(256, 160),
        [System.Drawing.PointF]::new(214, 142),
        [System.Drawing.PointF]::new(178, 154),
        [System.Drawing.PointF]::new(164, 136)
    ))
    Add-FilledSilhouettePath $Graphics $horseHead $Spec.Silhouette
    $horseHead.Dispose()

    $legPen = New-Pen $Spec.Silhouette ([single]18)
    $Graphics.DrawLine($legPen, 138, 182, 116, 216)
    $Graphics.DrawLine($legPen, 196, 182, 176, 216)
    $legPen.Dispose()

    $lancePen = New-Pen $Spec.Silhouette ([single]28)
    $Graphics.DrawLine($lancePen, 206, 146, 396, 88)
    $lancePen.Dispose()

    $lanceEdge = New-Pen ([System.Drawing.Color]::FromArgb(255, $Spec.Highlight)) ([single]8)
    $Graphics.DrawLine($lanceEdge, 210, 146, 396, 90)
    $lanceEdge.Dispose()

    $bodyBrush.Dispose()
    $highlightBrush.Dispose()
}

function Add-InfantryArt {
    param([System.Drawing.Graphics]$Graphics, [object]$Spec)

    Add-MidBandPlate $Graphics $Spec 34 88 278 114

    $corePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $corePath.AddPolygon(@(
        [System.Drawing.PointF]::new(114, 178),
        [System.Drawing.PointF]::new(154, 140),
        [System.Drawing.PointF]::new(198, 120),
        [System.Drawing.PointF]::new(236, 134),
        [System.Drawing.PointF]::new(220, 164),
        [System.Drawing.PointF]::new(176, 182),
        [System.Drawing.PointF]::new(134, 194)
    ))
    Add-FilledSilhouettePath $Graphics $corePath $Spec.Silhouette
    $corePath.Dispose()

    $wallBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(94, $Spec.Accent))
    foreach ($x in @(70, 112, 154, 196, 238)) {
        $Graphics.FillRectangle($wallBrush, $x, 186, 28, 26)
    }
    $wallBrush.Dispose()

    $formationPen = New-Pen ([System.Drawing.Color]::FromArgb(132, $Spec.Highlight)) ([single]7)
    foreach ($x in @(84, 122, 160, 198, 236)) {
        $Graphics.DrawLine($formationPen, $x, 174, ($x + 16), 206)
    }
    $Graphics.DrawLine($formationPen, 74, 214, 276, 214)
    $formationPen.Dispose()

    Invoke-ShadowedLines $Graphics $Spec {
        param($Pen, $dx, $dy)
        $Graphics.DrawLine($Pen, (116 + $dx), (176 + $dy), (222 + $dx), (108 + $dy))
        $Graphics.DrawLine($Pen, (202 + $dx), (100 + $dy), (250 + $dx), (132 + $dy))
        $Graphics.DrawLine($Pen, (98 + $dx), (182 + $dy), (132 + $dx), (214 + $dy))
        $Graphics.DrawLine($Pen, (126 + $dx), (158 + $dy), (264 + $dx), (158 + $dy))
    }
}

function Add-ShieldArt {
    param([System.Drawing.Graphics]$Graphics, [object]$Spec)

    Add-MidBandPlate $Graphics $Spec 42 82 246 128

    $wallBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(88, $Spec.Accent))
    foreach ($x in @(74, 122, 170, 218, 266)) {
        $Graphics.FillRectangle($wallBrush, $x, 194, 32, 20)
    }
    $wallBrush.Dispose()

    $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shieldPath.AddPolygon(@(
        [System.Drawing.PointF]::new(176, 82),
        [System.Drawing.PointF]::new(246, 118),
        [System.Drawing.PointF]::new(232, 186),
        [System.Drawing.PointF]::new(176, 220),
        [System.Drawing.PointF]::new(120, 186),
        [System.Drawing.PointF]::new(106, 118)
    ))

    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(124, 8, 12, 16))
    $shadowMatrix = New-Object System.Drawing.Drawing2D.Matrix
    $shadowMatrix.Translate(10, 10)
    $shadowPath = $shieldPath.Clone()
    $shadowPath.Transform($shadowMatrix)
    $Graphics.FillPath($shadowBrush, $shadowPath)
    $shadowBrush.Dispose()
    $shadowMatrix.Dispose()
    $shadowPath.Dispose()

    $fillBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $shieldPath
    $fillBrush.CenterColor = $Spec.Silhouette
    $fillBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(178, $Spec.Silhouette))
    $Graphics.FillPath($fillBrush, $shieldPath)
    $fillBrush.Dispose()

    $outlinePen = New-Pen $Spec.Highlight ([single]16)
    $Graphics.DrawPath($outlinePen, $shieldPath)
    $outlinePen.Dispose()

    $corePen = New-Pen ([System.Drawing.Color]::FromArgb(255, 255, 252, 246)) ([single]10)
    $Graphics.DrawLine($corePen, 176, 110, 176, 194)
    $Graphics.DrawLine($corePen, 138, 160, 214, 160)
    $corePen.Dispose()

    $shieldPath.Dispose()
}

function Add-ArcherArt {
    param([System.Drawing.Graphics]$Graphics, [object]$Spec)

    Add-MidBandPlate $Graphics $Spec 34 72 392 138

    $plateGlow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, $Spec.Highlight))
    $Graphics.FillEllipse($plateGlow, 110, 92, 154, 102)
    $plateGlow.Dispose()

    $bowPen = New-Pen $Spec.Silhouette ([single]32)
    $bowRect = New-Object System.Drawing.Rectangle 84, 78, 154, 142
    $Graphics.DrawArc($bowPen, $bowRect, 262, 196)
    $bowPen.Dispose()

    $bowEdge = New-Pen ([System.Drawing.Color]::FromArgb(255, $Spec.Highlight)) ([single]8)
    $Graphics.DrawArc($bowEdge, $bowRect, 262, 196)
    $Graphics.DrawLine($bowEdge, 198, 96, 198, 202)
    $bowEdge.Dispose()

    $arrowPen = New-Pen $Spec.Silhouette ([single]28)
    $Graphics.DrawLine($arrowPen, 166, 148, 356, 148)
    $arrowPen.Dispose()

    $arrowEdge = New-Pen ([System.Drawing.Color]::FromArgb(255, $Spec.Highlight)) ([single]8)
    $Graphics.DrawLine($arrowEdge, 170, 148, 350, 148)
    $arrowEdge.Dispose()

    $arrowHead = New-Object System.Drawing.Drawing2D.GraphicsPath
    $arrowHead.AddPolygon(@(
        [System.Drawing.PointF]::new(380, 148),
        [System.Drawing.PointF]::new(332, 120),
        [System.Drawing.PointF]::new(332, 176)
    ))
    Add-FilledSilhouettePath $Graphics $arrowHead $Spec.Silhouette
    $arrowHead.Dispose()

    $fletchPen = New-Pen $Spec.Silhouette ([single]16)
    $Graphics.DrawLine($fletchPen, 170, 148, 142, 126)
    $Graphics.DrawLine($fletchPen, 170, 148, 142, 170)
    $fletchPen.Dispose()
}

function Add-TroopArt {
    param(
        [System.Drawing.Graphics]$Graphics,
        [object]$Spec
    )

    Add-CommonBackground -Graphics $Graphics -Spec $Spec

    switch ($Spec.Key) {
        'cavalry' { Add-CavalryArt -Graphics $Graphics -Spec $Spec }
        'infantry' { Add-InfantryArt -Graphics $Graphics -Spec $Spec }
        'shield' { Add-ShieldArt -Graphics $Graphics -Spec $Spec }
        'archer' { Add-ArcherArt -Graphics $Graphics -Spec $Spec }
        default { throw "Unsupported troop type: $($Spec.Key)" }
    }

    $anchorBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(1, 0, 0, 0))
    $Graphics.FillRectangle($anchorBrush, 0, 0, $canvasWidth, $canvasHeight)
    $anchorBrush.Dispose()
}

$outputs = @()

foreach ($spec in $specs) {
    $canvas = New-Canvas -Width $canvasWidth -Height $canvasHeight
    Add-TroopArt -Graphics $canvas.Graphics -Spec $spec

    $outPath = Join-Path $spriteDir ("tally_card_art_{0}.png" -f $spec.Key)
    $formalPath = Join-Path $spriteDir ("tally_card_art_{0}_formal.png" -f $spec.Key)
    $canvas.Bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Bitmap.Save($formalPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $outputs += [PSCustomObject]@{
        troopType = $spec.Key
        outputPath = $outPath
        formalOutputPath = $formalPath
        relativePath = $outPath.Substring($repoRoot.Length).TrimStart([char[]]'\\/')
        formalRelativePath = $formalPath.Substring($repoRoot.Length).TrimStart([char[]]'\\/')
        width = $canvasWidth
        height = $canvasHeight
    }

    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
}

$boardWidth = 1100
$boardHeight = 980
$board = New-Canvas -Width $boardWidth -Height $boardHeight
$board.Graphics.Clear([System.Drawing.Color]::FromArgb(255, 14, 18, 24))

$titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 232, 221, 191))
$labelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 202, 212, 220))
$subtitleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 126, 141, 157))
$titleFont = New-Object System.Drawing.Font 'Segoe UI', 26, ([System.Drawing.FontStyle]::Bold)
$labelFont = New-Object System.Drawing.Font 'Segoe UI', 16, ([System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font 'Segoe UI', 11, ([System.Drawing.FontStyle]::Regular)

$board.Graphics.DrawString('TigerTally Card Art QA Board', $titleFont, $titleBrush, 36, 24)
$board.Graphics.DrawString('UI-2-0100  middle-band readable silhouettes for runtime card slots', $subtitleFont, $subtitleBrush, 38, 64)

$slotW = 492
$slotH = 278
$marginX = 38
$marginTop = 106
$gapX = 34
$gapY = 32

for ($index = 0; $index -lt $outputs.Count; $index++) {
    $row = [Math]::Floor($index / 2)
    $col = $index % 2
    $x = $marginX + ($col * ($slotW + $gapX))
    $y = $marginTop + ($row * ($slotH + $gapY))

    $cardPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cardPath.AddRectangle((New-Object System.Drawing.Rectangle $x, $y, $slotW, $slotH))
    $cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 25, 31, 40))
    $board.Graphics.FillPath($cardBrush, $cardPath)
    $cardBrush.Dispose()

    $borderPen = New-Pen ([System.Drawing.Color]::FromArgb(255, 83, 95, 112)) ([single]2)
    $board.Graphics.DrawRectangle($borderPen, $x, $y, $slotW, $slotH)
    $borderPen.Dispose()
    $cardPath.Dispose()

    $image = [System.Drawing.Bitmap]::FromFile($outputs[$index].outputPath)
    $board.Graphics.DrawImage($image, $x + 18, $y + 22, $slotW - 36, 186)
    $image.Dispose()

    $label = $outputs[$index].troopType.ToUpperInvariant()
    $board.Graphics.DrawString($label, $labelFont, $labelBrush, ($x + 18), ($y + 220))
    $board.Graphics.DrawString($outputs[$index].relativePath.Replace('\\', '/'), $subtitleFont, $subtitleBrush, ($x + 18), ($y + 248))
}

$simTitleFont = New-Object System.Drawing.Font 'Segoe UI', 18, ([System.Drawing.FontStyle]::Bold)
$simLabelFont = New-Object System.Drawing.Font 'Segoe UI', 11, ([System.Drawing.FontStyle]::Bold)
$simSmallFont = New-Object System.Drawing.Font 'Segoe UI', 9, ([System.Drawing.FontStyle]::Regular)
$simTop = 714
$simCardW = 216
$simCardH = 148
$simGap = 28
$simTopShade = 44
$simBottomBar = 38

$board.Graphics.DrawString('Runtime Slot Simulation', $simTitleFont, $titleBrush, 36, 676)

for ($index = 0; $index -lt $outputs.Count; $index++) {
    $x = 38 + ($index * ($simCardW + $simGap))
    $y = $simTop
    $art = [System.Drawing.Bitmap]::FromFile($outputs[$index].outputPath)
    $board.Graphics.DrawImage($art, $x, $y, $simCardW, $simCardH)
    $art.Dispose()

    $shadeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(188, 9, 17, 27))
    $board.Graphics.FillRectangle($shadeBrush, $x, $y, $simCardW, $simTopShade)
    $board.Graphics.FillRectangle($shadeBrush, $x, ($y + $simCardH - $simBottomBar), $simCardW, $simBottomBar)
    $shadeBrush.Dispose()

    $borderPen = New-Pen ([System.Drawing.Color]::FromArgb(196, 86, 96, 114)) ([single]2)
    $board.Graphics.DrawRectangle($borderPen, $x, $y, $simCardW, $simCardH)
    $borderPen.Dispose()

    $board.Graphics.DrawString($outputs[$index].troopType.ToUpperInvariant(), $simLabelFont, $labelBrush, ($x + 8), ($y + 8))
    $board.Graphics.DrawString('ATK 40    HP 100', $simSmallFont, $subtitleBrush, ($x + 10), ($y + $simCardH - 24))
}

$boardPath = Join-Path $previewDir 'tiger-tally-card-art-board.png'
$board.Bitmap.Save($boardPath, [System.Drawing.Imaging.ImageFormat]::Png)

$titleBrush.Dispose()
$labelBrush.Dispose()
$subtitleBrush.Dispose()
$titleFont.Dispose()
$labelFont.Dispose()
$subtitleFont.Dispose()
$simTitleFont.Dispose()
$simLabelFont.Dispose()
$simSmallFont.Dispose()
$board.Graphics.Dispose()
$board.Bitmap.Dispose()

$report = [PSCustomObject]@{
    taskId = 'UI-2-0100'
    generatedAt = (Get-Date).ToString('o')
    assetCount = $outputs.Count
    outputDir = $spriteDir
    previewBoard = $boardPath
    outputs = $outputs
}

$report | ConvertTo-Json -Depth 6 | Set-Content -Path $reportPath -Encoding utf8

Write-Host "Generated TigerTally card art assets:"
foreach ($output in $outputs) {
    Write-Host (" - " + $output.relativePath)
}
Write-Host ("QA board: " + $boardPath)
Write-Host ("Report: " + $reportPath)