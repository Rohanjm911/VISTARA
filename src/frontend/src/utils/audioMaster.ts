/**
 * VISTARA Unified Master Audio Engine
 * Single-context Web Audio API architecture ensuring 100% sample-accurate sync,
 * seamless browser autoplay unlocking, and shared audio bus across:
 *  - Cinematic "Ta-Dum" Startup Intro
 *  - Soothing Ambient Soundscape
 *  - Interactive Tactile UI Feedback
 */

export type AmbientPreset = 'cosmic' | 'ethereal' | 'zen';

export type IntroSoundProfile = 'cyber_horizon' | 'cinema_tadum' | 'acoustic_zen' | 'retro_cyberpunk' | 'cosmic_ambient';

export interface IntroSoundProfileOption {
  id: IntroSoundProfile;
  name: string;
  category: string;
  description: string;
  badge?: string;
}

export const INTRO_SOUND_PROFILES: IntroSoundProfileOption[] = [
  {
    id: 'cyber_horizon',
    name: 'Cyber-Horizon',
    category: 'PlayStation / Sci-Fi Synthwave',
    description: 'Warm poly-synth chord with orbital sub-drop, crystalline bells, and ethereal whisper',
    badge: 'Default',
  },
  {
    id: 'cinema_tadum',
    name: 'Cinema Ta-Dum',
    category: 'Dolby / Netflix Theatrical',
    description: 'Heavy dual sub-bass slam, analog brass chord, and theatrical orchestral chimes',
  },
  {
    id: 'acoustic_zen',
    name: 'Acoustic Zen',
    category: 'Apple / Mac Harmonic Glass',
    description: 'Pure harmonic glass chime chord, warm wooden acoustic transient, and delicate resonance',
  },
  {
    id: 'retro_cyberpunk',
    name: 'Retro Cyberpunk',
    category: 'Blade Runner / 80s Moog',
    description: 'Detuned analog sawtooth brass sweep, warm stereo chorus, and retro arpeggiator flutter',
  },
  {
    id: 'cosmic_ambient',
    name: 'Cosmic Ambient',
    category: 'Interstellar / Deep Space',
    description: 'Vast binaural celestial drone, sub-harmonic resonance, and shimmering planetary twinkle',
  },
];

export type UISoundType =
  | 'click'
  | 'hover'
  | 'tab'
  | 'toggleOn'
  | 'toggleOff'
  | 'modalOpen'
  | 'modalClose'
  | 'success'
  | 'play';

import { VISTARA_FEMALE_VOICE_BASE64 } from './vistaraVoiceData';

class AudioMasterEngine {
  private ctx: AudioContext | null = null;
  private isAudioUnlocked: boolean = false;
  private unlockListenersAttached: boolean = false;

  // --- Intro Settings ---
  private introSoundEnabled: boolean = true;
  private introSoundProfile: IntroSoundProfile = 'cyber_horizon';
  private isIntroActive: boolean = false;
  private introMasterGain: GainNode | null = null;
  private voiceBuffer: AudioBuffer | null = null;
  private isDecodingVoice: boolean = false;

  // --- Ambient Soundscape State ---
  private ambientEnabled: boolean = true;
  private ambientVolume: number = 0.22;
  private ambientPreset: AmbientPreset = 'cosmic';
  private ambientRunning: boolean = false;
  private ambientDucked: boolean = false;
  private ambientMasterGain: GainNode | null = null;
  private ambientPadGain: GainNode | null = null;
  private ambientOscs: OscillatorNode[] = [];
  private ambientLfos: OscillatorNode[] = [];
  private ambientChimeTimer: any = null;

  // --- UI Sound Effects State ---
  private uiSoundEnabled: boolean = true;
  private uiVolume: number = 0.25;
  private lastHoverTime: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      // Load stored preferences
      this.introSoundEnabled = localStorage.getItem('vistara_startup_sound') !== 'false';

      const savedIntroProfile = localStorage.getItem('vistara_intro_sound_profile') as IntroSoundProfile;
      if (
        savedIntroProfile &&
        ['cyber_horizon', 'cinema_tadum', 'acoustic_zen', 'retro_cyberpunk', 'cosmic_ambient'].includes(
          savedIntroProfile
        )
      ) {
        this.introSoundProfile = savedIntroProfile;
      } else {
        this.introSoundProfile = 'cyber_horizon';
      }

      this.ambientEnabled = localStorage.getItem('vistara_ambient_enabled') !== 'false';
      this.uiSoundEnabled = localStorage.getItem('vistara_ui_sound_enabled') !== 'false';

      const savedAmbVol = localStorage.getItem('vistara_ambient_volume');
      if (savedAmbVol !== null) this.ambientVolume = parseFloat(savedAmbVol) || 0.22;

      const savedPreset = localStorage.getItem('vistara_ambient_preset') as AmbientPreset;
      if (savedPreset && ['cosmic', 'ethereal', 'zen'].includes(savedPreset)) {
        this.ambientPreset = savedPreset;
      }

      const savedUiVol = localStorage.getItem('vistara_ui_sound_volume');
      if (savedUiVol !== null) this.uiVolume = parseFloat(savedUiVol) || 0.25;

