$ErrorActionPreference = 'Stop'

$projectSkillsRoot = Join-Path $PSScriptRoot '..\.github\skills'
$projectSkillsRoot = (Resolve-Path $projectSkillsRoot).Path
$codexSkillsRoot = Join-Path $env:USERPROFILE '.codex\skills'

if (-not (Test-Path $projectSkillsRoot)) {
    throw "Project skills folder not found: $projectSkillsRoot"
}

New-Item -ItemType Directory -Force -Path $codexSkillsRoot | Out-Null

$skills = Get-ChildItem -Path $projectSkillsRoot -Directory | Sort-Object Name
$synced = @()

foreach ($skill in $skills) {
    $sourceSkillFile = Join-Path $skill.FullName 'SKILL.md'
    if (-not (Test-Path $sourceSkillFile)) {
        Write-Warning "Skip $($skill.Name): missing SKILL.md"
        continue
    }

    $dest = Join-Path $codexSkillsRoot $skill.Name
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Path (Join-Path $skill.FullName '*') -Destination $dest -Recurse -Force

    $synced += [PSCustomObject]@{
        Skill = $skill.Name
        Source = $skill.FullName
        Destination = $dest
    }
}

if ($synced.Count -eq 0) {
    Write-Host 'No project skills were synced.'
    exit 0
}

$synced | Format-Table -AutoSize
Write-Host "Synced $($synced.Count) project skill(s) into $codexSkillsRoot"
