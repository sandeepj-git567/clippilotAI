# ClipPilot AI - Local Development Startup Script (Windows, without Docker)
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Starting ClipPilot AI..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$ProjectRoot = Split-Path -Parent $PSScriptRoot

# --- Check .env ---
$envFile = Join-Path $ProjectRoot ".env"
$envExample = Join-Path $ProjectRoot ".env.example"
if (-Not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "[.env] Copied .env.example -> .env. Please fill in your credentials before continuing." -ForegroundColor Yellow
        Write-Host "Edit: $envFile" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "[.env] ERROR: No .env or .env.example found. Create a .env file first." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[.env] Found .env" -ForegroundColor Green
}

# --- Check PostgreSQL ---
Write-Host ""
Write-Host "[PostgreSQL] Checking connection..." -ForegroundColor Blue
try {
    $pgResult = & pg_isready -q 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[PostgreSQL] Running OK" -ForegroundColor Green
    } else {
        Write-Host "[PostgreSQL] Not ready. Start PostgreSQL manually or use Docker." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[PostgreSQL] pg_isready not found. Start PostgreSQL manually or use Docker." -ForegroundColor Yellow
}

# --- Check Redis ---
Write-Host ""
Write-Host "[Redis] Checking connection..." -ForegroundColor Blue
try {
    $redisResult = & redis-cli ping 2>&1
    if ($redisResult -eq "PONG") {
        Write-Host "[Redis] Running OK" -ForegroundColor Green
    } else {
        Write-Host "[Redis] Not ready. Start Redis manually or use Docker." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[Redis] redis-cli not found. Start Redis manually or use Docker." -ForegroundColor Yellow
}

# --- Start AI Engine ---
Write-Host ""
Write-Host "[AI Engine] Starting on port 8001..." -ForegroundColor Blue
$aiEnginePath = Join-Path $ProjectRoot "ai-engine"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$aiEnginePath'; python -m uvicorn main:app --host 0.0.0.0 --port 8001" -WindowStyle Normal
Write-Host "[AI Engine] Started in a new window" -ForegroundColor Green

# --- Run Prisma Migrations ---
Write-Host ""
Write-Host "[Backend] Running Prisma migrations..." -ForegroundColor Blue
$backendPath = Join-Path $ProjectRoot "backend"
Push-Location $backendPath
try {
    npx prisma migrate deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[Backend] Prisma migrations complete" -ForegroundColor Green
    } else {
        Write-Host "[Backend] Prisma migration failed. Check your DATABASE_URL in .env" -ForegroundColor Red
    }
} catch {
    Write-Host "[Backend] Failed to run Prisma migrations: $_" -ForegroundColor Red
}
Pop-Location

# --- Start Backend ---
Write-Host ""
Write-Host "[Backend] Starting on port 8000..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; node dist/index.js" -WindowStyle Normal
Write-Host "[Backend] Started in a new window" -ForegroundColor Green

# --- Start Frontend ---
Write-Host ""
Write-Host "[Frontend] Starting on port 3000..." -ForegroundColor Blue
$frontendPath = Join-Path $ProjectRoot "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal
Write-Host "[Frontend] Started in a new window" -ForegroundColor Green

# --- Print URLs ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   ClipPilot AI is starting up!" -ForegroundColor Cyan
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
Write-Host "Services are starting... allow ~15 seconds before opening the browser." -ForegroundColor Yellow
