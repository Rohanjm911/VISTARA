# VISTARA — Build & Compilation Instructions

## Building from Source • Automated Pipelines • Package Distribution

<p align="center">
  <img src="../assets/banner-animated.svg" alt="VISTARA Live Engine & Audio Spectrum" width="100%" />
</p>

<p align="center">
  <img src="../assets/soundwave-divider.svg" alt="VISTARA Audio Waveform" width="100%" />
</p>

---

## 1. Prerequisites & Toolchain

To compile and package VISTARA from source, ensure the following tools are installed:

| Tool | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **.NET SDK** | 8.0.x or 11.0 Preview | Compiles backend C# assemblies and WPF desktop host |
| **Node.js** | 18.x LTS or 20.x LTS | JavaScript runtime for frontend build |
| **npm** | 9.x or higher | Node package manager |
| **PowerShell** | 5.1 or 7.x | Runs the automated `build.ps1` pipeline |
| **FFmpeg** | 6.0+ | Required at runtime for media operations |
| **WiX Toolset** | 3.11+ (Optional) | Required only if generating the MSI setup installer |

---

## 2. Automated One-Click Build

The easiest way to compile the entire solution, execute all tests, and package release binaries is via the master PowerShell script:

```powershell
# Run complete build and test pipeline
.\build.ps1 -Configuration Release
```

### Script Execution Steps:
1. **Tool Verification:** Checks that `dotnet` and `node` are available in `PATH`.
2. **Frontend Compilation:** Runs `npm install` and `npm run build` in `src/frontend/`, outputting the bundled SPA directly into `src/backend/Vistara.Api/wwwroot`.
3. **Backend Compilation:** Compiles `Vistara.slnx` in Release configuration.
4. **Automated Testing:** Executes xUnit unit tests (`Vistara.UnitTests`) and frontend Vitest tests.
5. **Publishing:** Packages publish-ready binaries for both `Vistara.Desktop` and `Vistara.Api` into `dist/Vistara-v1.0.0-win-x64/`.

> [!NOTE]
> The backend `Vistara.Api.csproj` is configured as `<OutputType>WinExe</OutputType>` to ensure completely silent headless execution without showing a flashing command prompt window upon launch.

---

## 3. Manual Step-by-Step Compilation

If you prefer building individual components manually:

### Step 1: Build the React Frontend
```powershell
cd src/frontend
npm install
npm run build
cd ../..
```
Verify that `src/backend/Vistara.Api/wwwroot/index.html` and assets exist.

### Step 2: Compile the .NET Solution
```powershell
dotnet restore Vistara.slnx
dotnet build Vistara.slnx -c Release --no-restore
```

### Step 3: Run the Test Suites
```powershell
# Run backend tests
dotnet test tests/Vistara.UnitTests/Vistara.UnitTests.csproj -c Release --no-build

# Run frontend tests
cd src/frontend
npm test -- --run
cd ../..
```

### Step 4: Publish Release Binaries
```powershell
# Publish Desktop WPF host
dotnet publish src/desktop/Vistara.Desktop/Vistara.Desktop.csproj -c Release -r win-x64 --self-contained false -o dist/Vistara-v1.0.0-win-x64/desktop

# Publish Backend Kestrel API server
dotnet publish src/backend/Vistara.Api/Vistara.Api.csproj -c Release -r win-x64 --self-contained false -o dist/Vistara-v1.0.0-win-x64/server
```

---

## 4. Building the MSI Installer & Portable Archive

If WiX Toolset (`candle.exe` and `light.exe`) is installed:

```powershell
cd installer
.\build_installer.ps1
```

If WiX is not installed, `build_installer.ps1` will automatically package a standalone portable ZIP archive at:
`dist/Vistara-v1.0.0-Portable-win-x64.zip`

---

*VISTARA — Personal Media Universe © 2026. Built with precision for Windows.*
