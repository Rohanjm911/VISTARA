import React, { useEffect, useRef } from 'react';

interface LyricsBeatVisualizerProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isPlaying: boolean;
  className?: string;
  accentColor?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  hue: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  hue: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  hue: number;
}

export const LyricsBeatVisualizer: React.FC<LyricsBeatVisualizerProps> = ({
  analyserRef,
  isPlaying,
  className = '',
  accentColor = '#35C6B0',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const sparksRef = useRef<Spark[]>([]);

  // Beat tracking & spring physics state refs
  const smoothedBassRef = useRef<number>(0);
  const smoothedMidRef = useRef<number>(0);
  const smoothedTrebleRef = useRef<number>(0);
  const fastBassRef = useRef<number>(0.1);
  const slowBassRef = useRef<number>(0.15);
  const beatShockwaveRef = useRef<number>(0);
  const waveBounceOffsetRef = useRef<number>(0);
  const waveBounceVelocityRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  const lastKickTimeRef = useRef<number>(0);

  // Initialize floating stardust particles
  useEffect(() => {
    const particles: Particle[] = [];
    const count = 42;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * 1200,
        y: Math.random() * 800,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.25 - Math.random() * 0.6,
        size: 1.2 + Math.random() * 2.8,
        baseAlpha: 0.18 + Math.random() * 0.45,
        hue: 168 + Math.random() * 15, // Electric Teal range
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const bufferLength = 64;
    const freqData = new Uint8Array(bufferLength);

    const render = (time: number) => {
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

      const analyser = analyserRef.current;
      let rawBass = 0;
      let rawMid = 0;
      let rawTreble = 0;

      if (analyser && isPlaying) {
        try {
          analyser.getByteFrequencyData(freqData);

          // Sub-bass & Punch Bass (bins 0-6: ~20-180Hz)
          let bassSum = 0;
          for (let i = 0; i < 7; i++) {
            bassSum += freqData[i];
          }
          rawBass = bassSum / (7 * 255);

          // Vocal & Snare Mids (bins 7-22: ~180-1200Hz)
          let midSum = 0;
          for (let i = 7; i < 23; i++) {
            midSum += freqData[i];
          }
          rawMid = midSum / (16 * 255);

          // Treble & Hi-hats (bins 23-50: ~1.2kHz-6kHz)
          let trebleSum = 0;
          for (let i = 23; i < 50; i++) {
            trebleSum += freqData[i];
          }
          rawTreble = trebleSum / (27 * 255);
        } catch {
          // Audio safe failover
        }
      }

      // Fast & slow running baselines for transient kick detection
      fastBassRef.current = fastBassRef.current * 0.72 + rawBass * 0.28;
      slowBassRef.current = slowBassRef.current * 0.94 + rawBass * 0.06;

      // Detect Beat Kick Strike
      const isKickStrike =
        rawBass > slowBassRef.current * 1.2 &&
        rawBass > 0.2 &&
        time - lastKickTimeRef.current > 160;

      if (isKickStrike) {
        lastKickTimeRef.current = time;
        beatShockwaveRef.current = 1.0;

        // Apply upward bounce velocity to the rolling waves (Spring Physics)
        const bounceStrength = Math.min(38, 16 + (rawBass - slowBassRef.current) * 55);
        waveBounceVelocityRef.current = -bounceStrength;

        // Spawn a radiant circular shockwave from center of lyrics
        if (shockwavesRef.current.length < 5) {
          shockwavesRef.current.push({
            x: width / 2,
            y: height * 0.48,
            radius: 15,
            maxRadius: Math.max(width, height) * 0.65,
            alpha: 0.35 + rawBass * 0.35,
            hue: 260 + Math.random() * 40,
          });
        }

        // Spawn explosive micro-sparks on heavy kicks
        if (rawBass > 0.35 && sparksRef.current.length < 30) {
          const sparkCount = 6;
          for (let s = 0; s < sparkCount; s++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3.5;
            sparksRef.current.push({
              x: width / 2 + (Math.random() - 0.5) * 80,
              y: height * 0.48 + (Math.random() - 0.5) * 40,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1.2,
              size: 1 + Math.random() * 2,
              alpha: 0.9,
              decay: 0.025 + Math.random() * 0.03,
              hue: 270 + Math.random() * 50,
            });
          }
        }
      } else {
        // Fast, energetic shockwave decay
        beatShockwaveRef.current = Math.max(0, beatShockwaveRef.current * 0.88);
      }

      // Spring physics integration for wave bounce
      const k = 0.18; // Spring stiffness
      const damping = 0.22; // Damping factor
      const springForce = -k * waveBounceOffsetRef.current;
      waveBounceVelocityRef.current += springForce;
      waveBounceVelocityRef.current *= (1 - damping);
      waveBounceOffsetRef.current += waveBounceVelocityRef.current;

      // Continuous frequency smoothing for fluid motion
      smoothedBassRef.current += (rawBass - smoothedBassRef.current) * 0.28;
      smoothedMidRef.current += (rawMid - smoothedMidRef.current) * 0.22;
      smoothedTrebleRef.current += (rawTreble - smoothedTrebleRef.current) * 0.35;

      const bassEnergy = smoothedBassRef.current;
      const beatShock = beatShockwaveRef.current;
      const waveBounce = waveBounceOffsetRef.current;

      // Phase accelerates on beats for high energy fluid surges
      phaseRef.current += 0.018 + bassEnergy * 0.045 + beatShock * 0.035;
      const phase = phaseRef.current;

      const cx = width / 2;
      const cy = height * 0.48;

      // =================================================================
      // 1. BEAT-PUMPING ATMOSPHERIC AURORA (RADIAL CENTER BLOOM)
      // =================================================================
      const auraScale = 0.35 + bassEnergy * 0.25 + beatShock * 0.15;
      const auraRadius = Math.min(width, height) * auraScale;

      ctx.fillStyle = `rgba(53, 198, 176, ${0.05 + bassEnergy * 0.06})`;
      ctx.beginPath();
      ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // Top corner ambient glows that breathe with audio treble & mids
      const cornerRadius = width * 0.4;
      ctx.fillStyle = `rgba(56, 189, 248, ${0.02 + smoothedTrebleRef.current * 0.04})`;
      ctx.beginPath();
      ctx.arc(width * 0.85, 0, cornerRadius, 0, Math.PI * 2);
      ctx.fill();

      // =================================================================
      // 2. EXPANDING BEAT SHOCKWAVE RINGS
      // =================================================================
      for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.radius += (sw.maxRadius - sw.radius) * 0.07 + 3;
        sw.alpha *= 0.92;

        if (sw.alpha < 0.01 || sw.radius >= sw.maxRadius) {
          shockwavesRef.current.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = `hsla(${sw.hue}, 90%, 65%, ${sw.alpha})`;
        ctx.lineWidth = 2 + (1 - sw.radius / sw.maxRadius) * 2;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // =================================================================
      // 3. THREE-LAYERED FLUID WAVES WITH NEON BEAT CREST
      // =================================================================
      const segments = 24;
      const step = width / segments;

      // WAVE 1: Deep Ocean Background Wave (Sub-bass reactive)
      const baseWaveY1 = height * 0.62 + waveBounce * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, baseWaveY1);

      for (let i = 0; i <= segments; i++) {
        const x = i * step;
        const sine1 = Math.sin(i * 0.38 + phase) * (24 + bassEnergy * 55 + beatShock * 25);
        const sine2 = Math.cos(i * 0.28 - phase * 0.7) * (14 + rawMid * 30);
        const y = baseWaveY1 + sine1 + sine2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();

      ctx.fillStyle = `rgba(53, 198, 176, ${0.05 + bassEnergy * 0.07})`;
      ctx.fill();

      // WAVE 2: Middle Rhythm Wave (Mid & Beat Bounce Reactive)
      const baseWaveY2 = height * 0.72 + waveBounce * 0.85;
      const crestPoints: { x: number; y: number }[] = [];

      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, baseWaveY2);

      for (let i = 0; i <= segments; i++) {
        const x = i * step;
        const sine1 = Math.sin(i * 0.44 - phase * 1.1) * (20 + bassEnergy * 45 + beatShock * 30);
        const sine2 = Math.cos(i * 0.62 + phase * 0.9) * (12 + rawMid * 24);
        const y = baseWaveY2 + sine1 + sine2;
        crestPoints.push({ x, y });
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();

      ctx.fillStyle = `rgba(147, 51, 234, ${0.04 + bassEnergy * 0.06})`;
      ctx.fill();

      // WAVE 3: GLOWING NEON CREST LINE (Directly Bounces to Beats!)
      if (crestPoints.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(crestPoints[0].x, crestPoints[0].y);
        for (let i = 1; i < crestPoints.length; i++) {
          const prev = crestPoints[i - 1];
          const curr = crestPoints[i];
          const mx = (prev.x + curr.x) / 2;
          const my = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        ctx.lineTo(crestPoints[crestPoints.length - 1].x, crestPoints[crestPoints.length - 1].y);

        ctx.strokeStyle = `rgba(168, 85, 247, ${0.35 + beatShock * 0.35})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
      }

      // =================================================================
      // 4. BEAT-SYNCHRONIZED FLOATING STARDUST & SPARKS
      // =================================================================
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // On beat hits: Particles jump/accelerate upward and outward
        const speedMultiplier = 1 + bassEnergy * 1.8 + beatShock * 3.5;
        p.y += p.vy * speedMultiplier;
        p.x += p.vx * (1 + rawTreble * 2);

        // Reset particles out of bounds
        if (p.y < -15) {
          p.y = height + 15;
          p.x = Math.random() * width;
        }
        if (p.x < -15) p.x = width + 15;
        if (p.x > width + 15) p.x = -15;

        // Particle size pulses dynamically with the beat
        const currentSize = p.size * (1 + beatShock * 1.2 + bassEnergy * 0.4);
        const particleAlpha = Math.min(0.9, p.baseAlpha * (0.4 + bassEnergy * 0.6 + beatShock * 0.8));

        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${particleAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();

        // Glowing particle aura on heavy beat drops
        if (beatShock > 0.4 && p.size > 2.2) {
          ctx.save();
          ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${particleAlpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentSize * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Render micro-sparks on heavy kicks
      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
        const spark = sparksRef.current[i];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.08; // Gravity
        spark.alpha -= spark.decay;

        if (spark.alpha <= 0) {
          sparksRef.current.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `hsla(${spark.hue}, 95%, 75%, ${spark.alpha})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // =================================================================
      // 5. ORGANIC SPECTRUM RIPPLE AT BOTTOM FLOOR
      // =================================================================
      if (isPlaying && rawBass > 0.05) {
        const numBars = 36;
        const barWidth = width / numBars;
        ctx.save();
        for (let b = 0; b < numBars; b++) {
          const freqIndex = Math.floor((b / numBars) * (bufferLength / 2));
          const freqVal = (freqData[freqIndex] || 0) / 255;
          const barHeight = Math.max(3, freqVal * 32 * (1 + beatShock * 0.5));
          const bx = b * barWidth;
          const by = height - barHeight;

          ctx.fillStyle = `rgba(168, 85, 247, ${0.12 + freqVal * 0.25})`;
          ctx.fillRect(bx, by, barWidth - 1, barHeight);
        }
        ctx.restore();
      }

      ctx.restore();
    };

    render(performance.now());

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [analyserRef, isPlaying, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    />
  );
};
