import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { Modal } from '../components/Modal';
import { PlaylistDto, TrackDto, SmartMixDto } from '../types';
import {
  ListMusic,
  Plus,
  Play,
  Trash2,
  Clock,
  ArrowLeft,
  Music,
  Film,
  Tv,
  Image as ImageIcon,
  Search,
  Sparkles,
  Flame,
  Disc,
  Compass,
  Shuffle,
} from 'lucide-react';

export const PlaylistsPage: React.FC = () => {
  const { playTrack, openVideoPlayer } = usePlayer();
  const [playlists, setPlaylists] = useState<PlaylistDto[]>([]);
  const [smartMixes, setSmartMixes] = useState<SmartMixDto[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDto | null>(null);
  const [selectedSmartMix, setSelectedSmartMix] = useState<{ mix: SmartMixDto; tracks: TrackDto[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create playlist modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPlaylistsAndMixes = async () => {
    setIsLoading(true);
    try {
      const [plRes, mixRes] = await Promise.all([
        apiRequest<PlaylistDto[]>('/api/v1/playlists'),
        apiRequest<SmartMixDto[]>('/api/v1/playlists/smart-mixes'),
      ]);

      if (plRes.success && plRes.data) {
        setPlaylists(plRes.data);
      }
      if (mixRes.success && mixRes.data) {
        setSmartMixes(mixRes.data);
      }
    } catch {}
    setIsLoading(false);
  };

  const loadPlaylistDetails = async (id: string) => {
    const res = await apiRequest<PlaylistDto>(`/api/v1/playlists/${id}`);
    if (res.success && res.data) {
      setSelectedSmartMix(null);
      setSelectedPlaylist(res.data);
    }
  };

  const loadSmartMixDetails = async (mix: SmartMixDto) => {
    const res = await apiRequest<TrackDto[]>(`/api/v1/playlists/smart-mixes/${mix.id}/tracks`);
    if (res.success && res.data) {
      setSelectedPlaylist(null);
      setSelectedSmartMix({ mix, tracks: res.data });
    }
  };

  const handlePlaySmartMix = async (mixId: string, shuffleMode = false) => {
    const res = await apiRequest<TrackDto[]>(`/api/v1/playlists/smart-mixes/${mixId}/tracks`);
    if (res.success && res.data && res.data.length > 0) {
      let queue = [...res.data];
      if (shuffleMode) {
        for (let i = queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue[i], queue[j]] = [queue[j], queue[i]];
        }
      }
      playTrack(queue[0], queue);
    }
  };

  useEffect(() => {
    fetchPlaylistsAndMixes();
  }, []);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    setIsSubmitting(true);
    const res = await apiRequest<{ id: string; name: string }>('/api/v1/playlists', {
      method: 'POST',
      body: JSON.stringify({
        name: newPlaylistName.trim(),
        description: newPlaylistDesc.trim() || undefined,
      }),
    });

    if (res.success) {
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setIsCreateOpen(false);
      await fetchPlaylistsAndMixes();
    }
    setIsSubmitting(false);
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this playlist?')) return;
    const res = await apiRequest<boolean>(`/api/v1/playlists/${id}`, { method: 'DELETE' });
    if (res.success) {
      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
      }
      await fetchPlaylistsAndMixes();
    }
  };

  const handleRemoveTrack = async (playlistId: string, trackId: string) => {
    const res = await apiRequest<boolean>(`/api/v1/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
    });
    if (res.success) {
      await loadPlaylistDetails(playlistId);
      await fetchPlaylistsAndMixes();
    }
  };

  const getMixIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flame':
        return <Flame className="w-4 h-4 text-white" />;
      case 'Disc':
        return <Disc className="w-4 h-4 text-white" />;
      case 'Compass':
        return <Compass className="w-4 h-4 text-white" />;
      case 'Shuffle':
        return <Shuffle className="w-4 h-4 text-white" />;
      case 'Sparkles':
      default:
        return <Sparkles className="w-4 h-4 text-white" />;
    }
  };

  const isAudioType = (type: any) => type === 'Track' || type === 3 || type === '3' || type === 'Music';

  const handlePlayAll = () => {
    if (!selectedPlaylist || !selectedPlaylist.items || selectedPlaylist.items.length === 0) return;

    // Filter tracks for audio player queue
    const audioItems = selectedPlaylist.items.filter((item) => isAudioType(item.type));
    if (audioItems.length > 0) {
      const tracks: TrackDto[] = audioItems.map((item) => ({
        id: item.mediaItemId,
        trackId: item.id,
        title: item.title,
        durationSeconds: item.durationSeconds,
        artworkUrl: item.artworkUrl,
        mediaFileId: item.mediaFileId,
        isFavourite: false,
      }));
      playTrack(tracks[0], tracks);
    } else {
      // If it's video items, play the first video
      const firstVideo = selectedPlaylist.items[0];
      if (firstVideo && firstVideo.mediaFileId) {
        openVideoPlayer(firstVideo.mediaFileId);
      }
    }
  };

  const handlePlayItem = (item: any) => {
    if (isAudioType(item.type)) {
      const track: TrackDto = {
        id: item.mediaItemId,
        trackId: item.id,
        title: item.title,
        durationSeconds: item.durationSeconds,
        artworkUrl: item.artworkUrl,
        mediaFileId: item.mediaFileId,
        isFavourite: false,
      };
      playTrack(track);
    } else if (item.mediaFileId) {
      openVideoPlayer(item.mediaFileId);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) return `${hours}h ${remMins}m`;
    return `${mins}m`;
  };

  const formatDurationExact = (sec: number) => {
    if (!Number.isFinite(sec) || isNaN(sec) || sec <= 0) return '0:00';
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const getItemIcon = (type: any) => {
    const t = String(type).toLowerCase();
    if (t === 'movie' || t === 'video' || t === '1') return <Film className="w-4 h-4 text-accent" />;
    if (t === 'episode' || t === 'show' || t === 'tv' || t === '2') return <Tv className="w-4 h-4 text-accent" />;
    if (t === 'photo' || t === '4') return <ImageIcon className="w-4 h-4 text-accent" />;
    return <Music className="w-4 h-4 text-accent" />;
  };

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <ListMusic className="w-7 h-7 text-[var(--color-accent)]" />
            Playlists
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Create, manage and play custom video and music collections
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Playlist
          </button>
        </div>
      </div>

      {/* Smart Mix Details View */}
      {selectedSmartMix ? (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedSmartMix(null)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to playlists & mixes
          </button>

          {/* Banner Card */}
          <div className="bg-[#12151b] border border-[#242a36] rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start shadow-sm">
            <div className="w-40 h-40 bg-[#161b26] border border-[#242a36] rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden">
              <div className="p-4 rounded-full bg-accent/20 border border-accent/30 text-accent">
                {getMixIcon(selectedSmartMix.mix.icon)}
              </div>
            </div>

              <div className="flex-1 space-y-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-accent px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/30">
                  {selectedSmartMix.mix.tagline}
                </span>
                <h2 className="text-3xl font-extrabold text-white">{selectedSmartMix.mix.name}</h2>
                <p className="text-xs text-gray-300 max-w-2xl">{selectedSmartMix.mix.description}</p>

                <div className="flex items-center gap-3 text-xs text-gray-400 pt-2 font-mono">
                  <span>{selectedSmartMix.tracks.length} tracks</span>
                  <span>•</span>
                  <span>{formatSeconds(selectedSmartMix.mix.totalDurationSeconds)}</span>
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button
                    onClick={() => playTrack(selectedSmartMix.tracks[0], selectedSmartMix.tracks)}
                    disabled={selectedSmartMix.tracks.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-accent/30 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Play Mix
                  </button>
                  <button
                    onClick={() => handlePlaySmartMix(selectedSmartMix.mix.id, true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#181c24] hover:bg-[#222834] border border-[#242a36] text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4" />
                    Shuffle
                  </button>
                </div>
              </div>
            </div>

          {/* Tracks Table */}
          <div className="bg-[#12151b] border border-[#242a36] rounded-xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#242a36] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mix Tracklist</h3>
              <span className="text-xs text-gray-400 font-mono">{selectedSmartMix.tracks.length} tracks</span>
            </div>

            <div className="divide-y divide-[#1e232d]">
              {selectedSmartMix.tracks.map((t, index) => (
                <div
                  key={t.id || index}
                  onClick={() => playTrack(t, selectedSmartMix.tracks)}
                  className="flex items-center justify-between px-6 py-3 hover:bg-[#181c24] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-xs font-mono text-gray-500 w-6 text-right">
                      {index + 1}
                    </span>
                    <div className="w-10 h-10 bg-[#181c24] border border-[#242a36] rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                      {t.artworkUrl ? (
                        <img src={t.artworkUrl} alt={t.title} className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-4 h-4 text-accent" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-accent transition-colors">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-[#9ca3af] truncate">
                        {t.artistName || 'Unknown Artist'} {t.albumTitle ? `— ${t.albumTitle}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono text-[#9ca3af]">
                    {formatDurationExact(t.durationSeconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : selectedPlaylist ? (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedPlaylist(null)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all playlists
          </button>

          {/* Banner Card */}
          <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start">
            <div className="w-44 h-44 bg-[#181c24] border border-[#242a36] rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              {selectedPlaylist.coverUrl ? (
                <img
                  src={selectedPlaylist.coverUrl}
                  alt={selectedPlaylist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ListMusic className="w-16 h-16 text-gray-600" />
              )}
            </div>

            <div className="flex-1 space-y-3">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 bg-[#181c24] px-2.5 py-1 rounded">
                Personal Playlist
              </span>
              <h2 className="text-3xl font-extrabold text-white">{selectedPlaylist.name}</h2>
              {selectedPlaylist.description && (
                <p className="text-sm text-gray-300 max-w-2xl">{selectedPlaylist.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-400 pt-2">
                <span>{selectedPlaylist.itemCount} items</span>
                <span>•</span>
                <span>{formatSeconds(selectedPlaylist.totalDurationSeconds)} total time</span>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  onClick={handlePlayAll}
                  disabled={!selectedPlaylist.items || selectedPlaylist.items.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-md text-sm font-semibold transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Play All
                </button>
                <button
                  onClick={() => handleDeletePlaylist(selectedPlaylist.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-[#181c24] hover:bg-red-950/40 hover:text-red-400 border border-[#242a36] text-gray-300 rounded-md text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Playlist
                </button>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-[#12151b] border border-[#242a36] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#242a36] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Tracks & Media Items</h3>
              <span className="text-xs text-gray-400">{selectedPlaylist.items?.length || 0} entries</span>
            </div>

            {selectedPlaylist.items && selectedPlaylist.items.length > 0 ? (
              <div className="divide-y divide-[#1e232d]">
                {selectedPlaylist.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-[#181c24] transition-colors group cursor-pointer"
                    onClick={() => handlePlayItem(item)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xs font-mono text-gray-500 w-6 text-right">
                        {index + 1}
                      </span>
                      <div className="w-10 h-10 bg-[#181c24] border border-[#242a36] rounded flex items-center justify-center shrink-0 overflow-hidden">
                        {item.artworkUrl ? (
                          <img src={item.artworkUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          getItemIcon(item.type)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate group-hover:text-[var(--color-accent)] transition-colors">
                            {item.title}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#242a36] text-gray-300 uppercase">
                            {item.type}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        {formatDurationExact(item.durationSeconds)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTrack(selectedPlaylist.id, item.id);
                        }}
                        title="Remove from playlist"
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-[#242a36] rounded transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-gray-500">
                <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">This playlist is empty</p>
                <p className="text-xs text-gray-600 mt-1">Add items from Cinema, TV, or Music to populate it</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grid of Playlists */
        <div className="space-y-8">
          {/* Smart Dynamic Mixes Section */}
          {smartMixes.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded-md bg-accent/20 border border-accent/40 text-accent">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Smart Dynamic Mixes
                    </h2>
                    <p className="text-[11px] text-[#9ca3af]">
                      Intelligent, auto-updating playlists curated directly from your media collection
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {smartMixes.map((mix) => (
                  <div
                    key={mix.id}
                    onClick={() => loadSmartMixDetails(mix)}
                    className="vistara-card stagger-item relative group rounded-xl p-4 bg-[#121620] border border-[#202737] hover:border-accent cursor-pointer flex flex-col justify-between overflow-hidden"
                  >
                    <div className="relative z-10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-xl bg-accent text-white shadow-sm">
                          {getMixIcon(mix.icon)}
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#181d2a] border border-[#262e40] text-[#9ca3af]">
                          {mix.trackCount} tracks
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-wider text-accent font-bold">
                          {mix.tagline}
                        </span>
                        <h3 className="text-sm font-bold text-white group-hover:text-accent transition-colors line-clamp-1">
                          {mix.name}
                        </h3>
                        <p className="text-[11px] text-[#9ca3af] line-clamp-2 mt-1">
                          {mix.description}
                        </p>
                      </div>
                    </div>

                    <div className="relative z-10 pt-3 mt-3 border-t border-[#1b2230] flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#6b7280]">
                        {formatSeconds(mix.totalDurationSeconds)}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaySmartMix(mix.id, true);
                          }}
                          title="Shuffle Mix"
                          className="p-1.5 rounded-lg bg-[#181d2a] hover:bg-accent text-[#9ca3af] hover:text-white transition-colors cursor-pointer"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaySmartMix(mix.id, false);
                          }}
                          title="Play Mix"
                          className="p-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Divider: Personal Playlists */}
          <div className="pt-2 flex items-center justify-between border-t border-[#1e2536]">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Personal Playlists
              </h2>
              <p className="text-[11px] text-[#9ca3af]">
                Custom video and audio collections created by you
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Filter playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#12151b] border border-[#242a36] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-gray-500">
              <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Loading playlists...</p>
            </div>
          ) : filteredPlaylists.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => loadPlaylistDetails(pl.id)}
                  className="vistara-card stagger-item bg-[#12151b] border border-[#242a36] hover:border-gray-600 rounded-xl overflow-hidden cursor-pointer group flex flex-col"
                >
                  <div className="aspect-video bg-[#181c24] relative flex items-center justify-center overflow-hidden">
                    {pl.coverUrl ? (
                      <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <ListMusic className="w-12 h-12 text-gray-600 group-hover:text-[var(--color-accent)] transition-colors" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <h3 className="text-base font-semibold text-white group-hover:text-[var(--color-accent)] transition-colors line-clamp-1">
                        {pl.name}
                      </h3>
                      {pl.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 mt-1">{pl.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-[#1e232d]">
                      <span>{pl.itemCount} items</span>
                      <span>{formatSeconds(pl.totalDurationSeconds)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-12 text-center text-gray-400">
              <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-40 text-gray-500" />
              <h3 className="text-base font-semibold text-white">No playlists found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-5">
                Organize your movies, shows, and music into personalized collections
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-md text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First Playlist
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Playlist Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Playlist">
        <form onSubmit={handleCreatePlaylist} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Playlist Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Weekend Chill, Sci-Fi Marathon"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full bg-[#181c24] border border-[#242a36] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Add an optional description for this playlist..."
              value={newPlaylistDesc}
              onChange={(e) => setNewPlaylistDesc(e.target.value)}
              className="w-full bg-[#181c24] border border-[#242a36] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 bg-[#181c24] hover:bg-[#242a36] text-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newPlaylistName.trim()}
              className="px-5 py-2 bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Playlist'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

