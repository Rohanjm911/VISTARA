import React, { useState } from 'react';
import {
  CheckCircle2,
  FolderOpen,
  FolderPlus,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Wand2,
} from 'lucide-react';
import { apiRequest, browseFolder } from '../api/client';
import { ACCENT_COLORS, useTheme } from '../context/ThemeContext';
import { Modal } from './Modal';

interface FirstRunWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirstRunWizard: React.FC<FirstRunWizardProps> = ({ isOpen, onClose }) => {
  const { isDark, toggleTheme, accentColor, setAccentColor } = useTheme();

  const [step, setStep] = useState(1);
  const [operatingMode, setOperatingMode] = useState<'desktop' | 'browser'>('desktop');
  const [moviePath, setMoviePath] = useState('');
  const [tvPath, setTvPath] = useState('');
  const [musicPath, setMusicPath] = useState('');
  const [photosPath, setPhotosPath] = useState('');
  const [enableOnlineMetadata, setEnableOnlineMetadata] = useState(false);
  const [backupSchedule, setBackupSchedule] = useState('daily');
  const [isBrowsing, setIsBrowsing] = useState(false);

  const handleBrowse = async (type: 'movies' | 'tv' | 'music' | 'photos') => {
    setIsBrowsing(true);
    try {
      const titles = {
        movies: 'Select Movies Folder',
        tv: 'Select TV Shows Folder',
        music: 'Select Music Folder',
        photos: 'Select Photos Folder',
      };
      const initial =
        type === 'movies' ? moviePath :
        type === 'tv' ? tvPath :
        type === 'music' ? musicPath : photosPath;
      const selected = await browseFolder(initial, titles[type]);
      if (selected) {
        if (type === 'movies') setMoviePath(selected);
        else if (type === 'tv') setTvPath(selected);
        else if (type === 'music') setMusicPath(selected);
        else setPhotosPath(selected);
      }
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleFinish = async () => {
    // 1. Create libraries if paths were entered
    if (moviePath.trim()) {
      await apiRequest('/api/v1/libraries', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Movies',
          type: 1, // Movies
          folderPaths: [moviePath.trim()],
        }),
      });
    }

    if (tvPath.trim()) {
      await apiRequest('/api/v1/libraries', {
        method: 'POST',
        body: JSON.stringify({
          name: 'TV Shows',
          type: 2, // TVShows
          folderPaths: [tvPath.trim()],
        }),
      });
    }

