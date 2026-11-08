import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import { ambientSound } from '../utils/ambientSound';
import { MediaFilePlaybackInfoDto, TrackDto } from '../types';

export interface SubtitleStyle {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  edgeStyle: 'none' | 'dropShadow' | 'outline' | 'raised';
  textShadow: string;
  verticalPosition: number;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 22,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  textColor: '#ffffff',
  bgColor: 'rgba(0, 0, 0, 0.70)',
  bgOpacity: 70,
  edgeStyle: 'dropShadow',
  textShadow: '0 2px 4px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.8)',
  verticalPosition: 8,
};

export const computeTextShadow = (edgeStyle: 'none' | 'dropShadow' | 'outline' | 'raised') => {
  switch (edgeStyle) {
    case 'outline':
      return '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 2px 4px rgba(0, 0, 0, 0.8)';
    case 'raised':
      return '0 1px 0 #000, 0 2px 0 #000, 0 3px 2px rgba(0, 0, 0, 0.8)';
    case 'none':
      return 'none';
    case 'dropShadow':
    default:
      return '0 2px 4px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.8)';
  }
};

export const computeBgColor = (opacity: number) => {
  if (opacity <= 0) return 'transparent';
  return `rgba(0, 0, 0, ${(opacity / 100).toFixed(2)})`;
};

interface PlayerContextType {
  // Video
  activeVideo: MediaFilePlaybackInfoDto | null;
  isVideoModalOpen: boolean;
  openVideoPlayer: (fileId: string) => Promise<void>;
  closeVideoPlayer: () => void;
  expandVideoPlayer: () => void;

