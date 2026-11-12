# VISTARA — Media Engine Documentation

## FFmpeg • FFprobe • Hardware Acceleration • Transcoding Pipelines

<p align="center">
  <img src="../assets/cinema-banner-animated.svg" alt="Cinema Universe & Theatrical Playback Engine" width="100%" />
</p>

<p align="center">
  <img src="../assets/soundwave-divider.svg" alt="VISTARA Audio Waveform" width="100%" />
</p>

---

## 1. Engine Overview & Process Execution

The **Vistara.MediaEngine** subsystem is responsible for media inspection, hardware-accelerated transcoding, live container remuxing, thumbnail extraction, and subtitle conversion.

All interactions with FFmpeg and FFprobe are managed through the safe process abstraction `FFmpegRunner`:
- **No Shell Execution:** `UseShellExecute = false` is enforced. Binaries are executed directly with strictly tokenized arguments to prevent command injection vulnerabilities.
- **Path Resolution Order:**
  1. Configured custom path in `AppSettings` (`FFmpeg.Path`).
  2. Standard installation directory: `C:\ffmpeg\ffmpeg.exe` and `C:\ffmpeg\ffprobe.exe`.
  3. System environment `PATH`.
- **Process Cancellation:** Long-running FFmpeg child processes are tied to `CancellationToken` instances. When playback stops or seeking occurs, orphaned transcode processes are immediately terminated.

---

## 2. Stream Analysis (`FFprobeAnalyzer`)

When a new media file is discovered during a library scan, `FFprobeAnalyzer` executes:

```powershell
ffprobe -v quiet -print_format json -show_format -show_streams -show_chapters "D:\Media\Movie.mkv"
```

The resulting JSON is deserialized into structured `MediaFile` and `MediaStream` entities:
- **Container Analysis:** Format name, duration, total bitrate, container tags.
- **Video Streams:** Codec name (e.g. `h264`, `hevc`, `av1`), profile, resolution (`Width` $\times$ `Height`), frame rate ($fps$), pixel format (`yuv420p`, `10bit`).
- **Audio Streams:** Codec (e.g. `aac`, `flac`, `ac3`, `dts`), channel layout (Stereo, 5.1 Surround, 7.1), sample rate ($44.1\text{ kHz}$, $48\text{ kHz}$), language tags (`eng`, `jpn`).
- **Subtitle Streams:** Codec (`subrip`, `ass`, `mov_text`), language, track title, default flag.
- **EXIF Extraction:** For photos, extracts camera make/model, aperture, shutter speed, ISO, focal length, and orientation.

---

## 3. Hardware Acceleration (`HardwareAccelerationService`)

VISTARA dynamically queries FFmpeg capabilities to select the most efficient hardware acceleration method:

```powershell
ffmpeg -hwaccels
```

### Supported Hardware Encoders
| API | Vendor | Encoders Probed | Fallback |
| :--- | :--- | :--- | :--- |
| **CUDA / NVENC** | NVIDIA GeForce / RTX | `h264_nvenc`, `hevc_nvenc` | D3D11VA |
| **QSV** | Intel Core / Arc Graphics | `h264_qsv`, `hevc_qsv` | DXVA2 |
| **AMF** | AMD Radeon Graphics | `h264_amf`, `hevc_amf` | D3D11VA |
| **D3D11VA** | Microsoft Direct3D 11 | Hardware Decoding | Software |
| **DXVA2** | Microsoft DirectX Video Accel | Hardware Decoding | Software |
| **CPU / Software** | Generic x64 CPU | `libx264`, `libx265`, `libsvtav1` | Baseline |

> [!IMPORTANT]
> **10-Bit Color Conversion & NVENC Tuning:**
> Consumer NVIDIA GPUs often reject 10-bit encode inputs when producing H.264 streams (`[h264_nvenc] 10 bit encode not supported`). VISTARA automatically inserts `-pix_fmt yuv420p` along with `-preset p2` during NVENC invocations, guaranteeing smooth hardware-accelerated playback of 10-bit HEVC x265 content with zero crashes.

---

## 4. Streaming Pipelines

### Pipeline 1: Direct Play (HTTP 206 Partial Content)
- **Applicable Containers:** MP4, WebM.
- **Applicable Codecs:** H.264 / AV1 video, AAC / MP3 / Opus audio.
- **Implementation:** ASP.NET Core `PhysicalFileResult` with `enableRangeProcessing: true`.
- **CPU Usage:** 0% CPU overhead; data is served directly from filesystem cache.

### Pipeline 2: 0% CPU DirectStream Remux
- **Scenario:** Video codec is native (e.g. H.264 in an MKV or MOV container).
- **Execution:**
  ```powershell
  ffmpeg -hide_banner -loglevel error -ss {offset} -i "{input_path}" -map 0:v:0 -map 0:a:{audioIdx}? -c:v copy -c:a aac -b:a 192k -movflags frag_keyframe+empty_moov+default_base_moof -f mp4 pipe:1
  ```
