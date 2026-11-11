# 03 - Build the React frontend and copy dist/ to C:\ClassManager\web.
#   -BuildOnly : only npm ci + build (no admin needed).
#   -SkipTypeCheck : bundle with `vite build` only (skip tsc), e.g. for an urgent hotfix.
# VITE_API_URL must stay unset: the app then calls /api on the same origin (Caddy proxies it).
param([switch]$BuildOnly, [switch]$SkipTypeCheck)

. "$PSScriptRoot\common.ps1"

$fe  = "$RepoRoot\class-manager-fe"
$npm = Find-Npm
$env:PATH = "$(Split-Path $npm);$env:PATH"   # npm scripts need node.exe on PATH
Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue

Write-Step 'npm ci + npm run build'
Push-Location $fe
try {
    & $npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    if ($SkipTypeCheck) {
        & $npm exec -- vite build
    } else {
        & $npm run build             # tsc -b && vite build
    }
    if ($LASTEXITCODE -ne 0) { throw 'frontend build failed.' }
} finally { Pop-Location }
if (-not (Test-Path "$fe\dist\index.html")) { throw 'dist\index.html not produced.' }
if ($BuildOnly) { Write-Step "Build only - output in $fe\dist"; return }

Assert-Admin
Ensure-RootLayout
Write-Step "Copying dist -> $WebDir"
& robocopy.exe "$fe\dist" $WebDir /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
Write-Step 'Web files deployed (no restart needed; Caddy serves them from disk)'
