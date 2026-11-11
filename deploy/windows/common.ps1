# Shared settings + helpers for the deploy/windows scripts. Dot-source it:  . "$PSScriptRoot\common.ps1"
# Contains NO secrets. Secrets are generated at run time into $SecretsDir.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# -- Layout on the server ----------------------------------------------
$Root       = 'C:\ClassManager'
$ApiDir     = "$Root\api"
$WebDir     = "$Root\web"
$CaddyDir   = "$Root\caddy"
$BackupDir  = "$Root\backups"
$ScriptsDir = "$Root\scripts"
$LogsDir    = "$Root\logs"
$SecretsDir = "$Root\secrets"
$StagingDir = "$env:LOCALAPPDATA\ClassManagerBuild"   # build output (per user, no admin needed)

$RepoRoot   = (Resolve-Path "$PSScriptRoot\..\..").Path

# -- Names / ports -----------------------------------------------------
$PgMajor       = 17
$PgService     = "postgresql-x64-$PgMajor"
$PgBin         = "C:\Program Files\PostgreSQL\$PgMajor\bin"
$PgData        = "C:\Program Files\PostgreSQL\$PgMajor\data"
$PgPort        = 5432
# Optional pre-downloaded EDB installer (same version/hash as the winget manifest)
$PgInstaller       = "$StagingDir\installers\postgresql-17.11-5-windows-x64.exe"
$PgInstallerSha256 = '612C7F5400A003AAFFA0372CB273EED52278F93C680AB911EB9CB2229E329072'
$DbName        = 'classmanager'
$DbUser        = 'classmanager'
$ApiService    = 'ClassManagerApi'
$ApiUrl        = 'http://127.0.0.1:5000'
$CaddyService  = 'Caddy'
$WebUrl        = 'http://127.0.0.1:8080'

# Secret files (values never printed)
$PgSuperPassFile = "$SecretsDir\postgres-superuser.txt"
$DbPassFile      = "$SecretsDir\db-classmanager.txt"
$JwtKeyFile      = "$SecretsDir\jwt-key.txt"
$PgPassConf      = "$SecretsDir\pgpass.conf"

function Test-IsAdmin {
    $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-Admin {
    if (-not (Test-IsAdmin)) { throw 'This step needs an elevated PowerShell (Run as administrator).' }
}

function Write-Step([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# Alphanumeric only: safe inside connection strings, pgpass and JSON without escaping.
function New-RandomSecret([int]$Length = 40) {
    $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $bytes = New-Object byte[] $Length
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

# Restrict a file/folder to Administrators + SYSTEM (+ optional extra principals, read-only).
function Set-RestrictedAcl([string]$Path, [string[]]$ReadOnlyFor = @()) {
    $isDir = (Get-Item $Path).PSIsContainer
    $inherit = if ($isDir) { '(OI)(CI)' } else { '' }
    $icArgs = @($Path, '/inheritance:r', '/grant:r', "*S-1-5-32-544:$($inherit)F", '/grant:r', "*S-1-5-18:$($inherit)F")
    foreach ($p in $ReadOnlyFor) { $icArgs += @('/grant:r', "$($p):$($inherit)RX") }
    & icacls.exe @icArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls failed on $Path" }
}

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force $Path | Out-Null }
}

# C:\ClassManager inherits "Authenticated Users: Modify" from C:\ - replace that with
# Administrators/SYSTEM full + Users read, so service binaries cannot be swapped by a normal user.
function Ensure-RootLayout {
    Ensure-Dir $Root
    & icacls.exe $Root /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls failed on $Root" }
    & icacls.exe $Root /setowner '*S-1-5-32-544' /T /C /Q | Out-Null   # owner = Administrators
    foreach ($d in @($ApiDir, $WebDir, $CaddyDir, $ScriptsDir, $LogsDir)) { Ensure-Dir $d }
    Ensure-SecretsDir
    Ensure-Dir $BackupDir; Set-RestrictedAcl $BackupDir   # dumps contain all data
}

# Give a principal Modify rights on a folder (e.g. a service account on its log/data dir).
function Grant-Modify([string]$Path, [string]$Principal) {
    Ensure-Dir $Path
    & icacls.exe $Path /grant "$($Principal):(OI)(CI)M" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls grant failed on $Path" }
}

function Ensure-SecretsDir {
    Ensure-Dir $SecretsDir
    Set-RestrictedAcl $SecretsDir
}

# Read a secret file, or create it with a fresh random value.
function Get-OrCreateSecret([string]$File, [int]$Length = 40) {
    if (Test-Path $File) { return (Get-Content $File -Raw).Trim() }
    $v = New-RandomSecret $Length
    Set-Content -Path $File -Value $v -NoNewline -Encoding ascii
    return $v
}

function Find-Dotnet {
    $c = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    foreach ($p in @("$env:USERPROFILE\.dotnet\dotnet.exe", 'C:\Program Files\dotnet\dotnet.exe')) {
        if (Test-Path $p) { return $p }
    }
    throw 'dotnet SDK not found (install .NET 10 SDK).'
}

function Find-Npm {
    $c = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    # Portable Node (zip from nodejs.org) under the user's tools folder
    $p = Get-ChildItem "$env:USERPROFILE\tools\node-v*-win-x64\npm.cmd" -ErrorAction SilentlyContinue |
         Sort-Object FullName -Descending | Select-Object -First 1
    if ($p) { return $p.FullName }
    throw 'npm not found. Install Node LTS:  winget install OpenJS.NodeJS.LTS'
}

# Stop a service if it exists and is running (used before replacing binaries).
function Stop-ServiceIfRunning([string]$Name) {
    $s = Get-Service $Name -ErrorAction SilentlyContinue
    if ($s -and $s.Status -ne 'Stopped') { Stop-Service $Name -Force; $s.WaitForStatus('Stopped', '00:00:30') }
}

# Set per-service environment variables (REG_MULTI_SZ "Environment" under the service key).
function Set-ServiceEnvironment([string]$Name, [string[]]$Vars) {
    $key = "HKLM:\SYSTEM\CurrentControlSet\Services\$Name"
    New-ItemProperty -Path $key -Name Environment -PropertyType MultiString -Value $Vars -Force | Out-Null
}

# Restart on failure: 5s, 10s, 30s; reset the failure counter after 1 day.
function Set-ServiceRecovery([string]$Name) {
    & sc.exe failure $Name reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
    & sc.exe failureflag $Name 1 | Out-Null
}
