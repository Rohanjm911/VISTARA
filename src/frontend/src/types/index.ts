export type MediaType = 'Movie' | 'Episode' | 'Track' | 'Photo' | 'Video' | 'Custom';
export type LibraryType = 'Movies' | 'TVShows' | 'Music' | 'Photos' | 'Custom';
export type JobStatus = 'Pending' | 'Running' | 'Paused' | 'Completed' | 'Failed' | 'Cancelled';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestampUtc: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface LibraryFolderDto {
  id: string;
  libraryId: string;
  path: string;
  isMonitored: boolean;
  lastScannedUtc?: string;
  isAccessible: boolean;
}

export interface LibraryDto {
  id: string;
  name: string;
  type: LibraryType;
  description?: string;
  icon?: string;
  autoScanEnabled: boolean;
  scanIntervalMinutes: number;
  itemCount: number;
  totalSizeBytes: number;
  lastScannedUtc?: string;
  folders: LibraryFolderDto[];
}

export interface PlaybackProgressDto {
  mediaItemId: string;
  mediaFileId: string;
  positionSeconds: number;
  durationSeconds: number;
  percentageWatched: number;
  isCompleted: boolean;
  lastPlayedUtc?: string;
  selectedAudioStreamIndex?: number;
  selectedSubtitleStreamIndex?: number;
}

export interface MovieEditionDto {
  id: string;
  mediaFileId: string;
  editionName: string;
  resolutionLabel?: string;
  fileSizeBytes: number;
  containerFormat?: string;
  videoCodec?: string;
  audioCodec?: string;
  durationSeconds: number;
  isMissing: boolean;
}

export interface MovieDto {
  id: string;
  movieId: string;
  title: string;
  originalTitle?: string;
  year?: number;
  overview?: string;
  tagline?: string;
  runtimeMinutes?: number;
  communityRating?: number;
  contentRating?: string;
  director?: string;
  writers?: string;
  cast?: string;
  studio?: string;
  isFavourite: boolean;
  isInWatchlist: boolean;
  posterUrl?: string;
  backdropUrl?: string;
  genres: string[];
  editions: MovieEditionDto[];
  progress?: PlaybackProgressDto;
}

export interface EpisodeDto {
  id: string;
  episodeId: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  seriesTitle?: string;
  overview?: string;
  airDate?: string;
  introStartSeconds?: number;
  introEndSeconds?: number;
  creditsStartSeconds?: number;
  stillUrl?: string;
  durationSeconds: number;
  mediaFileId: string;
  progress?: PlaybackProgressDto;
}

export interface SeasonDto {
  id: string;
  tvShowId: string;
  seasonNumber: number;
  title: string;
  overview?: string;
  posterUrl?: string;
  episodes: EpisodeDto[];
}

export interface TVShowDto {
  id: string;
  showId: string;
  title: string;
  year?: number;
  overview?: string;
  network?: string;
  status?: string;
  cast?: string;
  communityRating?: number;
  isFavourite: boolean;
  isInWatchlist: boolean;
  posterUrl?: string;
  backdropUrl?: string;
  seasonCount: number;
  episodeCount: number;
}

export interface TVShowDetailsDto extends TVShowDto {
  seasons: SeasonDto[];
}

export interface TrackDto {
  id: string;
  trackId: string;
  albumId?: string;
  albumTitle?: string;
  artistId?: string;
  artistName?: string;
  title: string;
  trackNumber?: number;
  discNumber?: number;
  durationSeconds: number;
  year?: number;
  genre?: string;
  lyrics?: string;
  artworkUrl?: string;
  mediaFileId: string;
  replayGainTrackGain?: number;
  isFavourite: boolean;
  audioFormat?: string;
  audioCodec?: string;
  bitrateKbps?: number;
  sampleRate?: number;
  channels?: number;
  fileSizeBytes?: number;
}

export interface AlbumDto {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  releaseYear?: number;
  genre?: string;
  totalTracks?: number;
  artworkUrl?: string;
  tracks: TrackDto[];
}

export interface ArtistDto {
  id: string;
  name: string;
  biography?: string;
  country?: string;
  genres?: string;
  artworkUrl?: string;
  albumCount: number;
  trackCount: number;
}

export interface PhotoDto {
  id: string;
  photoId: string;
  title: string;
  dateTakenUtc?: string;
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  focalLengthMm?: number;
  apertureFNumber?: number;
  shutterSpeed?: string;
  isoSpeed?: number;
  width: number;
  height: number;
  orientation: number;
  locationName?: string;
  thumbnailUrl: string;
  fullImageUrl: string;
  isFavourite: boolean;
  mediaFileId: string;
  fileSizeBytes: number;
}

export interface PhotoAlbumDto {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  photoCount: number;
}

export interface PlaylistItemDto {
  id: string;
  mediaItemId: string;
  type: MediaType;
  title: string;
  subtitle?: string;
  durationSeconds: number;
  artworkUrl?: string;
  position: number;
  mediaFileId: string;
}

