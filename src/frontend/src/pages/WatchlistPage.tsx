import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { MovieDto, TVShowDto } from '../types';
import { Bookmark, Film, Tv, Play, Trash2, Star, Calendar } from 'lucide-react';

export const WatchlistPage: React.FC = () => {
  const { openVideoPlayer } = usePlayer();
  const [filter, setFilter] = useState<'all' | 'movies' | 'shows'>('all');
  const [movies, setMovies] = useState<MovieDto[]>([]);
  const [shows, setShows] = useState<TVShowDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWatchlist = async () => {
    setIsLoading(true);
    const [moviesRes, showsRes] = await Promise.all([
      apiRequest<any>('/api/v1/movies?pageSize=100'),
      apiRequest<any>('/api/v1/tvshows?pageSize=100'),
    ]);

    if (moviesRes.success && moviesRes.data?.items) {
      setMovies(moviesRes.data.items.filter((m: MovieDto) => m.isInWatchlist));
    }
    if (showsRes.success && showsRes.data?.items) {
      setShows(showsRes.data.items.filter((s: TVShowDto) => s.isInWatchlist));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleRemoveMovie = async (movieId: string) => {
    const res = await apiRequest<boolean>(`/api/v1/movies/${movieId}/watchlist`, { method: 'POST' });
    if (res.success) {
      setMovies((prev) => prev.filter((m) => m.movieId !== movieId && m.id !== movieId));
    }
  };

  const handleRemoveShow = async (showId: string) => {
    const res = await apiRequest<boolean>(`/api/v1/tvshows/${showId}/watchlist`, { method: 'POST' });
    if (res.success) {
      setShows((prev) => prev.filter((s) => s.showId !== showId && s.id !== showId));
    }
  };

  const handlePlayMovie = (movie: MovieDto) => {
    const fileId = movie.editions[0]?.mediaFileId;
    if (fileId) {
      openVideoPlayer(fileId);
    }
  };

  const totalCount =
    (filter === 'all' || filter === 'movies' ? movies.length : 0) +
    (filter === 'all' || filter === 'shows' ? shows.length : 0);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Bookmark className="w-7 h-7 text-[var(--color-accent)]" />
            Watchlist
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Keep track of movies and television series you plan to watch
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center bg-[#12151b] border border-[#242a36] rounded-lg p-1 self-start sm:self-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({movies.length + shows.length})
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
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading your watchlist...</p>
        </div>
      ) : totalCount > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {/* Movies in Watchlist */}
          {(filter === 'all' || filter === 'movies') &&
            movies.map((m) => (
              <div
                key={m.id}
                className="vistara-card stagger-item group relative bg-[#12151b] border border-[#242a36] hover:border-gray-500 rounded-xl overflow-hidden flex flex-col"
              >
                {/* Poster */}
                <div className="aspect-[2/3] bg-[#181c24] relative overflow-hidden">
                  {m.posterUrl ? (
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-gray-600">
                      <Film className="w-12 h-12 mb-2" />
                      <span className="text-xs">{m.title}</span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="bg-black/80 backdrop-blur-sm text-[10px] font-semibold text-accent uppercase tracking-wider px-2 py-0.5 rounded">
                      Movie
                    </span>
                  </div>

                  <button
                    onClick={() => handleRemoveMovie(m.id)}
                    title="Remove from watchlist"
                    className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-red-950/80 hover:text-red-400 text-gray-300 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => handlePlayMovie(m)}
                      className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white truncate" title={m.title}>
                      {m.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      {m.year && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-500" />
                          {m.year}
                        </span>
                      )}
                      {m.communityRating && (
                        <span className="flex items-center gap-1 text-amber-400 font-medium">
                          <Star className="w-3 h-3 fill-current" />
                          {m.communityRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {m.genres && m.genres.length > 0 && (
                    <div className="pt-2 text-[11px] text-gray-500 truncate">
                      {m.genres.slice(0, 2).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}

          {/* TV Shows in Watchlist */}
          {(filter === 'all' || filter === 'shows') &&
            shows.map((s) => (
              <div
                key={s.id}
                className="vistara-card stagger-item group relative bg-[#12151b] border border-[#242a36] hover:border-gray-500 rounded-xl overflow-hidden flex flex-col"
              >
                {/* Poster */}
                <div className="aspect-[2/3] bg-[#181c24] relative overflow-hidden">
                  {s.posterUrl ? (
                    <img
                      src={s.posterUrl}
                      alt={s.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-gray-600">
                      <Tv className="w-12 h-12 mb-2" />
                      <span className="text-xs">{s.title}</span>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="bg-black/80 backdrop-blur-sm text-[10px] font-semibold text-accent uppercase tracking-wider px-2 py-0.5 rounded">
                      TV Show
                    </span>
                  </div>

                  <button
                    onClick={() => handleRemoveShow(s.id)}
                    title="Remove from watchlist"
                    className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-red-950/80 hover:text-red-400 text-gray-300 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Info */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white truncate" title={s.title}>
                      {s.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      {s.year && <span>{s.year}</span>}
                      {s.seasonCount > 0 && <span>• {s.seasonCount} Seasons</span>}
                    </div>
                  </div>

                  <div className="pt-2 text-[11px] text-gray-500">
                    {s.episodeCount} Episodes
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-16 text-center text-gray-400">
          <Bookmark className="w-14 h-14 mx-auto mb-3 opacity-40 text-gray-500" />
          <h3 className="text-base font-semibold text-white">Your watchlist is empty</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
            Browse through your Cinema and TV Shows libraries and click the bookmark icon to save titles for later
          </p>
        </div>
      )}
    </div>
  );
};

