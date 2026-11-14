import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignJustify,
  ArrowDown,
  ArrowUp,
  Disc,
  Heart,
  LayoutGrid,
  List,
  ListMusic,
  Loader2,
  Mic2,
  Music,
  Play,
  RotateCw,
  Search,
  Shuffle,
  Sliders,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { AlbumDto, ArtistDto, TrackDto } from '../types';

type TrackViewMode = 'table' | 'compact' | 'grid';

export const MusicPage: React.FC = () => {
  const { playTrack, setIsEqualizerOpen, activeTrack, isPlaying, queue } = usePlayer();

  const [activeTab, setActiveTab] = useState<'tracks' | 'albums' | 'artists'>('tracks');
  const [tracks, setTracks] = useState<TrackDto[]>([]);
  const [albums, setAlbums] = useState<AlbumDto[]>([]);
  const [artists, setArtists] = useState<ArtistDto[]>([]);
  const [totalTrackCount, setTotalTrackCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Listing View Mode: Detailed Table, Compact Rows, or Card Grid
  const [viewMode, setViewMode] = useState<TrackViewMode>(() => {
    return (localStorage.getItem('vistara_music_view_mode') as TrackViewMode) || 'table';
  });

  const handleViewModeChange = (mode: TrackViewMode) => {
    setViewMode(mode);
    localStorage.setItem('vistara_music_view_mode', mode);
  };

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album' | 'duration'>('title');
  const [sortDesc, setSortDesc] = useState(false);

  // Selected album details view
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumDto | null>(null);

  // Auto-Fetch Hi-Res Album Cover Art state
  const [isFetchingCovers, setIsFetchingCovers] = useState(false);
  const [coverStatusMsg, setCoverStatusMsg] = useState<string | null>(null);

  const handleAutoFetchCovers = async () => {
    setIsFetchingCovers(true);
    setCoverStatusMsg('Fetching highest-resolution (up to 3000x3000) album cover art...');
    try {
      const res = await apiRequest<{ totalProcessed: number; updatedCount: number; failedCount: number }>(
        '/api/v1/music/albums/auto-fetch-artwork',
        { method: 'POST' }
      );
      if (res.success && res.data) {
        setCoverStatusMsg(
          res.data.updatedCount > 0
            ? `Imported ${res.data.updatedCount} hi-res album covers!`
            : 'All available album covers are already up to date.'
        );
        await fetchMusic();
      } else {
        setCoverStatusMsg('Failed to fetch album covers.');
      }
    } catch {
      setCoverStatusMsg('Network error while fetching album covers.');
    } finally {
      setIsFetchingCovers(false);
      setTimeout(() => setCoverStatusMsg(null), 5000);
    }
  };

  const fetchMusic = async () => {
    setLoading(true);
    try {
      if (activeTab === 'tracks') {
        // Fetch up to 5000 tracks so the entire collection (all 405+ files) is loaded
        const res = await apiRequest<{ items: TrackDto[]; totalCount: number }>(
          '/api/v1/music/tracks?pageSize=5000'
        );
        if (res.success && res.data) {
          setTracks(res.data.items);
          setTotalTrackCount(res.data.totalCount);
        }
      } else if (activeTab === 'albums') {
        const res = await apiRequest<AlbumDto[]>('/api/v1/music/albums');
        if (res.success && res.data) setAlbums(res.data);
      } else if (activeTab === 'artists') {
        const res = await apiRequest<ArtistDto[]>('/api/v1/music/artists');
        if (res.success && res.data) setArtists(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMusic();
  }, [activeTab]);

  const openAlbumDetails = async (albumId: string) => {
    const res = await apiRequest<AlbumDto>(`/api/v1/music/albums/${albumId}`);
    if (res.success && res.data) {
      setSelectedAlbum(res.data);
    }
  };

  const formatDuration = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Filtered & sorted tracks
  const processedTracks = useMemo(() => {
    let result = [...tracks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.artistName && t.artistName.toLowerCase().includes(q)) ||
          (t.albumTitle && t.albumTitle.toLowerCase().includes(q)) ||
          (t.genre && t.genre.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'artist':
          cmp = (a.artistName || '').localeCompare(b.artistName || '');
          break;
        case 'album':
          cmp = (a.albumTitle || '').localeCompare(b.albumTitle || '');
          break;
        case 'duration':
          cmp = (a.durationSeconds || 0) - (b.durationSeconds || 0);
          break;
        case 'title':
        default:
          cmp = (a.title || '').localeCompare(b.title || '');
          break;
      }
      return sortDesc ? -cmp : cmp;
    });

    return result;
  }, [tracks, searchQuery, sortBy, sortDesc]);

  // Filtered albums
  const processedAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albums;
    const q = searchQuery.toLowerCase().trim();
    return albums.filter(
      (a) =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.artistName && a.artistName.toLowerCase().includes(q))
    );
  }, [albums, searchQuery]);

  // Filtered artists
  const processedArtists = useMemo(() => {
    if (!searchQuery.trim()) return artists;
    const q = searchQuery.toLowerCase().trim();
    return artists.filter((a) => a.name && a.name.toLowerCase().includes(q));
  }, [artists, searchQuery]);

  const handleSort = (field: 'title' | 'artist' | 'album' | 'duration') => {
    if (sortBy === field) {
      setSortDesc((prev) => !prev);
    } else {
      setSortBy(field);
      setSortDesc(false);
    }
  };

  const handlePlayAll = () => {
    if (processedTracks.length > 0) {
      playTrack(processedTracks[0], processedTracks);
    }
  };

  const handleShuffleAll = () => {
    if (processedTracks.length > 0) {
      const shuffled = [...processedTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#242a36] pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold tracking-wide text-white uppercase">Music Studio</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent font-semibold">
              {totalTrackCount || tracks.length} Tracks
            </span>
          </div>
          <p className="text-xs text-[#9ca3af] mt-0.5">High-fidelity local audio universe</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Real-time Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-60 pl-8 pr-7 py-1.5 rounded-lg bg-[#141B25] border border-white/[0.08] text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-accent transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Auto Fetch Hi-Res Album Covers Button */}
          <button
            onClick={handleAutoFetchCovers}
            disabled={isFetchingCovers}
            title="Auto-import highest possible resolution album & track cover art"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-accent transition-colors cursor-pointer disabled:opacity-50"
          >
            {isFetchingCovers ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-accent" />
            )}
            <span>{isFetchingCovers ? 'Importing Covers...' : 'Auto Covers'}</span>
          </button>

          {/* Equalizer Button */}
          <button
            onClick={() => setIsEqualizerOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-[#F8FAFC] transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-accent" />
            <span>Equalizer</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchMusic}
            title="Refresh tracks"
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
          </button>

          {/* Tab buttons */}
          <div className="flex bg-[#141B25] border border-white/[0.08] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => {
                setActiveTab('tracks');
                setSelectedAlbum(null);
              }}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeTab === 'tracks'
                  ? 'bg-accent text-[#0F141B] font-extrabold shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Tracks ({tracks.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('albums');
                setSelectedAlbum(null);
              }}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeTab === 'albums'
                  ? 'bg-accent text-[#0F141B] font-extrabold shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Albums {albums.length > 0 && `(${albums.length})`}
            </button>
            <button
              onClick={() => {
                setActiveTab('artists');
                setSelectedAlbum(null);
              }}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeTab === 'artists'
                  ? 'bg-accent text-[#0F141B] font-extrabold shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Artists {artists.length > 0 && `(${artists.length})`}
            </button>
          </div>
        </div>
      </div>

      {coverStatusMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-[#161D27] border border-accent/40 text-accent text-xs font-semibold flex items-center space-x-2">
          {isFetchingCovers && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{coverStatusMsg}</span>
        </div>
      )}

      {/* Album Details View */}
      {selectedAlbum ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <button
            onClick={() => setSelectedAlbum(null)}
            className="text-xs font-bold text-[#9ca3af] hover:text-white cursor-pointer flex items-center space-x-1"
          >
            <span>← Back to Albums</span>
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 bg-[#12151b] border border-[#242a36] rounded-xl p-6">
            <div className="w-36 h-36 rounded-lg bg-[#181c24] border border-[#242a36] overflow-hidden flex-shrink-0 shadow-lg">
              {selectedAlbum.artworkUrl ? (
                <img
                  src={selectedAlbum.artworkUrl}
                  alt={selectedAlbum.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-accent text-2xl font-bold">
                  ♪
                </div>
              )}
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <span className="text-[10px] uppercase font-bold text-accent tracking-wider">
                Album
              </span>
              <h2 className="text-2xl font-black text-white">{selectedAlbum.title}</h2>
              <div className="text-xs text-[#9ca3af]">
                <span className="font-bold text-white">{selectedAlbum.artistName}</span> •{' '}
                {selectedAlbum.releaseYear || 'Unknown Year'} • {selectedAlbum.tracks.length} tracks
              </div>
              <div className="flex items-center justify-center sm:justify-start space-x-3 pt-2">
                <button
                  onClick={() =>
                    selectedAlbum.tracks.length > 0 &&
                    playTrack(selectedAlbum.tracks[0], selectedAlbum.tracks)
                  }
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-transform hover:scale-105 shadow-md cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Play Album</span>
                </button>
                <button
                  onClick={() => {
                    const shuffled = [...selectedAlbum.tracks].sort(() => Math.random() - 0.5);
                    if (shuffled.length > 0) playTrack(shuffled[0], shuffled);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-[#181c24] hover:bg-[#202634] text-[#d1d5db] text-xs font-semibold border border-[#242a36] cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5 text-accent" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tracks inside album */}
          <div className="bg-[#12151b] border border-[#242a36] rounded-xl overflow-hidden divide-y divide-[#1e2533]">
            {selectedAlbum.tracks.map((t, i) => (
              <div
                key={t.id}
                onClick={() => playTrack(t, selectedAlbum.tracks)}
                className="flex items-center justify-between px-4 py-3 hover:bg-[#181c24] cursor-pointer text-xs transition-colors group"
              >
                <div className="flex items-center space-x-4">
                  <span className="w-6 text-center text-[#9ca3af] font-mono">
                    {t.trackNumber || i + 1}
                  </span>
                  <div>
                    <div className="font-bold text-white group-hover:text-accent transition-colors">
                      {t.title}
                    </div>
                    <div className="text-[11px] text-[#9ca3af]">{selectedAlbum.artistName}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-[#9ca3af] font-mono">
                  <span>{formatDuration(t.durationSeconds)}</span>
                  <Play className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'tracks' ? (
        /* ============================================================= */
        /* TAB 1: ALL TRACKS TABLE                                       */
        /* ============================================================= */
        <div className="space-y-3">
          {/* Play All / Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePlayAll}
                disabled={processedTracks.length === 0}
                className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-[#10151B] text-xs font-extrabold shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-[#10151B]" />
                <span>Play All ({processedTracks.length})</span>
              </button>
              <button
                onClick={handleShuffleAll}
                disabled={processedTracks.length === 0}
                className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-[#151A21] hover:bg-[#1B222B] text-[#F4F7F8] text-xs font-semibold border border-[#242A36] shadow-sm cursor-pointer transition-colors disabled:opacity-50"
              >
                <Shuffle className="w-3.5 h-3.5 text-accent" />
                <span>Shuffle</span>
              </button>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3.5">
              {/* Listing View Mode Switcher */}
              <div className="flex items-center p-0.5 rounded-lg bg-[#151A21] border border-[#242A36] shadow-sm">
                <button
                  onClick={() => handleViewModeChange('table')}
                  title="Detailed Table View"
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-accent text-[#10151B] font-extrabold shadow-sm'
                      : 'text-[#8D9AA8] hover:text-[#F4F7F8] hover:bg-[#1B222B]'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('compact')}
                  title="Compact List View"
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'compact'
                      ? 'bg-accent text-[#10151B] font-extrabold shadow-sm'
                      : 'text-[#8D9AA8] hover:text-[#F4F7F8] hover:bg-[#1B222B]'
                  }`}
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Compact</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('grid')}
                  title="Card Grid View"
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-accent text-[#10151B] font-extrabold shadow-sm'
                      : 'text-[#8D9AA8] hover:text-[#F4F7F8] hover:bg-[#1B222B]'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
              </div>

              <div className="text-xs font-mono text-[#9ca3af] whitespace-nowrap">
                {searchQuery ? (
                  <span>
                    Found <span className="text-white font-bold">{processedTracks.length}</span> of{' '}
                    {tracks.length}
                  </span>
                ) : (
                  <span>
                    Showing all <span className="text-white font-bold">{tracks.length}</span> tracks
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Body Content based on View Mode */}
          {loading && tracks.length === 0 ? (
            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-12 text-center text-xs text-[#9ca3af] space-y-2 shadow-xl">
              <RotateCw className="w-6 h-6 text-accent animate-spin mx-auto" />
              <p>Loading your audio library...</p>
            </div>
          ) : processedTracks.length === 0 ? (
            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-12 text-center text-xs text-[#6b7280] space-y-2 shadow-xl">
              <Music className="w-8 h-8 text-[#4b5563] mx-auto" />
              <p className="text-white font-semibold">
                {searchQuery ? `No tracks matching "${searchQuery}"` : 'No tracks found in library'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-accent hover:underline text-xs cursor-pointer"
                >
                  Clear search filter
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ============================================================= */
            /* VIEW MODE: CARD GRID                                          */
            /* ============================================================= */
            <div className="space-y-3">
              {/* Quick Sort Bar for Grid Mode */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#12151b] border border-[#242a36] rounded-lg text-xs text-[#9ca3af]">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">Sort:</span>
                  {(['title', 'artist', 'album', 'duration'] as const).map((field) => (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        sortBy === field
                          ? 'bg-accent/20 text-accent font-bold border border-accent/40'
                          : 'hover:text-white hover:bg-[#181c24]'
                      }`}
                    >
                      <span className="capitalize">{field}</span>
                      {sortBy === field &&
                        (sortDesc ? (
                          <ArrowDown className="w-3 h-3 text-accent" />
                        ) : (
                          <ArrowUp className="w-3 h-3 text-accent" />
                        ))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Cards Container */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 max-h-[72vh] overflow-y-auto pr-1 pb-4">
                {processedTracks.map((t, idx) => {
                  const isCurrent = activeTrack?.id === t.id;
                  return (
                    <div
                      key={t.id || idx}
                      onClick={() => playTrack(t, processedTracks)}
                      className={`vistara-card stagger-item group bg-[#12151b] border rounded-xl p-3 flex flex-col justify-between cursor-pointer ${
                        isCurrent
                          ? 'border-accent bg-accent/10 shadow-md ring-1 ring-accent/40'
                          : 'border-[#242a36] hover:border-accent/40 hover:bg-[#181c24]'
                      }`}
                    >
                      {/* Album Art Square Container */}
                      <div className="aspect-square w-full rounded-lg bg-[#181c24] border border-[#242a36] overflow-hidden relative mb-2.5 flex items-center justify-center shadow-inner">
                        {t.artworkUrl ? (
                          <img
                            src={t.artworkUrl}
                            alt={t.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-accent/60 bg-[#161a22]">
                            <Disc className="w-10 h-10 group-hover:rotate-45 transition-transform duration-500" />
                          </div>
                        )}

                        {/* Top-Left Index Pill */}
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-gray-300 border border-white/10">
                          #{idx + 1}
                        </div>

                        {/* Bottom-Left Duration Pill */}
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-gray-200 border border-white/10">
                          {formatDuration(t.durationSeconds)}
                        </div>

                        {/* Play / EQ Indicator Button Overlay */}
                        <div
                          className={`absolute bottom-2 right-2 w-9 h-9 rounded-full bg-accent text-white shadow-md flex items-center justify-center transition-all duration-200 ${
                            isCurrent && isPlaying
                              ? 'opacity-100 scale-100'
                              : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 hover:scale-110 active:scale-95'
                          }`}
                        >
                          {isCurrent && isPlaying ? (
                            <span className="flex items-end space-x-0.5 h-3 justify-center">
                              <span className="w-0.5 bg-white rounded-full animate-eq-bar-1" />
                              <span className="w-0.5 bg-white rounded-full animate-eq-bar-2" />
                              <span className="w-0.5 bg-white rounded-full animate-eq-bar-3" />
                            </span>
                          ) : (
                            <Play className="w-4 h-4 fill-white translate-x-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Track Details */}
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold truncate transition-colors ${
                            isCurrent ? 'text-accent' : 'text-white group-hover:text-accent'
                          }`}
                          title={t.title}
                        >
                          {t.title}
                        </p>
                        <p className="text-[11px] text-[#9ca3af] truncate mt-0.5" title={t.artistName}>
                          {t.artistName || 'Unknown Artist'}
                        </p>
                        {t.albumTitle && (
                          <p className="text-[10px] text-[#6b7280] truncate mt-0.5" title={t.albumTitle}>
                            {t.albumTitle}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === 'compact' ? (
            /* ============================================================= */
            /* VIEW MODE: COMPACT ROWS                                       */
            /* ============================================================= */
            <div className="bg-[#12151b] border border-[#242a36] rounded-xl overflow-hidden shadow-xl">
              {/* Compact Table Header */}
              <div className="grid grid-cols-12 px-3 py-1.5 bg-[#161a22] border-b border-[#242a36] text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] select-none">
                <div
                  onClick={() => handleSort('title')}
                  className="col-span-6 flex items-center space-x-1 cursor-pointer hover:text-white"
                >
                  <span>Title</span>
                  {sortBy === 'title' &&
                    (sortDesc ? (
                      <ArrowDown className="w-3 h-3 text-accent" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-accent" />
                    ))}
                </div>
                <div
                  onClick={() => handleSort('artist')}
                  className="col-span-3 flex items-center space-x-1 cursor-pointer hover:text-white"
                >
                  <span>Artist</span>
                  {sortBy === 'artist' &&
                    (sortDesc ? (
                      <ArrowDown className="w-3 h-3 text-accent" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-accent" />
                    ))}
                </div>
                <div
                  onClick={() => handleSort('album')}
                  className="col-span-2 flex items-center space-x-1 cursor-pointer hover:text-white"
                >
                  <span>Album</span>
                  {sortBy === 'album' &&
                    (sortDesc ? (
                      <ArrowDown className="w-3 h-3 text-accent" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-accent" />
                    ))}
                </div>
                <div
                  onClick={() => handleSort('duration')}
                  className="col-span-1 flex items-center justify-end space-x-1 cursor-pointer hover:text-white text-right"
                >
                  <span>Time</span>
                  {sortBy === 'duration' &&
                    (sortDesc ? (
                      <ArrowDown className="w-3 h-3 text-accent" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-accent" />
                    ))}
                </div>
              </div>

              {/* Compact Rows */}
              <div className="divide-y divide-[#181d28] max-h-[72vh] overflow-y-auto">
                {processedTracks.map((t, idx) => {
                  const isCurrent = activeTrack?.id === t.id;
                  return (
                    <div
                      key={t.id || idx}
                      onClick={() => playTrack(t, processedTracks)}
                      className={`grid grid-cols-12 px-3 py-1.5 items-center hover:bg-[#181c26] cursor-pointer text-[11px] transition-colors group ${
                        isCurrent
                          ? 'bg-accent/15 border-l-2 border-accent text-white font-medium shadow-sm'
                          : ''
                      }`}
                    >
                      {/* Title & Micro Artwork */}
                      <div className="col-span-6 flex items-center space-x-2.5 truncate pr-2">
                        <span className="w-5 text-center font-mono text-[10px] text-[#6b7280] group-hover:hidden flex items-center justify-center">
                          {isCurrent ? (
                            isPlaying ? (
                              <span className="flex items-end space-x-0.5 h-2.5 justify-center">
                                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-1" />
                                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-2" />
                                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-3" />
                              </span>
                            ) : (
                              <Play className="w-2.5 h-2.5 fill-accent text-accent inline" />
                            )
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <span className="w-5 text-center hidden group-hover:inline">
                          <Play className="w-2.5 h-2.5 fill-accent text-accent inline" />
                        </span>

                        {t.artworkUrl ? (
                          <img
                            src={t.artworkUrl}
                            alt={t.title}
                            className="w-5 h-5 rounded object-cover flex-shrink-0 bg-[#0e1118] border border-[#202736]"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded bg-[#181c24] flex items-center justify-center text-accent text-[9px] font-bold flex-shrink-0 border border-[#202736]">
                            ♪
                          </div>
                        )}
                        <span
                          className={`truncate transition-colors ${
                            isCurrent ? 'text-accent font-bold' : 'text-white group-hover:text-accent'
                          }`}
                        >
                          {t.title}
                        </span>
                      </div>

                      {/* Artist */}
                      <div className="col-span-3 text-[#9ca3af] truncate pr-2 group-hover:text-gray-300 transition-colors">
                        {t.artistName || 'Unknown Artist'}
                      </div>

                      {/* Album */}
                      <div className="col-span-2 text-[#6b7280] truncate pr-2 group-hover:text-gray-300 transition-colors">
                        {t.albumTitle || 'Unknown Album'}
                      </div>

                      {/* Duration */}
                      <div className="col-span-1 text-right text-[#9ca3af] font-mono text-[10px]">
                        {formatDuration(t.durationSeconds)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ============================================================= */
            /* VIEW MODE: DETAILED TABLE (DEFAULT)                           */
            /* ============================================================= */
            <div className="bg-[#12151b] border border-[#242a36] rounded-xl overflow-hidden shadow-xl">
              {/* Detailed Table Header */}
              <div className="grid grid-cols-12 px-4 py-2.5 bg-[#161a22] border-b border-[#242a36] text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] select-none">
                <div
                  onClick={() => handleSort('title')}
                  className="col-span-6 flex items-center space-x-1 cursor-pointer hover:text-white"
                >
                  <span>Title</span>
                  {sortBy === 'title' &&
                    (sortDesc ? (
                      <ArrowDown className="w-3 h-3 text-accent" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-accent" />
                    ))}
                </div>
                <div
                  onClick={() => handleSort('artist')}
                  className="col-span-3 flex items-center space-x-1 cursor-pointer hover:text-white"
                >
                  <span>Artist</span>
                  {sortBy === 'artist' &&
                    (sortDesc ? (
                      <ArrowDown className="w-3 h-3 text-accent" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-accent" />
                    ))}
                </div>
                <div
                  onClick={() => handleSort('album')}
                  className="col-span-2 flex items-center space-x-1 cursor-pointer hover:text-white"
                >
                  <span>Album</span>
                  {sortBy === 'album' &&
                    (sortDesc ? (
                      <ArrowDown className="w-3 h-3 text-accent" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-accent" />
                    ))}
                </div>
                <div
                  onClick={() => handleSort('duration')}
                  className="col-span-1 flex items-center justify-end space-x-1 cursor-pointer hover:text-white text-right"
                >
                  <span>Time</span>
                  {sortBy === 'duration' &&
                    (sortDesc ? (
                      <ArrowDown className="w-3 h-3 text-accent" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-accent" />
                    ))}
                </div>
              </div>

              {/* Detailed Rows */}
              <div className="divide-y divide-[#181d28] max-h-[72vh] overflow-y-auto">
                {processedTracks.map((t, idx) => {
                  const isCurrent = activeTrack?.id === t.id;
                  return (
                    <div
                      key={t.id || idx}
                      onClick={() => playTrack(t, processedTracks)}
                      className={`grid grid-cols-12 px-4 py-2.5 items-center hover:bg-[#181c26] hover:translate-x-1 cursor-pointer text-xs transition-all duration-200 group ${
                        isCurrent
                          ? 'bg-accent/15 border-l-2 border-accent text-white shadow-sm'
                          : ''
                      }`}
                    >
                      {/* Title & Artwork */}
                      <div className="col-span-6 flex items-center space-x-3 truncate pr-2">
                        <span className="w-5 text-center font-mono text-[10px] text-[#6b7280] group-hover:hidden flex items-center justify-center">
                          {isCurrent ? (
                            isPlaying ? (
                              <span className="flex items-end space-x-0.5 h-3 justify-center">
                                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-1" />
                                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-2" />
                                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-3" />
                              </span>
                            ) : (
                              <Play className="w-3 h-3 fill-accent text-accent inline" />
                            )
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <span className="w-5 text-center hidden group-hover:inline">
                          <Play className="w-3 h-3 fill-accent text-accent inline" />
                        </span>

                        {t.artworkUrl ? (
                          <img
                            src={t.artworkUrl}
                            alt={t.title}
                            className={`w-8 h-8 rounded object-cover flex-shrink-0 bg-[#0e1118] border border-[#202736] group-hover:scale-105 transition-transform duration-200 ${
                              isCurrent && isPlaying ? 'shadow-[0_0_8px_rgba(56, 189, 248,0.4)] border-accent/40' : ''
                            }`}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-[#181c24] flex items-center justify-center text-accent text-xs font-bold flex-shrink-0 border border-[#202736] group-hover:scale-105 transition-transform duration-200">
                            ♪
                          </div>
                        )}
                        <span
                          className={`font-medium truncate transition-colors ${
                            isCurrent ? 'text-accent font-bold' : 'text-white group-hover:text-accent'
                          }`}
                        >
                          {t.title}
                        </span>
                      </div>

                      {/* Artist */}
                      <div className="col-span-3 text-[#9ca3af] truncate pr-2 group-hover:text-gray-300 transition-colors">
                        {t.artistName || 'Unknown Artist'}
                      </div>

                      {/* Album */}
                      <div className="col-span-2 text-[#9ca3af] truncate pr-2 group-hover:text-gray-300 transition-colors">
                        {t.albumTitle || 'Unknown Album'}
                      </div>

                      {/* Duration */}
                      <div className="col-span-1 text-right text-[#9ca3af] font-mono">
                        {formatDuration(t.durationSeconds)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'albums' ? (
        /* ============================================================= */
        /* TAB 2: ALBUMS GRID                                            */
        /* ============================================================= */
        <div className="space-y-4">
          <div className="text-xs font-mono text-[#9ca3af]">
            Showing <span className="text-white font-bold">{processedAlbums.length}</span> albums
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
            {processedAlbums.map((album) => (
              <div
                key={album.id}
                onClick={() => openAlbumDetails(album.id)}
                className="vistara-card stagger-item group bg-[#12151b] border border-[#242a36] hover:border-accent/70 rounded-xl p-3 cursor-pointer shadow-md"
              >
                <div className="aspect-square bg-[#181c24] rounded-lg overflow-hidden relative mb-2.5 shadow-inner">
                  {album.artworkUrl ? (
                    <img
                      src={album.artworkUrl}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-accent text-3xl font-bold group-hover:scale-105 transition-transform duration-300">
                      ♪
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200 backdrop-blur-[1px]">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-200">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="font-bold text-xs text-white truncate group-hover:text-accent transition-colors">
                  {album.title}
                </div>
                <div className="text-[11px] text-[#9ca3af] truncate mt-0.5">{album.artistName}</div>
                {album.totalTracks !== undefined && album.totalTracks > 0 && (
                  <div className="text-[10px] text-[#6b7280] font-mono mt-0.5">
                    {album.totalTracks} {album.totalTracks === 1 ? 'track' : 'tracks'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ============================================================= */
        /* TAB 3: ARTISTS GRID                                           */
        /* ============================================================= */
        <div className="space-y-4">
          <div className="text-xs font-mono text-[#9ca3af]">
            Showing <span className="text-white font-bold">{processedArtists.length}</span> artists
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
            {processedArtists.map((artist) => (
              <div
                key={artist.id}
                className="vistara-card stagger-item bg-[#12151b] border border-[#242a36] hover:border-accent rounded-xl p-4 text-center cursor-pointer group shadow-md"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-[#181c24] border border-[#242a36] overflow-hidden flex items-center justify-center mb-3 shadow-inner">
                  {artist.artworkUrl ? (
                    <img
                      src={artist.artworkUrl}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-[#9ca3af]" />
                  )}
                </div>
                <div className="font-bold text-xs text-white truncate group-hover:text-accent transition-colors">
                  {artist.name}
                </div>
                <div className="text-[11px] text-[#9ca3af] mt-0.5">
                  {artist.albumCount} {artist.albumCount === 1 ? 'album' : 'albums'} ·{' '}
                  {artist.trackCount} {artist.trackCount === 1 ? 'track' : 'tracks'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
