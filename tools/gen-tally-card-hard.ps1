Add-Type -AssemblyName System.Drawing

function Parse-HexColor([string]$hex) {
    $hex = $hex.TrimStart('#')
    $r = [Convert]::ToInt32($hex.Substring(0,2),16)
    $g = [Convert]::ToInt32($hex.Substring(2,2),16)
    $b = [Convert]::ToInt32($hex.Substring(4,2),16)
    return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

function Add-RoundRect($path, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $r2 = $r * 2
    $path.AddArc($x, $y, $r2, $r2, 180, 90)
    $path.AddArc($x + $w - $r2, $y, $r2, $r2, 270, 90)
    $path.AddArc($x + $w - $r2, $y + $h - $r2, $r2, $r2, 0, 90)
    $path.AddArc($x, $y + $h - $r2, $r2, $r2, 90, 90)
    $path.CloseFigure()
}

$width = 64; $height = 80

$bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# ── Base gradient: deep iron-brown (#2A1D13) → near-black (#070605) ──────────
$clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
Add-RoundRect $clipPath 0 0 $width $height 8
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.PointF]::new(0,0), [System.Drawing.PointF]::new(0,$height),
    (Parse-HexColor '#2A1D13'), (Parse-HexColor '#070605')
)
$g.FillPath($grad, $clipPath)
$grad.Dispose()

# ── Organic mist blobs (warm bronze highlights) ───────────────────────────────
$mist = Parse-HexColor '#B8885A'
for ($i = 0; $i -lt 14; $i++) {
    $blobW = Get-Random -Minimum ([Math]::Max(10,[int]($width*0.14))) -Maximum ([Math]::Max(22,[int]($width*0.5)))
    $blobH = Get-Random -Minimum ([Math]::Max(8,[int]($height*0.1))) -Maximum ([Math]::Max(16,[int]($height*0.45)))
    $bx = Get-Random -Minimum 0 -Maximum ([Math]::Max(1, $width - $blobW))
    $by = Get-Random -Minimum 0 -Maximum ([Math]::Max(1, $height - $blobH))
    $alpha = Get-Random -Minimum 8 -Maximum 30
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, $mist.R, $mist.G, $mist.B))
    $g.FillEllipse($brush, [float]$bx, [float]$by, [float]$blobW, [float]$blobH)
    $brush.Dispose()
}

# ── Top highlight band (soft warm glow) ──────────────────────────────────────
$hlPath = New-Object System.Drawing.Drawing2D.GraphicsPath
Add-RoundRect $hlPath 2 2 ($width-4) ([Math]::Max(8,[int]($height*0.22))) 6
$hlBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 255, 240, 200))
$g.FillPath($hlBrush, $hlPath)
$hlBrush.Dispose(); $hlPath.Dispose()

# ── Inner bleed / border glow (warm bronze) ──────────────────────────────────
$tone = Parse-HexColor '#A06840'
for ($i = 0; $i -lt 7; $i++) {
    $alpha = 30 - ($i * 3)
    if ($alpha -le 0) { continue }
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($alpha, $tone.R, $tone.G, $tone.B), [float](2.5 + $i))
    $rectPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $inset = [float](1.5 + $i * 1.8)
    $rr = [Math]::Max(4, 8 - $i)
    Add-RoundRect $rectPath $inset $inset ($width - $inset*2) ($height - $inset*2) $rr
    $g.DrawPath($pen, $rectPath)
    $rectPath.Dispose(); $pen.Dispose()
}

# ── Gold accent outer rim (physical metal tally edge) ─────────────────────────
$accentPath = New-Object System.Drawing.Drawing2D.GraphicsPath
Add-RoundRect $accentPath 1.0 1.0 ($width-2) ($height-2) 7
$goldColor = Parse-HexColor '#C4A038'
$accentPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, $goldColor.R, $goldColor.G, $goldColor.B), 1.5)
$g.DrawPath($accentPen, $accentPath)
$accentPen.Dispose(); $accentPath.Dispose()

# ── Bottom shadow bar (depth weight) ─────────────────────────────────────────
$shadowGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.PointF]::new(0, [float]($height-10)),
    [System.Drawing.PointF]::new(0, [float]$height),
    [System.Drawing.Color]::FromArgb(0,0,0,0),
    [System.Drawing.Color]::FromArgb(80,0,0,0)
)
$g.FillRectangle($shadowGrad, [System.Drawing.RectangleF]::new(0, [float]($height-10), [float]$width, 10))
$shadowGrad.Dispose()

$g.Dispose()
$clipPath.Dispose()

$outPath = Join-Path $PSScriptRoot "..\assets\resources\sprites\battle\tally_card_bg_hard.png"
$outPath = [IO.Path]::GetFullPath($outPath)
$bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
Write-Host "Generated: $outPath"
