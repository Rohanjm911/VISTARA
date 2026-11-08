import React, { useEffect, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  ChevronDown,
  Disc,
  Heart,
  ListMusic,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Volume2,
  VolumeX,
  X,
  Moon,
  Sparkles,
  RefreshCw,
  Search,
  Globe,
  Check,
  Languages,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { TrackDto, LrcLine, LyricsResultDto, LrcLibSearchResultDto, TranslatedLyricsResultDto } from '../types';
import { AudioVisualizer, VisualizerMode } from './AudioVisualizer';
import { CassetteTape } from './CassetteTape';
import { LyricsBeatVisualizer } from './LyricsBeatVisualizer';
import { AudioProgressBar } from './AudioProgressBar';
import { useLyricsBeat } from '../hooks/useLyricsBeat';

export interface LyricStanza {
  id: string;
  tag?: string;
  tagType: 'verse' | 'chorus' | 'pre-chorus' | 'bridge' | 'intro' | 'outro' | 'other';
  lines: string[];
}

export function parsePlainLyrics(lyrics?: string): LyricStanza[] {
  if (!lyrics) return [];
  const rawLines = lyrics.split(/\r?\n/);
  const stanzas: LyricStanza[] = [];
  let currentStanza: LyricStanza = {
    id: 'stanza-0',
    tagType: 'other',
    lines: [],
  };

  const sectionRegex = /^\s*\[?(Verse(?:\s*\d+)?|Chorus(?:\s*\d+)?|Pre-Chorus(?:\s*\d+)?|Post-Chorus(?:\s*\d+)?|Bridge(?:\s*\d+)?|Intro|Outro|Hook(?:\s*\d+)?|Solo|Refrain)\]?:?\s*$/i;

  const determineTagType = (tagStr: string): LyricStanza['tagType'] => {
    const t = tagStr.toLowerCase();
    if (t.includes('chorus') && !t.includes('pre') && !t.includes('post')) return 'chorus';
    if (t.includes('pre-chorus') || t.includes('post-chorus')) return 'pre-chorus';
    if (t.includes('verse')) return 'verse';
    if (t.includes('bridge')) return 'bridge';
    if (t.includes('intro')) return 'intro';
    if (t.includes('outro')) return 'outro';
    return 'other';
  };

  for (const rawLine of rawLines) {
    const line = rawLine.trim();

    // Check if line is a bracketed section header e.g. [Verse 1], [Chorus]
    const match = line.match(sectionRegex);
    if (match) {
      if (currentStanza.lines.length > 0 || currentStanza.tag) {
        stanzas.push(currentStanza);
      }
      const rawTag = match[1] || line.replace(/[\[\]]/g, '').trim();
      currentStanza = {
        id: `stanza-${stanzas.length}`,
        tag: rawTag,
        tagType: determineTagType(rawTag),
        lines: [],
      };
      continue;
    }

    // Blank line indicates stanza break
    if (line === '') {
      if (currentStanza.lines.length > 0) {
        stanzas.push(currentStanza);
        currentStanza = {
          id: `stanza-${stanzas.length}`,
          tagType: 'other',
          lines: [],
        };
      }
      continue;
    }

    currentStanza.lines.push(line);
  }

  if (currentStanza.lines.length > 0 || currentStanza.tag) {
    stanzas.push(currentStanza);
  }

  return stanzas;
}

function parseLrc(lyrics?: string): LrcLine[] | null {
  if (!lyrics) return null;
  const lines = lyrics.split('\n');
  const result: LrcLine[] = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;

  for (const line of lines) {
    const match = regex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const totalSeconds = minutes * 60 + seconds + millis / 1000;
      const text = match[4].trim();
      result.push({ time: totalSeconds, text });
    }
  }

  return result.length > 0 ? result : null;
}

