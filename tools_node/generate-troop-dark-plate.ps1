Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputDir = Join-Path $repoRoot 'artifacts\ui-generated\UI-2-0099-final-icons\underlay'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function New-RoundedRectPath {
    param(
        [single]$X,
        [single]$Y,
        [single]$Width,
        [single]$Height,
        [single]$Radius
    )

    $diameter = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-Plate {
    param(
        [int]$Size,
        [string]$OutputPath
    )

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $outerMargin = [int]($Size * 0.08)
    $outerSize = $Size - ($outerMargin * 2)
    $radius = [single]($Size * 0.15)
    $innerInset = [single]($Size * 0.055)

    $outerPath = New-RoundedRectPath -X $outerMargin -Y $outerMargin -Width $outerSize -Height $outerSize -Radius $radius
    $innerPath = New-RoundedRectPath -X ($outerMargin + $innerInset) -Y ($outerMargin + $innerInset) -Width ($outerSize - 2*$innerInset) -Height ($outerSize - 2*$innerInset) -Radius ($radius * 0.82)

    $shadowColor = [System.Drawing.Color]::FromArgb(130, 0, 0, 0)
    $shadowBrush = New-Object System.Drawing.SolidBrush $shadowColor
    $shadowMatrix = New-Object System.Drawing.Drawing2D.Matrix
    $shadowMatrix.Translate(($Size * 0.012), ($Size * 0.02))
    $shadowPath = $outerPath.Clone()
    $shadowPath.Transform($shadowMatrix)
    $graphics.FillPath($shadowBrush, $shadowPath)

    $outerBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $outerPath
    $outerBrush.CenterColor = [System.Drawing.Color]::FromArgb(255, 46, 53, 62)
    $outerBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(255, 24, 28, 34))
    $graphics.FillPath($outerBrush, $outerPath)

    $innerBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $innerPath
    $innerBrush.CenterColor = [System.Drawing.Color]::FromArgb(255, 38, 44, 52)
    $innerBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(255, 20, 24, 30))
    $graphics.FillPath($innerBrush, $innerPath)

    $outerPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(210, 120, 98, 48)), ([single]($Size * 0.014))
    $outerPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $graphics.DrawPath($outerPen, $outerPath)

    $innerPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 73, 83, 96)), ([single]($Size * 0.01))
    $innerPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $graphics.DrawPath($innerPen, $innerPath)

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $innerPen.Dispose(); $outerPen.Dispose(); $innerBrush.Dispose(); $outerBrush.Dispose(); $shadowBrush.Dispose(); $shadowPath.Dispose(); $shadowMatrix.Dispose(); $innerPath.Dispose(); $outerPath.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-Plate -Size 256 -OutputPath (Join-Path $outputDir 'troop_dark_plate_256.png')
New-Plate -Size 512 -OutputPath (Join-Path $outputDir 'troop_dark_plate_512.png')

Write-Host (Join-Path $outputDir 'troop_dark_plate_256.png')
Write-Host (Join-Path $outputDir 'troop_dark_plate_512.png')