import React from 'react';
import {
  Maximize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Volume2,
  VolumeX,
  Moon,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { MiniVisualizer } from './MiniVisualizer';
import { AudioProgressBar } from './AudioProgressBar';

export const MiniPlayer: React.FC = () => {
  const {
    activeVideo,
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    nextTrack,
    previousTrack,
    expandVideoPlayer,
    setIsEqualizerOpen,
    setIsNowPlayingOpen,
    analyserRef,
    sleepTimerRemainingSeconds,
  } = usePlayer();

  if (!activeVideo && !activeTrack) return null;

  const title = activeVideo ? activeVideo.title : activeTrack?.title;
  const subtitle = activeVideo
    ? (activeVideo.videoCodec ? `${activeVideo.videoCodec.toUpperCase()} • ${activeVideo.height ? `${activeVideo.height}p` : 'Video'}` : 'Video')
    : (activeTrack?.artistName || 'Unknown Artist');

  const artworkUrl = activeTrack?.artworkUrl || (activeVideo ? `/api/v1/stream/${activeVideo.mediaFileId}/thumbnail` : null);

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
    : (activeTrack?.durationSeconds && Number.isFinite(activeTrack.durationSeconds) && activeTrack.durationSeconds > 0
        ? activeTrack.durationSeconds
        : (activeVideo?.durationSeconds && Number.isFinite(activeVideo.durationSeconds) && activeVideo.durationSeconds > 0
            ? activeVideo.durationSeconds
            : 0));
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;

  return (
    <div className="h-[76px] bg-[#0c1017]/85 backdrop-blur-2xl border-t border-white/[0.08] px-6 flex items-center justify-between select-none relative z-20 shadow-[0_-12px_40px_rgba(0,0,0,0.4)]">
      {/* Left Media Details */}
      <div className="flex items-center space-x-3.5 min-w-[270px] max-w-md sm:max-w-lg">
        <div
          onClick={() => {
            if (activeVideo) expandVideoPlayer();
            else setIsNowPlayingOpen(true);
          }}
          className={`relative cursor-pointer transition-all duration-300 flex-shrink-0 group ${
            isPlaying && activeTrack ? 'shadow-[0_4px_20px_rgba(56,189,248,0.35)]' : 'hover:opacity-90'
          }`}
          title="Open Now Playing Screen"
        >
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt={title}
              className="w-12 h-12 object-cover rounded-xl bg-white/[0.05] border border-white/[0.1] shadow-md group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-accent font-bold text-sm group-hover:scale-105 transition-transform duration-200 shadow-md">
              V
            </div>
          )}

          {/* Animated jumping equalizer pill on artwork thumbnail when audio is playing */}
          {activeTrack && isPlaying && (
            <div className="absolute inset-0 bg-black/45 rounded-xl flex items-center justify-center backdrop-blur-[1px] transition-opacity">
              <div className="flex items-end space-x-0.5 h-4">
                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-1" />
                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-2" />
                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-3" />
                <span className="w-0.5 bg-accent rounded-full animate-eq-bar-4" />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden flex-1 min-w-0">
          <div
            onClick={() => {
              if (activeVideo) expandVideoPlayer();
              else setIsNowPlayingOpen(true);
            }}
            className="text-[13px] font-bold text-white tracking-tight truncate cursor-pointer hover:text-accent transition-colors"
          >
            {title}
          </div>
          <div className="text-[11px] text-white/55 font-medium truncate">{subtitle}</div>
        </div>

        {/* Chota Smooth Visualizer Widget in the Bottom Bar with Dynamic Glow */}
        {activeTrack && (
          <div
            onClick={() => setIsNowPlayingOpen(true)}
            className={`flex items-center justify-center w-20 sm:w-24 h-8 px-1.5 py-0.5 rounded-xl cursor-pointer transition-all duration-300 group flex-shrink-0 shadow-inner ml-1 ${
              isPlaying
                ? 'bg-white/[0.06] border border-accent/50 shadow-[0_0_14px_rgba(56,189,248,0.25)] hover:scale-105 hover:border-accent'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-accent/40'
            }`}
            title="Now Playing Spectrum • Click to open Now Playing"
          >
            <MiniVisualizer
              analyserRef={analyserRef}
              isPlaying={isPlaying}
              bars={8}
            />
          </div>
        )}
      </div>

      {/* Middle Player Controls & Timeline Slider */}
      <div className="flex flex-col items-center flex-1 max-w-xl px-4">
        <div className="flex items-center space-x-4 mb-1">
          {activeTrack && (
            <button
              onClick={toggleShuffle}
              title="Shuffle"
              className={`p-1.5 rounded-full text-xs transition-all duration-150 hover:scale-110 active:scale-90 cursor-pointer ${
                shuffle ? 'text-accent bg-accent/15' : 'text-white/50 hover:text-white'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={previousTrack}
            title="Previous Track"
            className="p-1.5 rounded-full text-white/65 hover:text-white transition-all duration-150 hover:scale-110 active:scale-90 cursor-pointer"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            className={`w-9 h-9 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-md shadow-white/20 cursor-pointer ${
              isPlaying ? 'ring-2 ring-white/30' : ''
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
          </button>

          <button
            onClick={nextTrack}
            title="Next Track"
            className="p-1.5 rounded-full text-white/65 hover:text-white transition-all duration-150 hover:scale-110 active:scale-90 cursor-pointer"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          {activeTrack && (
            <button
              onClick={cycleRepeat}
              title={`Repeat: ${repeatMode}`}
              className={`p-1.5 rounded-full text-xs transition-all duration-150 hover:scale-110 active:scale-90 cursor-pointer ${
                repeatMode !== 'off' ? 'text-accent bg-accent/15' : 'text-white/50 hover:text-white'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Seek timeline bar with smooth expansion, shimmer wave, and pulsing glow */}
        <AudioProgressBar
          currentTime={safeCurrentTime}
          duration={safeDuration}
          onSeek={seek}
          isPlaying={isPlaying}
          size="sm"
          className="w-full"
        />
      </div>

      {/* Right Controls: Volume, EQ, Expand */}
      <div className="flex items-center justify-end space-x-2.5 w-1/4 min-w-[200px]">
        {activeTrack && (
          <button
            onClick={() => setIsEqualizerOpen(true)}
            title={
              sleepTimerRemainingSeconds !== null
                ? `Sleep Timer: ${sleepTimerRemainingSeconds === -1 ? 'End of Track' : `${Math.ceil(sleepTimerRemainingSeconds / 60)}m left`}`
                : 'Sleep Timer'
            }
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              sleepTimerRemainingSeconds !== null
                ? 'bg-accent/20 text-accent border border-accent/40'
                : 'text-white/60 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            {sleepTimerRemainingSeconds !== null && (
              <span className="text-[10px] font-mono hidden xl:inline font-semibold">
                {sleepTimerRemainingSeconds === -1 ? 'End' : `${Math.ceil(sleepTimerRemainingSeconds / 60)}m`}
              </span>
            )}
          </button>
        )}

        {activeTrack && (
          <button
            onClick={() => setIsEqualizerOpen(true)}
            title="Audio Equalizer & Studio Processing"
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center space-x-2">
          <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors cursor-pointer">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            onInput={(e) => setVolume(parseFloat((e.target as HTMLInputElement).value))}
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            className="w-20 h-1 bg-white/[0.12] rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </div>

        {activeVideo ? (
          <button
            onClick={expandVideoPlayer}
            title="Expand Full Video Player"
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors ml-2 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setIsNowPlayingOpen(true)}
            title="Open Now Playing Screen"
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors ml-2 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