- **Benefit:** Lossless byte-for-byte stream passthrough of the video stream. Zero video decompression or re-compression. Startup latency is approximately 10ms with 0% CPU consumption.

### Pipeline 3: Adaptive HLS & Hardware Transcoding
- **Scenario:** Incompatible video codecs (e.g. 10-bit HEVC x265, VC-1, MPEG-2) or multi-channel audio tracks (DTS/TrueHD/AC3).
- **Segmentation:**
  - HLS playlists (`.m3u8`) generated dynamically on demand.
  - Video segmented into 4-second transport stream (`.ts`) fragments.
  - Hardware acceleration flags applied:
    ```powershell
    ffmpeg -hwaccel auto -ss {segment_start} -t 4 -i "{input_path}" -c:v h264_nvenc -preset p2 -pix_fmt yuv420p -b:v 4500k -c:a aac -b:a 192k -f mpegts pipe:1
    ```

---

## 5. Audio Pipeline & Self-Healing Stream Recovery

<p align="center">
  <img src="../assets/rainbow-visualizer.svg" alt="Beat-Synced Rainbow Spectrum" width="100%" />
</p>

### Zero-Stall Resilience
Non-standard or corrupted ID3 / Vorbis embedded cover picture blocks can cause browser audio demuxers to fail. VISTARA features an automated self-healing fallback stream:
```powershell
ffmpeg -ss {start_seconds} -i "{audio_path}" -vn -c:a libmp3lame -b:a 320k -f mp3 pipe:1
```
- Transmuxes audio into a clean, header-normalized 320 kbps MP3 stream.
- Initiates within ~70ms, ensuring music never stops playing.

---

## 6. Thumbnail, Poster & Subtitle Extraction

### Video Thumbnails
Extracted at 10% of total duration or 15 seconds in:
```powershell
ffmpeg -ss 15 -i "{video_path}" -vframes 1 -vf "scale=480:-1" -q:v 2 "{thumb_path}"
```

### Audio Album Cover Extraction & Codec Normalization
Embedded cover art in audio files (MP3 ID3v2 APIC frames, FLAC METADATA_BLOCK_PICTURE, M4A covr atoms) frequently contains non-JPEG formats such as PNG or WEBP. Earlier naive extraction using `-vcodec copy` failed whenever an embedded PNG was directed to a `.jpg` target.

VISTARA resolves this with guaranteed full-frame re-encoding:
```powershell
ffmpeg -hide_banner -loglevel error -i "{audio_path}" -an -vcodec mjpeg -vframes 1 -q:v 2 -y "{output_path}"
```
- **Codec Independence:** Automatically converts any embedded image stream (PNG, WEBP, BMP, progressive JPEG) into a high-quality standard baseline JPEG.
- **Folder-Level Fallback:** If no embedded stream exists, `ThumbnailService` searches the track's folder for candidate art files (`cover.jpg`, `folder.jpg`, `album.jpg`, `front.jpg`, etc.).
- **Multi-Tier Online Auto-Import:** If local extraction yields no artwork, `LibraryScannerService` automatically invokes `IMusicArtworkService` using a 4-tier query hierarchy:
  1. Full metadata: *Artist + Album*
  2. Standalone album: *Clean Album Title* (critical for multi-artist Bollywood soundtracks / OSTs)
  3. Track metadata: *Artist + Track Title*
  4. Standalone track: *Clean Track Title*
- Discovered artwork is saved to cache and linked to `Track.ArtworkId`, `Album.ArtworkId`, and `Artist.ArtworkId`, ensuring 100% artwork resolution library-wide.

### Embedded Subtitle to WebVTT
VISTARA extracts embedded SRT or text subtitles and converts them on-the-fly to standard HTML5 WebVTT:
```powershell
ffmpeg -i "{video_path}" -map 0:{stream_index} -f webvtt pipe:1
```
The resulting WebVTT stream is delivered with proper MIME type `text/vtt; charset=utf-8` and rendered natively in the video player overlay.

### Online Open-Source Subtitles (OpenSubtitles v3 & Cinemeta)
- Automatically resolves IMDb IDs using title and release year.
- Fetches synchronized `.srt` or `.gz` archives, decompresses them, normalizes millisecond punctuation, and stores them under `%LOCALAPPDATA%\Vistara\cache\subtitles\`.

---

## 7. Media Integrity Validation & Deep Container Probing

The Media Engine works in tandem with the **Media Integrity Monitor (`IIntegrityService`)**:
- **Container Health Validation:** `FFprobeAnalyzer` inspects media headers and stream tables to detect truncated containers, corrupted index tables (MOOV atoms), or missing elementary audio/video streams.
- **Deep Stream Decode Checking:** For suspected corrupted media, `FFmpegRunner` executes targeted decode checks (`-v error -i "{path}" -f null -`) to identify silent bit rot and undecodable frames without writing output files.
- **Strict Read-Only Execution:** All media probing and stream testing is performed with read-only permissions, guaranteeing that original media files are never altered or touched.

---

*VISTARA — Personal Media Universe © 2026. Built with precision for Windows.*
