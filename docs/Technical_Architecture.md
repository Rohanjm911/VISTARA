# VISTARA — Technical Architecture Specification

## Personal Media Universe • Architecture Blueprint

<p align="center">
  <img src="../assets/banner-animated.svg" alt="VISTARA Live Engine & Audio Spectrum" width="100%" />
</p>

<p align="center">
  <img src="../assets/soundwave-divider.svg" alt="VISTARA Audio Waveform" width="100%" />
</p>

---

## 1. System Topology & High-Level Architecture

VISTARA is designed as a single-process backend coupled with dual presentation hosts (WPF desktop shell and modern web browsers). All persistent state is stored locally on the user's workstation.

```mermaid
flowchart TD
    subgraph DesktopMode ["Desktop Presentation Layer"]
        WPF["Vistara.Desktop (WPF Host)"]
        WV2["Microsoft Edge WebView2"]
        Tray["Windows System Tray Icon"]
        WPF --> WV2
        WPF --> Tray
    end

    subgraph BrowserMode ["Browser Presentation Layer"]
        Browser["Chrome / Edge / Firefox Browser"]
    end

    subgraph FrontendSPA ["React 18 Single-Page Application"]
        SPA["Vite + React + TypeScript + Tailwind"]
        State["Theme, Player & Visualizer Contexts"]
        HLS["HLS.js / HTML5 Video / Web Audio API DSP"]
        SigClient["SignalR Realtime Client"]
        SPA --> State
        SPA --> HLS
        SPA --> SigClient
    end

    subgraph BackendHost ["ASP.NET Core Monolith (127.0.0.1:5178)"]
        Kestrel["Kestrel HTTP / WebSocket Server"]
        SecMid["LocalSecurityMiddleware (CSRF, Host, Origin)"]
        Controllers["REST API Controllers (v1)"]
        Hub["VistaraHub (SignalR Push Bus)"]
        Kestrel --> SecMid --> Controllers
        Kestrel --> Hub
    end

    subgraph CoreServices ["Application & Engine Services"]
        Scanner["LibraryScannerService"]
        IntegritySvc["Media Integrity Monitor (IIntegrityService)"]
        TaskManager["Priority Channel Task Manager"]
        PlaybackSvc["Playback & Decision Service"]
        SearchSvc["FTS5 Search Service"]
        BackupSvc["Backup & VACUUM Service"]
        PosterSvc["Poster & Metadata Online Engine (OMDB / Cinemeta)"]
    end

    subgraph MediaEngine ["Vistara.MediaEngine"]
        FFmpeg["FFmpeg Process Runner"]
        FFprobe["FFprobe Stream Analyzer"]
        HWAccel["Hardware Acceleration Prober (NVENC/QSV/AMF)"]
        Transcoder["0% CPU Remuxer & NVENC HLS Segmenter"]
        ThumbGen["Thumbnail & Waveform Generator"]
    end

    subgraph StorageLayer ["Persistence & Filesystem"]
        SQLite["SQLite Database (WAL Mode + FTS5)"]
        MediaFiles["User Media Storage (D:, E:, etc.)"]
        AppCache["%LOCALAPPDATA%\Vistara (Thumbs, Posters, Backups)"]
    end

    WV2 --> SPA
    Browser --> SPA
    SPA --> Kestrel
    Controllers --> CoreServices
    CoreServices --> MediaEngine
    CoreServices --> SQLite
    MediaEngine --> MediaFiles
    CoreServices --> MediaFiles
    CoreServices --> AppCache
```

> [!NOTE]
> All media streaming, scanning, and metadata lookups are non-blocking and thread-isolated. The frontend communicates with the backend via REST endpoints and a real-time SignalR push notification bus.

---

## 2. Playback Pipeline Architecture

<p align="center">
  <img src="../assets/cinema-banner-animated.svg" alt="Cinema Universe & Theatrical Playback Engine" width="100%" />
</p>

VISTARA dynamically evaluates client browser media capabilities to determine the most efficient delivery pipeline:

