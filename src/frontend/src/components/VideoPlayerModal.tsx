import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Activity,
  Check,
  Download,
  FastForward,
  Globe,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  Settings,
  Sliders,
  Subtitles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { DownloadOnlineSubtitleResponse, OnlineSubtitleResultDto } from '../types';
import { SubtitleAudioSettingsModal } from './SubtitleAudioSettingsModal';

interface CachedSubtitle {
  url: string;
  label: string;
  language: string;
  fileName: string;
}

const sanitizeSubtitleText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/<(?!\/?(b|i|u|span|c\.[a-z0-9_-]+)\b)[^>]*>/gi, '')
    .replace(/\n/g, '<br />');
};

const COMMON_LANGUAGES = [
  { code: '', label: 'All Languages' },
  { code: 'eng', label: 'English' },
  { code: 'hin', label: 'Hindi (हिंदी)' },
  { code: 'spa', label: 'Spanish (Español)' },
  { code: 'fre', label: 'French (Français)' },
  { code: 'ger', label: 'German (Deutsch)' },
  { code: 'ita', label: 'Italian (Italiano)' },
  { code: 'por', label: 'Portuguese (Português)' },
  { code: 'rus', label: 'Russian (Русский)' },
  { code: 'ara', label: 'Arabic (العربية)' },
  { code: 'jpn', label: 'Japanese (日本語)' },
  { code: 'kor', label: 'Korean (한국어)' },
  { code: 'chi', label: 'Chinese (中文)' },
  { code: 'ben', label: 'Bengali (বাংলা)' },
  { code: 'tam', label: 'Tamil (தமிழ்)' },
  { code: 'tel', label: 'Telugu (తెలుగు)' },
  { code: 'tur', label: 'Turkish (Türkçe)' },
  { code: 'pol', label: 'Polish (Polski)' },
  { code: 'dut', label: 'Dutch (Nederlands)' },
  { code: 'ind', label: 'Indonesian (Bahasa Indonesia)' },
];

