# VISTARA — REST API & SignalR Reference

## Base URL: `http://127.0.0.1:5178/api/v1`

<p align="center">
  <img src="../assets/banner-animated.svg" alt="VISTARA Live Engine & Audio Spectrum" width="100%" />
</p>

<p align="center">
  <img src="../assets/soundwave-divider.svg" alt="VISTARA Audio Waveform" width="100%" />
</p>

---

## 1. General Principles

### 1.1 Response Envelope
All REST API endpoints return responses encapsulated in the standard `ApiResponse<T>` envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "error": null,
  "timestampUtc": "2026-11-08T00:00:00Z"
}
```

### 1.2 Zero-Login & Anti-CSRF
- On application bootstrap, the client requests `GET /api/v1/auth/bootstrap`.
- The response sets an `HttpOnly` session cookie and returns a CSRF token.
- All mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) must include the header:
  `X-Vistara-CSRF: <csrf_token>`

> [!NOTE]
> All API endpoints strictly enforce local loopback access (`127.0.0.1` / `localhost`). Requests with external Host or Origin headers are rejected with `403 Forbidden`.

---

## 2. Endpoints by Category

### 2.1 Authentication & Security (`/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/auth/bootstrap` | Initializes transparent zero-login session and returns CSRF token. |
| `GET` | `/api/v1/auth/session` | Validates that current session cookie and host header are active. |

---

### 2.2 Dashboard (`/dashboard`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard` | Aggregated dashboard: continue watching, recent media, storage usage, active jobs. |

---

### 2.3 Libraries (`/libraries`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/libraries` | List all configured libraries with folders and storage usage. |
| `GET` | `/api/v1/libraries/{id}` | Get specific library details. |
| `POST` | `/api/v1/libraries` | Create a new library. Body: `{ name, type, description, folderPaths }`. |
| `PUT` | `/api/v1/libraries/{id}` | Update library settings and auto-scan frequency. |
| `DELETE` | `/api/v1/libraries/{id}` | Delete a library from the catalog (preserves original media files). |
| `POST` | `/api/v1/libraries/{id}/folders` | Add a filesystem directory to library. Body: `{ path, isMonitored }`. |
| `DELETE` | `/api/v1/libraries/{id}/folders/{folderId}` | Remove folder from library. |
| `POST` | `/api/v1/libraries/{id}/scan` | Trigger immediate asynchronous library scan. |

---

### 2.4 Movies & Poster Engine (`/movies`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/movies` | Paged movies list (supports `pageSize: 100+`, `genre`, `year`, `sortBy`, `descending`). |
| `GET` | `/api/v1/movies/{id}` | Retrieve complete movie details, editions, and playback progress. |
| `POST` | `/api/v1/movies/{id}/favourite` | Toggle favorite status. |
| `POST` | `/api/v1/movies/{id}/watchlist` | Toggle watchlist status. |
| `GET` | `/api/v1/movies/{id}/poster-search` | Search online theatrical posters via OMDB & Cinemeta open catalogs. |
| `POST` | `/api/v1/movies/{id}/import-poster-url` | Apply online or external poster image URL to movie. |
| `POST` | `/api/v1/movies/{id}/upload-poster` | Upload custom poster file from local disk. |
| `POST` | `/api/v1/movies/{id}/auto-fetch-poster` | Automatically fetch and assign best-match poster for single movie. |
| `POST` | `/api/v1/movies/{id}/auto-fetch-description` | Automatically fetch and populate theatrical plot summary for movie. |
| `POST` | `/api/v1/movies/auto-fetch-all-posters` | Bulk tool: auto-fetches online posters and descriptions across all movies. |
| `GET` | `/api/v1/movies/genres` | List distinct genres present in cinema library. |

---

### 2.5 Television Series & Poster Engine (`/tvshows`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/tvshows` | Paged TV show series list. |
| `GET` | `/api/v1/tvshows/{id}` | Full series details, seasons, episodes, and chapter markers. |
| `POST` | `/api/v1/tvshows/{id}/favourite` | Toggle show favorite status. |
| `POST` | `/api/v1/tvshows/{id}/watchlist` | Toggle show watchlist status. |
| `GET` | `/api/v1/tvshows/{id}/poster-search` | Search online series posters via OMDB & Cinemeta. |
| `POST` | `/api/v1/tvshows/{id}/import-poster-url` | Apply online or external poster image URL to series. |
| `POST` | `/api/v1/tvshows/{id}/upload-poster` | Upload custom poster file for series. |
| `POST` | `/api/v1/tvshows/{id}/auto-fetch-poster` | Automatically fetch and assign best-match series poster. |
| `POST` | `/api/v1/tvshows/auto-fetch-all-posters` | Bulk tool: auto-fetches online series posters across all shows. |

