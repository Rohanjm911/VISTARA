# VISTARA — Troubleshooting & Diagnostic Guide

## Common Issues • FFmpeg Diagnostics • Error Logs • Solutions

<p align="center">
  <img src="../assets/banner-animated.svg" alt="VISTARA Live Engine & Audio Spectrum" width="100%" />
</p>

<p align="center">
  <img src="../assets/soundwave-divider.svg" alt="VISTARA Audio Waveform" width="100%" />
</p>

---

## 1. Application Startup Issues

### 1.1 "Port 5178 is already in use"
- **Symptom:** VISTARA backend fails to start or reports address binding errors in logs.
- **Cause:** Another process or a previously running instance of VISTARA is still bound to `127.0.0.1:5178`.
- **Solution:**
  1. Open Windows PowerShell and run:
     ```powershell
     Get-NetTCPConnection -LocalPort 5178 -ErrorAction SilentlyContinue | Select-Object OwningProcess
     ```
  2. Terminate the conflicting process:
     ```powershell
     Stop-Process -Id <ProcessId> -Force
     ```
  3. Re-launch `VISTARA.exe`.

### 1.2 "WebView2 Runtime not found"
- **Symptom:** Desktop window displays a blank gray screen or reports `WebView2Loader.dll` initialization error.
- **Solution:** Download and install the Microsoft Edge WebView2 Evergreen Bootstrapper from Microsoft's official developer site.

### 1.3 "Another instance is already running"
- **Symptom:** Double-clicking VISTARA does not open a new window.
- **Cause:** VISTARA enforces a single-instance named mutex (`Vistara_SingleInstance_Mutex`). The application is likely minimized to the Windows System Tray (notification area near the clock).
- **Solution:** Click the VISTARA icon in the system tray or right-click and choose "Show VISTARA".

---

## 2. Cinema Universe & Poster Engine Issues

### 2.1 "Cinema Universe Not Showing All Movies"
- **Symptom:** Only a subset of movies appears in the Cinema grid.
- **Solution:**
  - VISTARA v1.1.0 provides an **Uncapped 100+ Grid**. By default, it loads 100+ movies without arbitrary 24-item limits.
  - Check the bottom pagination bar: you can choose **All (100+)**, **200**, **48**, or **24** from the page size dropdown.
  - If a filter is active, check the live search bar at the top right of the Cinema header or clear the genre dropdown.
  - Click the **"Load More"** footer button if viewing in paginated batches.

### 2.2 "Movie or TV Show Missing Posters / Blank Covers"
- **Solution:**
  1. Click the movie or show card to open details.
  2. Click the **Poster / Edit Artwork** button to open the **3-Tab Poster Picker Modal**:
     - **Online Suggestions:** Select from high-res official posters queried from OMDB and Cinemeta.
     - **Upload File:** Select a `.jpg` or `.png` directly from your hard drive.
     - **Direct URL:** Paste any public image link.
  3. For bulk library enrichment, click the **⚡ Auto Fetch Posters** button in the Cinema header.

---

## 3. Media Playback & FFmpeg Issues

### 3.1 "MKV Video Playback Fails or Stutters"
- **Cause:** Browser engines cannot play Matroska (`.mkv`) containers directly.
- **Solution:**
  - VISTARA features **0% CPU DirectStream Remuxing**. When playing an MKV file containing H.264 video, FFmpeg automatically repackages the stream into an MP4 container on the fly (`-c:v copy -c:a aac -f mp4 pipe:1`).
  - This avoids video transcoding, consuming 0% CPU and providing immediate playback (~10ms).
  - Ensure your system has FFmpeg installed and configured in **Settings > FFmpeg & Transcoding**.

