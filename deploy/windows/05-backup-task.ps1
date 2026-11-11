# 05 - Install the daily backup script + Scheduled Task (02:00, runs as SYSTEM), then run it once.
# Needs 01-install-postgres.ps1 done (it writes the pgpass file). Run in an elevated PowerShell.
param([switch]$NoTestRun)

. "$PSScriptRoot\common.ps1"
Assert-Admin
Ensure-RootLayout

$taskName = 'ClassManager DB Backup'
$script   = "$ScriptsDir\backup-classmanager.ps1"
if (-not (Test-Path $PgPassConf)) { throw "$PgPassConf missing - run 01-install-postgres.ps1 first." }

Write-Step "Installing $script"
Copy-Item "$PSScriptRoot\backup-classmanager.ps1" $script -Force

Write-Step "Registering scheduled task '$taskName'"
$action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$trigger   = New-ScheduledTaskTrigger -Daily -At '02:00'
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
# StartWhenAvailable: if the laptop was off at 02:00, run as soon as it is back
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal `
    -Settings $settings -Description 'pg_dump -Fc of classmanager, keep 14 days' -Force | Out-Null

if (-not $NoTestRun) {
    Write-Step 'Test run via the scheduled task'
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep 3
    while ((Get-ScheduledTask -TaskName $taskName).State -in 'Running', 'Queued') { Start-Sleep 2 }
    $info = Get-ScheduledTaskInfo -TaskName $taskName
    $last = Get-ChildItem $BackupDir -Filter 'classmanager_*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Write-Step "LastTaskResult=$($info.LastTaskResult)  newest dump: $(if ($last) { "$($last.Name) ($($last.Length) bytes)" } else { "none" })"
    if ($info.LastTaskResult -ne 0) { throw "Backup failed - see $LogsDir\backup.log" }
}
