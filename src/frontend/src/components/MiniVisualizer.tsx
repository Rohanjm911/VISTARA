import React, { useEffect, useRef } from 'react';

interface MiniVisualizerProps {
  analyserRef?: React.MutableRefObject<AnalyserNode | null>;
  isPlaying: boolean;
  className?: string;
  accentColor?: string;
  bars?: number;
}

export const MiniVisualizer: React.FC<MiniVisualizerProps> = ({
  analyserRef,
  isPlaying,
  className = '',
  accentColor = '#38BDF8',
  bars = 8,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedRef = useRef<Float32Array>(new Float32Array(bars));
  const peaksRef = useRef<Float32Array>(new Float32Array(bars));
  const phaseRef = useRef<number>(Math.random() * 10);
  const huePhaseRef = useRef<number>(0);
  const bassSmoothedRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const freqData = new Uint8Array(64);

    const render = () => {
      animId = requestAnimationFrame(render);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 80;
      const height = canvas.clientHeight || 28;

      if (width === 0 || height === 0) return;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef?.current;
      let hasSignal = false;

      if (analyser && isPlaying) {
        try {
          analyser.getByteFrequencyData(freqData);
          for (let i = 0; i < 32; i++) {
            if (freqData[i] > 6) {
              hasSignal = true;
              break;
            }
          }
        } catch {}
      }

      phaseRef.current += 0.045;
      const smooth = smoothedRef.current;
      const peaks = peaksRef.current;

      const barCount = bars;
      const spacing = 2.5;
      const totalBarWidth = (width - (barCount - 1) * spacing) / barCount;
      const barWidth = Math.max(2.5, totalBarWidth);

      // Bass energy & beat kick detection
      let bassEnergy = 0;
      for (let b = 0; b < Math.min(3, barCount); b++) {
        bassEnergy += smooth[b];
      }
      bassEnergy = bassEnergy / Math.min(3, barCount);

      const prevBass = bassSmoothedRef.current;
      bassSmoothedRef.current = prevBass * 0.8 + bassEnergy * 0.2;
      const beatSpike = Math.max(0, bassEnergy - prevBass);

      const hueSpeed = isPlaying ? (0.8 + bassEnergy * 2.8 + beatSpike * 6.0) : 0.25;
      huePhaseRef.current = (huePhaseRef.current + hueSpeed) % 360;
      const huePhase = huePhaseRef.current;

      for (let i = 0; i < barCount; i++) {
        let rawVal = 0;
        const t = i / (barCount - 1);

        if (hasSignal) {
          // Map to musical frequency bins (perceptual distribution)
          const binIndex = Math.min(36, Math.floor(Math.pow(t, 1.3) * 32));
          const trebleBoost = 1.0 + Math.pow(t, 0.7) * 1.4;
          const normalized = freqData[binIndex] / 255;
          rawVal = Math.min(1, Math.pow(normalized, 0.75) * 1.4 * trebleBoost);
        } else if (isPlaying) {
          // Organic, lively rhythm wave fallback when playing
          const wave1 = Math.sin(phaseRef.current * 2.2 + i * 0.45) * 0.5 + 0.5;
          const wave2 = Math.cos(phaseRef.current * 1.3 - i * 0.3) * 0.5 + 0.5;
          const beat = Math.sin(phaseRef.current * 3.1) * 0.4 + 0.6;
          const falloff = Math.exp(-i / (barCount * 0.85));
          rawVal = (0.2 + 0.55 * wave1 * beat + 0.25 * wave2) * falloff;
        } else {
          // Subtle resting ambient state when paused
          const restingWave = Math.sin(phaseRef.current * 0.7 + i * 0.5) * 0.04 + 0.08;
          rawVal = restingWave;
        }

        // Fluid lerp smoothing
        const lerpWeight = isPlaying ? (hasSignal ? 0.28 : 0.20) : 0.09;
        smooth[i] = smooth[i] * (1 - lerpWeight) + rawVal * lerpWeight;

        // Floating peak cap physics
        if (smooth[i] >= peaks[i]) {
          peaks[i] = smooth[i];
        } else {
          peaks[i] = Math.max(0, peaks[i] - 0.009);
        }

        const barHeight = Math.max(3, smooth[i] * (height - 6));
        const x = i * (barWidth + spacing) + (width - (barCount * (barWidth + spacing) - spacing)) / 2;
        const y = height - barHeight;

        // Beat-synced 310-degree rainbow spectrum bar with dynamic chromatic gradient
        const barHue = (t * 310 + huePhase) % 360;
        const lightness = Math.min(74, 56 + smooth[i] * 14 + beatSpike * 12);
        const grad = ctx.createLinearGradient(0, height, 0, Math.max(0, y));
        grad.addColorStop(0, `hsla(${barHue}, 95%, 45%, 0.88)`);
        grad.addColorStop(0.5, `hsla(${(barHue + 25) % 360}, 95%, 58%, 0.96)`);
        grad.addColorStop(1, `hsla(${(barHue + 50) % 360}, 100%, ${lightness}%, 1)`);
        ctx.fillStyle = grad;
        drawPill(ctx, x, y, barWidth, barHeight, Math.min(barWidth / 2, 2.5));

        // Floating peak cap (Clean solid white)
        if (peaks[i] > 0.08) {
          const peakY = height - Math.max(4, peaks[i] * (height - 6)) - 2;
          ctx.fillStyle = '#ffffff';
          drawPill(ctx, x, peakY, barWidth, 1.5, 0.75);
        }
      }

      ctx.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [analyserRef, isPlaying, accentColor, bars]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full pointer-events-none select-none ${className}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (width <= 0 || height <= 0) return;
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
