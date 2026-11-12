import React, { useEffect, useRef } from 'react';

export type VisualizerMode = 'bars' | 'wave' | 'halo' | 'embers' | 'vu' | 'off';

interface AudioVisualizerProps {
  analyser?: AnalyserNode | null;
  analyserRef?: React.MutableRefObject<AnalyserNode | null>;
  isPlaying: boolean;
  mode: VisualizerMode;
  className?: string;
  accentColor?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  analyserRef,
  isPlaying,
  mode,
  className = '',
  accentColor = '#38BDF8',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animation state buffers for ultra-smooth 60fps interpolation
  const smoothedFreqsRef = useRef<Float32Array>(new Float32Array(128));
  const peakCapsRef = useRef<Float32Array>(new Float32Array(128));
  const vuLeftRef = useRef<number>(0);
  const vuRightRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const idlePhaseRef = useRef<number>(0);
  const huePhaseRef = useRef<number>(0);
  const bassSmoothedRef = useRef<number>(0);

  // Initialize cosmic particles with full rainbow spectrum for 'embers' mode
  useEffect(() => {
    const particles: Particle[] = [];
    const count = 70;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * 900,
        y: Math.random() * 500,
        vx: (Math.random() - 0.5) * 0.9,
        vy: -0.4 - Math.random() * 0.9,
        size: 1.5 + Math.random() * 3.5,
        alpha: 0.25 + Math.random() * 0.7,
        hue: (i / count) * 360,
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    if (mode === 'off') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const bufferLength = 128;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    if (smoothedFreqsRef.current.length !== bufferLength) {
      smoothedFreqsRef.current = new Float32Array(bufferLength);
      peakCapsRef.current = new Float32Array(bufferLength);
    }

    const render = () => {
      animId = requestAnimationFrame(render);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (width === 0 || height === 0) return;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Read audio data from direct prop or ref
      const activeAnalyser = analyser || analyserRef?.current || null;
      let hasSignal = false;
      if (activeAnalyser && isPlaying) {
        try {
          activeAnalyser.getByteFrequencyData(freqData);
          activeAnalyser.getByteTimeDomainData(timeData);
          for (let i = 0; i < bufferLength; i++) {
            if (freqData[i] > 6) {
              hasSignal = true;
              break;
            }
          }
        } catch {}
      }

      // Smooth interpolation filter (EMA smoothing)
      idlePhaseRef.current += 0.04;
      const smooth = smoothedFreqsRef.current;
      const peaks = peakCapsRef.current;

      for (let i = 0; i < bufferLength; i++) {
        let rawVal = 0;
        if (hasSignal) {
          // Dynamic perceptual curve: boost dynamics so peaks and valleys feel energetic
          const normalized = freqData[i] / 255;
          rawVal = Math.min(1, Math.pow(normalized, 0.78) * 1.35);
        } else if (isPlaying) {
          // Organic, lively studio spectrum fallback wave whenever audio is playing
          const harmonic1 = Math.sin(idlePhaseRef.current * 1.8 + i * 0.22) * 0.5 + 0.5;
          const harmonic2 = Math.cos(idlePhaseRef.current * 1.1 - i * 0.14) * 0.5 + 0.5;
          const beat = Math.sin(idlePhaseRef.current * 2.8) * 0.35 + 0.65;
          const falloff = Math.exp(-i / (bufferLength * 0.55));
          rawVal = (0.22 + 0.55 * harmonic1 * beat + 0.23 * harmonic2) * falloff;
        } else {
          // Subtle resting ambient pulse when paused so the visualizer box stays visually alive
          const idleWave = Math.sin(idlePhaseRef.current * 0.6 + i * 0.18) * 0.04 + 0.06;
          rawVal = idleWave;
        }

        // Fluid lerp smoothing
        const lerpWeight = isPlaying ? (hasSignal ? 0.26 : 0.18) : 0.09;
        smooth[i] = smooth[i] * (1 - lerpWeight) + rawVal * lerpWeight;

        // Floating peak caps with gravity
        if (smooth[i] >= peaks[i]) {
          peaks[i] = smooth[i];
        } else {
          peaks[i] = Math.max(0, peaks[i] - 0.007);
        }
      }

      // Compute bass kick energy (bins 0-8)
      let bassEnergy = 0;
      for (let b = 0; b < 8; b++) {
        bassEnergy += smooth[b];
      }
      bassEnergy = bassEnergy / 8;

      // Track bass impulse / dynamic beat spike
      const prevBass = bassSmoothedRef.current;
      bassSmoothedRef.current = prevBass * 0.82 + bassEnergy * 0.18;
      const beatSpike = Math.max(0, bassEnergy - prevBass);

      // Beat-synced rainbow hue phase acceleration:
      // Smooth natural drift + energetic burst synced directly to the beat kicks
      const hueSpeed = isPlaying ? (0.8 + bassEnergy * 2.8 + beatSpike * 7.0) : 0.25;
      huePhaseRef.current = (huePhaseRef.current + hueSpeed) % 360;
      const currentHuePhase = huePhaseRef.current;

      // Render based on selected visualizer mode
      switch (mode) {
        case 'bars':
          drawSpectrumBars(ctx, width, height, smooth, peaks, accentColor, currentHuePhase, bassEnergy, beatSpike);
          break;
        case 'wave':
          drawLiquidWave(ctx, width, height, timeData, hasSignal, isPlaying, idlePhaseRef.current, accentColor, currentHuePhase, bassEnergy);
          break;
        case 'halo':
          drawRadialHalo(ctx, width, height, smooth, bassEnergy, idlePhaseRef.current, accentColor, currentHuePhase);
          break;
        case 'embers':
          drawCosmicEmbers(ctx, width, height, particlesRef.current, bassEnergy, smooth, accentColor, currentHuePhase, beatSpike);
          break;
        case 'vu':
          drawStereoVuMeter(ctx, width, height, smooth, vuLeftRef, vuRightRef, accentColor);
          break;
      }

      ctx.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [analyser, analyserRef, isPlaying, mode, accentColor]);

  if (mode === 'off') return null;

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full pointer-events-none ${className}`}
    />
  );
};

// ============================================================================
// 1. DYNAMIC SPECTRUM BARS (Beat-Synced Rainbow Spectrum Analyzer)
// ============================================================================
function drawSpectrumBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  smooth: Float32Array,
  peaks: Float32Array,
  accentColor: string,
  huePhase: number,
  bassEnergy: number,
  beatSpike: number
) {
  const barCount = Math.max(16, Math.min(36, Math.floor(width / (width < 200 ? 8 : 11))));
  const spacing = 3;
  const totalBarWidth = (width - (barCount - 1) * spacing) / barCount;
  const barWidth = Math.max(2.5, totalBarWidth);

  const maxBin = 54;

  for (let i = 0; i < barCount; i++) {
    // Map logarithmic perceptual frequency bands across audible musical spectrum
    const t = i / (barCount - 1);
    const binIndex = Math.min(maxBin, Math.floor(Math.pow(t, 1.4) * (maxBin - 1)));

    // Treble boost to compensate for natural 1/f audio falloff (pink noise compensation)
    const trebleBoost = 1.0 + Math.pow(t, 0.75) * 1.5;
    const val = Math.min(1, Math.max(0, smooth[binIndex] * trebleBoost));
    const peakVal = Math.min(1, Math.max(0, peaks[binIndex] * trebleBoost));

    const barHeight = Math.max(4, val * (height - 10));
    const x = i * (barWidth + spacing) + (width - (barCount * (barWidth + spacing) - spacing)) / 2;
    const y = height - barHeight;

    // Clean solid accent bar
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, x, y, barWidth, barHeight, Math.min(barWidth / 2, 2.5));

    // Floating peak cap (Clean solid white)
    if (peakVal > 0.05) {
      const peakY = height - Math.max(6, peakVal * (height - 10)) - 3;
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, x, peakY, barWidth, 2, 1);
    }
  }
}

// ============================================================================
// 2. LIQUID WAVEFORM (Beat-Synced Rainbow Spline Ribbon)
// ============================================================================
function drawLiquidWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeData: Uint8Array,
  hasSignal: boolean,
  isPlaying: boolean,
  phase: number,
  accentColor: string,
  huePhase: number,
  bassEnergy: number
) {
  const midY = height / 2;
  const points: { x: number; y: number }[] = [];
  const segments = 36;

  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width;
    let y = midY;

    if (hasSignal) {
      const dataIdx = Math.floor((i / segments) * (timeData.length - 1));
      const delta = (timeData[dataIdx] - 128) / 128;
      y = midY + delta * (height * 0.42);
    } else if (isPlaying) {
      // Gentle floating sine wave
      const wave = Math.sin(phase + i * 0.35) * Math.cos(phase * 0.7 + i * 0.2);
      y = midY + wave * (height * 0.12);
    }

    points.push({ x, y });
  }

  // Clean Solid Stroke Wave
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ============================================================================
// 3. RADIAL HALO (Clean Solid Orbital Spectrum)
// ============================================================================
function drawRadialHalo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  smooth: Float32Array,
  bassEnergy: number,
  phase: number,
  accentColor: string,
  huePhase: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const baseRadius = Math.min(width, height) * 0.3 + bassEnergy * 20;
  const rayCount = 64;

  // 360-degree frequency spikes with clean solid accent
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 + phase * 0.15;
    const halfIdx = i < rayCount / 2 ? i : rayCount - i;
    const binIndex = Math.min(smooth.length - 1, Math.floor((halfIdx / (rayCount / 2)) * (smooth.length * 0.6)));

    const mag = Math.max(3, smooth[binIndex] * (baseRadius * 0.5));
    const rInner = baseRadius;
    const rOuter = baseRadius + mag;

    const x1 = cx + Math.cos(angle) * rInner;
    const y1 = cy + Math.sin(angle) * rInner;
    const x2 = cx + Math.cos(angle) * rOuter;
    const y2 = cy + Math.sin(angle) * rOuter;

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Smooth inner ring
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ============================================================================
// 4. COSMIC EMBERS (Clean Solid Particle Flow)
// ============================================================================
function drawCosmicEmbers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: Particle[],
  bassEnergy: number,
  smooth: Float32Array,
  accentColor: string,
  huePhase: number,
  beatSpike: number
) {
  const boost = 1 + bassEnergy * 2.0;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    p.x += p.vx * boost;
    p.y += p.vy * boost;

    // Wrap around screen
    if (p.y < 0) p.y = height + 10;
    if (p.y > height + 10) p.y = 0;
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;

    const currentRadius = p.size * (1 + bassEnergy * 0.8);

    // Clean solid accent particle
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = Math.min(0.8, p.alpha);

    ctx.beginPath();
    ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ============================================================================
// 5. VINTAGE STEREO VU METER (Dual Analog Ballistic Needles)
// ============================================================================
function drawStereoVuMeter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  smooth: Float32Array,
  vuLeftRef: React.MutableRefObject<number>,
  vuRightRef: React.MutableRefObject<number>,
  accentColor: string
) {
  // Compute left (lows/mids) and right (mids/highs) power
  let pL = 0;
  let pR = 0;
  const half = Math.floor(smooth.length / 2);
  for (let i = 0; i < half; i++) pL += smooth[i];
  for (let i = half; i < smooth.length; i++) pR += smooth[i];

  const targetL = Math.min(1.0, (pL / half) * 2.2);
  const targetR = Math.min(1.0, (pR / half) * 2.8);

  // Ballistic needle smoothing with inertia
  vuLeftRef.current = vuLeftRef.current * 0.82 + targetL * 0.18;
  vuRightRef.current = vuRightRef.current * 0.82 + targetR * 0.18;

  const meterWidth = Math.min(220, (width - 40) / 2);
  const meterHeight = Math.min(110, height - 20);

  const leftX = width / 2 - meterWidth - 12;
  const rightX = width / 2 + 12;
  const y = (height - meterHeight) / 2;

  drawSingleVuMeter(ctx, leftX, y, meterWidth, meterHeight, vuLeftRef.current, 'LEFT CHANNEL');
  drawSingleVuMeter(ctx, rightX, y, meterWidth, meterHeight, vuRightRef.current, 'RIGHT CHANNEL');
}

function drawSingleVuMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  label: string
) {
  // Meter casing
  ctx.fillStyle = '#0f131a';
  ctx.strokeStyle = '#232b3b';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  // Dial scale arc
  const pivotX = x + w / 2;
  const pivotY = y + h * 1.15;
  const needleLength = h * 0.95;

  const minAngle = -Math.PI * 0.72;
  const maxAngle = -Math.PI * 0.28;

  // Arc track
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, needleLength * 0.88, minAngle, maxAngle);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Red danger zone (+0dB to +3dB)
  const dangerAngle = minAngle + (maxAngle - minAngle) * 0.75;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, needleLength * 0.88, dangerAngle, maxAngle);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Channel label
  ctx.fillStyle = '#9ca3af';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, pivotX, y + h - 10);

  // Needle
  const currentAngle = minAngle + (maxAngle - minAngle) * Math.max(0, Math.min(1, value));
  const tipX = pivotX + Math.cos(currentAngle) * needleLength * 0.88;
  const tipY = pivotY + Math.sin(currentAngle) * needleLength * 0.88;

  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(tipX, tipY);
  ctx.strokeStyle = value > 0.75 ? '#ef4444' : '#e0e7ff';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = value > 0.75 ? '#ef4444' : '#818cf8';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Center pivot pin
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
}

function drawRoundedRect(
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

