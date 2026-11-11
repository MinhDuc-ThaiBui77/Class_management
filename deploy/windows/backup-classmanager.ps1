# Daily DB backup (installed to C:\ClassManager\scripts by 05-backup-task.ps1, runs as SYSTEM at 02:00).
# pg_dump -Fc of `classmanager` -> C:\ClassManager\backups\classmanager_yyyyMMdd_HHmm.dump
# Credentials come from the pgpass file in C:\ClassManager\secrets (never stored here).
# Restore example:  pg_restore -h 127.0.0.1 -U classmanager -d classmanager --clean --if-exists <file>.dump
param(
    [string]$BackupDir = 'C:\ClassManager\backups',
    [int]$KeepDays     = 14
)
$ErrorActionPreference = 'Stop'

$pgDump = 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe'
$log    = 'C:\ClassManager\logs\backup.log'
$env:PGPASSFILE = 'C:\ClassManager\secrets\pgpass.conf'

function Log([string]$m) { Add-Content $log "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" }

$out = Join-Path $BackupDir ("classmanager_{0}.dump" -f (Get-Date -Format 'yyyyMMdd_HHmm'))
try {
    & $pgDump -h 127.0.0.1 -p 5432 -U classmanager -d classmanager -Fc -w -f $out
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $out) -or (Get-Item $out).Length -eq 0) {
        throw "pg_dump failed (exit $LASTEXITCODE)"
    }
    Log "OK  $out ($([math]::Round((Get-Item $out).Length / 1KB)) KB)"
} catch {
    Remove-Item $out -ErrorAction SilentlyContinue
    Log "ERR $($_.Exception.Message)"
    exit 1
}

# Retention: only touch our own dump files
Get-ChildItem $BackupDir -Filter 'classmanager_*.dump' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    ForEach-Object { Remove-Item $_.FullName -Force; Log "DEL $($_.Name)" }
