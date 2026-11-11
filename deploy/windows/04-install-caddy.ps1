# 04 - Install Caddy v2 (official binary from GitHub, checksum-verified) as the `Caddy` service.
#      Serves C:\ClassManager\web on http://127.0.0.1:8080 and proxies /api/* + /health to the API.
#   -Version 2.x.y : pin a version (default: latest stable release).
# Run in an elevated PowerShell.
param([string]$Version = 'latest')

. "$PSScriptRoot\common.ps1"
Assert-Admin
Ensure-RootLayout
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$exe     = "$CaddyDir\caddy.exe"
$conf    = "$CaddyDir\Caddyfile"
$dataDir = "$CaddyDir\data"
$account = "NT SERVICE\$CaddyService"

# -- 1. Binary --------------------------------------------------------
if ($Version -eq 'latest') {
    $Version = (Invoke-RestMethod 'https://api.github.com/repos/caddyserver/caddy/releases/latest').tag_name.TrimStart('v')
}
$current = if (Test-Path $exe) { ((& $exe version) -split ' ')[0].TrimStart('v') } else { '' }
if ($current -ne $Version) {
    Write-Step "Downloading Caddy $Version"
    $base = "https://github.com/caddyserver/caddy/releases/download/v$Version"
    $zipName = "caddy_${Version}_windows_amd64.zip"
    $tmp = Join-Path $env:TEMP "caddy-$Version-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory $tmp | Out-Null
    try {
        Invoke-WebRequest "$base/$zipName" -OutFile "$tmp\$zipName" -UseBasicParsing
        $sums = (Invoke-WebRequest "$base/caddy_${Version}_checksums.txt" -UseBasicParsing).Content
        if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }   # GitHub serves octet-stream
        $expected = (($sums -split "`n") | Where-Object { $_ -match [regex]::Escape($zipName) }) -split '\s+' | Select-Object -First 1
        $actual = (Get-FileHash "$tmp\$zipName" -Algorithm SHA512).Hash
        if (-not $expected -or $expected.ToLower() -ne $actual.ToLower()) { throw 'Caddy checksum mismatch - aborting.' }
        Expand-Archive "$tmp\$zipName" -DestinationPath "$tmp\x"
        Stop-ServiceIfRunning $CaddyService
        Copy-Item "$tmp\x\caddy.exe" $exe -Force
    } finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
} else { Write-Step "Caddy $Version already installed" }

# -- 2. Caddyfile (keep a .bak of a changed existing file) ------------
$src = "$PSScriptRoot\Caddyfile"
if ((Test-Path $conf) -and ((Get-FileHash $conf).Hash -ne (Get-FileHash $src).Hash)) {
    Copy-Item $conf "$conf.bak" -Force
    Write-Step "Existing Caddyfile differs - saved as $conf.bak"
}
Copy-Item $src $conf -Force
& $exe validate --config $conf --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddyfile is invalid.' }

# -- 3. Service (virtual account; data + logs are its only writable dirs)
if (-not (Get-Service $CaddyService -ErrorAction SilentlyContinue)) {
    Write-Step "Creating service $CaddyService"
    New-Service -Name $CaddyService -BinaryPathName "`"$exe`" run --config `"$conf`" --adapter caddyfile" `
        -DisplayName 'Caddy (ClassManager web)' -Description 'Static web + reverse proxy on http://127.0.0.1:8080' `
        -StartupType Automatic | Out-Null
}
& sc.exe config $CaddyService start= auto obj= $account | Out-Null
if ($LASTEXITCODE -ne 0) { throw "sc.exe config $CaddyService failed." }
Set-ServiceEnvironment $CaddyService @("XDG_DATA_HOME=$dataDir", "XDG_CONFIG_HOME=$dataDir")
Set-ServiceRecovery $CaddyService
Grant-Modify $dataDir $account
Grant-Modify $LogsDir $account

Stop-ServiceIfRunning $CaddyService
Start-Service $CaddyService
Start-Sleep 2
$r = Invoke-WebRequest "$WebUrl/" -UseBasicParsing -TimeoutSec 10
Write-Step "Caddy up: GET $WebUrl/ -> $($r.StatusCode)"
