import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { MovieDto, TVShowDto, TrackDto, PhotoDto } from '../types';
import { Heart, Film, Tv, Music, Image as ImageIcon, Play, Trash2, Star, Calendar } from 'lucide-react';

export const FavouritesPage: React.FC = () => {
  const { playTrack, openVideoPlayer } = usePlayer();
  const [filter, setFilter] = useState<'all' | 'movies' | 'shows' | 'music' | 'photos'>('all');
  const [movies, setMovies] = useState<MovieDto[]>([]);
  const [shows, setShows] = useState<TVShowDto[]>([]);
  const [tracks, setTracks] = useState<TrackDto[]>([]);
  const [photos, setPhotos] = useState<PhotoDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFavourites = async () => {
    setIsLoading(true);
    const [moviesRes, showsRes, musicRes, photosRes] = await Promise.all([
      apiRequest<any>('/api/v1/movies?pageSize=1000'),
      apiRequest<any>('/api/v1/tvshows?pageSize=1000'),
      apiRequest<any>('/api/v1/music/tracks?pageSize=1000'),
      apiRequest<any>('/api/v1/gallery/photos?pageSize=1000'),
    ]);

    if (moviesRes.success && moviesRes.data?.items) {
      setMovies(moviesRes.data.items.filter((m: MovieDto) => m.isFavourite));
    }
    if (showsRes.success && showsRes.data?.items) {
      setShows(showsRes.data.items.filter((s: TVShowDto) => s.isFavourite));
    }
    if (musicRes.success && musicRes.data?.items) {
      setTracks(musicRes.data.items.filter((t: TrackDto) => t.isFavourite));
    }
    if (photosRes.success && photosRes.data?.items) {
      setPhotos(photosRes.data.items.filter((p: PhotoDto) => p.isFavourite));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchFavourites();
  }, []);

  const formatTrackDuration = (sec: number) => {
    if (!Number.isFinite(sec) || isNaN(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleMovieFav = async (id: string) => {
    const res = await apiRequest<boolean>(`/api/v1/movies/${id}/favourite`, { method: 'POST' });
    if (res.success) {
      setMovies((prev) => prev.filter((m) => m.id !== id && m.movieId !== id));
    }
  };

  const handleToggleShowFav = async (id: string) => {
    const res = await apiRequest<boolean>(`/api/v1/tvshows/${id}/favourite`, { method: 'POST' });
    if (res.success) {
      setShows((prev) => prev.filter((s) => s.id !== id && s.showId !== id));
    }
  };

  const handleToggleTrackFav = async (id: string) => {
    const res = await apiRequest<boolean>(`/api/v1/music/tracks/${id}/favourite`, { method: 'POST' });
    if (res.success) {
      setTracks((prev) => prev.filter((t) => t.id !== id && t.trackId !== id));
    }
  };

  const handleTogglePhotoFav = async (id: string) => {
    const res = await apiRequest<boolean>(`/api/v1/gallery/photos/${id}/favourite`, { method: 'POST' });
    if (res.success) {
      setPhotos((prev) => prev.filter((p) => p.id !== id && p.photoId !== id));
    }
  };

  const totalCount =
    (filter === 'all' || filter === 'movies' ? movies.length : 0) +
    (filter === 'all' || filter === 'shows' ? shows.length : 0) +
    (filter === 'all' || filter === 'music' ? tracks.length : 0) +
    (filter === 'all' || filter === 'photos' ? photos.length : 0);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Heart className="w-7 h-7 text-red-500 fill-red-500" />
            Favourites
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Your personal hand-picked library of favorite movies, shows, songs, and photos
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center bg-[#12151b] border border-[#242a36] rounded-lg p-1 self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({movies.length + shows.length + tracks.length + photos.length})
          </button>
          <button
            onClick={() => setFilter('movies')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'movies'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Movies ({movies.length})
          </button>
          <button
            onClick={() => setFilter('shows')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'shows'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            TV Shows ({shows.length})
          </button>
          <button
            onClick={() => setFilter('music')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'music'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Music ({tracks.length})
          </button>
          <button
            onClick={() => setFilter('photos')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'photos'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Photos ({photos.length})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading your favourites...</p>
        </div>
      ) : totalCount > 0 ? (
        <div className="space-y-8">
          {/* Movies Section */}
          {(filter === 'all' || filter === 'movies') && movies.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Movies ({movies.length})
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {movies.map((m) => (
                  <div
                    key={m.id}
                    className="group relative bg-[#12151b] border border-[#242a36] hover:border-gray-500 rounded-xl overflow-hidden flex flex-col transition-all duration-200"
                  >
                    <div className="aspect-[2/3] bg-[#181c24] relative overflow-hidden">
                      {m.posterUrl ? (
                        <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-gray-600">
                          <Film className="w-10 h-10 mb-2" />
                          <span className="text-xs">{m.title}</span>
                        </div>
                      )}
                      <button
                        onClick={() => handleToggleMovieFav(m.id)}
                        title="Remove favourite"
                        className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black text-red-500 rounded-md transition-colors"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => {
                            const fileId = m.editions[0]?.mediaFileId;
                            if (fileId) openVideoPlayer(fileId);
                          }}
                          className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        >
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-white truncate" title={m.title}>
                        {m.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">{m.year}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TV Shows Section */}
          {(filter === 'all' || filter === 'shows') && shows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  TV Shows ({shows.length})
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {shows.map((s) => (
                  <div
                    key={s.id}
                    className="group relative bg-[#12151b] border border-[#242a36] hover:border-gray-500 rounded-xl overflow-hidden flex flex-col transition-all duration-200"
                  >
                    <div className="aspect-[2/3] bg-[#181c24] relative overflow-hidden">
                      {s.posterUrl ? (
                        <img src={s.posterUrl} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-gray-600">
                          <Tv className="w-10 h-10 mb-2" />
                          <span className="text-xs">{s.title}</span>
                        </div>
                      )}
                      <button
                        onClick={() => handleToggleShowFav(s.id)}
                        title="Remove favourite"
                        className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black text-red-500 rounded-md transition-colors"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-white truncate" title={s.title}>
                        {s.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">{s.seasonCount} Seasons • {s.episodeCount} Episodes</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Music Tracks Section */}
          {(filter === 'all' || filter === 'music') && tracks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-[var(--color-accent)]" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Favourite Songs ({tracks.length})
                </h2>
              </div>
              <div className="bg-[#12151b] border border-[#242a36] rounded-xl overflow-hidden divide-y divide-[#1e232d]">
                {tracks.map((t, idx) => (
                  <div
                    key={t.id}
                    onClick={() => playTrack(t, tracks)}
                    className="flex items-center justify-between px-6 py-3 hover:bg-[#181c24] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xs font-mono text-gray-500 w-6 text-right">{idx + 1}</span>
                      <div className="w-10 h-10 bg-[#181c24] border border-[#242a36] rounded flex items-center justify-center shrink-0 overflow-hidden">
                        {t.artworkUrl ? (
                          <img src={t.artworkUrl} alt={t.title} className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate group-hover:text-[var(--color-accent)] transition-colors">
                          {t.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {t.artistName || 'Unknown Artist'} {t.albumTitle ? `• ${t.albumTitle}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-mono text-gray-400">
                        {formatTrackDuration(t.durationSeconds)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTrackFav(t.id);
                        }}
                        className="p-1.5 text-red-500 hover:bg-[#242a36] rounded transition-colors"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos Section */}
          {(filter === 'all' || filter === 'photos') && photos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Favourite Photos ({photos.length})
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="group relative bg-[#12151b] border border-[#242a36] hover:border-gray-500 rounded-lg overflow-hidden aspect-square transition-all"
                  >
                    <img src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleTogglePhotoFav(p.id)}
                      title="Remove favourite"
                      className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black text-red-500 rounded-md transition-colors"
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-black/70 backdrop-blur-sm text-[11px] text-white truncate">
                      {p.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-16 text-center text-gray-400">
          <Heart className="w-14 h-14 mx-auto mb-3 opacity-40 text-gray-500" />
          <h3 className="text-base font-semibold text-white">No favourites yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
            Click the heart icon on any movie, show, song, or photo to save it here for quick access
          </p>
        </div>
      )}
    </div>
  );
};

