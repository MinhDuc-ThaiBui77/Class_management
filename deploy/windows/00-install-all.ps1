# 00 - Run every setup step in order (each step is idempotent, so this is safe to re-run).
# Elevated PowerShell:  powershell -ExecutionPolicy Bypass -File D:\Class_management\deploy\windows\00-install-all.ps1

. "$PSScriptRoot\common.ps1"
Assert-Admin

& "$PSScriptRoot\01-install-postgres.ps1"
& "$PSScriptRoot\02-publish-api.ps1"
& "$PSScriptRoot\03-publish-web.ps1"
& "$PSScriptRoot\04-install-caddy.ps1"
& "$PSScriptRoot\05-backup-task.ps1"
& "$PSScriptRoot\06-power.ps1"
& "$PSScriptRoot\07-windows-update.ps1"
& "$PSScriptRoot\99-verify.ps1"
