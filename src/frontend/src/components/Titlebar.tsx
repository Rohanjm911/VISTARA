import React, { useEffect, useRef, useState } from 'react';
import {
  Film,
  Music,
  RefreshCw,
  Search,
  Tv,
  Wand2,
  Waves,
  SlidersHorizontal,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { signalRService } from '../api/signalr';
import { usePlayer } from '../context/PlayerContext';
import { BackgroundJobDto, SearchResultDto, MovieDto, TVShowDto, TrackDto } from '../types';
import { ambientSound, AmbientPreset } from '../utils/ambientSound';
import { uiSound } from '../utils/uiSound';

interface TitlebarProps {
  onOpenWizard: () => void;
  onNavigate: (tab: any) => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({ onOpenWizard, onNavigate }) => {
  const { openVideoPlayer, playTrack } = usePlayer();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultDto | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeJobs, setActiveJobs] = useState<BackgroundJobDto[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ambient soundscape states
  const [ambientActive, setAmbientActive] = useState<boolean>(() => ambientSound.isEnabled());
  const [ambientVol, setAmbientVol] = useState<number>(() => ambientSound.getVolume());
  const [ambientPreset, setAmbientPreset] = useState<AmbientPreset>(() => ambientSound.getPreset());
  const [showAmbientMenu, setShowAmbientMenu] = useState(false);
  const ambientMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ambientMenuRef.current && !ambientMenuRef.current.contains(e.target as Node)) {
        setShowAmbientMenu(false);
      }
    };
    if (showAmbientMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showAmbientMenu]);

  const searchRef = useRef<HTMLDivElement>(null);

  // Listen to live background jobs
  useEffect(() => {
    // Initial fetch of active jobs
    apiRequest<BackgroundJobDto[]>('/api/v1/jobs').then((res) => {
      if (res.success && res.data) {
        setActiveJobs(res.data.filter((j) => j.status === 'Running' || j.status === 'Pending'));
      }
    });

    const unsubscribe = signalRService.onJobUpdated((job) => {
      setActiveJobs((prev) => {
        const filtered = prev.filter((j) => j.id !== job.id);
        if (job.status === 'Running' || job.status === 'Pending') {
          return [...filtered, job];
        }
        return filtered;
      });
    });

    return () => unsubscribe();
  }, []);

  // FTS Search debouncer
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await apiRequest<SearchResultDto>(`/api/v1/search?q=${encodeURIComponent(query)}&limit=4`);
      setIsSearching(false);
      if (res.success && res.data) {
        setResults(res.data);
        setShowDropdown(true);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Ctrl+K shortcut to focus global universe search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalResultsCount =
    (results?.movies.length || 0) +
    (results?.tvShows.length || 0) +
    (results?.tracks.length || 0) +
    (results?.photos.length || 0);

  return (
    <header className="h-14 bg-[#12161D] border-b border-[#202733] px-6 flex items-center justify-between select-none relative z-30">
      {/* Search Input with FTS5 suggestions & Ctrl+K */}
      <div className="relative w-[420px] max-w-full" ref={searchRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-[#6B7885] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results && totalResultsCount > 0 && setShowDropdown(true)}
            placeholder="Search movies, TV shows, tracks, or photos..."
            className="w-full bg-[#161B23] border border-[#242D3A] rounded-lg pl-10 pr-16 py-1.5 text-xs text-[#F4F7F8] placeholder-[#6B7885] focus:outline-none focus:border-accent transition-colors"
          />
          {isSearching ? (
            <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
          ) : (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[#1B222B] border border-[#2A3442] text-[10px] font-mono text-[#8D9AA8] pointer-events-none">
              Ctrl+K
            </kbd>
          )}
        </div>

        {/* FTS Dropdown */}
        {showDropdown && results && totalResultsCount > 0 && (
          <div className="absolute top-full left-0 mt-2 w-full bg-[#181c24] border border-[#242a36] rounded-md shadow-2xl overflow-hidden py-2 max-h-96 overflow-y-auto">
            {/* Movies */}
            {results.movies.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Movies</div>
                {results.movies.map((m: MovieDto) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setShowDropdown(false);
                      if (m.editions[0]?.mediaFileId) openVideoPlayer(m.editions[0].mediaFileId);
                      else onNavigate('cinema');
                    }}
                    className="w-full px-3 py-1.5 flex items-center hover:bg-[#1f242f] text-left text-xs transition-colors"
                  >
                    <Film className="w-3.5 h-3.5 text-accent mr-2 flex-shrink-0" />
                    <span className="truncate text-white font-medium">{m.title}</span>
                    {m.year && <span className="ml-1.5 text-[11px] text-[#9ca3af]">({m.year})</span>}
                  </button>
                ))}
              </div>
            )}

            {/* TV Shows */}
            {results.tvShows.length > 0 && (
              <div className="mt-2">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">TV Shows</div>
                {results.tvShows.map((s: TVShowDto) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setShowDropdown(false);
                      onNavigate('tv');
                    }}
                    className="w-full px-3 py-1.5 flex items-center hover:bg-[#1f242f] text-left text-xs transition-colors"
                  >
                    <Tv className="w-3.5 h-3.5 text-accent mr-2 flex-shrink-0" />
                    <span className="truncate text-white font-medium">{s.title}</span>
                    {s.year && <span className="ml-1.5 text-[11px] text-[#9ca3af]">({s.year})</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Music Tracks */}
            {results.tracks.length > 0 && (
              <div className="mt-2">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Music</div>
                {results.tracks.map((t: TrackDto) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setShowDropdown(false);
                      playTrack(t);
                    }}
                    className="w-full px-3 py-1.5 flex items-center hover:bg-[#1f242f] text-left text-xs transition-colors"
                  >
                    <Music className="w-3.5 h-3.5 text-accent mr-2 flex-shrink-0" />
                    <div className="truncate">
                      <span className="text-white font-medium">{t.title}</span>
                      {t.artistName && <span className="ml-1.5 text-[11px] text-[#9ca3af]">— {t.artistName}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Actions & Status Badges */}
      <div className="flex items-center space-x-4">
        {/* Active Jobs Pill */}
        {activeJobs.length > 0 && (
          <div
            onClick={() => onNavigate('libraries')}
            title="Active background task running"
            className="flex items-center space-x-2 bg-[#181c24] border border-accent/40 rounded-full px-3 py-1 text-xs text-white cursor-pointer hover:border-accent transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-accent animate-spin" />
            <span className="text-[11px] font-medium">{activeJobs[0]?.progressMessage || 'Processing...'}</span>
          </div>
        )}

        {/* Localhost Security Badge */}
        <div className="hidden md:flex items-center space-x-1.5 bg-[#181c24] border border-[#242a36] rounded-full px-2.5 py-1 text-[11px] text-[#9ca3af]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>127.0.0.1 (Local)</span>
        </div>

        {/* First-Run Setup Wizard Button */}
        <button
          onClick={onOpenWizard}
          title="Setup Wizard"
          className="p-1.5 rounded-md text-[#9ca3af] hover:text-white hover:bg-[#181c24] transition-colors"
        >
          <Wand2 className="w-4 h-4" />
        </button>

        {/* Soothing Ambient Soundscape Controls */}
        <div className="relative" ref={ambientMenuRef}>
          <div className="flex items-center bg-[#181c24] border border-[#242a36] rounded-md p-0.5">
            <button
              onClick={() => {
                const next = ambientSound.toggle();
                setAmbientActive(next);
              }}
              title={ambientActive ? `Ambient Sound: Active (${Math.round(ambientVol * 100)}%) — Click to mute` : 'Ambient Sound: Muted — Click to play soothing soundscape'}
              className={`p-1 rounded transition-colors flex items-center justify-center ${
                ambientActive
                  ? 'text-accent bg-accent/15'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              <Waves className={`w-3.5 h-3.5 ${ambientActive ? 'animate-pulse' : ''}`} />
            </button>
            <button
              onClick={() => setShowAmbientMenu((prev) => !prev)}
              title="Ambient Sound Settings & Palette"
              className="p-1 text-[#9ca3af] hover:text-white hover:bg-[#202530] rounded transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
            </button>
          </div>

          {/* Quick Menu Popover */}
          {showAmbientMenu && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-[#12151b] border border-[#242a36] rounded-xl shadow-2xl p-3.5 z-50 space-y-3.5 select-none">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-accent" />
                  Ambient Soundscape
                </span>
                <input
                  type="checkbox"
                  checked={ambientActive}
                  onChange={(e) => {
                    const active = e.target.checked;
                    ambientSound.setEnabled(active);
                    setAmbientActive(active);
                  }}
                  className="w-3.5 h-3.5 accent-[var(--color-accent)] cursor-pointer"
                />
              </div>

              {/* Volume Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>Volume</span>
                  <span className="font-mono text-white">{Math.round(ambientVol * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={ambientVol}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setAmbientVol(v);
                    ambientSound.setVolume(v);
                  }}
                  className="w-full h-1.5 bg-[#181c24] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                />
              </div>

              {/* Palette Selector */}
              <div className="space-y-1.5 pt-1 border-t border-[#1e232d]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Sound Palette</span>
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  {(['cosmic', 'ethereal', 'zen'] as AmbientPreset[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setAmbientPreset(p);
                        ambientSound.setPreset(p);
                      }}
                      className={`py-1 px-1.5 rounded text-center capitalize font-medium transition-colors ${
                        ambientPreset === p
                          ? 'bg-accent text-white font-bold shadow-sm'
                          : 'bg-[#181c24] text-gray-400 hover:text-white hover:bg-[#1e2430]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
