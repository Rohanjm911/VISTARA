import React, { useEffect, useRef, useState } from 'react';
import { audioMaster } from '../utils/audioMaster';

interface StartupSplashProps {
  onTransitionStart?: () => void;
  onComplete?: () => void;
  autoPlaySound?: boolean;
}

export const StartupSplash: React.FC<StartupSplashProps> = ({
  onTransitionStart,
  onComplete,
  autoPlaySound = true,
}) => {
  // Stage 0: Initial Void & Ember (0.0s - 0.65s)
  // Stage 1: Laser Contours & Prismatic Ribbons (0.65s - 1.7s)
  // Stage 2: "TA-DUM" Climax & Flare Flash (1.7s - 2.6s)
  // Stage 3: Netflix Hyper-Dive Camera Transition (2.6s - 3.4s)
  // Stage 4: Complete / Unmount
  const [stage, setStage] = useState<number>(0);
  const [progress, setProgress] = useState<number>(15);
  const [statusText, setStatusText] = useState<string>('INITIALIZING LOCAL ENGINE...');
  const [isDiving, setIsDiving] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const hasPlayedIntroRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Attempt to unlock unified audio engine immediately
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

    // Stage 1: Laser Forge & Security Bootstrap (0.90s)
    const t1 = setTimeout(() => {
      setStage(1);
      setProgress(42);
      setStatusText('BOOTSTRAPPING SECURITY BARRIER...');
    }, 900);

    // Audio Pre-Trigger (1.70s):
    // Riser starts at 1.70s, Hit 1 lands at 2.05s, Massive Bass Impact ("-DUM") lands at EXACTLY 2.20s!
    const tAudio = setTimeout(() => {
      if (autoPlaySound && !hasPlayedIntroRef.current) {
        hasPlayedIntroRef.current = true;
        audioMaster.playIntroTaDum();
      }
    }, 1700);

    // Stage 2: TA-DUM Flash Impact & Media Universe Link (2.20s)
    const t2 = setTimeout(() => {
      setStage(2);
      setProgress(75);
      setStatusText('CONNECTING MEDIA UNIVERSE...');
    }, 2200);

    // Stage 3: System Fully Ready & Brass Hold (3.30s)
    const tReady = setTimeout(() => {
      setProgress(100);
      setStatusText('READY · WELCOME TO VISTARA');
    }, 3300);

    // Stage 4: Netflix Hyper-Dive Camera Transition & Dive Audio (4.00s)
    const t3 = setTimeout(() => {
      setStage(3);
      setIsDiving(true);
      audioMaster.playIntroDive();
      if (onTransitionStart) onTransitionStart();
      setTimeout(() => {
        setIsFadingOut(true);
      }, 420);
    }, 4000);

    // Stage 5: Finish & Unmount (4.75s)
    const t4 = setTimeout(() => {
      setIsDone(true);
      if (onComplete) onComplete();
    }, 4750);

    // Keyboard / Click Skip Handler
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
      clearTimeout(tReady);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('keydown', handleSkip);
      window.removeEventListener('pointerdown', handleUserGesture);
    };
  }, [autoPlaySound, onTransitionStart, onComplete]);

  // Ambient Star Dust / Embers Canvas Particle Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      alpha: number;
      color: string;
    }> = [];

    const colors = ['#35C6B0', '#2ba895', '#5eead4', '#151A21', '#F4F7F8'];

    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.6,
        speedY: -(Math.random() * 0.4 + 0.15),
        speedX: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.7 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y < 0) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  const skipIntro = () => {
    if (isDiving || isDone) return;
    audioMaster.unlock();
    audioMaster.stopIntroSound();
    audioMaster.playIntroDive();
    setIsDiving(true);
    setProgress(100);
    setStatusText('ENTERING VISTARA...');
    if (onTransitionStart) onTransitionStart();
    setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setIsDone(true);
        if (onComplete) onComplete();
      }, 300);
    }, 250);
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
        isFadingOut
          ? 'opacity-0 pointer-events-none'
          : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#07090e',
      }}
    >
      {/* 1. Background Dust Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none opacity-60"
      />

      {/* 2. Netflix-Style Vertical Prismatic Light Ribbons */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${
          stage >= 1 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="relative w-full h-full max-w-4xl flex justify-center items-center overflow-hidden">
          {/* Prismatic vertical ribbon bars */}
          {[
            { offset: -180, w: 2, delay: '0ms', dur: '2.8s' },
            { offset: -120, w: 3, delay: '150ms', dur: '2.5s' },
            { offset: -60, w: 1.5, delay: '300ms', dur: '3.1s' },
            { offset: -20, w: 4, delay: '80ms', dur: '2.3s' },
            { offset: 20, w: 4, delay: '120ms', dur: '2.4s' },
            { offset: 60, w: 1.5, delay: '350ms', dur: '3.0s' },
            { offset: 120, w: 3, delay: '200ms', dur: '2.6s' },
            { offset: 180, w: 2, delay: '50ms', dur: '2.9s' },
          ].map((bar, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 bg-[#35C6B0]/20 transition-all duration-1000"
              style={{
                width: `${bar.w}px`,
                transform: `translateX(${bar.offset}px) scaleY(${isDiving ? 4.0 : 1.0})`,
                filter: 'blur(1px)',
                opacity: isDiving ? 0.9 : 0.45,
                animation: `lightRibbonStream ${bar.dur} ease-in-out infinite`,
                animationDelay: bar.delay,
              }}
            />
          ))}
        </div>
      </div>

      {/* 3. Deep Radial Volumetric Ambient Glow behind V */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full transition-all duration-1000 ${
          stage >= 2
            ? 'w-[750px] h-[750px] bg-[#35C6B0]/15 blur-[130px] opacity-100'
            : stage >= 1
            ? 'w-[450px] h-[450px] bg-[#35C6B0]/10 blur-[90px] opacity-60'
            : 'w-20 h-20 bg-[#35C6B0]/10 blur-[40px] opacity-20'
        }`}
      />

      {/* 4. Shockwave Ring (Triggers on Stage 2 "Ta-Dum" Impact) */}
      {stage >= 2 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="w-[320px] h-[320px] rounded-full border border-[#35C6B0]/80 shadow-[0_0_50px_rgba(53,198,176,0.6)] animate-cinematic-shockwave" />
          <div className="w-[320px] h-[320px] rounded-full border border-[#35C6B0]/40 animate-cinematic-shockwave [animation-delay:120ms]" />
        </div>
      )}

      {/* 5. Center Monolith: The "V" and Cinematic Typography */}
      <div
        className="relative z-20 flex flex-col items-center justify-center w-full h-full transition-transform duration-[850ms]"
        style={{
          perspective: '1200px',
          transform: isDiving
            ? 'scale(26) translateZ(800px)'
            : 'scale(1) translateZ(0)',
          transformOrigin: '50% 46%',
          transitionTimingFunction: 'cubic-bezier(0.7, 0, 0.84, 0)',
        }}
      >
        {/* Core Monolith V Container */}
        <div className="relative w-36 h-36 flex items-center justify-center mb-6">
          {/* Subtle Outer Diamond Ring */}
          <div
            className={`absolute inset-0 rounded-2xl border transition-all duration-1000 ease-out ${
              stage >= 2
                ? 'border-[#35C6B0]/70 rotate-45 scale-100 shadow-[0_0_35px_rgba(53,198,176,0.35)]'
                : stage >= 1
                ? 'border-[#2e3748] rotate-45 scale-90'
                : 'border-transparent scale-50 opacity-0 rotate-0'
            }`}
          />

          {/* Inner Matte Backdrop Plate */}
          <div
            className={`absolute inset-2.5 rounded-xl bg-[#0f1219]/90 border transition-all duration-700 rotate-45 ${
              stage >= 2
                ? 'border-[#35C6B0]/60 shadow-[inset_0_0_20px_rgba(53,198,176,0.3)]'
                : 'border-[#1e2430]'
            }`}
          />

          {/* Epic SVG Vistara Monolith Emblem */}
          <svg
            viewBox="0 0 100 100"
            className="w-20 h-20 relative z-20 transition-all duration-700 ease-out"
          >
            {/* Background Laser Contour Stroke that draws itself */}
            <path
              d="M 18 20 L 50 84 L 82 20 L 66 20 L 50 56 L 34 20 Z"
              fill="none"
              stroke="#35C6B0"
              strokeWidth="1.5"
              strokeDasharray="260"
              strokeDashoffset={stage >= 1 ? 0 : 260}
              className="transition-all duration-1000 ease-out"
            />

            {/* Left Facet Wing */}
            <path
              d="M 18 20 L 50 84 L 50 56 L 34 20 Z"
              fill="#2ba895"
              className={`transition-opacity duration-700 ${
                stage >= 1 ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Right Facet Wing with Chrome Sheen */}
            <path
              d="M 50 84 L 82 20 L 66 20 L 50 56 Z"
              fill="#35C6B0"
              className={`transition-opacity duration-700 ${
                stage >= 1 ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Center Precision Wedge / Prismatic Core */}
            <path
              d="M 42 20 L 50 38 L 58 20 Z"
              fill="#ffffff"
              className={`transition-all duration-500 ${
                stage >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
              }`}
            />

            {/* Flash Light Core Detonation at Stage 2 */}
            {stage >= 2 && (
              <circle
                cx="50"
                cy="54"
                r="30"
                fill="url(#coreFlare)"
                className="animate-pulse"
              />
            )}
          </svg>

          {/* Optical Center Lens Flare on Ta-Dum Climax */}
          <div
            className={`absolute pointer-events-none transition-all duration-700 ${
              stage >= 2
                ? 'w-64 h-[2px] bg-white opacity-80 scale-x-100'
                : 'w-10 h-[1px] bg-white opacity-0 scale-x-0'
            }`}
          />
        </div>

        {/* 6. Typography: VISTARA */}
        <div className="overflow-hidden py-1">
          <h1
            className={`text-4xl sm:text-5xl font-black text-white tracking-[0.45em] transition-all duration-800 transform ${
              stage >= 1
                ? 'translate-y-0 opacity-100'
                : 'translate-y-8 opacity-0'
            }`}
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
          >
            <span>VISTARA</span>
          </h1>
        </div>

        {/* Tagline: PERSONAL MEDIA UNIVERSE */}
        <div className="overflow-hidden mt-3">
          <p
            className={`text-[11px] sm:text-xs font-bold tracking-[0.4em] uppercase transition-all duration-700 delay-150 transform ${
              stage >= 1
                ? 'translate-y-0 opacity-80 text-accent'
                : 'translate-y-4 opacity-0 text-gray-500'
            }`}
          >
            Personal Media Universe
          </p>
        </div>

        {/* Cinematic Underline Accent */}
        <div
          className={`h-[2px] bg-accent/60 transition-all duration-1000 mt-4 ${
            stage >= 2
              ? 'w-48 opacity-100'
              : stage >= 1
              ? 'w-24 opacity-60'
              : 'w-0 opacity-0'
          }`}
        />

        {/* Minimalist Progress Line */}
        <div
          className={`w-64 h-[2px] bg-[#181c24] rounded-full overflow-hidden mt-6 relative transition-opacity duration-500 ${
            isDiving ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div
            className="h-full bg-accent transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status Text Ticker */}
        <div
          className={`h-6 mt-2.5 flex items-center justify-center transition-opacity duration-500 ${
            isDiving ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span className="text-[10px] font-mono tracking-widest text-[#9ca3af] uppercase">
            {statusText}
          </span>
        </div>
      </div>

      {/* 7. Bottom Action / Sound Prompt Indicator */}
      <div className="absolute bottom-7 left-0 right-0 flex justify-center pointer-events-none">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent/80 bg-[#12151b]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-accent/30 transition-all hover:opacity-100 shadow-lg">
          {!isUnlocked ? '🔊 Click anywhere to enable sound & dive in' : 'Click or Space to Skip'}
        </span>
      </div>
    </div>
  );
};
