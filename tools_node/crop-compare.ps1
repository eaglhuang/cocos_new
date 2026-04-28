param(
  [string]$SrcPng,
  [string]$OutDir
)
Add-Type -AssemblyName System.Drawing

function Crop {
  param([string]$src, [string]$outPath, [int]$x, [int]$y, [int]$w, [int]$h, [int]$maxW)
  $img = [System.Drawing.Image]::FromFile($src)
  $r = New-Object System.Drawing.Rectangle $x, $y, $w, $h
  $bmp = ([System.Drawing.Bitmap]$img).Clone($r, $img.PixelFormat)
  $img.Dispose()
  $scale = $maxW / [double]$bmp.Width
  $nw = $maxW; $nh = [int][Math]::Round($bmp.Height * $scale)
  $dst = New-Object System.Drawing.Bitmap $nw, $nh
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($bmp, 0, 0, $nw, $nh)
  $g.Dispose(); $bmp.Dispose()
  $dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $dst.Dispose()
  Write-Host "saved $outPath"
}

# compare PNG is 3840x1080 (left=HTML 0..1919, right=UCUF 1920..3839)
Crop $SrcPng "$OutDir\gacha-bottom-html.png"    0    780 1920 300 480
Crop $SrcPng "$OutDir\gacha-bottom-ucuf.png" 1920  780 1920 300 480
Crop $SrcPng "$OutDir\gacha-banner-html.png"    0    0  700 280 350
Crop $SrcPng "$OutDir\gacha-banner-ucuf.png" 1920    0  700 280 350
Crop $SrcPng "$OutDir\gacha-right-html.png"  1350   0  570 860 285
Crop $SrcPng "$OutDir\gacha-right-ucuf.png"  3270   0  570 860 285
