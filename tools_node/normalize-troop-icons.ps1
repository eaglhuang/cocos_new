param(
    [string]$LogicalBoxManifestPath
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$baseDir = Join-Path $repoRoot 'artifacts\ui-generated\UI-2-0099-final-icons'
$rawDir = Join-Path $baseDir 'raw'
$processedDir = Join-Path $baseDir 'processed'
$normalizedDir = Join-Path $baseDir 'normalized'
$compositedDir = Join-Path $baseDir 'composited'
$reportDir = Join-Path $baseDir 'reports'
$previewDir = Join-Path $baseDir 'preview'
$underlayPath = Join-Path $baseDir 'underlay\troop_dark_plate_256.png'

if ([string]::IsNullOrWhiteSpace($LogicalBoxManifestPath)) {
    $LogicalBoxManifestPath = Join-Path $repoRoot 'artifacts\ui-source\battle-scene-non-hud\tasks\battle-scene-non-hud-troop-type-logical-box-manifest.json'
}

foreach ($dir in @($normalizedDir, $compositedDir, $reportDir, $previewDir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

$canvasSize = 256
$outerMargin = [int]($canvasSize * 0.08)
$outerSize = $canvasSize - ($outerMargin * 2)
$innerInset = [single]($canvasSize * 0.055)
$innerFillSize = $outerSize - (2 * $innerInset)
$targetOccupancy = 0.80
$targetBox = [int][Math]::Round($innerFillSize * $targetOccupancy)
$backgroundThreshold = 34
$alphaFloor = 20

$iconNames = @('cavalry','infantry','shield','archer','pikeman','engineer','medic','navy')
$logicalBoxManifest = $null
$logicalBoxMembers = @{}

if (Test-Path $LogicalBoxManifestPath) {
    $manifestJson = [System.IO.File]::ReadAllText($LogicalBoxManifestPath, [System.Text.Encoding]::UTF8)
    $logicalBoxManifest = $manifestJson | ConvertFrom-Json
    foreach ($member in $logicalBoxManifest.members) {
        $logicalBoxMembers[$member.memberKey] = $member
    }
}

function Get-BackgroundColor {
    param([System.Drawing.Bitmap]$Bitmap)

    $width = [int]$Bitmap.Width
    $height = [int]$Bitmap.Height

    $points = @(
        [PSCustomObject]@{ X = 8; Y = 8 },
        [PSCustomObject]@{ X = ($width - 9); Y = 8 },
        [PSCustomObject]@{ X = 8; Y = ($height - 9) },
        [PSCustomObject]@{ X = ($width - 9); Y = ($height - 9) },
        [PSCustomObject]@{ X = [int]($width / 2); Y = 8 },
        [PSCustomObject]@{ X = [int]($width / 2); Y = ($height - 9) },
        [PSCustomObject]@{ X = 8; Y = [int]($height / 2) },
        [PSCustomObject]@{ X = ($width - 9); Y = [int]($height / 2) }
    )

    $sumR = 0; $sumG = 0; $sumB = 0
    foreach ($point in $points) {
        $color = $Bitmap.GetPixel($point.X, $point.Y)
        $sumR += $color.R
        $sumG += $color.G
        $sumB += $color.B
    }

    return [System.Drawing.Color]::FromArgb(255, [int]($sumR / $points.Count), [int]($sumG / $points.Count), [int]($sumB / $points.Count))
}

function Remove-Background {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [System.Drawing.Color]$Background,
        [int]$Threshold
    )

    $output = New-Object System.Drawing.Bitmap $Bitmap.Width, $Bitmap.Height

    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
        for ($x = 0; $x -lt $Bitmap.Width; $x++) {
            $color = $Bitmap.GetPixel($x, $y)
            $distance = [Math]::Sqrt(
                [Math]::Pow($color.R - $Background.R, 2) +
                [Math]::Pow($color.G - $Background.G, 2) +
                [Math]::Pow($color.B - $Background.B, 2)
            )

            if ($distance -le $Threshold) {
                $output.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $color.R, $color.G, $color.B))
            } else {
                $output.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $color.R, $color.G, $color.B))
            }
        }
    }

    return $output
}

