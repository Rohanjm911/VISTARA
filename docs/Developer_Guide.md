# VISTARA — Developer Guide

## Architecture, Codebase Structure & Contributor Standards

<p align="center">
  <img src="../assets/banner-animated.svg" alt="VISTARA Live Engine & Audio Spectrum" width="100%" />
</p>

<p align="center">
  <img src="../assets/soundwave-divider.svg" alt="VISTARA Audio Waveform" width="100%" />
</p>

---

## 1. Solution Overview

VISTARA is architected as a **Modular Monolith** targeting Windows 10/11 64-bit with .NET 8 / .NET 11 LTS. The frontend is a single-page application built with React 18, TypeScript, Tailwind CSS, and Vite. Desktop integration is provided via a lightweight C# WPF host hosting Microsoft Edge WebView2.

```
VISTARA/
├── VISTARA.exe                       # Primary 1-click native launcher with embedded logo
├── Vistara.slnx                       # .NET 11 / Visual Studio Solution
├── Directory.Build.props              # Shared build configurations & roll-forward policy
├── build.ps1                          # Master build, test, and package PowerShell pipeline
├── src/
│   ├── backend/
│   │   ├── Vistara.Core/              # Domain models, enums, DTOs, interfaces
│   │   ├── Vistara.Infrastructure/    # EF Core SQLite DbContext, Security, FTS5 migration
│   │   ├── Vistara.MediaEngine/       # FFmpeg/FFprobe wrappers, HW accel, Transcoding, Thumbs
│   │   ├── Vistara.Services/          # Library scanner, Task Manager, Playback, Search, Backup
│   │   └── Vistara.Api/               # ASP.NET Core Kestrel REST API, SignalR Hub, Controllers
│   ├── desktop/
│   │   └── Vistara.Desktop/           # WPF host, custom borderless titlebar, system tray
│   └── frontend/
│       ├── package.json               # React, Tailwind, Lucide, HLS.js, SignalR client
│       ├── vite.config.ts             # Proxy to 127.0.0.1:5178, build to Vistara.Api/wwwroot
│       └── src/
│           ├── api/                   # Local API client, transparent CSRF bootstrap, SignalR bus
│           ├── components/            # VistaraLogo, StartupSplash, CassetteTape, AudioVisualizer, Modals, Players
│           ├── context/               # ThemeContext, PlayerContext (audio/video/queue)
│           ├── pages/                 # Dashboard, Cinema, TV, Music, Playlists, MediaHealth, Settings
│           ├── utils/                 # AudioMaster, Hinglish transliterator, Ambient soundscapes, UI sound
│           └── types/                 # TypeScript interfaces mirrored from Vistara.Core
├── tests/
│   └── Vistara.UnitTests/             # xUnit unit test suite (PathSecurity, Regex, Playback)
├── installer/                         # WiX Toolset MSI installer definition & packaging scripts
└── docs/                              # Complete system documentation specifications
```

---

## 2. Key Architecture Principles

1. **Strictly Local Loopback (`127.0.0.1`):**
   - Kestrel is strictly bound to `http://127.0.0.1:5178`. It must never bind to `0.0.0.0` or expose ports to LAN or WAN.
2. **Zero-Login Authentication:**
   - No login screens, user registrations, or password hashes.
   - Transparent security is established via installation secrets generated at `%LOCALAPPDATA%\Vistara\security.key`.
   - On initial load, frontend calls `/api/v1/auth/bootstrap` to retrieve a short-lived anti-CSRF token (`X-Vistara-CSRF`) and secure `HttpOnly` cookie.
   - Host and Origin header validation reject any non-local or DNS-rebinding requests.
3. **Safe Media Processing:**
   - User media files are treated as strictly immutable unless the user triggers an explicit management action.
   - File metadata scanning uses FFprobe without altering file modification timestamps.
4. **Apple Music-Inspired Living Glassmorphism (`.apple-glass`):**
   - Use standardized glassmorphism classes (`.apple-glass`, `.apple-glass-panel`) for translucent acrylic elevation.
   - Acrylic parameters: `backdrop-filter: blur(28px) saturate(190%)` paired with hairline borders (`rgba(255, 255, 255, 0.12)`).
   - Dynamic living background aura: `#FA2D48` (Apple Crimson), `#38BDF8` (Sky Neon), `#818CF8` (Cosmic Indigo) blooms with `blur-[120px]`.
   - Typography: Radiant solid white typography for active lines (`drop-shadow-[0_2px_16px_rgba(255,255,255,0.45)]`) and subtle atmospheric blur (`blur-[0.35px]`) for background lines.
5. **Hinglish Lyrics & Subtitle Conventions:**
   - Always place Romanized Hinglish subtitles directly below the primary text (`main text ke neche`) with staggered slide-in animations.
   - Utilize client-side transliteration utility `devanagariToHinglish()` from `src/frontend/src/utils/hinglish.ts` for 0ms instant display.

> [!IMPORTANT]
> Never introduce external cloud dependencies, registration barriers, or public socket bindings into VISTARA. The platform is strictly local-first.

---

## 3. Development Workflow

### Prerequisites
- .NET 8.0 SDK or .NET 11 Preview SDK
- Node.js 18+ and npm 9+
- FFmpeg 6.0+ installed at `C:\ffmpeg\ffmpeg.exe` or available in system `PATH`
- PowerShell 7+ or Windows PowerShell 5.1

