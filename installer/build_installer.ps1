<#
.SYNOPSIS
    Builds the MSI Windows Installer for VISTARA using WiX Toolset.
#>

[CmdletBinding()]
param (
    [string]$DistPath = "..\dist\Vistara-v1.0.0-win-x64",
    [string]$OutputPath = "..\dist\Vistara-v1.0.0-Setup.msi"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "VISTARA MSI Installer Builder" -ForegroundColor Cyan

if (-not (Test-Path $DistPath)) {
    Write-Host "Distribution folder not found at '$DistPath'. Running build.ps1 first..." -ForegroundColor Yellow
    & "..\build.ps1"
}

# Check for WiX candle and light
$candle = Get-Command "candle.exe" -ErrorAction SilentlyContinue
$light = Get-Command "light.exe" -ErrorAction SilentlyContinue

if ($candle -and $light) {
    Write-Host "Compiling WiX definitions..." -ForegroundColor Yellow
    & candle.exe -arch x64 Product.wxs -out obj\Product.wixobj
    & light.exe -ext WixUIExtension obj\Product.wixobj -out $OutputPath
    Write-Host "MSI Installer successfully built at: $OutputPath" -ForegroundColor Green
} else {
    Write-Host "WiX Toolset (candle.exe/light.exe) not installed in system PATH." -ForegroundColor DarkYellow
    Write-Host "A self-contained portable distribution is available at: $DistPath" -ForegroundColor Green
    Write-Host "To package as ZIP archive for portable distribution..." -ForegroundColor Gray
    $zipPath = "..\dist\Vistara-v1.0.0-Portable-win-x64.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path "$DistPath\*" -DestinationPath $zipPath
    Write-Host "Portable package created at: $zipPath" -ForegroundColor Green
}