function Get-AlphaBounds {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [int]$AlphaThreshold
    )

    $minX = $Bitmap.Width
    $minY = $Bitmap.Height
    $maxX = -1
    $maxY = -1

    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
        for ($x = 0; $x -lt $Bitmap.Width; $x++) {
            if ($Bitmap.GetPixel($x, $y).A -gt $AlphaThreshold) {
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if ($maxX -lt 0 -or $maxY -lt 0) {
        throw "No opaque bounds found."
    }

    return @{
        x = $minX
        y = $minY
        width = ($maxX - $minX + 1)
        height = ($maxY - $minY + 1)
    }
}

function Get-SourceBitmap {
    param(
        [string]$Name,
        [object]$MemberConfig,
        [string]$ProcessedDir,
        [string]$RawDir,
        [int]$BackgroundThreshold
    )

    $sourcePath = $null
    $sourceMode = 'raw-background-removal'

    if ($null -ne $MemberConfig -and $MemberConfig.sourcePath) {
        $candidatePath = Join-Path $repoRoot ([string]$MemberConfig.sourcePath)
        if (Test-Path $candidatePath) {
            $sourcePath = $candidatePath
        }
    }

    if (-not $sourcePath) {
        $processedPath = Join-Path $ProcessedDir ($Name + '_256.png')
        if (Test-Path $processedPath) {
            $sourcePath = $processedPath
            $sourceMode = 'processed-alpha-canvas'
        } else {
            $sourcePath = Join-Path $RawDir ($Name + '.png')
        }
    } elseif ($sourcePath -like '*_256.png') {
        $sourceMode = 'processed-alpha-canvas'
    }

    $sourceBitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)

    if ($sourceMode -eq 'processed-alpha-canvas') {
        return [PSCustomObject]@{
            source = $sourceBitmap
            working = $sourceBitmap
            sourcePath = $sourcePath
            sourceMode = $sourceMode
            ownsWorking = $false
        }
    }

    $background = Get-BackgroundColor -Bitmap $sourceBitmap
    $transparentBitmap = Remove-Background -Bitmap $sourceBitmap -Background $background -Threshold $BackgroundThreshold

    return [PSCustomObject]@{
        source = $sourceBitmap
        working = $transparentBitmap
        sourcePath = $sourcePath
        sourceMode = $sourceMode
        ownsWorking = $true
    }
}

function Get-LogicalBounds {
    param(
        [object]$MemberConfig,
        [hashtable]$FallbackBounds
    )

    if ($null -ne $MemberConfig -and $null -ne $MemberConfig.logicalBounds) {
        return @{
            x = [int]$MemberConfig.logicalBounds.x
            y = [int]$MemberConfig.logicalBounds.y
            width = [int]$MemberConfig.logicalBounds.width
            height = [int]$MemberConfig.logicalBounds.height
        }
    }

    return $FallbackBounds
}