  // Music & General
  activeTrack: TrackDto | null;
  queue: TrackDto[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  shuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isNowPlayingOpen: boolean;
  isEqualizerOpen: boolean;

  // Video specifics
  selectedAudioIndex: number;
  selectedSubtitleIndex: number;
  subtitleOffset: number;
  subtitleStyle: SubtitleStyle;
  audioSyncOffsetMs: number;

  // Audio Studio & Smart Enhancements
  isNormalized: boolean;
  toggleNormalization: () => void;
  isGapless: boolean;
  toggleGapless: () => void;
  crossfadeSeconds: number;
  setCrossfadeSeconds: (seconds: number) => void;
  sleepTimerMinutes: number | null;
  sleepTimerRemainingSeconds: number | null;
  setSleepTimer: (minutes: number | null) => void;

  // Actions
  playTrack: (track: TrackDto, queue?: TrackDto[]) => void;
  updateActiveTrackLyrics: (lyrics: string) => void;
  addToQueue: (track: TrackDto) => void;
  clearQueue: () => void;
  togglePlayPause: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setIsNowPlayingOpen: (open: boolean) => void;
  setIsEqualizerOpen: (open: boolean) => void;
  setSelectedAudioIndex: (idx: number) => void;
  setSelectedSubtitleIndex: (idx: number) => void;
  setSubtitleOffset: (offset: number) => void;
  setSubtitleStyle: (style: SubtitleStyle | ((prev: SubtitleStyle) => SubtitleStyle)) => void;
  resetSubtitleStyle: () => void;
  setAudioSyncOffsetMs: (offset: number | ((prev: number) => number)) => void;
  resetAudioSyncOffset: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  filtersRef: React.MutableRefObject<BiquadFilterNode[]>;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeVideo, setActiveVideo] = useState<MediaFilePlaybackInfoDto | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const [activeTrack, setActiveTrack] = useState<TrackDto | null>(null);
  const [queue, setQueue] = useState<TrackDto[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1.0);

  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);

  // Subtitles & Audio Tracks
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(-1);
  const [subtitleOffset, setSubtitleOffset] = useState(0);

  const [subtitleStyle, setSubtitleStyleState] = useState<SubtitleStyle>(() => {
    try {
      const saved = localStorage.getItem('vistara_subtitle_style');
      if (saved) {
        return { ...DEFAULT_SUBTITLE_STYLE, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_SUBTITLE_STYLE;
  });

  const setSubtitleStyle = (newStyle: SubtitleStyle | ((prev: SubtitleStyle) => SubtitleStyle)) => {
    setSubtitleStyleState((prev) => {
      const resolved = typeof newStyle === 'function' ? newStyle(prev) : newStyle;
      try {
        localStorage.setItem('vistara_subtitle_style', JSON.stringify(resolved));
      } catch {}
      return resolved;
    });
  };

  const resetSubtitleStyle = () => {
    setSubtitleStyle(DEFAULT_SUBTITLE_STYLE);
  };

  const [audioSyncOffsetMs, setAudioSyncOffsetMsState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('vistara_audio_sync_offset');
      if (saved !== null) return parseInt(saved, 10) || 0;
    } catch {}
    return 0;
  });

  const setAudioSyncOffsetMs = (val: number | ((prev: number) => number)) => {
    setAudioSyncOffsetMsState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('vistara_audio_sync_offset', String(next));
      } catch {}
      return next;
    });
  };

  const resetAudioSyncOffset = () => {
    setAudioSyncOffsetMs(0);
  };

  // Loudness Normalization (Auto Volume Leveling)
  const [isNormalized, setIsNormalized] = useState<boolean>(() => {
    return localStorage.getItem('vistara_audio_normalization') === 'true';
  });

  // DJ Crossfade (seconds, 0 = off / gapless)
  const [crossfadeSeconds, setCrossfadeSecondsState] = useState<number>(() => {
    const saved = localStorage.getItem('vistara_crossfade_seconds');
    return saved !== null ? parseInt(saved, 10) || 0 : 0;
  });

  const setCrossfadeSeconds = (sec: number) => {
    const clamped = Math.max(0, Math.min(12, sec));
    setCrossfadeSecondsState(clamped);
    try {
      localStorage.setItem('vistara_crossfade_seconds', String(clamped));
    } catch {}
  };

  // Gapless Playback (Dual-Deck Zero Latency Preload Engine)
  const [isGapless, setIsGaplessState] = useState<boolean>(() => {
    const saved = localStorage.getItem('vistara_gapless_playback');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleGapless = () => {
    setIsGaplessState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vistara_gapless_playback', String(next));
      } catch {}
      return next;
    });
  };

  // Smart Sleep Timer
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState<number | null>(null);

  const setSleepTimer = (minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    if (minutes === null || minutes === 0) {
      setSleepTimerRemainingSeconds(null);
    } else if (minutes === -1) {
      // End of current track mode
      setSleepTimerRemainingSeconds(-1);
    } else {
      setSleepTimerRemainingSeconds(minutes * 60);
    }
  };

  // Dual Audio Decks for seamless, clickless, zero-latency Gapless & Crossfade playback
  const deckARef = useRef<HTMLAudioElement | null>(null);
  const deckBRef = useRef<HTMLAudioElement | null>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeARef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceNodeBRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
  const mixerRef = useRef<GainNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const transitioningRef = useRef<boolean>(false);
  const preloadedTrackIdRef = useRef<string | null>(null);

  // Synchronized state refs for audio event callbacks and scheduler
  const activeTrackRef = useRef<TrackDto | null>(activeTrack);
  const queueRef = useRef<TrackDto[]>(queue);
  const queueIndexRef = useRef<number>(queueIndex);
  const isGaplessRef = useRef<boolean>(isGapless);
  const crossfadeSecondsRef = useRef<number>(crossfadeSeconds);
  const repeatModeRef = useRef<'off' | 'all' | 'one'>(repeatMode);
  const shuffleRef = useRef<boolean>(shuffle);
  const volumeRef = useRef<number>(volume);
  const isMutedRef = useRef<boolean>(isMuted);
  const playbackSpeedRef = useRef<number>(playbackSpeed);

  useEffect(() => {
    activeTrackRef.current = activeTrack;
    queueRef.current = queue;
    queueIndexRef.current = queueIndex;
    isGaplessRef.current = isGapless;
    crossfadeSecondsRef.current = crossfadeSeconds;
    repeatModeRef.current = repeatMode;
    shuffleRef.current = shuffle;
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
    playbackSpeedRef.current = playbackSpeed;
    audioRef.current = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
  });

  const toggleNormalization = () => {
    setIsNormalized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vistara_audio_normalization', String(next));
      } catch {}
      if (compressorRef.current) {
        compressorRef.current.threshold.value = next ? -24 : 0;
      }
      return next;
    });
  };

  // Initialize Web Audio API nodes with Dual-Deck Mixer for Seamless Transitions & Acoustics
  const setupAudioContext = () => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      return;
    }
    if (!deckARef.current || !deckBRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const sourceA = ctx.createMediaElementSource(deckARef.current);
      const sourceB = ctx.createMediaElementSource(deckBRef.current);
      sourceNodeARef.current = sourceA;
      sourceNodeBRef.current = sourceB;

      const gainA = ctx.createGain();
      const gainB = ctx.createGain();
      gainA.gain.value = activeDeckRef.current === 'A' ? 1 : 0;
      gainB.gain.value = activeDeckRef.current === 'B' ? 1 : 0;
      gainARef.current = gainA;
      gainBRef.current = gainB;

      sourceA.connect(gainA);
      sourceB.connect(gainB);

      const mixer = ctx.createGain();
      mixer.gain.value = 1;
      mixerRef.current = mixer;

      gainA.connect(mixer);
      gainB.connect(mixer);

      // 10 EQ bands: 32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k
      const frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const filters = frequencies.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        filter.frequency.value = freq;
        if (i === 0) filter.type = 'lowshelf';
        else if (i === frequencies.length - 1) filter.type = 'highshelf';
        else filter.type = 'peaking';
        filter.gain.value = 0;
        return filter;
      });

      // Chain filters from mixer
      let lastNode: AudioNode = mixer;
      filters.forEach((filter) => {
        lastNode.connect(filter);
        lastNode = filter;
      });

      // DynamicsCompressorNode for Studio Loudness Normalization
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = isNormalized ? -24 : 0;
      compressor.knee.value = 30;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      compressorRef.current = compressor;

      lastNode.connect(compressor);
      lastNode = compressor;

      // Master Analyser Node for butter-smooth visualizers
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      analyser.minDecibels = -85;
      analyser.maxDecibels = -15;

      lastNode.connect(analyser);
      analyser.connect(ctx.destination);

      analyserRef.current = analyser;
      filtersRef.current = filters;
    } catch (e) {
      console.warn('Web Audio Dual-Deck EQ & Visualizer initialization note:', e);
    }
  };

  const getNextIndex = () => {
    const q = queueRef.current;
    const qIdx = queueIndexRef.current;
    const rep = repeatModeRef.current;
    const shuf = shuffleRef.current;

    if (q.length === 0) return -1;
    if (shuf) {
      if (q.length === 1) return 0;
      let rnd = Math.floor(Math.random() * q.length);
      if (rnd === qIdx && q.length > 1) rnd = (rnd + 1) % q.length;
      return rnd;
    }
    const next = qIdx + 1;
    if (next >= q.length) {
      return rep === 'all' ? 0 : -1;
    }
    return next;
  };

  // Pre-buffers the next track in the inactive standby deck for 0-latency handoff
  const preloadUpcomingTrack = () => {
    if (!isGaplessRef.current && crossfadeSecondsRef.current === 0) return;
    const nextIdx = getNextIndex();
    const q = queueRef.current;
    if (nextIdx < 0 || !q[nextIdx]) {
      preloadedTrackIdRef.current = null;
      return;
    }
    const nextTrack = q[nextIdx];
    if (preloadedTrackIdRef.current === nextTrack.id) return;

    preloadedTrackIdRef.current = nextTrack.id;
    const standbyAudio = activeDeckRef.current === 'A' ? deckBRef.current : deckARef.current;
    if (standbyAudio) {
      standbyAudio.src = `/api/v1/stream/${nextTrack.mediaFileId}`;
      standbyAudio.preload = 'auto';
      standbyAudio.playbackRate = playbackSpeedRef.current;
      const effectiveVol = isMutedRef.current ? 0 : volumeRef.current;
      standbyAudio.volume = effectiveVol;
      standbyAudio.load();
    }
  };

  // Executes gapless handoff or DJ crossfade between Dual Decks
  const triggerTransition = (useCrossfade: boolean) => {
    if (transitioningRef.current) return;
    const nextIdx = getNextIndex();
    const q = queueRef.current;
    if (nextIdx < 0 || !q[nextIdx]) {
      setIsPlaying(false);
      return;
    }

    const nextTrack = q[nextIdx];
    transitioningRef.current = true;

    const currentDeckName = activeDeckRef.current;
    const targetDeckName = currentDeckName === 'A' ? 'B' : 'A';
    const currentAudio = currentDeckName === 'A' ? deckARef.current : deckBRef.current;
    const targetAudio = targetDeckName === 'A' ? deckARef.current : deckBRef.current;
    const currentGain = currentDeckName === 'A' ? gainARef.current : gainBRef.current;
    const targetGain = targetDeckName === 'A' ? gainARef.current : gainBRef.current;

    if (!targetAudio || !currentAudio) {
      transitioningRef.current = false;
      setQueueIndex(nextIdx);
      playTrack(nextTrack);
      return;
    }

    const targetSrc = `/api/v1/stream/${nextTrack.mediaFileId}`;
    if (!targetAudio.src.includes(nextTrack.mediaFileId)) {
      targetAudio.src = targetSrc;
      targetAudio.load();
    }

    targetAudio.currentTime = 0;
    targetAudio.playbackRate = playbackSpeedRef.current;
    const effectiveVol = isMutedRef.current ? 0 : volumeRef.current;
    targetAudio.volume = effectiveVol;

    const fadeDuration = useCrossfade ? Math.max(1, crossfadeSecondsRef.current) : 0.035;

    if (audioContextRef.current && audioContextRef.current.state === 'running' && currentGain && targetGain) {
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      currentGain.gain.setValueAtTime(currentGain.gain.value, now);
      currentGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

      targetGain.gain.setValueAtTime(0, now);
      targetGain.gain.linearRampToValueAtTime(1, now + fadeDuration);
    } else {
      targetAudio.volume = 0;
      const startMs = performance.now();
      const interval = setInterval(() => {
        const elapsed = (performance.now() - startMs) / 1000;
        const progress = Math.min(1, elapsed / fadeDuration);
        targetAudio.volume = effectiveVol * progress;
        currentAudio.volume = effectiveVol * (1 - progress);
        if (progress >= 1) clearInterval(interval);
      }, 25);
    }

    targetAudio.play().then(() => {
      setIsPlaying(true);
    }).catch((err) => {
      console.warn('Target deck play error, falling back:', err);
      if (!targetAudio.src.includes('transcode=true')) {
        targetAudio.src = `/api/v1/stream/${nextTrack.mediaFileId}?transcode=true&format=mp3`;
        targetAudio.play().catch(() => {});
      }
    });

    activeDeckRef.current = targetDeckName;
    audioRef.current = targetAudio;
    setActiveTrack(nextTrack);
    setQueueIndex(nextIdx);
    setCurrentTime(0);
    const nextDur = nextTrack.durationSeconds && Number.isFinite(nextTrack.durationSeconds) && nextTrack.durationSeconds > 0
      ? nextTrack.durationSeconds
      : 0;
    setDuration(nextDur);

    setTimeout(() => {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        if (currentGain) currentGain.gain.value = 0;
        if (targetGain) targetGain.gain.value = 1;
      } catch {}
      transitioningRef.current = false;
      preloadedTrackIdRef.current = null;
    }, (fadeDuration + 0.1) * 1000);
  };

  const openVideoPlayer = async (fileId: string) => {
    // Pause audio if playing
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    const res = await apiRequest<MediaFilePlaybackInfoDto>('/api/v1/playback/start', {
      method: 'POST',
      body: JSON.stringify({ mediaFileId: fileId }),
    });

    if (res.success && res.data) {
      setActiveVideo(res.data);
      setIsVideoModalOpen(true);
      setCurrentTime(res.data.resumePositionSeconds || 0);
      setDuration(res.data.durationSeconds || 0);
      setIsPlaying(true);

      const isAudio = (t: any) => t === 'Audio' || t === 2 || t === '2';
      const defaultAudio = res.data.streams?.find((s) => isAudio(s.type) && s.isDefault) || res.data.streams?.find((s) => isAudio(s.type));
      const validSelectedAudio = res.data.streams?.find((s) => isAudio(s.type) && s.index === res.data?.selectedAudioStreamIndex);
      setSelectedAudioIndex(validSelectedAudio ? validSelectedAudio.index : (defaultAudio?.index ?? 0));
    }
  };

  const closeVideoPlayer = () => {
    if (activeVideo) {
      // Send final stop progress
      apiRequest('/api/v1/playback/stop', {
        method: 'POST',
        body: JSON.stringify({ mediaFileId: activeVideo.mediaFileId }),
      }).catch(() => {});
    }
    setActiveVideo(null);
    setIsVideoModalOpen(false);
  };

  const expandVideoPlayer = () => {
    if (activeVideo) {
      setIsVideoModalOpen(true);
    }
  };

  const playTrack = (track: TrackDto, newQueue?: TrackDto[]) => {
    // If a video is currently open, close it
    if (activeVideo) {
      closeVideoPlayer();
    }

    setupAudioContext();

    // Reset transition state
    transitioningRef.current = false;
    preloadedTrackIdRef.current = null;

    if (deckARef.current) {
      deckARef.current.pause();
      deckARef.current.currentTime = 0;
    }
    if (deckBRef.current) {
      deckBRef.current.pause();
      deckBRef.current.currentTime = 0;
    }

    activeDeckRef.current = 'A';
    const activeAudio = deckARef.current;
    audioRef.current = activeAudio;

    if (gainARef.current) gainARef.current.gain.value = 1;
    if (gainBRef.current) gainBRef.current.gain.value = 0;

    setActiveTrack(track);
    setIsNowPlayingOpen(true);
    // Explicitly seed duration with track.durationSeconds to prevent Infinity timestamps
    const initialDuration = track.durationSeconds && Number.isFinite(track.durationSeconds) && track.durationSeconds > 0
      ? track.durationSeconds
      : 0;
    setDuration(initialDuration);
    setCurrentTime(0);

    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex((t) => t.id === track.id);
      setQueueIndex(idx >= 0 ? idx : 0);
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }

    if (activeAudio) {
      activeAudio.src = `/api/v1/stream/${track.mediaFileId}`;
      activeAudio.playbackRate = playbackSpeed;
      activeAudio.volume = isMuted ? 0 : volume;
      activeAudio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Initial direct play failed, trying transcoded fallback stream:', err);
        if (activeAudio && !activeAudio.src.includes('transcode=true')) {
          activeAudio.src = `/api/v1/stream/${track.mediaFileId}?transcode=true&format=mp3`;
          activeAudio.play().then(() => setIsPlaying(true)).catch((e2) => {
            console.error('Fallback play also failed:', e2);
          });
        }
      });
    }
  };

  const updateActiveTrackLyrics = (lyrics: string) => {
    setActiveTrack((prev) => (prev ? { ...prev, lyrics } : null));
    setQueue((prevQueue) =>
      prevQueue.map((t) => (t.id === activeTrack?.id || t.trackId === activeTrack?.trackId ? { ...t, lyrics } : t))
    );
  };

  const addToQueue = (track: TrackDto) => {
    setQueue((prev) => [...prev, track]);
  };

  const clearQueue = () => {
    setQueue([]);
    setQueueIndex(0);
  };

  const togglePlayPause = () => {
    if (activeVideo) {
      setIsPlaying((prev) => !prev);
    } else {
      const activeAudio = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
      if (activeAudio && activeTrack) {
        if (isPlaying) {
          activeAudio.pause();
          setIsPlaying(false);
        } else {
          setupAudioContext();
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }
          activeAudio.play().then(() => setIsPlaying(true)).catch((err) => {
            console.warn('Play resume failed, trying fallback stream:', err);
            if (activeAudio && activeTrack && !activeAudio.src.includes('transcode=true')) {
              activeAudio.src = `/api/v1/stream/${activeTrack.mediaFileId}?transcode=true&format=mp3`;
              activeAudio.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          });
        }
      }
    }
  };

  const seek = (seconds: number) => {
    if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) return;
    const safeDur = (Number.isFinite(duration) && duration > 0) ? duration : (activeTrack?.durationSeconds || 0);
    const target = safeDur > 0 ? Math.min(seconds, safeDur) : seconds;
    setCurrentTime(target);
    const activeAudio = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
    if (activeAudio && !activeVideo) {
      try {
        activeAudio.currentTime = target;
      } catch {}
    }
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    const effective = clamped === 0 ? 0 : clamped;
    if (deckARef.current) deckARef.current.volume = effective;
    if (deckBRef.current) deckBRef.current.volume = effective;
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      const effective = next ? 0 : volume;
      if (deckARef.current) deckARef.current.volume = effective;
      if (deckBRef.current) deckBRef.current.volume = effective;
      return next;
    });
  };

  const setPlaybackSpeed = (speed: number) => {
    setPlaybackSpeedState(speed);
    if (deckARef.current) deckARef.current.playbackRate = speed;
    if (deckBRef.current) deckBRef.current.playbackRate = speed;
  };

  const toggleShuffle = () => {
    setShuffle((prev) => !prev);
    preloadedTrackIdRef.current = null;
  };

  const cycleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
    preloadedTrackIdRef.current = null;
  };

  const nextTrack = () => {
    if (queue.length === 0) return;
    const nextIdx = getNextIndex();
    if (nextIdx < 0) return;
    if (isGapless || crossfadeSeconds > 0) {
      triggerTransition(crossfadeSeconds > 0);
    } else {
      setQueueIndex(nextIdx);
      playTrack(queue[nextIdx]);
    }
  };

  const previousTrack = () => {
    const activeAudio = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
    if (activeAudio && activeAudio.currentTime > 3) {
      seek(0);
      return;
    }
    if (queue.length === 0) return;
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) prevIdx = queue.length - 1;
    setQueueIndex(prevIdx);
    playTrack(queue[prevIdx]);
  };

  // Attach Dual-Deck audio event listeners
  useEffect(() => {
    const deckA = deckARef.current;
    const deckB = deckBRef.current;
    if (!deckA || !deckB) return;

    const createDeckHandlers = (deckName: 'A' | 'B', audio: HTMLAudioElement) => {
      const onTimeUpdate = () => {
        if (activeDeckRef.current !== deckName) return;

        if (Number.isFinite(audio.currentTime)) {
          setCurrentTime(audio.currentTime);
        }

        const safeDur = (Number.isFinite(audio.duration) && audio.duration > 0)
          ? audio.duration
          : (activeTrackRef.current?.durationSeconds && Number.isFinite(activeTrackRef.current.durationSeconds) ? activeTrackRef.current.durationSeconds : 0);

        const remaining = safeDur - audio.currentTime;

        // Preload upcoming track early in background
        if (audio.currentTime > 2) {
          preloadUpcomingTrack();
        }

        // Automatic Track Transitions
        if (
          crossfadeSecondsRef.current > 0 &&
          remaining <= crossfadeSecondsRef.current &&
          !transitioningRef.current &&
          safeDur > crossfadeSecondsRef.current * 1.5 &&
          queueRef.current.length > 1 &&
          repeatModeRef.current !== 'one'
        ) {
          triggerTransition(true);
        } else if (
          isGaplessRef.current &&
          crossfadeSecondsRef.current === 0 &&
          remaining <= 0.09 &&
          !transitioningRef.current &&
          safeDur > 2 &&
          (queueRef.current.length > 1 || repeatModeRef.current === 'all') &&
          repeatModeRef.current !== 'one'
        ) {
          triggerTransition(false);
        }
      };

      const syncDuration = () => {
        if (activeDeckRef.current !== deckName) return;
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        } else if (activeTrackRef.current?.durationSeconds && Number.isFinite(activeTrackRef.current.durationSeconds) && activeTrackRef.current.durationSeconds > 0) {
          setDuration(activeTrackRef.current.durationSeconds);
        }
      };

      const onEnded = () => {
        if (activeDeckRef.current !== deckName) return;

        if (sleepTimerRemainingSeconds === -1) {
          setSleepTimer(null);
          setIsPlaying(false);
          return;
        }

        if (repeatModeRef.current === 'one') {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else if (!transitioningRef.current) {
          triggerTransition(crossfadeSecondsRef.current > 0);
        }
      };

      const onError = () => {
        if (activeDeckRef.current !== deckName || !activeTrackRef.current) return;
        console.warn(`Audio playback error on direct stream for "${activeTrackRef.current.title}". Recovering with high-fidelity transcoded stream...`);
        if (!audio.src.includes('transcode=true')) {
          audio.src = `/api/v1/stream/${activeTrackRef.current.mediaFileId}?transcode=true&format=mp3`;
          audio.playbackRate = playbackSpeedRef.current;
          audio.volume = isMutedRef.current ? 0 : volumeRef.current;
          audio.play().then(() => setIsPlaying(true)).catch((e2) => {
            console.error('Fallback playback failed:', e2);
            setIsPlaying(false);
          });
        } else {
          setIsPlaying(false);
        }
      };

      return { onTimeUpdate, syncDuration, onEnded, onError };
    };

    const handlersA = createDeckHandlers('A', deckA);
    const handlersB = createDeckHandlers('B', deckB);

    deckA.addEventListener('timeupdate', handlersA.onTimeUpdate);
    deckA.addEventListener('loadedmetadata', handlersA.syncDuration);
    deckA.addEventListener('durationchange', handlersA.syncDuration);
    deckA.addEventListener('ended', handlersA.onEnded);
    deckA.addEventListener('error', handlersA.onError);

    deckB.addEventListener('timeupdate', handlersB.onTimeUpdate);
    deckB.addEventListener('loadedmetadata', handlersB.syncDuration);
    deckB.addEventListener('durationchange', handlersB.syncDuration);
    deckB.addEventListener('ended', handlersB.onEnded);
    deckB.addEventListener('error', handlersB.onError);

    return () => {
      deckA.removeEventListener('timeupdate', handlersA.onTimeUpdate);
      deckA.removeEventListener('loadedmetadata', handlersA.syncDuration);
      deckA.removeEventListener('durationchange', handlersA.syncDuration);
      deckA.removeEventListener('ended', handlersA.onEnded);
      deckA.removeEventListener('error', handlersA.onError);

      deckB.removeEventListener('timeupdate', handlersB.onTimeUpdate);
      deckB.removeEventListener('loadedmetadata', handlersB.syncDuration);
      deckB.removeEventListener('durationchange', handlersB.syncDuration);
      deckB.removeEventListener('ended', handlersB.onEnded);
      deckB.removeEventListener('error', handlersB.onError);
    };
  }, [sleepTimerRemainingSeconds]);

  // Sleep Timer countdown & gentle 20s volume fade-out
  useEffect(() => {
    if (sleepTimerRemainingSeconds === null || sleepTimerRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setSleepTimerRemainingSeconds((prev) => {
        if (prev === null || prev <= 0) return null;
        const next = prev - 1;

        // Smooth gradual volume fadeout over the final 20 seconds
        if (next <= 20 && next > 0 && audioRef.current) {
          const ratio = next / 20;
          audioRef.current.volume = Math.max(0, volume * ratio);
        }

        if (next <= 0) {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.volume = volume; // Restore normal volume setting
            setIsPlaying(false);
          }
          setSleepTimerMinutes(null);
          return null;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sleepTimerRemainingSeconds, isPlaying, volume]);

  // Auto-duck soothing ambient soundscape whenever active video or audio track is playing
  useEffect(() => {
    const isMediaActive = Boolean(activeVideo) || (Boolean(activeTrack) && isPlaying);
    ambientSound.duck(isMediaActive);
  }, [activeVideo, activeTrack, isPlaying]);

  return (
    <PlayerContext.Provider
      value={{
        activeVideo,
        isVideoModalOpen,
        openVideoPlayer,
        closeVideoPlayer,
        expandVideoPlayer,
        activeTrack,
        queue,
        queueIndex,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        playbackSpeed,
        shuffle,
        repeatMode,
        isNowPlayingOpen,
        isEqualizerOpen,
        selectedAudioIndex,
        selectedSubtitleIndex,
        subtitleOffset,
        subtitleStyle,
        audioSyncOffsetMs,
        isNormalized,
        toggleNormalization,
        isGapless,
        toggleGapless,
        crossfadeSeconds,
        setCrossfadeSeconds,
        sleepTimerMinutes,
        sleepTimerRemainingSeconds,
        setSleepTimer,
        playTrack,
        updateActiveTrackLyrics,
        addToQueue,
        clearQueue,
        togglePlayPause,
        seek,
        setVolume,
        toggleMute,
        setPlaybackSpeed,
        toggleShuffle,
        cycleRepeat,
        nextTrack,
        previousTrack,
        setIsNowPlayingOpen,
        setIsEqualizerOpen,
        setSelectedAudioIndex,
        setSelectedSubtitleIndex,
        setSubtitleOffset,
        setSubtitleStyle,
        resetSubtitleStyle,
        setAudioSyncOffsetMs,
        resetAudioSyncOffset,
        audioRef,
        audioContextRef,
        filtersRef,
        analyserRef,
      }}
    >
      {children}
      {/* Dual audio decks for true 0-latency gapless playback & DJ crossfade */}
      <audio ref={deckARef} preload="auto" crossOrigin="anonymous" />
      <audio ref={deckBRef} preload="auto" crossOrigin="anonymous" />
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};

