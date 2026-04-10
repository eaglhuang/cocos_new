$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputDir = Join-Path $repoRoot 'artifacts\ui-qa\UI-2-0099\banana1-v2'

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$common = @'
premium ancient warfare UI emblem, art-director approved icon family, same visual grammar across the whole set, one dominant silhouette with at most one supporting shape, strong negative space, very clean readable emblem for 256x256 and 64px icon use, centered single emblem, flat gold shape language, minimal inner detail, same stroke weight across all icons, no filigree, no ornamental curls, no layered border complexity, no modern symbols, no industrial machinery, no scene, no character illustration, no painterly texture, no photorealism, no text, no letters, no numbers, no calligraphy, no watermark
'@

$jobs = @(
    @{ key = 'cavalry'; subject = 'ancient cavalry emblem using one horse-head silhouette and one forward lance, compact and noble, no extra crest decoration' },
    @{ key = 'infantry'; subject = 'ancient infantry emblem using one single straight sword only, clear disciplined silhouette, no second weapon, no crossed weapons' },
    @{ key = 'shield'; subject = 'ancient shield troop emblem using one plain shield silhouette with one central boss or bar, no extra ornament' },
    @{ key = 'archer'; subject = 'ancient archer emblem using one bow and one arrow only, elegant and very clean silhouette' },
    @{ key = 'pikeman'; subject = 'ancient pikeman emblem using one long spear only, longer shaft and sharper spearhead than infantry sword, extremely readable silhouette' },
    @{ key = 'engineer'; subject = 'ancient siege engineer emblem using one simplified trebuchet or counterweight catapult silhouette, unmistakably ancient siege weapon, not a modern crane or oil pump' },
    @{ key = 'medic'; subject = 'ancient battlefield medic emblem using one medicine gourd or herb satchel with one simple herb sprig, no modern medical cross' },
    @{ key = 'navy'; subject = 'ancient navy emblem using one Chinese river warship prow with one sail and one simple water line, not a fantasy or Viking ship' }
)

foreach ($job in $jobs) {
    $prompt = "$($job.subject), $common"
    $output = Join-Path $outputDir ("troop_{0}.png" -f $job.key)

    Write-Host ("=== START " + $job.key + " ===")
    node (Join-Path $repoRoot '.github\skills\nano-banana-gen\scripts\generate-banana.js') --progress --prompt $prompt --model nano-banana --output $output --json
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
    Write-Host ("=== END " + $job.key + " ===")
}