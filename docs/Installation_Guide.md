# VISTARA — Installation & Deployment Guide

## Windows 10 / 11 64-bit Setup • Standalone 1-Click • MSI Installer & Portable Deployments

<p align="center">
  <img src="../assets/banner-animated.svg" alt="VISTARA Live Engine & Audio Spectrum" width="100%" />
</p>

<p align="center">
  <img src="../assets/soundwave-divider.svg" alt="VISTARA Audio Waveform" width="100%" />
</p>

---

## 1. System Requirements

### Hardware Requirements
- **Operating System:** Windows 10 (Version 1909 or higher) or Windows 11, 64-bit (x64).
- **Processor:** Intel Core i3 / AMD Ryzen 3 or higher. Multi-core recommended for background library scanning.
- **Memory (RAM):** 4 GB minimum (8 GB recommended for 4K video transcoding).
- **Storage:** 500 MB free disk space for application binaries; additional storage required for thumbnail caches and SQLite database (typically 1 GB per 10,000 media items).
- **GPU (Optional):** NVIDIA GeForce GTX 900+ (NVENC), Intel HD Graphics 500+ (QSV), or AMD Radeon R7+ (AMF) for hardware-accelerated video decoding/transcoding.

### Software Prerequisites
1. **Microsoft Edge WebView2 Runtime:**
   - Pre-installed on Windows 11 and recent builds of Windows 10.
   - If missing, download the Evergreen Bootstrapper from [Microsoft WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
2. **FFmpeg & FFprobe:**
   - VISTARA includes built-in detection for FFmpeg.
   - Place `ffmpeg.exe` and `ffprobe.exe` in `C:\ffmpeg\` or ensure they are present in your system `PATH`.
   - Pre-built Windows static builds are available from Gyan.dev or BtbN.

> [!NOTE]
> VISTARA operates 100% locally and does not require Docker, IIS, SQL Server, or cloud subscriptions.

---

## 2. Installation & Launch Options

VISTARA offers flexible distribution and execution formats:

### Option A: Standalone 1-Click Launch (`VISTARA.exe` — Recommended)
- Double-click **`VISTARA.exe`** directly from the root of the standalone folder.
- Runs 100% silently as a native Windows GUI Subsystem (`WinExe`) with zero flashing terminal windows.
- Automatically verifies if the API server on port `5178` is active, spinning it up if necessary.
- Directly opens the native WPF desktop container.

### Option B: Silent VBS Script (`VISTARA_SILENT.vbs`)
- Launch via double-clicking `VISTARA_SILENT.vbs`.
- Guarantees zero black console windows and launches the desktop app.

### Option C: Standard Windows Installer (MSI)
1. Download `Vistara-v1.0.0-Setup.msi`.
2. Double-click the `.msi` file to launch the setup wizard.
3. Accept the default installation directory:
   `C:\Program Files\Vistara\`
4. The installer creates Start Menu shortcuts and a Desktop icon.

### Option D: Portable Distribution (ZIP)
1. Download `Vistara-v1.0.0-Portable-win-x64.zip`.
2. Extract the archive to any directory (e.g. `D:\Tools\Vistara`).
3. Inside the extracted folder, run `VISTARA.exe` or `START_VISTARA.bat`.

> [!TIP]
> **Complete Offline Media Playback:**
> You can carry the portable distribution on an external hard drive along with your media library. VISTARA launches and plays your entire collection with zero internet access required.

---

## 3. First-Run Configuration

When VISTARA starts for the first time:
1. It automatically boots the background API server on `127.0.0.1:5178`.
2. The initial database and encryption keys are created under `%LOCALAPPDATA%\Vistara\`.
3. The **First-Run Wizard** will guide you through:
   - Confirming the VISTARA unified dual-tone theme (Cinematic Dark with Electric Teal).
   - Choosing your media folders.
   - Configuring initial scan options.

---

## 4. Updating VISTARA

To upgrade to a new version:
1. Close the current instance of VISTARA (make sure it is not minimized to the system tray).
2. Run the new `.msi` installer, or replace the portable directory files with the updated version.
3. Your media database, custom playlists, and watch history stored in `%LOCALAPPDATA%\Vistara\` remain completely preserved across upgrades.

---

*VISTARA — Personal Media Universe © 2026. Built with precision for Windows.*