### Setting Up the Environment
Clone the repository and run:
```powershell
# Restore frontend dependencies
cd src/frontend
npm install

# Build frontend and compile Vite bundle to backend wwwroot
npm run build

# Return to root and build .NET solution
cd ../..
dotnet build Vistara.slnx
```

### Running the Application in Development

#### Option A: Running the Backend & Frontend in Dev Mode (Hot Reload)
Terminal 1 (Backend):
```powershell
$env:ASPNETCORE_ENVIRONMENT="Development"
dotnet run --project src/backend/Vistara.Api/Vistara.Api.csproj
```
Backend will start listening on `http://127.0.0.1:5178`.

Terminal 2 (Frontend with Vite HMR):
```powershell
cd src/frontend
npm run dev
```
Open `http://localhost:5173`. Requests to `/api` and `/hubs` will automatically proxy to the backend at port 5178.

#### Option B: Running the WPF Desktop App
```powershell
dotnet run --project src/desktop/Vistara.Desktop/Vistara.Desktop.csproj
```
The desktop application automatically checks if the backend process is running, launches `Vistara.Api.exe` if needed, waits for health check, and renders inside WebView2.

---

## 4. Testing Guidelines

### Backend Unit Tests (xUnit)
Located in `tests/Vistara.UnitTests`. To run:
```powershell
dotnet test tests/Vistara.UnitTests/Vistara.UnitTests.csproj
```
Covers:
- `MediaIntegrityMonitorTests`: Streaming SHA-256 calculation, file modification detection, disconnected drive classification without media deletion, zero-byte truncated corruption handling, recovery candidate ranking algorithm.
- `PathSecurityValidatorTests`: Canonicalization, path traversal attacks (`..\..\Windows\System32`), directory containment.
- `FilenameParserTests`: Movie edition extraction (*Blade Runner Director's Cut* -> `Blade Runner` [Director's Cut]), TV show season and episode regex patterns (*S01E02*, *1x02*, *Season 1 Episode 2*).
- `PlaybackLogicTests`: Watched threshold calculation (90%), resume position calculation, audio delay compensation.
- *Total: 29 passing backend unit tests.*

### Frontend Unit Tests (Vitest)
Located in `src/frontend/src/__tests__`. To run:
```powershell
cd src/frontend
npm test -- --run
```
Covers:
- Unified Electric Teal accent color enforcement and absence of gradients.
- Format duration helper (`hh:mm:ss` / `mm:ss`).
- Disconnected drive distinct status preservation.
- Storage byte formatting (`GB`, `MB`, `TB`).
- *Total: 8 passing frontend unit tests.*
- Time and duration formatting (`hh:mm:ss`).
- Volume gain curves and decibel mathematical calculations.
- Playback completion thresholds.

---

## 5. Adding New Features

### Adding a New Entity
1. Define model in `src/backend/Vistara.Core/Models/`.
2. Register `DbSet<T>` in `src/backend/Vistara.Infrastructure/Data/VistaraDbContext.cs`.
3. Configure model relationships, foreign keys, and indexes in `OnModelCreating`.
4. Create corresponding DTOs in `src/backend/Vistara.Core/DTOs/`.
5. Mirror TypeScript interfaces in `src/frontend/src/types/index.ts`.

### Adding a New Controller
1. Create controller class in `src/backend/Vistara.Api/Controllers/`.
2. Inherit from `ControllerBase`, add `[ApiController]` and `[Route("api/v1/[controller]")]`.
3. Return results wrapped in `ApiResponse<T>.Ok(...)` or `ApiResponse<T>.Fail(...)`.
4. Add client API caller in `src/frontend/src/api/client.ts` or page component using `apiRequest<T>()`.

---

## 6. Motion System v2 & Animation Tokens

When building or updating UI components, use the standard Motion System v2 classes defined in `src/frontend/src/index.css`:

| Utility Class | Purpose & Timing | Usage Example |
| :--- | :--- | :--- |
| `.page-enter` | 420ms cubic-bezier translateY + blur entrance on tab switch | Attached to active page root element |
| `.stagger-item` | Cascading 40ms interval entrance fade-up | Applied to grid card elements (`:nth-child(1..10)`) |
| `.vistara-card` | Hover elevation lift (`translateY(-4px)`), cyan ring, and 600ms specular shimmer sweep | Applied to Movie, TV, Music, and Playlist card containers |
| `.skeleton` | Infinite 1.6s shimmer gradient pulse | Applied to skeleton placeholder blocks during async fetches |
| `.nav-item` / `.nav-active` | Magnetic left indicator bar expansion | Applied to sidebar navigation buttons |
| `.btn-press` | Tactile 120ms scale-down (`0.94x`) on click | Applied to primary buttons and transport actions |
| `.badge-pop` | 350ms elastic bounce scale entrance | Applied to resolution, codec, and tag badges |
| `.spotlight-sweep` | Soft luminous wave traversing backgrounds | Applied to dialog backdrops and hero banners |
| `.icon-spin` | Smooth 700ms 360-degree rotation | Applied to loader and refresh icons |
| `.tooltip-enter` | 180ms subtle fade & slide-in | Applied to hover tooltips and floating dropdowns |

---

*VISTARA — Personal Media Universe © 2026. Built with precision for Windows.*
