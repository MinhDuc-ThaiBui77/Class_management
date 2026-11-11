# 07 - Windows Update active hours: do not auto-restart during teaching hours (07:00-22:00).
#      Classes run 7h15-21h; Windows allows an active-hours window of at most 18 hours.
# Run in an elevated PowerShell.
param([int]$Start = 7, [int]$End = 22)

. "$PSScriptRoot\common.ps1"
Assert-Admin

$key = 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings'
if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
Set-ItemProperty -Path $key -Name ActiveHoursStart -Value $Start -Type DWord
Set-ItemProperty -Path $key -Name ActiveHoursEnd   -Value $End   -Type DWord
# Turn off "automatically adjust active hours based on activity" so the window stays fixed
Set-ItemProperty -Path $key -Name SmartActiveHoursState -Value 0 -Type DWord

Write-Step ("Active hours set to {0:00}:00 - {1:00}:00 (Windows Update will not auto-restart in this window)" -f $Start, $End)
