# start_signverse.ps1
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SignVerse Robotics OS Boot Sequence" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$pwdPath = (Get-Location).Path
$env:PYTHONPATH = $pwdPath
$env:OS_API_KEY = "signverse_local_dev_key"

Write-Host "1. Starting FastAPI Backend Kernel..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$pwdPath'; `$env:PYTHONPATH = '$pwdPath'; `$env:OS_API_KEY = 'signverse_local_dev_key'; python -m uvicorn core.deployment.api_gateway.gateway:app --host 0.0.0.0 --port 8000 --reload`""

Write-Host "Boot sequence complete!" -ForegroundColor Cyan
Start-Sleep -Seconds 2