---

### 2.6 Music & Synced Lyrics Engine (`/music`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/music/tracks` | Paged tracks query with genre/artist filters. |
| `GET` | `/api/v1/music/artists` | List all indexed music artists. |
| `GET` | `/api/v1/music/artists/{id}` | Get artist details, discography, and track listing. |
| `GET` | `/api/v1/music/albums` | Paged album catalog. |
| `GET` | `/api/v1/music/albums/{id}` | Get album tracks, release year, and cover artwork. |
| `GET` | `/api/v1/music/genres` | List distinct music genres. |
| `POST` | `/api/v1/music/tracks/{id}/favourite` | Toggle track favorite status. |
| `GET` | `/api/v1/music/tracks/{id}/lyrics` | Get cached synchronized or plain lyrics for track. |
| `POST` | `/api/v1/music/tracks/{id}/lyrics/search` | Search LRCLIB database for lyrics matching track title and artist. |
| `GET` | `/api/v1/music/lyrics/search` | Search LRCLIB by explicit query string parameters. |
| `POST` | `/api/v1/music/tracks/{id}/lyrics/apply/{lrclibId}` | Bind specific LRCLIB synced lyrics record to track. |
| `POST` | `/api/v1/music/tracks/{id}/lyrics/autofetch` | Automatic one-click lookup and assignment from LRCLIB. |
| `POST` | `/api/v1/music/lyrics/translate` | Translate lyrics into target language. |

---

### 2.7 Subtitles Engine (`/subtitles`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/subtitles/{streamId}` | Deliver embedded subtitle track as W3C standard WebVTT (`text/vtt`). |
| `GET` | `/api/v1/subtitles/file/{mediaFileId}/{streamIndex}` | Extract subtitle stream on the fly from media file. |
| `GET` | `/api/v1/subtitles/search` | Search OpenSubtitles & Cinemeta catalogs by title, year, IMDb ID, or language. |
| `POST` | `/api/v1/subtitles/download` | Download, decompress, and cache online subtitle file. |
| `GET` | `/api/v1/subtitles/online/{cacheFileName}` | Stream cached converted online WebVTT file to player. |

---

### 2.8 Streaming & Transcoding Engine (`/stream`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/stream/{fileId}` | HTTP 206 Partial Content byte-range video/audio direct play. |
| `GET` | `/api/v1/stream/{fileId}/remux` | **0% CPU DirectStream Remux** (lossless H.264 MKV to fragmented MP4 stream). |
| `GET` | `/api/v1/stream/{fileId}/hls/master.m3u8` | HLS master adaptive playlist. |
| `GET` | `/api/v1/stream/{fileId}/hls/stream.m3u8` | HLS media playlist with target segment duration. |
| `GET` | `/api/v1/stream/{fileId}/hls/segment_{idx}.ts`| Individual 4-second video transport stream segment. |
| `GET` | `/api/v1/stream/{fileId}/thumbnail` | Frame snapshot thumbnail extracted by FFmpeg. |

---

### 2.9 Artwork & Cache (`/artwork`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/artwork/{id}` | Serve cached high-res artwork or thumbnail with HTTP cache headers. |

---

### 2.10 Playback State (`/playback`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/playback/{fileId}` | Playback preparation: container formats, streams, resume position. |
| `POST` | `/api/v1/playback/progress` | Sync position. Body: `{ mediaFileId, positionSeconds, durationSeconds }`. |
| `POST` | `/api/v1/playback/complete/{itemId}` | Mark media item as fully watched (triggers next-episode logic). |

---

### 2.11 Full-Text Search (`/search`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/search?q={query}` | FTS5 ranked BM25 query across movies, shows, tracks, albums, and photos. |

---