      this.attachGlobalUnlockers();
    }
  }

  // =========================================================================
  // 1. MASTER AUDIO CONTEXT & AUTOPLAY UNLOCK
  // =========================================================================

  public getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public isUnlocked(): boolean {
    return this.isAudioUnlocked && this.ctx?.state === 'running';
  }

  /**
   * Unlocks the AudioContext immediately on user gesture or desktop launch
   */
  public async unlock(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    if (ctx.state === 'running') {
      this.isAudioUnlocked = true;
      this.preloadVoiceBuffer();
      // If ambient sound was enabled and queued, start it now (unless intro is active)
      if (this.ambientEnabled && !this.ambientRunning && !this.ambientDucked && !this.isIntroActive) {
        this.startAmbient();
      }
      return true;
    }

    return false;
  }

  /**
   * Pre-loads and caches the decoded audio buffer for the soft female 'Vistara' voice
   */
  public async preloadVoiceBuffer(): Promise<AudioBuffer | null> {
    if (this.voiceBuffer) return this.voiceBuffer;
    if (this.isDecodingVoice) return null;
    const ctx = this.getContext();
    if (!ctx) return null;

    this.isDecodingVoice = true;
    try {
      const binaryString = atob(VISTARA_FEMALE_VOICE_BASE64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      this.voiceBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      return this.voiceBuffer;
    } catch (e) {
      console.warn('Could not decode embedded female voice buffer:', e);
      return null;
    } finally {
      this.isDecodingVoice = false;
    }
  }

  private attachGlobalUnlockers(): void {
    if (this.unlockListenersAttached || typeof window === 'undefined') return;
    this.unlockListenersAttached = true;

    const onGesture = () => {
      this.unlock();
    };

    window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onGesture, { capture: true, passive: true });
    window.addEventListener('focus', onGesture, { capture: true, passive: true });
  }

  // =========================================================================
  // 2. CINEMATIC "TA-DUM" INTRO SYNTHESIZER
  // Sample-accurate synchronization with the visual flash and shockwave
  // =========================================================================

  public isIntroSoundEnabled(): boolean {
    return this.introSoundEnabled;
  }

  public setIntroSoundEnabled(enabled: boolean): void {
    this.introSoundEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vistara_startup_sound', enabled ? 'true' : 'false');
    }
  }

  public getIntroSoundProfile(): IntroSoundProfile {
    return this.introSoundProfile;
  }

  public setIntroSoundProfile(profile: IntroSoundProfile): void {
    this.introSoundProfile = profile;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vistara_intro_sound_profile', profile);
    }
  }

  /**
   * Dispatches to the active or requested intro sound profile.
   */
  public playIntroTaDum(overrideProfile?: IntroSoundProfile): void {
    this.playIntroSound(overrideProfile);
  }

  public playIntroSound(overrideProfile?: IntroSoundProfile): void {
    if (!this.introSoundEnabled && !overrideProfile) return;

    const ctx = this.getContext();
    if (!ctx) return;

    this.isIntroActive = true;
    if (this.ambientRunning) {
      this.duckAmbient(true);
    }

    const execute = () => {
      try {
        const t0 = ctx.currentTime;

        // Dynamics Compressor for rich, punchy cinematic master bus
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-14, t0);
        compressor.knee.setValueAtTime(8, t0);
        compressor.ratio.setValueAtTime(4, t0);
        compressor.attack.setValueAtTime(0.003, t0);
        compressor.release.setValueAtTime(0.25, t0);
        compressor.connect(ctx.destination);

        const master = ctx.createGain();
        master.gain.setValueAtTime(0.9, t0);
        master.connect(compressor);
        this.introMasterGain = master;

        const profile = overrideProfile || this.introSoundProfile;

        switch (profile) {
          case 'cyber_horizon':
            this.playCyberHorizon(ctx, master, t0);
            break;
          case 'acoustic_zen':
            this.playAcousticZen(ctx, master, t0);
            break;
          case 'retro_cyberpunk':
            this.playRetroCyberpunk(ctx, master, t0);
            break;
          case 'cosmic_ambient':
            this.playCosmicAmbient(ctx, master, t0);
            break;
          case 'cinema_tadum':
          default:
            this.playCinemaTaDum(ctx, master, t0);
            break;
        }
      } catch (err) {
        console.warn('Intro sound playback note:', err);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(execute).catch(() => {});
    } else {
      execute();
    }
  }

  /**
   * Helper to play the seductive, breathy female whisper "Vistara" seamlessly over any intro profile.
   * Mastered with warm proximity EQ, silky air band, and intimate Haas stereo imaging.
   */
  private playVoiceWhisper(ctx: AudioContext, master: GainNode, triggerTime: number): void {
    this.preloadVoiceBuffer()
      .then((buffer) => {
        if (!buffer) {
          this.speakVistaraFallback();
          return;
        }
        if (!this.isIntroActive) return;

        try {
          const voiceSource = ctx.createBufferSource();
          voiceSource.buffer = buffer;

          // 1. Proximity Warmth Filter (gives that close-to-the-ear intimate sensation)
          const warmFilter = ctx.createBiquadFilter();
          warmFilter.type = 'lowshelf';
          warmFilter.frequency.setValueAtTime(240, triggerTime);
          warmFilter.gain.setValueAtTime(2.5, triggerTime);

          // 2. Silky Air Band Filter (ultra-breathy ASMR high frequencies)
          const airFilter = ctx.createBiquadFilter();
          airFilter.type = 'highshelf';
          airFilter.frequency.setValueAtTime(7500, triggerTime);
          airFilter.gain.setValueAtTime(4.2, triggerTime);

          // 3. Stereo Spatial Widener / Haas Micro-Space
          const delay = ctx.createDelay();
          delay.delayTime.setValueAtTime(0.018, triggerTime);
          const delayGain = ctx.createGain();
          delayGain.gain.setValueAtTime(0.32, triggerTime);

          // 4. Smooth Intimate Dynamics Envelope
          const voiceGain = ctx.createGain();
          voiceGain.gain.setValueAtTime(0.001, triggerTime);
          voiceGain.gain.linearRampToValueAtTime(0.92, triggerTime + 0.12);
          voiceGain.gain.setValueAtTime(0.92, triggerTime + buffer.duration - 0.35);
          voiceGain.gain.exponentialRampToValueAtTime(0.0001, triggerTime + buffer.duration);

          voiceSource.connect(warmFilter);
          warmFilter.connect(airFilter);
          airFilter.connect(voiceGain);
          voiceGain.connect(master);

          // Haas spatial branch for immersive binaural wrap
          airFilter.connect(delay);
          delay.connect(delayGain);
          delayGain.connect(master);

          voiceSource.start(triggerTime);
        } catch {
          this.speakVistaraFallback();
        }
      })
      .catch(() => {
        this.speakVistaraFallback();
      });
  }

  /**
   * PROFILE 1: Cyber-Horizon (PlayStation / Sci-Fi Synthwave) — DEFAULT
   * Futuristic shimmer riser -> Dmaj9/F#sus poly-synth chord -> Orbital sub-drop -> Crystalline bells -> Ethereal whisper
   */
  private playCyberHorizon(ctx: AudioContext, master: GainNode, t0: number): void {
    // 1. Shimmer Riser (t0 -> t0 + 0.44s)
    const riserTri = ctx.createOscillator();
    const riserSaw = ctx.createOscillator();
    const riserBp = ctx.createBiquadFilter();
    const riserGain = ctx.createGain();

    riserTri.type = 'triangle';
    riserTri.frequency.setValueAtTime(120, t0);
    riserTri.frequency.exponentialRampToValueAtTime(780, t0 + 0.44);

    riserSaw.type = 'sawtooth';
    riserSaw.frequency.setValueAtTime(180, t0);
    riserSaw.frequency.exponentialRampToValueAtTime(1170, t0 + 0.44);

    riserBp.type = 'bandpass';
    riserBp.Q.setValueAtTime(3.2, t0);
    riserBp.frequency.setValueAtTime(220, t0);
    riserBp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.44);

    riserGain.gain.setValueAtTime(0.001, t0);
    riserGain.gain.linearRampToValueAtTime(0.28, t0 + 0.40);
    riserGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.48);

    riserTri.connect(riserBp);
    riserSaw.connect(riserBp);
    riserBp.connect(riserGain);
    riserGain.connect(master);

    riserTri.start(t0);
    riserSaw.start(t0);
    riserTri.stop(t0 + 0.50);
    riserSaw.stop(t0 + 0.50);

    const hitTime = t0 + 0.50; // Aligns perfectly with Stage 2 visual detonation!

    // 2. Orbital Sub-Drop (96Hz -> 48Hz -> 36Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    const subShaper = ctx.createWaveShaper();
    subShaper.curve = this.makeSaturationCurve(16) as any;
    subShaper.oversample = '2x';

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(96, hitTime);
    subOsc.frequency.exponentialRampToValueAtTime(48, hitTime + 0.12);
    subOsc.frequency.exponentialRampToValueAtTime(36, hitTime + 1.2);

    subGain.gain.setValueAtTime(0.001, hitTime);
    subGain.gain.linearRampToValueAtTime(0.95, hitTime + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.40, hitTime + 0.35);
    subGain.gain.linearRampToValueAtTime(0.22, hitTime + 1.45);
    subGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 2.15);

    subOsc.connect(subShaper);
    subShaper.connect(subGain);
    subGain.connect(master);

    subOsc.start(hitTime);
    subOsc.stop(hitTime + 2.2);

    // 3. Warm Poly-Synth Chord (Dmaj9 / F#sus Warmth)
    const polyNotes = [146.83, 220.0, 277.18, 329.63, 369.99, 440.0];
    polyNotes.forEach((freq, idx) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const noteGain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(freq * 0.997, hitTime);
      osc2.frequency.setValueAtTime(freq * 1.003, hitTime);

      lpf.type = 'lowpass';
      lpf.Q.setValueAtTime(3.2, hitTime);
      lpf.frequency.setValueAtTime(3600, hitTime);
      lpf.frequency.exponentialRampToValueAtTime(440, hitTime + 1.4);

      const amp = idx === 0 ? 0.24 : 0.16;
      noteGain.gain.setValueAtTime(0.001, hitTime);
      noteGain.gain.linearRampToValueAtTime(amp, hitTime + 0.035);
      noteGain.gain.exponentialRampToValueAtTime(amp * 0.45, hitTime + 0.45);
      noteGain.gain.linearRampToValueAtTime(amp * 0.20, hitTime + 1.45);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 2.15);

      osc1.connect(lpf);
      osc2.connect(lpf);
      lpf.connect(noteGain);
      noteGain.connect(master);

      osc1.start(hitTime);
      osc2.start(hitTime);
      osc1.stop(hitTime + 2.2);
      osc2.stop(hitTime + 2.2);
    });

    // 4. Crystalline Glass Bells
    const bellFreqs = [1479.98, 2217.46, 2959.96];
    bellFreqs.forEach((freq, i) => {
      const bell = ctx.createOscillator();
      const bellGain = ctx.createGain();
      const bellHp = ctx.createBiquadFilter();

      bell.type = 'sine';
      bell.frequency.setValueAtTime(freq, hitTime + 0.01);

      bellHp.type = 'highpass';
      bellHp.frequency.setValueAtTime(1200, hitTime);

      bellGain.gain.setValueAtTime(0.001, hitTime);
      bellGain.gain.linearRampToValueAtTime(0.05 / (i + 1), hitTime + 0.03);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 1.95);

      bell.connect(bellHp);
      bellHp.connect(bellGain);
      bellGain.connect(master);

      bell.start(hitTime + 0.01);
      bell.stop(hitTime + 2.0);
    });

    // 5. Soft Female Vocal Whisper ("Vistara") floating over chord tail
    this.playVoiceWhisper(ctx, master, hitTime + 0.38);
  }

  /**
   * PROFILE 2: Cinema Ta-Dum (Dolby / Netflix Theatrical)
   */
  private playCinemaTaDum(ctx: AudioContext, master: GainNode, t0: number): void {

        // --- LAYER 1: The Rising Suction (t0 -> t0 + 0.40s) ---
        const riserOsc = ctx.createOscillator();
        const riserGain = ctx.createGain();
        riserOsc.type = 'sine';
        riserOsc.frequency.setValueAtTime(45, t0);
        riserOsc.frequency.exponentialRampToValueAtTime(170, t0 + 0.38);
        riserGain.gain.setValueAtTime(0.001, t0);
        riserGain.gain.linearRampToValueAtTime(0.35, t0 + 0.34);
        riserGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
        riserOsc.connect(riserGain);
        riserGain.connect(master);
        riserOsc.start(t0);
        riserOsc.stop(t0 + 0.45);

        // --- LAYER 2: First Strike ("TA-", t0 + 0.35s) ---
        const hit1Time = t0 + 0.35;
        const hit1Osc = ctx.createOscillator();
        const hit1Gain = ctx.createGain();
        hit1Osc.type = 'triangle';
        hit1Osc.frequency.setValueAtTime(140, hit1Time);
        hit1Osc.frequency.exponentialRampToValueAtTime(55, hit1Time + 0.08);

        hit1Gain.gain.setValueAtTime(0.001, hit1Time);
        hit1Gain.gain.linearRampToValueAtTime(0.7, hit1Time + 0.015);
        hit1Gain.gain.exponentialRampToValueAtTime(0.01, hit1Time + 0.14);

        hit1Osc.connect(hit1Gain);
        hit1Gain.connect(master);
        hit1Osc.start(hit1Time);
        hit1Osc.stop(hit1Time + 0.16);

        // --- LAYER 3: The Massive Secondary Drop ("-DUM", t0 + 0.50s) ---
        const hit2Time = t0 + 0.50; // Aligns with Stage 2 visual detonation!

        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(120, hit2Time);
        subOsc.frequency.exponentialRampToValueAtTime(46, hit2Time + 0.09);
        subOsc.frequency.exponentialRampToValueAtTime(36, hit2Time + 0.7);

        // Sustained warm sub rumble connecting seamlessly into the camera dive
        subGain.gain.setValueAtTime(0.001, hit2Time);
        subGain.gain.linearRampToValueAtTime(1.0, hit2Time + 0.02);
        subGain.gain.exponentialRampToValueAtTime(0.42, hit2Time + 0.32);
        subGain.gain.linearRampToValueAtTime(0.24, hit2Time + 1.5);
        subGain.gain.exponentialRampToValueAtTime(0.0001, hit2Time + 2.15);

        const shaper = ctx.createWaveShaper();
        shaper.curve = this.makeSaturationCurve(16) as any;
        shaper.oversample = '2x';

        subOsc.connect(shaper);
        shaper.connect(subGain);
        subGain.connect(master);

        subOsc.start(hit2Time);
        subOsc.stop(hit2Time + 2.2);

        // --- LAYER 4: Cinematic Brass / Horn Strike & Warm Pad (t0 + 0.50s) ---
        const chordNotes = [73.42, 110.0, 146.83, 185.0];
        chordNotes.forEach((freq, idx) => {
          const horn1 = ctx.createOscillator();
          const horn2 = ctx.createOscillator();
          const hornFilter = ctx.createBiquadFilter();
          const hornGain = ctx.createGain();

          horn1.type = 'sawtooth';
          horn2.type = 'sawtooth';

          horn1.frequency.setValueAtTime(freq, hit2Time);
          horn2.frequency.setValueAtTime(freq * 1.007, hit2Time);

          hornFilter.type = 'lowpass';
          hornFilter.Q.setValueAtTime(4.0, hit2Time);
          hornFilter.frequency.setValueAtTime(2600, hit2Time);
          hornFilter.frequency.exponentialRampToValueAtTime(320, hit2Time + 0.7);

          const amp = idx === 0 ? 0.34 : 0.22;
          hornGain.gain.setValueAtTime(0.001, hit2Time);
          hornGain.gain.linearRampToValueAtTime(amp, hit2Time + 0.035);
          hornGain.gain.exponentialRampToValueAtTime(amp * 0.38, hit2Time + 0.38);
          hornGain.gain.linearRampToValueAtTime(amp * 0.22, hit2Time + 1.45);
          hornGain.gain.exponentialRampToValueAtTime(0.0001, hit2Time + 2.1);

          horn1.connect(hornFilter);
          horn2.connect(hornFilter);
          hornFilter.connect(hornGain);
          hornGain.connect(master);

          horn1.start(hit2Time);
          horn2.start(hit2Time);
          horn1.stop(hit2Time + 2.15);
          horn2.stop(hit2Time + 2.15);
        });

        // --- LAYER 5: Crystalline High Chimes (t0 + 0.51s) ---
        const chimeFreqs = [1174.66, 1760.0, 2349.32];
        chimeFreqs.forEach((freq, i) => {
          const chime = ctx.createOscillator();
          const chimeGain = ctx.createGain();
          const hp = ctx.createBiquadFilter();

          chime.type = 'sine';
          chime.frequency.setValueAtTime(freq, hit2Time + 0.01);

          hp.type = 'highpass';
          hp.frequency.setValueAtTime(1000, hit2Time);

          chimeGain.gain.setValueAtTime(0.001, hit2Time);
          chimeGain.gain.linearRampToValueAtTime(0.065 / (i + 1), hit2Time + 0.05);
          chimeGain.gain.exponentialRampToValueAtTime(0.0001, hit2Time + 2.15);

          chime.connect(hp);
          hp.connect(chimeGain);
          chimeGain.connect(master);

          chime.start(hit2Time + 0.01);
          chime.stop(hit2Time + 2.2);
        });

        // --- LAYER 6: Soft Cinematic Female Voice whisper saying "Vistara" ---
        this.playVoiceWhisper(ctx, master, hit2Time + 0.42);
  }

  /**
   * PROFILE 3: Acoustic Zen (Apple / Mac Harmonic Glass)
   * Warm wooden mallet transient -> Pentatonic glass chime resonance -> Delicate decay -> Whisper
   */
  private playAcousticZen(ctx: AudioContext, master: GainNode, t0: number): void {
    const hitTime = t0 + 0.50;

    // 1. Acoustic Wood / Mallet Transient
    const malletOsc = ctx.createOscillator();
    const malletGain = ctx.createGain();
    malletOsc.type = 'sine';
    malletOsc.frequency.setValueAtTime(520, hitTime);
    malletOsc.frequency.exponentialRampToValueAtTime(75, hitTime + 0.045);

    malletGain.gain.setValueAtTime(0.001, hitTime);
    malletGain.gain.linearRampToValueAtTime(0.55, hitTime + 0.008);
    malletGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 0.09);

    malletOsc.connect(malletGain);
    malletGain.connect(master);
    malletOsc.start(hitTime);
    malletOsc.stop(hitTime + 0.1);

    // 2. Warm Acoustic Sub/Body (C2 65.4Hz & C3 130.8Hz)
    const bodyOsc = ctx.createOscillator();
    const bodyLpf = ctx.createBiquadFilter();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(65.41, hitTime);

    bodyLpf.type = 'lowpass';
    bodyLpf.frequency.setValueAtTime(260, hitTime);

    bodyGain.gain.setValueAtTime(0.001, hitTime);
    bodyGain.gain.linearRampToValueAtTime(0.42, hitTime + 0.04);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 2.2);

    bodyOsc.connect(bodyLpf);
    bodyLpf.connect(bodyGain);
    bodyGain.connect(master);
    bodyOsc.start(hitTime);
    bodyOsc.stop(hitTime + 2.25);

    // 3. Pure Harmonic Pentatonic Glass Chimes
    const zenNotes = [261.63, 329.63, 392.0, 493.88, 587.33, 783.99];
    zenNotes.forEach((freq, idx) => {
      const chime = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const chimeGain = ctx.createGain();

      chime.type = 'sine';
      overtone.type = 'triangle';

      chime.frequency.setValueAtTime(freq, hitTime + 0.005);
      overtone.frequency.setValueAtTime(freq * 2.01, hitTime + 0.005);

      const amp = 0.12 / Math.sqrt(idx + 1);
      chimeGain.gain.setValueAtTime(0.001, hitTime);
      chimeGain.gain.linearRampToValueAtTime(amp, hitTime + 0.025);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 2.4);

      chime.connect(chimeGain);
      overtone.connect(chimeGain);
      chimeGain.connect(master);

      chime.start(hitTime + 0.005);
      overtone.start(hitTime + 0.005);
      chime.stop(hitTime + 2.45);
      overtone.stop(hitTime + 2.45);
    });

    // 4. Soft Female Vocal Whisper ("Vistara")
    this.playVoiceWhisper(ctx, master, hitTime + 0.35);
  }

  /**
   * PROFILE 4: Retro Cyberpunk (Blade Runner / 80s Moog)
   * 16th-note arpeggiator flutter -> Moog detuned sawtooth brass chord -> Deep analog sub -> Tape delay
   */
  private playRetroCyberpunk(ctx: AudioContext, master: GainNode, t0: number): void {
    // 1. Retro Arpeggio Riser Flutter (4 steps)
    const arpSteps = [110, 220, 440, 880];
    arpSteps.forEach((freq, i) => {
      const stepTime = t0 + 0.12 + i * 0.08;
      const arpOsc = ctx.createOscillator();
      const arpFilter = ctx.createBiquadFilter();
      const arpGain = ctx.createGain();

      arpOsc.type = 'square';
      arpOsc.frequency.setValueAtTime(freq, stepTime);

      arpFilter.type = 'lowpass';
      arpFilter.frequency.setValueAtTime(1400, stepTime);

      arpGain.gain.setValueAtTime(0.001, stepTime);
      arpGain.gain.linearRampToValueAtTime(0.12, stepTime + 0.01);
      arpGain.gain.exponentialRampToValueAtTime(0.0001, stepTime + 0.07);

      arpOsc.connect(arpFilter);
      arpFilter.connect(arpGain);
      arpGain.connect(master);

      arpOsc.start(stepTime);
      arpOsc.stop(stepTime + 0.08);
    });

    const hitTime = t0 + 0.50;

    // 2. Analog Moog Sub Bass (55Hz Square with heavy saturation)
    const subOsc = ctx.createOscillator();
    const subLpf = ctx.createBiquadFilter();
    const subGain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.makeSaturationCurve(24) as any;

    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(55, hitTime);
    subLpf.type = 'lowpass';
    subLpf.frequency.setValueAtTime(180, hitTime);

    subGain.gain.setValueAtTime(0.001, hitTime);
    subGain.gain.linearRampToValueAtTime(0.75, hitTime + 0.025);
    subGain.gain.exponentialRampToValueAtTime(0.35, hitTime + 0.45);
    subGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 2.15);

    subOsc.connect(subLpf);
    subLpf.connect(shaper);
    shaper.connect(subGain);
    subGain.connect(master);
    subOsc.start(hitTime);
    subOsc.stop(hitTime + 2.2);

    // 3. Thick Detuned Moog Sawtooth Brass Chord (A2, E3, A3, C#4, E4)
    const moogNotes = [110.0, 164.81, 220.0, 277.18, 329.63];
    moogNotes.forEach((freq, idx) => {
      const saw1 = ctx.createOscillator();
      const saw2 = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      saw1.type = 'sawtooth';
      saw2.type = 'sawtooth';
      saw1.frequency.setValueAtTime(freq * 0.993, hitTime);
      saw2.frequency.setValueAtTime(freq * 1.007, hitTime);

      lpf.type = 'lowpass';
      lpf.Q.setValueAtTime(5.5, hitTime);
      lpf.frequency.setValueAtTime(4800, hitTime);
      lpf.frequency.exponentialRampToValueAtTime(380, hitTime + 1.2);

      const amp = idx === 0 ? 0.28 : 0.18;
      gain.gain.setValueAtTime(0.001, hitTime);
      gain.gain.linearRampToValueAtTime(amp, hitTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(amp * 0.4, hitTime + 0.5);
      gain.gain.linearRampToValueAtTime(amp * 0.2, hitTime + 1.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 2.1);

      saw1.connect(lpf);
      saw2.connect(lpf);
      lpf.connect(gain);
      gain.connect(master);

      saw1.start(hitTime);
      saw2.start(hitTime);
      saw1.stop(hitTime + 2.15);
      saw2.stop(hitTime + 2.15);
    });

    // 4. Soft Female Vocal Whisper ("Vistara")
    this.playVoiceWhisper(ctx, master, hitTime + 0.40);
  }

  /**
   * PROFILE 5: Cosmic Ambient (Interstellar / Deep Space)
   * Binaural drone -> Ethereal celestial pad -> Planetary rumble -> Soft whisper
   */
  private playCosmicAmbient(ctx: AudioContext, master: GainNode, t0: number): void {
    // 1. Celestial Ambient Riser
    const riserOsc = ctx.createOscillator();
    const riserFilter = ctx.createBiquadFilter();
    const riserGain = ctx.createGain();

    riserOsc.type = 'sine';
    riserOsc.frequency.setValueAtTime(110, t0);
    riserOsc.frequency.exponentialRampToValueAtTime(660, t0 + 0.45);

    riserFilter.type = 'bandpass';
    riserFilter.Q.setValueAtTime(5.0, t0);
    riserFilter.frequency.setValueAtTime(180, t0);
    riserFilter.frequency.exponentialRampToValueAtTime(1800, t0 + 0.45);

    riserGain.gain.setValueAtTime(0.001, t0);
    riserGain.gain.linearRampToValueAtTime(0.25, t0 + 0.42);
    riserGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.49);

    riserOsc.connect(riserFilter);
    riserFilter.connect(riserGain);
    riserGain.connect(master);

    riserOsc.start(t0);
    riserOsc.stop(t0 + 0.5);

    const hitTime = t0 + 0.50;

    // 2. Binaural Cosmic Drone (55.0Hz & 55.75Hz for 0.75Hz celestial beating)
    const drone1 = ctx.createOscillator();
    const drone2 = ctx.createOscillator();
    const droneGain = ctx.createGain();

    drone1.type = 'sine';
    drone2.type = 'sine';
    drone1.frequency.setValueAtTime(55.0, hitTime);
    drone2.frequency.setValueAtTime(55.75, hitTime);

    droneGain.gain.setValueAtTime(0.001, hitTime);
    droneGain.gain.linearRampToValueAtTime(0.55, hitTime + 0.15);
    droneGain.gain.linearRampToValueAtTime(0.40, hitTime + 1.4);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 2.3);

    drone1.connect(droneGain);
    drone2.connect(droneGain);
    droneGain.connect(master);

    drone1.start(hitTime);
    drone2.start(hitTime);
    drone1.stop(hitTime + 2.35);
    drone2.stop(hitTime + 2.35);

    // 3. Ethereal Celestial Pad Swell
    const padNotes = [220.0, 277.18, 329.63, 415.3, 554.37];
    padNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, hitTime);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(1200, hitTime);

      const amp = 0.14 / Math.sqrt(idx + 1);
      gain.gain.setValueAtTime(0.001, hitTime);
      gain.gain.linearRampToValueAtTime(amp, hitTime + 0.22);
      gain.gain.exponentialRampToValueAtTime(amp * 0.35, hitTime + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 2.3);

      osc.connect(lpf);
      lpf.connect(gain);
      gain.connect(master);

      osc.start(hitTime);
      osc.stop(hitTime + 2.35);
    });

    // 4. Soft Female Vocal Whisper ("Vistara")
    this.playVoiceWhisper(ctx, master, hitTime + 0.45);
  }

  /**
   * Fallback Web Speech API engine using high-quality female natural voice
   */
  public speakVistaraFallback(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Vistara');
      utterance.rate = 0.85;
      utterance.pitch = 1.08;
      utterance.volume = 0.75;
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (v) =>
          (v.lang.startsWith('en') || v.lang.startsWith('hi')) &&
          /female|zira|jenny|aria|ava|samantha|victoria|karen|neerja|sonia/i.test(v.name)
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  /**
   * Sample-accurate Hyper-Dive Warp Sound
   * Triggers exactly when the camera plunges through the monolith emblem into the dashboard.
   */
  public playIntroDive(): void {
    if (!this.introSoundEnabled) return;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Dynamics Compressor for clean, powerful dive impact
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, now);
      compressor.knee.setValueAtTime(6, now);
      compressor.ratio.setValueAtTime(3, now);
      compressor.attack.setValueAtTime(0.002, now);
      compressor.release.setValueAtTime(0.2, now);
      compressor.connect(ctx.destination);

      const diveMaster = ctx.createGain();
      diveMaster.gain.setValueAtTime(0.85, now);
      diveMaster.connect(compressor);

      // 1. Sub-bass suction & warp drop (115Hz -> 36Hz)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(115, now);
      subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.55);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.85, now + 0.04);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      subOsc.connect(subGain);
      subGain.connect(diveMaster);
      subOsc.start(now);
      subOsc.stop(now + 0.9);

      // 2. High-speed cinematic whoosh (Filtered noise sweep)
      const bufferSize = Math.floor(ctx.sampleRate * 1.1);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.Q.setValueAtTime(2.2, now);
      bpFilter.frequency.setValueAtTime(320, now);
      bpFilter.frequency.exponentialRampToValueAtTime(2600, now + 0.20);
      bpFilter.frequency.exponentialRampToValueAtTime(160, now + 0.75);

      const whooshGain = ctx.createGain();
      whooshGain.gain.setValueAtTime(0.001, now);
      whooshGain.gain.linearRampToValueAtTime(0.42, now + 0.16);
      whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

      noiseSource.connect(bpFilter);
      bpFilter.connect(whooshGain);
      whooshGain.connect(diveMaster);

      noiseSource.start(now);
      noiseSource.stop(now + 0.85);

      // 3. Crystalline resolution shimmer (F5 & C6 chords resolving into dashboard)
      const sparkleFreqs = [698.46, 1046.5, 1396.91];
      sparkleFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + 0.15);

        g.gain.setValueAtTime(0.0001, now + 0.15);
        g.gain.linearRampToValueAtTime(0.05 / (idx + 1), now + 0.22);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

        osc.connect(g);
        g.connect(diveMaster);

        osc.start(now + 0.15);
        osc.stop(now + 1.0);
      });

      setTimeout(() => {
        this.isIntroActive = false;
      }, 850);
    } catch (err) {
      console.warn('Intro dive transition note:', err);
    }
  }

  public stopIntroSound(): void {
    if (this.introMasterGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.introMasterGain.gain.cancelScheduledValues(now);
        this.introMasterGain.gain.linearRampToValueAtTime(0.0001, now + 0.15);
      } catch {}
    }
    this.isIntroActive = false;
  }

  // =========================================================================
  // 3. SOOTHING AMBIENT SOUNDSCAPE ENGINE
  // =========================================================================

  public isAmbientEnabled(): boolean {
    return this.ambientEnabled;
  }

  public getAmbientVolume(): number {
    return this.ambientVolume;
  }

  public getAmbientPreset(): AmbientPreset {
    return this.ambientPreset;
  }

  public setAmbientVolume(vol: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('vistara_ambient_volume', String(this.ambientVolume));
    }
    if (this.ambientMasterGain && this.ctx && !this.ambientDucked && this.ambientRunning) {
      const now = this.ctx.currentTime;
      this.ambientMasterGain.gain.cancelScheduledValues(now);
      this.ambientMasterGain.gain.linearRampToValueAtTime(this.ambientVolume, now + 0.1);
    }
  }

  public setAmbientPreset(preset: AmbientPreset): void {
    this.ambientPreset = preset;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vistara_ambient_preset', preset);
    }
    if (this.ambientRunning) {
      this.stopAmbient();
      setTimeout(() => this.startAmbient(), 150);
    }
  }

  public toggleAmbient(): boolean {
    const next = !this.ambientEnabled;
    this.setAmbientEnabled(next);
    return next;
  }

  public setAmbientEnabled(enabled: boolean): void {
    this.ambientEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vistara_ambient_enabled', enabled ? 'true' : 'false');
    }
    if (enabled) {
      this.unlock().then(() => this.startAmbient());
    } else {
      this.stopAmbient();
    }
  }

  public duckAmbient(shouldDuck: boolean): void {
    this.ambientDucked = shouldDuck;
    if (!this.ctx || !this.ambientMasterGain) return;

    try {
      const now = this.ctx.currentTime;
      this.ambientMasterGain.gain.cancelScheduledValues(now);
      if (shouldDuck) {
        this.ambientMasterGain.gain.linearRampToValueAtTime(0.0001, now + 1.2);
      } else if (this.ambientEnabled && this.ambientRunning) {
        this.ambientMasterGain.gain.linearRampToValueAtTime(this.ambientVolume, now + 2.5);
      }
    } catch {}
  }

  public startAmbient(): void {
    if (this.ambientRunning || !this.ambientEnabled || this.isIntroActive) return;

    const ctx = this.getContext();
    if (!ctx) return;

    // Must be in running state
    if (ctx.state !== 'running') {
      ctx.resume().then(() => this.startAmbient()).catch(() => {});
      return;
    }

    try {
      const now = ctx.currentTime;
      this.ambientMasterGain = ctx.createGain();
      const targetGain = this.ambientDucked ? 0.0001 : this.ambientVolume;
      this.ambientMasterGain.gain.setValueAtTime(0.0001, now);
      this.ambientMasterGain.gain.linearRampToValueAtTime(targetGain, now + 2.0);
      this.ambientMasterGain.connect(ctx.destination);

      this.ambientOscs = [];
      this.ambientLfos = [];

      let frequencies: number[];
      if (this.ambientPreset === 'ethereal') {
        frequencies = [73.42, 110.0, 174.61, 261.63, 329.63];
      } else if (this.ambientPreset === 'zen') {
        frequencies = [73.42, 98.0, 110.0, 146.83, 220.0];
      } else {
        // Cosmic (Default)
        frequencies = [87.31, 130.81, 164.81, 220.0, 392.0];
      }

      this.ambientPadGain = ctx.createGain();
      this.ambientPadGain.gain.setValueAtTime(0.35, now);

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const voiceGain = ctx.createGain();
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

        osc.type = idx === 0 ? 'sine' : 'triangle';
        const detuneAmount = (idx % 2 === 0 ? 1 : -1) * (1.5 + idx * 0.4);
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detuneAmount, now);

        const vol = idx === 0 ? 0.45 : 0.25 / (idx + 0.5);
        voiceGain.gain.setValueAtTime(vol, now);

        if (panner) {
          const panPos = ((idx / (frequencies.length - 1)) * 2 - 1) * 0.45;
          panner.pan.setValueAtTime(panPos, now);
          osc.connect(voiceGain);
          voiceGain.connect(panner);
          panner.connect(this.ambientPadGain!);
        } else {
          osc.connect(voiceGain);
          voiceGain.connect(this.ambientPadGain!);
        }

        osc.start(now);
        this.ambientOscs.push(osc);
      });

      // 22-second slow lowpass breathing filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      filter.Q.setValueAtTime(2.0, now);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.045, now);
      lfoGain.gain.setValueAtTime(220, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(now);
      this.ambientLfos.push(lfo);

      this.ambientPadGain.connect(filter);
      filter.connect(this.ambientMasterGain);

      // Pink noise cosmic air
      this.startCosmicAir(ctx, this.ambientMasterGain);

      // Random Chimes
      this.scheduleRandomChimes(ctx);

      this.ambientRunning = true;
    } catch (err) {
      console.warn('Ambient start note:', err);
    }
  }

  public stopAmbient(): void {
    if (!this.ambientRunning) return;

    if (this.ambientChimeTimer) {
      clearTimeout(this.ambientChimeTimer);
      this.ambientChimeTimer = null;
    }

    if (this.ambientMasterGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.ambientMasterGain.gain.cancelScheduledValues(now);
        this.ambientMasterGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
      } catch {}
    }

    setTimeout(() => {
      this.ambientOscs.forEach((o) => {
        try { o.stop(); o.disconnect(); } catch {}
      });
      this.ambientLfos.forEach((l) => {
        try { l.stop(); l.disconnect(); } catch {}
      });
      this.ambientOscs = [];
      this.ambientLfos = [];
      this.ambientMasterGain = null;
      this.ambientPadGain = null;
      this.ambientRunning = false;
    }, 850);
  }

  private startCosmicAir(ctx: AudioContext, destination: GainNode): void {
    try {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.08;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(280, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.035, ctx.currentTime);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(destination);

      noiseSource.start(ctx.currentTime);
      this.ambientOscs.push(noiseSource as any);
    } catch {}
  }

  private scheduleRandomChimes(ctx: AudioContext): void {
    if (!this.ambientRunning && this.ambientOscs.length === 0) return;

    const nextInterval = (8 + Math.random() * 8) * 1000;
    this.ambientChimeTimer = setTimeout(() => {
      if (this.ambientRunning && !this.ambientDucked && this.ambientMasterGain) {
        this.playSingleChime(ctx);
      }
      this.scheduleRandomChimes(ctx);
    }, nextInterval);
  }

  private playSingleChime(ctx: AudioContext): void {
    try {
      const chimeFreqs = [523.25, 659.25, 783.99, 880.0, 1046.5];
      const freq = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

      if (panner) {
        panner.pan.setValueAtTime((Math.random() * 2 - 1) * 0.7, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.ambientMasterGain!);
      } else {
        osc.connect(gain);
        gain.connect(this.ambientMasterGain!);
      }

      osc.start(now);
      osc.stop(now + 4.6);
    } catch {}
  }

  // =========================================================================
  // 4. INTERACTIVE UI SOUND EFFECTS
  // =========================================================================

  public isUiSoundEnabled(): boolean {
    return this.uiSoundEnabled;
  }

  public setUiSoundEnabled(enabled: boolean): void {
    this.uiSoundEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vistara_ui_sound_enabled', enabled ? 'true' : 'false');
    }
  }

  public getUiVolume(): number {
    return this.uiVolume;
  }

  public setUiVolume(vol: number): void {
    this.uiVolume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('vistara_ui_sound_volume', String(this.uiVolume));
    }
  }

  public playUi(type: UISoundType): void {
    if (!this.uiSoundEnabled) return;

    const ctx = this.getContext();
    if (!ctx) return;

    // If context is suspended, trigger resume silently
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const now = ctx.currentTime;
      switch (type) {
        case 'hover':
          this.synthesizeHover(ctx, now);
          break;
        case 'click':
          this.synthesizeClick(ctx, now);
          break;
        case 'tab':
          this.synthesizeTab(ctx, now);
          break;
        case 'toggleOn':
          this.synthesizeToggle(ctx, now, true);
          break;
        case 'toggleOff':
          this.synthesizeToggle(ctx, now, false);
          break;
        case 'modalOpen':
          this.synthesizeModal(ctx, now, true);
          break;
        case 'modalClose':
          this.synthesizeModal(ctx, now, false);
          break;
        case 'success':
          this.synthesizeSuccess(ctx, now);
          break;
        case 'play':
          this.synthesizePlay(ctx, now);
          break;
      }
    } catch {}
  }

  private synthesizeHover(ctx: AudioContext, now: number): void {
    const realNow = performance.now();
    if (realNow - this.lastHoverTime < 75) return;
    this.lastHoverTime = realNow;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(820, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.015);

    const amp = this.uiVolume * 0.12;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  private synthesizeClick(ctx: AudioContext, now: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(400, now);

    const amp = this.uiVolume * 0.45;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  private synthesizeTab(ctx: AudioContext, now: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);

    const amp = this.uiVolume * 0.38;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.075);
  }

  private synthesizeToggle(ctx: AudioContext, now: number, isOn: boolean): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    if (isOn) {
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(1250, now + 0.035);
    } else {
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.035);
    }

    const amp = this.uiVolume * 0.35;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.055);
  }

  private synthesizeModal(ctx: AudioContext, now: number, isOpen: boolean): void {
    const freqs = isOpen ? [620, 880, 1180] : [980, 680, 480];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.025);

      const amp = (this.uiVolume * 0.22) / (idx + 1);
      gain.gain.setValueAtTime(0.001, now + idx * 0.025);
      gain.gain.linearRampToValueAtTime(amp, now + idx * 0.025 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.025 + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.025);
      osc.stop(now + idx * 0.025 + 0.13);
    });
  }

  private synthesizePlay(ctx: AudioContext, now: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.06);

    const amp = this.uiVolume * 0.55;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  private synthesizeSuccess(ctx: AudioContext, now: number): void {
    [784, 1174].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      const amp = this.uiVolume * 0.28;
      gain.gain.setValueAtTime(0.001, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(amp, now + i * 0.06 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.38);
    });
  }

  public attachGlobalListeners(): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest('button, [role="button"], a, input[type="checkbox"], input[type="radio"], .vistara-card, select');
      if (!interactive) return;

      if (interactive instanceof HTMLInputElement && (interactive.type === 'checkbox' || interactive.type === 'radio')) {
        this.playUi(interactive.checked ? 'toggleOn' : 'toggleOff');
      } else {
        this.playUi('click');
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const hoverable = target.closest('button, [role="button"], a, .vistara-card, [data-sound="hover"]');
      if (hoverable) {
        this.playUi('hover');
      }
    };

    document.addEventListener('click', handleClick, { capture: true, passive: true });
    document.addEventListener('mouseover', handleMouseOver, { capture: true, passive: true });

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('mouseover', handleMouseOver, { capture: true });
    };
  }

  private makeSaturationCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 20;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}

