import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Disc,
  Eye,
  Film,
  Flame,
  HardDrive,
  Heart,
  Info,
  Layers,
  LayoutGrid,
  ListFilter,
  Maximize2,
  Monitor,
  Music,
  Play,
  Radio,
  RefreshCw,
  RotateCw,
  Settings2,
  Shuffle,
  Sliders,
  Sparkles,
  Star,
  Tv,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Modal } from '../components/Modal';
import { usePlayer } from '../context/PlayerContext';
import { DashboardDto, EpisodeDto, MovieDto, TrackDto } from '../types';
import { uiSound } from '../utils/uiSound';

interface DashboardPageProps {
  onNavigate: (tab: any) => void;
}

export type DashboardDensity = 'cinematic' | 'standard' | 'compact';
export type HeroMode = 'cinematic' | 'compact' | 'hidden';
export type ContinueWatchingStyle = 'backdrop' | 'poster';
export type CategoryFilter = 'all' | 'movies' | 'tv' | 'music';

interface DashboardPreferences {
  density: DashboardDensity;
  heroMode: HeroMode;
  continueWatchingStyle: ContinueWatchingStyle;
  categoryFilter: CategoryFilter;
  widgets: {
    hero: boolean;
    stats: boolean;
    quick_actions: boolean;
    continue_watching: boolean;
    recent_movies: boolean;
    recent_shows: boolean;
    music_jukebox: boolean;
    storage_usage: boolean;
  };
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  density: 'cinematic',
  heroMode: 'cinematic',
  continueWatchingStyle: 'backdrop',
  categoryFilter: 'all',
  widgets: {
    hero: true,
    stats: true,
    quick_actions: true,
    continue_watching: true,
    recent_movies: true,
    recent_shows: true,
    music_jukebox: true,
    storage_usage: true,
  },
};

