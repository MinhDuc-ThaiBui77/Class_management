# 06 - Power settings for a laptop acting as a server.
# On AC power only: never sleep, never hibernate, closing the lid does nothing.
# Battery (DC) settings are left untouched. Applies to the active power scheme.

. "$PSScriptRoot\common.ps1"

Write-Step 'AC: sleep/hibernate never, lid close = do nothing'
& powercfg.exe /change standby-timeout-ac 0
& powercfg.exe /change hibernate-timeout-ac 0
# SUB_BUTTONS / LIDACTION: 0 = Do nothing
& powercfg.exe /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
& powercfg.exe /setactive SCHEME_CURRENT
if ($LASTEXITCODE -ne 0) { throw 'powercfg failed.' }

Write-Step 'Current values (AC):'
& powercfg.exe /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE   | Select-String 'Current AC'
& powercfg.exe /query SCHEME_CURRENT SUB_SLEEP HIBERNATEIDLE | Select-String 'Current AC'
# LIDACTION is a hidden setting (not shown by /query) - read it from the registry instead
$scheme = ((& powercfg.exe /getactivescheme) -split '\s+' | Where-Object { $_ -match '^[0-9a-f-]{36}$' })
$lid = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes\$scheme\4f971e89-eebd-4455-a8de-9e59040e7347\5ca83367-6e45-459f-a27b-476b1d01c936" -ErrorAction SilentlyContinue
Write-Host "    Lid close (AC): $(if ($lid -and $lid.ACSettingIndex -eq 0) { 'Do nothing' } else { 'NOT set' })"
