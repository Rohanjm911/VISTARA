import React, { useEffect, useState } from 'react';
import { apiRequest, browseFolder } from '../api/client';
import { onScanProgress, onBackgroundJobUpdate } from '../api/signalr';
import { Modal } from '../components/Modal';
import { LibraryDto, LibraryFolderDto, LibraryType, ScanProgressDto } from '../types';
import {
  FolderPlus,
  RefreshCw,
  Folder,
  FolderOpen,
  Trash2,
  HardDrive,
  Film,
  Tv,
  Music,
  Image as ImageIcon,
  FolderGit2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Sliders,
} from 'lucide-react';

export const LibrariesPage: React.FC = () => {
  const [libraries, setLibraries] = useState<LibraryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeScans, setActiveScans] = useState<Record<string, ScanProgressDto>>({});
  const [isBrowsing, setIsBrowsing] = useState(false);

  // Add Library Modal
  const [isAddLibOpen, setIsAddLibOpen] = useState(false);
  const [newLibName, setNewLibName] = useState('');
  const [newLibType, setNewLibType] = useState<LibraryType>('Movies');
  const [newLibDesc, setNewLibDesc] = useState('');
  const [newLibFolder, setNewLibFolder] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Folder Modal
  const [folderModalLibId, setFolderModalLibId] = useState<string | null>(null);
  const [newFolderPath, setNewFolderPath] = useState('');

  const handleBrowseFolder = async (target: 'newLib' | 'addFolder') => {
    setIsBrowsing(true);
    try {
      const initial = target === 'newLib' ? newLibFolder : newFolderPath;
      const title = target === 'newLib' ? 'Select Media Folder for New Library' : 'Select Media Folder to Add';
      const selected = await browseFolder(initial, title);
      if (selected) {
        if (target === 'newLib') {
          setNewLibFolder(selected);
          if (!newLibName.trim()) {
            const parts = selected.split(/[\\/]/).filter(Boolean);
            if (parts.length > 0) {
              setNewLibName(parts[parts.length - 1]);
            }
          }
        } else {
          setNewFolderPath(selected);
        }
      }
    } finally {
      setIsBrowsing(false);
    }
  };

  const fetchLibraries = async () => {
    setIsLoading(true);
    const res = await apiRequest<LibraryDto[]>('/api/v1/libraries');
    if (res.success && res.data) {
      setLibraries(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLibraries();

    // Listen to real-time scan progress from SignalR
    const unsubScan = onScanProgress((progress: ScanProgressDto) => {
      setActiveScans((prev) => {
        if (progress.status === 'Completed' || progress.status === 'Failed') {
          const next = { ...prev };
          delete next[progress.libraryId];
          fetchLibraries();
          return next;
        }
        return { ...prev, [progress.libraryId]: progress };
      });
    });

    const unsubJob = onBackgroundJobUpdate(() => {
      fetchLibraries();
    });

    return () => {
      unsubScan();
      unsubJob();
    };
  }, []);

  const handleCreateLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLibName.trim()) return;

    setIsSubmitting(true);
    const res = await apiRequest<any>('/api/v1/libraries', {
      method: 'POST',
      body: JSON.stringify({
        name: newLibName.trim(),
        type: newLibType,
        description: newLibDesc.trim() || undefined,
        autoScanEnabled: true,
        scanIntervalMinutes: 60,
        folderPaths: newLibFolder.trim() ? [newLibFolder.trim()] : [],
      }),
    });

    if (res.success) {
      setNewLibName('');
      setNewLibDesc('');
      setNewLibFolder('');
      setIsAddLibOpen(false);
      await fetchLibraries();
    }
    setIsSubmitting(false);
  };

  const handleDeleteLibrary = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the library "${name}"? This will remove catalog entries but keep your original media files completely untouched.`)) return;
    const res = await apiRequest<boolean>(`/api/v1/libraries/${id}`, { method: 'DELETE' });
    if (res.success) {
      await fetchLibraries();
    }
  };

  const handleTriggerScan = async (id: string) => {
    const res = await apiRequest<{ jobId: string }>(`/api/v1/libraries/${id}/scan`, { method: 'POST' });
    if (res.success) {
      // Mark as scanning
      setActiveScans((prev) => ({
        ...prev,
        [id]: {
          libraryId: id,
          folderId: '',
          filesDiscovered: 0,
          filesProcessed: 0,
          currentFile: 'Starting scan...',
          percentage: 0,
          status: 'Running',
        },
      }));
    }
  };

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderModalLibId || !newFolderPath.trim()) return;

    const res = await apiRequest<LibraryFolderDto>(`/api/v1/libraries/${folderModalLibId}/folders`, {
      method: 'POST',
      body: JSON.stringify({
        path: newFolderPath.trim(),
        isMonitored: true,
      }),
    });

    if (res.success) {
      setNewFolderPath('');
      setFolderModalLibId(null);
      await fetchLibraries();
    }
  };

  const handleRemoveFolder = async (libId: string, folderId: string) => {
    if (!window.confirm('Remove this folder from library? Original media files will not be deleted.')) return;
    const res = await apiRequest<boolean>(`/api/v1/libraries/${libId}/folders/${folderId}`, {
      method: 'DELETE',
    });
    if (res.success) {
      await fetchLibraries();
    }
  };

  const normalizeLibraryType = (type: any): LibraryType => {
    if (type === 1 || type === '1' || type === 'Movies' || type === 'Movie') return 'Movies';
    if (type === 2 || type === '2' || type === 'TVShows' || type === 'TVShow') return 'TVShows';
    if (type === 3 || type === '3' || type === 'Music' || type === 'Track') return 'Music';
    if (type === 4 || type === '4' || type === 'Photos' || type === 'Photo') return 'Photos';
    return (type || 'Movies') as LibraryType;
  };

  const getLibraryIcon = (type: LibraryType) => {
    switch (type) {
      case 'Movies':
        return <Film className="w-5 h-5 text-accent" />;
      case 'TVShows':
        return <Tv className="w-5 h-5 text-accent" />;
      case 'Music':
        return <Music className="w-5 h-5 text-accent" />;
      case 'Photos':
        return <ImageIcon className="w-5 h-5 text-accent" />;
      default:
        return <FolderGit2 className="w-5 h-5 text-accent" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <HardDrive className="w-7 h-7 text-[var(--color-accent)]" />
            Media Libraries
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure local storage folders, manage automated file scanning, and monitor catalog health
          </p>
        </div>

        <button
          onClick={() => setIsAddLibOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-md text-sm font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Library
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading media libraries...</p>
        </div>
      ) : libraries.length > 0 ? (
        <div className="space-y-6">
          {libraries.map((lib) => {
            const scan = activeScans[lib.id];
            const displayType = normalizeLibraryType(lib.type);
            return (
              <div
                key={lib.id}
                className="bg-[#12151b] border border-[#242a36] rounded-xl overflow-hidden shadow-sm"
              >
                {/* Library Header */}
                <div className="p-6 border-b border-[#1e232d] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#181c24] border border-[#242a36] flex items-center justify-center shrink-0">
                      {getLibraryIcon(displayType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-white">{lib.name}</h2>
                        <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-[#181c24] border border-[#242a36] text-gray-300">
                          {displayType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {lib.description || `Personal ${displayType} library`}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                        <span>{lib.itemCount} items</span>
                        <span>•</span>
                        <span>{formatBytes(lib.totalSizeBytes)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          {lib.lastScannedUtc
                            ? `Scanned ${new Date(lib.lastScannedUtc).toLocaleDateString()}`
                            : 'Never scanned'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleTriggerScan(lib.id)}
                      disabled={Boolean(scan)}
                      className="flex items-center gap-2 px-3.5 py-2 bg-[#181c24] hover:bg-[#242a36] border border-[#242a36] text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${scan ? 'animate-spin text-[var(--color-accent)]' : ''}`} />
                      {scan ? 'Scanning...' : 'Scan Now'}
                    </button>
                    <button
                      onClick={() => setFolderModalLibId(lib.id)}
                      className="flex items-center gap-2 px-3.5 py-2 bg-[#181c24] hover:bg-[#242a36] border border-[#242a36] text-gray-300 rounded-md text-xs font-medium transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      Add Folder
                    </button>
                    <button
                      onClick={() => handleDeleteLibrary(lib.id, lib.name)}
                      title="Delete library"
                      className="p-2 bg-[#181c24] hover:bg-red-950/40 hover:text-red-400 border border-[#242a36] text-gray-400 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Scan Progress Bar if active */}
                {scan && (
                  <div className="bg-[#181c24] px-6 py-3 border-b border-[#242a36] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-accent)] font-medium flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Scanning: {scan.currentFile || 'Discovering media files...'}
                      </span>
                      <span className="font-mono text-gray-400">{Math.round(scan.percentage)}%</span>
                    </div>
                    <div className="w-full bg-[#0b0d11] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[var(--color-accent)] h-full transition-all duration-300"
                        style={{ width: `${scan.percentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Folders List */}
                <div className="p-6 bg-[#0e1116] space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    <span>Configured Media Folders ({lib.folders.length})</span>
                  </div>

                  {lib.folders && lib.folders.length > 0 ? (
                    <div className="space-y-2">
                      {lib.folders.map((folder) => (
                        <div
                          key={folder.id}
                          className="flex items-center justify-between bg-[#12151b] border border-[#242a36] rounded-lg px-4 py-3 hover:border-gray-600 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Folder className="w-4 h-4 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-mono text-white truncate">{folder.path}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                {folder.isAccessible ? (
                                  <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Accessible
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-red-400 text-[11px]">
                                    <AlertTriangle className="w-3 h-3" />
                                    Folder not reachable
                                  </span>
                                )}
                                <span>•</span>
                                <span>{folder.isMonitored ? 'Real-time monitoring active' : 'Manual scan only'}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveFolder(lib.id, folder.id)}
                            title="Remove folder"
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-[#181c24] rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-500 bg-[#12151b] border border-dashed border-[#242a36] rounded-lg">
                      No folders configured for this library yet. Click "Add Folder" above to add local media directories.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#12151b] border border-[#242a36] rounded-xl p-16 text-center text-gray-400">
          <HardDrive className="w-14 h-14 mx-auto mb-3 opacity-40 text-gray-500" />
          <h3 className="text-base font-semibold text-white">No libraries configured</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-5">
            Create your first media library to organize your movies, series, songs, or videos from your hard drives
          </p>
          <button
            onClick={() => setIsAddLibOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Library
          </button>
        </div>
      )}

      {/* Add Library Modal */}
      <Modal isOpen={isAddLibOpen} onClose={() => setIsAddLibOpen(false)} title="Create New Media Library">
        <form onSubmit={handleCreateLibrary} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Library Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Ultra HD Movies, FLAC Audio"
              value={newLibName}
              onChange={(e) => setNewLibName(e.target.value)}
              className="w-full bg-[#181c24] border border-[#242a36] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Library Type
            </label>
            <select
              value={newLibType}
              onChange={(e) => setNewLibType(e.target.value as LibraryType)}
              className="w-full bg-[#181c24] border border-[#242a36] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="Movies">Movies (Cinema)</option>
              <option value="TVShows">Television Shows (Series)</option>
              <option value="Music">Music (Studio)</option>
              <option value="Custom">Custom Videos / Home Videos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Initial Folder Path (Windows Drive)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., D:\Media\Movies or D:\ent\series"
                value={newLibFolder}
                onChange={(e) => setNewLibFolder(e.target.value)}
                className="flex-1 bg-[#181c24] border border-[#242a36] rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-accent)]"
              />
              <button
                type="button"
                onClick={() => handleBrowseFolder('newLib')}
                disabled={isBrowsing}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] text-gray-200 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                title="Browse Windows File Explorer"
              >
                <FolderOpen className="w-4 h-4 text-[var(--color-accent)]" />
                {isBrowsing ? 'Browsing...' : 'Browse...'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Select or enter an accessible local directory on your machine.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add optional notes about this library collection..."
              value={newLibDesc}
              onChange={(e) => setNewLibDesc(e.target.value)}
              className="w-full bg-[#181c24] border border-[#242a36] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsAddLibOpen(false)}
              className="px-4 py-2 bg-[#181c24] hover:bg-[#242a36] text-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newLibName.trim()}
              className="px-5 py-2 bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Library'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Folder Modal */}
      <Modal
        isOpen={Boolean(folderModalLibId)}
        onClose={() => setFolderModalLibId(null)}
        title="Add Folder to Library"
      >
        <form onSubmit={handleAddFolder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Local Folder Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g., E:\MoreMovies or D:\ent\series"
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                className="flex-1 bg-[#181c24] border border-[#242a36] rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-accent)]"
              />
              <button
                type="button"
                onClick={() => handleBrowseFolder('addFolder')}
                disabled={isBrowsing}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] text-gray-200 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                title="Browse Windows File Explorer"
              >
                <FolderOpen className="w-4 h-4 text-[var(--color-accent)]" />
                {isBrowsing ? 'Browsing...' : 'Browse...'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Select or provide an absolute Windows filesystem path. VISTARA will scan and index files within this folder.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setFolderModalLibId(null)}
              className="px-4 py-2 bg-[#181c24] hover:bg-[#242a36] text-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newFolderPath.trim()}
              className="px-5 py-2 bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              Add Folder
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