```mermaid
flowchart TD
    Req["Media Playback Requested"] --> Probe["Analyze Container, Video Codec & Audio Codec via FFprobe"]
    Probe --> DirectCheck{"Is container (MP4/WebM) & codecs (H.264/AAC) natively supported by browser?"}
    
    DirectCheck -- "Yes" --> DirectPlay["Pipeline 1: Direct Play<br/>HTTP 206 Partial Content Range Streaming<br/>Zero CPU / Zero Transcoding Overhead"]
    DirectCheck -- "No" --> RemuxCheck{"Is video codec H.264 but container is MKV?<br/>Can audio be streamed or remuxed?"}
    
    RemuxCheck -- "Yes" --> Remux["Pipeline 2: 0% CPU DirectStream Remux<br/>FFmpeg repackages container on-the-fly (-c:v copy -c:a aac -f mp4 pipe:1)<br/>Zero video re-encoding loss, 0% CPU, ~10ms startup"]
    RemuxCheck -- "No" --> Transcode["Pipeline 3: Full HLS Adaptive Transcoding<br/>FFmpeg GPU Transcoding (NVENC -preset p2 -pix_fmt yuv420p / QSV / AMF)<br/>Adaptive H.264/AAC segmentation into .m3u8 + .ts segments"]
```

### Pipeline Details:
1. **Direct Play (HTTP 206 Partial Content):**
   - High-throughput byte-range seeking directly off local disk.
   - Native pass-through for MP4, WebM, and M4V files with H.264/AV1/VP9 and AAC/MP3 audio.
2. **0% CPU DirectStream Remuxing:**
   - For Matroska (`.mkv`) files containing standard H.264 video, FFmpeg executes a lossless container repackaging:
     ```bash
     ffmpeg -hide_banner -loglevel error -ss {offset} -i {file} -map 0:v:0 -map 0:a:{audioIdx}? -c:v copy -c:a aac -b:a 192k -movflags frag_keyframe+empty_moov+default_base_moof -f mp4 pipe:1
     ```
   - Video stream is copied byte-for-byte without CPU decompression, delivering instantaneous start times and zero frame drops.
3. **Hardware-Accelerated Transcoding (NVENC / QSV / AMF):**
   - Used when handling 10-bit HEVC x265, VC-1, MPEG-2, or legacy codecs.
   - Converts 10-bit color profiles smoothly using `-pix_fmt yuv420p` with the low-latency `-preset p2` flag, completely avoiding GPU pixel-format incompatibilities.

---

## 3. Web Audio DSP & Beat-Synced Visualizer Architecture

<p align="center">
  <img src="../assets/rainbow-visualizer.svg" alt="Beat-Synced Rainbow Spectrum" width="100%" />
</p>

VISTARA features an audiophile-grade Web Audio API digital signal processing graph connected directly to real-time HTML5 60 FPS `<canvas>` renderers:

```mermaid
flowchart LR
    AudioElem["HTML5 Audio Element"] --> SourceNode["MediaElementAudioSourceNode"]
    SourceNode --> EQ10["10-Band BiquadFilter Graph (32Hz - 16kHz)"]
    EQ10 --> CompNode["DynamicsCompressorNode (Loudness Normalizer)"]
    CompNode --> Analyser["AnalyserNode (fftSize=256, smoothing=0.85)"]
    Analyser --> Dest["AudioContext.Destination (Speakers/Headphones)"]
    
    Analyser -.-> FrequencyData["Uint8Array Frequency & Time-Domain Data"]
    FrequencyData --> Visualizers["60 FPS Canvas Renderers"]
    
    subgraph Visualizers ["Visualizer Modes"]
        Bars["Rainbow Spectrum Bars (Full 360° Chromatic Hue, Delta-Time Physics)"]
        Embers["Cosmic Rainbow Embers (Particle Dynamics, Sonic Shockwaves)"]
        Wave["Liquid Wave (Chromatic Spline Ribbons)"]
        Halo["Radial Halo (360° Artwork Pulse)"]
        VU["Dual Stereo VU Meters (Ballistic Inertia)"]
    end
```

> [!TIP]
> **Delta-Time Normalization (60Hz / 120Hz / 144Hz):**
> Visualizer frame loops calculate hardware delta timestamps via `performance.now()` with exponential moving average (EMA) lerp smoothing: $1 - (1 - \text{baseLerp})^{\text{fpsRatio}}$, ensuring perfectly identical, micro-stutter-free physics across standard 60Hz and high-refresh 120Hz/144Hz displays.

---

### 3.1 Bilingual Lyrics & Hinglish Transliteration Pipeline

```mermaid
flowchart TD
    Lyrics["Synced LRC Lyrics Stream"] --> ScriptDetect{"Devanagari Detected?"}
    ScriptDetect -- "Yes (Hindi)" --> ClientTrans["0ms Client Transliterator (devanagariToHinglish)"]
    ScriptDetect -- "No (Foreign/English)" --> BackendAPI["POST /api/v1/music/lyrics/translate"]
    BackendAPI --> HinglishPipeline["Hinglish Engine (Schwa-Deletion & Overrides)"]
    ClientTrans --> Subtitle["Luminous Glacier Blue Subtitle Line (#7DD3FC)"]
    HinglishPipeline --> Subtitle
    Subtitle --> ActivePill["Kinetic Active Line Elevation Pill + 3-Bar Soundwave"]
```