### 3.2 "10-bit HEVC (x265) Fails on GPU Transcoding"
- **Cause:** NVIDIA NVENC hardware encoders on consumer GeForce GPUs do not support 10-bit H.264 encoding (`[h264_nvenc] 10 bit encode not supported`).
- **Solution:**
  - VISTARA automatically inserts `-pix_fmt yuv420p` with `-preset p2`, dynamically downsampling 10-bit HDR streams to standard 8-bit YUV420P.
  - If playback drops frames, verify that your NVIDIA/Intel/AMD GPU drivers are updated.

### 3.3 Audio Plays but Video is Black
- **Cause:** The media file uses an unsupported video codec or DRM stream.
- **Solution:** In the player control bar, switch the video stream quality to "Transcode (HLS 1080p)". This forces FFmpeg to transcode to standard H.264.

---

## 4. Audio Visualizers & Beat Sync

### 4.1 "Visualizer Appears Flat or Does Not Move"
- **Cause:** Web Audio API `AudioContext` starts in `suspended` state in modern browsers until an explicit user interaction occurs.
- **Solution:**
  - Press <kbd>Space</kbd> or click the Play button to activate the `AudioContext`.
  - Press <kbd>V</kbd> to cycle between visualizer modes (*Rainbow Spectrum Bars*, *Cosmic Rainbow Embers*, *Liquid Wave*, *Radial Halo*, *VU Meters*).
  - The spectrum bars and particles react to sub-bass audio transients ($20\text{ Hz} - 90\text{ Hz}$). Tracks with prominent bass beats will produce noticeable laser cap jumps and particle velocity surges.

---

## 5. Structured Log Files

VISTARA logs all system events, errors, and scan results using Serilog.

### Log File Location
`%LOCALAPPDATA%\Vistara\logs\vistara_{yyyyMMdd}.log`

### Reading Recent Errors via PowerShell
```powershell
Get-Content "$env:LOCALAPPDATA\Vistara\logs\vistara_*.log" | Select-String -Pattern "\[ERR\]|\[FTL\]" | Select-Object -Last 20
```

---

## 6. Media Integrity & Corruption Issues

### 6.1 "Media Files Marked as Disconnected vs Deleted"
- **Symptom:** Files display an orange "Drive Disconnected" indicator in the Media Health dashboard.
- **Cause:** The drive root volume (e.g. `E:\`, `F:\`) containing the media is currently unmounted or unplugged.
- **Safeguard:** VISTARA strictly preserves all metadata, custom posters, watch progress, and history. **Files are never marked as missing or deleted when their parent volume is disconnected.**
- **Solution:** Reconnect your external HDD/SSD. VISTARA will automatically restore the healthy status on the next scan or when clicking "Verify".

### 6.2 "Corrupted or Unreadable Media File Detected"
- **Symptom:** A file appears under the "Corrupted" or "Unreadable" category in Media Health.
- **Causes & Diagnoses:**
  - **Zero-Byte File:** The file has 0 bytes, likely from an interrupted download or failed copy.
  - **FFprobe Container Failure:** The container header is damaged or truncated.
  - **Missing Audio/Video Streams:** The container contains no decodable multimedia streams.
  - **I/O Lock:** The file is locked exclusively by another application (e.g., torrent client or video editor).
- **Solution:** In Media Health → Problem Reports, check the detailed diagnosis message. For file locks, close the locking process and click **Verify File**.

### 6.3 "Relinking Moved or Renamed Media Files"
- **Symptom:** A media file was moved to another folder or renamed and is marked as "Missing".
- **Solution:**
  1. Go to **Media Health → Problem Reports**.
  2. Click **Relink / Recover** next to the missing file.
  3. The Recovery Assistant automatically searches connected libraries for replacement candidates matching by exact file size and filename similarity score.
  4. Click **Apply Relink** on the suggested candidate, or type the new valid file path manually.

---

## 7. Factory Reset

If configurations become corrupted:
1. Open **Settings > About VISTARA**.
2. Click **Reset to Defaults**.
3. Alternatively, close VISTARA and delete `%LOCALAPPDATA%\Vistara\vistara.db`.

---

*VISTARA — Personal Media Universe © 2026. Built with precision for Windows.*
