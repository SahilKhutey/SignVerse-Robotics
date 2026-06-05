# start_signverse.ps1
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SignVerse Robotics OS Boot Sequence" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$pwdPath = (Get-Location).Path
$env:PYTHONPATH = $pwdPath
$env:OS_API_KEY = "signverse_local_dev_key"

Write-Host "Starting SignVerse Robotics OS Orchestrator..." -ForegroundColor Green
python start_system.py