---

## 4. Online Poster & Metadata Enrichment Pipeline

```mermaid
sequenceDiagram
    participant Client as User / Scanner
    participant API as PostersController
    participant Cache as Local SQLite & Disk Cache
    participant OMDB as OMDB Open API
    participant Cinemeta as Cinemeta Catalog API
    
    Client->>API: GET /api/v1/posters/search?title={title}&year={year}
    API->>Cache: Check Cached Posters
    alt Poster Found in Cache
        Cache-->>API: Return Cached Poster URL
        API-->>Client: 200 OK (Instant Cache Hit)
    else Cache Miss
        API->>OMDB: Query OMDB Open Catalog
        alt OMDB Success
            OMDB-->>API: Poster URL & Plot Synopsis
        else OMDB Fallback
            API->>Cinemeta: Query Cinemeta IMDb Catalog
            Cinemeta-->>API: Poster URL & Synopsis
        end
        API->>Cache: Save Artwork & Synopsis to SQLite
        API-->>Client: 200 OK (Enriched Metadata)
    end
```

---

## 5. Background Task Processing Architecture

Long-running operations (such as library scanning, thumbnail generation, and database vacuuming) are decoupled from the HTTP request cycle using an in-memory priority queue based on .NET `System.Threading.Channels.Channel<T>`.

```mermaid
sequenceDiagram
    participant User as Client UI
    participant API as LibrariesController
    participant TM as BackgroundTaskManager
    participant Worker as BackgroundTaskWorker
    participant Hub as VistaraHub
    
    User->>API: POST /api/v1/libraries/{id}/scan
    API->>TM: EnqueueJob(JobType.LibraryScan, TaskFunc)
    TM-->>API: Returns JobId (Guid)
    API-->>User: HTTP 200 OK (Job Queued)
    TM->>Worker: Dequeue highest priority item
    Worker->>Worker: Execute LibraryScannerService
    loop File by File
        Worker->>Hub: Broadcast ScanProgressDto
        Hub->>User: Real-time SignalR ScanProgress event
    end
    Worker->>Hub: Broadcast JobUpdated (Completed)
    Hub->>User: Update UI to completed
```

---

## 6. Database Concurrency & FTS5 Full-Text Search

### SQLite Engine Configuration
- **Journal Mode:** Write-Ahead Logging (`WAL`). Allows concurrent readers while a single background worker writes without database locking.
- **Synchronous Flag:** `NORMAL` for high write throughput during multi-thousand file scans.
- **Foreign Key Constraints:** Explicitly enabled via `PRAGMA foreign_keys = ON;`.

### Full-Text Search 5 (FTS5) Virtual Table
To deliver sub-millisecond search across hundreds of thousands of media entries, VISTARA utilizes an FTS5 virtual table:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS MediaSearchIndex USING fts5(
    MediaItemId UNINDEXED,
    Title,
    OriginalTitle,
    Subtitle,
    ArtistOrCreator,
    AlbumOrSeries,
    Genres,
    Tags,
    Overview,
    tokenize = 'unicode61 remove_diacritics 2'
);
```

When files are scanned or modified, VISTARA triggers asynchronous synchronization with `MediaSearchIndex`. The search query uses BM25 relevance ranking:

$$\text{Score} = \text{bm25}(MediaSearchIndex, 5.0, 3.0, 1.0, 2.0, 2.0, 1.0, 1.0, 0.5)$$

---

## 7. Security Architecture

1. **Loopback Locking:** Kestrel strictly binds to IP address `127.0.0.1` (loopback adapter).
2. **Host Header Validation:** Rejects any request where `Host` header is not `127.0.0.1` or `localhost`, preventing DNS rebinding attacks.
3. **Origin Validation:** Enforces that `Origin` or `Referer` headers match `http://127.0.0.1:*`, `http://localhost:*`, or `app://` (WPF WebView2).
4. **Anti-CSRF Tokens:** State-changing API endpoints (`POST`, `PUT`, `DELETE`) require the `X-Vistara-CSRF` header matching the session token.
5. **Path Traversal Guard:** All file and thumbnail routes validate paths against canonicalized library folders or the application data directory using `PathSecurityValidator`.

---

## 8. Media Integrity Monitor Architecture

