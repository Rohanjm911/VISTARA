import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlignLeft,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FastForward,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Play,
  RefreshCw,
  Search,
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
  EpisodeDto,
  ImportPosterRequestDto,
  PosterSearchResultDto,
  TVShowDetailsDto,
  TVShowDto,
} from '../types';
import { uiSound } from '../utils/uiSound';

export const TvShowsPage: React.FC = () => {
  const { openVideoPlayer } = usePlayer();

  const [shows, setShows] = useState<TVShowDto[]>([]);
  const [selectedShow, setSelectedShow] = useState<TVShowDetailsDto | null>(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(1);
  const [loading, setLoading] = useState(true);

  // Poster Management State
  const [posterTargetShow, setPosterTargetShow] = useState<TVShowDto | null>(null);
  const [posterTab, setPosterTab] = useState<'search' | 'upload' | 'url'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PosterSearchResultDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isApplyingPoster, setIsApplyingPoster] = useState(false);
  const [updateMetadataWithPoster, setUpdateMetadataWithPoster] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [customPosterUrl, setCustomPosterUrl] = useState('');

  // Auto-Fetch State
  const [autoFetchingShowId, setAutoFetchingShowId] = useState<string | null>(null);
  const [isAutoFetchingAll, setIsAutoFetchingAll] = useState(false);
  const [autoFetchResult, setAutoFetchResult] = useState<AutoFetchAllResultDto | null>(null);

  const fetchShows = async () => {
    setLoading(true);
    const res = await apiRequest<{ items: TVShowDto[]; totalCount: number }>('/api/v1/shows?pageSize=100');
    if (res.success && res.data) {
      setShows(res.data.items);
    }
    setLoading(false);
  };

  const openShowDetails = async (showId: string) => {
    try { uiSound.play('click'); } catch {}
    const res = await apiRequest<TVShowDetailsDto>(`/api/v1/shows/${showId}`);
    if (res.success && res.data) {
      const showData = res.data;
      setSelectedShow(showData);
      if (showData.seasons.length > 0) {
        setSelectedSeasonNumber(showData.seasons[0].seasonNumber);
      }
      // If overview or poster is missing, auto-fetch online in background as long as connected to internet!
      if (!showData.overview || !showData.posterUrl) {
        handleAutoFetchSingle(null, showData);
      }
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  // Open Poster Picker Modal
  const openPosterPicker = (e: React.MouseEvent | null, show: TVShowDto) => {
    if (e) e.stopPropagation();
    try { uiSound.play('modalOpen'); } catch {}
    setPosterTargetShow(show);
    setPosterTab('search');
    setSearchResults([]);
    setUploadedFile(null);
    setUploadPreview(null);
    setCustomPosterUrl('');

    // Pre-populate search query with clean title
    const raw = show.title || '';
    const clean = raw
      .replace(/\[.*?\]|\(.*?\)/g, ' ')
      .replace(/^\s*\d+[\s\.\-_]+/, '')
      .replace(/\b(1080p|720p|bluray|x264|60fps|remux)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    setSearchQuery(clean || raw);
    executeOnlineSearch(show.showId, clean || raw);
  };

  // Perform Online Search
  const executeOnlineSearch = async (showId: string, queryStr: string) => {
    if (!queryStr.trim()) return;
    setIsSearching(true);
    const res = await apiRequest<PosterSearchResultDto[]>(
      `/api/v1/shows/${showId}/poster-search?query=${encodeURIComponent(queryStr.trim())}`
    );
    if (res.success && res.data) {
      setSearchResults(res.data);
    } else {
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  // 1-Click Auto Fetch Single Show Poster & Metadata
  const handleAutoFetchSingle = async (e: React.MouseEvent | null, show: TVShowDto) => {
    if (e) e.stopPropagation();
    try { uiSound.play('click'); } catch {}
    setAutoFetchingShowId(show.showId);

    const res = await apiRequest<TVShowDto>(`/api/v1/shows/${show.showId}/auto-fetch-poster`, {
      method: 'POST',
    });

    if (res.success && res.data) {
      try { uiSound.play('success'); } catch {}
      const updated = res.data;
      setShows((prev) => prev.map((s) => (s.showId === updated.showId || s.id === updated.id ? { ...s, ...updated } : s)));
      if (selectedShow?.showId === updated.showId || selectedShow?.id === updated.id) {
        setSelectedShow((prev) => (prev ? { ...prev, ...updated } : prev));
      }
    }
    setAutoFetchingShowId(null);
  };

  // Bulk Auto Fetch All TV Shows
  const handleAutoFetchAllTv = async () => {
    try { uiSound.play('click'); } catch {}
    setIsAutoFetchingAll(true);

    const res = await apiRequest<AutoFetchAllResultDto>('/api/v1/shows/auto-fetch-all-posters', {
      method: 'POST',
    });

    setIsAutoFetchingAll(false);
    if (res.success && res.data) {
      try { uiSound.play('success'); } catch {}
      setAutoFetchResult(res.data);
      fetchShows();
      if (selectedShow) {
        openShowDetails(selectedShow.showId);
      }
    }
  };

  // Apply Selected Online Poster
  const handleSelectOnlinePoster = async (item: PosterSearchResultDto) => {
    if (!posterTargetShow) return;
    setIsApplyingPoster(true);
    try { uiSound.play('click'); } catch {}

    const payload: ImportPosterRequestDto = {
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl,
      updateMetadata: updateMetadataWithPoster,
      cleanedTitle: item.title,
      year: item.year ? parseInt(item.year.split('–')[0].split('-')[0]) : undefined,
      overview: item.overview,
      director: item.director,
      cast: item.cast,
      communityRating: item.rating,
      genres: item.genres,
    };

    const res = await apiRequest<TVShowDto>(
      `/api/v1/shows/${posterTargetShow.showId}/import-poster-url`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (res.success && res.data) {
      try { uiSound.play('success'); } catch {}
      const updated = res.data;
      setShows((prev) => prev.map((s) => (s.showId === updated.showId || s.id === updated.id ? { ...s, ...updated } : s)));
      if (selectedShow?.showId === updated.showId || selectedShow?.id === updated.id) {
        setSelectedShow((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      setPosterTargetShow(null);
    }
    setIsApplyingPoster(false);
  };

  // Handle Local File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUploadedPoster = async () => {
    if (!posterTargetShow || !uploadedFile) return;
    setIsApplyingPoster(true);
    try { uiSound.play('click'); } catch {}

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const res = await fetch(`/api/v1/shows/${posterTargetShow.showId}/upload-poster`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data) {
        try { uiSound.play('success'); } catch {}
        const updated = data.data as TVShowDto;
        setShows((prev) => prev.map((s) => (s.showId === updated.showId || s.id === updated.id ? { ...s, ...updated } : s)));
        if (selectedShow?.showId === updated.showId || selectedShow?.id === updated.id) {
          setSelectedShow((prev) => (prev ? { ...prev, ...updated } : prev));
        }
        setPosterTargetShow(null);
      }
    } catch {}
    setIsApplyingPoster(false);
  };

  // Handle Direct Image URL
  const handleApplyCustomUrl = async () => {
    if (!posterTargetShow || !customPosterUrl.trim()) return;
    setIsApplyingPoster(true);
    try { uiSound.play('click'); } catch {}

    const payload: ImportPosterRequestDto = {
      posterUrl: customPosterUrl.trim(),
      updateMetadata: false,
    };

    const res = await apiRequest<TVShowDto>(
      `/api/v1/shows/${posterTargetShow.showId}/import-poster-url`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (res.success && res.data) {
      try { uiSound.play('success'); } catch {}
      const updated = res.data;
      setShows((prev) => prev.map((s) => (s.showId === updated.showId || s.id === updated.id ? { ...s, ...updated } : s)));
      if (selectedShow?.showId === updated.showId || selectedShow?.id === updated.id) {
        setSelectedShow((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      setPosterTargetShow(null);
    }
    setIsApplyingPoster(false);
  };

  const currentSeason = selectedShow?.seasons.find((s) => s.seasonNumber === selectedSeasonNumber);

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 select-none">
      {/* If a show is selected, show full season & episode browser */}
      {selectedShow ? (
        <div className="space-y-6">
          {/* Back button */}
          <button
            onClick={() => setSelectedShow(null)}
            className="flex items-center space-x-2 text-xs font-bold text-[#9ca3af] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Series List</span>
          </button>

          {/* Show Banner / Hero */}
          <div className="relative rounded-2xl border border-[#242a36] bg-[#12151b] overflow-hidden p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:gap-8 shadow-2xl">
            {selectedShow.backdropUrl && (
              <img
                src={selectedShow.backdropUrl}
                alt={selectedShow.title}
                className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
              />
            )}

            {/* Poster Column with Actions */}
            <div className="w-44 sm:w-52 flex-shrink-0 space-y-2.5 relative z-10">
              <div className="aspect-[2/3] bg-[#181c24] rounded-xl border border-[#242a36] shadow-xl overflow-hidden relative group">
                {selectedShow.posterUrl ? (
                  <img
                    key={selectedShow.posterUrl}
                    src={selectedShow.posterUrl}
                    alt={selectedShow.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#9ca3af] p-3 text-center bg-[#181c24]">
                    <Tv className="w-12 h-12 mb-2 text-[#4b5563]" />
                    <span className="text-xs font-medium">No poster available</span>
                  </div>
                )}

                {/* Click to Change Poster Overlay */}
                <div
                  onClick={(e) => openPosterPicker(e, selectedShow)}
                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity backdrop-blur-[2px]"
                >
                  <ImageIcon className="w-6 h-6 mb-1 text-accent" />
                  <span className="text-[11px] font-bold">Change Poster</span>
                </div>
              </div>

              {/* Poster Management Buttons */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={(e) => openPosterPicker(e, selectedShow)}
                  className="flex-1 flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#181c24] hover:bg-[#242a36] border border-[#242a36] text-[11px] font-semibold text-[#d1d5db] hover:text-white transition-colors"
                >
                  <ImageIcon className="w-3 h-3 text-accent" />
                  <span>Import</span>
                </button>

                <button
                  onClick={(e) => handleAutoFetchSingle(e, selectedShow)}
                  disabled={autoFetchingShowId === selectedShow.showId}
                  title="1-Click Auto Fetch from OMDB / Cinemeta"
                  className="flex-1 flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400 transition-colors"
                >
                  {autoFetchingShowId === selectedShow.showId ? (
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

            {/* Show Metadata & Synopsis */}
            <div className="relative z-10 flex-1 space-y-3.5">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent font-bold text-[10px] uppercase tracking-wider">
                  {selectedShow.status || 'Television Series'}
                </span>
                {selectedShow.communityRating && (
                  <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-amber-400 font-bold text-[11px] flex items-center space-x-1">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{selectedShow.communityRating.toFixed(1)}</span>
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-wide">{selectedShow.title}</h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[#9ca3af]">
                {selectedShow.year && (
                  <span className="flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1" /> {selectedShow.year}
                  </span>
                )}
                {selectedShow.network && <span>• Network: {selectedShow.network}</span>}
                <span>• {selectedShow.seasonCount} Seasons</span>
                <span>• {selectedShow.episodeCount} Episodes</span>
              </div>

              {/* Plot Overview */}
              <div className="space-y-1.5 pt-1 max-w-3xl">
                <div className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center space-x-1.5">
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Series Synopsis</span>
                </div>
                {selectedShow.overview ? (
                  <p className="text-xs sm:text-sm text-[#d1d5db] leading-relaxed">
                    {selectedShow.overview}
                  </p>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#181c24] border border-[#242a36]">
                    <span className="text-xs text-[#9ca3af] italic">
                      {autoFetchingShowId === selectedShow.showId ? 'Fetching series description online...' : 'No synopsis available for this title.'}
                    </span>
                    <button
                      onClick={(e) => handleAutoFetchSingle(e, selectedShow)}
                      disabled={autoFetchingShowId === selectedShow.showId}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-xs font-semibold transition-colors"
                    >
                      {autoFetchingShowId === selectedShow.showId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3" />
                      )}
                      <span>Auto-Fetch</span>
                    </button>
                  </div>
                )}
              </div>

              {selectedShow.cast && (
                <div className="text-xs text-[#9ca3af] pt-1">
                  <span className="font-bold text-white">Cast:</span> {selectedShow.cast}
                </div>
              )}
            </div>
          </div>

          {/* Season Selector Tabs */}
          <div className="flex items-center space-x-2 border-b border-[#242a36] pb-2 overflow-x-auto">
            {selectedShow.seasons.map((season) => (
              <button
                key={season.id}
                onClick={() => setSelectedSeasonNumber(season.seasonNumber)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  selectedSeasonNumber === season.seasonNumber
                    ? 'bg-accent text-white shadow-md'
                    : 'bg-[#181c24] text-[#9ca3af] hover:text-white hover:bg-[#242a36]'
                }`}
              >
                {season.title || `Season ${season.seasonNumber}`}
              </button>
            ))}
          </div>

          {/* Episodes List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Season {selectedSeasonNumber} Episodes ({currentSeason?.episodes.length || 0})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentSeason?.episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => openVideoPlayer(ep.mediaFileId)}
                  className="flex items-center space-x-4 p-3 rounded-xl bg-[#12151b] border border-[#242a36] hover:border-accent cursor-pointer transition-colors group"
                >
                  <div className="w-32 aspect-video bg-[#181c24] rounded-lg border border-[#242a36] flex-shrink-0 relative overflow-hidden">
                    {ep.stillUrl ? (
                      <img src={ep.stillUrl} alt={ep.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#9ca3af]">
                        <Tv className="w-5 h-5" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-6 h-6 fill-white text-white" />
                    </div>

                    {ep.progress && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#242a36]">
                        <div
                          style={{ width: `${ep.progress.percentageWatched}%` }}
                          className="h-full bg-accent"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-accent font-bold">
                        EPISODE {ep.episodeNumber}
                      </span>
                      {ep.progress?.isCompleted && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <div className="font-bold text-xs text-white truncate group-hover:text-accent transition-colors">
                      {ep.title}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] line-clamp-2">
                      {ep.overview || 'No synopsis available'}
                    </div>
                    {ep.introStartSeconds !== undefined && ep.introEndSeconds !== undefined && (
                      <div className="flex items-center text-[10px] text-accent font-mono">
                        <FastForward className="w-3 h-3 mr-1" /> Skip intro available
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Series Grid Overview */
        <div className="space-y-6">
          <div className="border-b border-[#242a36] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-wide text-white uppercase">Television & Web Series Universe</h1>
              <p className="text-xs text-[#9ca3af]">{shows.length} series in library</p>
            </div>

            {/* Bulk Action Buttons */}
            <div className="flex items-center space-x-2.5">
              <button
                onClick={handleAutoFetchAllTv}
                disabled={isAutoFetchingAll || shows.length === 0}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all shadow-sm active:scale-98 disabled:opacity-50"
              >
                {isAutoFetchingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Auto-Fetching Series...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>⚡ Auto Fetch TV Posters</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {shows.length === 0 && !loading ? (
            <div className="py-16 text-center text-[#9ca3af] space-y-3">
              <Tv className="w-12 h-12 mx-auto text-[#6b7280]" />
              <div className="text-sm font-bold text-white">No Television Shows in Library</div>
              <p className="text-xs max-w-sm mx-auto">
                Add a TV series folder in Libraries to automatically identify seasons and episodes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {shows.map((show) => (
                <div
                  key={show.id}
                  onClick={() => openShowDetails(show.showId)}
                  className="group relative bg-[#12151b] border border-[#242a36] hover:border-accent rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="aspect-[2/3] bg-[#181c24] relative overflow-hidden">
                    {show.posterUrl ? (
                      <img
                        key={show.posterUrl}
                        src={show.posterUrl}
                        alt={show.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#9ca3af]">
                        <Tv className="w-8 h-8" />
                      </div>
                    )}

                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white border border-[#242a36]">
                      {show.seasonCount} Seasons
                    </div>

                    {/* Hover Quick Action Buttons */}
                    <div className="absolute top-2 left-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button
                        title="Import / Change Poster"
                        onClick={(e) => openPosterPicker(e, show)}
                        className="w-7 h-7 rounded-lg bg-black/80 hover:bg-accent text-white flex items-center justify-center border border-white/20 transition-all shadow-md backdrop-blur-sm"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title="1-Click Auto Fetch from Online"
                        disabled={autoFetchingShowId === show.showId}
                        onClick={(e) => handleAutoFetchSingle(e, show)}
                        className="w-7 h-7 rounded-lg bg-black/80 hover:bg-emerald-500 text-white flex items-center justify-center border border-white/20 transition-all shadow-md backdrop-blur-sm"
                      >
                        {autoFetchingShowId === show.showId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5 text-emerald-400 hover:text-white" />
                        )}
                      </button>
                    </div>

                    {/* Play Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="font-bold text-xs text-white truncate" title={show.title}>
                      {show.title}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] mt-0.5 flex justify-between items-center">
                      <span>{show.year || 'TV Series'}</span>
                      <span>{show.episodeCount} eps</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Poster Management Modal (3-Tab: Online Suggestions, Upload File, Image URL) */}
      {posterTargetShow && (
        <Modal
          isOpen={!!posterTargetShow}
          onClose={() => setPosterTargetShow(null)}
          title={`Poster & Metadata: ${posterTargetShow.title}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5">
            {/* 3 Tabs */}
            <div className="flex border-b border-[#242a36]">
              <button
                onClick={() => setPosterTab('search')}
                className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  posterTab === 'search'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-[#9ca3af] hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Online Suggestions</span>
              </button>

              <button
                onClick={() => setPosterTab('upload')}
                className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  posterTab === 'upload'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-[#9ca3af] hover:text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload File</span>
              </button>

              <button
                onClick={() => setPosterTab('url')}
                className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  posterTab === 'url'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-[#9ca3af] hover:text-white'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                <span>Image Link</span>
              </button>
            </div>

            {/* Tab 1: Online Search & Suggestions */}
            {posterTab === 'search' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && executeOnlineSearch(posterTargetShow.showId, searchQuery)}
                      placeholder="Search series title (e.g. Dexter, Loki)..."
                      className="w-full bg-[#181c24] border border-[#242a36] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-[#6b7280] focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    onClick={() => executeOnlineSearch(posterTargetShow.showId, searchQuery)}
                    disabled={isSearching}
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </button>
                </div>

                <label className="flex items-center space-x-2 text-xs text-[#9ca3af] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateMetadataWithPoster}
                    onChange={(e) => setUpdateMetadataWithPoster(e.target.checked)}
                    className="accent-accent rounded"
                  />
                  <span>Also sync title, synopsis, year, and rating from match</span>
                </label>

                {isSearching ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2 text-[#9ca3af]">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    <span className="text-xs">Searching online databases...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                    {searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectOnlinePoster(item)}
                        className="group relative bg-[#181c24] border border-[#242a36] hover:border-accent rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-102 flex flex-col"
                      >
                        <div className="aspect-[2/3] bg-black/40 relative overflow-hidden">
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="px-2.5 py-1 rounded-full bg-accent text-white text-[10px] font-bold shadow-md">
                              Apply Poster
                            </span>
                          </div>
                        </div>
                        <div className="p-2 space-y-0.5">
                          <div className="text-xs font-bold text-white truncate" title={item.title}>
                            {item.title}
                          </div>
                          <div className="text-[10px] text-[#9ca3af] flex justify-between">
                            <span>{item.year || 'Series'}</span>
                            {item.rating && <span className="text-amber-400 font-bold">★ {item.rating.toFixed(1)}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-[#9ca3af]">
                    No posters found. Try refining your search query above.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Upload File */}
            {posterTab === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-[#242a36] hover:border-accent rounded-2xl p-8 text-center transition-colors">
                  {uploadPreview ? (
                    <div className="space-y-3">
                      <div className="w-36 aspect-[2/3] mx-auto rounded-xl overflow-hidden border border-[#242a36] shadow-lg">
                        <img src={uploadPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-xs text-[#9ca3af]">{uploadedFile?.name}</div>
                      <button
                        onClick={() => {
                          setUploadedFile(null);
                          setUploadPreview(null);
                        }}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Remove and choose another
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer space-y-2">
                      <Upload className="w-10 h-10 text-accent mb-1" />
                      <span className="text-xs font-bold text-white">Click or drag image here</span>
                      <span className="text-[11px] text-[#6b7280]">Supports JPG, PNG, WEBP up to 10MB</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {uploadPreview && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleApplyUploadedPoster}
                      disabled={isApplyingPoster}
                      className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/80 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {isApplyingPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Uploaded Poster'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Image URL */}
            {posterTab === 'url' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white uppercase tracking-wider block">
                    Direct Image URL
                  </label>
                  <input
                    type="url"
                    value={customPosterUrl}
                    onChange={(e) => setCustomPosterUrl(e.target.value)}
                    placeholder="https://m.media-amazon.com/images/M/...jpg"
                    className="w-full bg-[#181c24] border border-[#242a36] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#6b7280] focus:outline-none focus:border-accent"
                  />
                </div>

                {customPosterUrl.trim() && (
                  <div className="space-y-3">
                    <div className="text-xs text-[#9ca3af] font-semibold">Live Preview:</div>
                    <div className="w-36 aspect-[2/3] rounded-xl overflow-hidden border border-[#242a36] shadow-lg">
                      <img
                        src={customPosterUrl.trim()}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleApplyCustomUrl}
                    disabled={isApplyingPoster || !customPosterUrl.trim()}
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/80 text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {isApplyingPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Download & Apply Poster'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Auto-Fetch Complete Notification Modal */}
      {autoFetchResult && (
        <Modal
          isOpen={!!autoFetchResult}
          onClose={() => setAutoFetchResult(null)}
          title="Auto-Fetch Completed"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">TV Series Posters & Metadata Synced</h3>
              <p className="text-xs text-[#9ca3af]">
                Successfully updated{' '}
                <span className="text-emerald-400 font-bold">{autoFetchResult.updatedCount}</span> series out of{' '}
                <span className="text-white font-bold">{autoFetchResult.totalScanned}</span> titles in library.
              </p>
            </div>

            {autoFetchResult.updatedTitles.length > 0 && (
              <div className="text-left bg-[#181c24] rounded-xl p-3 max-h-40 overflow-y-auto space-y-1 border border-[#242a36]">
                <div className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                  Updated Titles:
                </div>
                {autoFetchResult.updatedTitles.map((t, idx) => (
                  <div key={idx} className="text-xs text-[#d1d5db] flex items-center space-x-1.5 truncate">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{t}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setAutoFetchResult(null)}
              className="w-full py-2 rounded-xl bg-accent hover:bg-accent/80 text-white text-xs font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
