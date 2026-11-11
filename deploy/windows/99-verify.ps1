# 99 - Smoke test of the whole stack. Read-only. Run elevated to also list DB tables
#      (the pgpass file in C:\ClassManager\secrets is readable by Administrators only).

. "$PSScriptRoot\common.ps1"
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$fail = 0
function Check([string]$name, [bool]$ok, [string]$detail = '') {
    $tag = if ($ok) { 'PASS' } else { $script:fail++; 'FAIL' }
    Write-Host ("[{0}] {1} {2}" -f $tag, $name, $detail) -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
}
function Get-Http([string]$url, [string]$method = 'GET', [string]$body = $null) {
    try {
        $p = @{ Uri = $url; Method = $method; UseBasicParsing = $true; TimeoutSec = 10 }
        if ($body) { $p.Body = $body; $p.ContentType = 'application/json' }
        $r = Invoke-WebRequest @p; return @{ Code = [int]$r.StatusCode; Body = $r.Content }
    } catch {
        if ($_.Exception.Response) { return @{ Code = [int]$_.Exception.Response.StatusCode; Body = '' } }
        return @{ Code = 0; Body = $_.Exception.Message }
    }
}

# Services
foreach ($s in $PgService, $ApiService, $CaddyService) {
    $svc = Get-Service $s -ErrorAction SilentlyContinue
    Check "service $s" ($svc -and $svc.Status -eq 'Running' -and $svc.StartType -eq 'Automatic') $(if ($svc) { "$($svc.Status)/$($svc.StartType)" } else { 'missing' })
}

# HTTP
$r = Get-Http "$ApiUrl/health";                 Check 'API /health'   ($r.Code -eq 200 -and $r.Body -match 'ok') "$($r.Code) $($r.Body)"
$r = Get-Http "$WebUrl/health";                 Check 'Caddy /health' ($r.Code -eq 200 -and $r.Body -match 'ok') "$($r.Code) $($r.Body)"
$r = Get-Http "$WebUrl/";                       Check 'SPA /'         ($r.Code -eq 200 -and $r.Body -match '<div id="root">') "$($r.Code)"
$r = Get-Http "$WebUrl/students";               Check 'SPA fallback /students' ($r.Code -eq 200 -and $r.Body -match '<div id="root">') "$($r.Code)"
$r = Get-Http "$WebUrl/api/auth/login" 'POST' '{"email":"nobody@example.invalid","password":"wrong-password"}'
Check 'POST /api/auth/login (bogus) = 401' ($r.Code -eq 401) "$($r.Code)"

# Listening sockets must be loopback-only
foreach ($port in $PgPort, 5000, 8080) {
    $l = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    $addrs = ($l.LocalAddress | Sort-Object -Unique) -join ','
    Check "port $port loopback only" ($l -and -not ($l | Where-Object { $_.LocalAddress -notin '127.0.0.1', '::1' })) $addrs
}

# DB tables (needs admin to read pgpass)
if ((Test-IsAdmin) -and (Test-Path $PgPassConf)) {
    $env:PGPASSFILE = $PgPassConf
    $tables = & "$PgBin\psql.exe" -h 127.0.0.1 -p $PgPort -U $DbUser -d $DbName -w -tAc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
    Check 'DB tables created' ($tables.Count -gt 0) ($tables -join ', ')
} else { Write-Host '[SKIP] DB tables (run elevated)' }

# Backups
$task = Get-ScheduledTask -TaskName 'ClassManager DB Backup' -ErrorAction SilentlyContinue
Check 'backup task exists' ($null -ne $task) $(if ($task) { "$($task.State), next: $((Get-ScheduledTaskInfo $task).NextRunTime)" })
if (Test-IsAdmin) {
    $d = Get-ChildItem $BackupDir -Filter 'classmanager_*.dump' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Check 'backup dump present' ($null -ne $d -and $d.Length -gt 0) $(if ($d) { "$($d.Name) $($d.Length) bytes" })
} else { Write-Host '[SKIP] backup dump (backups dir is admin-only)' }

Write-Host "`n$fail check(s) failed."
exit $fail