function Get-RepoRelativePath {
    param([string]$Path)

    $absoluteRepoRoot = [System.IO.Path]::GetFullPath($repoRoot)
    $absolutePath = [System.IO.Path]::GetFullPath($Path)

    if ($absolutePath.StartsWith($absoluteRepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $absolutePath.Substring($absoluteRepoRoot.Length).TrimStart([char[]]"\\/")
    }

    return $absolutePath
}

function Crop-Bitmap {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [hashtable]$Bounds
    )

    $cropped = New-Object System.Drawing.Bitmap $Bounds.width, $Bounds.height
    $graphics = [System.Drawing.Graphics]::FromImage($cropped)
    $graphics.DrawImage($Bitmap, (New-Object System.Drawing.Rectangle 0, 0, $Bounds.width, $Bounds.height), (New-Object System.Drawing.Rectangle $Bounds.x, $Bounds.y, $Bounds.width, $Bounds.height), [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    return $cropped
}

function New-TransparentCanvas {
    param([int]$Size)

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function New-PreviewBoard {
    param(
        [string[]]$Names,
        [string]$CompositedDir,
        [string]$OutputPath,
        [int]$ThumbSize,
        [int]$Gap,
        [int]$Columns
    )

    $rows = [int][Math]::Ceiling($Names.Count / [double]$Columns)
    $previewWidth = ($Columns * ($ThumbSize + $Gap)) - $Gap
    $previewHeight = ($rows * ($ThumbSize + $Gap)) - $Gap
    $previewBitmap = New-Object System.Drawing.Bitmap $previewWidth, $previewHeight
    $previewGraphics = [System.Drawing.Graphics]::FromImage($previewBitmap)
    $previewGraphics.Clear([System.Drawing.Color]::Black)
    $previewGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $previewGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $previewGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    for ($index = 0; $index -lt $Names.Count; $index++) {
        $compositedPath = Join-Path $CompositedDir ($Names[$index] + '_on_plate_256.png')
        $image = [System.Drawing.Image]::FromFile($compositedPath)
        $x = ($index % $Columns) * ($ThumbSize + $Gap)
        $row = [int][Math]::Floor($index / [double]$Columns)
        $y = $row * ($ThumbSize + $Gap)
        $previewGraphics.DrawImage($image, $x, $y, $ThumbSize, $ThumbSize)
        $image.Dispose()
    }

    $previewBitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $previewGraphics.Dispose()
    $previewBitmap.Dispose()
}

$scaleReport = @()
$plateImage = [System.Drawing.Image]::FromFile($underlayPath)

foreach ($name in $iconNames) {
    $memberConfig = $null
    if ($logicalBoxMembers.ContainsKey($name)) {
        $memberConfig = $logicalBoxMembers[$name]
    }

    $sourceInfo = Get-SourceBitmap -Name $name -MemberConfig $memberConfig -ProcessedDir $processedDir -RawDir $rawDir -BackgroundThreshold $backgroundThreshold
    $source = $sourceInfo.source
    $workingBitmap = $sourceInfo.working
    $alphaBounds = Get-AlphaBounds -Bitmap $workingBitmap -AlphaThreshold $alphaFloor

    # Always use auto-detected alpha bounds for sizing and centering.
    # Manual logicalBounds from manifest are treated as documentation only.
    $scaleFactor = [Math]::Min($targetBox / [double]$alphaBounds.width, $targetBox / [double]$alphaBounds.height)
    $drawWidth = [int][Math]::Round($workingBitmap.Width * $scaleFactor)
    $drawHeight = [int][Math]::Round($workingBitmap.Height * $scaleFactor)
    $alphaCenterX = ([double]$alphaBounds.x) + ([double]$alphaBounds.width / 2.0)
    $alphaCenterY = ([double]$alphaBounds.y) + ([double]$alphaBounds.height / 2.0)
    $drawX = [int][Math]::Round(($canvasSize / 2.0) - ($alphaCenterX * $scaleFactor))
    $drawY = [int][Math]::Round(($canvasSize / 2.0) - ($alphaCenterY * $scaleFactor))

    $normalizedCanvas = New-TransparentCanvas -Size $canvasSize
    $normalizedCanvas.Graphics.DrawImage($workingBitmap, $drawX, $drawY, $drawWidth, $drawHeight)
    $normalizedAlphaBounds = Get-AlphaBounds -Bitmap $normalizedCanvas.Bitmap -AlphaThreshold $alphaFloor
    $normalizedPath = Join-Path $normalizedDir ($name + '_glyph_256.png')
    $normalizedCanvas.Bitmap.Save($normalizedPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $compositedCanvas = New-TransparentCanvas -Size $canvasSize
    $compositedCanvas.Graphics.DrawImage($plateImage, 0, 0, $canvasSize, $canvasSize)
    $compositedCanvas.Graphics.DrawImage($normalizedCanvas.Bitmap, 0, 0, $canvasSize, $canvasSize)
    $compositedPath = Join-Path $compositedDir ($name + '_on_plate_256.png')
    $compositedCanvas.Bitmap.Save($compositedPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $scaleReport += [PSCustomObject]@{
        name = $name
        normalizationMode = 'alpha-bounds-auto'
        sourcePath = Get-RepoRelativePath -Path $sourceInfo.sourcePath
        sourceMode = $sourceInfo.sourceMode
        sourceWidth = $source.Width
        sourceHeight = $source.Height
        alphaBounds = [PSCustomObject]@{
            x = $alphaBounds.x
            y = $alphaBounds.y
            width = $alphaBounds.width
            height = $alphaBounds.height
        }
        targetBox = $targetBox
        scaleFactor = [Math]::Round($scaleFactor, 4)
        drawWidth = $drawWidth
        drawHeight = $drawHeight
        drawX = $drawX
        drawY = $drawY
        normalizedAlphaBounds = [PSCustomObject]@{
            x = $normalizedAlphaBounds.x
            y = $normalizedAlphaBounds.y
            width = $normalizedAlphaBounds.width
            height = $normalizedAlphaBounds.height
        }
    }

    $compositedCanvas.Graphics.Dispose(); $compositedCanvas.Bitmap.Dispose()
    $normalizedCanvas.Graphics.Dispose(); $normalizedCanvas.Bitmap.Dispose()
    if ($sourceInfo.ownsWorking) {
        $workingBitmap.Dispose()
    }
    $source.Dispose()
}

$previewPath = Join-Path $previewDir 'final_icons_on_plate_uniform_128.png'
$reviewPreviewPath = Join-Path $previewDir 'final_icons_on_plate_uniform_review_2x4_128.png'
 $reviewTopPath = Join-Path $previewDir 'final_icons_on_plate_uniform_review_top4_128.png'
 $reviewBottomPath = Join-Path $previewDir 'final_icons_on_plate_uniform_review_bottom4_128.png'
 $reviewTop2x2Path = Join-Path $previewDir 'final_icons_on_plate_uniform_review_top4_2x2_128.png'
 $reviewBottom2x2Path = Join-Path $previewDir 'final_icons_on_plate_uniform_review_bottom4_2x2_128.png'
New-PreviewBoard -Names $iconNames -CompositedDir $compositedDir -OutputPath $previewPath -ThumbSize 128 -Gap 8 -Columns 4
New-PreviewBoard -Names $iconNames -CompositedDir $compositedDir -OutputPath $reviewPreviewPath -ThumbSize 128 -Gap 8 -Columns 2
New-PreviewBoard -Names $iconNames[0..3] -CompositedDir $compositedDir -OutputPath $reviewTopPath -ThumbSize 128 -Gap 8 -Columns 4
New-PreviewBoard -Names $iconNames[4..7] -CompositedDir $compositedDir -OutputPath $reviewBottomPath -ThumbSize 128 -Gap 8 -Columns 4
New-PreviewBoard -Names $iconNames[0..3] -CompositedDir $compositedDir -OutputPath $reviewTop2x2Path -ThumbSize 128 -Gap 8 -Columns 2
New-PreviewBoard -Names $iconNames[4..7] -CompositedDir $compositedDir -OutputPath $reviewBottom2x2Path -ThumbSize 128 -Gap 8 -Columns 2

$plateImage.Dispose()

$reportPath = Join-Path $reportDir 'uniform-scale-report.json'
$reportJson = $scaleReport | ConvertTo-Json -Depth 6
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($reportPath, ($reportJson + [Environment]::NewLine), $utf8NoBom)

# Auto-update manifest logicalBounds with detected alpha bounds
if (Test-Path $LogicalBoxManifestPath) {
    $manifestText = [System.IO.File]::ReadAllText($LogicalBoxManifestPath, [System.Text.Encoding]::UTF8)
    $manifestObj = $manifestText | ConvertFrom-Json
    foreach ($member in $manifestObj.members) {
        $matchReport = $scaleReport | Where-Object { $_.name -eq $member.memberKey }
        if ($null -ne $matchReport) {
            $member.logicalBounds = [PSCustomObject]@{
                x = $matchReport.alphaBounds.x
                y = $matchReport.alphaBounds.y
                width = $matchReport.alphaBounds.width
                height = $matchReport.alphaBounds.height
            }
        }
    }
    $manifestJson = $manifestObj | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText($LogicalBoxManifestPath, ($manifestJson + [Environment]::NewLine), $utf8NoBom)
    Write-Host "Manifest updated: $LogicalBoxManifestPath"
}

Write-Host $reportPath
Write-Host $previewPath
Write-Host $reviewPreviewPath
Write-Host $reviewTopPath
Write-Host $reviewBottomPath
Write-Host $reviewTop2x2Path
Write-Host $reviewBottom2x2Path