const STORAGE_KEY = 'vistara_dashboard_preferences_v2';

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { openVideoPlayer, playTrack } = usePlayer();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);

  // User Preferences State
  const [prefs, setPrefs] = useState<DashboardPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_PREFERENCES;
  });

  // Modals & Active Selections
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [roulettePick, setRoulettePick] = useState<any | null>(null);

  // Hero Carousel State
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const heroTimerRef = useRef<number | null>(null);

  // Persist Preferences
  const updatePrefs = (updater: (prev: DashboardPreferences) => DashboardPreferences) => {
    setPrefs((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const fetchDashboard = async () => {
    setLoading(true);
    const res = await apiRequest<DashboardDto>('/api/v1/dashboard');
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Memoized unified continue watching list (both movies and TV episodes)
  const continueWatchingItems = useMemo(() => {
    if (!data) return [];
    const movies = (data.continueWatchingMovies || []).map((m) => {
      const fileId = m.progress?.mediaFileId || m.editions?.[0]?.mediaFileId;
      return {
        id: m.id,
        mediaFileId: fileId,
        title: m.title,
        subtitle: m.year ? `${m.year} · Movie` : 'Movie',
        posterUrl: m.posterUrl,
        backdropUrl: m.backdropUrl || m.posterUrl,
        progress: m.progress,
        durationSeconds: m.progress?.durationSeconds || (m.runtimeMinutes ? m.runtimeMinutes * 60 : 0),
        type: 'movie' as const,
        rating: m.communityRating,
        genres: m.genres || [],
        overview: m.overview,
      };
    });

    const episodes = (data.continueWatchingEpisodes || []).map((ep) => {
      const fileId = ep.mediaFileId || ep.progress?.mediaFileId;
      const sub = `S${ep.seasonNumber} : E${ep.episodeNumber}${ep.title ? ` · ${ep.title}` : ''}`;
      return {
        id: ep.id,
        mediaFileId: fileId,
        title: ep.seriesTitle ? ep.seriesTitle : ep.title,
        subtitle: sub,
        posterUrl: ep.stillUrl,
        backdropUrl: ep.stillUrl,
        progress: ep.progress,
        durationSeconds: ep.durationSeconds || ep.progress?.durationSeconds || 0,
        type: 'episode' as const,
        rating: 8.5,
        genres: ['TV Series'],
        overview: ep.overview,
      };
    });

    return [...movies, ...episodes].sort((a, b) => {
      const tA = a.progress?.lastPlayedUtc ? new Date(a.progress.lastPlayedUtc).getTime() : 0;
      const tB = b.progress?.lastPlayedUtc ? new Date(b.progress.lastPlayedUtc).getTime() : 0;
      return tB - tA;
    });
  }, [data]);

  // Construct items for Hero Spotlight Carousel
  const heroItems = useMemo(() => {
    if (!data) return [];
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      tagline?: string;
      overview?: string;
      year?: number;
      rating?: number;
      genres: string[];
      runtimeMinutes?: number;
      posterUrl?: string;
      backdropUrl?: string;
      mediaFileId?: string;
      progressPercent?: number;
      isResume?: boolean;
      type: 'movie' | 'episode' | 'show';
    }> = [];

    // 1. First priority: Top continue watching items with progress
    continueWatchingItems.slice(0, 3).forEach((item) => {
      items.push({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        overview: item.overview,
        rating: item.rating,
        genres: item.genres,
        backdropUrl: item.backdropUrl || item.posterUrl,
        posterUrl: item.posterUrl,
        mediaFileId: item.mediaFileId,
        progressPercent: item.progress ? Math.round(item.progress.percentageWatched) : undefined,
        isResume: true,
        type: item.type,
      });
    });

    // 2. Second priority: Top recently added movies with backdrops/posters
    (data.recentlyAddedMovies || []).slice(0, 3).forEach((m) => {
      if (!items.some((i) => i.id === m.id)) {
        items.push({
          id: m.id,
          title: m.title,
          subtitle: `${m.year || 'Movie'} · Feature Film`,
          tagline: m.tagline,
          overview: m.overview,
          year: m.year,
          rating: m.communityRating || 8.1,
          genres: m.genres || ['Action', 'Drama'],
          runtimeMinutes: m.runtimeMinutes,
          backdropUrl: m.backdropUrl || m.posterUrl,
          posterUrl: m.posterUrl,
          mediaFileId: m.editions?.[0]?.mediaFileId,
          type: 'movie',
        });
      }
    });

    // 3. Third priority: Recently added TV shows
    (data.recentlyAddedShows || []).slice(0, 2).forEach((s) => {
      if (!items.some((i) => i.id === s.id)) {
        items.push({
          id: s.id,
          title: s.title,
          subtitle: `${s.year || ''} · ${s.seasonCount || 1} Seasons Series`,
          overview: s.overview,
          year: s.year,
          rating: s.communityRating || 8.4,
          genres: ['TV Drama', 'Mystery'],
          backdropUrl: s.backdropUrl || s.posterUrl,
          posterUrl: s.posterUrl,
          type: 'show',
        });
      }
    });

    return items;
  }, [data, continueWatchingItems]);

  // Auto-cycle hero carousel
  useEffect(() => {
    if (heroItems.length <= 1 || isHeroPaused || prefs.heroMode === 'hidden') return;

    heroTimerRef.current = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroItems.length);
    }, 6500);

    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [heroItems.length, isHeroPaused, prefs.heroMode]);

  const activeHero = heroItems[heroIndex] || heroItems[0];

  const handleDismissContinueWatching = async (e: React.MouseEvent, mediaItemId: string) => {
    e.stopPropagation();
    try {
      uiSound.play('click');
    } catch {}
    try {
      await apiRequest(`/api/v1/playback/progress/${mediaItemId}`, { method: 'DELETE' });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          continueWatchingMovies: (prev.continueWatchingMovies || []).filter((m) => m.id !== mediaItemId),
          continueWatchingEpisodes: (prev.continueWatchingEpisodes || []).filter((ep) => ep.id !== mediaItemId),
        };
      });
    } catch (err) {
      console.error('Failed to dismiss item from continue watching', err);
    }
  };

  const formatRemainingMinutes = (durationSeconds?: number, progressPercent?: number) => {
    if (!durationSeconds || !progressPercent) return null;
    const remainingSecs = Math.max(0, durationSeconds * (1 - progressPercent / 100));
    const mins = Math.round(remainingSecs / 60);
    if (mins <= 0) return 'Few seconds left';
    if (mins < 60) return `${mins}m left`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m left`;
  };

  // Launch "Surprise Me / Media Roulette"
  const handleTriggerRoulette = () => {
    try {
      uiSound.play('click');
    } catch {}

    const pool = [
      ...(data?.recentlyAddedMovies || []),
      ...(data?.favouriteMovies || []),
      ...(data?.continueWatchingMovies || []),
    ];

    if (pool.length === 0) {
      onNavigate('cinema');
      return;
    }

    const randomPick = pool[Math.floor(Math.random() * pool.length)];
    setRoulettePick(randomPick);
    setIsRouletteOpen(true);
  };

  // Quick Resume Top in-progress item
  const handleQuickResume = () => {
    try {
      uiSound.play('click');
    } catch {}
    if (continueWatchingItems.length > 0 && continueWatchingItems[0].mediaFileId) {
      openVideoPlayer(continueWatchingItems[0].mediaFileId);
    } else if (data?.recentlyAddedMovies && data.recentlyAddedMovies.length > 0) {
      const firstMovie = data.recentlyAddedMovies[0];
      if (firstMovie.editions?.[0]?.mediaFileId) {
        openVideoPlayer(firstMovie.editions[0].mediaFileId);
      } else {
        onNavigate('cinema');
      }
    } else {
      onNavigate('cinema');
    }
  };

  // Instant Play Cassette Mix
  const handlePlayCassetteMix = () => {
    try {
      uiSound.play('click');
    } catch {}
    if (data?.recentlyPlayedMusic && data.recentlyPlayedMusic.length > 0) {
      playTrack(data.recentlyPlayedMusic[0], data.recentlyPlayedMusic);
    } else {
      onNavigate('music');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="text-sm text-[#9ca3af] flex items-center space-x-3">
          <Activity className="w-5 h-5 text-accent animate-pulse" />
          <span className="font-medium tracking-wide">Synthesizing personal media universe...</span>
        </div>
      </div>
    );
  }

  // Calculate grid column classes based on Density Preference
  const getGridColsClass = () => {
    if (prefs.density === 'compact') {
      return 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3';
    }
    if (prefs.density === 'standard') {
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4';
    }
    // Cinematic
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5';
  };

  const getContinueWatchingColsClass = () => {
    if (prefs.continueWatchingStyle === 'backdrop') {
      if (prefs.density === 'compact') {
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3';
      }
      if (prefs.density === 'standard') {
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
      }
      return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5';
    }
    return getGridColsClass();
  };

  // Storage Percentage Calculation
  const totalStorage = data?.storageUsage?.totalSizeBytes || 1;
  const moviePct = Math.round(((data?.storageUsage?.moviesSizeBytes || 0) / totalStorage) * 100);
  const tvPct = Math.round(((data?.storageUsage?.tvShowsSizeBytes || 0) / totalStorage) * 100);
  const musicPct = Math.round(((data?.storageUsage?.musicSizeBytes || 0) / totalStorage) * 100);

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-7 select-none">
      {/* 1. Header Toolbar with Dynamic Universe Filter & Customizer */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1 border-b border-[#242a36]/60">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center">
              DASHBOARD
            </h1>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-xs text-[#9ca3af] mt-0.5 flex items-center space-x-2">
            <span>Overview of your personal media universe</span>
            <span className="text-[#4b5563]">•</span>
            <span className="text-accent font-medium">
              {data?.statistics.totalMovies || 0} Films · {data?.statistics.totalShows || 0} Shows ·{' '}
              {data?.statistics.totalTracks || 0} Tracks
            </span>
          </p>
        </div>

        {/* Quick Options Bar: Category Filters & View Density */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter Pills */}
          <div className="flex items-center bg-[#181c24] border border-[#242a36] rounded-lg p-0.5 shadow-sm">
            {(
              [
                { id: 'all', label: 'All', icon: Sparkles },
                { id: 'movies', label: 'Cinema', icon: Film },
                { id: 'tv', label: 'TV Series', icon: Tv },
                { id: 'music', label: 'Hi-Fi Audio', icon: Music },
              ] as const
            ).map((cat) => {
              const Icon = cat.icon;
              const isActive = prefs.categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    try { uiSound.play('tab'); } catch {}
                    updatePrefs((p) => ({ ...p, categoryFilter: cat.id }));
                  }}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-accent text-white shadow'
                      : 'text-[#9ca3af] hover:text-white hover:bg-[#242a36]/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Density Picker Buttons */}
          <div className="hidden sm:flex items-center bg-[#181c24] border border-[#242a36] rounded-lg p-0.5 shadow-sm">
            <button
              title="Cinematic (Spacious, Large Posters)"
              onClick={() => {
                try { uiSound.play('click'); } catch {}
                updatePrefs((p) => ({ ...p, density: 'cinematic' }));
              }}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                prefs.density === 'cinematic'
                  ? 'bg-[#242a36] text-accent'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              title="Standard Layout"
              onClick={() => {
                try { uiSound.play('click'); } catch {}
                updatePrefs((p) => ({ ...p, density: 'standard' }));
              }}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                prefs.density === 'standard'
                  ? 'bg-[#242a36] text-accent'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              title="Compact Dense Grid"
              onClick={() => {
                try { uiSound.play('click'); } catch {}
                updatePrefs((p) => ({ ...p, density: 'compact' }));
              }}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                prefs.density === 'compact'
                  ? 'bg-[#242a36] text-accent'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Customize Widgets Button */}
          <button
            onClick={() => {
              try { uiSound.play('click'); } catch {}
              setIsCustomizeOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#181c24] border border-[#242a36] hover:border-accent text-xs font-semibold text-[#d1d5db] hover:text-white transition-all shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-accent" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {/* 2. Polished Editorial Hero Showcase */}
      {prefs.widgets.hero && prefs.heroMode !== 'hidden' && activeHero && (
        <div
          onMouseEnter={() => setIsHeroPaused(true)}
          onMouseLeave={() => setIsHeroPaused(false)}
          className={`relative w-full rounded-2xl bg-[#141C27] border border-white/[0.07] shadow-2xl transition-all group grid grid-cols-1 lg:grid-cols-12 items-center gap-6 p-5 sm:p-7 ${
            prefs.heroMode === 'compact' ? 'min-h-[200px]' : 'min-h-[280px]'
          }`}
        >
          {/* Left Editorial Content Column */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4 z-10">
            {/* Top Status & Rating Row */}
            <div className="flex flex-wrap items-center gap-2">
              {activeHero.isResume ? (
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-accent/12 text-accent text-[11px] font-bold tracking-wide uppercase">
                  <Play className="w-3 h-3 fill-accent" />
                  <span>Resume Playing {activeHero.progressPercent ? `· ${activeHero.progressPercent}%` : ''}</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-accent/12 text-accent text-[11px] font-bold tracking-wide uppercase">
                  <Sparkles className="w-3 h-3 text-accent" />
                  <span>Featured Spotlight</span>
                </div>
              )}

              {activeHero.rating && (
                <div className="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-white/[0.04] text-[#F8FAFC] text-[11px] font-bold">
                  <Star className="w-3 h-3 fill-accent text-accent" />
                  <span>{activeHero.rating.toFixed(1)}</span>
                </div>
              )}

              <span className="text-[11px] font-medium text-[#94A3B8] px-2 py-1 rounded-md bg-white/[0.04]">
                {activeHero.subtitle}
              </span>
            </div>

            {/* Title, Genres & Synopsis */}
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight line-clamp-1">
                {activeHero.title}
              </h2>

              {activeHero.genres && activeHero.genres.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeHero.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="px-2 py-0.5 rounded bg-white/[0.04] text-[#94A3B8] text-[10px] font-semibold tracking-wide uppercase"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {activeHero.overview && prefs.heroMode !== 'compact' && (
                <p className="text-xs sm:text-[13px] leading-relaxed text-[#94A3B8] line-clamp-3 max-w-xl pt-0.5">
                  {activeHero.overview}
                </p>
              )}
            </div>

            {/* Action Buttons & Slide Dots */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    if (activeHero.mediaFileId) {
                      openVideoPlayer(activeHero.mediaFileId);
                    } else if (activeHero.type === 'show') {
                      onNavigate('tv');
                    } else {
                      onNavigate('cinema');
                    }
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-[#0F141B] text-xs font-extrabold transition-all active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-[#0F141B]" />
                  <span>{activeHero.isResume ? 'Resume Watching' : 'Watch Now'}</span>
                </button>

                <button
                  onClick={handleTriggerRoulette}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#F8FAFC] text-xs font-semibold transition-all active:scale-95"
                >
                  <Shuffle className="w-3.5 h-3.5 text-accent" />
                  <span className="hidden sm:inline">Surprise Me</span>
                </button>

                <button
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    onNavigate(activeHero.type === 'show' ? 'tv' : 'cinema');
                  }}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg hover:bg-white/[0.05] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-semibold transition-all"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Browse</span>
                </button>
              </div>

              {/* Slide Indicators */}
              {heroItems.length > 1 && (
                <div className="flex items-center space-x-1.5">
                  {heroItems.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        try { uiSound.play('click'); } catch {}
                        setHeroIndex(idx);
                      }}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === heroIndex ? 'w-5 bg-accent' : 'w-1.5 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Cleanly Framed Artwork Card */}
          <div className="hidden lg:block lg:col-span-5 relative aspect-[16/10] rounded-xl bg-[#0F141B] border border-white/[0.08] overflow-hidden shadow-2xl">
            {activeHero.backdropUrl || activeHero.posterUrl ? (
              <img
                src={activeHero.backdropUrl || activeHero.posterUrl}
                alt={activeHero.title}
                className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-700 ease-out"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#0F141B] text-[#334155]">
                <Film className="w-12 h-12" />
              </div>
            )}

            {/* Left/Right Carousel Controls (visible on hover) */}
            {heroItems.length > 1 && (
              <>
                <button
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    setHeroIndex((prev) => (prev - 1 + heroItems.length) % heroItems.length);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#0F141B]/80 hover:bg-[#0F141B] border border-white/15 text-[#F8FAFC] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    setHeroIndex((prev) => (prev + 1) % heroItems.length);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#0F141B]/80 hover:bg-[#0F141B] border border-white/15 text-[#F8FAFC] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. Unified Deep Slate Library Telemetry Strip */}
      {prefs.widgets.stats && data?.statistics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[
            {
              tab: 'cinema' as const,
              icon: Film,
              label: 'Cinema',
              value: data.statistics.totalMovies,
              unit: 'Films',
              sub: data.statistics.totalWatchTimeHours > 0 ? `${data.statistics.totalWatchTimeHours} hrs watched` : 'Full library ready',
            },
            {
              tab: 'tv' as const,
              icon: Tv,
              label: 'TV Series',
              value: data.statistics.totalShows,
              unit: 'Shows',
              sub: `${data.statistics.totalEpisodes} episodes available`,
            },
            {
              tab: 'music' as const,
              icon: Music,
              label: 'Hi-Fi Audio',
              value: data.statistics.totalTracks,
              unit: 'Tracks',
              sub: `${data.statistics.totalAlbums} albums · Lossless Studio`,
            },
          ].map((stat) => {
            const IconComp = stat.icon;
            return (
              <div
                key={stat.tab}
                onClick={() => {
                  try { uiSound.play('click'); } catch {}
                  onNavigate(stat.tab);
                }}
                className="group relative p-4 rounded-xl bg-[#141C27] border border-white/[0.06] hover:border-accent/45 hover:bg-[#192331] cursor-pointer transition-all duration-150"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center space-x-1.5">
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{stat.label}</span>
                  </span>
                  <span className="text-[10px] text-[#64748B] group-hover:text-accent transition-colors font-semibold">
                    Browse ↗
                  </span>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight tabular-nums">
                    {stat.value}
                  </span>
                  <span className="text-xs text-[#94A3B8] font-medium">{stat.unit}</span>
                </div>
                <div className="mt-1.5 text-[11px] text-[#64748B] truncate">{stat.sub}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Quick Actions / Universe Launchpad Bar */}
      {prefs.widgets.quick_actions && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={handleQuickResume}
            className="flex items-center space-x-3 p-3 rounded-xl bg-[#12151b] border border-[#242a36] hover:border-accent hover:bg-[#181c24] text-left transition-all group active:scale-98"
          >
            <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/30 text-accent flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-white transition-all">
              <Zap className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white group-hover:text-accent transition-colors">
                Quick Resume
              </div>
              <div className="text-[10px] text-[#9ca3af] truncate">Jump into latest media</div>
            </div>
          </button>

          <button
            onClick={handleTriggerRoulette}
            className="flex items-center space-x-3 p-3 rounded-xl bg-[#12151b] border border-[#242a36] hover:border-accent hover:bg-[#181c24] text-left transition-all group active:scale-98"
          >
            <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/30 text-accent flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-white transition-all">
              <Shuffle className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white group-hover:text-accent transition-colors">
                Surprise Me
              </div>
              <div className="text-[10px] text-[#9ca3af] truncate">Random media picker</div>
            </div>
          </button>

          <button
            onClick={handlePlayCassetteMix}
            className="flex items-center space-x-3 p-3 rounded-xl bg-[#12151b] border border-[#242a36] hover:border-accent hover:bg-[#181c24] text-left transition-all group active:scale-98"
          >
            <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/30 text-accent flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-white transition-all">
              <Radio className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white group-hover:text-accent transition-colors">
                Daily Jukebox
              </div>
              <div className="text-[10px] text-[#9ca3af] truncate">Spin recent tracks</div>
            </div>
          </button>

          <button
            onClick={() => {
              try { uiSound.play('click'); } catch {}
              onNavigate('libraries');
            }}
            className="flex items-center space-x-3 p-3 rounded-xl bg-[#12151b] border border-[#242a36] hover:border-accent hover:bg-[#181c24] text-left transition-all group active:scale-98"
          >
            <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/30 text-accent flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-white transition-all">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white group-hover:text-accent transition-colors">
                Library Folders
              </div>
              <div className="text-[10px] text-[#9ca3af] truncate">Manage and rescan</div>
            </div>
          </button>
        </div>
      )}

      {/* 5. Continue Watching Section (Widescreen 16:9 Backdrop vs 2:3 Poster Toggle) */}
      {prefs.widgets.continue_watching &&
        (prefs.categoryFilter === 'all' || prefs.categoryFilter === 'movies' || prefs.categoryFilter === 'tv') &&
        continueWatchingItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-wider text-white flex items-center uppercase">
                  <Clock className="w-4 h-4 mr-2 text-accent" /> Continue Watching
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#181c24] border border-[#242a36] text-[10px] font-bold text-accent">
                  {continueWatchingItems.length}
                </span>
              </div>

              {/* Card Style Switcher */}
              <div className="flex items-center space-x-1 bg-[#181c24] border border-[#242a36] rounded-md p-0.5">
                <button
                  title="Widescreen 16:9 Backdrop Preview"
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    updatePrefs((p) => ({ ...p, continueWatchingStyle: 'backdrop' }));
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    prefs.continueWatchingStyle === 'backdrop'
                      ? 'bg-accent text-white'
                      : 'text-[#9ca3af] hover:text-white'
                  }`}
                >
                  16:9 Wide
                </button>
                <button
                  title="Portrait 2:3 Poster"
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    updatePrefs((p) => ({ ...p, continueWatchingStyle: 'poster' }));
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    prefs.continueWatchingStyle === 'poster'
                      ? 'bg-accent text-white'
                      : 'text-[#9ca3af] hover:text-white'
                  }`}
                >
                  2:3 Poster
                </button>
              </div>
            </div>

            <div className={`grid ${getContinueWatchingColsClass()}`}>
              {continueWatchingItems.map((item) => {
                const remText = formatRemainingMinutes(item.durationSeconds, item.progress?.percentageWatched);
                const isWide = prefs.continueWatchingStyle === 'backdrop';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.mediaFileId) {
                        try { uiSound.play('click'); } catch {}
                        openVideoPlayer(item.mediaFileId);
                      }
                    }}
                    className="group relative bg-[#12151b] border border-[#242a36] hover:border-accent rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                  >
                    {/* Dismiss Button */}
                    <button
                      title="Remove from Continue Watching"
                      onClick={(e) => handleDismissContinueWatching(e, item.id)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 hover:bg-red-600 text-[#9ca3af] hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 shadow-md border border-[#242a36]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    {/* Media Thumbnail Container */}
                    <div
                      className={`bg-[#181c24] relative overflow-hidden ${
                        isWide ? 'aspect-video' : 'aspect-[2/3]'
                      }`}
                    >
                      {item.backdropUrl || item.posterUrl ? (
                        <img
                          src={isWide ? item.backdropUrl || item.posterUrl : item.posterUrl || item.backdropUrl}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#9ca3af]">
                          {item.type === 'episode' ? <Tv className="w-8 h-8" /> : <Film className="w-8 h-8" />}
                        </div>
                      )}

                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[1px]">
                        <div className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>

                      {/* Remaining minutes badge */}
                      {remText && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-bold text-white border border-white/10 backdrop-blur-sm">
                          {remText}
                        </div>
                      )}

                      {/* Resume progress bar with glowing tip */}
                      {item.progress && (
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#242a36]">
                          <div
                            style={{ width: `${Math.min(100, Math.max(0, item.progress.percentageWatched))}%` }}
                            className="h-full bg-accent relative shadow-[0_0_8px_var(--color-accent)]"
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <div className="font-bold text-xs text-white truncate" title={item.title}>
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#9ca3af] mt-0.5 flex justify-between items-center">
                        <span className="truncate pr-1">{item.subtitle}</span>
                        {item.progress && (
                          <span className="font-bold text-accent text-[10px] flex-shrink-0">
                            {Math.round(item.progress.percentageWatched)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* 6. Recently Added Movies Section */}
      {prefs.widgets.recent_movies &&
        (prefs.categoryFilter === 'all' || prefs.categoryFilter === 'movies') &&
        data?.recentlyAddedMovies &&
        data.recentlyAddedMovies.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wider text-white flex items-center uppercase">
                <Film className="w-4 h-4 mr-2 text-accent" /> Recently Added Movies
              </h2>
              <button
                onClick={() => {
                  try { uiSound.play('click'); } catch {}
                  onNavigate('cinema');
                }}
                className="text-xs text-accent hover:underline font-semibold flex items-center space-x-1"
              >
                <span>View Cinema Studio</span>
                <span>▶</span>
              </button>
            </div>

            <div className={`grid ${getGridColsClass()}`}>
              {data.recentlyAddedMovies.slice(0, prefs.density === 'compact' ? 12 : 8).map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    onNavigate('cinema');
                  }}
                  className="group relative bg-[#12151b] border border-[#242a36] hover:border-accent rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="aspect-[2/3] bg-[#181c24] relative overflow-hidden">
                    {m.posterUrl ? (
                      <img
                        src={m.posterUrl}
                        alt={m.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#9ca3af]">
                        <Film className="w-8 h-8" />
                      </div>
                    )}

                    {/* Community Rating Pill */}
                    {m.communityRating && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 border border-white/10 text-amber-400 text-[10px] font-bold flex items-center space-x-1">
                        <Star className="w-2.5 h-2.5 fill-amber-400" />
                        <span>{m.communityRating.toFixed(1)}</span>
                      </div>
                    )}

                    {/* Play Hover Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="font-bold text-xs text-white truncate" title={m.title}>
                      {m.title}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] mt-0.5 flex items-center justify-between">
                      <span>{m.year || 'Feature Film'}</span>
                      {m.runtimeMinutes && <span>{m.runtimeMinutes}m</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* 7. Recently Added TV Shows Section */}
      {prefs.widgets.recent_shows &&
        (prefs.categoryFilter === 'all' || prefs.categoryFilter === 'tv') &&
        data?.recentlyAddedShows &&
        data.recentlyAddedShows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wider text-white flex items-center uppercase">
                <Tv className="w-4 h-4 mr-2 text-accent" /> Recently Added TV Series
              </h2>
              <button
                onClick={() => {
                  try { uiSound.play('click'); } catch {}
                  onNavigate('tv');
                }}
                className="text-xs text-accent hover:underline font-semibold flex items-center space-x-1"
              >
                <span>View TV Shows</span>
                <span>▶</span>
              </button>
            </div>

            <div className={`grid ${getGridColsClass()}`}>
              {data.recentlyAddedShows.slice(0, prefs.density === 'compact' ? 12 : 8).map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    onNavigate('tv');
                  }}
                  className="group relative bg-[#12151b] border border-[#242a36] hover:border-accent rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="aspect-[2/3] bg-[#181c24] relative overflow-hidden">
                    {s.posterUrl ? (
                      <img
                        src={s.posterUrl}
                        alt={s.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#9ca3af]">
                        <Tv className="w-8 h-8" />
                      </div>
                    )}

                    {/* Season Badge */}
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/80 border border-white/10 text-white text-[10px] font-bold">
                      {s.seasonCount} {s.seasonCount === 1 ? 'Season' : 'Seasons'}
                    </div>

                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="font-bold text-xs text-white truncate" title={s.title}>
                      {s.title}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] mt-0.5">
                      {s.year ? `${s.year} · Television` : 'TV Series'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* 8. Music Studio & Cassette Jukebox Section */}
      {prefs.widgets.music_jukebox &&
        (prefs.categoryFilter === 'all' || prefs.categoryFilter === 'music') &&
        data?.recentlyPlayedMusic &&
        data.recentlyPlayedMusic.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-wider text-white flex items-center uppercase">
                  <Music className="w-4 h-4 mr-2 text-accent" /> Music Studio & Cassette Jukebox
                </h2>
                <span className="hidden sm:inline px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent text-[10px] font-bold">
                  Gapless Dual-Deck
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handlePlayCassetteMix}
                  className="flex items-center space-x-1.5 px-3 py-1 rounded-md bg-accent/20 hover:bg-accent text-accent hover:text-white border border-accent/40 text-xs font-bold transition-all"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play Mix</span>
                </button>
                <button
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    onNavigate('music');
                  }}
                  className="text-xs text-accent hover:underline font-semibold"
                >
                  Open Studio ▶
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.recentlyPlayedMusic.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    playTrack(t, data.recentlyPlayedMusic);
                  }}
                  className="flex items-center space-x-3 p-3 rounded-xl bg-[#12151b] border border-[#242a36] hover:border-accent hover:bg-[#181c24] cursor-pointer transition-all group"
                >
                  {/* Artwork / Cassette Cover */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#181c24] flex-shrink-0 border border-[#242a36]">
                    {t.artworkUrl ? (
                      <img src={t.artworkUrl} alt={t.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-accent font-black text-sm">
                        ♪
                      </div>
                    )}
                    {/* Hover Cassette Play Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-4 h-4 fill-white text-white" />
                    </div>
                  </div>

                  <div className="overflow-hidden flex-1">
                    <div className="font-bold text-xs text-white truncate group-hover:text-accent transition-colors">
                      {t.title}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] truncate mt-0.5">
                      {t.artistName || 'Unknown Artist'}
                    </div>
                  </div>

                  {/* Audio Format Pill */}
                  <div className="text-[10px] font-mono font-bold text-[#6b7280] group-hover:text-accent px-1.5 py-0.5 rounded bg-black/40 border border-[#242a36] flex-shrink-0">
                    {t.audioFormat || 'HI-FI'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* 9. Storage Usage & Allocation Widget */}
      {prefs.widgets.storage_usage && data?.storageUsage && (
        <div className="bg-[#12151b] border border-[#242a36] rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center uppercase tracking-wider">
                <HardDrive className="w-4 h-4 mr-2 text-accent" /> Storage Allocation & System Health
              </h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Local disk space utilized by your library media
              </p>
            </div>
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#181c24] border border-[#242a36] text-xs font-mono font-bold text-white">
              <span className="text-[#9ca3af]">Total:</span>
              <span className="text-accent">{formatBytes(data.storageUsage.totalSizeBytes)}</span>
            </div>
          </div>

          {/* Multi-Segment Color Storage Bar */}
          <div className="w-full h-3 rounded-full bg-[#181c24] overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${moviePct}%` }}
              title={`Movies: ${formatBytes(data.storageUsage.moviesSizeBytes)} (${moviePct}%)`}
              className="h-full bg-cyan-500 transition-all duration-500"
            />
            <div
              style={{ width: `${tvPct}%` }}
              title={`TV Shows: ${formatBytes(data.storageUsage.tvShowsSizeBytes)} (${tvPct}%)`}
              className="h-full bg-indigo-500 transition-all duration-500"
            />
            <div
              style={{ width: `${musicPct}%` }}
              title={`Music: ${formatBytes(data.storageUsage.musicSizeBytes)} (${musicPct}%)`}
              className="h-full bg-emerald-500 transition-all duration-500"
            />
          </div>

          {/* Storage Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-[#181c24] rounded-xl border border-[#242a36]/80 flex flex-col justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 flex-shrink-0" />
                <span className="text-[11px] text-[#9ca3af] uppercase font-bold">Movies</span>
              </div>
              <div className="text-sm font-bold text-white mt-1.5 font-mono">
                {formatBytes(data.storageUsage.moviesSizeBytes)}
              </div>
            </div>

            <div className="p-3 bg-[#181c24] rounded-xl border border-[#242a36]/80 flex flex-col justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
                <span className="text-[11px] text-[#9ca3af] uppercase font-bold">TV Shows</span>
              </div>
              <div className="text-sm font-bold text-white mt-1.5 font-mono">
                {formatBytes(data.storageUsage.tvShowsSizeBytes)}
              </div>
            </div>

            <div className="p-3 bg-[#181c24] rounded-xl border border-[#242a36]/80 flex flex-col justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-[11px] text-[#9ca3af] uppercase font-bold">Hi-Fi Music</span>
              </div>
              <div className="text-sm font-bold text-white mt-1.5 font-mono">
                {formatBytes(data.storageUsage.musicSizeBytes)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. Surprise Me / Media Roulette Picker Modal */}
      {roulettePick && (
        <Modal
          isOpen={isRouletteOpen}
          onClose={() => setIsRouletteOpen(false)}
          title="🎲 Universe Media Roulette"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-[#181c24] relative border border-[#242a36]">
              {roulettePick.backdropUrl || roulettePick.posterUrl ? (
                <img
                  src={roulettePick.backdropUrl || roulettePick.posterUrl}
                  alt={roulettePick.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#9ca3af]">
                  <Film className="w-12 h-12" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-xl font-black text-white">{roulettePick.title}</div>
                <div className="text-xs text-[#d1d5db] mt-1 flex items-center space-x-2">
                  <span>{roulettePick.year || 'Movie'}</span>
                  {roulettePick.communityRating && (
                    <>
                      <span>•</span>
                      <span className="text-amber-400 font-bold flex items-center">
                        <Star className="w-3 h-3 fill-amber-400 mr-1" />
                        {roulettePick.communityRating.toFixed(1)}
                      </span>
                    </>
                  )}
                  {roulettePick.runtimeMinutes && (
                    <>
                      <span>•</span>
                      <span>{roulettePick.runtimeMinutes} mins</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {roulettePick.overview && (
              <p className="text-xs text-[#9ca3af] line-clamp-3">{roulettePick.overview}</p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#242a36]">
              <button
                onClick={handleTriggerRoulette}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#181c24] hover:bg-[#242a36] text-xs font-semibold text-[#d1d5db] hover:text-white transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5 text-accent" />
                <span>Roll Again</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsRouletteOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#9ca3af] hover:text-white"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setIsRouletteOpen(false);
                    const fileId = roulettePick.editions?.[0]?.mediaFileId || roulettePick.mediaFileId;
                    if (fileId) {
                      openVideoPlayer(fileId);
                    } else {
                      onNavigate('cinema');
                    }
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Watch Now</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 11. Upgraded Customize Dashboard Modal */}
      <Modal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        title="Customize Dashboard & View Options"
        maxWidth="max-w-xl"
      >
        <div className="space-y-6">
          {/* Layout Density Controls */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Layout Density
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'cinematic', label: 'Cinematic', desc: 'Spacious posters' },
                  { id: 'standard', label: 'Standard', desc: 'Balanced layout' },
                  { id: 'compact', label: 'Compact', desc: 'Dense grid' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    updatePrefs((p) => ({ ...p, density: mode.id }));
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    prefs.density === mode.id
                      ? 'bg-accent/15 border-accent text-white'
                      : 'bg-[#181c24] border-[#242a36] text-[#9ca3af] hover:border-accent/40'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{mode.label}</div>
                  <div className="text-[10px] text-[#9ca3af] mt-0.5">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Hero Spotlight Billboard Display Mode */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Hero Spotlight Banner
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'cinematic', label: 'Cinematic Full', desc: 'Large billboard' },
                  { id: 'compact', label: 'Compact Banner', desc: 'Sleek banner' },
                  { id: 'hidden', label: 'Disabled', desc: 'Hide hero' },
                ] as const
              ).map((hm) => (
                <button
                  key={hm.id}
                  onClick={() => {
                    try { uiSound.play('click'); } catch {}
                    updatePrefs((p) => ({ ...p, heroMode: hm.id }));
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    prefs.heroMode === hm.id
                      ? 'bg-accent/15 border-accent text-white'
                      : 'bg-[#181c24] border-[#242a36] text-[#9ca3af] hover:border-accent/40'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{hm.label}</div>
                  <div className="text-[10px] text-[#9ca3af] mt-0.5">{hm.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Continue Watching Style Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Continue Watching Card Presentation
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  try { uiSound.play('click'); } catch {}
                  updatePrefs((p) => ({ ...p, continueWatchingStyle: 'backdrop' }));
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  prefs.continueWatchingStyle === 'backdrop'
                    ? 'bg-accent/15 border-accent text-white'
                    : 'bg-[#181c24] border-[#242a36] text-[#9ca3af] hover:border-accent/40'
                }`}
              >
                <div className="text-xs font-bold text-white">16:9 Widescreen Backdrop</div>
                <div className="text-[10px] text-[#9ca3af] mt-0.5">Video snapshot with progress</div>
              </button>
              <button
                onClick={() => {
                  try { uiSound.play('click'); } catch {}
                  updatePrefs((p) => ({ ...p, continueWatchingStyle: 'poster' }));
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  prefs.continueWatchingStyle === 'poster'
                    ? 'bg-accent/15 border-accent text-white'
                    : 'bg-[#181c24] border-[#242a36] text-[#9ca3af] hover:border-accent/40'
                }`}
              >
                <div className="text-xs font-bold text-white">2:3 Portrait Poster</div>
                <div className="text-[10px] text-[#9ca3af] mt-0.5">Theatrical poster cards</div>
              </button>
            </div>
          </div>

          {/* Section Visibility Toggles */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Visible Sections & Modules
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {(
                [
                  { key: 'hero', label: 'Hero Spotlight Carousel' },
                  { key: 'stats', label: 'Quick Universe Statistics' },
                  { key: 'quick_actions', label: 'Universe Launchpad Bar' },
                  { key: 'continue_watching', label: 'Continue Watching' },
                  { key: 'recent_movies', label: 'Recently Added Movies' },
                  { key: 'recent_shows', label: 'Recently Added TV Series' },
                  { key: 'music_jukebox', label: 'Music Studio & Cassette Jukebox' },
                  { key: 'storage_usage', label: 'Storage Allocation & Disk Health' },
                ] as const
              ).map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#181c24] border border-[#242a36] hover:border-accent/40 cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-white">{label}</span>
                  <input
                    type="checkbox"
                    checked={prefs.widgets[key]}
                    onChange={(e) => {
                      try { uiSound.play('click'); } catch {}
                      updatePrefs((p) => ({
                        ...p,
                        widgets: { ...p.widgets, [key]: e.target.checked },
                      }));
                    }}
                    className="w-4 h-4 rounded text-accent accent-accent focus:ring-0 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#242a36]">
            <button
              onClick={() => {
                try { uiSound.play('click'); } catch {}
                updatePrefs(() => DEFAULT_PREFERENCES);
              }}
              className="text-xs text-[#9ca3af] hover:text-white transition-colors"
            >
              Reset to Defaults
            </button>

            <button
              onClick={() => {
                try { uiSound.play('click'); } catch {}
                setIsCustomizeOpen(false);
              }}
              className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Apply & Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
