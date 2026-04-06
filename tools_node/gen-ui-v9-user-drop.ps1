$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$picturesRoot = Join-Path $env:USERPROFILE 'Pictures'
$outputDir = 'C:\Users\User\3KLife\assets\resources\sprites\ui_families\general_detail\v3_final'

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Save-CroppedResizedPng {
    param(
        [string]$SourcePath,
        [int]$CropX,
        [int]$CropY,
        [int]$CropWidth,
        [int]$CropHeight,
        [int]$OutWidth,
        [int]$OutHeight,
        [string]$DestPath
    )

    $src = [System.Drawing.Bitmap]::new($SourcePath)
    try {
        $dest = [System.Drawing.Bitmap]::new($OutWidth, $OutHeight)
        try {
            $g = [System.Drawing.Graphics]::FromImage($dest)
            try {
                $g.Clear([System.Drawing.Color]::Transparent)
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $srcRect = [System.Drawing.Rectangle]::new($CropX, $CropY, $CropWidth, $CropHeight)
                $dstRect = [System.Drawing.Rectangle]::new(0, 0, $OutWidth, $OutHeight)
                $g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
            } finally {
                $g.Dispose()
            }

            $dest.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $dest.Dispose()
        }
    } finally {
        $src.Dispose()
    }
}

function Save-CroppedResizedCirclePng {
    param(
        [string]$SourcePath,
        [int]$CropX,
        [int]$CropY,
        [int]$CropWidth,
        [int]$CropHeight,
        [int]$OutWidth,
        [int]$OutHeight,
        [string]$DestPath
    )

    $src = [System.Drawing.Bitmap]::new($SourcePath)
    try {
        $dest = [System.Drawing.Bitmap]::new($OutWidth, $OutHeight)
        try {
            $g = [System.Drawing.Graphics]::FromImage($dest)
            try {
                $g.Clear([System.Drawing.Color]::Transparent)
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

                $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
                try {
                    $path.AddEllipse(0, 0, $OutWidth - 1, $OutHeight - 1)
                    $g.SetClip($path)

                    $srcRect = [System.Drawing.Rectangle]::new($CropX, $CropY, $CropWidth, $CropHeight)
                    $dstRect = [System.Drawing.Rectangle]::new(0, 0, $OutWidth, $OutHeight)
                    $g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
                } finally {
                    $path.Dispose()
                }
            } finally {
                $g.Dispose()
            }

            $dest.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $dest.Dispose()
        }
    } finally {
        $src.Dispose()
    }
}

function Resolve-SourceImage {
    param([string]$FileName)

    $match = Get-ChildItem -Path $picturesRoot -Recurse -File -Filter $FileName |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $match) {
        throw "Missing source image: $FileName"
    }

    return $match.FullName
}

$jobs = @(
    @{
        Source = (Resolve-SourceImage 'crest_ring_v9_a.png.png')
        CropX = 0
        CropY = 0
        CropWidth = 1024
        CropHeight = 1024
        OutWidth = 220
        OutHeight = 220
        Dest = (Join-Path $outputDir 'crest_ring_v9.png')
        Circle = $true
    },
    @{
        Source = (Resolve-SourceImage 'crest_face_v9_b.png.jpeg')
        CropX = 0
        CropY = 0
        CropWidth = 1024
        CropHeight = 1024
        OutWidth = 180
        OutHeight = 180
        Dest = (Join-Path $outputDir 'crest_face_v9.png')
        Circle = $true
    },
    @{
        Source = (Resolve-SourceImage 'story_strip_v9_b.png.png')
        CropX = 0
        CropY = 166
        CropWidth = 5088
        CropHeight = 500
        OutWidth = 1400
        OutHeight = 138
        Dest = (Join-Path $outputDir 'story_strip_art_v9.png')
    }
)

foreach ($job in $jobs) {
    if ($job.Circle) {
        Save-CroppedResizedCirclePng `
            -SourcePath $job.Source `
            -CropX $job.CropX `
            -CropY $job.CropY `
            -CropWidth $job.CropWidth `
            -CropHeight $job.CropHeight `
            -OutWidth $job.OutWidth `
            -OutHeight $job.OutHeight `
            -DestPath $job.Dest
    } else {
        Save-CroppedResizedPng `
            -SourcePath $job.Source `
            -CropX $job.CropX `
            -CropY $job.CropY `
            -CropWidth $job.CropWidth `
            -CropHeight $job.CropHeight `
            -OutWidth $job.OutWidth `
            -OutHeight $job.OutHeight `
            -DestPath $job.Dest
    }

    Write-Host "Generated $($job.Dest)"
}