The **Media Integrity Monitor (`IIntegrityService`)** provides continuous, read-only protection of the user's media collection:

```mermaid
flowchart TD
    Scan["Integrity Scan Initiated (Incremental / Full)"] --> CheckDrive{"Volume Root Accessible?"}
    CheckDrive -- No --> MarkDisc["Status = DriveDisconnected\nPreserve All Metadata & Art"]
    CheckDrive -- Yes --> CheckFile{"File Exists on Disk?"}
    CheckFile -- No --> MarkMiss["Status = Missing\nFlag for Recovery Assistant"]
    CheckFile -- Yes --> CheckStat{"Size / Mtime Changed?"}
    CheckStat -- Unchanged & Incremental --> MarkHealth["Status = Healthy\nFast-Path (No Hashing)"]
    CheckStat -- Changed / Full --> HashCompute["Streaming SHA-256 Hashing (64KB Buffer)"]
    HashCompute --> CompareHash{"Compare Previous Hash"}
    CompareHash -- Mismatch --> MarkMod["Status = Modified\nLog Historical Audit Record"]
    CompareHash -- Match --> ProbeContainer["FFprobe Container & Stream Check"]
    ProbeContainer --> ProbeValid{"Valid Video/Audio Streams?"}
    ProbeValid -- No / Corrupt --> MarkCorrupt["Status = Corrupted / Unreadable\nEmit IntegrityIssueDetected"]
    ProbeValid -- Yes --> MarkHealthFinal["Status = Healthy\nSave File Fingerprint"]
```

### Key Architectural Safeguards:
1. **Disconnected Drive Rule:** Disconnected external drives (USB HDDs/SSDs) or unmounted network shares are classified as `DriveDisconnected`—**never** marked as deleted or missing.
2. **Streaming SHA-256:** Uses asynchronous 64KB buffer streams to compute checksums without loading entire files into memory.
3. **Recovery Candidate Scoring:** Missing files can be relinked automatically or manually. Candidate discovery ranks filesystem matches by exact byte length match (score 70) and filename Levenshtein/substring similarity (score 30).
4. **Zero Media Modification:** The integrity service operates in strictly read-only mode with respect to media binaries.

---

## 9. Apple Music-Inspired Glassmorphism & UI Architecture (v1.4.0)

VISTARA incorporates a modern, fluid Apple Music-inspired desktop design system:
- **Living Fluid Mesh Aura:** Ambient chromatic mesh blooms (`#FA2D48` Apple Crimson, `#38BDF8` Sky Neon, `#818CF8` Cosmic Indigo) dynamically drifting with `blur-[120px]` and gentle oscillation behind acrylic glass panels.
- **Frosted Acrylic Glass Materials (`.apple-glass`, `.apple-glass-panel`):** Multi-layered glass surfaces engineered using `backdrop-filter: blur(28px) saturate(190%)`, hairline border illumination (`rgba(255, 255, 255, 0.12)`), and specular inset highlights.
- **macOS Apple Music Floating Sidebar:** Frosted translucent side panel with rounded pill navigation, active selection glow, and instant collapse/expand (<kbd>Ctrl</kbd> + <kbd>B</kbd>).
- **Apple Search Capsule:** Centered floating pill search bar with hairline frosted glass, real-time query clearance, and keyboard shortcut badge (<kbd>Ctrl</kbd> + <kbd>K</kbd>) triggering SQLite FTS5 BM25 queries.
- **Bottom Player Island Deck:** Floating translucent dock featuring artwork thumbnail, title, artist subtitle, centered transport controls with a solid radiant white circular play button, volume slider, visualizer mode switcher, and instant click-to-expand.
- **Borderless Dynamic Synced Lyrics Canvas:** Apple Music lyric typography featuring radiant white active text (`drop-shadow-[0_2px_16px_rgba(255,255,255,0.45)]`), past and upcoming lyric lines dynamically blurred (`blur-[0.35px]`) at 35-45% opacity, and smooth spring auto-centering scroll.

---

## 10. Bilingual Hinglish Lyrics & Subtitle Architecture

- **Subtitles Positioned Below Main Text:** Romanized Hinglish translations render inline beneath each synced lyric line (`main text ke neche`) with staggered slide-in animations.
- **Zero-Latency Client Transliterator (`devanagariToHinglish`):** Client-side instant engine with schwa deletion logic, nukta consonant mapping (`क़`, `ख़`, `ग़`, `ज़`, `फ़`, `ड़`, `ढ़`), and 50+ Bollywood vocabulary overrides (e.g., *parda*, *laazmi*, *tadpa*, *shaadi*, *mushkil*, *zindagi*), running with 0ms network latency.
- **Side-by-Side Lyrics Auto-Reveal:** Dynamically slides into view 2-3 seconds after audio playback begins beside the 3D Cassette Tape or Vinyl turntable, with 1-click manual toggle and persistence.

