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
import { devanagariToHinglish, hasDevanagari } from '../utils/hinglish';
import { VistaraLogo } from './VistaraLogo';

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

  // Side-by-side lyrics state (reveals 2-3 seconds after audio starts playing)
  const [sideLyricsRevealed, setSideLyricsRevealed] = useState(false);
  const [userDismissedSideLyrics, setUserDismissedSideLyrics] = useState(false);
  const sideActiveLyricRef = React.useRef<HTMLDivElement | null>(null);
  const sideLyricsContainerRef = React.useRef<HTMLDivElement | null>(null);

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
  const [lyricsSource, setLyricsSource] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LrcLibSearchResultDto[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  // Bilingual Lyrics Translation State (Default to TRUE for instant Hinglish subtitles)
  const [isTranslationActive, setIsTranslationActive] = useState<boolean>(() => {
    return localStorage.getItem('vistara_lyrics_translate_active') !== 'false';
  });
  const [targetLanguage, setTargetLanguage] = useState<string>(() => {
    return localStorage.getItem('vistara_lyrics_target_lang') || 'hi';
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

  // Full automatic smart-sync: auto-fetch synced lyrics eagerly when Player or Lyrics tab is viewed
  useEffect(() => {
    if ((activeTab === 'lyrics' || activeTab === 'player') && activeTrack && !parsedLyrics && !lyricsLoading && !isAutoFetching) {
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

  // Reveal side lyrics 2-3 seconds after audio starts playing (or immediately if already past 2s)
  useEffect(() => {
    if (currentTime >= 2.0) {
      setSideLyricsRevealed(true);
      return;
    }

    if (!isPlaying) return;

    const remainingDelay = Math.max(0, (2.0 - currentTime) * 1000);
    const timer = setTimeout(() => {
      setSideLyricsRevealed(true);
    }, remainingDelay);

    return () => clearTimeout(timer);
  }, [isPlaying, activeTrack?.id, Math.floor(currentTime)]);

  // Reset side lyrics state whenever track changes
  useEffect(() => {
    setSideLyricsRevealed(false);
    setUserDismissedSideLyrics(false);
  }, [activeTrack?.id]);

  // Auto-scroll side lyrics smoothly to active lyric line
  React.useEffect(() => {
    if (sideActiveLyricRef.current && sideLyricsContainerRef.current && activeTab === 'player' && sideLyricsRevealed && !userDismissedSideLyrics) {
      const container = sideLyricsContainerRef.current;
      const activeEl = sideActiveLyricRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
      const targetScroll = relativeTop - container.clientHeight / 2 + activeRect.height / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [currentLyricIndex, activeTab, sideLyricsRevealed, userDismissedSideLyrics]);

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
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 select-none transition-colors duration-300 overflow-hidden ${
        isMaximized
          ? 'bg-[#06080d] p-0'
          : 'bg-black/75 backdrop-blur-xl animate-in fade-in duration-300'
      }`}
    >
      <div
        className={`relative flex flex-col overflow-hidden shadow-2xl transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isMaximized
            ? 'w-full h-full bg-[#06080d] rounded-none'
            : activeTab === 'lyrics' || activeTab === 'queue'
            ? 'w-full max-w-2xl md:max-w-3xl lg:max-w-4xl h-[92vh] max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] bg-[#0c1017]/80 backdrop-blur-3xl border border-white/[0.12] rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] animate-in zoom-in-95 duration-200'
            : sideLyricsRevealed && !userDismissedSideLyrics
            ? 'w-full max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl h-[92vh] max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] bg-[#0c1017]/80 backdrop-blur-3xl border border-white/[0.12] rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]'
            : 'w-full max-w-xl md:max-w-2xl h-[90vh] max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] bg-[#0c1017]/80 backdrop-blur-3xl border border-white/[0.12] rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]'
        }`}
      >
        {/* 1. Signature Apple Music Dynamic Living Fluid Mesh & Artwork Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          {/* Animated Liquid Color Blobs */}
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#FA2D48]/35 blur-[100px] apple-mesh-orb-1" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#38BDF8]/35 blur-[100px] apple-mesh-orb-2" />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full bg-[#818CF8]/30 blur-[100px] apple-mesh-orb-3" />

          {/* Living Artwork Blur Backdrop */}
          {artworkUrl && (
            <div className="absolute inset-0 opacity-40 filter blur-[90px] scale-125 transform transition-all duration-700">
              <img src={artworkUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="absolute inset-0 bg-[#0c1017]/60 backdrop-blur-xl" />
        </div>

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

        {/* 2. Apple Music Top Frosted Header Bar */}
        <div className="relative z-20 flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.08] bg-[#0c1017]/65 backdrop-blur-2xl">
          {/* Left: Animated NOW PLAYING Status Pill with Vistara Emblem */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.1] backdrop-blur-md shadow-inner">
            <VistaraLogo size={15} withGlow={true} animated={true} />
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

          {/* Center: Apple Segmented Pill Switcher */}
          <div className="flex items-center space-x-1 p-0.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-xs backdrop-blur-md shadow-inner">
            <button
              onClick={() => setActiveTab('player')}
              className={`px-3.5 py-1 rounded-full transition-all duration-200 cursor-pointer font-medium ${
                activeTab === 'player' ? 'bg-white/[0.18] text-white shadow-sm font-semibold' : 'text-white/60 hover:text-white'
              }`}
            >
              Track
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-full transition-all duration-200 cursor-pointer font-medium ${
                activeTab === 'queue' ? 'bg-white/[0.18] text-white shadow-sm font-semibold' : 'text-white/60 hover:text-white'
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
              className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-full transition-all duration-200 cursor-pointer font-medium ${
                activeTab === 'lyrics' ? 'bg-white/[0.18] text-white shadow-sm font-semibold' : 'text-white/60 hover:text-white'
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
              className={`w-8 h-8 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                sleepTimerRemainingSeconds !== null
                  ? 'bg-accent/20 text-accent border-accent/50 shadow-sm'
                  : 'bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white border-white/[0.08]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              {sleepTimerRemainingSeconds !== null && (
                <span className="text-[9px] font-mono font-semibold ml-0.5">
                  {sleepTimerRemainingSeconds === -1 ? 'End' : `${Math.ceil(sleepTimerRemainingSeconds / 60)}m`}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsEqualizerOpen(true)}
              title="Audio Equalizer & Studio Processing"
              className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white border border-white/[0.08] flex items-center justify-center transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsMaximized((prev) => !prev)}
              title={isMaximized ? 'Windowed View' : 'Maximize to Full Screen'}
              className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white border border-white/[0.08] flex items-center justify-center transition-all cursor-pointer"
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setIsNowPlayingOpen(false)}
              title="Close (Esc)"
              className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-rose-500/25 text-white/70 hover:text-rose-300 border border-white/[0.08] hover:border-rose-500/40 flex items-center justify-center transition-all cursor-pointer"
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
            /* MODE A: THE GRAND CASSETTE TAPE & SIDE-BY-SIDE LYRICS         */
            /* ============================================================= */
            <div
              className={`w-full flex ${
                sideLyricsRevealed && !userDismissedSideLyrics
                  ? 'flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8 max-w-6xl'
                  : 'flex-col items-center max-w-lg'
              } mx-auto transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]`}
            >
              {/* Left Column: Cassette / Vinyl Player Experience */}
              <div className="flex flex-col items-center max-w-lg w-full space-y-3.5 text-center flex-shrink-0">
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

                      {/* Mode Switcher Pill & Side Lyrics Toggle */}
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

                        <button
                          onClick={() => {
                            if (!sideLyricsRevealed || userDismissedSideLyrics) {
                              setSideLyricsRevealed(true);
                              setUserDismissedSideLyrics(false);
                            } else {
                              setUserDismissedSideLyrics(true);
                            }
                          }}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm border ${
                            sideLyricsRevealed && !userDismissedSideLyrics
                              ? 'bg-accent/20 text-accent border-accent/40 font-semibold'
                              : 'bg-[#111520] hover:bg-[#182030] text-[#9ca3af] hover:text-white border-[#232c3d]'
                          }`}
                          title={sideLyricsRevealed && !userDismissedSideLyrics ? 'Hide side lyrics' : 'Show lyrics beside cassette tape'}
                        >
                          <AlignLeft className="w-3 h-3 text-accent" />
                          <span>{sideLyricsRevealed && !userDismissedSideLyrics ? 'Lyrics: Beside Tape' : 'Show Lyrics'}</span>
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
                          } ${isPlaying ? 'scale-100 shadow-[0_15px_45px_rgba(56, 189, 248,0.25)]' : 'scale-[0.98]'}`}
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

                      {/* Mode Switcher Pill & Side Lyrics Toggle */}
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

                        <button
                          onClick={() => {
                            if (!sideLyricsRevealed || userDismissedSideLyrics) {
                              setSideLyricsRevealed(true);
                              setUserDismissedSideLyrics(false);
                            } else {
                              setUserDismissedSideLyrics(true);
                            }
                          }}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm border ${
                            sideLyricsRevealed && !userDismissedSideLyrics
                              ? 'bg-accent/20 text-accent border-accent/40 font-semibold'
                              : 'bg-[#111520] hover:bg-[#182030] text-[#9ca3af] hover:text-white border-[#232c3d]'
                          }`}
                          title={sideLyricsRevealed && !userDismissedSideLyrics ? 'Hide side lyrics' : 'Show lyrics beside cassette tape'}
                        >
                          <AlignLeft className="w-3 h-3 text-accent" />
                          <span>{sideLyricsRevealed && !userDismissedSideLyrics ? 'Lyrics: Beside Tape' : 'Show Lyrics'}</span>
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

              {/* Right Column: Signature Apple Music Dynamic Synced Lyrics Beside Cassette Tape */}
              {sideLyricsRevealed && !userDismissedSideLyrics && (
                <div className="w-full lg:w-[410px] xl:w-[470px] h-[380px] sm:h-[440px] lg:h-[500px] flex flex-col bg-black/40 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex-shrink-0 animate-in fade-in slide-in-from-right-8 duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]">
                  {/* Subtle internal living glow */}
                  <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-accent/20 blur-3xl pointer-events-none -z-10" />

                  {/* Side Lyrics Header */}
                  <div className="relative z-10 flex items-center justify-between pb-3 mb-2 border-b border-white/[0.08] flex-shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-[#FA2D48] animate-pulse" />
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/90">
                        SYNCED LYRICS
                      </span>
                      {lyricsSource && (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-white/70 border border-white/[0.1] uppercase font-semibold">
                          {lyricsSource === 'local_lrc' ? 'LRC' : lyricsSource === 'lrclib' ? 'LRCLIB' : 'HI-RES'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* Quick Hinglish Translation Toggle */}
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
                        className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                          isTranslationActive
                            ? 'bg-accent text-white border-accent shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                            : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border-white/[0.08]'
                        }`}
                        title="Toggle real-time bilingual Hinglish lyrics translation"
                      >
                        <Languages className={`w-2.5 h-2.5 ${translationLoading ? 'animate-spin' : ''}`} />
                        <span>{translationLoading ? '...' : isTranslationActive ? 'Hinglish: On' : 'Hinglish'}</span>
                      </button>

                      {!parsedLyrics && (
                        <button
                          onClick={handleAutoFetchSyncedLyrics}
                          disabled={lyricsLoading || isAutoFetching}
                          className="px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white border border-white/[0.1] text-[10px] font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                          title="Auto fetch synced lyrics"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-accent" />
                          <span>Sync</span>
                        </button>
                      )}
                      <button
                        onClick={() => setActiveTab('lyrics')}
                        className="px-2 py-1 rounded-full text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors text-[10px] font-semibold cursor-pointer"
                        title="Open Full Lyrics Screen"
                      >
                        Expand ↗
                      </button>
                      <button
                        onClick={() => setUserDismissedSideLyrics(true)}
                        className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                        title="Hide side lyrics"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Real-time beat responsive frequency line */}
                  {isPlaying && (
                    <div className="w-full h-0.5 mb-2.5 bg-white/[0.06] rounded-full overflow-hidden flex items-center gap-0.5 pointer-events-none">
                      {[...Array(24)].map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-accent/80 transition-all duration-75 rounded-full"
                          style={{
                            height: `${Math.min(100, Math.max(20, beatData.bassLevel * 100 * (0.7 + (i % 2) * 0.4)))}%`,
                            opacity: 0.4 + beatData.bassLevel * 0.6,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Apple Music Style Side Lyrics Stream */}
                  <div
                    ref={sideLyricsContainerRef}
                    className="relative flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-3 py-3 px-1 scroll-smooth"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {lyricsLoading && !activeTrack.lyrics ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-8">
                        <Sparkles className="w-5 h-5 text-accent animate-spin" />
                        <span className="text-xs text-white/70 font-medium">Auto-fetching lyrics...</span>
                      </div>
                    ) : parsedLyrics && parsedLyrics.length > 0 ? (
                      parsedLyrics.map((item, idx) => {
                        const isCurrent = idx === currentLyricIndex;
                        const isPast = idx < currentLyricIndex;
                        const rawTranslation = translatedLinesMap[item.text] || translatedLinesMap[`idx_${idx}`];
                        const subtitleText = rawTranslation || (hasDevanagari(item.text) ? devanagariToHinglish(item.text) : '');

                        return (
                          <div
                            key={idx}
                            ref={isCurrent ? sideActiveLyricRef : null}
                            onClick={() => seek(item.time)}
                            className={`group relative py-2 px-2.5 rounded-2xl cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none flex items-start justify-between gap-3 ${
                              isCurrent
                                ? 'text-white font-extrabold scale-[1.02] origin-left'
                                : isPast
                                ? 'opacity-35 blur-[0.35px] text-white/90 font-bold hover:opacity-85 hover:blur-none hover:translate-x-1'
                                : 'opacity-45 blur-[0.35px] text-white font-bold hover:opacity-90 hover:blur-none hover:translate-x-1'
                            }`}
                          >
                            <div className="flex flex-col min-w-0 flex-1">
                              {/* Main Lyric Line (Apple Music Typography) */}
                              <div className="flex items-center space-x-2">
                                {isCurrent && (
                                  <span className="flex items-end space-x-0.5 h-3.5 flex-shrink-0 mr-1.5">
                                    <span
                                      className="w-0.5 bg-accent rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                                      style={{ height: `${Math.max(4, Math.min(14, beatData.bassLevel * 22)) || 10}px` }}
                                    />
                                    <span
                                      className="w-0.5 bg-white rounded-full transition-all duration-75 shadow-[0_0_8px_#ffffff]"
                                      style={{ height: `${Math.max(4, Math.min(14, beatData.midLevel * 18)) || 6}px` }}
                                    />
                                    <span
                                      className="w-0.5 bg-accent rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                                      style={{ height: `${Math.max(4, Math.min(14, beatData.trebleLevel * 20)) || 12}px` }}
                                    />
                                  </span>
                                )}
                                <span
                                  className={`leading-snug transition-all duration-300 ${
                                    isCurrent
                                      ? 'text-white font-black text-base sm:text-lg md:text-xl tracking-tight drop-shadow-[0_2px_16px_rgba(255,255,255,0.45)]'
                                      : 'text-sm sm:text-base font-bold'
                                  }`}
                                >
                                  {item.text || '♪'}
                                </span>
                              </div>

                              {/* Translation / Hinglish Subtitle Directly Below Main Text */}
                              {isTranslationActive && subtitleText && (
                                <span
                                  className={`block font-medium leading-normal italic transition-all duration-300 ${
                                    isCurrent
                                      ? 'text-xs sm:text-[13.5px] text-[#7DD3FC] font-semibold mt-1 pl-4 drop-shadow-[0_0_12px_rgba(56,189,248,0.45)] animate-in fade-in-0 slide-in-from-top-1.5'
                                      : 'text-[11px] text-white/40 mt-0.5 pl-4'
                                  }`}
                                >
                                  {subtitleText}
                                </span>
                              )}
                            </div>

                            <span
                              className={`text-[9px] font-mono flex-shrink-0 pt-0.5 transition-colors ${
                                isCurrent ? 'text-accent font-bold drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]' : 'text-white/30'
                              }`}
                            >
                              {formatTime(item.time)}
                            </span>
                          </div>
                        );
                      })
                    ) : activeTrack.lyrics ? (
                      <div className="space-y-3 py-2 text-xs text-[#94A3B8] leading-relaxed whitespace-pre-wrap">
                        {activeTrack.lyrics}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-2.5 py-8">
                        <Music className="w-7 h-7 text-[#64748B] opacity-60" />
                        <span className="text-xs text-[#94A3B8]">No synced lyrics available</span>
                        <button
                          onClick={handleAutoFetchSyncedLyrics}
                          disabled={lyricsLoading || isAutoFetching}
                          className="px-3 py-1.5 bg-accent/20 hover:bg-accent text-accent hover:text-white border border-accent/40 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>⚡ Auto-Sync Lyrics</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
            /* MODE C: APPLE MUSIC FULLSCREEN KARAOKE & LYRICS DISPLAY       */
            /* ============================================================= */
            <div className="w-full h-full flex-1 min-h-0 flex flex-col bg-black/40 backdrop-blur-3xl border border-white/[0.1] rounded-2xl p-3 sm:p-5 shadow-2xl overflow-hidden relative animate-in fade-in duration-200">
              {/* Real-Time Beat Reactive Visualizer Canvas behind lyrics */}
              <LyricsBeatVisualizer analyserRef={analyserRef} isPlaying={isPlaying} />

              {/* Header Bar */}
              <div className="relative z-10 flex flex-wrap items-center justify-between border-b border-white/[0.08] pb-2.5 mb-2 gap-2 flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-[#FA2D48] animate-pulse" />
                  <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/90 truncate max-w-[180px] sm:max-w-xs">
                    LYRICS · {activeTrack.title}
                  </h2>
                  {parsedLyrics ? (
                    <span className="text-[9px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/40 flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-2.5 h-2.5 text-accent animate-pulse" /> Synced Karaoke
                    </span>
                  ) : activeTrack.lyrics ? (
                    <span className="text-[9px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white/80 border border-white/[0.1] flex items-center gap-1 shadow-sm">
                      <AlignLeft className="w-2.5 h-2.5 text-accent" /> Formatted Stanzas
                    </span>
                  ) : null}
                  <span
                    className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/[0.08] flex items-center gap-1 uppercase"
                    title="Multi-Source Lyrics Pipeline (Local LRC • LRCLIB • iTunes • Lyrics.ovh)"
                  >
                    <Globe className="w-2.5 h-2.5" />{' '}
                    {lyricsSource === 'local_lrc'
                      ? 'LRC'
                      : lyricsSource === 'lyrics.ovh'
                      ? 'LYRICS.OVH'
                      : lyricsSource === 'embedded'
                      ? 'EMBEDDED'
                      : lyricsSource === 'lrclib'
                      ? 'LRCLIB'
                      : 'HI-RES'}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {/* Auto-Fetch Synced Lyrics Button */}
                  <button
                    onClick={handleAutoFetchSyncedLyrics}
                    disabled={lyricsLoading || isAutoFetching}
                    className={`px-3 py-1 rounded-full border text-[11px] font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm ${
                      isAutoFetching
                        ? 'bg-accent/30 text-accent border-accent animate-pulse'
                        : parsedLyrics
                        ? 'bg-white/[0.08] hover:bg-white/[0.15] text-white/80 hover:text-white border-white/[0.08]'
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
                      className={`px-2.5 py-1 rounded-l-full border text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                        isTranslationActive
                          ? 'bg-accent text-white border-accent shadow-[0_0_12px_rgba(56, 189, 248,0.4)]'
                          : 'bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white border-white/[0.08]'
                      }`}
                      title="Toggle bilingual real-time lyrics translation"
                    >
                      <Languages className={`w-3 h-3 ${translationLoading ? 'animate-spin' : ''}`} />
                      <span>
                        {translationLoading
                          ? 'Translating...'
                          : isTranslationActive
                          ? targetLanguage === 'hi' || targetLanguage === 'hinglish'
                            ? 'Hinglish: On'
                            : `Translate: ${targetLanguage.toUpperCase()}`
                          : 'Translate (Hinglish)'}
                      </span>
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
                      className="py-1 px-1 rounded-r-full border border-l-0 text-[10px] font-mono font-bold bg-white/[0.08] text-accent border-white/[0.08] hover:border-accent cursor-pointer focus:outline-none"
                      title="Choose target translation language"
                    >
                      <option value="hi">HINGLISH</option>
                      <option value="en">EN</option>
                      <option value="es">ES</option>
                      <option value="ja">JA</option>
                      <option value="fr">FR</option>
                    </select>
                  </div>

                  {/* Lyrics Formatting Toolbar: Alignment & Font Size */}
                  <button
                    onClick={toggleLyricsAlign}
                    className="p-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                    title={`Alignment: ${lyricsAlign === 'center' ? 'Center (Click for Left)' : 'Left (Click for Center)'}`}
                  >
                    {lyricsAlign === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={toggleLyricsSize}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-bold font-mono transition-colors cursor-pointer ${
                      lyricsSize === 'large'
                        ? 'bg-accent/20 text-accent border-accent/40'
                        : 'bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white border-white/[0.08]'
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
                    className={`px-3 py-1 rounded-full border text-[11px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                      isSearchOpen
                        ? 'bg-accent/20 text-accent border-accent/40'
                        : 'bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white border-white/[0.08]'
                    }`}
                    title="Search different lyrics on LRCLIB"
                  >
                    <Search className="w-3 h-3" />
                    <span>Search</span>
                  </button>

                  <button
                    onClick={() => handleAutoFetchSyncedLyrics()}
                    disabled={lyricsLoading || isAutoFetching}
                    className="px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white border border-white/[0.08] text-[11px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
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
                        className={`relative z-10 py-3 sm:py-4 px-4 rounded-2xl cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none flex items-start gap-4 ${
                          lyricsAlign === 'left' ? 'text-left justify-start' : 'text-center justify-center'
                        } ${
                          isCurrent
                            ? `text-white font-black scale-[1.03] origin-left drop-shadow-[0_2px_24px_rgba(255,255,255,0.5)]`
                            : isPast
                            ? `opacity-30 blur-[0.45px] text-white/90 font-bold hover:opacity-85 hover:blur-none hover:scale-[1.01]`
                            : `opacity-40 blur-[0.45px] text-white font-bold hover:opacity-90 hover:blur-none hover:scale-[1.01]`
                        }`}
                      >
                        {isCurrent && (
                          <span className="flex items-end space-x-0.5 h-5 flex-shrink-0 mt-1">
                            <span
                              className="w-1 bg-accent rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                              style={{ height: `${Math.max(4, beatData.eqBars[0] * 0.18)}px` }}
                            />
                            <span
                              className="w-1 bg-white rounded-full transition-all duration-75 shadow-[0_0_8px_#ffffff]"
                              style={{ height: `${Math.max(4, beatData.eqBars[1] * 0.18)}px` }}
                            />
                            <span
                              className="w-1 bg-accent rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                              style={{ height: `${Math.max(4, beatData.eqBars[2] * 0.18)}px` }}
                            />
                            <span
                              className="w-1 bg-white rounded-full transition-all duration-75 shadow-[0_0_8px_#ffffff]"
                              style={{ height: `${Math.max(4, beatData.eqBars[3] * 0.18)}px` }}
                            />
                            <span
                              className="w-1 bg-accent rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                              style={{ height: `${Math.max(4, beatData.eqBars[4] * 0.18)}px` }}
                            />
                          </span>
                        )}
                        <div className="flex flex-col text-inherit">
                          <span className={`leading-snug tracking-tight ${
                            lyricsSize === 'large'
                              ? isCurrent ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-xl sm:text-2xl'
                              : isCurrent ? 'text-xl sm:text-2xl lg:text-3xl' : 'text-lg sm:text-xl'
                          }`}>
                            {item.text || '♪'}
                          </span>
                          {isTranslationActive && (translatedLinesMap[item.text] || translatedLinesMap[`idx_${idx}`] || (hasDevanagari(item.text) ? devanagariToHinglish(item.text) : '')) && (
                            <span className={`font-semibold transition-all leading-normal italic ${
                              isCurrent
                                ? 'text-[#7DD3FC] text-sm sm:text-base lg:text-lg mt-1.5 drop-shadow-[0_0_12px_rgba(56,189,248,0.45)] animate-in fade-in-0 slide-in-from-top-1.5'
                                : 'text-white/40 text-xs sm:text-sm mt-0.5'
                            }`}>
                              {translatedLinesMap[item.text] || translatedLinesMap[`idx_${idx}`] || devanagariToHinglish(item.text)}
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
                                boxShadow: `0 0 ${12 + beatData.bassLevel * 20}px rgba(56, 189, 248, ${0.2 + beatData.bassLevel * 0.3})`,
                                borderColor: `rgba(56, 189, 248, ${0.35 + beatData.bassLevel * 0.3})`,
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

        {/* 4. Apple Music Bottom Frosted Controls Deck */}
        <div className="relative z-20 flex-shrink-0 w-full px-4 sm:px-6 py-3 flex flex-col space-y-2.5 border-t border-white/[0.08] bg-[#0c1017]/75 backdrop-blur-2xl">
          {/* Visualizer Mode Selector Pill Bar (Only in Player/Track tab) */}
          {activeTab === 'player' && (
            <div className="flex items-center justify-between pb-0.5">
              <div className="flex items-center space-x-1 p-0.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-[11px] shadow-inner backdrop-blur-md">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 px-2 hidden sm:inline">
                  VISUALIZER:
                </span>
                {(['bars', 'wave', 'halo', 'embers', 'vu', 'off'] as VisualizerMode[]).map((vMode) => (
                  <button
                    key={vMode}
                    onClick={() => handleVisualizerChange(vMode)}
                    className={`px-2.5 py-0.5 rounded-full transition-all duration-150 cursor-pointer text-[11px] font-semibold ${
                      visualizerMode === vMode
                        ? 'bg-white/[0.2] text-white shadow-sm'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
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
              <span className="text-[10px] font-mono text-white/40 hidden md:inline">
                Press <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-white/80">V</kbd> to cycle
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
                shuffle ? 'text-accent bg-accent/20' : 'text-white/50 hover:text-white'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Center Transport Controls with Micro-Interactions */}
            <div className="flex items-center space-x-6">
              <button
                onClick={previousTrack}
                title="Previous Track (Left Arrow)"
                className="p-2 rounded-full text-white/70 hover:text-white transition-all duration-150 hover:scale-110 active:scale-90 cursor-pointer"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              {/* Giant Apple Music Central Play/Pause Button */}
              <button
                onClick={togglePlayPause}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                className="w-13 h-13 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-xl shadow-white/20 cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-black" />
                ) : (
                  <Play className="w-5 h-5 fill-black ml-0.5" />
                )}
              </button>

              <button
                onClick={nextTrack}
                title="Next Track (Right Arrow)"
                className="p-2 rounded-full text-white/70 hover:text-white transition-all duration-150 hover:scale-110 active:scale-90 cursor-pointer"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            </div>

            {/* Right Action: Repeat */}
            <button
              onClick={cycleRepeat}
              title={`Repeat: ${repeatMode.toUpperCase()}`}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                repeatMode !== 'off' ? 'text-accent bg-accent/20' : 'text-white/50 hover:text-white'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Bottom Sub-Bar: Volume & Equalizer Shortcut */}
          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-xs text-white/60">
            {/* Volume Control */}
            <div className="flex items-center space-x-2.5">
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                className="text-white/60 hover:text-white transition-colors cursor-pointer"
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
                className="w-20 sm:w-28 h-1 bg-white/[0.12] rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="font-mono text-[10px] w-6 text-right tabular-nums text-white/70">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>

            {/* Hint */}
            <span className="hidden sm:inline text-[9px] font-mono text-white/40">
              <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-white/70">Esc</kbd> close · <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-white/70">Space</kbd> play/pause
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

