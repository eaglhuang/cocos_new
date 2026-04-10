Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$outputDir = Join-Path $PSScriptRoot '..\artifacts\ui-qa\UI-2-0099\glyphs'
$outputDir = [System.IO.Path]::GetFullPath($outputDir)

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$size = 256
$stroke = 16
$foreground = [System.Drawing.Color]::FromArgb(245, 248, 250)

function New-IconCanvas {
    param([int]$CanvasSize)

    $bitmap = New-Object System.Drawing.Bitmap $CanvasSize, $CanvasSize
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function New-Pen {
    param([System.Drawing.Color]$Color, [single]$Width)

    $pen = New-Object System.Drawing.Pen $Color, $Width
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    return $pen
}

function Draw-Pikeman {
    param($Graphics, $Pen)

    $Graphics.DrawLine($Pen, 70, 186, 188, 68)
    $Graphics.DrawLine($Pen, 182, 62, 208, 88)
    $Graphics.DrawLine($Pen, 188, 68, 218, 38)
}

function Draw-Archer {
    param($Graphics, $Pen)

    $rect = New-Object System.Drawing.Rectangle 72, 48, 86, 160
    $Graphics.DrawArc($Pen, $rect, 270, 180)
    $Graphics.DrawLine($Pen, 146, 60, 146, 196)
    $Graphics.DrawLine($Pen, 114, 128, 200, 128)
    $Graphics.DrawLine($Pen, 176, 108, 200, 128)
    $Graphics.DrawLine($Pen, 176, 148, 200, 128)
}

function Draw-Shield {
    param($Graphics, $Pen)

    $points = @(
        (New-Object System.Drawing.PointF 128, 44),
        (New-Object System.Drawing.PointF 188, 76),
        (New-Object System.Drawing.PointF 176, 164),
        (New-Object System.Drawing.PointF 128, 214),
        (New-Object System.Drawing.PointF 80, 164),
        (New-Object System.Drawing.PointF 68, 76)
    )
    $Graphics.DrawPolygon($Pen, $points)
    $Graphics.DrawLine($Pen, 128, 78, 128, 178)
}

function Draw-Infantry {
    param($Graphics, $Pen)

    $Graphics.DrawLine($Pen, 86, 176, 170, 92)
    $Graphics.DrawLine($Pen, 156, 78, 184, 106)
    $Graphics.DrawLine($Pen, 70, 186, 94, 210)
    $Graphics.DrawLine($Pen, 100, 160, 192, 160)
}

function Draw-Cavalry {
    param($Graphics, $Pen)

    $points = @(
        (New-Object System.Drawing.PointF 74, 162),
        (New-Object System.Drawing.PointF 92, 112),
        (New-Object System.Drawing.PointF 136, 82),
        (New-Object System.Drawing.PointF 176, 88),
        (New-Object System.Drawing.PointF 196, 120),
        (New-Object System.Drawing.PointF 184, 154),
        (New-Object System.Drawing.PointF 150, 170),
        (New-Object System.Drawing.PointF 136, 206)
    )
    $Graphics.DrawLines($Pen, $points)
    $Graphics.DrawLine($Pen, 158, 90, 188, 60)
}

function Draw-Engineer {
    param($Graphics, $Pen)

    $Graphics.DrawLine($Pen, 82, 174, 172, 84)
    $Graphics.DrawLine($Pen, 68, 188, 96, 216)
    $Graphics.DrawLine($Pen, 160, 72, 188, 100)
    $Graphics.DrawLine($Pen, 166, 90, 208, 48)
    $Graphics.DrawLine($Pen, 178, 102, 220, 60)
}

function Draw-Medic {
    param($Graphics, $Pen)

    $Graphics.DrawLine($Pen, 128, 60, 128, 196)
    $Graphics.DrawLine($Pen, 60, 128, 196, 128)
}

function Draw-Navy {
    param($Graphics, $Pen)

    $Graphics.DrawLine($Pen, 128, 52, 128, 176)
    $Graphics.DrawArc($Pen, 80, 150, 96, 74, 0, 180)
    $Graphics.DrawLine($Pen, 80, 184, 58, 206)
    $Graphics.DrawLine($Pen, 176, 184, 198, 206)
    $Graphics.DrawLine($Pen, 96, 206, 160, 206)
}

$iconMap = [ordered]@{
    cavalry = ${function:Draw-Cavalry}
    infantry = ${function:Draw-Infantry}
    shield = ${function:Draw-Shield}
    archer = ${function:Draw-Archer}
    pikeman = ${function:Draw-Pikeman}
    engineer = ${function:Draw-Engineer}
    medic = ${function:Draw-Medic}
    navy = ${function:Draw-Navy}
}

foreach ($entry in $iconMap.GetEnumerator()) {
    $canvas = New-IconCanvas -CanvasSize $size
    $graphics = $canvas.Graphics
    $bitmap = $canvas.Bitmap
    $pen = New-Pen -Color $foreground -Width $stroke

    & $entry.Value $graphics $pen

    $outPath = Join-Path $outputDir ("troop_{0}.png" -f $entry.Key)
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()

    Write-Host ("generated " + $outPath)
}