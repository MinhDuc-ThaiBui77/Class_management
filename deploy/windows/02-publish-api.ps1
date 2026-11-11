# 02 - Publish the API (self-contained win-x64) and install/update the ClassManagerApi service.
#   -BuildOnly : only build into the staging folder (no admin needed).
# Full run needs an elevated PowerShell and 01-install-postgres.ps1 done first.
param([switch]$BuildOnly)

. "$PSScriptRoot\common.ps1"

$proj    = "$RepoRoot\ClassManager.API\ClassManager.API.csproj"
$staging = "$StagingDir\api"
$exe     = "$ApiDir\ClassManager.API.exe"
$account = "NT SERVICE\$ApiService"   # virtual service account (least privilege)

# -- 1. Build -----------------------------------------------------------
Write-Step 'dotnet publish (Release, win-x64, self-contained)'
$dotnet = Find-Dotnet
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
& $dotnet publish $proj -c Release -r win-x64 --self-contained true -o $staging --nologo
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed.' }
# Never ship config from the dev checkout - production config lives only in $ApiDir
Remove-Item "$staging\appsettings*.json" -ErrorAction SilentlyContinue
if ($BuildOnly) { Write-Step "Build only - output in $staging"; return }

Assert-Admin
Ensure-RootLayout

# -- 2. Copy binaries (keep the production appsettings.json) -----------
Write-Step "Deploying to $ApiDir"
Stop-ServiceIfRunning $ApiService
& robocopy.exe $staging $ApiDir /MIR /XF appsettings.json /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

# -- 3. Service (create once, then keep config in sync) ----------------
if (-not (Get-Service $ApiService -ErrorAction SilentlyContinue)) {
    Write-Step "Creating service $ApiService"
    New-Service -Name $ApiService -BinaryPathName "`"$exe`"" -DisplayName 'ClassManager API' `
        -Description 'ClassManager ASP.NET Core API (http://127.0.0.1:5000)' -StartupType Automatic | Out-Null
}
# depend= : start after Postgres at boot (migrations run on startup)
& sc.exe config $ApiService start= auto obj= $account depend= $PgService | Out-Null
if ($LASTEXITCODE -ne 0) { throw "sc.exe config $ApiService failed." }
Set-ServiceEnvironment $ApiService @('ASPNETCORE_ENVIRONMENT=Production', "ASPNETCORE_URLS=$ApiUrl")
Set-ServiceRecovery $ApiService
# Event log source used by UseWindowsService() (the virtual account cannot create it itself)
if (-not [Diagnostics.EventLog]::SourceExists('ClassManager.API')) { New-EventLog -LogName Application -Source 'ClassManager.API' }

# -- 4. Production appsettings.json (generated once, never in the repo) -
$cfg = "$ApiDir\appsettings.json"
if (-not (Test-Path $cfg)) {
    Write-Step 'Generating production appsettings.json'
    if (-not (Test-Path $DbPassFile)) { throw "$DbPassFile missing - run 01-install-postgres.ps1 first." }
    $dbPass = (Get-Content $DbPassFile -Raw).Trim()
    $jwtKey = Get-OrCreateSecret $JwtKeyFile 80
    $json = [ordered]@{
        ConnectionStrings = @{ Default = "Host=127.0.0.1;Port=$PgPort;Database=$DbName;Username=$DbUser;Password=$dbPass;SSL Mode=Disable" }
        Jwt               = [ordered]@{ Key = $jwtKey; Issuer = 'ClassManagerAPI'; Audience = 'ClassManagerApp' }
        AllowedOrigins    = $WebUrl
        Urls              = $ApiUrl
        Logging           = @{ LogLevel = [ordered]@{ Default = 'Information'; 'Microsoft.AspNetCore' = 'Warning' } }
        AllowedHosts      = '*'
    } | ConvertTo-Json -Depth 5
    [IO.File]::WriteAllText($cfg, $json, (New-Object Text.UTF8Encoding $false))
} else {
    Write-Step 'Keeping existing appsettings.json'
}
# Config holds secrets: Administrators/SYSTEM + read for the service account only
Set-RestrictedAcl $cfg -ReadOnlyFor $account

# -- 5. Start + health check ------------------------------------------
Start-Service $ApiService
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
    Start-Sleep 2
    try { $ok = (Invoke-WebRequest "$ApiUrl/health" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200 } catch {}
}
if (-not $ok) { throw "API did not become healthy - check Event Viewer > Application (source ClassManager.API)." }
Write-Step "API healthy at $ApiUrl/health"