export const VideoPlayerModal: React.FC = () => {
  const {
    activeVideo,
    isVideoModalOpen,
    closeVideoPlayer,
    openVideoPlayer,
    volume,
    isMuted,
    setVolume,
    toggleMute,
    playbackSpeed,
    setPlaybackSpeed,
    selectedAudioIndex,
    setSelectedAudioIndex,
    selectedSubtitleIndex,
    setSelectedSubtitleIndex,
    subtitleOffset,
    setSubtitleOffset,
    subtitleStyle,
    audioSyncOffsetMs,
    setAudioSyncOffsetMs,
  } = usePlayer();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const clickTimeoutRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);

  // Menus & Calibration Modals
  const [showSubtitlesMenu, setShowSubtitlesMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showStatsForNerds, setShowStatsForNerds] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<'subtitles' | 'audio'>('subtitles');

  // Custom Pixel-Perfect Subtitle Rendering State
  const [currentCueText, setCurrentCueText] = useState<string>('');

  // Online Subtitles State
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [activeOnlineSubtitle, setActiveOnlineSubtitle] = useState<CachedSubtitle | null>(null);
  const [cachedOnlineSubtitles, setCachedOnlineSubtitles] = useState<CachedSubtitle[]>([]);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchType, setSearchType] = useState<'movie' | 'series'>('movie');
  const [searchSeason, setSearchSeason] = useState<number>(1);
  const [searchEpisode, setSearchEpisode] = useState<number>(1);
  const [searchLanguage, setSearchLanguage] = useState<string>('');
  const [searchResults, setSearchResults] = useState<OnlineSubtitleResultDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchStatusMessage, setSearchStatusMessage] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  // Diagnostics
  const [droppedFrames, setDroppedFrames] = useState(0);
  const hideControlsTimerRef = useRef<number | null>(null);
  const prevOffsetRef = useRef<number>(0);
  const timeOffsetRef = useRef<number>(0);
  const hasResumedRef = useRef<boolean>(false);
  const isInitialMountRef = useRef<boolean>(true);

  // Reset subtitles & offset on video change
  useEffect(() => {
    hasResumedRef.current = false;
    isInitialMountRef.current = true;
    setActiveOnlineSubtitle(null);
    setCachedOnlineSubtitles([]);
    setShowOnlineModal(false);
    setShowSettingsModal(false);
    setSearchResults([]);
    setSearchStatusMessage(null);
    setNotificationMessage(null);
    setCurrentCueText('');
    prevOffsetRef.current = 0;
    setSubtitleOffset(0);
    timeOffsetRef.current = 0;
  }, [activeVideo?.mediaFileId]);

  const handleResumeCheck = () => {
    if (!hasResumedRef.current && videoRef.current && activeVideo && activeVideo.resumePositionSeconds > 0) {
      const resumePos = activeVideo.resumePositionSeconds;
      const vidDur = videoRef.current.duration || activeVideo.durationSeconds || 0;
      if (resumePos > 0 && (vidDur <= 0 || resumePos < vidDur - 5)) {
        try {
          videoRef.current.currentTime = resumePos;
          hasResumedRef.current = true;
          const mins = Math.floor(resumePos / 60);
          const secs = Math.floor(resumePos % 60);
          setNotificationMessage(`Resumed playback at ${mins}:${secs.toString().padStart(2, '0')}`);
          setTimeout(() => setNotificationMessage(null), 3500);
        } catch (e) {
          console.warn('Resume seek note:', e);
        }
      }
    }
  };

  // Setup HLS or direct playback
  useEffect(() => {
    if (!isVideoModalOpen || !activeVideo || !videoRef.current) return;

    const video = videoRef.current;
    video.volume = isMuted ? 0 : volume;
    video.playbackRate = playbackSpeed;

    const streamUrl = activeVideo.streamUrl;
    const hlsUrl = activeVideo.hlsStreamUrl;

    // Apply audioSyncOffsetMs if calibrated
    let effectiveStreamUrl = streamUrl;
    if (audioSyncOffsetMs !== 0 && effectiveStreamUrl) {
      const sep = effectiveStreamUrl.includes('?') ? '&' : '?';
      effectiveStreamUrl = `${effectiveStreamUrl}${sep}audioOffsetMs=${audioSyncOffsetMs}`;
    }

    if (hlsUrl && Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();

      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        handleResumeCheck();
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn('HLS fatal error encountered, falling back to direct streamUrl:', data);
          try {
            hls.destroy();
            hlsRef.current = null;
          } catch {}
          if (video && effectiveStreamUrl) {
            video.src = effectiveStreamUrl;
            handleResumeCheck();
            video.play().catch(() => {});
          }
        }
      });
    } else {
      video.src = effectiveStreamUrl;
      handleResumeCheck();
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isVideoModalOpen, activeVideo]);

  // Live stream calibration reload when audioSyncOffsetMs changes during playback
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!isVideoModalOpen || !activeVideo || !videoRef.current) return;

    const timer = setTimeout(() => {
      if (!videoRef.current || !activeVideo) return;
      const currentRealTime = timeOffsetRef.current + videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;

      const newUrl = `/api/v1/stream/${activeVideo.mediaFileId}?remux=true&audioIndex=${selectedAudioIndex}&start=${currentRealTime.toFixed(2)}&audioOffsetMs=${audioSyncOffsetMs}&_t=${Date.now()}`;
      videoRef.current.src = newUrl;
      videoRef.current.load();
      if (wasPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [audioSyncOffsetMs]);

  // Real-time native volume and mute synchronization (hardware lip-sync)
  useEffect(() => {
    const targetVol = isMuted ? 0 : volume;
    if (videoRef.current) {
      videoRef.current.volume = targetVol;
      videoRef.current.muted = isMuted || volume === 0;
    }
  }, [volume, isMuted]);

  // Keep subtitle track in 'hidden' mode so cues load while suppressing default browser rendering
  useEffect(() => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = (selectedSubtitleIndex >= 0 || activeOnlineSubtitle) ? 'hidden' : 'disabled';
    }
    updateActiveSubtitleCue();
  }, [selectedSubtitleIndex, activeOnlineSubtitle]);

  // Extract active cue text based on current video timestamp
  const updateActiveSubtitleCue = () => {
    if (!videoRef.current) return;
    if (selectedSubtitleIndex === -1 && !activeOnlineSubtitle) {
      if (currentCueText) setCurrentCueText('');
      return;
    }

    const tracks = videoRef.current.textTracks;
    let foundText = '';
    const vTime = videoRef.current.currentTime;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (!(track as any)._vistaraListening) {
        (track as any)._vistaraListening = true;
        track.oncuechange = () => updateActiveSubtitleCue();
      }

      if (track.activeCues && track.activeCues.length > 0) {
        const parts: string[] = [];
        for (let j = 0; j < track.activeCues.length; j++) {
          const c = track.activeCues[j] as any;
          if (c.text) parts.push(c.text);
        }
        foundText = parts.join('\n');
      } else if (track.cues) {
        for (let j = 0; j < track.cues.length; j++) {
          const c = track.cues[j] as any;
          if (vTime >= c.startTime && vTime <= c.endTime) {
            foundText = c.text;
            break;
          }
        }
      }
      if (foundText) break;
    }

    if (foundText !== currentCueText) {
      setCurrentCueText(foundText);
    }
  };

  // Live Subtitle Sync Offset & Time Offset adjustment
  useEffect(() => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const cues = tracks[i].cues;
      if (cues) {
        for (let j = 0; j < cues.length; j++) {
          const cue = cues[j] as any;
          if (cue._origStart === undefined) {
            cue._origStart = cue.startTime;
            cue._origEnd = cue.endTime;
          }
          cue.startTime = Math.max(0, cue._origStart - timeOffsetRef.current + subtitleOffset);
          cue.endTime = Math.max(0, cue._origEnd - timeOffsetRef.current + subtitleOffset);
        }
      }
    }
    updateActiveSubtitleCue();
  }, [subtitleOffset, selectedSubtitleIndex, activeOnlineSubtitle]);

  // Immediate progress flush helper
  const saveProgressImmediate = (isPausedState?: boolean) => {
    if (!activeVideo || !videoRef.current) return;
    const realPos = timeOffsetRef.current + videoRef.current.currentTime;
    const totalDur = activeVideo.durationSeconds || videoRef.current.duration || 0;
    if (totalDur <= 0 || isNaN(realPos)) return;

    apiRequest('/api/v1/playback/progress', {
      method: 'POST',
      body: JSON.stringify({
        mediaItemId: activeVideo.mediaItemId,
        mediaFileId: activeVideo.mediaFileId,
        positionSeconds: Math.max(0, realPos),
        durationSeconds: totalDur,
        selectedAudioStreamIndex: selectedAudioIndex,
        selectedSubtitleStreamIndex: selectedSubtitleIndex >= 0 ? selectedSubtitleIndex : null,
        isPaused: isPausedState ?? videoRef.current.paused,
      }),
    }).catch(() => {});
  };

  // Periodic progress update to backend
  useEffect(() => {
    if (!activeVideo || !isVideoModalOpen) return;

    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        saveProgressImmediate(false);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      saveProgressImmediate();
    };
  }, [activeVideo, isVideoModalOpen, selectedAudioIndex, selectedSubtitleIndex]);

  // Auto-hide controls after inactivity
  const resetHideControlsTimer = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = window.setTimeout(() => {
      if (
        isPlaying &&
        !showSubtitlesMenu &&
        !showAudioMenu &&
        !showSpeedMenu &&
        !showStatsForNerds &&
        !showOnlineModal &&
        !showSettingsModal
      ) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isVideoModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekDelta(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekDelta(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyC':
          e.preventDefault();
          setShowSubtitlesMenu((prev) => !prev);
          break;
        case 'KeyA':
          e.preventDefault();
          setShowAudioMenu((prev) => !prev);
          break;
        case 'KeyS':
          e.preventDefault();
          setSettingsModalTab('subtitles');
          setShowSettingsModal((prev) => !prev);
          break;
        case 'KeyG':
          e.preventDefault();
          setAudioSyncOffsetMs((prev) => Math.max(-5000, prev - 50));
          setNotificationMessage('Audio advanced by -50ms');
          setTimeout(() => setNotificationMessage(null), 1500);
          break;
        case 'KeyH':
          e.preventDefault();
          setAudioSyncOffsetMs((prev) => Math.min(5000, prev + 50));
          setNotificationMessage('Audio delayed by +50ms');
          setTimeout(() => setNotificationMessage(null), 1500);
          break;
        case 'Escape':
          e.preventDefault();
          if (showSettingsModal) {
            setShowSettingsModal(false);
          } else if (showOnlineModal) {
            setShowOnlineModal(false);
          } else if (isFullscreen) {
            toggleFullscreen();
          } else {
            handleClose();
          }
          break;
      }
      resetHideControlsTimer();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoModalOpen, isFullscreen, volume, isPlaying, showOnlineModal, showSettingsModal]);

  // Synchronize fullscreen state with native browser/OS events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const fsElem =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;
      setIsFullscreen(!!fsElem);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  const handleClose = () => {
    const doc = document as any;
    const currentFs =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement;
    if (currentFs) {
      try {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      } catch {}
    }
    saveProgressImmediate();
    closeVideoPlayer();
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      saveProgressImmediate(true);
    }
  };

  const handleSeek = (targetSeconds: number) => {
    if (!activeVideo || !videoRef.current) return;
    const maxDur = duration || activeVideo.durationSeconds || 0;
    targetSeconds = Math.max(0, Math.min(maxDur, targetSeconds));

    // Native range request seeking if direct playing and not remuxed with offset
    if (timeOffsetRef.current === 0 && !videoRef.current.src.includes('remux=true') && !videoRef.current.src.includes('audioIndex=') && audioSyncOffsetMs === 0) {
      videoRef.current.currentTime = targetSeconds;
      setCurrentTime(targetSeconds);
      return;
    }

    // When remuxing or custom audio is playing:
    timeOffsetRef.current = targetSeconds;
    setCurrentTime(targetSeconds);
    const wasPlaying = !videoRef.current.paused;

    const newUrl = `/api/v1/stream/${activeVideo.mediaFileId}?remux=true&audioIndex=${selectedAudioIndex}&start=${targetSeconds.toFixed(2)}&audioOffsetMs=${audioSyncOffsetMs}&_t=${Date.now()}`;
    videoRef.current.src = newUrl;
    videoRef.current.load();
    if (wasPlaying) {
      videoRef.current.play().catch(() => {});
    }
  };

  const seekDelta = (deltaSeconds: number) => {
    if (!videoRef.current) return;
    const currentRealTime = timeOffsetRef.current + videoRef.current.currentTime;
    handleSeek(currentRealTime + deltaSeconds);
  };

  const switchAudioTrack = (newAudioIndex: number) => {
    if (!activeVideo || !videoRef.current) return;
    if (newAudioIndex === selectedAudioIndex) return;

    // 1. Calculate current exact position
    const currentRealTime = timeOffsetRef.current + videoRef.current.currentTime;
    timeOffsetRef.current = currentRealTime;
    setCurrentTime(currentRealTime);
    setSelectedAudioIndex(newAudioIndex);

    const wasPlaying = !videoRef.current.paused;

    // 2. Build stream URL mapping this specific audio stream from currentRealTime
    const newStreamUrl = `/api/v1/stream/${activeVideo.mediaFileId}?remux=true&audioIndex=${newAudioIndex}&start=${currentRealTime.toFixed(2)}&audioOffsetMs=${audioSyncOffsetMs}&_t=${Date.now()}`;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    videoRef.current.src = newStreamUrl;
    videoRef.current.load();
    if (wasPlaying) {
      videoRef.current.play().catch(() => {});
    }

    // 3. Show notification toast
    const isAudio = (type: any) => type === 2 || type === '2' || type === 'Audio';
    const audioList = activeVideo.streams.filter((s) => isAudio(s.type));
    const chosenStream = audioList.find((s) => s.index === newAudioIndex);
    const lang = chosenStream?.title || (chosenStream?.language ? chosenStream.language.toUpperCase() : `Track ${newAudioIndex}`);
    const details = [
      chosenStream?.channels ? `${chosenStream.channels} ch` : null,
      chosenStream?.codec ? chosenStream.codec.toUpperCase() : null,
    ].filter(Boolean).join(' ');
    setNotificationMessage(`Switched audio: ${lang} (${details || 'AAC'})`);
    setTimeout(() => setNotificationMessage(null), 3500);
  };

  const toggleFullscreen = async () => {
    try {
      const doc = document as any;
      const elem = (containerRef.current || document.documentElement) as any;
      if (!elem) return;

      const currentFs =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;

      if (!currentFs) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        setIsFullscreen(false);
      }

      // Notify desktop WebView2 wrapper if running in WPF shell
      if ((window as any).chrome?.webview?.postMessage) {
        (window as any).chrome.webview.postMessage('toggle_fullscreen');
      }
    } catch (err) {
      console.warn('Fullscreen toggle:', err);
      setIsFullscreen((prev) => !prev);
    }
  };

  const togglePictureInPicture = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
        setIsPipActive(true);
      }
    } catch (err) {
      console.warn('Picture-in-Picture toggle:', err);
    }
  };

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onEnterPip = () => setIsPipActive(true);
    const onLeavePip = () => setIsPipActive(false);
    vid.addEventListener('enterpictureinpicture', onEnterPip);
    vid.addEventListener('leavepictureinpicture', onLeavePip);
    return () => {
      vid.removeEventListener('enterpictureinpicture', onEnterPip);
      vid.removeEventListener('leavepictureinpicture', onLeavePip);
    };
  }, [activeVideo]);

  const handleVideoClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      toggleFullscreen();
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        togglePlay();
      }, 250);
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
    : (activeVideo?.durationSeconds && Number.isFinite(activeVideo.durationSeconds) && activeVideo.durationSeconds > 0
        ? activeVideo.durationSeconds
        : 0);
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;

  // Online Subtitles search executor
  const executeOnlineSearch = async (
    title: string,
    type: 'movie' | 'series',
    season: number,
    episode: number,
    lang: string,
    imdb?: string
  ) => {
    if (!title.trim() && !imdb) return;
    setIsSearching(true);
    setSearchStatusMessage(null);
    setSearchResults([]);

    try {
      const params = new URLSearchParams();
      if (title.trim()) params.append('query', title.trim());
      if (imdb) params.append('imdbId', imdb);
      params.append('type', type);
      if (type === 'series') {
        params.append('season', season.toString());
        params.append('episode', episode.toString());
      }
      if (lang) params.append('language', lang);

      const res = await apiRequest<OnlineSubtitleResultDto[]>(`/api/v1/subtitles/search?${params.toString()}`);
      if (res.success && res.data) {
        setSearchResults(res.data);
        if (res.data.length === 0) {
          setSearchStatusMessage('No open-source subtitles found. Try refining the title or selecting All Languages.');
        }
      } else {
        setSearchStatusMessage(res.error || 'Failed to search online subtitles.');
      }
    } catch {
      setSearchStatusMessage('Network connection failed while searching open-source subtitle index.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenOnlineModal = () => {
    if (!activeVideo) return;
    setShowSubtitlesMenu(false);

    const isSeries = activeVideo.mediaType === 'series' || !!activeVideo.seriesTitle;
    const initialTitle = activeVideo.seriesTitle || activeVideo.title;

    setSearchTitle(initialTitle);
    setSearchType(isSeries ? 'series' : 'movie');
    setSearchSeason(activeVideo.seasonNumber ?? 1);
    setSearchEpisode(activeVideo.episodeNumber ?? 1);
    setSearchLanguage('');
    setSearchResults([]);
    setSearchStatusMessage(null);
    setShowOnlineModal(true);

    executeOnlineSearch(
      initialTitle,
      isSeries ? 'series' : 'movie',
      activeVideo.seasonNumber ?? 1,
      activeVideo.episodeNumber ?? 1,
      '',
      activeVideo.imdbId
    );
  };

  const handleDownloadSubtitle = async (sub: OnlineSubtitleResultDto) => {
    if (!activeVideo) return;
    setDownloadingId(sub.id);
    try {
      const res = await apiRequest<DownloadOnlineSubtitleResponse>('/api/v1/subtitles/download', {
        method: 'POST',
        body: JSON.stringify({
          downloadUrl: sub.downloadUrl,
          language: sub.language,
          title: sub.title,
          mediaFileId: activeVideo.mediaFileId,
        }),
      });

      if (res.success && res.data) {
        const newSub: CachedSubtitle = {
          url: res.data.subtitleUrl,
          label: res.data.label || `${sub.languageName} (Online)`,
          language: res.data.language,
          fileName: res.data.cacheFileName,
        };

        setCachedOnlineSubtitles((prev) => {
          const filtered = prev.filter((p) => p.url !== newSub.url);
          return [...filtered, newSub];
        });

        setActiveOnlineSubtitle(newSub);
        setSelectedSubtitleIndex(-1); // Disable embedded tracks
        setShowOnlineModal(false);

        setNotificationMessage(`Subtitles activated: ${newSub.label}`);
        setTimeout(() => setNotificationMessage(null), 4000);
      } else {
        setSearchStatusMessage(res.error || 'Failed to download and convert subtitle.');
      }
    } catch {
      setSearchStatusMessage('Download request failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isVideoModalOpen || !activeVideo) return null;

  const isAudioStream = (type: any) => type === 2 || type === '2' || type === 'Audio';
  const isSubtitleStream = (type: any) => type === 3 || type === '3' || type === 'Subtitle';

  const audioStreams = activeVideo.streams.filter((s) => isAudioStream(s.type));
  const subtitleStreams = activeVideo.streams.filter((s) => isSubtitleStream(s.type));

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideControlsTimer}
      className="fixed inset-0 z-50 bg-[#000000] flex items-center justify-center select-none overflow-hidden"
    >
      {/* Hide native browser cues so our pixel-perfect React overlay renders cleanly */}
      <style>{`
        video::cue {
          opacity: 0 !important;
          font-size: 0px !important;
          color: transparent !important;
          background-color: transparent !important;
          visibility: hidden !important;
        }
      `}</style>

      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        crossOrigin="anonymous"
        onClick={handleVideoClick}
        onPause={() => {
          setIsPlaying(false);
          saveProgressImmediate(true);
        }}
        onPlay={() => {
          setIsPlaying(true);
        }}
        onTimeUpdate={() => {
          if (videoRef.current) {
            const realTime = timeOffsetRef.current + videoRef.current.currentTime;
            setCurrentTime(realTime);
            updateActiveSubtitleCue();
            if (videoRef.current.buffered.length > 0) {
              setBufferedEnd(timeOffsetRef.current + videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
            }
            if ((videoRef.current as any).getVideoPlaybackQuality) {
              setDroppedFrames((videoRef.current as any).getVideoPlaybackQuality().droppedVideoFrames);
            }
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            if (isFinite(videoRef.current.duration) && videoRef.current.duration > 0 && timeOffsetRef.current === 0) {
              setDuration(videoRef.current.duration);
            } else if (activeVideo.durationSeconds > 0) {
              setDuration(activeVideo.durationSeconds);
            }
          }
          handleResumeCheck();
        }}
        onCanPlay={() => {
          handleResumeCheck();
        }}
        onEnded={() => {
          saveProgressImmediate();
          if (activeVideo.nextEpisodeId) {
            openVideoPlayer(activeVideo.nextEpisodeId);
          }
        }}
      >
        {/* Active Subtitle Track (Online or Embedded) */}
        {activeOnlineSubtitle ? (
          <track
            key={activeOnlineSubtitle.url}
            kind="subtitles"
            label={activeOnlineSubtitle.label}
            src={activeOnlineSubtitle.url}
            default
          />
        ) : selectedSubtitleIndex >= 0 ? (
          <track
            key={`stream-${selectedSubtitleIndex}`}
            kind="subtitles"
            label={`Track ${selectedSubtitleIndex}`}
            src={`/api/v1/subtitles/file/${activeVideo.mediaFileId}/${selectedSubtitleIndex}`}
            default
          />
        ) : null}
      </video>

      {/* Custom Subtitle Overlay */}
      {currentCueText && (
        <div
          className="absolute left-0 right-0 flex justify-center pointer-events-none z-30 px-6 text-center transition-all duration-75"
          style={{
            bottom: `${subtitleStyle.verticalPosition ?? 8}%`,
          }}
        >
          <div
            style={{
              fontFamily: subtitleStyle.fontFamily,
              fontSize: `${subtitleStyle.fontSize}px`,
              color: subtitleStyle.textColor,
              backgroundColor: subtitleStyle.bgColor,
              textShadow: subtitleStyle.textShadow,
              borderRadius: '6px',
              padding: subtitleStyle.bgOpacity > 0 ? '4px 14px' : '0px',
              maxWidth: '85%',
              lineHeight: 1.35,
              whiteSpace: 'pre-line',
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeSubtitleText(currentCueText) }}
          />
        </div>
      )}

      {/* Notification Toast */}
      {notificationMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-[#181c24] border border-[#242a36] text-white px-5 py-2.5 rounded-lg shadow-2xl flex items-center space-x-2 text-xs font-medium animate-in fade-in slide-in-from-top-4 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{notificationMessage}</span>
        </div>
      )}

      {/* Top Bar with Title and Close Button */}
      <div
        className={`absolute top-0 left-0 right-0 p-6 bg-[#0b0d11]/85 border-b border-[#242a36]/50 flex items-center justify-between transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-white tracking-wide">{activeVideo.title}</h1>
            {activeVideo.seriesTitle && (
              <span className="text-xs px-2 py-0.5 rounded bg-[#181c24] text-[#9ca3af] border border-[#242a36]">
                {activeVideo.seriesTitle}
                {activeVideo.seasonNumber ? ` • S${activeVideo.seasonNumber}` : ''}
                {activeVideo.episodeNumber ? `E${activeVideo.episodeNumber}` : ''}
              </span>
            )}
          </div>
          <div className="text-xs text-[#9ca3af] flex items-center space-x-2 mt-1">
            {activeVideo.videoCodec && <span className="uppercase">{activeVideo.videoCodec}</span>}
            {activeVideo.height && <span>• {activeVideo.height}p</span>}
            {activeVideo.directPlaySupported ? (
              <span className="text-emerald-400 font-medium">• Direct Play</span>
            ) : (
              <span className="text-accent font-medium">• Transcoded / Remuxed</span>
            )}
            {activeOnlineSubtitle && (
              <span className="text-accent font-medium">• {activeOnlineSubtitle.label}</span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowStatsForNerds((prev) => !prev)}
            title="Playback Diagnostics (Stats for Nerds)"
            className={`p-2 rounded-md transition-colors ${
              showStatsForNerds ? 'bg-accent text-white' : 'text-[#9ca3af] hover:text-white bg-[#181c24]'
            }`}
          >
            <Activity className="w-4 h-4" />
          </button>

          <button
            onClick={handleClose}
            title="Close Player"
            className="p-2 rounded-md bg-[#181c24] text-[#9ca3af] hover:text-white hover:bg-[#242a36] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats for Nerds Diagnostics Overlay */}
      {showStatsForNerds && (
        <div className="absolute top-20 right-6 bg-[#12151b] border border-[#242a36] rounded-lg p-4 text-xs font-mono text-[#d1d5db] w-80 shadow-2xl z-40">
          <div className="font-bold text-white border-b border-[#242a36] pb-2 mb-2 flex justify-between">
            <span>Video Diagnostics</span>
            <span className="text-accent">127.0.0.1</span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Container:</span>
              <span>{activeVideo.containerFormat}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Video Codec:</span>
              <span>{activeVideo.videoCodec || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Audio Codec:</span>
              <span>{activeVideo.audioCodec || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Resolution:</span>
              <span>
                {activeVideo.width}x{activeVideo.height}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Framerate:</span>
              <span>{activeVideo.frameRate ? `${activeVideo.frameRate} fps` : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Bitrate:</span>
              <span>{activeVideo.bitrateKbps ? `${activeVideo.bitrateKbps} kbps` : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Dropped Frames:</span>
              <span>{droppedFrames}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9ca3af]">Playback Pipeline:</span>
              <span className="text-emerald-400 font-bold">
                {activeVideo.directPlaySupported ? 'Direct Play' : 'FFmpeg Stream'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Skip Intro & Skip Credits Buttons */}
      {activeVideo.introStartSeconds !== undefined &&
        activeVideo.introEndSeconds !== undefined &&
        currentTime >= activeVideo.introStartSeconds &&
        currentTime <= activeVideo.introEndSeconds && (
          <button
            onClick={() => {
              if (activeVideo.introEndSeconds) {
                handleSeek(activeVideo.introEndSeconds);
              }
            }}
            className="absolute bottom-24 right-8 bg-[#181c24] border border-accent text-white px-4 py-2 rounded-md text-xs font-bold hover:bg-accent transition-colors shadow-2xl flex items-center space-x-2 z-40"
          >
            <FastForward className="w-4 h-4" />
            <span>Skip Intro</span>
          </button>
        )}

      {/* Bottom Overlay Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-6 bg-[#0b0d11]/90 border-t border-[#242a36]/50 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seek Bar with Buffered Indication */}
        <div className="relative w-full mb-4 group cursor-pointer">
          <div
            style={{ width: `${safeDuration > 0 ? (bufferedEnd / safeDuration) * 100 : 0}%` }}
            className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-[#374151] rounded-lg pointer-events-none"
          />
          <input
            type="range"
            min={0}
            max={safeDuration || 100}
            value={Math.min(safeCurrentTime, safeDuration || 100)}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              handleSeek(val);
            }}
            className="w-full h-1 bg-[#1f242f] rounded-lg appearance-none cursor-pointer accent-accent focus:outline-none relative z-10"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          {/* Left: Play/Pause, Seek -10/+10, Volume, Time */}
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-transform hover:scale-105"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            <button
              onClick={() => seekDelta(-10)}
              title="Rewind 10s (Left Arrow)"
              className="p-1.5 rounded text-[#9ca3af] hover:text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekDelta(10)}
              title="Forward 10s (Right Arrow)"
              className="p-1.5 rounded text-[#9ca3af] hover:text-white transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume slider */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                className="text-[#9ca3af] hover:text-white transition-colors p-1 rounded"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <div className="flex items-center space-x-1.5">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  onInput={(e) => setVolume(parseFloat((e.target as HTMLInputElement).value))}
                  title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                  className="w-20 sm:w-24 h-1 bg-[#242a36] rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <span className="text-[11px] font-mono text-[#9ca3af] w-7 text-right tabular-nums">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>

            <div className="text-xs font-mono text-[#9ca3af]">
              <span>{formatTime(safeCurrentTime)}</span> / <span>{formatTime(safeDuration)}</span>
            </div>
          </div>

          {/* Right: Subtitles, Audio Track, Speed, Next Episode, Fullscreen */}
          <div className="flex items-center space-x-3 relative">
            {/* Next Episode Button */}
            {activeVideo.nextEpisodeId && (
              <button
                onClick={() => openVideoPlayer(activeVideo.nextEpisodeId!)}
                title={`Next: ${activeVideo.nextEpisodeTitle || 'Next Episode'}`}
                className="bg-[#181c24] border border-[#242a36] hover:border-accent text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
              >
                Next Episode ▶
              </button>
            )}

            {/* Subtitles Button & Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSubtitlesMenu((prev) => !prev);
                  setShowAudioMenu(false);
                  setShowSpeedMenu(false);
                }}
                title="Subtitles (C)"
                className={`p-2 rounded text-xs transition-colors ${
                  activeOnlineSubtitle || selectedSubtitleIndex >= 0
                    ? 'text-accent'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                <Subtitles className="w-5 h-5" />
              </button>

              {showSubtitlesMenu && (
                <div className="absolute bottom-full right-0 mb-3 bg-[#181c24] border border-[#242a36] rounded-md shadow-2xl p-3 w-80 text-xs z-50">
                  <div className="flex items-center justify-between font-bold text-white pb-2 mb-2 border-b border-[#242a36]">
                    <span>Subtitles</span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setSettingsModalTab('subtitles');
                          setShowSettingsModal(true);
                          setShowSubtitlesMenu(false);
                        }}
                        className="flex items-center space-x-1 px-2 py-1 bg-[#242a36] hover:bg-[#323948] text-[#d1d5db] hover:text-white rounded text-[11px] transition-colors"
                        title="Customize font, color, background & position"
                      >
                        <Settings className="w-3 h-3 text-accent" />
                        <span>Style</span>
                      </button>
                      <button
                        onClick={handleOpenOnlineModal}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-accent/20 hover:bg-accent text-white rounded text-[11px] font-medium border border-accent/40 transition-colors"
                        title="Search open-source subtitles online"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Search Online</span>
                      </button>
                    </div>
                  </div>

                  {/* Off option */}
                  <div className="space-y-1 mb-3">
                    <button
                      onClick={() => {
                        setSelectedSubtitleIndex(-1);
                        setActiveOnlineSubtitle(null);
                        setShowSubtitlesMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between ${
                        selectedSubtitleIndex === -1 && !activeOnlineSubtitle
                          ? 'bg-accent text-white font-medium'
                          : 'hover:bg-[#1f242f] text-[#d1d5db]'
                      }`}
                    >
                      <span>Off</span>
                      {selectedSubtitleIndex === -1 && !activeOnlineSubtitle && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Online Subtitles Session Cache */}
                    {cachedOnlineSubtitles.length > 0 && (
                      <div className="pt-2">
                        <div className="text-[10px] uppercase font-bold text-[#9ca3af] px-1 mb-1">
                          Downloaded Online Subtitles
                        </div>
                        {cachedOnlineSubtitles.map((sub) => {
                          const isCurrent = activeOnlineSubtitle?.url === sub.url;
                          return (
                            <button
                              key={sub.url}
                              onClick={() => {
                                setActiveOnlineSubtitle(sub);
                                setSelectedSubtitleIndex(-1);
                                setShowSubtitlesMenu(false);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between ${
                                isCurrent ? 'bg-accent text-white font-medium' : 'hover:bg-[#1f242f] text-[#d1d5db]'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <Globe className="w-3 h-3 text-accent shrink-0" />
                                <span className="truncate">{sub.label}</span>
                              </div>
                              {isCurrent && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Embedded Subtitle Tracks */}
                    {subtitleStreams.length > 0 && (
                      <div className="pt-2">
                        <div className="text-[10px] uppercase font-bold text-[#9ca3af] px-1 mb-1">
                          Embedded Tracks
                        </div>
                        {subtitleStreams.map((sub) => {
                          const isCurrent = !activeOnlineSubtitle && selectedSubtitleIndex === sub.index;
                          return (
                            <button
                              key={sub.index}
                              onClick={() => {
                                setSelectedSubtitleIndex(sub.index);
                                setActiveOnlineSubtitle(null);
                                setShowSubtitlesMenu(false);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between ${
                                isCurrent ? 'bg-accent text-white font-medium' : 'hover:bg-[#1f242f] text-[#d1d5db]'
                              }`}
                            >
                              <span className="truncate">
                                {sub.language ? sub.language.toUpperCase() : 'Track'} {sub.title ? `(${sub.title})` : ''}
                              </span>
                              {isCurrent && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Subtitle Sync Offset */}
                  <div className="border-t border-[#242a36] pt-2">
                    <div className="flex justify-between items-center text-[11px] text-[#9ca3af] mb-1.5">
                      <span>Sync Offset:</span>
                      <span className="font-mono text-white">
                        {subtitleOffset > 0 ? `+${subtitleOffset.toFixed(1)}s` : `${subtitleOffset.toFixed(1)}s`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => setSubtitleOffset(subtitleOffset - 0.5)}
                        className="px-2 py-1 bg-[#242a36] hover:bg-[#323948] rounded text-[#d1d5db] hover:text-white text-center font-mono"
                      >
                        -0.5s
                      </button>
                      <button
                        onClick={() => setSubtitleOffset(0)}
                        className="px-2 py-1 bg-[#242a36] hover:bg-[#323948] rounded text-[#d1d5db] hover:text-white text-center"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => setSubtitleOffset(subtitleOffset + 0.5)}
                        className="px-2 py-1 bg-[#242a36] hover:bg-[#323948] rounded text-[#d1d5db] hover:text-white text-center font-mono"
                      >
                        +0.5s
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setSettingsModalTab('subtitles');
                        setShowSettingsModal(true);
                        setShowSubtitlesMenu(false);
                      }}
                      className="w-full mt-2.5 py-1.5 bg-[#12151b] hover:bg-[#202530] text-accent text-[11px] rounded text-center font-medium border border-[#242a36] hover:border-accent/40 transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Custom Subtitle Appearance & Timing</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audio Track Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAudioMenu((prev) => !prev);
                  setShowSubtitlesMenu(false);
                  setShowSpeedMenu(false);
                }}
                title="Audio Tracks (A)"
                className="p-2 rounded text-[#9ca3af] hover:text-white transition-colors"
              >
                <Sliders className="w-5 h-5" />
              </button>

              {showAudioMenu && (
                <div className="absolute bottom-full right-0 mb-3 bg-[#181c24] border border-[#242a36] rounded-md shadow-2xl p-3 w-64 text-xs z-50">
                  <div className="font-bold text-white mb-2">Audio Track</div>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {audioStreams.length === 0 ? (
                      <div className="text-gray-400 py-1 text-center">No audio tracks detected</div>
                    ) : (
                      audioStreams.map((audio) => {
                        const isCurrent = selectedAudioIndex === audio.index;
                        const label = audio.title || (audio.language ? audio.language.toUpperCase() : `Track ${audio.index}`);
                        const details = [
                          audio.channels ? `${audio.channels} ch` : null,
                          audio.codec ? audio.codec.toUpperCase() : null,
                        ].filter(Boolean).join(' • ');

                        return (
                          <button
                            key={audio.index}
                            onClick={() => {
                              switchAudioTrack(audio.index);
                              setShowAudioMenu(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded flex items-center justify-between transition-colors ${
                              isCurrent
                                ? 'bg-accent text-white font-medium'
                                : 'hover:bg-[#1f242f] text-[#d1d5db]'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-medium text-white">{label}</div>
                              {details && <div className="text-[10px] text-gray-400">{details}</div>}
                            </div>
                            {isCurrent && <Check className="w-4 h-4 shrink-0 text-white" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Audio Sync Calibration Button */}
                  <div className="border-t border-[#242a36] pt-2 mt-2">
                    <button
                      onClick={() => {
                        setSettingsModalTab('audio');
                        setShowSettingsModal(true);
                        setShowAudioMenu(false);
                      }}
                      className="w-full py-1.5 px-2 bg-[#12151b] hover:bg-[#202530] text-white rounded flex items-center justify-between text-[11px] border border-[#242a36] hover:border-accent/40 transition-colors"
                    >
                      <div className="flex items-center space-x-1.5">
                        <Sliders className="w-3.5 h-3.5 text-accent" />
                        <span>Audio Sync Delay</span>
                      </div>
                      <span className="font-mono text-accent font-semibold">
                        {audioSyncOffsetMs === 0 ? '0ms' : `${audioSyncOffsetMs > 0 ? '+' : ''}${audioSyncOffsetMs}ms`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Subtitle & Audio Calibration Button */}
            <button
              onClick={() => {
                setSettingsModalTab('subtitles');
                setShowSettingsModal(true);
                setShowSubtitlesMenu(false);
                setShowAudioMenu(false);
                setShowSpeedMenu(false);
              }}
              title="Subtitle & Audio Calibration (S)"
              className="p-2 rounded text-[#9ca3af] hover:text-white hover:bg-[#181c24] transition-colors relative"
            >
              <Settings className="w-5 h-5" />
              {audioSyncOffsetMs !== 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
              )}
            </button>

            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSpeedMenu((prev) => !prev);
                  setShowSubtitlesMenu(false);
                  setShowAudioMenu(false);
                }}
                title="Playback Speed"
                className="px-2 py-1 bg-[#181c24] border border-[#242a36] rounded text-xs font-mono text-white hover:border-accent transition-colors"
              >
                {playbackSpeed}x
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-3 bg-[#181c24] border border-[#242a36] rounded-md shadow-2xl p-2 w-28 text-xs font-mono z-50">
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setPlaybackSpeed(s);
                        if (videoRef.current) videoRef.current.playbackRate = s;
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1 rounded ${
                        playbackSpeed === s ? 'bg-accent text-white' : 'hover:bg-[#1f242f] text-[#d1d5db]'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Picture-in-Picture Button */}
            {typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePictureInPicture();
                }}
                title={isPipActive ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
                className={`p-2 rounded transition-colors cursor-pointer ${
                  isPipActive
                    ? 'text-accent bg-accent/20'
                    : 'text-[#9ca3af] hover:text-white hover:bg-[#181c24]'
                }`}
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
              className="p-2 rounded text-[#9ca3af] hover:text-white hover:bg-[#181c24] transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Online Subtitles Modal Dialog */}
      {showOnlineModal && (
        <div className="absolute inset-0 z-50 bg-[#000000]/70 flex items-center justify-center p-4">
          <div className="bg-[#12151b] border border-[#242a36] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#242a36]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Online Subtitle Search</h2>
                  <p className="text-xs text-[#9ca3af]">
                    Community OpenSubtitles & Cinemeta Protocol • Free & Open Source
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOnlineModal(false)}
                className="p-2 rounded-lg text-[#9ca3af] hover:text-white hover:bg-[#181c24] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-5 border-b border-[#242a36] space-y-4 bg-[#0b0d11]">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Title Input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchTitle}
                    onChange={(e) => setSearchTitle(e.target.value)}
                    placeholder="Search movie or TV show name..."
                    className="w-full bg-[#181c24] border border-[#242a36] rounded-lg px-3.5 py-2 text-xs text-white placeholder-[#6b7280] focus:outline-none focus:border-accent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        executeOnlineSearch(
                          searchTitle,
                          searchType,
                          searchSeason,
                          searchEpisode,
                          searchLanguage,
                          activeVideo.imdbId
                        );
                      }
                    }}
                  />
                </div>

                {/* Media Type Toggle */}
                <div className="flex rounded-lg border border-[#242a36] bg-[#181c24] p-0.5 text-xs">
                  <button
                    onClick={() => setSearchType('movie')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      searchType === 'movie' ? 'bg-accent text-white' : 'text-[#9ca3af] hover:text-white'
                    }`}
                  >
                    Movie
                  </button>
                  <button
                    onClick={() => setSearchType('series')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      searchType === 'series' ? 'bg-accent text-white' : 'text-[#9ca3af] hover:text-white'
                    }`}
                  >
                    TV Series
                  </button>
                </div>
              </div>

              {/* Season / Episode and Language Row */}
              <div className="flex flex-wrap items-center gap-3">
                {searchType === 'series' && (
                  <>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-[#9ca3af]">Season:</span>
                      <input
                        type="number"
                        min={1}
                        value={searchSeason}
                        onChange={(e) => setSearchSeason(parseInt(e.target.value) || 1)}
                        className="w-16 bg-[#181c24] border border-[#242a36] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-[#9ca3af]">Episode:</span>
                      <input
                        type="number"
                        min={1}
                        value={searchEpisode}
                        onChange={(e) => setSearchEpisode(parseInt(e.target.value) || 1)}
                        className="w-16 bg-[#181c24] border border-[#242a36] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                  </>
                )}

                {/* Language Selector */}
                <div className="flex-1 min-w-[160px]">
                  <select
                    value={searchLanguage}
                    onChange={(e) => {
                      const newLang = e.target.value;
                      setSearchLanguage(newLang);
                      executeOnlineSearch(
                        searchTitle,
                        searchType,
                        searchSeason,
                        searchEpisode,
                        newLang,
                        activeVideo.imdbId
                      );
                    }}
                    className="w-full bg-[#181c24] border border-[#242a36] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                  >
                    {COMMON_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Trigger Button */}
                <button
                  onClick={() =>
                    executeOnlineSearch(
                      searchTitle,
                      searchType,
                      searchSeason,
                      searchEpisode,
                      searchLanguage,
                      activeVideo.imdbId
                    )
                  }
                  disabled={isSearching}
                  className="px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ml-auto"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2.5 min-h-[220px]">
              {isSearching ? (
                <div className="h-48 flex flex-col items-center justify-center text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-xs text-[#9ca3af]">
                    Querying open-source community catalog & OpenSubtitles repository...
                  </p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((sub) => {
                  const isDownloadingThis = downloadingId === sub.id;
                  const isCurrentActive = activeOnlineSubtitle?.url && activeOnlineSubtitle.label.includes(sub.languageName);

                  return (
                    <div
                      key={sub.id}
                      className="bg-[#181c24] border border-[#242a36] hover:border-[#374151] rounded-lg p-3.5 flex items-center justify-between transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 uppercase">
                            {sub.languageName || sub.language}
                          </span>
                          <span className="text-[10px] text-[#9ca3af] px-1.5 py-0.5 rounded bg-[#12151b] border border-[#242a36]">
                            {sub.source}
                          </span>
                        </div>
                        <div className="text-xs text-white font-medium truncate" title={sub.title}>
                          {sub.title || `${sub.languageName} Subtitles`}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDownloadSubtitle(sub)}
                        disabled={isDownloadingThis}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shrink-0 ${
                          isCurrentActive
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-accent hover:bg-accent-hover text-white'
                        }`}
                      >
                        {isDownloadingThis ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Downloading...</span>
                          </>
                        ) : isCurrentActive ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Download & Apply</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center space-y-2 text-[#9ca3af] text-xs">
                  <Globe className="w-8 h-8 text-[#4b5563]" />
                  <p className="max-w-md">{searchStatusMessage || 'Enter a title above and click Search to find subtitles.'}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#242a36] bg-[#0b0d11] flex items-center justify-between text-xs text-[#9ca3af]">
              <span>Downloaded subtitles are automatically converted to WebVTT & cached locally.</span>
              <button
                onClick={() => setShowOnlineModal(false)}
                className="px-4 py-1.5 bg-[#181c24] hover:bg-[#242a36] text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtitle Customization & Audio Sync Modal */}
      <SubtitleAudioSettingsModal
        isOpen={showSettingsModal}
        defaultTab={settingsModalTab}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
};