---

## 11. Multi-Tier Album Artwork Pipeline Architecture (100% Coverage)

- **Frame Decoding Re-encoder:** Replaced direct copy with `-vcodec mjpeg -vframes 1 -q:v 2 -y` in `ThumbnailService`, converting embedded PNG, WEBP, or BMP picture streams into compliant baseline JPEGs.
- **Folder-Level Discovery:** Inspects parent directory for artwork candidates (`cover.jpg`, `folder.jpg`, `album.jpg`, `front.jpg`).
- **Multi-Tier Online Search Hierarchy:**
  1. Full metadata query: *Artist + Album*
  2. Standalone album query: *Clean Album Title* (vital for Bollywood Soundtracks / OSTs with multiple playback singers)
  3. Track metadata query: *Artist + Track Title*
  4. Standalone track query: *Clean Track Title*
- **Scanner-Level Auto-Import:** Injected into `LibraryScannerService` to automatically fetch and link artwork IDs across `Track.ArtworkId`, `Album.ArtworkId`, and `Artist.ArtworkId`, verifying 100% library artwork resolution.

---

## 12. Motion System v2 & Studio Acoustic Architecture (v1.5.0)

### 12.1 GPU-Accelerated Motion Pipeline
The VISTARA Motion System v2 eliminates jerky state shifts and visual popping with a clean, CSS-native animation hierarchy:
- **Tab Route Mounting (`.page-enter`):** Each page change triggers a 420ms cubic-bezier curve (`0.16, 1, 0.3, 1`) combining an 14px upward translation, 0.985 to 1.0 scale transition, and 4px blur fade-out, creating a native desktop fluidity.
- **Cascading Grid Stagger (`.stagger-item`):** Grid items compute sequential delays via CSS `:nth-child` counters (`0.04s` to `0.44s`), allowing hundreds of movie/track cards to float into view organically without rendering freezes.
- **Card Shimmer & Elevation Engine (`.vistara-card`):** Custom GPU-composited pseudo-elements (`::after`) execute a 600ms specular linear light sweep across card surfaces upon hover while simultaneously applying `translateY(-4px)`, shadow blooming, and accent border illumination.
- **Magnetic Navigation Feedback (`.nav-item`, `.nav-active`):** Sidebar navigation elements incorporate active left border pill expansion via 250ms spring geometry transforms.

### 12.2 Studio Seductive Vocal & Acoustic Synthesizer
- **Neural Speech & DSP Conditioning:** Uses high-resolution multilingual edge neural audio (`fr-FR-VivienneMultilingualNeural`, rate `-22%`, pitch `-1Hz`) conditioned through a 3-stage mastering chain:
  1. *Parametric Warmth:* Peaking filter centered at 220Hz (+3.5dB, Q=1.1) simulating large-diaphragm condenser microphone proximity effect.
  2. *Air Highshelf:* Highshelf filter at 9000Hz (+6dB) delivering silky vocal breathiness.
  3. *Haas Spatial Delay:* 22ms spatial difference channel offset with brickwall limiting (`alimiter`).
- **Base64 Inline Ingestion:** Mastered vocal track is baked directly into `vistaraVoiceData.ts` as an inline Base64 data URI (~49KB), guaranteeing 0ms disk access latency and offline execution.
- **Web Audio Startup Engine (`audioMaster.ts`):** 5 modular synthesizer engines (`playCyberHorizon`, `playCinemaTaDum`, `playAcousticZen`, `playRetroCyberpunk`, `playCosmicAmbient`) coupled with the `playVoiceWhisper()` helper and toggle state management.

### 12.3 Dynamic Theming & Multitasking Runtime
- **CSS Variable Cascading:** `ThemeContext` updates `:root` CSS variables (`--accent-color`, `--color-accent`, `--accent-hover`) across 7 solid color themes, immediately re-skinning active highlights and glows throughout the DOM without component re-renders.
- **HTML5 Picture-in-Picture Controller:** Direct integration with `document.pictureInPictureEnabled`, `requestPictureInPicture()`, and `exitPictureInPicture()`, capturing browser window detachments and synchronizing UI button states seamlessly.

---

*VISTARA — Personal Media Universe © 2026. Built with precision for Windows.*