### 2.12 Background Tasks (`/jobs`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/jobs` | List active background tasks (LibraryScan, Transcoding, Vacuum). |
| `GET` | `/api/v1/jobs/{id}` | Status of a specific task. |
| `POST` | `/api/v1/jobs/{id}/cancel` | Cancel background task. |
| `POST` | `/api/v1/jobs/{id}/pause` | Pause task execution. |
| `POST` | `/api/v1/jobs/{id}/resume` | Resume task execution. |

---

### 2.13 Settings & Backups (`/settings`, `/backups`, `/system`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/settings` | Read all system application settings. |
| `PUT` | `/api/v1/settings` | Update single setting. Body: `{ key, value }`. |
| `POST` | `/api/v1/settings/test-ffmpeg` | Verify FFmpeg and FFprobe binary execution. |
| `POST` | `/api/v1/settings/reset` | Restore settings to factory defaults. |
| `GET` | `/api/v1/backups` | List backup archives with verification status. |
| `POST` | `/api/v1/backups` | Create immediate database snapshot using `VACUUM INTO`. |
| `POST` | `/api/v1/backups/{id}/verify` | Validate zip archive checksum and header integrity. |
| `POST` | `/api/v1/backups/{id}/restore`| Restore database from snapshot. |
| `GET` | `/api/v1/system/health` | Diagnostic status (memory, uptime, OS, FFmpeg status). |
| `GET` | `/api/v1/system/hardware-acceleration`| Detected GPU acceleration APIs (NVENC, QSV, AMF). |

---

### 2.14 Media Integrity Monitor (`/integrity`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/integrity/dashboard` | Overall library health dashboard (healthy, modified, missing, corrupted, coverage %, verified size). |
| `GET` | `/api/v1/integrity/status` | Active integrity scan status and progress metrics. |
| `POST` | `/api/v1/integrity/scans` | Start a new library integrity scan (`Incremental`, `FullHash`, `QuickVerify`). |
| `POST` | `/api/v1/integrity/pause` | Pause currently executing scan. |
| `POST` | `/api/v1/integrity/resume` | Resume paused scan. |
| `POST` | `/api/v1/integrity/cancel` | Terminate running scan safely. |
| `GET` | `/api/v1/integrity/files/{id}` | Retrieve integrity record and SHA-256 fingerprint for a media file. |
| `POST` | `/api/v1/integrity/files/{id}/verify` | Trigger on-demand integrity verification for a single file. |
| `GET` | `/api/v1/integrity/files/{id}/history` | Historical verification log and hash audit trail for a file. |
| `GET` | `/api/v1/integrity/issues` | Filtered list of problematic media files (Missing, Corrupted, Unreadable, Modified). |
| `GET` | `/api/v1/integrity/files/{id}/recovery-candidates` | Discover candidate files on disk for relinking missing or moved files. |
| `POST` | `/api/v1/integrity/files/{id}/relink` | Relink media file record to new valid verified path on disk. |
| `GET` | `/api/v1/integrity/reports/export` | Export library integrity health report in CSV or JSON format. |
| `GET` | `/api/v1/integrity/settings` | Get integrity verification configuration and schedules. |
| `PUT` | `/api/v1/integrity/settings` | Update integrity verification settings and verification strategy. |

---

## 3. SignalR Real-Time Hub (`/hubs/vistara`)

Clients connect via WebSocket to `/hubs/vistara` to receive live updates:

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `ScanProgress` | `ScanProgressDto` | Emitted during library scans (current file, %, count). |
| `JobUpdated` | `BackgroundJobDto` | Emitted when background job starts, pauses, or finishes. |
| `PlaybackProgressUpdated`| `PlaybackProgressDto` | Synchronizes progress across active views. |
| `SystemNotification` | `string message, string level` | Toast alerts (information, warning, error). |
| `IntegrityScanProgress` | `IntegrityScanProgressDto` | Emitted during integrity scans (files verified, % completed, healthy/corrupt counts). |
| `IntegrityIssueDetected` | `IntegrityEventDto` | Emitted immediately when a corrupted, missing, or modified file is identified. |
| `IntegrityScanCompleted`| `IntegrityScanDto` | Broadcast upon completion or cancellation of an integrity scan with summary statistics. |

---

*VISTARA — Personal Media Universe © 2026. Built with precision for Windows.*