export interface PlaylistDto {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  itemCount: number;
  totalDurationSeconds: number;
  items: PlaylistItemDto[];
}

export interface BackgroundJobDto {
  id: string;
  type: number;
  status: JobStatus;
  progressPercentage: number;
  progressMessage?: string;
  canCancel: boolean;
  canPause: boolean;
  startTimeUtc: string;
  completedTimeUtc?: string;
  errorMessage?: string;
}

export interface ScanProgressDto {
  libraryId: string;
  folderId: string;
  filesDiscovered: number;
  filesProcessed: number;
  currentFile: string;
  percentage: number;
  status: string;
}

export interface DashboardDto {
  continueWatchingMovies: MovieDto[];
  continueWatchingEpisodes: EpisodeDto[];
  recentlyAddedMovies: MovieDto[];
  recentlyAddedShows: TVShowDto[];
  recentlyPlayedMusic: TrackDto[];
  recentlyAddedPhotos: PhotoDto[];
  favouriteMovies: MovieDto[];
  statistics: {
    totalMovies: number;
    totalShows: number;
    totalEpisodes: number;
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalPhotos: number;
    totalPlaylists: number;
    totalWatchTimeHours: number;
  };
  storageUsage: {
    moviesSizeBytes: number;
    tvShowsSizeBytes: number;
    musicSizeBytes: number;
    photosSizeBytes: number;
    customSizeBytes: number;
    totalSizeBytes: number;
  };
  activeJobs: BackgroundJobDto[];
}

export interface MediaStreamInfoDto {
  index: number;
  type: number; // 1: Video, 2: Audio, 3: Subtitle
  codec: string;
  profile?: string;
  language?: string;
  title?: string;
  isDefault: boolean;
  channels?: number;
  sampleRate?: number;
  width?: number;
  height?: number;
  bitrateKbps?: number;
}

export interface MediaFilePlaybackInfoDto {
  mediaFileId: string;
  mediaItemId: string;
  title: string;
  mediaType?: 'movie' | 'series' | string;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  imdbId?: string;
  streamUrl: string;
  hlsStreamUrl?: string;
  durationSeconds: number;
  resumePositionSeconds: number;
  containerFormat: string;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  bitrateKbps?: number;
  directPlaySupported: boolean;
  selectedAudioStreamIndex?: number;
  streams: MediaStreamInfoDto[];
  introStartSeconds?: number;
  introEndSeconds?: number;
  creditsStartSeconds?: number;
  nextEpisodeId?: string;
  nextEpisodeTitle?: string;
}

export interface OnlineSubtitleResultDto {
  id: string;
  language: string;
  languageName: string;
  downloadUrl: string;
  title: string;
  source: string;
}

export interface DownloadOnlineSubtitleRequest {
  downloadUrl: string;
  language: string;
  title?: string;
  mediaFileId?: string;
}

export interface DownloadOnlineSubtitleResponse {
  subtitleUrl: string;
  label: string;
  language: string;
  cacheFileName: string;
}

export interface BackupHistoryDto {
  id: string;
  backupName: string;
  filePath: string;
  fileSizeBytes: number;
  backupType: number;
  status: string;
  verifiedSuccessfully: boolean;
  createdAtUtc: string;
  notes?: string;
}

export interface SystemHealthDto {
  status: string;
  version: string;
  databaseConnected: boolean;
  ffmpegInstalled: boolean;
  ffmpegVersion?: string;
  ffprobeInstalled: boolean;
  hardwareAccelerationMethods: string[];
  memoryUsedBytes: number;
  cpuUsagePercent: number;
  uptime: string;
  operatingSystem: string;
}

export interface SearchResultDto {
  query: string;
  movies: MovieDto[];
  tvShows: TVShowDto[];
  episodes: EpisodeDto[];
  tracks: TrackDto[];
  artists: ArtistDto[];
  albums: AlbumDto[];
  photos: PhotoDto[];
}

export interface SmartMixDto {
  id: string;
  name: string;
  tagline: string;
  description: string;
  gradient: string;
  icon: string;
  trackCount: number;
  totalDurationSeconds: number;
  sampleTracks: TrackDto[];
}

export interface LrcLine {
  time: number;
  text: string;
}

export interface LyricsResultDto {
  trackId: string;
  lyrics?: string;
  isSynced: boolean;
  source: 'embedded' | 'lrclib' | 'not_found';
  trackTitle?: string;
  artistName?: string;
  albumName?: string;
  durationSeconds?: number;
}

export interface LrcLibSearchResultDto {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  instrumental: boolean;
  hasSyncedLyrics: boolean;
  syncedLyrics?: string;
  plainLyrics?: string;
}

export interface TranslatedLyricLineDto {
  time?: number;
  original: string;
  translated: string;
}

export interface TranslatedLyricsResultDto {
  trackId?: string;
  sourceLanguage: string;
  targetLanguage: string;
  lines: TranslatedLyricLineDto[];
}

