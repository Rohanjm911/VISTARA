import React, { useState, useRef, useCallback } from 'react';

interface AudioProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  isPlaying?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTimeLabels?: boolean;
  className?: string;
}

export const AudioProgressBar: React.FC<AudioProgressBarProps> = ({
  currentTime,
  duration,
  onSeek,
  isPlaying = false,
  size = 'md',
  showTimeLabels = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const rawCurrent = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
  const activeTime = isDragging && dragValue !== null ? dragValue : rawCurrent;

  const progressPercent = safeDuration > 0 ? Math.min(100, Math.max(0, (activeTime / safeDuration) * 100)) : 0;
  const hoverPercent = hoverPosition !== null ? hoverPosition * 100 : null;
  const hoverTime = hoverPosition !== null && safeDuration > 0 ? hoverPosition * safeDuration : null;

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs <= 0) return '0:00';
    const total = Math.floor(secs);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const calculateHoverFromEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      return rect.width > 0 ? x / rect.width : 0;
    },
    []
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pos = calculateHoverFromEvent(e);
    setHoverPosition(pos);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(true);
    const pos = calculateHoverFromEvent(e);
    setHoverPosition(pos);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setHoverPosition(null);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setDragValue(val);
    onSeek(val);
  };

  // Dimensions based on size prop
  const trackHeight =
    size === 'sm'
      ? 'h-1 group-hover:h-1.5'
      : size === 'lg'
      ? 'h-2 group-hover:h-2.5'
      : 'h-1.5 group-hover:h-2';

  const thumbSize =
    size === 'sm'
      ? 'w-3 h-3'
      : size === 'lg'
      ? 'w-4 h-4'
      : 'w-3.5 h-3.5';

  return (
    <div className={`w-full flex items-center space-x-2.5 select-none ${className}`}>
      {/* Current Time Display with Playing Indicator */}
      {showTimeLabels && (
        <div className="flex items-center space-x-1 flex-shrink-0">
          {isPlaying && (
            <div className="flex items-end space-x-[2px] h-3 mr-0.5" title="Now Playing">
              <span className="w-[2px] bg-accent rounded-full animate-eq-bar-1 h-2.5" />
              <span className="w-[2px] bg-accent rounded-full animate-eq-bar-2 h-1.5" />
              <span className="w-[2px] bg-accent rounded-full animate-eq-bar-3 h-3" />
            </div>
          )}
          <span
            className={`font-mono text-right tabular-nums transition-colors duration-150 ${
              size === 'sm' ? 'text-[10px] w-8' : 'text-[11px] w-9'
            } ${
              isPlaying ? 'text-accent font-bold' : 'text-[#a4afb9]'
            }`}
          >
            {formatTime(activeTime)}
          </span>
        </div>
      )}

      {/* Main Scrubber Track Area */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="flex-1 relative flex items-center group py-2.5 cursor-pointer touch-none"
      >
        {/* Floating Timestamp Tooltip with Smooth Fade/Pop */}
        {isHovered && hoverPercent !== null && hoverTime !== null && (
          <div
            className="absolute -top-7 -translate-x-1/2 pointer-events-none z-30 transition-all duration-150 ease-out"
            style={{ left: `${hoverPercent}%` }}
          >
            <div className="relative px-2 py-0.5 rounded bg-[#151a21] border border-accent/40 text-[10px] font-mono font-bold text-accent shadow-lg flex items-center">
              <span>{formatTime(hoverTime)}</span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#303a45]" />
            </div>
          </div>
        )}

        {/* Clean Solid Track Background with Smooth Expand & Ambient Teal Glow */}
        <div
          className={`w-full ${trackHeight} bg-[#222b35] border border-[#303a45]/60 rounded-full overflow-hidden relative transition-all duration-200 ease-out group-hover:shadow-[0_0_10px_rgba(53,198,176,0.2)]`}
        >
          {/* Hover Ghost Seek Preview */}
          {hoverPercent !== null && (
            <div
              className="absolute inset-y-0 left-0 bg-white/15 rounded-full pointer-events-none transition-all duration-75"
              style={{ width: `${hoverPercent}%` }}
            />
          )}

          {/* Active Played Fill Bar (Clean Solid Accent) */}
          <div
            className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-75 relative overflow-hidden"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Live Playback Micro-Gleam Energy Stream Animation */}
            {isPlaying && (
              <div className="absolute inset-y-0 w-12 bg-white/35 pointer-events-none animate-stream-glide" />
            )}
          </div>
        </div>

        {/* Scrubber Pin / Thumb with Breathing Glow and Pulse Ripple Effects */}
        <div
          className="absolute top-1/2 pointer-events-none z-10 transition-transform duration-100 ease-out flex items-center justify-center"
          style={{
            left: `${progressPercent}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Active Playback Soundwave Halo Animation */}
          {isPlaying && (
            <>
              <span className="absolute w-5 h-5 rounded-full bg-accent/30 animate-ping opacity-75" />
              <span className="absolute w-4 h-4 rounded-full bg-accent/25 animate-pulse" />
            </>
          )}

          {/* Core Scrubber Thumb */}
          <div
            className={`${thumbSize} rounded-full bg-white ring-2 ring-accent shadow-[0_0_10px_rgba(53,198,176,0.8)] transition-all duration-150 ease-out ${
              isDragging ? 'scale-125 ring-4 shadow-[0_0_14px_rgba(53,198,176,1)]' : 'group-hover:scale-135'
            }`}
          />
        </div>

        {/* Accessible Native Range Slider for Keyboard & Touch/Mouse Support */}
        <input
          type="range"
          min={0}
          max={safeDuration || 100}
          step={0.1}
          value={Math.min(activeTime, safeDuration || 100)}
          onChange={handleSliderChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => {
            setIsDragging(false);
            setDragValue(null);
          }}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => {
            setIsDragging(false);
            setDragValue(null);
          }}
          aria-label="Audio playback seek scrubber"
          aria-valuemin={0}
          aria-valuemax={safeDuration || 100}
          aria-valuenow={activeTime}
          aria-valuetext={`${formatTime(activeTime)} of ${formatTime(safeDuration)}`}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />
      </div>

      {/* Total Duration Display */}
      {showTimeLabels && (
        <span
          className={`font-mono tabular-nums text-[#a4afb9] transition-colors ${
            size === 'sm' ? 'text-[10px] w-8' : 'text-[11px] w-9'
          }`}
        >
          {formatTime(safeDuration)}
        </span>
      )}
    </div>
  );
};
