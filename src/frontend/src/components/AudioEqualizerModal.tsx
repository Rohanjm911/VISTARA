import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Modal } from './Modal';
import { Sliders, Volume2, Moon, Sparkles, Layers, Disc } from 'lucide-react';

const FREQUENCIES = [
  { label: '32', hz: 32 },
  { label: '64', hz: 64 },
  { label: '125', hz: 125 },
  { label: '250', hz: 250 },
  { label: '500', hz: 500 },
  { label: '1k', hz: 1000 },
  { label: '2k', hz: 2000 },
  { label: '4k', hz: 4000 },
  { label: '8k', hz: 8000 },
  { label: '16k', hz: 16000 },
];

const PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  Rock: [4, 3, -1, -2, -1, 2, 3, 4, 4, 4],
  Classical: [3, 3, 2, 1, 0, 0, 1, 2, 3, 3],
  Vocal: [-2, -1, 0, 3, 4, 4, 3, 1, 0, -1],
  Electronic: [5, 4, 1, -1, 2, 1, 3, 4, 5, 5],
};

const CROSSFADE_OPTIONS = [
  { label: 'Off', val: 0 },
  { label: '2s', val: 2 },
  { label: '4s', val: 4 },
  { label: '6s', val: 6 },
  { label: '8s', val: 8 },
  { label: '12s', val: 12 },
];

const SLEEP_OPTIONS = [
  { label: 'Off', val: null },
  { label: '15m', val: 15 },
  { label: '30m', val: 30 },
  { label: '45m', val: 45 },
  { label: '60m', val: 60 },
  { label: 'End of Track', val: -1 },
];

export const AudioEqualizerModal: React.FC = () => {
  const {
    isEqualizerOpen,
    setIsEqualizerOpen,
    filtersRef,
    isNormalized,
    toggleNormalization,
    isGapless,
    toggleGapless,
    crossfadeSeconds,
    setCrossfadeSeconds,
    sleepTimerMinutes,
    sleepTimerRemainingSeconds,
    setSleepTimer,
  } = usePlayer();

  const [gains, setGains] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [activePreset, setActivePreset] = useState<string>('Flat');

  const applyGain = (index: number, value: number) => {
    const next = [...gains];
    next[index] = value;
    setGains(next);
    setActivePreset('Custom');

    if (filtersRef.current && filtersRef.current[index]) {
      filtersRef.current[index].gain.value = value;
    }
  };

  const applyPreset = (name: string) => {
    const presetGains = PRESETS[name];
    if (!presetGains) return;
    setGains(presetGains);
    setActivePreset(name);

    if (filtersRef.current) {
      presetGains.forEach((gain, i) => {
        if (filtersRef.current[i]) {
          filtersRef.current[i].gain.value = gain;
        }
      });
    }
  };

  const formatTimer = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      isOpen={isEqualizerOpen}
      onClose={() => setIsEqualizerOpen(false)}
      title="Audio Studio & Master Acoustics"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Preset Selector */}
        <div>
          <label className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider block mb-2 flex items-center justify-between">
            <span>Equalizer Presets</span>
            <span className="text-[10px] text-accent font-normal">10-Band Parametric Filter</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESETS).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activePreset === p
                    ? 'bg-accent text-white font-bold shadow-md shadow-accent/30'
                    : 'bg-[#181c24] text-[#d1d5db] hover:bg-[#242a36]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 10 Vertical Sliders */}
        <div className="bg-[#181c24] border border-[#242a36] rounded-xl p-5 shadow-inner">
          <div className="flex justify-between items-center h-44 px-3">
            {FREQUENCIES.map((freq, idx) => (
              <div key={freq.hz} className="flex flex-col items-center h-full justify-between">
                <span className="text-[10px] font-mono text-[#9ca3af]">
                  {gains[idx] > 0 ? `+${gains[idx]}` : gains[idx]}dB
                </span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={gains[idx]}
                  onChange={(e) => applyGain(idx, parseFloat(e.target.value))}
                  className="h-24 w-2 appearance-none bg-[#242a36] rounded-lg cursor-pointer accent-accent"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                />
                <span className="text-[11px] font-bold text-white mt-1 font-mono">{freq.label}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center text-xs text-[#9ca3af] pt-3 border-t border-[#242a36]/60 mt-3">
            <span className="text-[11px]">Precision zero-phase response</span>
            <button
              onClick={() => applyPreset('Flat')}
              className="text-accent hover:underline font-medium text-xs cursor-pointer"
            >
              Reset to Flat
            </button>
          </div>
        </div>

        {/* Studio Enhancements Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* 1. Loudness Normalization */}
          <div className="bg-[#121620] border border-[#202737] rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Normalization</span>
                </div>
                <p className="text-[11px] text-[#9ca3af] leading-relaxed">
                  Studio dynamic compressor normalizes volume across songs.
                </p>
              </div>
              <button
                onClick={toggleNormalization}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  isNormalized ? 'bg-emerald-500' : 'bg-[#252c3c]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isNormalized ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <span className="text-[10px] font-mono mt-2 text-emerald-400 font-semibold">
              {isNormalized ? '● Auto Level Active' : '○ Bypassed'}
            </span>
          </div>

          {/* 2. Gapless Playback */}
          <div className="bg-[#121620] border border-[#202737] rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Disc className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">Gapless Play</span>
                </div>
                <p className="text-[11px] text-[#9ca3af] leading-relaxed">
                  Dual-deck preloading eliminates silence between tracks.
                </p>
              </div>
              <button
                onClick={toggleGapless}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  isGapless ? 'bg-cyan-500' : 'bg-[#252c3c]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isGapless ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <span className="text-[10px] font-mono mt-2 text-cyan-400 font-semibold">
              {isGapless ? '● Dual-Deck 0s Buffer' : '○ Disabled'}
            </span>
          </div>

          {/* 3. DJ Crossfade */}
          <div className="bg-[#121620] border border-[#202737] rounded-xl p-3.5 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold text-white">DJ Crossfade</span>
              </div>
              <p className="text-[11px] text-[#9ca3af] leading-relaxed">
                Seamlessly blends adjacent tracks with equal-power curves.
              </p>
            </div>
            <div className="flex items-center gap-1 mt-2.5">
              {CROSSFADE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setCrossfadeSeconds(opt.val)}
                  className={`flex-1 py-1 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                    crossfadeSeconds === opt.val
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-[#1a2130] text-[#9ca3af] hover:text-white hover:bg-[#252d40]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Smart Sleep Timer */}
        <div className="bg-[#121620] border border-[#202737] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Moon className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-white">Smart Sleep Timer</span>
            </div>
            {sleepTimerRemainingSeconds !== null && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent font-semibold animate-pulse">
                🌙 {sleepTimerRemainingSeconds === -1 ? 'End of Track' : `${formatTimer(sleepTimerRemainingSeconds)} remaining`}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#9ca3af] mb-3">
            Playback gradually fades out over the last 20 seconds before stopping quietly.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {SLEEP_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setSleepTimer(opt.val)}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center ${
                  sleepTimerMinutes === opt.val
                    ? 'bg-accent text-white shadow-md'
                    : 'bg-[#181d29] text-[#9ca3af] hover:text-white hover:bg-[#222938]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
