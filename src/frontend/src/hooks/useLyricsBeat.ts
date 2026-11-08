import React, { useEffect, useState, useRef } from 'react';

export interface LyricsBeatData {
  bassLevel: number;    // 0 to 1
  midLevel: number;     // 0 to 1
  trebleLevel: number;  // 0 to 1
  beatPulse: number;    // 0 to 1, pulses on kick drum / beat hits
  eqBars: number[];     // 5 numbers (0 to 100) representing live jumping frequencies
}

const defaultBeatData: LyricsBeatData = {
  bassLevel: 0,
  midLevel: 0,
  trebleLevel: 0,
  beatPulse: 0,
  eqBars: [15, 25, 20, 30, 18],
};

export function useLyricsBeat(
  analyserRef: React.MutableRefObject<AnalyserNode | null>,
  isPlaying: boolean
): LyricsBeatData {
  const [beatData, setBeatData] = useState<LyricsBeatData>(defaultBeatData);
  const pulseRef = useRef<number>(0);
  const avgBassRef = useRef<number>(0.15);
  const smoothedBarsRef = useRef<number[]>([15, 25, 20, 30, 18]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      setBeatData(defaultBeatData);
      return;
    }

    let animId: number;
    const freqData = new Uint8Array(64);

    const checkAudio = (timestamp: number) => {
      animId = requestAnimationFrame(checkAudio);

      // 60 FPS update rate for snappy response
      if (timestamp - lastUpdateRef.current < 16) return;
      lastUpdateRef.current = timestamp;

      const analyser = analyserRef.current;
      if (!analyser) return;

      try {
        analyser.getByteFrequencyData(freqData);

        // Sub-bass (bins 0-2, ~20-80Hz)
        const b0 = (freqData[0] + freqData[1] + freqData[2]) / (3 * 255);
        // Kick & punch bass (bins 3-6, ~80-180Hz)
        const b1 = (freqData[3] + freqData[4] + freqData[5] + freqData[6]) / (4 * 255);
        // Vocals / Lower Mid (bins 7-14)
        let midSum = 0;
        for (let i = 7; i <= 14; i++) midSum += freqData[i];
        const b2 = midSum / (8 * 255);
        // Upper Mid / Snare body (bins 15-26)
        let upMidSum = 0;
        for (let i = 15; i <= 26; i++) upMidSum += freqData[i];
        const b3 = upMidSum / (12 * 255);
        // Treble & Hi-hats (bins 27-50)
        let trebleSum = 0;
        for (let i = 27; i <= 50; i++) trebleSum += freqData[i];
        const b4 = trebleSum / (24 * 255);

        // Combined Kick Energy (captures 808s, acoustic kicks, synth bass)
        const kickEnergy = b0 * 0.65 + b1 * 0.45;

        // Adaptive beat detection with running baseline
        avgBassRef.current = avgBassRef.current * 0.93 + kickEnergy * 0.07;
        const beatThreshold = Math.max(0.16, avgBassRef.current * 1.18);

        if (kickEnergy > beatThreshold) {
          pulseRef.current = 1.0;
        } else {
          // Snappy decay with smooth trail
          pulseRef.current = Math.max(0, pulseRef.current * 0.86);
        }

        // Smooth bars interpolation with fast attack
        const currentBars = [b0, b1, b2, b3, b4];
        for (let i = 0; i < 5; i++) {
          const target = Math.min(100, Math.max(12, currentBars[i] * 100));
          const speed = target > smoothedBarsRef.current[i] ? 0.45 : 0.28;
          smoothedBarsRef.current[i] += (target - smoothedBarsRef.current[i]) * speed;
        }

        setBeatData({
          bassLevel: kickEnergy,
          midLevel: b2,
          trebleLevel: b4,
          beatPulse: pulseRef.current,
          eqBars: [...smoothedBarsRef.current],
        });
      } catch {
        // Safe failover
      }
    };

    animId = requestAnimationFrame(checkAudio);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [analyserRef, isPlaying]);

  return beatData;
}