export const NowPlayingModal: React.FC = () => {
  const {
    activeTrack,
    queue,
    queueIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackSpeed,
    shuffle,
    repeatMode,
    isNowPlayingOpen,
    setIsNowPlayingOpen,
    setIsEqualizerOpen,
    playTrack,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    nextTrack,
    previousTrack,
    analyserRef,
    sleepTimerMinutes,
    sleepTimerRemainingSeconds,
    updateActiveTrackLyrics,
    isGapless,
    crossfadeSeconds,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'player' | 'queue' | 'lyrics'>('player');
  const [isMaximized, setIsMaximized] = useState(false);
  // Default ALWAYS to cassette tape per user request
  const [playerDisplayMode, setPlayerDisplayMode] = useState<'cassette' | 'vinyl'>('cassette');

  const togglePlayerDisplayMode = () => {
    setPlayerDisplayMode((prev) => (prev === 'cassette' ? 'vinyl' : 'cassette'));
  };

  // Real-time audio beat synchronization for lyrics display
  const beatData = useLyricsBeat(analyserRef, isPlaying && isNowPlayingOpen);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>(() => {
    return (localStorage.getItem('vistara_visualizer_mode') as VisualizerMode) || 'bars';
  });
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Open-Source Lyrics (LRCLIB) State & Auto-Fetch
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  const [lyricsSource, setLyricsSource] = useState<'embedded' | 'lrclib' | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LrcLibSearchResultDto[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  // Bilingual Lyrics Translation State
  const [isTranslationActive, setIsTranslationActive] = useState<boolean>(() => {
    return localStorage.getItem('vistara_lyrics_translate_active') === 'true';
  });
  const [targetLanguage, setTargetLanguage] = useState<string>(() => {
    return localStorage.getItem('vistara_lyrics_target_lang') || 'en';
  });
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translatedLinesMap, setTranslatedLinesMap] = useState<Record<string, string>>({});

  const cleanTrackQuery = (title?: string, artist?: string): string => {
    if (!title) return '';
    let cleanTitle = title.replace(/\s*[\(\[](feat\.|ft\.|official|video|audio|remastered|deluxe|bonus|version|from|soundtrack|ost).*?[\)\]]/gi, '');
    cleanTitle = cleanTitle.replace(/\s*-\s*(from|soundtrack|ost|remastered).*$/gi, '');
    cleanTitle = cleanTitle.replace(/["']/g, '').trim();

    let cleanArtist = '';
    if (artist) {
      const parts = artist.split(/\s*(?:;|[\/,&]|\bfeat\.?\b|\bft\.?\b)\s*/i);
      cleanArtist = (parts[0] || '').trim();
    }
    return `${cleanTitle} ${cleanArtist}`.trim() || cleanTitle;
  };

  const handleFetchLyrics = async (force = false) => {
    if (!activeTrack) return;
    setLyricsLoading(true);
    try {
      const trackId = activeTrack.trackId || activeTrack.id;
      const res = await apiRequest<LyricsResultDto>(`/api/v1/music/tracks/${trackId}/lyrics?force=${force}`);
      if (res.success && res.data?.lyrics) {
        updateActiveTrackLyrics(res.data.lyrics);
        setLyricsSource(res.data.source as any);
      }
    } catch (e) {
      console.warn('Lyrics fetch failed:', e);
    } finally {
      setLyricsLoading(false);
    }
  };

  const handleAutoFetchSyncedLyrics = async () => {
    if (!activeTrack || isAutoFetching) return;
    setIsAutoFetching(true);
    setLyricsLoading(true);
    try {
      const trackId = activeTrack.trackId || activeTrack.id;
      const res = await apiRequest<LyricsResultDto>(`/api/v1/music/tracks/${trackId}/lyrics/autofetch`, {
        method: 'POST'
      });
      if (res.success && res.data?.lyrics) {
        updateActiveTrackLyrics(res.data.lyrics);
        setLyricsSource(res.data.source as any);
        if (isTranslationActive) {
          handleTranslateLyrics(targetLanguage, res.data.lyrics);
        }
      }
    } catch (e) {
      console.warn('Auto fetch synced lyrics failed:', e);
    } finally {
      setIsAutoFetching(false);
      setLyricsLoading(false);
    }
  };

  const handleTranslateLyrics = async (lang = targetLanguage, lyricsText?: string) => {
    const textToTranslate = lyricsText || activeTrack?.lyrics;
    if (!activeTrack || !textToTranslate) return;

    setTranslationLoading(true);
    try {
      const trackId = activeTrack.trackId || activeTrack.id;
      const res = await apiRequest<TranslatedLyricsResultDto>('/api/v1/music/lyrics/translate', {
        method: 'POST',
        body: JSON.stringify({
          trackId,
          lyrics: textToTranslate,
          targetLanguage: lang
        })
      });

      if (res.success && res.data?.lines) {
        const mapping: Record<string, string> = {};
        res.data.lines.forEach((l, idx) => {
          if (l.original) {
            mapping[l.original] = l.translated;
            mapping[`idx_${idx}`] = l.translated;
          }
        });
        setTranslatedLinesMap(mapping);
        setIsTranslationActive(true);
        localStorage.setItem('vistara_lyrics_translate_active', 'true');
      }
    } catch (e) {
      console.warn('Lyrics translation failed:', e);
    } finally {
      setTranslationLoading(false);
    }
  };

  const handleSearchOnlineLyrics = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim() || cleanTrackQuery(activeTrack?.title, activeTrack?.artistName);
    if (!q) return;

    setIsSearchingOnline(true);
    try {
      const res = await apiRequest<LrcLibSearchResultDto[]>(`/api/v1/music/lyrics/search?query=${encodeURIComponent(q)}`);
      if (res.success && res.data) {
        setSearchResults(res.data);
      }
    } catch (e) {
      console.warn('Online lyrics search failed:', e);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleApplyOnlineLyrics = async (lrclibId: number) => {
    if (!activeTrack) return;
    setLyricsLoading(true);
    try {
      const trackId = activeTrack.trackId || activeTrack.id;
      const res = await apiRequest<LyricsResultDto>(`/api/v1/music/tracks/${trackId}/lyrics/apply/${lrclibId}`, {
        method: 'POST'
      });
      if (res.success && res.data?.lyrics) {
        updateActiveTrackLyrics(res.data.lyrics);
        setLyricsSource('lrclib');
        setIsSearchOpen(false);
      }
    } catch (e) {
      console.warn('Apply lyrics failed:', e);
    } finally {
      setLyricsLoading(false);
    }
  };

  const parsedLyrics = React.useMemo(() => {
    return parseLrc(activeTrack?.lyrics);
  }, [activeTrack?.lyrics]);

  const plainStanzas = React.useMemo(() => {
    return parsePlainLyrics(activeTrack?.lyrics);
  }, [activeTrack?.lyrics]);

  // Full automatic smart-sync: auto-fetch synced lyrics when Lyrics tab is viewed
  useEffect(() => {
    if (activeTab === 'lyrics' && activeTrack && !parsedLyrics && !lyricsLoading && !isAutoFetching) {
      handleAutoFetchSyncedLyrics();
    }
  }, [activeTab, activeTrack?.id, parsedLyrics]);

  // Auto-translate if user has translation enabled
  useEffect(() => {
    if (isTranslationActive && activeTrack?.lyrics) {
      handleTranslateLyrics(targetLanguage, activeTrack.lyrics);
    }
  }, [activeTrack?.id, activeTrack?.lyrics, isTranslationActive]);

  const [lyricsAlign, setLyricsAlign] = useState<'center' | 'left'>(() => {
    return (localStorage.getItem('vistara_lyrics_align') as 'center' | 'left') || 'center';
  });

  const [lyricsSize, setLyricsSize] = useState<'normal' | 'large'>(() => {
    return (localStorage.getItem('vistara_lyrics_size') as 'normal' | 'large') || 'normal';
  });

  const toggleLyricsAlign = () => {
    setLyricsAlign((prev) => {
      const next = prev === 'center' ? 'left' : 'center';
      localStorage.setItem('vistara_lyrics_align', next);
      return next;
    });
  };

  const toggleLyricsSize = () => {
    setLyricsSize((prev) => {
      const next = prev === 'normal' ? 'large' : 'normal';
      localStorage.setItem('vistara_lyrics_size', next);
      return next;
    });
  };

  const activeLyricRef = React.useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = React.useRef<HTMLDivElement | null>(null);

  const currentLyricIndex = React.useMemo(() => {
    if (!parsedLyrics) return -1;
    let idx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (currentTime >= parsedLyrics[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [parsedLyrics, currentTime]);

  React.useEffect(() => {
    if (activeLyricRef.current && lyricsContainerRef.current && activeTab === 'lyrics') {
      const container = lyricsContainerRef.current;
      const activeEl = activeLyricRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
      const targetScroll = relativeTop - container.clientHeight / 2 + activeRect.height / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [currentLyricIndex, activeTab]);

  const handleVisualizerChange = (mode: VisualizerMode) => {
    setVisualizerMode(mode);
    localStorage.setItem('vistara_visualizer_mode', mode);
  };

  useEffect(() => {
    if (activeTrack) {
      setIsFav(activeTrack.isFavourite ?? false);
    }
  }, [activeTrack]);

  // Global Keyboard shortcuts when Now Playing screen is open
  useEffect(() => {
    if (!isNowPlayingOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'Escape':
          e.preventDefault();
          setIsNowPlayingOpen(false);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, currentTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(duration, currentTime + 5));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyS':
          e.preventDefault();
          toggleShuffle();
          break;
        case 'KeyR':
          e.preventDefault();
          cycleRepeat();
          break;
        case 'KeyQ':
          e.preventDefault();
          setActiveTab((prev) => (prev === 'queue' ? 'player' : 'queue'));
          break;
        case 'KeyL':
          e.preventDefault();
          setActiveTab((prev) => (prev === 'lyrics' ? 'player' : 'lyrics'));
          break;
        case 'KeyV':
          e.preventDefault();
          const modes: VisualizerMode[] = ['bars', 'wave', 'halo', 'embers', 'vu', 'off'];
          setVisualizerMode((prev) => {
            const nextIdx = (modes.indexOf(prev) + 1) % modes.length;
            const next = modes[nextIdx];
            localStorage.setItem('vistara_visualizer_mode', next);
            return next;
          });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNowPlayingOpen, currentTime, duration, togglePlayPause, seek, toggleMute, toggleShuffle, cycleRepeat, setIsNowPlayingOpen]);

  if (!isNowPlayingOpen || !activeTrack) return null;

  const handleToggleFavourite = async () => {
    if (!activeTrack || favLoading) return;
    setFavLoading(true);
    try {
      const res = await apiRequest<boolean>(`/api/v1/music/tracks/${activeTrack.id}/favourite`, {
        method: 'POST',
      });
      if (res.success && res.data !== undefined) {
        setIsFav(res.data);
      } else {
        setIsFav((prev) => !prev);
      }
    } catch {
      setIsFav((prev) => !prev);
    } finally {
      setFavLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs <= 0) return '0:00';
    const total = Math.floor(secs);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const safeDuration = (Number.isFinite(duration) && duration > 0)
    ? duration
    : (activeTrack?.durationSeconds && Number.isFinite(activeTrack.durationSeconds) && activeTrack.durationSeconds > 0
        ? activeTrack.durationSeconds
        : 0);
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;

  const artworkUrl = activeTrack.artworkUrl || null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsNowPlayingOpen(false);
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 select-none transition-colors duration-200 overflow-hidden ${
        isMaximized
          ? 'bg-[#06080d] p-0'
          : 'bg-black/75 backdrop-blur-md animate-in fade-in duration-200'
      }`}
    >
      <div
        className={`relative flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ${
          isMaximized
            ? 'w-full h-full bg-[#06080d] rounded-none'
            : activeTab === 'lyrics' || activeTab === 'queue'
            ? 'w-full max-w-2xl md:max-w-3xl lg:max-w-4xl h-[92vh] max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] bg-[#0c1017] border border-[#202736] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200'
            : 'w-full max-w-xl md:max-w-2xl h-[90vh] max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] bg-[#0c1017] border border-[#202736] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200'
        }`}
      >
        {/* 1. Subtle Ambient Album Aura in Background */}
        {artworkUrl && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25 filter blur-[60px] scale-125 transform">
            <img src={artworkUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-[#0c1017]/85" />
          </div>
        )}

        {/* 1.5. Cosmic Embers Background Visualizer */}
        {visualizerMode === 'embers' && (
          <div className="absolute inset-0 pointer-events-none z-0">
            <AudioVisualizer
              analyser={analyserRef.current}
              analyserRef={analyserRef}
              isPlaying={isPlaying}
              mode="embers"
            />
          </div>
        )}

        {/* 2. Top Header Navigation Bar */}
        <div className="relative z-20 flex-shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3.5 border-b border-[#1b212d]/70 bg-[#0c0f16]/90 backdrop-blur-md">
          {/* Left: Animated NOW PLAYING Status Pill */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-[#121620]/80 border border-accent/30 shadow-inner">
            <div className="flex items-end space-x-0.5 h-3">
              <span
                className={`w-0.5 bg-accent rounded-full transition-all duration-300 ${
                  isPlaying ? 'h-3 animate-pulse' : 'h-1'
                }`}
              />
              <span
                className={`w-0.5 bg-accent rounded-full transition-all duration-300 delay-75 ${
                  isPlaying ? 'h-2 animate-bounce' : 'h-1.5'
                }`}
              />
              <span
                className={`w-0.5 bg-accent rounded-full transition-all duration-300 delay-150 ${
                  isPlaying ? 'h-3 animate-pulse' : 'h-1'
                }`}
              />
            </div>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/90">
              NOW PLAYING
            </span>
          </div>

          {/* Center: Tabs Switcher */}
          <div className="flex items-center space-x-1 p-0.5 bg-[#10141d]/90 border border-[#1e2536] rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('player')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer font-medium ${
                activeTab === 'player' ? 'bg-accent text-white shadow-sm' : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              Track
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition-colors cursor-pointer font-medium ${
                activeTab === 'queue' ? 'bg-accent text-white shadow-sm' : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue</span>
              {queue.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                  {queue.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('lyrics')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition-colors cursor-pointer font-medium ${
                activeTab === 'lyrics' ? 'bg-accent text-white shadow-sm' : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Lyrics</span>
            </button>
          </div>

          {/* Right: Actions (Sleep Timer, Equalizer, Maximize, Close) */}
          <div className="flex items-center space-x-1.5">
            {/* Sleep Timer Indicator & Toggle */}
            <button
              onClick={() => setIsEqualizerOpen(true)}
              title={
                sleepTimerRemainingSeconds !== null
                  ? `Sleep Timer Active: ${sleepTimerRemainingSeconds === -1 ? 'End of Track' : `${Math.ceil(sleepTimerRemainingSeconds / 60)}m remaining`}`
                  : 'Smart Sleep Timer'
              }
              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center space-x-1 ${
                sleepTimerRemainingSeconds !== null
                  ? 'bg-accent/20 text-accent border-accent/50 shadow-sm'
                  : 'bg-[#141822] hover:bg-[#1e2433] text-[#9ca3af] hover:text-white border-[#242c3d]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              {sleepTimerRemainingSeconds !== null && (
                <span className="text-[10px] font-mono hidden sm:inline font-semibold">
                  {sleepTimerRemainingSeconds === -1 ? 'Track End' : `${Math.ceil(sleepTimerRemainingSeconds / 60)}m`}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsEqualizerOpen(true)}
              title="Audio Equalizer & Studio Processing"
              className="p-1.5 rounded-lg bg-[#141822] hover:bg-[#1e2433] text-[#9ca3af] hover:text-white border border-[#242c3d] transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsMaximized((prev) => !prev)}
              title={isMaximized ? 'Windowed View' : 'Maximize to Full Screen'}
              className="p-1.5 rounded-lg bg-[#141822] hover:bg-[#1e2433] text-[#9ca3af] hover:text-white border border-[#242c3d] transition-colors cursor-pointer"
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setIsNowPlayingOpen(false)}
              title="Close (Esc)"
              className="p-1.5 rounded-lg bg-[#141822] hover:bg-rose-500/20 text-[#9ca3af] hover:text-rose-300 border border-[#242c3d] hover:border-rose-500/40 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Main Center Display Area */}
        <div
          className={`relative z-10 flex-1 min-h-0 overflow-hidden ${
            activeTab === 'player'
              ? 'flex items-center justify-center p-3 sm:p-5 overflow-y-auto no-scrollbar'
              : 'flex flex-col p-2 sm:p-3'
          }`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {activeTab === 'player' ? (
            /* ============================================================= */
            /* MODE A: THE GRAND CASSETTE TAPE PLAYER EXPERIENCE             */
            /* ============================================================= */
            <div className="flex flex-col items-center max-w-lg w-full mx-auto space-y-3.5 text-center">
              {/* Grand Album Cover Container: Cassette Tape vs Vinyl Showcase */}
              <div className="relative flex flex-col items-center justify-center my-1.5 sm:my-2 w-full">
                {playerDisplayMode === 'cassette' ? (
                  <div className="relative flex flex-col items-center justify-center">
                    <CassetteTape
                      artworkUrl={artworkUrl}
                      title={activeTrack.title}
                      artist={activeTrack.artistName || 'Unknown Artist'}
                      album={activeTrack.albumTitle || undefined}
                      isPlaying={isPlaying}
                      progress={duration > 0 ? currentTime / duration : 0}
                      bassLevel={beatData.bassLevel}
                      beatPulse={beatData.beatPulse}
                      audioFormat={activeTrack.audioFormat}
                      audioCodec={activeTrack.audioCodec}
                      bitrateKbps={activeTrack.bitrateKbps}
                      sampleRate={activeTrack.sampleRate}
                      channels={activeTrack.channels}
                      fileSizeBytes={activeTrack.fileSizeBytes}
                      durationSeconds={duration || activeTrack.durationSeconds}
                      year={activeTrack.year}
                      genre={activeTrack.genre}
                      trackNumber={activeTrack.trackNumber}
                      discNumber={activeTrack.discNumber}
                      onPlayPauseToggle={togglePlayPause}
                    />

                    {/* Mode Switcher Pill */}
                    <div className="mt-2.5 flex items-center space-x-2">
                      <button
                        onClick={togglePlayerDisplayMode}
                        className="px-2.5 py-0.5 rounded-full bg-[#111520] hover:bg-[#182030] text-[#9ca3af] hover:text-white border border-[#232c3d] text-[10px] font-mono flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
                        title="Switch to Vinyl Record View"
                      >
                        <span className="text-accent font-semibold">📼 Cassette Tape</span>
                        <span className="text-[#64748b]">⇄</span>
                        <span>💿 Vinyl</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative group flex flex-col items-center justify-center">
                    <div className="relative flex items-center justify-center my-2">
                      {/* Ambient Dynamic Breathing Aura */}
                      {isPlaying && (
                        <div className="absolute -inset-8 sm:-inset-12 rounded-full bg-accent/15 blur-2xl pointer-events-none -z-10" />
                      )}

                      {/* Soundwave expanding ripple ring */}
                      {isPlaying && (
                        <div className="absolute inset-0 rounded-2xl border border-accent/40 pointer-events-none animate-soundwave-ping -z-10" />
                      )}

                      {/* 360-Degree Radial Halo Spectrum behind artwork */}
                      {visualizerMode === 'halo' && (
                        <div className="absolute -inset-10 sm:-inset-12 pointer-events-none z-0">
                          <AudioVisualizer
                            analyser={analyserRef.current}
                            analyserRef={analyserRef}
                            isPlaying={isPlaying}
                            mode="halo"
                          />
                        </div>
                      )}

                      {/* Realistic Spinning Audiophile Vinyl Record Disc */}
                      <div
                        className={`absolute top-0 bottom-0 aspect-square rounded-full vinyl-grooves shadow-2xl border border-[#2b3348] flex items-center justify-center pointer-events-none transition-all duration-700 ease-out z-0 ${
                          isPlaying
                            ? 'translate-x-14 sm:translate-x-20 rotate-[15deg]'
                            : 'translate-x-0 rotate-0 opacity-0 group-hover:opacity-60 group-hover:translate-x-6'
                        }`}
                        style={{
                          animation: isPlaying ? 'spinSlow 16s linear infinite' : 'none',
                          transformOrigin: 'center center',
                        }}
                      >
                        {/* Vinyl center spindle & label sticker */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#10141d] border-2 border-accent/60 p-1 flex items-center justify-center shadow-lg relative overflow-hidden">
                          {artworkUrl ? (
                            <img src={artworkUrl} alt="" className="w-full h-full object-cover rounded-full opacity-85" />
                          ) : (
                            <div className="text-[8px] font-mono text-accent font-bold uppercase tracking-wider">VISTARA</div>
                          )}
                          {/* Spindle hole */}
                          <div className="absolute w-3.5 h-3.5 rounded-full bg-[#0a0c12] border border-[#2b3548] shadow-inner" />
                        </div>
                      </div>

                      {/* Outer Decorative Vinyl Jacket Cover */}
                      <div
                        onClick={togglePlayPause}
                        className={`relative z-10 rounded-2xl p-1 bg-[#181d28] shadow-2xl border border-[#2b3548] transition-all duration-300 cursor-pointer ${
                          isMaximized
                            ? 'w-64 h-64 sm:w-72 sm:h-72'
                            : 'w-44 h-44 sm:w-48 sm:h-48'
                        } ${isPlaying ? 'scale-100 shadow-[0_15px_45px_rgba(53,198,176,0.25)]' : 'scale-[0.98]'}`}
                      >
                        {artworkUrl ? (
                          <img
                            src={artworkUrl}
                            alt={activeTrack.title}
                            className="w-full h-full object-cover rounded-xl shadow-inner bg-[#0e1118]"
                          />
                        ) : (
                          <div className="w-full h-full rounded-xl bg-[#121620] flex flex-col items-center justify-center space-y-2 border border-[#222938]">
                            <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-lg animate-pulse">
                              <Disc className="w-8 h-8" />
                            </div>
                            <span className="text-[10px] font-mono tracking-widest text-[#9ca3af] uppercase">
                              VISTARA HI-FI
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mode Switcher Pill */}
                    <div className="mt-1 flex items-center space-x-2">
                      <button
                        onClick={togglePlayerDisplayMode}
                        className="px-2.5 py-0.5 rounded-full bg-[#111520] hover:bg-[#182030] text-[#9ca3af] hover:text-white border border-[#232c3d] text-[10px] font-mono flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
                        title="Switch to Cassette Tape View"
                      >
                        <span>📼 Cassette</span>
                        <span className="text-[#64748b]">⇄</span>
                        <span className="text-accent font-semibold">💿 Vinyl Record</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Track Metadata & Badges */}
              <div className="w-full space-y-1">
                <div className="flex items-center justify-center space-x-2">
                  <h1
                    className="text-lg sm:text-xl font-bold text-white tracking-tight line-clamp-1 max-w-md"
                    title={activeTrack.title}
                  >
                    {activeTrack.title}
                  </h1>
                  {/* Favourite Heart Toggle Button */}
                  <button
                    onClick={handleToggleFavourite}
                    disabled={favLoading}
                    title={isFav ? 'Remove from Favourites' : 'Add to Favourites'}
                    className="p-1 rounded-full hover:bg-[#1f2533] transition-colors cursor-pointer group"
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                        isFav ? 'fill-rose-500 text-rose-500' : 'text-[#6b7280] group-hover:text-rose-400'
                      }`}
                    />
                  </button>
                </div>

                {/* Artist & Album */}
                <div className="text-xs sm:text-sm text-accent font-medium line-clamp-1">
                  {activeTrack.artistName || 'Unknown Artist'}
                  {activeTrack.albumTitle && (
                    <span className="text-[#9ca3af] font-normal">
                      {' '}
                      — {activeTrack.albumTitle}
                    </span>
                  )}
                </div>

                {/* Sleek Format Badges Row */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  <span className="text-[9px] font-mono tracking-wider px-2 py-0.2 rounded-full bg-[#151924] border border-[#262e40] text-emerald-400 font-semibold shadow-sm">
                    HI-FI AUDIO
                  </span>
                  {crossfadeSeconds > 0 ? (
                    <span className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-[#151924] border border-accent/40 text-accent font-semibold shadow-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      CROSSFADE {crossfadeSeconds}S
                    </span>
                  ) : isGapless ? (
                    <span className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-[#151924] border border-accent/40 text-accent font-semibold shadow-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      GAPLESS
                    </span>
                  ) : null}
                  {activeTrack.year && (
                    <span className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-[#151924] border border-[#262e40] text-[#9ca3af]">
                      {activeTrack.year}
                    </span>
                  )}
                  {activeTrack.genre && (
                    <span className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-[#151924] border border-[#262e40] text-accent">
                      {activeTrack.genre}
                    </span>
                  )}
                  {activeTrack.trackNumber && (
                    <span className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-[#151924] border border-[#262e40] text-[#9ca3af]">
                      Track {activeTrack.trackNumber}
                    </span>
                  )}
                </div>

                {/* Real-time Frequency / Waveform Visualizer Display Stage */}
                {visualizerMode !== 'off' && visualizerMode !== 'halo' && visualizerMode !== 'embers' && (
                  <div className="w-full h-16 sm:h-20 max-w-md mx-auto mt-2 rounded-xl bg-[#0b0e14]/75 border border-[#1e2536] p-1.5 overflow-hidden shadow-inner flex items-center justify-center backdrop-blur-sm">
                    <AudioVisualizer
                      analyser={analyserRef.current}
                      analyserRef={analyserRef}
                      isPlaying={isPlaying}
                      mode={visualizerMode}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'queue' ? (
            /* ============================================================= */
            /* MODE B: UP NEXT QUEUE LIST                                    */
            /* ============================================================= */
            <div className="w-full h-full flex flex-col bg-[#0d1017] border border-[#202736] rounded-xl overflow-hidden shadow-2xl animate-in fade-in duration-200">
              <div className="p-3 border-b border-[#202736] flex items-center justify-between bg-[#121622]">
                <div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">Up Next Queue</h2>
                  <p className="text-[11px] text-[#9ca3af]">
                    {queue.length} {queue.length === 1 ? 'track' : 'tracks'} lined up
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('player')}
                  className="text-xs text-accent hover:underline cursor-pointer font-medium"
                >
                  Back to Track
                </button>
              </div>

              <div
                className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[#181d2a] p-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {queue.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#6b7280]">
                    Queue is empty. Play an album or track from the Music studio!
                  </div>
                ) : (
                  queue.map((track, idx) => {
                    const isCurrent = activeTrack.id === track.id;
                    return (
                      <div
                        key={track.id || idx}
                        onClick={() => playTrack(track, queue)}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer text-xs transition-colors group ${
                          isCurrent
                            ? 'bg-accent/15 border border-accent/40 text-white'
                            : 'hover:bg-[#141822] text-[#d1d5db]'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <span className="w-4 text-center font-mono text-[10px] text-[#6b7280]">
                            {isCurrent ? (
                              <Play className="w-2.5 h-2.5 fill-accent text-accent inline" />
                            ) : (
                              idx + 1
                            )}
                          </span>
                          {track.artworkUrl ? (
                            <img
                              src={track.artworkUrl}
                              alt=""
                              className="w-8 h-8 object-cover rounded bg-[#181c24] flex-shrink-0 border border-[#202736]"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-[#181c24] flex items-center justify-center flex-shrink-0 text-accent font-bold text-xs border border-[#202736]">
                              ♪
                            </div>
                          )}
                          <div className="truncate">
                            <div className={`font-bold truncate text-xs ${isCurrent ? 'text-accent' : 'text-white'}`}>
                              {track.title}
                            </div>
                            <div className="text-[10px] text-[#9ca3af] truncate">
                              {track.artistName || 'Unknown Artist'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-[#6b7280] ml-3 flex-shrink-0">
                          {formatTime(track.durationSeconds)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ============================================================= */
            /* MODE C: SYNCHRONIZED KARAOKE / TEXT LYRICS DISPLAY            */
            /* ============================================================= */
            <div className="w-full h-full flex-1 min-h-0 flex flex-col bg-[#0d1017] border border-[#202736] rounded-xl p-2.5 sm:p-4 shadow-2xl overflow-hidden relative animate-in fade-in duration-200">
              {/* Real-Time Beat Reactive Visualizer Canvas behind lyrics */}
              <LyricsBeatVisualizer analyserRef={analyserRef} isPlaying={isPlaying} />

              {/* Header Bar */}
              <div className="relative z-10 flex flex-wrap items-center justify-between border-b border-[#202736] pb-2 mb-1.5 gap-2 flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#9ca3af] truncate max-w-[180px] sm:max-w-xs">
                    LYRICS · {activeTrack.title}
                  </h2>
                  {parsedLyrics ? (
                    <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/40 flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-2.5 h-2.5 text-accent animate-pulse" /> Synced Karaoke
                    </span>
                  ) : activeTrack.lyrics ? (
                    <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-950/70 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 shadow-sm">
                      <AlignLeft className="w-2.5 h-2.5" /> Formatted Stanzas
                    </span>
                  ) : null}
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 flex items-center gap-1" title="Powered by LRCLIB Open-Source Community Archive">
                    <Globe className="w-2.5 h-2.5" /> LRCLIB
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {/* Auto-Fetch Synced Lyrics Button */}
                  <button
                    onClick={handleAutoFetchSyncedLyrics}
                    disabled={lyricsLoading || isAutoFetching}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm ${
                      isAutoFetching
                        ? 'bg-accent/30 text-accent border-accent animate-pulse'
                        : parsedLyrics
                        ? 'bg-[#141822] hover:bg-accent/15 text-accent hover:text-white border-[#242c3d]'
                        : 'bg-accent/20 text-accent hover:text-white border-accent/40 shadow-sm'
                    }`}
                    title="Automatically find and sync lyrics for this track from open-source archive"
                  >
                    <Sparkles className={`w-3 h-3 ${isAutoFetching ? 'animate-spin text-accent' : 'text-accent'}`} />
                    <span>{isAutoFetching ? 'Syncing...' : '⚡ Auto-Sync'}</span>
                  </button>

                  {/* Bilingual Translation Toggle + Language Picker */}
                  <div className="flex items-center">
                    <button
                      onClick={() => {
                        if (isTranslationActive) {
                          setIsTranslationActive(false);
                          localStorage.setItem('vistara_lyrics_translate_active', 'false');
                        } else {
                          handleTranslateLyrics(targetLanguage);
                        }
                      }}
                      disabled={translationLoading}
                      className={`px-2 py-1 rounded-l-lg border text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                        isTranslationActive
                          ? 'bg-accent text-white border-accent shadow-[0_0_12px_rgba(53,198,176,0.4)]'
                          : 'bg-[#141822] hover:bg-[#1e2433] text-[#9ca3af] hover:text-white border-[#242c3d]'
                      }`}
                      title="Toggle bilingual real-time lyrics translation"
                    >
                      <Languages className={`w-3 h-3 ${translationLoading ? 'animate-spin' : ''}`} />
                      <span>{translationLoading ? 'Translating...' : isTranslationActive ? 'Translate: On' : 'Translate'}</span>
                    </button>
                    <select
                      value={targetLanguage}
                      onChange={(e) => {
                        const newLang = e.target.value;
                        setTargetLanguage(newLang);
                        localStorage.setItem('vistara_lyrics_target_lang', newLang);
                        if (isTranslationActive) {
                          handleTranslateLyrics(newLang);
                        }
                      }}
                      className="py-1 px-1 rounded-r-lg border border-l-0 text-[10px] font-mono font-bold bg-[#10141d] text-accent border-[#242c3d] hover:border-accent cursor-pointer focus:outline-none"
                      title="Choose target translation language"
                    >
                      <option value="en">EN</option>
                      <option value="hi">HI</option>
                      <option value="es">ES</option>
                      <option value="ja">JA</option>
                      <option value="fr">FR</option>
                    </select>
                  </div>

                  {/* Lyrics Formatting Toolbar: Alignment & Font Size */}
                  <button
                    onClick={toggleLyricsAlign}
                    className="p-1.5 rounded-lg bg-[#141822] hover:bg-[#1e2433] text-[#9ca3af] hover:text-white border border-[#242c3d] transition-colors cursor-pointer"
                    title={`Alignment: ${lyricsAlign === 'center' ? 'Center (Click for Left)' : 'Left (Click for Center)'}`}
                  >
                    {lyricsAlign === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={toggleLyricsSize}
                    className={`px-2 py-1 rounded-lg border text-[11px] font-bold font-mono transition-colors cursor-pointer ${
                      lyricsSize === 'large'
                        ? 'bg-accent/20 text-accent border-accent/40'
                        : 'bg-[#141822] hover:bg-[#1e2433] text-[#9ca3af] hover:text-white border-[#242c3d]'
                    }`}
                    title={`Text Size: ${lyricsSize === 'large' ? 'Large (Click for Normal)' : 'Normal (Click for Large)'}`}
                  >
                    A{lyricsSize === 'large' ? '+' : ''}
                  </button>

                  <button
                    onClick={() => {
                      setIsSearchOpen(!isSearchOpen);
                      if (!isSearchOpen && searchResults.length === 0) {
                        handleSearchOnlineLyrics();
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                      isSearchOpen
                        ? 'bg-accent/20 text-accent border-accent/40'
                        : 'bg-[#141822] hover:bg-[#1e2433] text-[#9ca3af] hover:text-white border-[#242c3d]'
                    }`}
                    title="Search different lyrics on LRCLIB"
                  >
                    <Search className="w-3 h-3" />
                    <span>Search</span>
                  </button>

                  <button
                    onClick={() => handleAutoFetchSyncedLyrics()}
                    disabled={lyricsLoading || isAutoFetching}
                    className="px-2.5 py-1 rounded-lg bg-[#141822] hover:bg-[#1e2433] text-[#9ca3af] hover:text-white border border-[#242c3d] text-[11px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Refetch / upgrade lyrics from LRCLIB open-source archive"
                  >
                    <RefreshCw className={`w-3 h-3 ${lyricsLoading ? 'animate-spin text-accent' : ''}`} />
                    <span>{lyricsLoading ? 'Fetching...' : 'Refetch'}</span>
                  </button>
                </div>
              </div>

              {/* Real-Time Beat Frequency Spectrum Ribbon */}
              {isPlaying && (
                <div className="relative z-10 w-full h-1 -mt-1 mb-2.5 rounded-full overflow-hidden flex items-center gap-[2px] opacity-80 pointer-events-none">
                  {[...Array(24)].map((_, i) => {
                    const isBassZone = i < 6;
                    const isMidZone = i >= 6 && i < 18;
                    const level = isBassZone ? beatData.bassLevel : isMidZone ? beatData.midLevel : beatData.trebleLevel;
                    const heightPercent = Math.min(100, Math.max(18, level * 100 * (0.8 + (i % 3) * 0.2)));
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-75 ${
                          isBassZone ? 'bg-accent' : isMidZone ? 'bg-accent/80' : 'bg-white/80'
                        }`}
                        style={{ height: `${heightPercent}%`, opacity: 0.35 + level * 0.65 }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Online Lyrics Search Drawer */}
              {isSearchOpen && (
                <div className="mb-3 p-3 bg-[#111520] border border-[#242c3d] rounded-xl flex-shrink-0 space-y-2 animate-in fade-in duration-200">
                  <form onSubmit={handleSearchOnlineLyrics} className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder={`Search LRCLIB (e.g. "${activeTrack.title} ${activeTrack.artistName || ''}")`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#0b0e14] border border-[#202738] rounded-lg text-xs text-white placeholder-[#6b7280] focus:outline-none focus:border-accent"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearchingOnline}
                      className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSearchingOnline ? 'Searching...' : 'Find'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(false)}
                      className="px-2.5 py-1.5 bg-[#181c26] hover:bg-[#202634] text-[#9ca3af] hover:text-white text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </form>

                  {/* Search Results List */}
                  {searchResults.length > 0 && (
                    <div
                      className="max-h-40 overflow-y-auto no-scrollbar divide-y divide-[#1a202c] border border-[#1e2536] rounded-lg bg-[#0b0d12]"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {searchResults.map((res) => (
                        <div
                          key={res.id}
                          className="p-2 flex items-center justify-between hover:bg-[#141822] text-xs transition-colors"
                        >
                          <div className="truncate mr-2">
                            <div className="font-semibold text-white flex items-center space-x-1.5">
                              <span className="truncate">{res.trackName}</span>
                              {res.hasSyncedLyrics ? (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/40 flex-shrink-0">
                                  Synced LRC
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-gray-800 text-gray-300 flex-shrink-0">
                                  Plain
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#9ca3af] truncate">
                              {res.artistName} {res.albumName && `• ${res.albumName}`} • {Math.floor(res.duration / 60)}:{Math.floor(res.duration % 60).toString().padStart(2, '0')}
                            </div>
                          </div>
                          <button
                            onClick={() => handleApplyOnlineLyrics(res.id)}
                            disabled={lyricsLoading}
                            className="px-2.5 py-1 bg-accent/20 hover:bg-accent text-accent hover:text-white border border-accent/40 rounded text-[11px] font-semibold cursor-pointer transition-colors flex-shrink-0 disabled:opacity-50"
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Main Lyrics Content Area */}
              {lyricsLoading && !activeTrack.lyrics ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent animate-pulse">
                    <Sparkles className="w-5 h-5 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white">Fetching Lyrics from LRCLIB...</p>
                    <p className="text-[11px] text-[#9ca3af]">
                      Connecting to open-source database for synchronized karaoke timing
                    </p>
                  </div>
                </div>
              ) : parsedLyrics ? (
                <div
                  ref={lyricsContainerRef}
                  className="relative flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-3 py-4 sm:py-6 px-3 sm:px-6 scroll-smooth"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  {parsedLyrics.map((item, idx) => {
                    const isCurrent = idx === currentLyricIndex;
                    const isPast = idx < currentLyricIndex;
                    const sectionMatch = item.text?.match(/^\s*\[?(Verse(?:\s*\d+)?|Chorus(?:\s*\d+)?|Pre-Chorus(?:\s*\d+)?|Post-Chorus(?:\s*\d+)?|Bridge(?:\s*\d+)?|Intro|Outro|Hook(?:\s*\d+)?|Solo|Refrain)\]?:?\s*$/i);

                    if (sectionMatch) {
                      const isChorus = sectionMatch[1].toLowerCase().includes('chorus');
                      return (
                        <div key={idx} className={`pt-4 pb-1 select-none flex ${lyricsAlign === 'left' ? 'justify-start pl-4' : 'justify-center'}`}>
                          <span className={`inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-bold tracking-widest uppercase shadow-sm ${
                            isChorus
                              ? 'bg-accent/20 text-accent border border-accent/50'
                              : 'bg-[#182030] text-gray-300 border border-[#2b3548]'
                          }`}>
                            <span>{isChorus ? '✦' : '•'}</span>
                            <span>{sectionMatch[1]}</span>
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        ref={isCurrent ? activeLyricRef : null}
                        onClick={() => seek(item.time)}
                        className={`relative z-10 py-2.5 px-4 rounded-xl cursor-pointer transition-all duration-150 select-none flex items-center gap-3 ${
                          lyricsAlign === 'left' ? 'text-left justify-start pl-4' : 'text-center justify-center'
                        } ${
                          isCurrent
                            ? `text-white font-extrabold ${
                                lyricsSize === 'large' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
                              } bg-accent/20 border border-accent/60`
                            : isPast
                            ? `text-[#6b7280] ${
                                lyricsSize === 'large' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                              } hover:text-gray-300 hover:scale-[1.01]`
                            : `text-[#9ca3af] ${
                                lyricsSize === 'large' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                              } hover:text-white hover:scale-[1.01]`
                        }`}
                        style={
                          isCurrent && isPlaying
                            ? {
                                transform: `scale(${1.02 + beatData.beatPulse * 0.025})`,
                                boxShadow: `0 0 ${12 + beatData.bassLevel * 24}px rgba(53, 198, 176, ${0.3 + beatData.bassLevel * 0.45})`,
                                borderColor: `rgba(53, 198, 176, ${0.45 + beatData.bassLevel * 0.5})`,
                              }
                            : isCurrent
                            ? {
                                transform: 'scale(1.02)',
                                boxShadow: '0 0 16px rgba(53, 198, 176, 0.35)',
                                borderColor: 'rgba(53, 198, 176, 0.5)',
                              }
                            : undefined
                        }
                      >
                        {isCurrent && (
                          <span className="flex items-end space-x-0.5 h-4 flex-shrink-0">
                            <span
                              className="w-1 bg-accent rounded-full transition-all duration-75"
                              style={{ height: `${Math.max(4, beatData.eqBars[0] * 0.16)}px` }}
                            />
                            <span
                              className="w-1 bg-white/90 rounded-full transition-all duration-75"
                              style={{ height: `${Math.max(4, beatData.eqBars[1] * 0.16)}px` }}
                            />
                            <span
                              className="w-1 bg-accent rounded-full transition-all duration-75"
                              style={{ height: `${Math.max(4, beatData.eqBars[2] * 0.16)}px` }}
                            />
                            <span
                              className="w-1 bg-white/80 rounded-full transition-all duration-75"
                              style={{ height: `${Math.max(4, beatData.eqBars[3] * 0.16)}px` }}
                            />
                            <span
                              className="w-1 bg-accent/80 rounded-full transition-all duration-75"
                              style={{ height: `${Math.max(4, beatData.eqBars[4] * 0.16)}px` }}
                            />
                          </span>
                        )}
                        <div className="flex flex-col text-inherit">
                          <span className="leading-snug">{item.text || '♪'}</span>
                          {isTranslationActive && (translatedLinesMap[item.text] || translatedLinesMap[`idx_${idx}`]) && (
                            <span className={`font-normal transition-all leading-normal ${
                              isCurrent
                                ? 'text-accent text-xs sm:text-sm mt-1 font-medium'
                                : isPast
                                ? 'text-[#64748b] text-[11px] sm:text-xs mt-0.5'
                                : 'text-accent/70 text-[11px] sm:text-xs mt-0.5'
                            }`}>
                              {translatedLinesMap[item.text] || translatedLinesMap[`idx_${idx}`]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : activeTrack.lyrics ? (
                <div
                  className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 py-4 px-3 sm:px-6 scroll-smooth"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  {plainStanzas.map((stanza) => {
                    const isChorus = stanza.tagType === 'chorus';
                    const isPreChorus = stanza.tagType === 'pre-chorus';
                    const isBridge = stanza.tagType === 'bridge';
                    const isIntroOutro = stanza.tagType === 'intro' || stanza.tagType === 'outro';

                    return (
                      <div
                        key={stanza.id}
                        style={
                          isChorus && isPlaying
                            ? {
                                boxShadow: `0 0 ${12 + beatData.bassLevel * 20}px rgba(53, 198, 176, ${0.2 + beatData.bassLevel * 0.3})`,
                                borderColor: `rgba(53, 198, 176, ${0.35 + beatData.bassLevel * 0.3})`,
                              }
                            : undefined
                        }
                        className={`rounded-2xl transition-all duration-300 max-w-xl mx-auto p-5 sm:p-6 group shadow-md ${
                          lyricsAlign === 'left' ? 'text-left pl-6 sm:pl-8' : 'text-center'
                        } ${
                          isChorus
                            ? 'bg-[#151a21] border border-accent/50 shadow-sm hover:border-accent'
                            : 'bg-[#10141f] border border-[#1e273a] hover:border-accent/40 hover:bg-[#131927]'
                        }`}
                      >
                        {/* Section Header Badge */}
                        {stanza.tag && (
                          <div className={`mb-3.5 flex ${lyricsAlign === 'left' ? 'justify-start' : 'justify-center'}`}>
                            <span
                              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-mono font-bold tracking-widest uppercase shadow-sm ${
                                isChorus
                                  ? 'bg-accent/20 text-accent border border-accent/50'
                                  : 'bg-[#192132] text-gray-300 border border-[#2d3850]'
                              }`}
                            >
                              <span>{isChorus ? '✦' : '•'}</span>
                              <span>{stanza.tag}</span>
                            </span>
                          </div>
                        )}

                        {/* Stanza Lines */}
                        <div className={lyricsSize === 'large' ? 'space-y-3' : 'space-y-2'}>
                          {stanza.lines.map((line, lIdx) => {
                            const trans = isTranslationActive ? translatedLinesMap[line] : null;
                            return (
                              <div key={lIdx} className="space-y-0.5">
                                <p
                                  className={`transition-colors tracking-wide ${
                                    lyricsSize === 'large'
                                      ? 'text-base sm:text-lg leading-relaxed'
                                      : 'text-sm sm:text-base leading-relaxed'
                                  } ${
                                    isChorus
                                      ? 'text-white font-semibold group-hover:text-accent'
                                      : 'text-gray-200 font-medium group-hover:text-white'
                                  }`}
                                >
                                  {line}
                                </p>
                                {trans && (
                                  <p className="text-xs sm:text-sm text-accent/80 font-normal italic tracking-normal">
                                    {trans}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 flex-1">
                  <Music className="w-10 h-10 text-[#4b5563]" />
                  <div className="space-y-1">
                    <p className="text-xs text-white font-semibold">No lyrics found for this track</p>
                    <p className="text-[11px] text-[#9ca3af]">
                      Query the community-driven open-source LRCLIB database
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => handleAutoFetchSyncedLyrics()}
                      disabled={lyricsLoading || isAutoFetching}
                      className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-sm flex items-center space-x-2 cursor-pointer transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles className={`w-4 h-4 ${isAutoFetching ? 'animate-spin' : ''}`} />
                      <span>{isAutoFetching ? 'Auto-Searching Synced Lyrics...' : '⚡ Auto-Fetch Synced Lyrics'}</span>
                    </button>
                    <button
                      onClick={() => {
                        const cleanQueryText = cleanTrackQuery(activeTrack.title, activeTrack.artistName);
                        setSearchQuery(cleanQueryText);
                        setIsSearchOpen(true);
                        handleSearchOnlineLyrics();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#181c24] hover:bg-[#202634] text-[#d1d5db] text-xs font-semibold border border-[#242a36] flex items-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Search Online</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Bottom Controls Deck */}
        <div className="relative z-20 flex-shrink-0 w-full px-4 sm:px-5 py-2 sm:py-3 flex flex-col space-y-2 border-t border-[#1b212d]/70 bg-[#0c0f16]/95 backdrop-blur-md">
          {/* Visualizer Mode Selector Pill Bar (Only in Player/Track tab) */}
          {activeTab === 'player' && (
            <div className="flex items-center justify-between pb-0.5">
              <div className="flex items-center space-x-1 p-0.5 bg-[#10141d]/90 border border-[#1e2536] rounded-xl text-[11px] shadow-sm">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#6b7280] px-1.5 hidden sm:inline">
                  VISUALIZER:
                </span>
                {(['bars', 'wave', 'halo', 'embers', 'vu', 'off'] as VisualizerMode[]).map((vMode) => (
                  <button
                    key={vMode}
                    onClick={() => handleVisualizerChange(vMode)}
                    className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer text-[11px] font-semibold ${
                      visualizerMode === vMode
                        ? 'bg-accent text-white shadow-md'
                        : 'text-[#9ca3af] hover:text-white hover:bg-[#1a202c]'
                    }`}
                  >
                    {vMode === 'bars' && '⫾ Bars'}
                    {vMode === 'wave' && '∿ Wave'}
                    {vMode === 'halo' && '◯ Halo'}
                    {vMode === 'embers' && '✦ Embers'}
                    {vMode === 'vu' && '⏱ VU'}
                    {vMode === 'off' && 'Off'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono text-[#6b7280] hidden md:inline">
                Press <kbd className="px-1 py-0.5 rounded bg-[#161a24] border border-[#2b3345] text-white">V</kbd> to cycle
              </span>
            </div>
          )}

          {/* Seek Scrubber Timeline with Animated Shimmer, Pulsing Halo, and Tooltip */}
          <AudioProgressBar
            currentTime={safeCurrentTime}
            duration={safeDuration}
            onSeek={seek}
            isPlaying={isPlaying}
            size="md"
            className="w-full"
          />

          {/* Primary Playback Transport Row */}
          <div className="flex items-center justify-between">
            {/* Left Action: Shuffle */}
            <button
              onClick={toggleShuffle}
              title={shuffle ? 'Shuffle: Enabled' : 'Shuffle: Disabled'}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                shuffle ? 'text-accent bg-accent/15' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Center Transport Controls with Micro-Interactions */}
            <div className="flex items-center space-x-5">
              <button
                onClick={previousTrack}
                title="Previous Track (Left Arrow)"
                className="p-2 rounded-full text-[#9ca3af] hover:text-white hover:bg-[#1a202c] transition-all duration-150 hover:scale-110 active:scale-90 cursor-pointer"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Giant Central Play/Pause Button with Pulsing Glow */}
              <div className="relative flex items-center justify-center">
                {isPlaying && (
                  <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping opacity-60 pointer-events-none" />
                )}
                <button
                  onClick={togglePlayPause}
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  className="relative z-10 w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-xl shadow-accent/40 cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  )}
                </button>
              </div>

              <button
                onClick={nextTrack}
                title="Next Track (Right Arrow)"
                className="p-2 rounded-full text-[#9ca3af] hover:text-white hover:bg-[#1a202c] transition-all duration-150 hover:scale-110 active:scale-90 cursor-pointer"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Right Action: Repeat */}
            <button
              onClick={cycleRepeat}
              title={`Repeat: ${repeatMode.toUpperCase()}`}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                repeatMode !== 'off' ? 'text-accent bg-accent/15' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Bottom Sub-Bar: Volume & Equalizer Shortcut */}
          <div className="flex items-center justify-between pt-1 border-t border-[#181e2b]/60 text-xs text-[#9ca3af]">
            {/* Volume Control */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                className="text-[#9ca3af] hover:text-white transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                onInput={(e) => setVolume(parseFloat((e.target as HTMLInputElement).value))}
                className="w-20 sm:w-28 h-1 bg-[#1e2533] rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="font-mono text-[10px] w-6 text-right tabular-nums">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>

            {/* Hint */}
            <span className="hidden sm:inline text-[9px] font-mono text-[#6b7280]">
              <kbd className="px-1 py-0.5 rounded bg-[#161a24] border border-[#2b3345] text-white">Esc</kbd> close · <kbd className="px-1 py-0.5 rounded bg-[#161a24] border border-[#2b3345] text-white">Space</kbd> play/pause
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

