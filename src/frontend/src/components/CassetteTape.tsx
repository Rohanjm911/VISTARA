import React, { useState } from 'react';

export interface CassetteTapeProps {
  artworkUrl?: string | null;
  title: string;
  artist: string;
  album?: string;
  isPlaying: boolean;
  progress?: number; // 0 to 1
  bassLevel?: number; // 0 to 1
  beatPulse?: number; // 0 to 1
  // Detailed metadata for Side B:
  audioFormat?: string;
  audioCodec?: string;
  bitrateKbps?: number;
  sampleRate?: number;
  channels?: number;
  fileSizeBytes?: number;
  durationSeconds?: number;
  year?: number;
  genre?: string;
  trackNumber?: number;
  discNumber?: number;
  onPlayPauseToggle?: () => void;
  onClick?: () => void;
  className?: string;
}

export const CassetteTape: React.FC<CassetteTapeProps> = ({
  artworkUrl,
  title,
  artist,
  album,
  isPlaying,
  progress = 0,
  bassLevel = 0,
  beatPulse = 0,
  audioFormat,
  audioCodec,
  bitrateKbps,
  sampleRate,
  channels,
  fileSizeBytes,
  durationSeconds,
  year,
  genre,
  trackNumber,
  discNumber,
  onPlayPauseToggle,
  onClick,
  className = '',
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Clamp progress between 0 and 1
  const normProgress = Math.min(1, Math.max(0, isNaN(progress) ? 0 : progress));

  // Dynamic tape spool thickness:
  // Supply reel (left) shrinks from 27px to 15px
  // Take-up reel (right) grows from 15px to 27px
  const leftSpoolRadius = 27 - normProgress * 12;
  const rightSpoolRadius = 15 + normProgress * 12;

  // Formatted duration string helper
  const formatDuration = (secs?: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Formatted file size helper
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return null;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Computed audio quality / format details
  const displayFormat = audioFormat || (audioCodec?.toUpperCase() ?? 'MP3');
  const isLossless = ['FLAC', 'ALAC', 'WAV', 'AIFF', 'DSD'].includes(displayFormat);
  const displayBitrate = bitrateKbps
    ? `${bitrateKbps} kbps`
    : isLossless
    ? '1411 kbps (Lossless Master)'
    : '320 kbps (Hi-Res Audio)';
  const displaySampleRate = sampleRate
    ? `${(sampleRate / 1000).toFixed(1)} kHz`
    : '44.1 kHz';
  const displayChannels = channels === 1 ? 'Mono' : '2-Ch Stereo';

  const handleCardClick = (e: React.MouseEvent) => {
    // If user clicked directly, toggle the 3D flip between Side A and Side B
    setIsFlipped((prev) => !prev);
    if (onClick) {
      onClick();
    }
  };

  const handlePlayPauseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlayPauseToggle) {
      onPlayPauseToggle();
    }
  };

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      title={isFlipped ? 'Click to flip back to Side A (Tape View)' : 'Click to flip to Side B (Audio Metadata)'}
      className={`relative select-none cursor-pointer group transition-transform duration-300 hover:scale-[1.02] active:scale-[0.99] ${className}`}
      style={{ perspective: '1200px' }}
    >
      {/* Dynamic Ambient Glow behind the cassette when playing - reactive to music bass */}
      {isPlaying && (
        <div
          className="absolute -inset-4 sm:-inset-6 rounded-3xl bg-accent/20 blur-2xl pointer-events-none transition-all duration-100 -z-10"
          style={{
            transform: `scale(${1 + (beatPulse || 0) * 0.08})`,
            opacity: 0.65 + (bassLevel || 0) * 0.35,
          }}
        />
      )}

      {/* 3D Flipping Container */}
      <div
        className="relative w-[310px] sm:w-[370px] h-[195px] sm:h-[230px] transition-transform duration-700 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ================================================================= */}
        {/* SIDE A: VINTAGE CASSETTE FRONT FACE                               */}
        {/* ================================================================= */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl bg-[#10141d] border-2 border-[#2b3548] p-2 sm:p-2.5 flex flex-col justify-between overflow-hidden shadow-2xl"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            boxShadow: isPlaying
              ? `0 20px 50px rgba(0,0,0,0.9), 0 0 ${16 + (bassLevel || 0) * 24}px rgba(56, 189, 248, ${0.2 + (bassLevel || 0) * 0.35})`
              : '0 20px 50px rgba(0,0,0,0.9)',
          }}
        >
          {/* Top edge grip ridges & write-protect notch accents */}
          <div className="absolute top-0 left-0 right-0 h-1.5 flex justify-between px-6 pointer-events-none opacity-40">
            <div className="w-12 h-1 bg-[#2e374a] rounded-b" />
            <div className="w-12 h-1 bg-[#2e374a] rounded-b" />
          </div>

          {/* 4 Metal Corner Screws */}
          <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937] shadow-inner flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-[1px] bg-[#111827] rotate-45" />
            <div className="w-1.5 h-[1px] bg-[#111827] -rotate-45 absolute" />
          </div>
          <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937] shadow-inner flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-[1px] bg-[#111827] rotate-12" />
            <div className="w-1.5 h-[1px] bg-[#111827] -rotate-78 absolute" />
          </div>
          <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937] shadow-inner flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-[1px] bg-[#111827] rotate-30" />
            <div className="w-1.5 h-[1px] bg-[#111827] -rotate-60 absolute" />
          </div>
          <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937] shadow-inner flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-[1px] bg-[#111827] rotate-90" />
            <div className="w-1.5 h-[1px] bg-[#111827] rotate-0 absolute" />
          </div>

          {/* Side Textured Grip Ridges */}
          <div className="absolute left-1 top-12 bottom-12 w-1 flex flex-col justify-between py-1 pointer-events-none opacity-30">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-2 w-1 bg-[#374151] rounded-full" />
            ))}
          </div>
          <div className="absolute right-1 top-12 bottom-12 w-1 flex flex-col justify-between py-1 pointer-events-none opacity-30">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-2 w-1 bg-[#374151] rounded-full" />
            ))}
          </div>

          {/* CASSETTE STICKER LABEL (SIDE A) */}
          <div className="relative w-full h-[120px] sm:h-[142px] rounded-xl overflow-hidden border border-[#2b3548] shadow-md flex flex-col justify-between bg-[#141824]">
            {/* Album Artwork as Label Backdrop */}
            {artworkUrl ? (
              <div className="absolute inset-0 z-0">
                <img
                  src={artworkUrl}
                  alt={title}
                  className="w-full h-full object-cover filter brightness-[0.7] contrast-[1.08] saturate-[1.1]"
                />
                <div className="absolute inset-0 bg-[#0e121c]/80" />
              </div>
            ) : (
              <div className="absolute inset-0 z-0 bg-[#131722]" />
            )}

            {/* Top Label Header: Brand, Format, Dolby & Flip Hint */}
            <div className="relative z-10 px-3 pt-2 pb-1 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-sm">
              <div className="flex items-center space-x-1.5">
                <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono font-black text-[9px] tracking-wider shadow-sm">
                  A
                </span>
                <span className="text-[10px] font-black font-mono tracking-widest text-white/95 uppercase">
                  VISTARA
                </span>
                <span className="text-[8px] font-mono font-bold px-1 rounded bg-[#151a21] text-accent border border-accent/40 hidden sm:inline">
                  CHROME C-90
                </span>
              </div>

              <div className="flex items-center space-x-1.5 text-[8px] font-mono text-gray-300">
                <span className="px-1 rounded bg-accent/20 text-accent border border-accent/40 font-semibold text-[7.5px] animate-pulse">
                  ⇄ TAP TO FLIP
                </span>
                <span className="px-1 rounded bg-white/10 text-white font-bold hidden sm:inline">DOLBY B•C NR</span>
              </div>
            </div>

            {/* Middle Label Strip: Song Title & Artist */}
            <div className="relative z-10 px-3 py-1 flex items-center justify-between">
              <div className="truncate max-w-[210px] sm:max-w-[260px]">
                <div className="text-xs sm:text-[13px] font-bold text-white tracking-tight truncate drop-shadow-md">
                  {title || 'Unknown Track'}
                </div>
                <div className="text-[9.5px] sm:text-[10.5px] font-medium text-[#a4afb9] truncate drop-shadow">
                  {artist || 'Unknown Artist'} {album && `• ${album}`}
                </div>
              </div>

              <div className="flex flex-col items-end flex-shrink-0 opacity-80 pl-1">
                <div className="flex items-center space-x-0.5 text-[8px] font-mono font-black text-amber-400">
                  <span>STEREO</span>
                </div>
                <div className="text-[7px] font-mono text-gray-400">HIGH FIDELITY</div>
              </div>
            </div>

            {/* Bottom Label Stripe: Retro Colored Accent Lines */}
            <div className="relative z-10 w-full flex h-1 pointer-events-none">
              <div className="flex-1 bg-rose-500/80" />
              <div className="flex-1 bg-amber-500/80" />
              <div className="flex-1 bg-emerald-500/80" />
              <div className="flex-1 bg-sky-500/80" />
              <div className="flex-1 bg-accent/80" />
            </div>
          </div>

          {/* CLEAR INSPECTION WINDOW & DUAL ROTATING TAPE SPOOLS */}
          <div className="relative z-20 mx-auto -mt-4 w-[240px] sm:w-[280px] h-[64px] sm:h-[72px] rounded-xl bg-[#080b11] border-2 border-[#1c2230] shadow-[inset_0_4px_12px_rgba(0,0,0,0.9)] flex items-center justify-between px-5 sm:px-7 overflow-hidden">
            {/* Central Tape Counter Scale Lines */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none opacity-40">
              <div className="flex space-x-1 text-[7px] font-mono text-gray-400">
                <span>100</span>
                <span>50</span>
                <span>0</span>
              </div>
              <div className="flex space-x-1 mt-0.5">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className={`w-[1px] bg-gray-400 ${i % 4 === 0 ? 'h-2' : 'h-1'}`} />
                ))}
              </div>
            </div>

            {/* Running Magnetic Tape Ribbon at bottom */}
            <div className="absolute bottom-1.5 left-4 right-4 h-1.5 bg-[#1f1712] border-t border-[#3b2a1f] shadow-inner" />

            {/* LEFT SPOOL (SUPPLY REEL) */}
            <div className="relative flex items-center justify-center">
              <div
                className="absolute rounded-full bg-[#1b100a] border border-[#3e271a] shadow-md transition-all duration-500 ease-out"
                style={{
                  width: `${leftSpoolRadius * 2}px`,
                  height: `${leftSpoolRadius * 2}px`,
                }}
              />
              <div
                className="relative w-8 h-8 rounded-full bg-white border border-gray-300 shadow flex items-center justify-center"
                style={{
                  animation: isPlaying ? 'cassetteSpoolRotate 2.6s linear infinite' : 'none',
                  transformOrigin: 'center center',
                }}
              >
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1.5 h-1 bg-[#181d28] rounded-[1px]"
                    style={{
                      transform: `rotate(${i * 60}deg) translateY(-10px)`,
                    }}
                  />
                ))}
                <div className="w-3.5 h-3.5 rounded-full bg-[#080b11] border border-[#2b3548] shadow-inner" />
              </div>
            </div>

            {/* Center Tape Window Cutout Notch with Play/Pause button */}
            <button
              onClick={handlePlayPauseClick}
              title={isPlaying ? 'Pause Playback' : 'Start Playback'}
              className="relative flex flex-col items-center group/btn cursor-pointer z-30 p-1"
            >
              <div className="w-8 h-2 rounded bg-black/60 border border-white/10 group-hover/btn:border-accent/60 transition-colors" />
              <span className={`text-[7.5px] font-mono font-bold mt-1 transition-all ${
                isPlaying ? 'text-accent animate-pulse scale-105' : 'text-gray-400 group-hover/btn:text-white'
              }`}>
                {isPlaying ? 'PLAY ▶' : 'PAUSED ❚❚'}
              </span>
            </button>

            {/* RIGHT SPOOL (TAKE-UP REEL) */}
            <div className="relative flex items-center justify-center">
              <div
                className="absolute rounded-full bg-[#1b100a] border border-[#3e271a] shadow-md transition-all duration-500 ease-out"
                style={{
                  width: `${rightSpoolRadius * 2}px`,
                  height: `${rightSpoolRadius * 2}px`,
                }}
              />
              <div
                className="relative w-8 h-8 rounded-full bg-white border border-gray-300 shadow flex items-center justify-center"
                style={{
                  animation: isPlaying ? 'cassetteSpoolRotate 2.6s linear infinite' : 'none',
                  transformOrigin: 'center center',
                }}
              >
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1.5 h-1 bg-[#181d28] rounded-[1px]"
                    style={{
                      transform: `rotate(${i * 60}deg) translateY(-10px)`,
                    }}
                  />
                ))}
                <div className="w-3.5 h-3.5 rounded-full bg-[#080b11] border border-[#2b3548] shadow-inner" />
              </div>
            </div>
          </div>

          {/* LOWER BEVELED HEAD APERTURE */}
          <div className="relative mx-auto w-[210px] sm:w-[250px] h-[26px] sm:h-[30px] rounded-b-lg bg-[#0c0f16] border-x-2 border-b-2 border-[#202735] flex items-center justify-between px-6 shadow-inner -mt-1">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#181e2b] border border-[#2e3748] shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#9ca3af] opacity-60" />
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-6 h-2 rounded-sm bg-[#18202d] border border-white/5 flex items-center justify-center">
                <div
                  className={`w-1.5 h-1 rounded-full transition-colors ${
                    isPlaying ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-gray-600'
                  }`}
                />
              </div>
              <div className="w-2 h-2 rounded-full bg-[#4b5563] border border-[#1f2937] shadow-inner flex items-center justify-center">
                <div className="w-1 h-[0.8px] bg-[#111827] rotate-45" />
              </div>
              <div className="w-6 h-2 rounded-sm bg-[#18202d] border border-white/5" />
            </div>

            <div className="flex items-center space-x-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#9ca3af] opacity-60" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#181e2b] border border-[#2e3748] shadow-inner" />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SIDE B: VINTAGE CASSETTE FLIPPED FACE — DETAILED MUSIC METADATA    */}
        {/* ================================================================= */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl bg-[#0d1017] border-2 border-[#2b3548] p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden shadow-2xl text-left"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: isPlaying
              ? `0 20px 50px rgba(0,0,0,0.9), 0 0 ${16 + (bassLevel || 0) * 24}px rgba(56, 189, 248, ${0.2 + (bassLevel || 0) * 0.35})`
              : '0 20px 50px rgba(0,0,0,0.9)',
          }}
        >
          {/* 4 Metal Corner Screws on Side B */}
          <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937] shadow-inner flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-[1px] bg-[#111827] rotate-12" />
          </div>
          <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937] shadow-inner flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-[1px] bg-[#111827] rotate-45" />
          </div>
          <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937] shadow-inner flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-[1px] bg-[#111827] rotate-75" />
          </div>
          <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937] shadow-inner flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-[1px] bg-[#111827] rotate-30" />
          </div>

          {/* TOP SIDE B HEADER BAR */}
          <div className="relative z-10 px-2.5 pt-0.5 pb-1 flex items-center justify-between border-b border-[#2b3548] bg-[#0c0f16]/80 rounded-t-lg">
            <div className="flex items-center space-x-1.5">
              {/* SIDE B Electric Blue Badge */}
              <span className="px-1.5 py-0.2 rounded bg-sky-500 text-white font-mono font-black text-[9px] tracking-wider shadow-sm">
                B
              </span>
              <span className="text-[9.5px] font-black font-mono tracking-wider text-sky-200 uppercase">
                VISTARA MASTER ARCHIVE
              </span>
            </div>

            <div className="flex items-center space-x-1.5 text-[8px] font-mono">
              <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                isLossless
                  ? 'bg-accent/20 text-accent border border-accent/40'
                  : 'bg-[#151a21] text-[#a4afb9] border border-[#303a45]'
              }`}>
                {displayFormat}
              </span>
              <span className="text-gray-400 hidden sm:inline">•</span>
              <span className="text-[#a4afb9] hidden sm:inline">{displayBitrate.split(' ')[0]} kbps</span>
            </div>
          </div>

          {/* MIDDLE METADATA CARD — VINTAGE CASSETTE INDEX / J-CARD STYLE */}
          <div className="relative z-10 flex-1 my-1 px-3 py-1.5 rounded-lg bg-[#0e121a]/90 border border-[#232b3c] flex flex-col justify-between shadow-inner">
            
            {/* Row 1: Track Title & Singer Name */}
            <div className="space-y-0.5 border-b border-[#1b2230] pb-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] sm:text-[13px] font-bold text-white tracking-tight truncate drop-shadow flex-1">
                  {trackNumber ? `#${trackNumber}. ` : ''}{title || 'Unknown Track'}
                </span>
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-black/40 text-accent border border-accent/30 flex-shrink-0">
                  {formatDuration(durationSeconds)}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium text-[#a4afb9] truncate flex items-center space-x-1">
                <span className="text-[#6b7280]">Singer / Artist:</span>
                <span className="font-semibold text-white truncate">{artist || 'Unknown Artist'}</span>
              </div>
            </div>

            {/* Row 2: Movie / Album & Year/Genre */}
            <div className="grid grid-cols-2 gap-2 text-[9.5px] sm:text-[10px] py-1 border-b border-[#1b2230]">
              <div className="truncate">
                <span className="text-[#6b7280] block text-[8px] font-mono uppercase tracking-wider">Movie / Album:</span>
                <span className="text-gray-200 font-medium truncate block" title={album || 'Single'}>
                  {album || 'Single / Independent'}
                </span>
              </div>
              <div className="truncate text-right">
                <span className="text-[#6b7280] block text-[8px] font-mono uppercase tracking-wider">Year & Genre:</span>
                <span className="text-accent/90 font-medium truncate block">
                  {year || '2024'} {genre && `• ${genre}`}
                </span>
              </div>
            </div>

            {/* Row 3: Audio Format, Bitrate, Sample Rate & Codec Details */}
            <div className="grid grid-cols-3 gap-1 pt-1 text-[8.5px] sm:text-[9.5px] font-mono">
              <div className="bg-[#141822] p-1 rounded border border-[#202838]">
                <div className="text-[7.5px] text-[#6b7280] uppercase">Format & Codec</div>
                <div className="text-accent font-bold truncate">{displayFormat} • {audioCodec || displayFormat}</div>
              </div>

              <div className="bg-[#141822] p-1 rounded border border-[#202838]">
                <div className="text-[7.5px] text-[#6b7280] uppercase">Bitrate</div>
                <div className="text-white font-bold truncate">{displayBitrate}</div>
              </div>

              <div className="bg-[#141822] p-1 rounded border border-[#202838]">
                <div className="text-[7.5px] text-[#6b7280] uppercase">Sample Rate</div>
                <div className="text-[#a4afb9] font-bold truncate">{displaySampleRate} {displayChannels}</div>
              </div>
            </div>

            {/* Row 4: File Size & Disc / Master Quality Status */}
            <div className="flex items-center justify-between pt-1 text-[8px] font-mono text-[#9ca3af]">
              <div className="flex items-center space-x-1.5">
                {formatFileSize(fileSizeBytes) && (
                  <span className="px-1.5 py-0.2 rounded bg-black/40 text-gray-300 border border-white/5">
                    💾 {formatFileSize(fileSizeBytes)}
                  </span>
                )}
                {discNumber && (
                  <span className="px-1.5 py-0.2 rounded bg-black/40 text-gray-300 border border-white/5">
                    DISC {discNumber}
                  </span>
                )}
                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>MASTER AUDIO HI-FI</span>
                </span>
              </div>

              {/* Dynamic Mini Audio VU Reactivity */}
              <div className="flex items-end space-x-0.5 h-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-0.5 rounded-full transition-all duration-75 ${
                      i < 2 ? 'bg-emerald-400' : i < 4 ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{
                      height: isPlaying ? `${Math.max(3, (bassLevel || 0) * 12 * (0.6 + i * 0.1))}px` : '3px',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM HINT STRIP: TAP TO FLIP BACK TO SIDE A */}
          <div className="relative z-10 mx-auto w-full flex items-center justify-between px-2 pt-0.5">
            <span className="text-[8px] font-mono text-[#6b7280]">
              SIDE B • TRACK SPECIFICATION
            </span>
            <div className="flex items-center space-x-1.5">
              <span className="px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-500/40 text-sky-300 font-mono text-[8px] font-bold shadow-sm animate-pulse">
                ↻ TAP TO FLIP TO SIDE A
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
