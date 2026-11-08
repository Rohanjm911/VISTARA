import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlignLeft,
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Download,
  Film,
  Heart,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tv,
  Upload,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Modal } from '../components/Modal';
import { usePlayer } from '../context/PlayerContext';
import {
  AutoFetchAllResultDto,
  ImportPosterRequestDto,
  MovieDto,
  PagedResult,
  PosterSearchResultDto,
} from '../types';
import { uiSound } from '../utils/uiSound';

export const CinemaPage: React.FC = () => {
  const { openVideoPlayer } = usePlayer();

  const [movies, setMovies] = useState<MovieDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('title');
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Movie Details Modal
  const [selectedMovie, setSelectedMovie] = useState<MovieDto | null>(null);
  const [selectedEditionId, setSelectedEditionId] = useState<string>('');

  // Poster Picker Modal State
  const [posterTargetMovie, setPosterTargetMovie] = useState<MovieDto | null>(null);
  const [posterTab, setPosterTab] = useState<'search' | 'upload' | 'url'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PosterSearchResultDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isApplyingPoster, setIsApplyingPoster] = useState(false);
  const [updateMetadataWithPoster, setUpdateMetadataWithPoster] = useState(true);

  // Custom File Upload State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // Custom URL State
  const [customPosterUrl, setCustomPosterUrl] = useState('');

  // Bulk Auto Fetch All Posters State
  const [isBulkAutoFetching, setIsBulkAutoFetching] = useState(false);
  const [bulkFetchResult, setBulkFetchResult] = useState<AutoFetchAllResultDto | null>(null);
  const [isBulkResultModalOpen, setIsBulkResultModalOpen] = useState(false);

  // Per-movie Quick Auto Fetching IDs (for spinner feedback on cards)
  const [autoFetchingMovieId, setAutoFetchingMovieId] = useState<string | null>(null);

  const fetchMovies = async (targetPage = page, append = false) => {
    setLoading(!append);
    let url = `/api/v1/movies?page=${targetPage}&pageSize=${pageSize}&sortBy=${sortBy}&descending=${descending}`;
    if (selectedGenre) url += `&genre=${encodeURIComponent(selectedGenre)}`;
    if (selectedYear) url += `&year=${selectedYear}`;

    const res = await apiRequest<PagedResult<MovieDto>>(url);
    if (res.success && res.data) {
      if (append) {
        setMovies((prev) => [...prev, ...res.data!.items]);
      } else {
        setMovies(res.data.items);
      }
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMovies(page, false);
  }, [selectedGenre, selectedYear, sortBy, descending, page, pageSize]);

  // Client-side quick search filter
  const filteredMovies = movies.filter((m) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      (m.year && m.year.toString().includes(q)) ||
      m.genres.some((g) => g.toLowerCase().includes(q)) ||
      (m.director && m.director.toLowerCase().includes(q)) ||
      (m.cast && m.cast.toLowerCase().includes(q))
    );
  });

  const toggleFavourite = async (e: React.MouseEvent, movie: MovieDto) => {
    e.stopPropagation();
    try { uiSound.play('click'); } catch {}
    const res = await apiRequest<boolean>(`/api/v1/movies/${movie.id}/favourite`, { method: 'POST' });
    if (res.success) {
      movie.isFavourite = res.data ?? !movie.isFavourite;
      setMovies([...movies]);
      if (selectedMovie?.id === movie.id) {
        setSelectedMovie({ ...selectedMovie, isFavourite: movie.isFavourite });
      }
    }
  };

  const toggleWatchlist = async (e: React.MouseEvent, movie: MovieDto) => {
    e.stopPropagation();
    try { uiSound.play('click'); } catch {}
    const res = await apiRequest<boolean>(`/api/v1/movies/${movie.id}/watchlist`, { method: 'POST' });
    if (res.success) {
      movie.isInWatchlist = res.data ?? !movie.isInWatchlist;
      setMovies([...movies]);
      if (selectedMovie?.id === movie.id) {
        setSelectedMovie({ ...selectedMovie, isInWatchlist: movie.isInWatchlist });
      }
    }
  };

  const openMovieDetails = async (movie: MovieDto) => {
    try { uiSound.play('click'); } catch {}
    setSelectedMovie(movie);
    if (movie.editions && movie.editions.length > 0) {
      setSelectedEditionId(movie.editions[0].mediaFileId);
    }

    // Always fetch fresh details to guarantee newly imported posters and descriptions render immediately
    try {
      const res = await apiRequest<MovieDto>(`/api/v1/movies/${movie.id}`);
      if (res.success && res.data) {
        const fresh = res.data;
        setSelectedMovie(fresh);
        if (fresh.editions && fresh.editions.length > 0) {
          setSelectedEditionId((prev) => prev || fresh.editions[0].mediaFileId);
        }
        setMovies((prev) => prev.map((m) => (m.id === fresh.id ? { ...m, ...fresh } : m)));

        // If description or poster is missing, auto-fetch online in background as long as connected to internet!
        if (!fresh.overview || !fresh.posterUrl) {
          handleAutoFetchSingle(null, fresh);
        }
      }
    } catch {}
  };

  const handlePlayEdition = () => {
    const targetFileId = selectedEditionId || selectedMovie?.editions[0]?.mediaFileId;
    if (targetFileId) {
      try { uiSound.play('play'); } catch {}
      openVideoPlayer(targetFileId);
      setSelectedMovie(null);
    }
  };

  // Open Poster Picker Modal for a movie
  const openPosterPicker = (e: React.MouseEvent | null, movie: MovieDto) => {
    if (e) e.stopPropagation();
    try { uiSound.play('modalOpen'); } catch {}
    setPosterTargetMovie(movie);
    setPosterTab('search');
    setSearchResults([]);
    setUploadedFile(null);
    setUploadPreview(null);
    setCustomPosterUrl('');

    // Pre-populate search query with cleaned title
    const raw = movie.title || '';
    const clean = raw
      .replace(/\[.*?\]|\(.*?\)/g, ' ')
      .replace(/^\s*\d+[\s\.\-_]+/, '')
      .replace(/\b(1080p|720p|bluray|x264|60fps|remux)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    setSearchQuery(clean || raw);
    executeOnlineSearch(movie.id, clean || raw);
  };

  // Perform Online Search via Backend Cinemeta API
  const executeOnlineSearch = async (movieId: string, queryStr: string) => {
    if (!queryStr.trim()) return;
    setIsSearching(true);
    const res = await apiRequest<PosterSearchResultDto[]>(
      `/api/v1/movies/${movieId}/poster-search?query=${encodeURIComponent(queryStr.trim())}`
    );
    if (res.success && res.data) {
      setSearchResults(res.data);
    } else {
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  // 1-Click Auto Fetch Single Movie Poster
  const handleAutoFetchSingle = async (e: React.MouseEvent | null, movie: MovieDto) => {
    if (e) e.stopPropagation();
    try { uiSound.play('click'); } catch {}
    setAutoFetchingMovieId(movie.id);

    const res = await apiRequest<MovieDto>(`/api/v1/movies/${movie.id}/auto-fetch-poster`, {
      method: 'POST',
    });

    if (res.success && res.data) {
      try { uiSound.play('success'); } catch {}
      const updated = res.data;
      setMovies((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      if (selectedMovie?.id === updated.id) {
        setSelectedMovie((prev) => (prev ? { ...prev, ...updated } : prev));
      }
    }
    setAutoFetchingMovieId(null);
  };

  // Apply Selected Online Poster
  const handleSelectOnlinePoster = async (item: PosterSearchResultDto) => {
    if (!posterTargetMovie) return;
    setIsApplyingPoster(true);
    try { uiSound.play('click'); } catch {}

    const payload: ImportPosterRequestDto = {
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl,
      updateMetadata: updateMetadataWithPoster,
      cleanedTitle: item.title,
      year: item.year ? parseInt(item.year) : undefined,
      overview: item.overview,
      director: item.director,
      cast: item.cast,
      communityRating: item.rating,
      genres: item.genres,
    };

    const res = await apiRequest<MovieDto>(
      `/api/v1/movies/${posterTargetMovie.id}/import-poster-url`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (res.success && res.data) {
      try { uiSound.play('success'); } catch {}
      const updated = res.data;
      setMovies((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      if (selectedMovie?.id === updated.id) {
        setSelectedMovie((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      setPosterTargetMovie(null);
    }
    setIsApplyingPoster(false);
  };

  // Apply Custom Image URL
  const handleApplyCustomUrl = async () => {
    if (!posterTargetMovie || !customPosterUrl.trim()) return;
    setIsApplyingPoster(true);
    try { uiSound.play('click'); } catch {}

    const payload: ImportPosterRequestDto = {
      posterUrl: customPosterUrl.trim(),
      updateMetadata: false,
    };

    const res = await apiRequest<MovieDto>(
      `/api/v1/movies/${posterTargetMovie.id}/import-poster-url`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (res.success && res.data) {
      try { uiSound.play('success'); } catch {}
      const updated = res.data;
      setMovies((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      if (selectedMovie?.id === updated.id) {
        setSelectedMovie((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      setPosterTargetMovie(null);
    }
    setIsApplyingPoster(false);
  };

  // Upload Local File
  const handleUploadLocalPoster = async () => {
    if (!posterTargetMovie || !uploadedFile) return;
    setIsApplyingPoster(true);
    try { uiSound.play('click'); } catch {}

    const formData = new FormData();
    formData.append('file', uploadedFile);

    const res = await apiRequest<MovieDto>(
      `/api/v1/movies/${posterTargetMovie.id}/upload-poster`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (res.success && res.data) {
      try { uiSound.play('success'); } catch {}
      const updated = res.data;
      setMovies((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      if (selectedMovie?.id === updated.id) {
        setSelectedMovie((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      setPosterTargetMovie(null);
    }
    setIsApplyingPoster(false);
  };

  // Bulk Auto Fetch All Missing Posters
  const handleAutoFetchAll = async () => {
    try { uiSound.play('click'); } catch {}
    setIsBulkAutoFetching(true);

    const res = await apiRequest<AutoFetchAllResultDto>('/api/v1/movies/auto-fetch-all-posters', {
      method: 'POST',
    });

    if (res.success && res.data) {
      try { uiSound.play('success'); } catch {}
      setBulkFetchResult(res.data);
      setIsBulkResultModalOpen(true);
      fetchMovies();
    }
    setIsBulkAutoFetching(false);
  };

  const featuredMovie = movies[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-7 select-none">
      {/* 1. Featured Movie Banner */}
      {featuredMovie && !selectedGenre && !selectedYear && (
        <div className="relative rounded-2xl border border-[#242a36] bg-[#12151b] overflow-hidden p-6 sm:p-8 flex flex-col justify-end min-h-[300px] shadow-xl group">
          {featuredMovie.backdropUrl ? (
            <img
              src={featuredMovie.backdropUrl}
              alt={featuredMovie.title}
              className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-30 transition-opacity pointer-events-none"
            />
          ) : featuredMovie.posterUrl ? (
            <img
              src={featuredMovie.posterUrl}
              alt={featuredMovie.title}
              className="absolute inset-0 w-full h-full object-cover opacity-15 filter blur-sm pointer-events-none"
            />
          ) : null}

          <div className="absolute inset-0 bg-black/60 pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="px-2.5 py-1 rounded-full bg-accent/25 border border-accent/40 text-accent-light font-bold text-[10px] tracking-wider uppercase inline-flex items-center space-x-1.5 shadow-sm">
              <Sparkles className="w-3 h-3 text-accent" />
              <span>Cinema Spotlight</span>
            </span>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-wide">
              {featuredMovie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#9ca3af]">
              {featuredMovie.year && <span>{featuredMovie.year}</span>}
              {featuredMovie.runtimeMinutes && <span>{featuredMovie.runtimeMinutes} min</span>}
              {featuredMovie.communityRating && (
                <span className="flex items-center text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                  {featuredMovie.communityRating.toFixed(1)}
                </span>
              )}
              {featuredMovie.genres.length > 0 && <span>• {featuredMovie.genres.join(', ')}</span>}
            </div>

            {featuredMovie.overview && (
              <p className="text-xs text-[#d1d5db] line-clamp-2 leading-relaxed">
                {featuredMovie.overview}
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  if (featuredMovie.editions[0]?.mediaFileId) {
                    openVideoPlayer(featuredMovie.editions[0].mediaFileId);
                  } else {
                    openMovieDetails(featuredMovie);
                  }
                }}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Play Movie</span>
              </button>

              <button
                onClick={() => openMovieDetails(featuredMovie)}
                className="px-4 py-2.5 rounded-xl bg-[#181c24] border border-[#242a36] hover:border-accent text-white text-xs font-bold transition-colors"
              >
                Details & Versions
              </button>

              <button
                onClick={(e) => openPosterPicker(e, featuredMovie)}
                className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-[#181c24]/80 hover:bg-[#242a36] border border-[#242a36] hover:border-accent text-[#9ca3af] hover:text-white text-xs font-semibold transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5 text-accent" />
                <span>Change Poster</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Controls & Auto-Fetch Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#242a36] pb-4">
        <div>
          <h2 className="text-xl font-black tracking-wide text-white uppercase flex items-center space-x-2">
            <span>Cinema Universe</span>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-[#181c24] border border-[#242a36] text-accent">
              {searchFilter ? `${filteredMovies.length} of ${totalCount}` : `${totalCount} Movies`}
            </span>
          </h2>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            Theatrical feature films and video collection
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Quick Filter Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="text"
              placeholder="Filter movies..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-[#181c24] border border-[#242a36] rounded-lg pl-8 pr-7 py-1.5 text-white placeholder-[#6b7280] focus:outline-none focus:border-accent text-xs w-36 sm:w-44 transition-all"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Page Size View Selector */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="bg-[#181c24] border border-[#242a36] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-accent text-xs"
            title="Movies per page"
          >
            <option value={100}>All (100+)</option>
            <option value={200}>All (200)</option>
            <option value={48}>48 / page</option>
            <option value={24}>24 / page</option>
          </select>

          {/* Automated Poster Fetch All Button */}
          <button
            onClick={handleAutoFetchAll}
            disabled={isBulkAutoFetching}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border font-bold transition-all shadow-sm ${
              isBulkAutoFetching
                ? 'bg-accent/20 border-accent text-accent animate-pulse'
                : 'bg-emerald-500/10 hover:bg-emerald-500 border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white'
            }`}
          >
            {isBulkAutoFetching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Auto-Fetching Posters...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                <span>⚡ Auto Fetch Posters</span>
              </>
            )}
          </button>

          {/* Genre Filter */}
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="bg-[#181c24] border border-[#242a36] rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-accent text-xs"
          >
            <option value="">All Genres</option>
            <option value="Action">Action</option>
            <option value="Sci-Fi">Sci-Fi</option>
            <option value="Drama">Drama</option>
            <option value="Comedy">Comedy</option>
            <option value="Thriller">Thriller</option>
            <option value="Horror">Horror</option>
            <option value="Animation">Animation</option>
            <option value="Adventure">Adventure</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#181c24] border border-[#242a36] rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-accent text-xs"
          >
            <option value="title">Sort by Title</option>
            <option value="year">Sort by Year</option>
            <option value="rating">Sort by Rating</option>
            <option value="added">Sort by Date Added</option>
          </select>

          {/* Ascending / Descending Toggle */}
          <button
            onClick={() => setDescending(!descending)}
            className="px-3 py-1.5 bg-[#181c24] border border-[#242a36] rounded-lg text-white hover:border-accent font-mono transition-colors text-xs"
          >
            {descending ? '↓ Desc' : '↑ Asc'}
          </button>
        </div>
      </div>

      {/* 3. Movie Posters Grid */}
      {movies.length === 0 && !loading ? (
        <div className="py-16 text-center text-[#9ca3af] space-y-3">
          <Film className="w-12 h-12 mx-auto text-[#6b7280]" />
          <div className="text-sm font-bold text-white">No Movies in Library</div>
          <p className="text-xs max-w-sm mx-auto">
            Add a media folder in Libraries or run the Setup Wizard to start scanning your collection.
          </p>
        </div>
      ) : filteredMovies.length === 0 ? (
        <div className="py-16 text-center text-[#9ca3af] space-y-2">
          <Search className="w-8 h-8 mx-auto text-[#6b7280]" />
          <div className="text-sm font-bold text-white">No Movies Match Filter</div>
          <p className="text-xs text-[#9ca3af]">No titles match &ldquo;{searchFilter}&rdquo;</p>
          <button
            onClick={() => setSearchFilter('')}
            className="mt-2 text-xs text-accent hover:underline font-semibold"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {filteredMovies.map((movie) => {
            const isAutoFetchingThis = autoFetchingMovieId === movie.id;

            return (
              <div
                key={movie.id}
                onClick={() => openMovieDetails(movie)}
                className="group relative bg-[#12151b] border border-[#242a36] hover:border-accent rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1"
              >
                <div className="aspect-[2/3] bg-[#181c24] relative overflow-hidden">
                  {movie.posterUrl ? (
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#9ca3af] p-3 text-center space-y-2">
                      <Film className="w-8 h-8 text-[#6b7280]" />
                      <span className="text-[10px] text-[#6b7280] font-semibold">No Poster</span>
                    </div>
                  )}

                  {/* Badges on top left */}
                  <div className="absolute top-2 left-2 flex flex-col space-y-1 z-10">
                    {movie.editions.length > 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-accent border border-accent/40 backdrop-blur-sm">
                        {movie.editions.length} Versions
                      </span>
                    )}
                    {movie.editions[0]?.resolutionLabel && (
                      <span className="px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white border border-white/10 backdrop-blur-sm">
                        {movie.editions[0].resolutionLabel}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons on top right (Hover overlay) */}
                  <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    {/* Auto Fetch / Import Poster Quick Button */}
                    <button
                      title="Import / Change Poster"
                      onClick={(e) => openPosterPicker(e, movie)}
                      className="p-1.5 rounded-full bg-black/85 text-white hover:text-accent hover:scale-110 transition-all border border-white/10 shadow-md"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>

                    <button
                      title="⚡ Auto-Fetch Official Poster Online"
                      onClick={(e) => handleAutoFetchSingle(e, movie)}
                      disabled={isAutoFetchingThis}
                      className="p-1.5 rounded-full bg-black/85 text-emerald-400 hover:text-white hover:bg-emerald-600 hover:scale-110 transition-all border border-white/10 shadow-md"
                    >
                      {isAutoFetchingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      title={movie.isFavourite ? 'Remove from Favourites' : 'Add to Favourites'}
                      onClick={(e) => toggleFavourite(e, movie)}
                      className="p-1.5 rounded-full bg-black/85 text-white hover:text-rose-500 hover:scale-110 transition-all border border-white/10 shadow-md"
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          movie.isFavourite ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>

                    <button
                      title={movie.isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      onClick={(e) => toggleWatchlist(e, movie)}
                      className="p-1.5 rounded-full bg-black/85 text-white hover:text-accent hover:scale-110 transition-all border border-white/10 shadow-md"
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          movie.isInWatchlist ? 'fill-accent text-accent' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Hover Play Icon */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (movie.editions && movie.editions.length > 0) {
                        try { uiSound.play('play'); } catch {}
                        openVideoPlayer(movie.editions[0].mediaFileId);
                      } else {
                        openMovieDetails(movie);
                      }
                    }}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[1px]"
                    title="Play Movie"
                  >
                    <div className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Progress bar */}
                  {movie.progress && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#242a36]">
                      <div
                        style={{ width: `${movie.progress.percentageWatched}%` }}
                        className="h-full bg-accent shadow-[0_0_8px_var(--color-accent)]"
                      />
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <div className="font-bold text-xs text-white truncate" title={movie.title}>
                    {movie.title}
                  </div>
                  <div className="text-[11px] text-[#9ca3af] mt-0.5 flex justify-between items-center">
                    <span>{movie.year || 'Movie'}</span>
                    {movie.communityRating && (
                      <span className="flex items-center text-amber-400 font-bold text-[10px]">
                        ★ {movie.communityRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination / Load More Footer */}
      {!loading && movies.length > 0 && movies.length < totalCount && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 pb-2">
          <button
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchMovies(nextPage, true);
            }}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#181c24] hover:bg-accent/20 border border-[#242a36] hover:border-accent text-white font-bold text-xs transition-all shadow-md group"
          >
            <span>Load More Movies</span>
            <span className="font-mono text-accent">({movies.length} of {totalCount})</span>
            <ChevronDown className="w-3.5 h-3.5 text-accent group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* 4. Movie Details Modal with Editions & Poster Actions */}
      {selectedMovie && (
        <Modal
          isOpen={!!selectedMovie}
          onClose={() => setSelectedMovie(null)}
          title={selectedMovie.title}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Poster Column with Change Poster Button */}
              <div className="w-48 flex-shrink-0 space-y-2.5">
                <div className="aspect-[2/3] bg-[#181c24] rounded-xl border border-[#242a36] shadow-xl overflow-hidden relative group">
                  {selectedMovie.posterUrl ? (
                    <img
                      key={selectedMovie.posterUrl}
                      src={selectedMovie.posterUrl}
                      alt={selectedMovie.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#9ca3af] p-3 text-center bg-[#181c24]">
                      <Film className="w-12 h-12 mb-2 text-[#4b5563]" />
                      <span className="text-xs font-medium">No poster available</span>
                    </div>
                  )}

                  {/* Click to Change Poster Overlay */}
                  <div
                    onClick={(e) => openPosterPicker(e, selectedMovie)}
                    className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity backdrop-blur-[2px]"
                  >
                    <ImageIcon className="w-6 h-6 mb-1 text-accent" />
                    <span className="text-[11px] font-bold">Change Poster</span>
                  </div>
                </div>

                {/* Poster Management Buttons */}
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={(e) => openPosterPicker(e, selectedMovie)}
                    className="flex-1 flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#181c24] hover:bg-[#242a36] border border-[#242a36] text-[11px] font-semibold text-[#d1d5db] hover:text-white transition-colors"
                  >
                    <ImageIcon className="w-3 h-3 text-accent" />
                    <span>Import</span>
                  </button>

                  <button
                    onClick={(e) => handleAutoFetchSingle(e, selectedMovie)}
                    disabled={autoFetchingMovieId === selectedMovie.id}
                    title="1-Click Auto Fetch from Cinemeta"
                    className="flex-1 flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400 transition-colors"
                  >
                    {autoFetchingMovieId === selectedMovie.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Wand2 className="w-3 h-3" />
                        <span>Auto</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Info Details */}
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedMovie.title}</h2>
                  {selectedMovie.tagline && (
                    <p className="text-xs italic text-[#9ca3af] mt-0.5">"{selectedMovie.tagline}"</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#9ca3af]">
                  {selectedMovie.year && (
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1" /> {selectedMovie.year}
                    </span>
                  )}
                  {selectedMovie.runtimeMinutes && (
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" /> {selectedMovie.runtimeMinutes} min
                    </span>
                  )}
                  {selectedMovie.communityRating && (
                    <span className="flex items-center text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />{' '}
                      {selectedMovie.communityRating.toFixed(1)} / 10
                    </span>
                  )}
                  {selectedMovie.contentRating && (
                    <span className="px-1.5 py-0.5 rounded border border-[#242a36] font-mono">
                      {selectedMovie.contentRating}
                    </span>
                  )}
                </div>

                {selectedMovie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMovie.genres.map((g) => (
                      <span
                        key={g}
                        className="px-2 py-0.5 rounded bg-[#181c24] text-[10px] text-white border border-[#242a36]"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Plot Overview / Description */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center space-x-1.5">
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>Plot Overview</span>
                  </div>
                  {selectedMovie.overview ? (
                    <p className="text-xs sm:text-sm text-[#d1d5db] leading-relaxed max-h-36 overflow-y-auto pr-1">
                      {selectedMovie.overview}
                    </p>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#181c24] border border-[#242a36]">
                      <span className="text-xs text-[#9ca3af] italic">
                        {autoFetchingMovieId === selectedMovie.id ? 'Fetching description online...' : 'No description available for this title.'}
                      </span>
                      <button
                        onClick={(e) => handleAutoFetchSingle(e, selectedMovie)}
                        disabled={autoFetchingMovieId === selectedMovie.id}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-xs font-semibold transition-colors"
                      >
                        {autoFetchingMovieId === selectedMovie.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3" />
                        )}
                        <span>Auto-Fetch</span>
                      </button>
                    </div>
                  )}
                </div>

                {selectedMovie.director && (
                  <div className="text-xs text-[#9ca3af]">
                    <span className="font-bold text-white">Director:</span> {selectedMovie.director}
                  </div>
                )}

                {selectedMovie.cast && (
                  <div className="text-xs text-[#9ca3af] line-clamp-1">
                    <span className="font-bold text-white">Cast:</span> {selectedMovie.cast}
                  </div>
                )}
              </div>
            </div>

            {/* Multiple Editions & Versions Selector */}
            <div className="bg-[#181c24] border border-[#242a36] rounded-xl p-4 space-y-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider block">
                Select Edition / Version to Play
              </label>

              <div className="space-y-2">
                {selectedMovie.editions.map((ed) => (
                  <label
                    key={ed.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedEditionId === ed.mediaFileId
                        ? 'border-accent bg-[#12151b]'
                        : 'border-[#242a36] bg-[#181c24] hover:border-[#374151]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="movieEdition"
                        checked={selectedEditionId === ed.mediaFileId}
                        onChange={() => setSelectedEditionId(ed.mediaFileId)}
                        className="text-accent accent-accent focus:ring-0"
                      />
                      <div>
                        <div className="font-bold text-xs text-white">
                          {ed.editionName} {ed.resolutionLabel ? `(${ed.resolutionLabel})` : ''}
                        </div>
                        <div className="text-[11px] text-[#9ca3af] font-mono">
                          {ed.videoCodec ? ed.videoCodec.toUpperCase() : 'Video'} •{' '}
                          {ed.audioCodec ? ed.audioCodec.toUpperCase() : 'Audio'} •{' '}
                          {ed.containerFormat?.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <span className="text-xs text-[#9ca3af] font-mono">
                      {(ed.fileSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[#242a36]">
              <div className="flex space-x-2">
                <button
                  onClick={(e) => toggleFavourite(e, selectedMovie)}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#181c24] border border-[#242a36] text-xs font-medium text-white hover:border-accent transition-colors"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      selectedMovie.isFavourite ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                  <span>{selectedMovie.isFavourite ? 'Favourited' : 'Favourite'}</span>
                </button>

                <button
                  onClick={(e) => toggleWatchlist(e, selectedMovie)}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#181c24] border border-[#242a36] text-xs font-medium text-white hover:border-accent transition-colors"
                >
                  <Bookmark
                    className={`w-4 h-4 ${
                      selectedMovie.isInWatchlist ? 'fill-accent text-accent' : ''
                    }`}
                  />
                  <span>{selectedMovie.isInWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
                </button>
              </div>

              <button
                onClick={handlePlayEdition}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Play Selected Version</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Complete Poster Import / Selector Modal */}
      {posterTargetMovie && (
        <Modal
          isOpen={!!posterTargetMovie}
          onClose={() => setPosterTargetMovie(null)}
          title={`Change Poster — ${posterTargetMovie.title}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5">
            {/* Mode Tabs */}
            <div className="flex items-center bg-[#181c24] border border-[#242a36] rounded-xl p-1 gap-1">
              <button
                onClick={() => setPosterTab('search')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  posterTab === 'search'
                    ? 'bg-accent text-white shadow'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Online Suggestions</span>
              </button>

              <button
                onClick={() => setPosterTab('upload')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  posterTab === 'upload'
                    ? 'bg-accent text-white shadow'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>

              <button
                onClick={() => setPosterTab('url')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  posterTab === 'url'
                    ? 'bg-accent text-white shadow'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Image Link</span>
              </button>
            </div>

            {/* TAB 1: Online Search & Auto-Suggestions */}
            {posterTab === 'search' && (
              <div className="space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (posterTargetMovie) {
                      executeOnlineSearch(posterTargetMovie.id, searchQuery);
                    }
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search title (e.g. X-Men, Scott Pilgrim)..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#181c24] border border-[#242a36] text-white text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Find</span>}
                  </button>
                </form>

                {/* Metadata update checkbox */}
                <label className="flex items-center space-x-2 text-xs text-[#d1d5db] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateMetadataWithPoster}
                    onChange={(e) => setUpdateMetadataWithPoster(e.target.checked)}
                    className="rounded text-accent accent-accent focus:ring-0 cursor-pointer"
                  />
                  <span>Also update movie synopsis, release year & backdrop from online source</span>
                </label>

                {/* Search Results Grid */}
                {isSearching ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2 text-[#9ca3af]">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    <span className="text-xs">Searching global movie databases...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectOnlinePoster(item)}
                        className="group relative bg-[#181c24] border border-[#242a36] hover:border-accent rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-102 hover:shadow-lg"
                      >
                        <div className="aspect-[2/3] bg-black/40 relative">
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="px-2 py-1 rounded bg-accent text-white text-[11px] font-bold shadow">
                              Apply Poster
                            </span>
                          </div>
                        </div>

                        <div className="p-2">
                          <div className="font-bold text-xs text-white truncate" title={item.title}>
                            {item.title}
                          </div>
                          <div className="text-[10px] text-[#9ca3af] flex justify-between items-center mt-0.5">
                            <span>{item.year || ''}</span>
                            {item.imdbId && (
                              <span className="font-mono text-[9px] text-accent">{item.imdbId}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-[#9ca3af] space-y-2">
                    <Film className="w-8 h-8 mx-auto text-[#6b7280]" />
                    <div className="text-xs font-semibold text-white">No posters found for this query</div>
                    <p className="text-[11px]">
                      Try typing a simpler movie name or upload your own file.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Upload File */}
            {posterTab === 'upload' && (
              <div className="space-y-4">
                <label className="border-2 border-dashed border-[#242a36] hover:border-accent rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#181c24]/50 group">
                  <Upload className="w-8 h-8 text-[#9ca3af] group-hover:text-accent mb-2 transition-colors" />
                  <span className="text-xs font-bold text-white">
                    Click to select an image from your computer
                  </span>
                  <span className="text-[11px] text-[#9ca3af] mt-1">Supports JPG, PNG, WEBP</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadedFile(file);
                        setUploadPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                </label>

                {uploadPreview && (
                  <div className="flex items-center space-x-4 p-3 bg-[#181c24] border border-[#242a36] rounded-xl">
                    <img
                      src={uploadPreview}
                      alt="Preview"
                      className="w-16 h-24 object-cover rounded-lg border border-[#242a36]"
                    />
                    <div className="overflow-hidden flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {uploadedFile?.name}
                      </div>
                      <div className="text-[11px] text-[#9ca3af] mt-0.5">
                        {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB` : ''}
                      </div>
                    </div>
                    <button
                      onClick={handleUploadLocalPoster}
                      disabled={isApplyingPoster}
                      className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isApplyingPoster ? 'Uploading...' : 'Apply Poster'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Paste URL */}
            {posterTab === 'url' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#d1d5db] block">
                    Paste Direct Image Link (HTTP / HTTPS)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customPosterUrl}
                      onChange={(e) => setCustomPosterUrl(e.target.value)}
                      placeholder="https://example.com/movie_poster.jpg"
                      className="flex-1 px-3 py-2 rounded-xl bg-[#181c24] border border-[#242a36] text-white text-xs focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleApplyCustomUrl}
                      disabled={!customPosterUrl.trim() || isApplyingPoster}
                      className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {isApplyingPoster ? 'Saving...' : 'Apply URL'}
                    </button>
                  </div>
                </div>

                {customPosterUrl.trim() && (
                  <div className="p-3 bg-[#181c24] border border-[#242a36] rounded-xl flex items-center space-x-4">
                    <img
                      src={customPosterUrl}
                      alt="Poster Preview"
                      className="w-16 h-24 object-cover rounded-lg border border-[#242a36] bg-black/40"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '';
                      }}
                    />
                    <div className="text-xs text-[#9ca3af] flex-1">
                      Live preview of image link. Click "Apply URL" above to set this as the movie poster.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[#242a36]">
              <button
                onClick={() => setPosterTargetMovie(null)}
                className="px-4 py-2 rounded-xl bg-[#181c24] hover:bg-[#242a36] text-[#9ca3af] hover:text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. Bulk Auto-Fetch Summary Result Modal */}
      {bulkFetchResult && (
        <Modal
          isOpen={isBulkResultModalOpen}
          onClose={() => setIsBulkResultModalOpen(false)}
          title="⚡ Poster Auto-Fetch Completed"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-3">
              <Check className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-white">
                  Successfully updated {bulkFetchResult.updatedCount} movie posters!
                </div>
                <div className="text-[11px] text-emerald-400 mt-0.5">
                  Total movies scanned: {bulkFetchResult.totalScanned}
                </div>
              </div>
            </div>

            {bulkFetchResult.updatedTitles.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider block">
                  Sample Updated Titles
                </span>
                <div className="max-h-40 overflow-y-auto bg-[#181c24] border border-[#242a36] rounded-xl p-3 space-y-1 text-xs text-white font-medium">
                  {bulkFetchResult.updatedTitles.map((title, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <span className="text-accent">•</span>
                      <span className="truncate">{title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsBulkResultModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Awesome
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
