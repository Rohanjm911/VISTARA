import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { BackupHistoryDto, SystemHealthDto } from '../types';
import {
  Palette,
  LayoutDashboard,
  Navigation,
  FolderCog,
  PlaySquare,
  Volume2,
  Database,
  Cpu,
  Zap,
  Bell,
  Power,
  Archive,
  Activity,
  ShieldCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Play,
  Waves,
  Sun,
  Moon,
  MousePointerClick,
} from 'lucide-react';
import { cinematicSound, INTRO_SOUND_PROFILES, IntroSoundProfile } from '../utils/cinematicSound';
import { ambientSound, AmbientPreset } from '../utils/ambientSound';
import { uiSound } from '../utils/uiSound';
import { VistaraLogo } from '../components/VistaraLogo';

type SettingsTab =
  | 'appearance'
  | 'dashboard'
  | 'navigation'
  | 'libraries'
  | 'playback'
  | 'audio'
  | 'metadata'
  | 'ffmpeg'
  | 'hwaccel'
  | 'notifications'
  | 'startup'
  | 'backup'
  | 'diagnostics'
  | 'privacy'
  | 'about';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, accentColor, setAccentColor, availableAccents } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  // Settings & Preferences
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // FFmpeg test state
  const [ffmpegPath, setFfmpegPath] = useState('');
  const [ffprobePath, setFfprobePath] = useState('');
  const [ffmpegTesting, setFfmpegTesting] = useState(false);
  const [ffmpegTestResult, setFfmpegTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Hardware Accel state
  const [hwInfo, setHwInfo] = useState<{ availableMethods: string[]; recommendedEncoder: string } | null>(null);

  // Diagnostics state
  const [health, setHealth] = useState<SystemHealthDto | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  // Backup state
  const [backups, setBackups] = useState<BackupHistoryDto[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  // Cinematic Startup Intro state
  const [startupSplashEnabled, setStartupSplashEnabled] = useState<boolean>(() => {
    return localStorage.getItem('vistara_startup_splash') !== 'false';
  });
  const [startupSoundEnabled, setStartupSoundEnabled] = useState<boolean>(() => {
    return cinematicSound.isSoundEnabled();
  });
  const [introSoundProfile, setIntroSoundProfile] = useState<IntroSoundProfile>(() => {
    return cinematicSound.getProfile();
  });

  // Soothing Ambient Soundscape state
  const [ambientActive, setAmbientActive] = useState<boolean>(() => ambientSound.isEnabled());
  const [ambientVol, setAmbientVol] = useState<number>(() => ambientSound.getVolume());
  const [ambientPreset, setAmbientPreset] = useState<AmbientPreset>(() => ambientSound.getPreset());

  // Interactive UI Sound Effects state
  const [uiSoundEnabled, setUiSoundEnabled] = useState<boolean>(() => uiSound.getSoundEnabled());
  const [uiSoundVol, setUiSoundVol] = useState<number>(() => uiSound.getVolume());

  const fetchAllSettings = async () => {
    setIsLoading(true);
    const [settingsRes, prefsRes, hwRes, healthRes, diagRes, backupsRes] = await Promise.all([
      apiRequest<Record<string, string>>('/api/v1/settings'),
      apiRequest<Record<string, string>>('/api/v1/settings/preferences'),
      apiRequest<any>('/api/v1/system/hardware-acceleration'),
      apiRequest<SystemHealthDto>('/api/v1/system/health'),
      apiRequest<any>('/api/v1/system/diagnostics'),
      apiRequest<BackupHistoryDto[]>('/api/v1/backups'),
    ]);

    if (settingsRes.success && settingsRes.data) {
      setSettings(settingsRes.data);
      setFfmpegPath(settingsRes.data['FFmpeg.Path'] || 'C:\\ffmpeg\\ffmpeg.exe');
      setFfprobePath(settingsRes.data['FFprobe.Path'] || 'C:\\ffmpeg\\ffprobe.exe');
    }
    if (prefsRes.success && prefsRes.data) {
      setPreferences(prefsRes.data);
    }
    if (hwRes.success && hwRes.data) {
      setHwInfo({
        availableMethods: hwRes.data.availableMethods || [],
        recommendedEncoder: hwRes.data.recommendedEncoder || 'libx264',
      });
    }
    if (healthRes.success && healthRes.data) {
      setHealth(healthRes.data);
    }
    if (diagRes.success && diagRes.data) {
      setDiagnostics(diagRes.data);
    }
    if (backupsRes.success && backupsRes.data) {
      setBackups(backupsRes.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const handleUpdateSetting = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    const res = await apiRequest<boolean>('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
    if (res.success) {
      showSavedToast(`Updated ${key}`);
    }
  };

  const handleUpdatePreference = async (key: string, value: string) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    const res = await apiRequest<boolean>('/api/v1/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
    if (res.success) {
      showSavedToast(`Preference saved`);
    }
  };

  const showSavedToast = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleTestFFmpeg = async () => {
    setFfmpegTesting(true);
    setFfmpegTestResult(null);
    const res = await apiRequest<boolean>('/api/v1/settings/test-ffmpeg', {
      method: 'POST',
      body: JSON.stringify({ ffmpegPath, ffprobePath }),
    });
    setFfmpegTesting(false);
    setFfmpegTestResult({
      success: res.success && Boolean(res.data),
      msg: res.message || (res.success ? 'FFmpeg verified!' : 'FFmpeg test failed'),
    });
  };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    setBackupMsg(null);
    const res = await apiRequest<BackupHistoryDto>('/api/v1/backups', {
      method: 'POST',
      body: JSON.stringify({ notes: 'Manual backup from Settings' }),
    });
    setBackupLoading(false);
    if (res.success) {
      setBackupMsg('Backup created successfully!');
      const updated = await apiRequest<BackupHistoryDto[]>('/api/v1/backups');
      if (updated.success && updated.data) setBackups(updated.data);
    } else {
      setBackupMsg(`Backup failed: ${res.error}`);
    }
  };

  const handleVerifyBackup = async (id: string) => {
    setBackupMsg(null);
    const res = await apiRequest<boolean>(`/api/v1/backups/${id}/verify`, { method: 'POST' });
    setBackupMsg(res.message || (res.success ? 'Backup verified successfully' : 'Verification failed'));
    const updated = await apiRequest<BackupHistoryDto[]>('/api/v1/backups');
    if (updated.success && updated.data) setBackups(updated.data);
  };

  const handleRestoreBackup = async (id: string) => {
    if (!window.confirm('Restore database from this backup? Current state will be replaced with backup data.')) return;
    setBackupLoading(true);
    const res = await apiRequest<boolean>(`/api/v1/backups/${id}/restore`, { method: 'POST' });
    setBackupLoading(false);
    if (res.success) {
      alert('Backup restored successfully! The application will refresh.');
      window.location.reload();
    } else {
      alert(`Restore failed: ${res.error}`);
    }
  };

  const handleFactoryReset = async () => {
    if (!window.confirm('WARNING: Are you sure you want to reset all settings to defaults? This will restore original configurations.')) return;
    const res = await apiRequest<boolean>('/api/v1/settings/reset', { method: 'POST' });
    if (res.success) {
      alert('Settings reset to defaults. Refreshing application.');
      window.location.reload();
    }
  };

  const navTabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'navigation', label: 'Navigation', icon: <Navigation className="w-4 h-4" /> },
    { id: 'libraries', label: 'Libraries', icon: <FolderCog className="w-4 h-4" /> },
    { id: 'playback', label: 'Playback', icon: <PlaySquare className="w-4 h-4" /> },
    { id: 'audio', label: 'Audio Engine', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'metadata', label: 'Metadata Providers', icon: <Database className="w-4 h-4" /> },
    { id: 'ffmpeg', label: 'FFmpeg & Transcoding', icon: <Cpu className="w-4 h-4" /> },
    { id: 'hwaccel', label: 'Hardware Acceleration', icon: <Zap className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'startup', label: 'Startup & Tray', icon: <Power className="w-4 h-4" /> },
    { id: 'backup', label: 'Backup & Recovery', icon: <Archive className="w-4 h-4" /> },
    { id: 'diagnostics', label: 'Diagnostics & Health', icon: <Activity className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy & Security', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'about', label: 'About VISTARA', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Settings Navigation Sidebar */}
      <div className="w-64 bg-[#0e1116] border-r border-[#242a36] flex flex-col p-4 shrink-0 overflow-y-auto">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-3 py-2">
          Settings Categories
        </h2>
        <nav className="space-y-1 mt-1">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-[#181c24]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings Detail Pane */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        {/* Floating Saved Toast */}
        {saveStatus && (
          <div className="fixed top-16 right-8 bg-[#181c24] border border-emerald-500/50 text-emerald-400 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200 z-50">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {saveStatus}
          </div>
        )}

        {/* 1. Appearance */}
        {activeTab === 'appearance' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Appearance</h2>
              <p className="text-xs text-gray-400 mt-1">Customize visual themes, color accents, and display typography</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                  Color Mode
                </label>
                <div className="max-w-md">
                  <div className="p-4 rounded-xl border border-accent ring-2 ring-accent/30 bg-[#181c24] text-white shadow-lg relative overflow-hidden select-none">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 rounded-lg bg-[#0b0d11] border border-[#242a36] text-accent">
                          <Moon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white">Deep Slate</div>
                          <div className="text-[11px] text-[#9ca3af]">Cool Slate & OLED matte</div>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                    </div>
                    {/* Live Preview Swatch */}
                    <div className="h-12 w-full rounded-lg bg-[#0F141B] border border-[#243040] p-2 flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-accent" />
                      <div className="flex-1 space-y-1">
                        <div className="h-2 w-3/4 rounded bg-[#161D27]" />
                        <div className="h-1.5 w-1/2 rounded bg-[#243040]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#1e232d]">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                  Accent Color
                </label>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-accent ring-2 ring-accent/30 bg-[#161D27] text-white font-bold text-xs shadow-md select-none">
                    <div
                      className="w-3.5 h-3.5 rounded-full ring-1 ring-white/20 shrink-0"
                      style={{ backgroundColor: '#38BDF8' }}
                    />
                    <span>Glacier Blue</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 ml-0.5" />
                  </div>
                </div>
                <p className="text-[11px] text-[#9ca3af] mt-2">
                  Unified Dual-Tone: VISTARA strictly uses Deep Slate (#0F141B) & Glacier Blue (#38BDF8) across the universe.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Dashboard Configuration</h2>
              <p className="text-xs text-gray-400 mt-1">Configure widget arrangement and default landing views</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Continue Watching Row</h3>
                  <p className="text-xs text-gray-400">Show in-progress movies and episodes on top</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences['Dashboard.ShowContinueWatching'] !== 'false'}
                  onChange={(e) => handleUpdatePreference('Dashboard.ShowContinueWatching', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Storage Usage Widget</h3>
                  <p className="text-xs text-gray-400">Display media storage breakdown chart</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences['Dashboard.ShowStorage'] !== 'false'}
                  onChange={(e) => handleUpdatePreference('Dashboard.ShowStorage', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Recently Added Media</h3>
                  <p className="text-xs text-gray-400">Show recently indexed movies and television shows</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences['Dashboard.ShowRecentlyAdded'] !== 'false'}
                  onChange={(e) => handleUpdatePreference('Dashboard.ShowRecentlyAdded', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. Navigation */}
        {activeTab === 'navigation' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Navigation</h2>
              <p className="text-xs text-gray-400 mt-1">Customize sidebar behaviors and hotkey shortcuts</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Sidebar Default State</h3>
                  <p className="text-xs text-gray-400">Keep sidebar collapsed by default on startup</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences['Navigation.CollapseByDefault'] === 'true'}
                  onChange={(e) => handleUpdatePreference('Navigation.CollapseByDefault', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>

              <div className="pt-4 border-t border-[#1e232d]">
                <h3 className="text-sm font-semibold text-white mb-2">Keyboard Shortcuts</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between p-2 bg-[#181c24] rounded">
                    <span className="text-gray-300">Toggle Sidebar</span>
                    <kbd className="px-2 py-0.5 bg-[#242a36] text-gray-200 rounded text-[11px] font-mono">Ctrl + B</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-[#181c24] rounded">
                    <span className="text-gray-300">Search FTS5</span>
                    <kbd className="px-2 py-0.5 bg-[#242a36] text-gray-200 rounded text-[11px] font-mono">Ctrl + K</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-[#181c24] rounded">
                    <span className="text-gray-300">Fullscreen Toggle</span>
                    <kbd className="px-2 py-0.5 bg-[#242a36] text-gray-200 rounded text-[11px] font-mono">F11 / F</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-[#181c24] rounded">
                    <span className="text-gray-300">Play / Pause</span>
                    <kbd className="px-2 py-0.5 bg-[#242a36] text-gray-200 rounded text-[11px] font-mono">Space</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Libraries */}
        {activeTab === 'libraries' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Libraries & Scanner</h2>
              <p className="text-xs text-gray-400 mt-1">Configure automated filesystem polling and scanning policies</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Scheduled Scan Interval (Minutes)
                </label>
                <input
                  type="number"
                  min="15"
                  max="1440"
                  value={settings['Library.DefaultScanInterval'] || '60'}
                  onChange={(e) => handleUpdateSetting('Library.DefaultScanInterval', e.target.value)}
                  className="w-40 bg-[#181c24] border border-[#242a36] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Preserve Missing Media Files</h3>
                  <p className="text-xs text-gray-400">Do not immediately delete entries if an external USB drive is disconnected</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings['Library.PreserveMissing'] !== 'false'}
                  onChange={(e) => handleUpdateSetting('Library.PreserveMissing', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. Playback */}
        {activeTab === 'playback' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Playback Settings</h2>
              <p className="text-xs text-gray-400 mt-1">Control streaming pipelines, resume thresholds, and auto-play behaviors</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Completion Threshold (%)
                </label>
                <p className="text-xs text-gray-400 mb-2">Mark video as watched when this percentage is reached</p>
                <input
                  type="number"
                  min="50"
                  max="99"
                  value={settings['Playback.WatchedThresholdPercent'] || '90'}
                  onChange={(e) => handleUpdateSetting('Playback.WatchedThresholdPercent', e.target.value)}
                  className="w-32 bg-[#181c24] border border-[#242a36] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Autoplay Next Episode</h3>
                  <p className="text-xs text-gray-400">Automatically play the next TV show episode upon completion</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings['Playback.AutoplayNext'] !== 'false'}
                  onChange={(e) => handleUpdateSetting('Playback.AutoplayNext', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 6. Audio */}
        {activeTab === 'audio' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Audio Engine</h2>
              <p className="text-xs text-gray-400 mt-1">Configure volume normalization, ReplayGain, and Web Audio equalization</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">ReplayGain Track Normalization</h3>
                  <p className="text-xs text-gray-400">Match perceived loudness levels across different albums</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings['Audio.ReplayGain'] !== 'false'}
                  onChange={(e) => handleUpdateSetting('Audio.ReplayGain', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Gapless Playback</h3>
                  <p className="text-xs text-gray-400">Pre-buffer upcoming audio tracks for seamless transitions</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings['Audio.Gapless'] !== 'false'}
                  onChange={(e) => handleUpdateSetting('Audio.Gapless', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 7. Metadata Providers */}
        {activeTab === 'metadata' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Metadata Providers</h2>
              <p className="text-xs text-gray-400 mt-1">Local-first metadata parsing and optional external enrichment</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Local-First Embedded Extraction</h3>
                  <p className="text-xs text-gray-400">Extract embedded ID3, Vorbis, and MP4 tags using FFprobe</p>
                </div>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Strict Offline Operation</h3>
                  <p className="text-xs text-gray-400">Never perform external metadata lookups without manual user trigger</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings['Metadata.StrictOffline'] !== 'false'}
                  onChange={(e) => handleUpdateSetting('Metadata.StrictOffline', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 8. FFmpeg */}
        {activeTab === 'ffmpeg' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">FFmpeg & Media Engine</h2>
              <p className="text-xs text-gray-400 mt-1">Verify binary integration, paths, and live transcoding status</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  FFmpeg Binary Path
                </label>
                <input
                  type="text"
                  value={ffmpegPath}
                  onChange={(e) => setFfmpegPath(e.target.value)}
                  className="w-full bg-[#181c24] border border-[#242a36] rounded px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  FFprobe Binary Path
                </label>
                <input
                  type="text"
                  value={ffprobePath}
                  onChange={(e) => setFfprobePath(e.target.value)}
                  className="w-full bg-[#181c24] border border-[#242a36] rounded px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleTestFFmpeg}
                  disabled={ffmpegTesting}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-md text-xs font-semibold transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ffmpegTesting ? 'animate-spin' : ''}`} />
                  {ffmpegTesting ? 'Testing FFmpeg...' : 'Test FFmpeg Binaries'}
                </button>
                <button
                  onClick={async () => {
                    await handleUpdateSetting('FFmpeg.Path', ffmpegPath);
                    await handleUpdateSetting('FFprobe.Path', ffprobePath);
                  }}
                  className="px-4 py-2 bg-[#181c24] hover:bg-[#242a36] border border-[#242a36] text-white rounded-md text-xs font-medium transition-colors"
                >
                  Save Paths
                </button>
              </div>

              {ffmpegTestResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
                    ffmpegTestResult.success
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                      : 'bg-red-950/20 border-red-800/40 text-red-400'
                  }`}
                >
                  {ffmpegTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{ffmpegTestResult.msg}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 9. Hardware Acceleration */}
        {activeTab === 'hwaccel' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Hardware Acceleration</h2>
              <p className="text-xs text-gray-400 mt-1">GPU accelerated decoding and encoding on Windows</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Recommended Hardware Encoder</h3>
                  <p className="text-xs text-gray-400">Selected based on detected GPU capabilities</p>
                </div>
                <span className="font-mono text-xs font-bold text-[var(--color-accent)] bg-[#181c24] border border-[#242a36] px-3 py-1 rounded">
                  {hwInfo?.recommendedEncoder || 'Auto'}
                </span>
              </div>

              <div className="pt-4 border-t border-[#1e232d]">
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Detected Acceleration APIs
                </h4>
                {hwInfo?.availableMethods && hwInfo.availableMethods.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {hwInfo.availableMethods.map((m) => (
                      <span
                        key={m}
                        className="px-2.5 py-1 bg-[#181c24] border border-[#242a36] text-xs font-mono text-gray-300 rounded"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Probing hardware acceleration methods...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 10. Notifications */}
        {activeTab === 'notifications' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Notifications</h2>
              <p className="text-xs text-gray-400 mt-1">Configure in-app and system tray toast notifications</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Library Scan Notifications</h3>
                  <p className="text-xs text-gray-400">Notify when library scan finishes</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences['Notifications.ScanDone'] !== 'false'}
                  onChange={(e) => handleUpdatePreference('Notifications.ScanDone', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Backup Completion Notifications</h3>
                  <p className="text-xs text-gray-400">Notify when automated backup snapshot succeeds</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences['Notifications.BackupDone'] !== 'false'}
                  onChange={(e) => handleUpdatePreference('Notifications.BackupDone', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 11. Startup & Tray */}
        {activeTab === 'startup' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Startup & System Tray</h2>
              <p className="text-xs text-gray-400 mt-1">Configure desktop shell integration, cinematic intro, and tray behavior</p>
            </div>

            {/* Cinematic Startup Screen & Netflix Transition Section */}
            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Cinematic Startup Intro</h3>
                    <p className="text-xs text-gray-400">Play the Netflix-style monolithic V animation with smooth home page camera dive</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={startupSplashEnabled}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setStartupSplashEnabled(val);
                    localStorage.setItem('vistara_startup_splash', val ? 'true' : 'false');
                  }}
                  className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-[#1e232d] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Startup Sound Effect</h3>
                    <p className="text-xs text-gray-400">
                      Synthesized Web Audio chords, orbital sub-drop, and soft studio female voice whisper
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => cinematicSound.playTaDum(introSoundProfile)}
                      className="px-3 py-1 bg-[#1e2430] hover:bg-[#283040] border border-[#2e3748] text-xs font-semibold text-gray-200 rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Test currently selected startup sound profile"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                      Test Sound
                    </button>
                    <input
                      type="checkbox"
                      checked={startupSoundEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setStartupSoundEnabled(val);
                        cinematicSound.setSoundEnabled(val);
                      }}
                      className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Sound Profile Selector */}
                <div>
                  <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Startup Sound Profile
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {INTRO_SOUND_PROFILES.map((prof) => {
                      const isSelected = introSoundProfile === prof.id;
                      return (
                        <div
                          key={prof.id}
                          onClick={() => {
                            setIntroSoundProfile(prof.id);
                            cinematicSound.setProfile(prof.id);
                            cinematicSound.playTaDum(prof.id);
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                              : 'bg-[#181c24] border-[#252c3a] hover:border-[#384357]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-bold ${isSelected ? 'text-[var(--color-accent)]' : 'text-white'}`}>
                                {prof.name}
                              </span>
                              {prof.badge && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                                  {prof.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-medium text-gray-400 mb-1.5">
                              {prof.category}
                            </div>
                            <div className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
                              {prof.description}
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[10px] text-gray-400 font-mono">
                              {isSelected ? '● Active' : 'Click to preview'}
                            </span>
                            <span className="text-xs text-[var(--color-accent)]">
                              <Play className="w-3 h-3 fill-current" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Preview Intro Experience</h3>
                  <p className="text-xs text-gray-400">Replay the full cinematic intro and home page transition now</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('vistara:replay_intro'));
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-md text-xs font-bold transition-opacity cursor-pointer shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Replay Intro
                </button>
              </div>
            </div>

            {/* Soothing Ambient Soundscape Section */}
            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Waves className="w-5 h-5 text-[var(--color-accent)]" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Soothing Ambient Soundscape</h3>
                    <p className="text-xs text-gray-400">Play calming, infinite background chords and chimes (PS5 / Apple TV luxury soundscape)</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={ambientActive}
                  onChange={(e) => {
                    const active = e.target.checked;
                    setAmbientActive(active);
                    ambientSound.setEnabled(active);
                  }}
                  className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-4 border-t border-[#1e232d]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Ambient Master Volume</span>
                  <span className="text-xs font-mono text-[var(--color-accent)] font-bold">{Math.round(ambientVol * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={ambientVol}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setAmbientVol(v);
                    ambientSound.setVolume(v);
                  }}
                  className="w-full h-1.5 bg-[#181c24] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                />
                <p className="text-[11px] text-gray-500">
                  Recommended: 15% - 25% for a peaceful, non-distracting background atmosphere.
                </p>
              </div>

              <div className="space-y-2 pt-4 border-t border-[#1e232d]">
                <span className="text-xs font-semibold text-white block">Soundscape Palette</span>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'cosmic', name: 'Cosmic Drift', desc: 'Fmaj9 deep space drone & warm harmonics' },
                    { id: 'ethereal', name: 'Ethereal Pad', desc: 'Dm9 warm analog tape chords & soft air' },
                    { id: 'zen', name: 'Zen Garden', desc: 'Peaceful pentatonic chimes & calm breath' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setAmbientPreset(p.id as AmbientPreset);
                        ambientSound.setPreset(p.id as AmbientPreset);
                      }}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        ambientPreset === p.id
                          ? 'border-[var(--color-accent)] bg-accent/10'
                          : 'border-[#242a36] bg-[#181c24] hover:border-gray-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{p.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#1e232d] flex items-center gap-2 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>Smart Auto-Ducking active: Soundscape automatically fades to silence whenever you play any video or music track.</span>
              </div>
            </div>

            {/* Interactive UI Sound Effects Section */}
            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MousePointerClick className="w-5 h-5 text-[var(--color-accent)]" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Interactive UI Sound Effects</h3>
                    <p className="text-xs text-gray-400">Haptic audio feedback on button clicks, navigation tabs, card hovers, and toggles</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={uiSoundEnabled}
                  onChange={(e) => {
                    const active = e.target.checked;
                    setUiSoundEnabled(active);
                    uiSound.setSoundEnabled(active);
                    if (active) uiSound.play('success');
                  }}
                  className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-4 border-t border-[#1e232d]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">UI Effects Volume</span>
                  <span className="text-xs font-mono text-[var(--color-accent)] font-bold">{Math.round(uiSoundVol * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={uiSoundVol}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setUiSoundVol(v);
                    uiSound.setVolume(v);
                  }}
                  className="w-full h-1.5 bg-[#181c24] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                />
              </div>

              {/* Sound Test Buttons */}
              <div className="space-y-2 pt-4 border-t border-[#1e232d]">
                <span className="text-xs font-semibold text-white block">Test UI Effects</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => uiSound.play('click')}
                    className="px-3 py-1.5 bg-[#181c24] hover:bg-[#202530] border border-[#242a36] hover:border-gray-500 rounded-md text-gray-300 font-medium transition-colors"
                  >
                    Button Click
                  </button>
                  <button
                    type="button"
                    onClick={() => uiSound.play('tab')}
                    className="px-3 py-1.5 bg-[#181c24] hover:bg-[#202530] border border-[#242a36] hover:border-gray-500 rounded-md text-gray-300 font-medium transition-colors"
                  >
                    Tab Switch
                  </button>
                  <button
                    type="button"
                    onClick={() => uiSound.play('toggleOn')}
                    className="px-3 py-1.5 bg-[#181c24] hover:bg-[#202530] border border-[#242a36] hover:border-gray-500 rounded-md text-gray-300 font-medium transition-colors"
                  >
                    Toggle Switch
                  </button>
                  <button
                    type="button"
                    onClick={() => uiSound.play('modalOpen')}
                    className="px-3 py-1.5 bg-[#181c24] hover:bg-[#202530] border border-[#242a36] hover:border-gray-500 rounded-md text-gray-300 font-medium transition-colors"
                  >
                    Modal Chime
                  </button>
                  <button
                    type="button"
                    onClick={() => uiSound.play('success')}
                    className="px-3 py-1.5 bg-[#181c24] hover:bg-[#202530] border border-[#242a36] hover:border-gray-500 rounded-md text-gray-300 font-medium transition-colors"
                  >
                    Success Chime
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Minimize to System Tray on Close</h3>
                  <p className="text-xs text-gray-400">Closing the window keeps the local media server running in the background</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings['Desktop.MinimizeToTray'] !== 'false'}
                  onChange={(e) => handleUpdateSetting('Desktop.MinimizeToTray', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Launch with Windows</h3>
                  <p className="text-xs text-gray-400">Automatically start VISTARA when logging into Windows</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings['Desktop.AutoStart'] === 'true'}
                  onChange={(e) => handleUpdateSetting('Desktop.AutoStart', String(e.target.checked))}
                  className="w-4 h-4 accent-[var(--color-accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 12. Backup & Recovery */}
        {activeTab === 'backup' && (
          <div className="max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Backup & Disaster Recovery</h2>
                <p className="text-xs text-gray-400 mt-1">Snapshot SQLite database with safe VACUUM INTO and verify zip integrity</p>
              </div>

              <button
                onClick={handleCreateBackup}
                disabled={backupLoading}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-md text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {backupLoading ? 'Creating Backup...' : 'Create Backup Snapshot'}
              </button>
            </div>

            {backupMsg && (
              <div className="p-3 bg-[#181c24] border border-[#242a36] text-xs text-white rounded-lg">
                {backupMsg}
              </div>
            )}

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#242a36] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Backup History</h3>
                <span className="text-xs text-gray-400">{backups.length} snapshots</span>
              </div>

              {backups.length > 0 ? (
                <div className="divide-y divide-[#1e232d]">
                  {backups.map((b) => (
                    <div key={b.id} className="p-4 flex items-center justify-between hover:bg-[#181c24] transition-colors">
                      <div>
                        <p className="text-sm font-mono font-medium text-white">{b.backupName}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          <span>{new Date(b.createdAtUtc).toLocaleString()}</span>
                          <span>•</span>
                          <span>{(b.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                          {b.verifiedSuccessfully && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Integrity Verified
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerifyBackup(b.id)}
                          className="px-3 py-1.5 bg-[#181c24] hover:bg-[#242a36] border border-[#242a36] text-xs text-gray-300 rounded transition-colors"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(b.id)}
                          className="px-3 py-1.5 bg-[#181c24] hover:bg-amber-950/40 hover:text-amber-400 border border-[#242a36] text-xs text-gray-300 rounded transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500 text-xs">
                  No backups created yet. Click "Create Backup Snapshot" above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 13. Diagnostics */}
        {activeTab === 'diagnostics' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Diagnostics & Health</h2>
              <p className="text-xs text-gray-400 mt-1">Live system metrics, process memory, and host drive storage</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-4">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Process Memory</span>
                <p className="text-2xl font-bold text-white mt-1">
                  {diagnostics ? `${diagnostics.memoryWorkingSetMb} MB` : '...'}
                </p>
              </div>
              <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-4">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Active Threads</span>
                <p className="text-2xl font-bold text-white mt-1">
                  {diagnostics ? diagnostics.threads : '...'}
                </p>
              </div>
              <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-4">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Engine Status</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">Healthy</p>
              </div>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Attached Storage Drives</h3>
              {diagnostics?.drives ? (
                <div className="space-y-3">
                  {diagnostics.drives.map((d: any) => (
                    <div key={d.name} className="p-3 bg-[#181c24] border border-[#242a36] rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-white">{d.name}</span>
                        <span className="text-gray-400">({d.driveType})</span>
                      </div>
                      <div className="text-gray-300">
                        {d.freeSpaceGb} GB free of {d.totalSpaceGb} GB
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* 14. Privacy & Security */}
        {activeTab === 'privacy' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Privacy & Security</h2>
              <p className="text-xs text-gray-400 mt-1">Verified local-first security boundary and zero-telemetry protection</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Loopback Only Binding</h3>
                  <p className="text-xs text-gray-400">Kestrel server is strictly bound to 127.0.0.1 (never exposed to LAN)</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                  Enforced
                </span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Zero Cloud Telemetry</h3>
                  <p className="text-xs text-gray-400">No analytic beacons or telemetry packets are transmitted to any cloud</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                  Guaranteed
                </span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e232d]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Path Traversal Guard</h3>
                  <p className="text-xs text-gray-400">Filesystem operations are locked to registered media directories</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                  Protected
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 15. About */}
        {activeTab === 'about' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">About VISTARA</h2>
              <p className="text-xs text-gray-400 mt-1">Personal Media Universe software specification & legal notices</p>
            </div>

            <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#141b27] border border-accent/25 rounded-2xl flex items-center justify-center p-2 shadow-lg">
                  <VistaraLogo size={36} withGlow={true} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">VISTARA — Personal Media Universe</h3>
                  <p className="text-xs text-gray-400">Version 1.0.0 (Production Release)</p>
                  <p className="text-xs text-gray-500 mt-0.5">Windows 10/11 64-bit • .NET 8 / 11 LTS • React 18</p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#1e232d] space-y-2 text-xs text-gray-400">
                <p>
                  VISTARA is designed from the ground up as a zero-login, local-first personal entertainment center.
                  Your media files, playlists, viewing history, and personal metadata remain solely on your machine.
                </p>
              </div>

              <div className="pt-4 border-t border-[#1e232d] flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-red-400">Factory Reset</h4>
                  <p className="text-xs text-gray-500">Restore all application settings and database configurations to default</p>
                </div>
                <button
                  onClick={handleFactoryReset}
                  className="flex items-center gap-2 px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded-md text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
