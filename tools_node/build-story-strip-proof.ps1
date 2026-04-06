param(
    [Parameter(Mandatory = $true)]
    [string]$Recipe
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function Resolve-FullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue
    )

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $PathValue))
}

function Ensure-Directory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )

    $dir = Split-Path -Parent $FilePath
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

function Get-ColumnWidths {
    param(
        [int[]]$Edges
    )

    $widths = @()
    for ($i = 0; $i -lt ($Edges.Length - 1); $i++) {
        $widths += ($Edges[$i + 1] - $Edges[$i])
    }
    return $widths
}

$recipeFull = Resolve-FullPath -PathValue $Recipe
if (-not (Test-Path -LiteralPath $recipeFull)) {
    throw "Recipe not found: $recipeFull"
}

$recipeJson = Get-Content -LiteralPath $recipeFull -Raw -Encoding UTF8 | ConvertFrom-Json
$crop = $recipeJson.cropRecipe
if (-not $crop) {
    throw "Recipe does not contain cropRecipe: $recipeFull"
}

$sourceImagePath = Resolve-FullPath -PathValue $recipeJson.sourceImagePath
if (-not (Test-Path -LiteralPath $sourceImagePath)) {
    throw "Source image not found: $sourceImagePath"
}

$outputFull = Resolve-FullPath -PathValue $recipeJson.outputAssetPath
Ensure-Directory -FilePath $outputFull

$columnEdges = @($crop.columnEdges)
$topRowStarts = @($crop.topRowStarts)
$bottomRowStarts = @($crop.bottomRowStarts)
$cropHeight = [int]$crop.cropHeight
$outputWidth = [int]$crop.outputSize[0]
$outputHeight = [int]$crop.outputSize[1]

if ($columnEdges.Count -lt 2) {
    throw "cropRecipe.columnEdges must contain at least 2 values"
}

$columnWidths = Get-ColumnWidths -Edges $columnEdges
if ($topRowStarts.Count -ne $columnWidths.Count -or $bottomRowStarts.Count -ne $columnWidths.Count) {
    throw "topRowStarts / bottomRowStarts count must match column count"
}

$segmentRects = @()
for ($i = 0; $i -lt $columnWidths.Count; $i++) {
    $segmentRects += [System.Drawing.Rectangle]::new([int]$columnEdges[$i], [int]$topRowStarts[$i], [int]$columnWidths[$i], $cropHeight)
}
for ($i = 0; $i -lt $columnWidths.Count; $i++) {
    $segmentRects += [System.Drawing.Rectangle]::new([int]$columnEdges[$i], [int]$bottomRowStarts[$i], [int]$columnWidths[$i], $cropHeight)
}

$sourceImage = [System.Drawing.Image]::FromFile($sourceImagePath)
try {
    $rawStripWidth = 0
    foreach ($rect in $segmentRects) {
        $rawStripWidth += $rect.Width
    }

    $rawStrip = New-Object System.Drawing.Bitmap($rawStripWidth, $cropHeight)
    try {
        $rawGraphics = [System.Drawing.Graphics]::FromImage($rawStrip)
        try {
            $rawGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $rawGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $rawGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $rawGraphics.Clear([System.Drawing.Color]::Transparent)

            $offsetX = 0
            foreach ($srcRect in $segmentRects) {
                $destRect = [System.Drawing.Rectangle]::new($offsetX, 0, $srcRect.Width, $cropHeight)
                $rawGraphics.DrawImage($sourceImage, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
                $offsetX += $srcRect.Width
            }
        } finally {
            $rawGraphics.Dispose()
        }

        $outputBitmap = New-Object System.Drawing.Bitmap($outputWidth, $outputHeight)
        try {
            $outputGraphics = [System.Drawing.Graphics]::FromImage($outputBitmap)
            try {
                $outputGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $outputGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $outputGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $outputGraphics.Clear([System.Drawing.Color]::Transparent)
                $destRect = [System.Drawing.Rectangle]::new(0, 0, $outputWidth, $outputHeight)
                $srcRect = [System.Drawing.Rectangle]::new(0, 0, $rawStrip.Width, $rawStrip.Height)
                $outputGraphics.DrawImage($rawStrip, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
            } finally {
                $outputGraphics.Dispose()
            }

            $outputBitmap.Save($outputFull, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $outputBitmap.Dispose()
        }
    } finally {
        $rawStrip.Dispose()
    }
} finally {
    $sourceImage.Dispose()
}

$summary = [ordered]@{
    recipe = $recipeFull
    sourceImage = $sourceImagePath
    output = $outputFull
    outputSize = "$outputWidth x $outputHeight"
    segments = $segmentRects.Count
}

$summary | ConvertTo-Json -Depth 4
