@echo off
title VISTARA — Personal Media Universe
cd /d "%~dp0"

:: If native VISTARA.exe exists, hand off immediately and close command prompt
if exist "%~dp0VISTARA.exe" (
    start "" "%~dp0VISTARA.exe"
    exit /b 0
)
if exist "%~dp0dist\Vistara-v1.0.0-win-x64\VISTARA.exe" (
    start "" "%~dp0dist\Vistara-v1.0.0-win-x64\VISTARA.exe"
    exit /b 0
)

echo ==========================================================
echo   VISTARA - Personal Media Universe
echo   Local-First Entertainment Platform
echo ==========================================================
echo.

:: 1. Check if backend is already running on port 5178
netstat -ano | findstr :5178 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] VISTARA backend server is already running on 127.0.0.1:5178.
) else (
    echo [*] Starting VISTARA local media server...
    if exist "%~dp0server\Vistara.Api.dll" (
        start "" /d "%~dp0server" dotnet "%~dp0server\Vistara.Api.dll"
    ) else if exist "%~dp0dist\Vistara-v1.0.0-win-x64\server\Vistara.Api.dll" (
        start "" /d "%~dp0dist\Vistara-v1.0.0-win-x64\server" dotnet "%~dp0dist\Vistara-v1.0.0-win-x64\server\Vistara.Api.dll"
    ) else if exist "%~dp0server\Vistara.Api.exe" (
        start "" /d "%~dp0server" "%~dp0server\Vistara.Api.exe"
    ) else if exist "%~dp0dist\Vistara-v1.0.0-win-x64\server\Vistara.Api.exe" (
        start "" /d "%~dp0dist\Vistara-v1.0.0-win-x64\server" "%~dp0dist\Vistara-v1.0.0-win-x64\server\Vistara.Api.exe"
    ) else if exist "%~dp0src\backend\Vistara.Api\bin\Release\net8.0\Vistara.Api.exe" (
        start "" /d "%~dp0src\backend\Vistara.Api\bin\Release\net8.0" "%~dp0src\backend\Vistara.Api\bin\Release\net8.0\Vistara.Api.exe"
    ) else if exist "%~dp0src\backend\Vistara.Api\bin\Debug\net8.0\Vistara.Api.exe" (
        start "" /d "%~dp0src\backend\Vistara.Api\bin\Debug\net8.0" "%~dp0src\backend\Vistara.Api\bin\Debug\net8.0\Vistara.Api.exe"
    ) else (
        echo [*] Running via dotnet CLI in background...
        start "" /b dotnet run --project "%~dp0src\backend\Vistara.Api\Vistara.Api.csproj" -c Release
    )
    
    :: Wait until port 5178 is actively listening
    echo [*] Waiting for local media server to initialize...
    for /L %%i in (1,1,25) do (
        netstat -ano | findstr :5178 | findstr LISTENING >nul 2>&1
        if not errorlevel 1 goto SERVER_READY
        ping 127.0.0.1 -n 2 >nul
    )

    :SERVER_READY
    echo [OK] Backend server is ready on 127.0.0.1:5178!
)

:: 2. Launch Desktop WPF Client or Browser
echo [*] Launching VISTARA Desktop Application...
if exist "%~dp0desktop\Vistara.Desktop.exe" (
    start "" /d "%~dp0desktop" "%~dp0desktop\Vistara.Desktop.exe"
) else if exist "%~dp0dist\Vistara-v1.0.0-win-x64\desktop\Vistara.Desktop.exe" (
    start "" /d "%~dp0dist\Vistara-v1.0.0-win-x64\desktop" "%~dp0dist\Vistara-v1.0.0-win-x64\desktop\Vistara.Desktop.exe"
) else if exist "%~dp0src\desktop\Vistara.Desktop\bin\Release\net8.0-windows\Vistara.Desktop.exe" (
    start "" /d "%~dp0src\desktop\Vistara.Desktop\bin\Release\net8.0-windows" "%~dp0src\desktop\Vistara.Desktop\bin\Release\net8.0-windows\Vistara.Desktop.exe"
) else if exist "%~dp0src\desktop\Vistara.Desktop\bin\Debug\net8.0-windows\Vistara.Desktop.exe" (
    start "" /d "%~dp0src\desktop\Vistara.Desktop\bin\Debug\net8.0-windows" "%~dp0src\desktop\Vistara.Desktop\bin\Debug\net8.0-windows\Vistara.Desktop.exe"
) else (
    echo [*] Desktop host binary not found. Opening in default web browser...
    start "" "http://127.0.0.1:5178"
)

echo.
echo [DONE] VISTARA launched successfully!
echo Web UI available at: http://127.0.0.1:5178
echo.
ping 127.0.0.1 -n 2 >nul
exit /b 0