export const audioMaster = new AudioMasterEngine();

// Backward compatible aliases
export const cinematicSound = {
  isSoundEnabled: () => audioMaster.isIntroSoundEnabled(),
  setSoundEnabled: (en: boolean) => audioMaster.setIntroSoundEnabled(en),
  getProfile: () => audioMaster.getIntroSoundProfile(),
  setProfile: (p: IntroSoundProfile) => audioMaster.setIntroSoundProfile(p),
  prepare: () => audioMaster.unlock(),
  playTaDum: (overrideProfile?: IntroSoundProfile) => audioMaster.playIntroSound(overrideProfile),
  playSound: (overrideProfile?: IntroSoundProfile) => audioMaster.playIntroSound(overrideProfile),
  playDive: () => audioMaster.playIntroDive(),
  stop: () => audioMaster.stopIntroSound(),
};

export const ambientSound = {
  isEnabled: () => audioMaster.isAmbientEnabled(),
  getVolume: () => audioMaster.getAmbientVolume(),
  getPreset: () => audioMaster.getAmbientPreset(),
  setVolume: (v: number) => audioMaster.setAmbientVolume(v),
  setPreset: (p: AmbientPreset) => audioMaster.setAmbientPreset(p),
  toggle: () => audioMaster.toggleAmbient(),
  setEnabled: (en: boolean) => audioMaster.setAmbientEnabled(en),
  duck: (d: boolean) => audioMaster.duckAmbient(d),
  start: () => audioMaster.startAmbient(),
  stop: () => audioMaster.stopAmbient(),
};

export const uiSound = {
  getSoundEnabled: () => audioMaster.isUiSoundEnabled(),
  setSoundEnabled: (en: boolean) => audioMaster.setUiSoundEnabled(en),
  getVolume: () => audioMaster.getUiVolume(),
  setVolume: (v: number) => audioMaster.setUiVolume(v),
  play: (t: UISoundType) => audioMaster.playUi(t),
  attachGlobalListeners: () => audioMaster.attachGlobalListeners(),
};

