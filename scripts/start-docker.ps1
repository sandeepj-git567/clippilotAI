# ClipPilot AI - Docker Startup Script
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   ClipPilot AI - Docker Startup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# --- Check .env ---
$envFile = Join-Path $ProjectRoot ".env"
$envExample = Join-Path $ProjectRoot ".env.example"
if (-Not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "[.env] Copied .env.example -> .env" -ForegroundColor Yellow
        Write-Host "       Fill in your credentials in: $envFile" -ForegroundColor Yellow
        Write-Host "       Then re-run this script." -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "[.env] ERROR: No .env or .env.example found." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[.env] Found .env" -ForegroundColor Green
}

# --- Check Docker is running ---
Write-Host ""
Write-Host "[Docker] Checking Docker daemon..." -ForegroundColor Blue
try {
    docker info | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
    Write-Host "[Docker] Docker is running" -ForegroundColor Green
} catch {
    Write-Host "[Docker] ERROR: Docker Desktop is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# --- Build and start all services ---
Write-Host ""
Write-Host "[Docker] Building and starting all services (this may take a few minutes on first run)..." -ForegroundColor Blue
docker compose up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[Docker] ERROR: docker compose up failed. Check the output above." -ForegroundColor Red
    exit 1
}

# --- Wait for health checks ---
Write-Host ""
Write-Host "[Docker] Waiting for services to become healthy..." -ForegroundColor Blue
$maxWait = 60
$waited = 0
$allHealthy = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 5
    $waited += 5

    $psOutput = docker compose ps --format json 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
    $unhealthy = $psOutput | Where-Object { $_.Health -eq "starting" -or $_.Health -eq "unhealthy" }

    if ($unhealthy.Count -eq 0) {
        $allHealthy = $true
        break
    }

    Write-Host "  Waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
}

if ($allHealthy) {
    Write-Host "[Docker] All services are healthy!" -ForegroundColor Green
} else {
    Write-Host "[Docker] Some services may still be starting. Run 'docker compose ps' to check status." -ForegroundColor Yellow
}

# --- Print running containers ---
Write-Host ""
Write-Host "[Docker] Running containers:" -ForegroundColor Blue
docker compose ps

# --- Print URLs ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   ClipPilot AI is running!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend   ->  http://localhost:3000" -ForegroundColor White
Write-Host "  Backend    ->  http://localhost:8000" -ForegroundColor White
Write-Host "  AI Engine  ->  http://localhost:8001" -ForegroundColor White
Write-Host ""
Write-Host "Default login:" -ForegroundColor Gray
Write-Host "  Email:    creator@clippilot.ai" -ForegroundColor Gray
Write-Host "  Password: clippilot123" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop all services:  docker compose down" -ForegroundColor DarkGray
Write-Host "To view logs:          docker compose logs -f" -ForegroundColor DarkGray
Write-Host ""
