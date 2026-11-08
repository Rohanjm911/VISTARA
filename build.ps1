[CmdletBinding()]
param (
    [string]$Configuration = "Release",
    [switch]$SkipTests,
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = "1"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  VISTARA - Personal Media Universe Build Pipeline" -ForegroundColor Cyan
Write-Host "  Configuration: $Configuration" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check prerequisites
Write-Host "[1/6] Verifying toolchain prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command "dotnet" -ErrorAction SilentlyContinue)) {
    Write-Error "dotnet SDK was not found in PATH. Please install .NET SDK 8.0 or later."
}
$dotnetVer = dotnet --version
Write-Host "  -> .NET SDK Version: $dotnetVer" -ForegroundColor Green

if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js was not found in PATH. Please install Node.js 18+."
}
$nodeVer = node --version
Write-Host "  -> Node.js Version: $nodeVer" -ForegroundColor Green

# 2. Build Frontend
if (-not $SkipFrontend) {
    Write-Host "[2/6] Building React Frontend with Vite..." -ForegroundColor Yellow
    Push-Location "src/frontend"
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Host "  -> Installing frontend dependencies..." -ForegroundColor Gray
            npm install
        }
        Write-Host "  -> Compiling TypeScript and bundling..." -ForegroundColor Gray
        npm run build
        Write-Host "  -> Frontend build complete (saved to Vistara.Api/wwwroot)" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[2/6] Skipping frontend build per flag." -ForegroundColor DarkGray
}

# 3. Compile Backend and Desktop
Write-Host "[3/6] Building .NET Solution ($Configuration)..." -ForegroundColor Yellow
dotnet build Vistara.slnx -c $Configuration --nologo
Write-Host "  -> Solution build succeeded." -ForegroundColor Green

# 4. Run Automated Tests
if (-not $SkipTests) {
    Write-Host "[4/6] Executing Automated Test Suites..." -ForegroundColor Yellow

    Write-Host "  -> Running backend unit tests (xUnit)..." -ForegroundColor Gray
    dotnet test tests/Vistara.UnitTests/Vistara.UnitTests.csproj -c $Configuration --no-build --nologo

    if (-not $SkipFrontend) {
        Write-Host "  -> Running frontend tests (Vitest)..." -ForegroundColor Gray
        Push-Location "src/frontend"
        try {
            npm test
        } finally {
            Pop-Location
        }
    }
    Write-Host "  -> All test suites passed successfully." -ForegroundColor Green
} else {
    Write-Host "[4/6] Skipping automated tests per flag." -ForegroundColor DarkGray
}

# 5. Publish Deployables
Write-Host "[5/6] Publishing application binaries to dist/..." -ForegroundColor Yellow
$DistDir = Join-Path $ScriptDir "dist"
$DistApp = Join-Path $DistDir "Vistara-v1.0.0-win-x64"

if (Test-Path $DistApp) {
    Remove-Item -Path $DistApp -Recurse -Force
}
New-Item -ItemType Directory -Path $DistApp -Force | Out-Null

Write-Host "  -> Publishing Vistara.Desktop..." -ForegroundColor Gray
dotnet publish src/desktop/Vistara.Desktop/Vistara.Desktop.csproj `
    -c $Configuration `
    -r win-x64 `
    --self-contained false `
    -o (Join-Path $DistApp "desktop") `
    --nologo

Write-Host "  -> Publishing Vistara.Api..." -ForegroundColor Gray
dotnet publish src/backend/Vistara.Api/Vistara.Api.csproj `
    -c $Configuration `
    -r win-x64 `
    --self-contained false `
    -o (Join-Path $DistApp "server") `
    --nologo

# Copy distribution launcher script
Set-Content -Path (Join-Path $DistApp "VISTARA.bat") -Value "@echo off`r`nstart %~dp0desktop\Vistara.Desktop.exe"

Write-Host "  -> Binaries packaged to: $DistApp" -ForegroundColor Green

# 6. Verification
Write-Host "[6/6] Build Pipeline Complete!" -ForegroundColor Cyan
Write-Host "VISTARA is ready for local execution or packaging." -ForegroundColor Green
Write-Host "Run dist/Vistara-v1.0.0-win-x64/VISTARA.bat to launch." -ForegroundColor White
