import React, { useState } from 'react';
import {
  Check,
  Eye,
  MoveVertical,
  Palette,
  RotateCcw,
  Sliders,
  Subtitles,
  Type,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import {
  computeBgColor,
  computeTextShadow,
  DEFAULT_SUBTITLE_STYLE,
  SubtitleStyle,
  usePlayer,
} from '../context/PlayerContext';

interface SubtitleAudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'subtitles' | 'audio';
}

const FONT_FAMILIES = [
  {
    id: 'sans',
    name: 'Clean Sans (Modern)',
    family: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: 'serif',
    name: 'Cinematic Serif',
    family: 'Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    id: 'mono',
    name: 'Studio Monospace',
    family: '"JetBrains Mono", Consolas, "Courier New", monospace',
  },
  {
    id: 'impact',
    name: 'Bold Impact',
    family: 'Impact, "Arial Black", sans-serif',
  },
  {
    id: 'trebuchet',
    name: 'Rounded Trebuchet',
    family: '"Trebuchet MS", "Lucida Grande", sans-serif',
  },
];

const COLOR_PRESETS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Cine Yellow', hex: '#FACC15' },
  { name: 'Electric Cyan', hex: '#38BDF8' },
  { name: 'Mint Green', hex: '#4ADE80' },
  { name: 'Neon Coral', hex: '#FB7185' },
  { name: 'Sunset Amber', hex: '#FB923C' },
];

const OPACITY_PRESETS = [
  { label: 'None', value: 0 },
  { label: 'Subtle 30%', value: 30 },
  { label: 'Medium 60%', value: 60 },
  { label: 'Default 70%', value: 70 },
  { label: 'Heavy 85%', value: 85 },
  { label: 'Solid 100%', value: 100 },
];

const EDGE_STYLES: Array<{
  id: 'none' | 'dropShadow' | 'outline' | 'raised';
  label: string;
}> = [
  { id: 'dropShadow', label: 'Drop Shadow' },
  { id: 'outline', label: 'Solid Outline' },
  { id: 'raised', label: 'Raised 3D' },
  { id: 'none', label: 'None' },
];

