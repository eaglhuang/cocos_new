$base = "C:\Users\User\3KLife\artifacts\ui-library\title_stretch_x\general_detail\candidate_sets\candidate_batch_2026_04_09"
$tool = "C:\Users\User\3KLife\tools_node\remove-bg-flood-fill.js"

$nums = @(1,2,3,4,5,6,7,8,9)
foreach ($n in $nums) {
    $dir  = "$base\左右拉伸標題$n"
    $src  = "$dir\左右拉伸標題${n}_nobg.png"
    $out  = "$dir\左右拉伸標題${n}_nobg.png"
    if (Test-Path $src) {
        Write-Host "Processing 標題$n ..."
        node $tool --input $src --output $out --no-crop --fill-enclosed --report 2>&1 | Select-String '"foregroundCount"|"checkerboard"|"bgColors"' | Select-Object -First 5
    } else {
        Write-Host "SKIP 標題$n (not found)"
    }
}
Write-Host "Batch done."