    if (musicPath.trim()) {
      await apiRequest('/api/v1/libraries', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Music',
          type: 3, // Music
          folderPaths: [musicPath.trim()],
        }),
      });
    }

    if (photosPath.trim()) {
      await apiRequest('/api/v1/libraries', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Photos',
          type: 4, // Photos
          folderPaths: [photosPath.trim()],
        }),
      });
    }

    // Save preferences
    await apiRequest('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: 'Metadata.EnableOnlineLookup', value: enableOnlineMetadata.toString() }),
    });

    await apiRequest('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: 'Backup.AutoBackupSchedule', value: backupSchedule }),
    });

    await apiRequest('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: 'System.FirstRunCompleted', value: 'true' }),
    });

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="VISTARA — Quick Setup Wizard" maxWidth="max-w-2xl">
      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-between border-b border-[#242a36] pb-3 text-xs">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div
              key={s}
              className={`flex items-center space-x-1.5 ${
                step === s ? 'text-accent font-bold' : step > s ? 'text-emerald-400' : 'text-[#6b7280]'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === s
                    ? 'bg-accent text-white'
                    : step > s
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-[#181c24] border border-[#242a36]'
                }`}
              >
                {step > s ? '✓' : s}
              </span>
              <span className="hidden sm:inline">
                {s === 1
                  ? 'Welcome'
                  : s === 2
                  ? 'Appearance'
                  : s === 3
                  ? 'Mode'
                  : s === 4
                  ? 'Libraries'
                  : s === 5
                  ? 'Metadata'
                  : 'Finish'}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="w-12 h-12 rounded bg-accent/10 border border-accent flex items-center justify-center text-accent">
              <Wand2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Welcome to VISTARA</h3>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              VISTARA is your local-first personal media universe. It runs 100% locally on your PC without cloud
              dependencies, user accounts, or tracking. Your original files are always safe and under your control.
            </p>
            <div className="p-4 bg-[#181c24] border border-[#242a36] rounded-md space-y-2 text-xs text-[#d1d5db]">
              <div className="flex items-center text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Zero-login architecture: no registration or password
              </div>
              <div className="flex items-center text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Local-first storage: SQLite database on your machine
              </div>
              <div className="flex items-center text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Hardware-accelerated playback with FFmpeg
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Appearance */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <h3 className="text-base font-bold text-white flex items-center">
              <Palette className="w-4 h-4 mr-2 text-accent" /> VISTARA Unified Design
            </h3>
            <p className="text-xs text-[#9ca3af]">
              VISTARA uses a single, carefully crafted dual-tone identity for a cinematic, distraction-free entertainment experience.
            </p>

            <div className="p-4 rounded-xl border border-accent ring-2 ring-accent/30 bg-[#181c24] text-white flex items-center justify-between select-none">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-[#0b0d11] border border-[#242a36] text-accent">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Cinematic Dark</div>
                  <div className="text-[11px] text-[#9ca3af]">Obsidian & OLED matte with Electric Teal (#35C6B0)</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3.5 h-3.5 rounded-full bg-accent ring-1 ring-white/30" />
                <span className="text-xs font-bold text-accent">Active</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Operating Mode */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <h3 className="text-base font-bold text-white flex items-center">
              <Monitor className="w-4 h-4 mr-2 text-accent" /> Choose Operating Mode
            </h3>
            <p className="text-xs text-[#9ca3af]">Both modes share the exact same database and media engine.</p>

            <div className="space-y-3">
              <div
                onClick={() => setOperatingMode('desktop')}
                className={`p-4 rounded-md border cursor-pointer transition-colors ${
                  operatingMode === 'desktop' ? 'border-accent bg-[#181c24]' : 'border-[#242a36] bg-[#12151b]'
                }`}
              >
                <div className="font-bold text-sm text-white">Desktop Application (WPF + WebView2)</div>
                <div className="text-xs text-[#9ca3af] mt-1">
                  Dedicated desktop window with native window controls, system tray icon, and global hotkeys.
                </div>
              </div>

              <div
                onClick={() => setOperatingMode('browser')}
                className={`p-4 rounded-md border cursor-pointer transition-colors ${
                  operatingMode === 'browser' ? 'border-accent bg-[#181c24]' : 'border-[#242a36] bg-[#12151b]'
                }`}
              >
                <div className="font-bold text-sm text-white">Browser Mode (127.0.0.1)</div>
                <div className="text-xs text-[#9ca3af] mt-1">
                  Runs directly in your default web browser at http://127.0.0.1:5178.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Library Configuration */}
        {step === 4 && (
          <div className="space-y-3 py-2">
            <h3 className="text-base font-bold text-white flex items-center">
              <FolderPlus className="w-4 h-4 mr-2 text-accent" /> Configure Initial Media Folders
            </h3>
            <p className="text-xs text-[#9ca3af]">Enter paths to your media folders (optional, can be added later).</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">Movies Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. D:\Media\Movies"
                    value={moviePath}
                    onChange={(e) => setMoviePath(e.target.value)}
                    className="flex-1 bg-[#181c24] border border-[#242a36] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => handleBrowse('movies')}
                    disabled={isBrowsing}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] text-gray-200 rounded text-xs font-medium shrink-0 transition-colors cursor-pointer"
                    title="Browse Windows Folder"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-accent" />
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">TV Shows Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. D:\Media\TV Shows or D:\ent\series"
                    value={tvPath}
                    onChange={(e) => setTvPath(e.target.value)}
                    className="flex-1 bg-[#181c24] border border-[#242a36] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => handleBrowse('tv')}
                    disabled={isBrowsing}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] text-gray-200 rounded text-xs font-medium shrink-0 transition-colors cursor-pointer"
                    title="Browse Windows Folder"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-accent" />
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">Music Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. D:\Media\Music"
                    value={musicPath}
                    onChange={(e) => setMusicPath(e.target.value)}
                    className="flex-1 bg-[#181c24] border border-[#242a36] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => handleBrowse('music')}
                    disabled={isBrowsing}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] text-gray-200 rounded text-xs font-medium shrink-0 transition-colors cursor-pointer"
                    title="Browse Windows Folder"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-accent" />
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">Photos Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. D:\Media\Photos"
                    value={photosPath}
                    onChange={(e) => setPhotosPath(e.target.value)}
                    className="flex-1 bg-[#181c24] border border-[#242a36] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => handleBrowse('photos')}
                    disabled={isBrowsing}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] text-gray-200 rounded text-xs font-medium shrink-0 transition-colors cursor-pointer"
                    title="Browse Windows Folder"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-accent" />
                    Browse
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Metadata & Privacy */}
        {step === 5 && (
          <div className="space-y-4 py-2">
            <h3 className="text-base font-bold text-white flex items-center">
              <ShieldCheck className="w-4 h-4 mr-2 text-accent" /> Privacy & Metadata Settings
            </h3>
            <p className="text-xs text-[#9ca3af]">
              VISTARA reads local embedded tags, ID3, and EXIF by default. You can optionally enable online metadata lookups.
            </p>

            <div className="bg-[#181c24] border border-[#242a36] rounded-md p-4 space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableOnlineMetadata}
                  onChange={(e) => setEnableOnlineMetadata(e.target.checked)}
                  className="w-4 h-4 rounded text-accent focus:ring-0 accent-accent"
                />
                <span className="text-xs text-white font-medium">Enable optional online metadata lookups</span>
              </label>

              <div>
                <label className="text-xs text-[#9ca3af] block mb-1">Automatic Database Backup Schedule</label>
                <select
                  value={backupSchedule}
                  onChange={(e) => setBackupSchedule(e.target.value)}
                  className="bg-[#12151b] border border-[#242a36] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent w-full"
                >
                  <option value="daily">Daily Backup (Keep 7)</option>
                  <option value="weekly">Weekly Backup (Keep 4)</option>
                  <option value="off">Disabled</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Finish */}
        {step === 6 && (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Setup Complete!</h3>
            <p className="text-xs text-[#9ca3af] max-w-md mx-auto">
              Your personal media universe is ready. Click Finish to open the Dashboard and start exploring your media.
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-[#242a36]">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded bg-[#181c24] text-xs font-medium text-[#d1d5db] hover:bg-[#242a36] transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 6 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2 rounded bg-accent hover:bg-accent-hover text-xs font-bold text-white transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white transition-colors"
            >
              Finish & Enter VISTARA
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