export const SubtitleAudioSettingsModal: React.FC<SubtitleAudioSettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'subtitles',
}) => {
  const [activeTab, setActiveTab] = useState<'subtitles' | 'audio'>(defaultTab);
  const [isTestFlashing, setIsTestFlashing] = useState(false);

  const {
    subtitleStyle,
    setSubtitleStyle,
    resetSubtitleStyle,
    subtitleOffset,
    setSubtitleOffset,
    audioSyncOffsetMs,
    setAudioSyncOffsetMs,
    resetAudioSyncOffset,
  } = usePlayer();

  if (!isOpen) return null;

  // Sound & Visual Flash Calibration Test Tone
  const playSyncTestPulse = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.09);

      setIsTestFlashing(true);
      setTimeout(() => setIsTestFlashing(false), 90);
    } catch {
      setIsTestFlashing(true);
      setTimeout(() => setIsTestFlashing(false), 90);
    }
  };

  const handleEdgeStyleChange = (edge: 'none' | 'dropShadow' | 'outline' | 'raised') => {
    setSubtitleStyle((prev) => ({
      ...prev,
      edgeStyle: edge,
      textShadow: computeTextShadow(edge),
    }));
  };

  const handleOpacityChange = (opacity: number) => {
    setSubtitleStyle((prev) => ({
      ...prev,
      bgOpacity: opacity,
      bgColor: computeBgColor(opacity),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#000000]/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#12151b] border border-[#242a36] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-[#242a36] bg-[#0b0d11]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              {activeTab === 'subtitles' ? <Subtitles className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Player Calibration & Styling
              </h2>
              <p className="text-[11px] text-[#9ca3af]">
                Pixel-perfect subtitle appearance & real-time audio sync delay
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tab Switcher */}
            <div className="flex bg-[#181c24] border border-[#242a36] rounded-lg p-0.5 text-xs mr-2">
              <button
                onClick={() => setActiveTab('subtitles')}
                className={`px-3 py-1 rounded-md flex items-center space-x-1.5 font-medium transition-colors ${
                  activeTab === 'subtitles'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>Subtitles</span>
              </button>
              <button
                onClick={() => setActiveTab('audio')}
                className={`px-3 py-1 rounded-md flex items-center space-x-1.5 font-medium transition-colors ${
                  activeTab === 'audio'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Audio Sync</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9ca3af] hover:text-white hover:bg-[#181c24] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'subtitles' ? (
            <>
              {/* Live Preview Card */}
              <div className="relative rounded-lg border border-[#242a36] bg-[#000000] h-36 flex flex-col justify-end items-center p-4 overflow-hidden shadow-inner">
                {/* Cinema Ambient Background Simulator */}
                <div className="absolute inset-0 bg-[#0f141d]/70 pointer-events-none" />
                <div className="absolute top-2 left-3 flex items-center space-x-1.5 text-[10px] uppercase font-mono tracking-wider text-[#6b7280]">
                  <Eye className="w-3 h-3 text-accent" />
                  <span>Real-Time Subtitle Preview</span>
                </div>

                <div
                  className="relative z-10 text-center transition-all duration-150"
                  style={{
                    fontFamily: subtitleStyle.fontFamily,
                    fontSize: `${Math.min(subtitleStyle.fontSize, 28)}px`,
                    color: subtitleStyle.textColor,
                    backgroundColor: subtitleStyle.bgColor,
                    textShadow: subtitleStyle.textShadow,
                    borderRadius: '6px',
                    padding: subtitleStyle.bgOpacity > 0 ? '4px 14px' : '0px',
                    maxWidth: '90%',
                    lineHeight: 1.35,
                  }}
                >
                  The quick brown fox jumps over the lazy dog.
                  <div className="text-[10px] opacity-75 font-normal mt-0.5">
                    नमस्ते • Hello World • Vistara Cinema
                  </div>
                </div>
              </div>

              {/* Font Size & Family Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Font Size */}
                <div className="bg-[#181c24] border border-[#242a36] rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white flex items-center space-x-1.5">
                      <Type className="w-3.5 h-3.5 text-accent" />
                      <span>Font Size</span>
                    </span>
                    <span className="font-mono text-accent font-bold">
                      {subtitleStyle.fontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={14}
                    max={44}
                    step={1}
                    value={subtitleStyle.fontSize}
                    onChange={(e) =>
                      setSubtitleStyle((prev) => ({
                        ...prev,
                        fontSize: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full h-1.5 bg-[#242a36] rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                  <div className="flex justify-between text-[10px] text-[#9ca3af]">
                    {[16, 20, 24, 28, 36].map((sz) => (
                      <button
                        key={sz}
                        onClick={() =>
                          setSubtitleStyle((prev) => ({ ...prev, fontSize: sz }))
                        }
                        className={`px-1.5 py-0.5 rounded hover:text-white ${
                          subtitleStyle.fontSize === sz
                            ? 'text-accent font-bold'
                            : ''
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Family */}
                <div className="bg-[#181c24] border border-[#242a36] rounded-lg p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-white flex items-center space-x-1.5">
                    <Type className="w-3.5 h-3.5 text-accent" />
                    <span>Font Family</span>
                  </div>
                  <select
                    value={
                      FONT_FAMILIES.find((f) => f.family === subtitleStyle.fontFamily)?.id ||
                      'sans'
                    }
                    onChange={(e) => {
                      const found = FONT_FAMILIES.find((f) => f.id === e.target.value);
                      if (found) {
                        setSubtitleStyle((prev) => ({
                          ...prev,
                          fontFamily: found.family,
                        }));
                      }
                    }}
                    className="w-full bg-[#12151b] border border-[#242a36] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Text Color & Edge Style */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Text Color */}
                <div className="bg-[#181c24] border border-[#242a36] rounded-lg p-3.5 space-y-2.5">
                  <div className="text-xs font-semibold text-white flex items-center space-x-1.5">
                    <Palette className="w-3.5 h-3.5 text-accent" />
                    <span>Text Color</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {COLOR_PRESETS.map((color) => {
                      const isSelected =
                        subtitleStyle.textColor.toLowerCase() === color.hex.toLowerCase();
                      return (
                        <button
                          key={color.hex}
                          onClick={() =>
                            setSubtitleStyle((prev) => ({
                              ...prev,
                              textColor: color.hex,
                            }))
                          }
                          title={color.name}
                          style={{ backgroundColor: color.hex }}
                          className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${
                            isSelected
                              ? 'border-white scale-110 shadow-md ring-2 ring-accent'
                              : 'border-transparent'
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Edge Style / Text Shadow */}
                <div className="bg-[#181c24] border border-[#242a36] rounded-lg p-3.5 space-y-2.5">
                  <div className="text-xs font-semibold text-white flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-accent" />
                    <span>Edge Style</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {EDGE_STYLES.map((edge) => (
                      <button
                        key={edge.id}
                        onClick={() => handleEdgeStyleChange(edge.id)}
                        className={`px-2 py-1.5 rounded text-xs text-center transition-colors ${
                          subtitleStyle.edgeStyle === edge.id
                            ? 'bg-accent text-white font-medium'
                            : 'bg-[#12151b] text-[#9ca3af] hover:text-white hover:bg-[#202530]'
                        }`}
                      >
                        {edge.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Background Opacity & Vertical Position */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Background Box Opacity */}
                <div className="bg-[#181c24] border border-[#242a36] rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Background Box</span>
                    <span className="font-mono text-accent font-bold">
                      {subtitleStyle.bgOpacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={subtitleStyle.bgOpacity}
                    onChange={(e) => handleOpacityChange(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-[#242a36] rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                  <div className="grid grid-cols-3 gap-1">
                    {OPACITY_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => handleOpacityChange(p.value)}
                        className={`text-[10px] py-0.5 rounded ${
                          subtitleStyle.bgOpacity === p.value
                            ? 'bg-accent/20 text-accent font-semibold border border-accent/40'
                            : 'bg-[#12151b] text-[#9ca3af] hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vertical Position (% from bottom) */}
                <div className="bg-[#181c24] border border-[#242a36] rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white flex items-center space-x-1.5">
                      <MoveVertical className="w-3.5 h-3.5 text-accent" />
                      <span>Vertical Position</span>
                    </span>
                    <span className="font-mono text-accent font-bold">
                      {subtitleStyle.verticalPosition ?? 8}% from bottom
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={30}
                    step={1}
                    value={subtitleStyle.verticalPosition ?? 8}
                    onChange={(e) =>
                      setSubtitleStyle((prev) => ({
                        ...prev,
                        verticalPosition: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full h-1.5 bg-[#242a36] rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                  <div className="flex justify-between text-[11px] text-[#9ca3af]">
                    {[
                      { label: 'Low (6%)', val: 6 },
                      { label: 'Standard (10%)', val: 10 },
                      { label: 'Elevated (18%)', val: 18 },
                    ].map((pos) => (
                      <button
                        key={pos.label}
                        onClick={() =>
                          setSubtitleStyle((prev) => ({
                            ...prev,
                            verticalPosition: pos.val,
                          }))
                        }
                        className={`hover:text-white ${
                          (subtitleStyle.verticalPosition ?? 8) === pos.val
                            ? 'text-accent font-bold'
                            : ''
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Subtitle Sync Offset Calibration */}
              <div className="bg-[#181c24] border border-[#242a36] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Subtitle Sync Timing Offset
                    </div>
                    <div className="text-[11px] text-[#9ca3af]">
                      Compensate if subtitles appear earlier or later than spoken dialogue
                    </div>
                  </div>
                  <span className="text-sm font-mono font-bold text-accent">
                    {subtitleOffset > 0
                      ? `+${subtitleOffset.toFixed(2)}s (+${Math.round(subtitleOffset * 1000)}ms)`
                      : subtitleOffset < 0
                      ? `${subtitleOffset.toFixed(2)}s (${Math.round(subtitleOffset * 1000)}ms)`
                      : '0.00s (0ms)'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSubtitleOffset(subtitleOffset - 1.0)}
                    className="px-2.5 py-1 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono"
                  >
                    -1.0s
                  </button>
                  <button
                    onClick={() => setSubtitleOffset(subtitleOffset - 0.25)}
                    className="px-2.5 py-1 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono"
                  >
                    -250ms
                  </button>
                  <button
                    onClick={() => setSubtitleOffset(subtitleOffset - 0.05)}
                    className="px-2.5 py-1 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono"
                  >
                    -50ms
                  </button>
                  <button
                    onClick={() => setSubtitleOffset(0)}
                    className="px-3 py-1 bg-accent/20 hover:bg-accent text-white rounded text-xs font-medium border border-accent/40"
                  >
                    Reset (0s)
                  </button>
                  <button
                    onClick={() => setSubtitleOffset(subtitleOffset + 0.05)}
                    className="px-2.5 py-1 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono"
                  >
                    +50ms
                  </button>
                  <button
                    onClick={() => setSubtitleOffset(subtitleOffset + 0.25)}
                    className="px-2.5 py-1 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono"
                  >
                    +250ms
                  </button>
                  <button
                    onClick={() => setSubtitleOffset(subtitleOffset + 1.0)}
                    className="px-2.5 py-1 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono"
                  >
                    +1.0s
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Audio Sync Tab */
            <>
              {/* Status Header Badge */}
              <div className="bg-[#181c24] border border-[#242a36] rounded-xl p-5 text-center space-y-2">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#12151b] border border-[#242a36] text-xs">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      audioSyncOffsetMs === 0 ? 'bg-emerald-400' : 'bg-accent animate-pulse'
                    }`}
                  />
                  <span className="font-mono font-bold text-white">
                    {audioSyncOffsetMs === 0
                      ? 'In Sync (0 ms)'
                      : audioSyncOffsetMs > 0
                      ? `Audio Delayed (+${audioSyncOffsetMs} ms)`
                      : `Audio Advanced (${audioSyncOffsetMs} ms)`}
                  </span>
                </div>
                <p className="text-xs text-[#9ca3af] max-w-md mx-auto">
                  Fine-tune audio stream synchronization live. Changes apply immediately to the
                  Web Audio pipeline and hardware stream muxer with zero playback stutter.
                </p>
              </div>

              {/* Delay Calibration Slider */}
              <div className="bg-[#181c24] border border-[#242a36] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center space-x-1.5">
                    <Sliders className="w-4 h-4 text-accent" />
                    <span>Audio Offset Calibration Slider</span>
                  </span>
                  <span className="font-mono text-sm font-bold text-accent">
                    {audioSyncOffsetMs > 0
                      ? `+${audioSyncOffsetMs} ms`
                      : `${audioSyncOffsetMs} ms`}
                  </span>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min={-2000}
                    max={2000}
                    step={25}
                    value={audioSyncOffsetMs}
                    onChange={(e) => setAudioSyncOffsetMs(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-[#12151b] rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#6b7280]">
                    <span>-2000 ms</span>
                    <span>-1000 ms</span>
                    <span className="text-white font-bold">0 ms</span>
                    <span>+1000 ms</span>
                    <span>+2000 ms</span>
                  </div>
                </div>

                {/* Quick Step Buttons */}
                <div className="grid grid-cols-7 gap-1.5 pt-2">
                  <button
                    onClick={() => setAudioSyncOffsetMs((prev) => Math.max(-5000, prev - 500))}
                    className="px-2 py-1.5 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono text-center"
                    title="Advance Audio 500ms"
                  >
                    -500ms
                  </button>
                  <button
                    onClick={() => setAudioSyncOffsetMs((prev) => Math.max(-5000, prev - 100))}
                    className="px-2 py-1.5 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono text-center"
                    title="Advance Audio 100ms"
                  >
                    -100ms
                  </button>
                  <button
                    onClick={() => setAudioSyncOffsetMs((prev) => Math.max(-5000, prev - 50))}
                    className="px-2 py-1.5 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono text-center"
                    title="Advance Audio 50ms"
                  >
                    -50ms
                  </button>
                  <button
                    onClick={resetAudioSyncOffset}
                    className="px-2 py-1.5 bg-accent/20 hover:bg-accent text-white border border-accent/40 rounded text-xs font-medium text-center"
                  >
                    0ms
                  </button>
                  <button
                    onClick={() => setAudioSyncOffsetMs((prev) => Math.min(5000, prev + 50))}
                    className="px-2 py-1.5 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono text-center"
                    title="Delay Audio 50ms"
                  >
                    +50ms
                  </button>
                  <button
                    onClick={() => setAudioSyncOffsetMs((prev) => Math.min(5000, prev + 100))}
                    className="px-2 py-1.5 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono text-center"
                    title="Delay Audio 100ms"
                  >
                    +100ms
                  </button>
                  <button
                    onClick={() => setAudioSyncOffsetMs((prev) => Math.min(5000, prev + 500))}
                    className="px-2 py-1.5 bg-[#12151b] hover:bg-[#202530] text-[#d1d5db] hover:text-white rounded text-xs font-mono text-center"
                    title="Delay Audio 500ms"
                  >
                    +500ms
                  </button>
                </div>
              </div>

              {/* Troubleshooting & Calibration Advice Card */}
              <div className="bg-[#181c24] border border-[#242a36] rounded-xl p-4 text-xs text-[#9ca3af] space-y-2">
                <div className="font-semibold text-white flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-accent" />
                  <span>How to calibrate like a pro</span>
                </div>
                <div className="space-y-1.5 text-[11px] leading-relaxed">
                  <p>
                    • <strong className="text-white">Actor moves lips before sound:</strong>{' '}
                    The audio is delayed; click <span className="font-mono text-accent">[-] 50ms</span>{' '}
                    or drag left to advance audio.
                  </p>
                  <p>
                    • <strong className="text-white">Sound heard before actor moves lips:</strong>{' '}
                    The audio is too fast; click <span className="font-mono text-accent">[+] 50ms</span>{' '}
                    or drag right to delay audio.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-[#242a36]">
                  <span className="text-[11px]">Hardware Latency Flash & Beep Test:</span>
                  <button
                    onClick={playSyncTestPulse}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
                      isTestFlashing
                        ? 'bg-white text-black ring-4 ring-white'
                        : 'bg-[#12151b] border border-[#242a36] text-white hover:border-accent'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isTestFlashing ? 'bg-black' : 'bg-accent'
                      }`}
                    />
                    <span>Play Test Beep</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-[#242a36] bg-[#0b0d11] flex items-center justify-between">
          <button
            onClick={() => {
              if (activeTab === 'subtitles') {
                resetSubtitleStyle();
                setSubtitleOffset(0);
              } else {
                resetAudioSyncOffset();
              }
            }}
            className="flex items-center space-x-1.5 text-xs text-[#9ca3af] hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset {activeTab === 'subtitles' ? 'Subtitles' : 'Audio Sync'} to Default</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Apply & Done
          </button>
        </div>
      </div>
    </div>
  );
};

