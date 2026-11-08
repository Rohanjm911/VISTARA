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
        Bars["Rainbow Spectrum Bars (310° Hue, Laser Caps)"]
        Embers["Cosmic Rainbow Embers (Particle Dynamics, Sonic Shockwaves)"]
        Wave["Liquid Wave (Spline Ribbons)"]
        Halo["Radial Halo (360° Artwork Pulse)"]
        VU["Dual Stereo VU Meters (Ballistic Inertia)"]
    end
```

> [!TIP]
> **Sub-Bass Kick Tracking:**
> The visualizer engine isolates frequency bins $0 \rightarrow 3$ ($20 \text{ Hz} \rightarrow 90 \text{ Hz}$). When energy surpasses the dynamic threshold, it triggers kinetic velocity surges in Cosmic Embers and gravitational acceleration on Rainbow Spectrum floating peak caps.

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

## 9. Unified Dual-Tone Design Architecture (v2.1)

VISTARA strictly adheres to a unified dual-tone design language:
- **Surfaces:** Deep Midnight Charcoal (`#10151B` base, `#151A21` surface, `#1B222B` raised panels, `#222B35` cards).
- **Borders & Dividers:** Subtle high-contrast borders (`#242A36` primary, `#303A45` secondary).
- **Signature Accent:** Solid Electric Teal (`#35C6B0`, hover `#2BA895`).
- **Typography:** Inter / system-ui sans-serif with JetBrains Mono for durations, hashes, and bitrates.
- **Strict Visual Discipline:** Zero gradients, zero neon glassmorphism, zero competing accent palettes.

---

*VISTARA — Personal Media Universe © 2026. Built with precision for Windows.*
