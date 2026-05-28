# start_signverse.ps1
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SignVerse Robotics OS Boot Sequence" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$pwdPath = (Get-Location).Path
$env:PYTHONPATH = $pwdPath
$env:OS_API_KEY = "signverse_local_dev_key"

Write-Host "1. Starting FastAPI Backend Kernel..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$pwdPath'; `$env:PYTHONPATH = '$pwdPath'; `$env:OS_API_KEY = 'signverse_local_dev_key'; uvicorn core.deployment.api_gateway.gateway:app --host 0.0.0.0 --port 8000 --reload`""

Write-Host "2. Starting Vite/React 3D Dashboard..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$pwdPath\ui\dashboard'; npm run dev`""

Write-Host "Waiting 5 seconds for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "3. Launching Browser Visualizer..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "Boot sequence complete!" -ForegroundColor Cyan
Start-Sleep -Seconds 2
