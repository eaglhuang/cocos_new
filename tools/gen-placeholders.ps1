param (
    [Parameter(Mandatory=$true)]
    [string]$SourcePath,

    [Parameter(Mandatory=$true)]
    [string]$TargetPath
)

# Ensure SourcePath exists
if (-not (Test-Path $SourcePath)) {
    Write-Error "Source file not found: $SourcePath"
    exit 1
}

# Ensure Target Directory exists
$TargetDir = Split-Path $TargetPath -Parent
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# Copy and Overwrite
Write-Host "Replacing $TargetPath with $SourcePath ..."
Copy-Item -Path $SourcePath -Destination $TargetPath -Force

# Trigger Cocos Creator Refresh
Write-Host "Triggering Cocos Creator Asset Refresh..."
try {
    # Use curl.exe to avoid PowerShell's Invoke-WebRequest interactive overhead
    curl.exe http://localhost:7456/asset-db/refresh
    Write-Host "`nRefresh triggered successfully."
} catch {
    Write-Warning "Failed to trigger refresh. Is Cocos Creator running on port 7456?"
}