export interface PosterSearchResultDto {
  title: string;
  year?: string;
  imdbId?: string;
  posterUrl: string;
  backdropUrl?: string;
  overview?: string;
  genres: string[];
  rating?: number;
  director?: string;
  cast?: string;
}

export interface ImportPosterRequestDto {
  posterUrl: string;
  backdropUrl?: string;
  updateMetadata?: boolean;
  cleanedTitle?: string;
  year?: number;
  overview?: string;
  director?: string;
  cast?: string;
  communityRating?: number;
  genres?: string[];
}

export interface AutoFetchAllResultDto {
  totalScanned: number;
  updatedCount: number;
  failedCount: number;
  updatedTitles: string[];
}

export type IntegrityFileStatus =
  | 'Healthy'
  | 'Modified'
  | 'Missing'
  | 'Corrupted'
  | 'Unreadable'
  | 'DriveDisconnected'
  | 'UnsupportedFormat'
  | 'PendingVerification';

export type IntegrityScanType = 'Full' | 'Incremental' | 'Quick' | 'SingleFile' | 'SelectedFolder';
export type IntegrityScanStatus = 'Pending' | 'Running' | 'Paused' | 'Completed' | 'Cancelled' | 'Failed';

export interface IntegrityDashboardDto {
  totalFilesMonitored: number;
  healthyFiles: number;
  modifiedFiles: number;
  missingFiles: number;
  corruptedFiles: number;
  unreadableFiles: number;
  driveDisconnectedFiles: number;
  pendingVerificationFiles: number;
  coveragePercentage: number;
  totalVerifiedSizeBytes: number;
  lastScanTimestampUtc?: string;
  lastScanStatus?: string;
  isScanRunning: boolean;
  currentScan?: IntegrityScanDto;
  recentEvents: IntegrityEventDto[];
}

export interface IntegrityScanDto {
  id: string;
  libraryId?: string;
  libraryName?: string;
  scanType: IntegrityScanType;
  status: IntegrityScanStatus;
  startedAtUtc: string;
  completedAtUtc?: string;
  totalFilesDiscovered: number;
  filesVerified: number;
  filesHealthy: number;
  filesModified: number;
  filesMissing: number;
  filesCorrupted: number;
  filesUnreadable: number;
  filesDriveDisconnected: number;
  totalBytesScanned: number;
  durationMs: number;
  errorMessage?: string;
  triggeredBy: string;
  progressPercent: number;
}

export interface IntegrityScanProgressDto {
  scanId: string;
  status: IntegrityScanStatus;
  currentFile: string;
  totalFiles: number;
  processedFiles: number;
  percentComplete: number;
  healthyCount: number;
  issueCount: number;
}

export interface IntegrityFileRecordDto {
  id: string;
  mediaFileId?: string;
  mediaItemId?: string;
  title: string;
  libraryId: string;
  libraryName: string;
  filePath: string;
  driveRoot: string;
  isDriveAccessible: boolean;
  fileSizeBytes: number;
  previousFileSizeBytes?: number;
  fileModifiedTimeUtc?: string;
  previousFileModifiedTimeUtc?: string;
  sha256Hash?: string;
  previousSha256Hash?: string;
  status: IntegrityFileStatus;
  corruptionReason?: string;
  ffprobeValid?: boolean;
  ffprobeDetails?: string;
  lastVerifiedAtUtc?: string;
  verifiedCount: number;
  failureCount: number;
}

export interface IntegrityEventDto {
  id: string;
  timestampUtc: string;
  eventType: string;
  severity: 'Info' | 'Warning' | 'Error' | 'Critical';
  title: string;
  description: string;
  filePath?: string;
  mediaFileId?: string;
  resolved: boolean;
  resolvedAtUtc?: string;
}

export interface IntegritySettingsDto {
  verificationStrategy: 'SmartIncremental' | 'FullHash' | 'ContainerProbeOnly';
  scanPriority: 'Low' | 'Normal' | 'High';
  maxConcurrency: number;
  pauseDuringPlayback: boolean;
  autoSchedule: 'Off' | 'Daily' | 'Weekly' | 'Monthly';
  scheduledHourUtc: number;
  hashBufferSizeKb: number;
  probeDeepDecoding: boolean;
  historyRetentionDays: number;
}

export interface RecoveryCandidateDto {
  path: string;
  fileName: string;
  fileSizeBytes: number;
  lastModifiedUtc: string;
  exactSizeMatch: boolean;
  confidenceScore: number;
}

export interface IntegrityVerificationHistoryDto {
  id: string;
  integrityScanId?: string;
  mediaFileId?: string;
  filePath: string;
  verifiedAtUtc: string;
  resultStatus: IntegrityFileStatus;
  previousHash?: string;
  currentHash?: string;
  previousSize?: number;
  currentSize?: number;
  durationMs: number;
  errorDetails?: string;
  checkType: string;
}

