import React, { useEffect, useRef, useState, useMemo } from 'react';
import { audioMaster } from '../utils/audioMaster';

interface StartupSplashProps {
  onTransitionStart?: () => void;
  onComplete?: () => void;
  autoPlaySound?: boolean;
}

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  speedY: number;
  speedX: number;
  alpha: number;
  color: string;
  depth: number;
}

export const StartupSplash: React.FC<StartupSplashProps> = ({
  onTransitionStart,
  onComplete,
  autoPlaySound = true,
}) => {
  // Cinematic Timeline Stages:
  // Stage 0: Deep Void & Igniting Singularity (0.0s - 0.8s)
  // Stage 1: Laser Vector Forging & Prismatic Rays (0.8s - 2.0s)
  // Stage 2: "TA-DUM" Climax, Shockwave Detonation & Flare (2.0s - 3.2s)
  // Stage 3: Hyper-Drive Warp & Camera Dive (3.2s - 4.1s)
  // Stage 4: Fade to Black & Seamless App Reveal
  const [stage, setStage] = useState<number>(0);
  const [displayProgress, setDisplayProgress] = useState<number>(12);
  const [targetProgress, setTargetProgress] = useState<number>(18);
  const [statusIndex, setStatusIndex] = useState<number>(0);
  const [isDiving, setIsDiving] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const hasPlayedIntroRef = useRef<boolean>(false);

  // Parallax interactive mouse tracking
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const statusMessages = useMemo(
    () => [
      'BOOTSTRAPPING QUANTUM MEDIA KERNEL...',
      'FORGING PRISMATIC DISPLAY ENGINE...',
      'CONNECTING LOSSLESS AUDIO PIPELINE...',
      'CALIBRATING RETRO-HI-FI EMULATOR...',
      'WELCOME TO VISTARA UNIVERSE · READY',
    ],
    []
  );

  // Smooth numerical progress interpolation
  useEffect(() => {
    let animId: number;
    const updateProgress = () => {
      setDisplayProgress((prev) => {
        if (Math.abs(prev - targetProgress) < 0.5) return targetProgress;
        return prev + (targetProgress - prev) * 0.12;
      });
      animId = requestAnimationFrame(updateProgress);
    };
    animId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animId);
  }, [targetProgress]);

  // Master Orchestration Sequence
  useEffect(() => {
    // Attempt audio unlock
    audioMaster.unlock().then((unlocked) => {
      setIsUnlocked(unlocked);
    });

    const handleUserGesture = () => {
      audioMaster.unlock().then((unlocked) => {
        setIsUnlocked(unlocked);
      });
    };

    window.addEventListener('pointerdown', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('keydown', handleUserGesture, { capture: true, passive: true });

    // Mouse movement parallax tracker
    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth - 0.5) * 2;
      const normY = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseRef.current.targetX = normX;
      mouseRef.current.targetY = normY;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Step 1: Laser Forge Ignition (0.75s)
    const t1 = setTimeout(() => {
      setStage(1);
      setTargetProgress(46);
      setStatusIndex(1);
    }, 750);

    // Audio Pre-Trigger Riser (1.65s) -> Hit 1 at 1.95s -> Bass Slam at 2.15s
    const tAudio = setTimeout(() => {
      if (autoPlaySound && !hasPlayedIntroRef.current) {
        hasPlayedIntroRef.current = true;
        audioMaster.playIntroTaDum();
      }
    }, 1650);

    // Step 2: TA-DUM Detonation & Flare Shockwave (2.15s)
    const t2 = setTimeout(() => {
      setStage(2);
      setTargetProgress(82);
      setStatusIndex(2);
    }, 2150);

    // Step 2.5: High-Fi Calibration (2.85s)
    const tCalib = setTimeout(() => {
      setStatusIndex(3);
    }, 2850);

    // Step 3: 100% Ready Lock-In (3.40s)
    const tReady = setTimeout(() => {
      setTargetProgress(100);
      setStatusIndex(4);
    }, 3400);

    // Step 4: Hyper-Dive Camera Transition into Universe (4.05s)
    const t3 = setTimeout(() => {
      setStage(3);
      setIsDiving(true);
      audioMaster.playIntroDive();
      if (onTransitionStart) onTransitionStart();
      setTimeout(() => {
        setIsFadingOut(true);
      }, 450);
    }, 4050);

    // Step 5: Final Unmount (4.75s)
    const t4 = setTimeout(() => {
      setIsDone(true);
      if (onComplete) onComplete();
    }, 4750);

    // Keyboard Skip Handler
    const handleSkip = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        skipIntro();
      }
    };
    window.addEventListener('keydown', handleSkip);

    return () => {
      clearTimeout(t1);
      clearTimeout(tAudio);
      clearTimeout(t2);
      clearTimeout(tCalib);
      clearTimeout(tReady);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('keydown', handleSkip);
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [autoPlaySound, onTransitionStart, onComplete]);

  // Interactive 3D Cosmic Particle & Nebula Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];
    const count = 75;
    const colors = ['#38BDF8', '#0EA5E9', '#7DD3FC', '#E0F2FE', '#818CF8', '#FFFFFF'];

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      particles.push({
        x,
        y,
        baseX: x,
        baseY: y,
        size: Math.random() * 2.2 + 0.6,
        speedY: -(Math.random() * 0.45 + 0.15),
        speedX: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.65 + 0.25,
        color: colors[Math.floor(Math.random() * colors.length)],
        depth: Math.random() * 1.8 + 0.4,
      });
    }

    let phase = 0;

    const render = () => {
      phase += 0.02;

      // Smooth mouse parallax lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.clearRect(0, 0, width, height);

      // 1. Dynamic Interactive Cosmic Nebula Backing
      const cx = width / 2 + mx * 35;
      const cy = height / 2 + my * 25;
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.65);
      grad.addColorStop(0, 'rgba(14, 165, 233, 0.14)');
      grad.addColorStop(0.35, 'rgba(56, 189, 248, 0.07)');
      grad.addColorStop(0.7, 'rgba(15, 23, 42, 0.03)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Cosmic Dust Particles with 3D Depth Parallax
      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(phase + p.y * 0.01) * 0.2;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        // Apply 3D parallax offset based on depth
        const drawX = p.x + mx * 25 * p.depth;
        const drawY = p.y + my * 20 * p.depth;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 3.5;
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const skipIntro = () => {
    if (isDiving || isDone) return;
    audioMaster.unlock();
    audioMaster.stopIntroSound();
    audioMaster.playIntroDive();
    setIsDiving(true);
    setTargetProgress(100);
    setStatusIndex(4);
    if (onTransitionStart) onTransitionStart();
    setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setIsDone(true);
        if (onComplete) onComplete();
      }, 300);
    }, 240);
  };

  const handleContainerClick = () => {
    if (!isUnlocked) {
      audioMaster.unlock().then((unlocked) => {
        setIsUnlocked(unlocked);
        if (unlocked && autoPlaySound && !hasPlayedIntroRef.current && stage < 2) {
          hasPlayedIntroRef.current = true;
          audioMaster.playIntroTaDum();
        }
      });
    } else {
      skipIntro();
    }
  };

  if (isDone) return null;

  return (
    <div
      onClick={handleContainerClick}
      className={`fixed inset-0 z-[99999] overflow-hidden select-none cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#07090e',
      }}
    >
      {/* 1. Interactive 3D Cosmic Parallax Dust Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* 2. Top Cyber-HUD Telemetry Banner */}
      <div className="absolute top-4 sm:top-6 left-6 right-6 flex items-center justify-between text-[10px] font-mono tracking-widest text-[#64748B] pointer-events-none z-30">
        <div className="flex items-center space-x-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-[#94A3B8] font-bold">VISTARA KERNEL // v1.0.0</span>
          <span className="hidden sm:inline text-white/20">|</span>
          <span className="hidden sm:inline text-accent/80">ONLINE · ZERO-LOSS ARCHITECTURE</span>
        </div>

        {/* Real-Time Audio Engine Telemetry Equalizer */}
        <div className="flex items-center space-x-3">
          <div className="flex items-end space-x-0.5 h-3">
            {[0.6, 0.9, 0.4, 0.75, 1.0, 0.5, 0.85].map((h, i) => (
              <span
                key={i}
                className="w-0.5 bg-accent rounded-full transition-all duration-150 animate-pulse"
                style={{
                  height: `${h * 12}px`,
                  animationDelay: `${i * 120}ms`,
                }}
              />
            ))}
          </div>
          <span className="text-[#94A3B8] font-semibold">44.1 kHz HI-RES</span>
        </div>
      </div>

      {/* 3. Volumetric Vertical Prismatic Laser Beams */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${
          stage >= 1 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="relative w-full h-full max-w-5xl flex justify-center items-center overflow-hidden">
          {[
            { offset: -240, w: 1.5, delay: '0ms', dur: '3.2s' },
            { offset: -160, w: 2.5, delay: '150ms', dur: '2.6s' },
            { offset: -80, w: 1.5, delay: '300ms', dur: '2.9s' },
            { offset: -25, w: 3.5, delay: '80ms', dur: '2.2s' },
            { offset: 25, w: 3.5, delay: '120ms', dur: '2.4s' },
            { offset: 80, w: 1.5, delay: '350ms', dur: '2.8s' },
            { offset: 160, w: 2.5, delay: '200ms', dur: '2.5s' },
            { offset: 240, w: 1.5, delay: '50ms', dur: '3.1s' },
          ].map((bar, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 bg-gradient-to-b from-transparent via-[#38BDF8]/25 to-transparent transition-all duration-1000"
              style={{
                width: `${bar.w}px`,
                transform: `translateX(${bar.offset}px) scaleY(${isDiving ? 4.5 : 1.0})`,
                filter: 'blur(1px)',
                opacity: isDiving ? 0.95 : 0.5,
                animation: `lightRibbonStream ${bar.dur} ease-in-out infinite`,
                animationDelay: bar.delay,
              }}
            />
          ))}
        </div>
      </div>

      {/* 4. Deep Radial Volumetric Aura behind Core Emblem */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full transition-all duration-1000 ${
          stage >= 2
            ? 'w-[750px] h-[750px] bg-[#38BDF8]/18 blur-[140px] opacity-100 scale-100'
            : stage >= 1
            ? 'w-[480px] h-[480px] bg-[#38BDF8]/12 blur-[100px] opacity-70 scale-90'
            : 'w-24 h-24 bg-[#38BDF8]/10 blur-[45px] opacity-20 scale-50'
        }`}
      />

      {/* 5. Ta-Dum Acoustic Shockwave Rings */}
      {stage >= 2 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="w-[360px] h-[360px] rounded-full border-2 border-accent/80 shadow-[0_0_60px_rgba(56,189,248,0.7)] animate-cinematic-shockwave" />
          <div className="w-[360px] h-[360px] rounded-full border border-accent/40 animate-cinematic-shockwave [animation-delay:150ms]" />
          <div className="w-[360px] h-[360px] rounded-full border border-white/30 animate-cinematic-shockwave [animation-delay:300ms]" />
        </div>
      )}

      {/* 6. Center Monolith: Redesigned Vistara Emblem & Cinematic Typography */}
      <div
        className="relative z-20 flex flex-col items-center justify-center w-full h-full transition-transform duration-[850ms]"
        style={{
          perspective: '1200px',
          transform: isDiving
            ? 'scale(28) translateZ(900px)'
            : 'scale(1) translateZ(0)',
          transformOrigin: '50% 46%',
          transitionTimingFunction: 'cubic-bezier(0.7, 0, 0.84, 0)',
        }}
      >
        {/* Core Emblem Housing */}
        <div className="relative w-44 h-44 flex items-center justify-center mb-6">
          {/* Rotating Outer Gyroscope / Orbital Ring */}
          <div
            className={`absolute inset-0 rounded-3xl border-2 transition-all duration-1000 ease-out ${
              stage >= 2
                ? 'border-accent/80 rotate-45 scale-100 shadow-[0_0_40px_rgba(56,189,248,0.45)]'
                : stage >= 1
                ? 'border-[#2e3748] rotate-45 scale-90'
                : 'border-transparent scale-50 opacity-0 rotate-0'
            }`}
          />

          {/* Inner Matte Backdrop Shield */}
          <div
            className={`absolute inset-3 rounded-2xl bg-[#0f141f]/95 border transition-all duration-700 rotate-45 backdrop-blur-xl ${
              stage >= 2
                ? 'border-accent/60 shadow-[inset_0_0_30px_rgba(56,189,248,0.35)]'
                : 'border-[#1e2533]'
            }`}
          />

          {/* Redesigned Precision Vistara Emblem SVG with Dynamic Laser Forge Animation */}
          <svg
            viewBox="0 0 100 100"
            className="w-24 h-24 relative z-20 transition-all duration-700 ease-out drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)]"
          >
            <defs>
              <linearGradient id="splashLeftWing" x1="16%" y1="20%" x2="48%" y2="86%">
                <stop offset="0%" stopColor="#0284C7" />
                <stop offset="50%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>

              <linearGradient id="splashRightWing" x1="84%" y1="20%" x2="52%" y2="86%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="60%" stopColor="#7DD3FC" />
                <stop offset="100%" stopColor="#E0F2FE" />
              </linearGradient>

              <radialGradient id="splashCoreFlare" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="35%" stopColor="#7DD3FC" />
                <stop offset="70%" stopColor="#0EA5E9" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Orbit Ring: Cosmic Media Horizon */}
            <ellipse
              cx="50"
              cy="48"
              rx="40"
              ry="13"
              transform="rotate(-20 50 48)"
              stroke="#38BDF8"
              strokeWidth="1.2"
              strokeDasharray="4 8 24 10"
              className={`transition-opacity duration-1000 ${
                stage >= 1 ? 'opacity-60' : 'opacity-0'
              }`}
            />

            {/* Laser Path Outline that draws itself */}
            <path
              d="M 16 22 L 47 85 L 53 85 L 84 22 L 68 22 L 50 54 L 32 22 Z"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="1.8"
              strokeDasharray="300"
              strokeDashoffset={stage >= 1 ? 0 : 300}
              className="transition-all duration-1000 ease-out"
            />

            {/* Left Aerodynamic Wing */}
            <path
              d="M 16 22 L 47 85 L 47 52 L 32 22 Z"
              fill="url(#splashLeftWing)"
              className={`transition-all duration-700 ${
                stage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
              }`}
            />

            {/* Right Specular Blade */}
            <path
              d="M 84 22 L 53 85 L 53 52 L 68 22 Z"
              fill="url(#splashRightWing)"
              className={`transition-all duration-700 ${
                stage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
              }`}
            />

            {/* Central Keystone */}
            <path
              d="M 47 52 L 50 85 L 53 52 L 50 48 Z"
              fill="#082F49"
              className={`transition-opacity duration-700 ${
                stage >= 1 ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Upper Aperture Star Beacon */}
            <polygon
              points="50,15 57,28 50,41 43,28"
              fill="#FFFFFF"
              className={`transition-all duration-500 ${
                stage >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              }`}
            />

            {/* Precision Highlights */}
            <path
              d="M 16 22 L 32 22 L 47 52"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.6"
            />
            <path
              d="M 84 22 L 68 22 L 53 52"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.9"
            />

            {/* Detonation Flash Flare at Stage 2 */}
            {stage >= 2 && (
              <circle
                cx="50"
                cy="48"
                r="35"
                fill="url(#splashCoreFlare)"
                className="animate-pulse"
              />
            )}
          </svg>

          {/* Optical Anamorphic Lens Flare Line on Ta-Dum Climax */}
          <div
            className={`absolute pointer-events-none transition-all duration-700 ${
              stage >= 2
                ? 'w-72 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 scale-x-100'
                : 'w-10 h-[1px] bg-white opacity-0 scale-x-0'
            }`}
          />
        </div>

        {/* 7. Typography: VISTARA */}
        <div className="overflow-hidden py-1">
          <h1
            className={`text-4xl sm:text-6xl font-black text-white tracking-[0.45em] transition-all duration-800 transform ${
              stage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              textShadow: stage >= 2 ? '0 0 35px rgba(56,189,248,0.5)' : 'none',
            }}
          >
            <span>VISTARA</span>
          </h1>
        </div>

        {/* Tagline: PERSONAL MEDIA UNIVERSE */}
        <div className="overflow-hidden mt-3">
          <p
            className={`text-[11px] sm:text-xs font-bold tracking-[0.42em] uppercase transition-all duration-700 delay-150 transform flex items-center justify-center space-x-2 ${
              stage >= 1 ? 'translate-y-0 opacity-90 text-accent' : 'translate-y-4 opacity-0 text-gray-500'
            }`}
          >
            <span>PERSONAL MEDIA UNIVERSE</span>
          </p>
        </div>

        {/* Cinematic Dual-Tone Accent Line */}
        <div
          className={`h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent transition-all duration-1000 mt-4 ${
            stage >= 2 ? 'w-56 opacity-100' : stage >= 1 ? 'w-28 opacity-60' : 'w-0 opacity-0'
          }`}
        />

        {/* 8. Dynamic Telemetry Progress Tracker */}
        <div
          className={`w-72 sm:w-80 mt-7 flex flex-col items-center space-y-2 transition-opacity duration-500 ${
            isDiving ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {/* Progress Bar with Laser Lead Bead */}
          <div className="w-full h-1.5 bg-[#141822] rounded-full overflow-hidden relative border border-white/[0.06] p-[1px]">
            <div
              className="h-full bg-gradient-to-r from-[#0284C7] via-accent to-[#7DD3FC] rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(56,189,248,0.6)] relative"
              style={{ width: `${displayProgress}%` }}
            >
              {/* Glowing Laser Tip */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
            </div>
          </div>

          {/* Numerical Percentage & Status Ticker */}
          <div className="w-full flex items-center justify-between px-0.5 text-[10px] font-mono text-[#94A3B8]">
            <span className="tracking-widest uppercase transition-all duration-300">
              {statusMessages[statusIndex]}
            </span>
            <span className="font-bold text-accent tabular-nums ml-2">
              {Math.round(displayProgress)}%
            </span>
          </div>
        </div>
      </div>

      {/* 9. Bottom Interactive Action Button */}
      <div className="absolute bottom-7 left-0 right-0 flex justify-center pointer-events-auto">
        <button
          onClick={skipIntro}
          className="group px-5 py-2 rounded-full bg-[#111722]/85 hover:bg-[#182130] text-[10.5px] font-mono uppercase tracking-[0.22em] text-[#94A3B8] hover:text-white border border-accent/30 hover:border-accent/70 transition-all duration-200 backdrop-blur-md shadow-lg flex items-center space-x-2 cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-125 transition-transform" />
          <span>
            {!isUnlocked ? '🔊 CLICK ANYWHERE TO ENTER WITH SOUND' : 'ENTER UNIVERSE [ SPACE / CLICK ]'}
          </span>
        </button>
      </div>
    </div>
  );
};
