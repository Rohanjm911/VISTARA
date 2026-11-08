import React, { useEffect, useState, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileCheck,
  FileQuestion,
  FileWarning,
  HardDrive,
  HardDriveDownload,
  Link as LinkIcon,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  StopCircle,
  X,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { signalRService } from '../api/signalr';
import {
  IntegrityDashboardDto,
  IntegrityFileRecordDto,
  IntegrityFileStatus,
  IntegrityScanDto,
  IntegrityScanProgressDto,
  IntegritySettingsDto,
  RecoveryCandidateDto,
} from '../types';

export const IntegrityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'explorer' | 'history' | 'settings'>('overview');
  const [dashboard, setDashboard] = useState<IntegrityDashboardDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeScan, setActiveScan] = useState<IntegrityScanDto | null>(null);
  const [scanProgress, setScanProgress] = useState<IntegrityScanProgressDto | null>(null);

  // Issues tab state
  const [issues, setIssues] = useState<IntegrityFileRecordDto[]>([]);
  const [issueFilter, setIssueFilter] = useState<string>('all');
  const [issueSearch, setIssueSearch] = useState<string>('');
  const [issuesLoading, setIssuesLoading] = useState<boolean>(false);

  // Explorer tab state
  const [explorerFiles, setExplorerFiles] = useState<IntegrityFileRecordDto[]>([]);
  const [explorerSearch, setExplorerSearch] = useState<string>('');
  const [explorerLoading, setExplorerLoading] = useState<boolean>(false);

  // History tab state
  const [scans, setScans] = useState<IntegrityScanDto[]>([]);

  // Settings tab state
  const [settings, setSettings] = useState<IntegritySettingsDto | null>(null);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);

  // Recovery Assistant state
  const [selectedRecoveryFile, setSelectedRecoveryFile] = useState<IntegrityFileRecordDto | null>(null);
  const [recoveryCandidates, setRecoveryCandidates] = useState<RecoveryCandidateDto[]>([]);
  const [customRelinkPath, setCustomRelinkPath] = useState<string>('');
  const [relinking, setRelinking] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Single file verify loading state
  const [verifyingFileId, setVerifyingFileId] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      const res = await apiRequest<IntegrityDashboardDto>('/api/v1/integrity/dashboard');
      if (res.success && res.data) {
        setDashboard(res.data);
        if (res.data.isScanRunning && res.data.currentScan) {
          setActiveScan(res.data.currentScan);
        } else if (!res.data.isScanRunning) {
          setActiveScan(null);
          setScanProgress(null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchIssues = async () => {
    setIssuesLoading(true);
    try {
      let statusParam = '';
      if (issueFilter === 'corrupted') statusParam = '&status=Corrupted';
      else if (issueFilter === 'unreadable') statusParam = '&status=Unreadable';
      else if (issueFilter === 'modified') statusParam = '&status=Modified';
      else if (issueFilter === 'missing') statusParam = '&status=Missing';
      else if (issueFilter === 'disconnected') statusParam = '&status=DriveDisconnected';

      const searchParam = issueSearch ? `&search=${encodeURIComponent(issueSearch)}` : '';
      const res = await apiRequest<{ items: IntegrityFileRecordDto[]; totalCount: number }>(
        `/api/v1/integrity/issues?pageSize=100${statusParam}${searchParam}`
      );
      if (res.success && res.data) {
        setIssues(res.data.items);
      }
    } finally {
      setIssuesLoading(false);
    }
  };

  const fetchExplorer = async () => {
    setExplorerLoading(true);
    try {
      const searchParam = explorerSearch ? `&search=${encodeURIComponent(explorerSearch)}` : '';
      // Status=Healthy or all
      const res = await apiRequest<{ items: IntegrityFileRecordDto[]; totalCount: number }>(
        `/api/v1/integrity/issues?pageSize=100&status=Healthy${searchParam}`
      );
      if (res.success && res.data) {
        setExplorerFiles(res.data.items);
      }
    } finally {
      setExplorerLoading(false);
    }
  };

  const fetchScans = async () => {
    const res = await apiRequest<IntegrityScanDto[]>('/api/v1/integrity/scans?limit=30');
    if (res.success && res.data) {
      setScans(res.data);
    }
  };

  const fetchSettings = async () => {
    const res = await apiRequest<IntegritySettingsDto>('/api/v1/integrity/settings');
    if (res.success && res.data) {
      setSettings(res.data);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'issues') fetchIssues();
    else if (activeTab === 'explorer') fetchExplorer();
    else if (activeTab === 'history') fetchScans();
    else if (activeTab === 'settings') fetchSettings();
  }, [activeTab, issueFilter, issueSearch]);

  // SignalR subscription for real-time progress & issues
  useEffect(() => {
    const unsubProgress = signalRService.onIntegrityProgress((progress: IntegrityScanProgressDto) => {
      setScanProgress(progress);
      if (!activeScan) {
        setActiveScan({
          id: progress.scanId,
          scanType: 'Incremental',
          status: progress.status,
          startedAtUtc: new Date().toISOString(),
          totalFilesDiscovered: progress.totalFiles,
          filesVerified: progress.processedFiles,
          filesHealthy: progress.healthyCount,
          filesModified: 0,
          filesMissing: 0,
          filesCorrupted: 0,
          filesUnreadable: 0,
          filesDriveDisconnected: 0,
          totalBytesScanned: 0,
          durationMs: 0,
          triggeredBy: 'Live',
          progressPercent: progress.percentComplete,
        });
      }
    });

    const unsubIssue = signalRService.onIntegrityIssue((issue: IntegrityFileRecordDto) => {
      setIssues((prev) => [issue, ...prev.filter((i) => i.id !== issue.id)]);
      fetchDashboard();
    });

    const unsubCompleted = signalRService.onIntegrityCompleted(() => {
      setActiveScan(null);
      setScanProgress(null);
      fetchDashboard();
      if (activeTab === 'issues') fetchIssues();
      if (activeTab === 'history') fetchScans();
    });

    return () => {
      unsubProgress();
      unsubIssue();
      unsubCompleted();
    };
  }, [activeScan, activeTab]);

  const handleStartScan = async (type: 'Incremental' | 'Full' | 'Quick') => {
    const res = await apiRequest<IntegrityScanDto>('/api/v1/integrity/scans', {
      method: 'POST',
      body: JSON.stringify({
        scanType: type,
        verifyHash: type !== 'Quick',
        runFfprobe: true,
      }),
    });
    if (res.success && res.data) {
      setActiveScan(res.data);
      fetchDashboard();
    }
  };

  const handlePauseScan = async () => {
    if (!activeScan) return;
    await apiRequest(`/api/v1/integrity/scans/${activeScan.id}/pause`, { method: 'POST' });
    fetchDashboard();
  };

  const handleResumeScan = async () => {
    if (!activeScan) return;
    await apiRequest(`/api/v1/integrity/scans/${activeScan.id}/resume`, { method: 'POST' });
    fetchDashboard();
  };

  const handleCancelScan = async () => {
    if (!activeScan) return;
    await apiRequest(`/api/v1/integrity/scans/${activeScan.id}/cancel`, { method: 'POST' });
    setActiveScan(null);
    setScanProgress(null);
    fetchDashboard();
  };

  const handleVerifyFile = async (mediaFileId: string) => {
    setVerifyingFileId(mediaFileId);
    try {
      const res = await apiRequest<IntegrityFileRecordDto>(`/api/v1/integrity/files/${mediaFileId}/verify`, {
        method: 'POST',
      });
      if (res.success && res.data) {
        setIssues((prev) => prev.map((i) => (i.mediaFileId === mediaFileId ? res.data! : i)));
        setExplorerFiles((prev) => prev.map((f) => (f.mediaFileId === mediaFileId ? res.data! : f)));
        fetchDashboard();
      }
    } finally {
      setVerifyingFileId(null);
    }
  };

  const openRecoveryAssistant = async (file: IntegrityFileRecordDto) => {
    setSelectedRecoveryFile(file);
    setCustomRelinkPath('');
    setRecoveryError(null);
    if (file.mediaFileId) {
      const res = await apiRequest<RecoveryCandidateDto[]>(
        `/api/v1/integrity/files/${file.mediaFileId}/recovery-candidates`
      );
      if (res.success && res.data) {
        setRecoveryCandidates(res.data);
      }
    }
  };

  const handleRelink = async (newPath: string) => {
    if (!selectedRecoveryFile?.mediaFileId || !newPath) return;
    setRelinking(true);
    setRecoveryError(null);
    try {
      const res = await apiRequest(`/api/v1/integrity/files/${selectedRecoveryFile.mediaFileId}/relink`, {
        method: 'POST',
        body: JSON.stringify({ newPath }),
      });
      if (res.success) {
        setSelectedRecoveryFile(null);
        fetchIssues();
        fetchDashboard();
      } else {
        setRecoveryError(res.error || 'Failed to relink file.');
      }
    } catch (err: any) {
      setRecoveryError(err.message || 'Error executing relink.');
    } finally {
      setRelinking(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await apiRequest('/api/v1/integrity/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      if (res.success) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let b = bytes;
    let idx = 0;
    while (b >= 1024 && idx < units.length - 1) {
      b /= 1024;
      idx++;
    }
    return `${b.toFixed(1)} ${units[idx]}`;
  };

  const formatDuration = (ms: number) => {
    if (ms <= 0) return '0s';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  const exportReport = (format: 'csv' | 'json') => {
    window.open(`/api/v1/integrity/reports/export?format=${format}`, '_blank');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 select-none bg-[#10151b] text-[#f4f7f8]">
      {/* 1. Header with Title & Master Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#303a45] pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black tracking-wide text-white uppercase">
                  Media Integrity Monitor
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent">
                  Real-time Diagnostics
                </span>
              </div>
              <p className="text-xs text-[#a4afb9] mt-0.5">
                Cryptographic SHA-256 fingerprinting, container validation & storage protection
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scan Dropdown / Trigger */}
          <button
            onClick={() => handleStartScan('Incremental')}
            disabled={activeScan !== null}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-transform hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Smart Scan</span>
          </button>

          <button
            onClick={() => handleStartScan('Full')}
            disabled={activeScan !== null}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#1b222b] hover:bg-[#222b35] text-white border border-[#303a45] hover:border-accent text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileCheck className="w-3.5 h-3.5 text-accent" />
            <span>Full Hash Scan</span>
          </button>

          {/* Export Report */}
          <div className="relative group">
            <button
              onClick={() => exportReport('csv')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#1b222b] hover:bg-[#222b35] text-[#a4afb9] hover:text-white border border-[#303a45] text-xs font-semibold transition-colors cursor-pointer"
              title="Download CSV Health Report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchDashboard}
            className="p-2 rounded-lg bg-[#1b222b] border border-[#303a45] hover:border-accent text-[#a4afb9] hover:text-white transition-colors cursor-pointer"
            title="Refresh Integrity Stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Live Scan Banner (Visible when scan is active) */}
      {activeScan && (
        <div className="bg-[#151a21] border border-accent/40 rounded-xl p-4.5 space-y-3 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {activeScan.scanType} Integrity Verification Running
              </span>
              <span className="text-[11px] font-mono text-[#a4afb9]">
                {scanProgress
                  ? `[${scanProgress.processedFiles} / ${scanProgress.totalFiles} files]`
                  : 'Preparing file catalog...'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {activeScan.status === 'Paused' ? (
                <button
                  onClick={handleResumeScan}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-accent/20 hover:bg-accent text-accent hover:text-white border border-accent/40 text-xs font-semibold cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={handlePauseScan}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#1b222b] hover:bg-[#222b35] text-[#a4afb9] hover:text-white border border-[#303a45] text-xs font-semibold cursor-pointer"
                >
                  <Pause className="w-3 h-3" />
                  <span>Pause</span>
                </button>
              )}
              <button
                onClick={handleCancelScan}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900 text-red-300 border border-red-500/40 text-xs font-semibold cursor-pointer"
              >
                <StopCircle className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            </div>
          </div>

          {/* Progress Bar with Micro-Gleam */}
          <div className="w-full h-2 bg-[#222b35] rounded-full overflow-hidden relative">
            <div
              className="h-full bg-accent rounded-full transition-all duration-150 relative overflow-hidden"
              style={{ width: `${scanProgress?.percentComplete || 0}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[#a4afb9]">
            <div className="truncate max-w-md">
              <span className="text-[#6b7885]">Scanning:</span>{' '}
              <span className="text-white font-medium">{scanProgress?.currentFile || 'Initializing...'}</span>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              <span className="text-accent font-bold">
                ✓ {scanProgress?.healthyCount || 0} Healthy
              </span>
              {(scanProgress?.issueCount || 0) > 0 && (
                <span className="text-amber-400 font-bold">
                  ⚠ {scanProgress?.issueCount} Issues
                </span>
              )}
              <span className="text-white font-bold">{scanProgress?.percentComplete || 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Top Health Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Monitored */}
        <div className="p-3.5 rounded-xl bg-[#151a21] border border-[#303a45] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#a4afb9]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Monitored</span>
            <HardDrive className="w-4 h-4 text-accent" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-white">{dashboard?.totalFilesMonitored || 0}</div>
            <div className="text-[10px] text-[#a4afb9] font-mono mt-0.5">
              {formatBytes(dashboard?.totalVerifiedSizeBytes || 0)} verified
            </div>
          </div>
        </div>

        {/* Healthy Files */}
        <div className="p-3.5 rounded-xl bg-[#151a21] border border-[#303a45] flex flex-col justify-between">
          <div className="flex items-center justify-between text-accent">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Healthy</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-white">{dashboard?.healthyFiles || 0}</div>
            <div className="text-[10px] text-accent font-semibold mt-0.5">
              {dashboard?.coveragePercentage || 0}% coverage
            </div>
          </div>
        </div>

        {/* Modified Files */}
        <div className={`p-3.5 rounded-xl bg-[#151a21] border flex flex-col justify-between transition-colors ${
          (dashboard?.modifiedFiles || 0) > 0 ? 'border-amber-500/50' : 'border-[#303a45]'
        }`}>
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Modified</span>
            <FileWarning className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-white">{dashboard?.modifiedFiles || 0}</div>
            <div className="text-[10px] text-[#a4afb9] mt-0.5">Hash / Size changes</div>
          </div>
        </div>

        {/* Missing Files */}
        <div className={`p-3.5 rounded-xl bg-[#151a21] border flex flex-col justify-between transition-colors ${
          (dashboard?.missingFiles || 0) > 0 ? 'border-red-500/50' : 'border-[#303a45]'
        }`}>
          <div className="flex items-center justify-between text-red-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Missing</span>
            <FileQuestion className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-white">{dashboard?.missingFiles || 0}</div>
            <div className="text-[10px] text-[#a4afb9] mt-0.5">Inaccessible path</div>
          </div>
        </div>

        {/* Disconnected Drives */}
        <div className="p-3.5 rounded-xl bg-[#151a21] border border-[#303a45] flex flex-col justify-between">
          <div className="flex items-center justify-between text-sky-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Drives</span>
            <HardDriveDownload className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-white">{dashboard?.driveDisconnectedFiles || 0}</div>
            <div className="text-[10px] text-[#a4afb9] mt-0.5">Unmounted storage</div>
          </div>
        </div>

        {/* Corrupted / Unreadable */}
        <div className={`p-3.5 rounded-xl bg-[#151a21] border flex flex-col justify-between transition-colors ${
          ((dashboard?.corruptedFiles || 0) + (dashboard?.unreadableFiles || 0)) > 0
            ? 'border-red-500/60 bg-red-950/10'
            : 'border-[#303a45]'
        }`}>
          <div className="flex items-center justify-between text-red-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Corrupted</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-white">
              {(dashboard?.corruptedFiles || 0) + (dashboard?.unreadableFiles || 0)}
            </div>
            <div className="text-[10px] text-red-400 font-semibold mt-0.5">
              Requires attention
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation Bar */}
      <div className="flex items-center space-x-1 border-b border-[#303a45] pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-accent text-white font-bold'
              : 'text-[#a4afb9] hover:text-white hover:bg-[#1b222b]'
          }`}
        >
          Health Overview
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'issues'
              ? 'bg-accent text-white font-bold'
              : 'text-[#a4afb9] hover:text-white hover:bg-[#1b222b]'
          }`}
        >
          <span>Problem Reports</span>
          {((dashboard?.corruptedFiles || 0) + (dashboard?.modifiedFiles || 0) + (dashboard?.missingFiles || 0)) > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {(dashboard?.corruptedFiles || 0) + (dashboard?.modifiedFiles || 0) + (dashboard?.missingFiles || 0)}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('explorer')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'explorer'
              ? 'bg-accent text-white font-bold'
              : 'text-[#a4afb9] hover:text-white hover:bg-[#1b222b]'
          }`}
        >
          File Fingerprint Explorer
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'bg-accent text-white font-bold'
              : 'text-[#a4afb9] hover:text-white hover:bg-[#1b222b]'
          }`}
        >
          Scan History
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-accent text-white font-bold'
              : 'text-[#a4afb9] hover:text-white hover:bg-[#1b222b]'
          }`}
        >
          Integrity Settings
        </button>
      </div>

      {/* 5. Tab Content Panes */}

      {/* =================================================================== */}
      {/* TAB 1: HEALTH OVERVIEW                                              */}
      {/* =================================================================== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
          {/* Left Column: Health Diagnostic Gauges & Summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 rounded-xl bg-[#151a21] border border-[#303a45] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Library Integrity Coverage
                  </h3>
                  <p className="text-xs text-[#a4afb9] mt-0.5">
                    Continuous monitoring status of all indexed video, audio and photo collections
                  </p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-2xl font-black text-accent">{dashboard?.coveragePercentage || 0}%</div>
                  <div className="text-[10px] text-[#a4afb9]">Verified safe</div>
                </div>
              </div>

              {/* Multi-segment Coverage Bar */}
              <div className="w-full h-3 bg-[#222b35] rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${(dashboard?.healthyFiles || 0) / Math.max(1, dashboard?.totalFilesMonitored || 1) * 100}%` }}
                  className="bg-accent h-full"
                  title="Healthy verified files"
                />
                <div
                  style={{ width: `${(dashboard?.modifiedFiles || 0) / Math.max(1, dashboard?.totalFilesMonitored || 1) * 100}%` }}
                  className="bg-amber-400 h-full"
                  title="Modified files"
                />
                <div
                  style={{ width: `${(dashboard?.missingFiles || 0) / Math.max(1, dashboard?.totalFilesMonitored || 1) * 100}%` }}
                  className="bg-red-400 h-full"
                  title="Missing files"
                />
                <div
                  style={{ width: `${(dashboard?.corruptedFiles || 0) / Math.max(1, dashboard?.totalFilesMonitored || 1) * 100}%` }}
                  className="bg-red-600 h-full"
                  title="Corrupted files"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
                  <span className="text-[#a4afb9]">Healthy: <strong className="text-white">{dashboard?.healthyFiles || 0}</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                  <span className="text-[#a4afb9]">Modified: <strong className="text-white">{dashboard?.modifiedFiles || 0}</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                  <span className="text-[#a4afb9]">Missing: <strong className="text-white">{dashboard?.missingFiles || 0}</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-600" />
                  <span className="text-[#a4afb9]">Corrupted: <strong className="text-white">{dashboard?.corruptedFiles || 0}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="p-5 rounded-xl bg-[#151a21] border border-[#303a45] space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Integrity Diagnostics Actions
              </h3>
              <p className="text-xs text-[#a4afb9]">
                Run immediate verification routines across your primary media folders
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <button
                  onClick={() => handleStartScan('Incremental')}
                  disabled={activeScan !== null}
                  className="p-3 rounded-lg bg-[#1b222b] hover:bg-[#222b35] border border-[#303a45] hover:border-accent text-left transition-colors cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center justify-between text-accent mb-1.5">
                    <span className="text-xs font-bold">Smart Incremental</span>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-[#a4afb9]">
                    Quickly checks sizes & timestamps, hashing only altered files.
                  </p>
                </button>

                <button
                  onClick={() => handleStartScan('Full')}
                  disabled={activeScan !== null}
                  className="p-3 rounded-lg bg-[#1b222b] hover:bg-[#222b35] border border-[#303a45] hover:border-accent text-left transition-colors cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center justify-between text-accent mb-1.5">
                    <span className="text-xs font-bold">Deep Full Hash</span>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-[#a4afb9]">
                    Computes streaming SHA-256 for all media to ensure zero silent bit rot.
                  </p>
                </button>

                <button
                  onClick={() => handleStartScan('Quick')}
                  disabled={activeScan !== null}
                  className="p-3 rounded-lg bg-[#1b222b] hover:bg-[#222b35] border border-[#303a45] hover:border-accent text-left transition-colors cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center justify-between text-accent mb-1.5">
                    <span className="text-xs font-bold">Container Header Scan</span>
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-[#a4afb9]">
                    Validates MP4/MKV moov atoms and stream headers via FFprobe.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Recent Integrity Audit Events Feed */}
          <div className="p-5 rounded-xl bg-[#151a21] border border-[#303a45] flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-[#303a45] pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Audit Event Feed</h3>
              </div>
              <span className="text-[10px] text-[#a4afb9] font-mono">Live Logs</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[420px]">
              {dashboard?.recentEvents && dashboard.recentEvents.length > 0 ? (
                dashboard.recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded-lg bg-[#1b222b] border border-[#303a45]/60 text-xs space-y-1 hover:border-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                        evt.severity === 'Error' || evt.severity === 'Critical'
                          ? 'bg-red-950/70 text-red-400 border border-red-500/40'
                          : evt.severity === 'Warning'
                          ? 'bg-amber-950/70 text-amber-400 border border-amber-500/40'
                          : 'bg-accent/15 text-accent border border-accent/30'
                      }`}>
                        {evt.severity}
                      </span>
                      <span className="text-[10px] font-mono text-[#6b7885]">
                        {new Date(evt.timestampUtc).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="font-semibold text-white truncate">{evt.title}</div>
                    <p className="text-[11px] text-[#a4afb9] line-clamp-2">{evt.description}</p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-[#6b7885]">
                  <CheckCircle2 className="w-8 h-8 text-accent/50 mb-2" />
                  <p className="text-xs font-semibold text-white">No integrity issues detected</p>
                  <p className="text-[11px] mt-0.5">Your media universe is pristine and healthy.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: PROBLEM REPORTS & RECOVERY                                   */}
      {/* =================================================================== */}
      {activeTab === 'issues' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#151a21] border border-[#303a45] rounded-xl p-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: 'All Issues' },
                { id: 'corrupted', label: 'Corrupted' },
                { id: 'unreadable', label: 'Unreadable' },
                { id: 'modified', label: 'Modified' },
                { id: 'missing', label: 'Missing' },
                { id: 'disconnected', label: 'Disconnected Drives' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setIssueFilter(pill.id)}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                    issueFilter === pill.id
                      ? 'bg-accent text-white font-bold shadow-sm'
                      : 'text-[#a4afb9] hover:text-white hover:bg-[#1b222b]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6b7885] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search problem files or diagnosis..."
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
                className="w-56 sm:w-64 pl-8 pr-7 py-1.5 rounded-lg bg-[#10151b] border border-[#303a45] text-xs text-white placeholder-[#6b7885] focus:outline-none focus:border-accent"
              />
              {issueSearch && (
                <button
                  onClick={() => setIssueSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7885] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Issues List Table */}
          {issuesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : issues.length > 0 ? (
            <div className="bg-[#151a21] border border-[#303a45] rounded-xl overflow-hidden divide-y divide-[#222b35]">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#1b222b] transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center space-x-2.5">
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                        issue.status === 'Corrupted' || issue.status === 'Unreadable'
                          ? 'bg-red-950/70 text-red-400 border border-red-500/40'
                          : issue.status === 'Modified'
                          ? 'bg-amber-950/70 text-amber-400 border border-amber-500/40'
                          : issue.status === 'DriveDisconnected'
                          ? 'bg-sky-950/70 text-sky-400 border border-sky-500/40'
                          : 'bg-red-950/50 text-red-300 border border-red-500/30'
                      }`}>
                        {issue.status}
                      </span>
                      <span className="font-bold text-sm text-white truncate">{issue.title}</span>
                      <span className="text-[11px] font-mono text-[#6b7885] hidden sm:inline">
                        [{issue.libraryName}]
                      </span>
                    </div>

                    <div className="text-xs text-[#a4afb9] font-mono truncate" title={issue.filePath}>
                      {issue.filePath}
                    </div>

                    {issue.corruptionReason && (
                      <div className="text-[11px] text-red-300 font-mono bg-red-950/30 border border-red-500/20 px-2 py-1 rounded-md inline-block max-w-full truncate">
                        Diagnosis: {issue.corruptionReason}
                      </div>
                    )}
                  </div>

                  {/* Actions per issue */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {issue.mediaFileId && (
                      <button
                        onClick={() => handleVerifyFile(issue.mediaFileId!)}
                        disabled={verifyingFileId === issue.mediaFileId}
                        className="px-2.5 py-1.5 rounded-lg bg-[#222b35] hover:bg-[#303a45] text-xs font-semibold text-white border border-[#303a45] hover:border-accent transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${verifyingFileId === issue.mediaFileId ? 'animate-spin text-accent' : ''}`} />
                        <span>Verify</span>
                      </button>
                    )}

                    {(issue.status === 'Missing' || issue.status === 'Corrupted' || issue.status === 'DriveDisconnected') && (
                      <button
                        onClick={() => openRecoveryAssistant(issue)}
                        className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent text-accent hover:text-white border border-accent/40 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>Recovery Relink</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-[#151a21] border border-[#303a45] rounded-xl space-y-2">
              <CheckCircle2 className="w-10 h-10 text-accent" />
              <div className="text-base font-bold text-white">Zero Integrity Issues Found</div>
              <p className="text-xs text-[#a4afb9]">
                All files matching your filter criteria are intact, readable, and verified healthy.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: FILE FINGERPRINT EXPLORER                                    */}
      {/* =================================================================== */}
      {activeTab === 'explorer' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-3 bg-[#151a21] border border-[#303a45] rounded-xl p-3">
            <span className="text-xs text-[#a4afb9]">
              Showing verified cryptographic fingerprints for monitored media files
            </span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6b7885] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search file name or path..."
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                className="w-56 sm:w-72 pl-8 pr-7 py-1.5 rounded-lg bg-[#10151b] border border-[#303a45] text-xs text-white placeholder-[#6b7885] focus:outline-none focus:border-accent"
              />
              {explorerSearch && (
                <button
                  onClick={() => setExplorerSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7885] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {explorerLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : explorerFiles.length > 0 ? (
            <div className="bg-[#151a21] border border-[#303a45] rounded-xl overflow-hidden divide-y divide-[#222b35]">
              {explorerFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#1b222b] transition-colors text-xs"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white truncate">{file.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-accent/15 border border-accent/30 text-accent font-semibold">
                        {file.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[#a4afb9] truncate" title={file.filePath}>
                      {file.filePath}
                    </div>
                    {file.sha256Hash && (
                      <div className="flex items-center space-x-2 font-mono text-[10px] text-[#6b7885]">
                        <span>SHA-256:</span>
                        <span className="text-white font-medium">{file.sha256Hash.substring(0, 16)}...</span>
                        <button
                          onClick={() => copyToClipboard(file.sha256Hash!)}
                          title="Copy Full SHA-256 Hash"
                          className="hover:text-accent cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 shrink-0 font-mono text-[11px] text-[#a4afb9]">
                    <span>{formatBytes(file.fileSizeBytes)}</span>
                    <span>
                      {file.lastVerifiedAtUtc ? new Date(file.lastVerifiedAtUtc).toLocaleDateString() : 'Pending'}
                    </span>
                    {file.mediaFileId && (
                      <button
                        onClick={() => handleVerifyFile(file.mediaFileId!)}
                        disabled={verifyingFileId === file.mediaFileId}
                        className="p-1.5 rounded-lg bg-[#222b35] hover:bg-[#303a45] text-white border border-[#303a45] hover:border-accent transition-colors cursor-pointer"
                        title="Re-verify file now"
                      >
                        <RefreshCw className={`w-3 h-3 ${verifyingFileId === file.mediaFileId ? 'animate-spin text-accent' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#a4afb9] bg-[#151a21] border border-[#303a45] rounded-xl">
              No files verified yet. Run a Smart or Full scan to populate fingerprints.
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: SCAN HISTORY                                                 */}
      {/* =================================================================== */}
      {activeTab === 'history' && (
        <div className="bg-[#151a21] border border-[#303a45] rounded-xl overflow-hidden divide-y divide-[#222b35] animate-in fade-in duration-150">
          {scans.length > 0 ? (
            scans.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between text-xs hover:bg-[#1b222b] transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-white text-sm">
                      {s.scanType} Scan
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-bold uppercase ${
                      s.status === 'Completed'
                        ? 'bg-accent/20 text-accent border border-accent/40'
                        : s.status === 'Failed'
                        ? 'bg-red-950/60 text-red-400 border border-red-500/40'
                        : s.status === 'Cancelled'
                        ? 'bg-gray-800 text-gray-400'
                        : 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                    }`}>
                      {s.status}
                    </span>
                    <span className="text-[11px] text-[#6b7885] font-mono">
                      Triggered by: {s.triggeredBy}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#a4afb9] font-mono">
                    {new Date(s.startedAtUtc).toLocaleString()} • Duration: {formatDuration(s.durationMs)}
                  </div>
                </div>

                <div className="flex items-center space-x-4 font-mono text-[11px] text-right">
                  <div>
                    <span className="text-white font-bold">{s.filesVerified}</span>
                    <span className="text-[#6b7885]"> / {s.totalFilesDiscovered} files</span>
                  </div>
                  <div>
                    <span className="text-accent font-bold">✓ {s.filesHealthy}</span>
                    {s.filesCorrupted > 0 && (
                      <span className="text-red-400 font-bold ml-2">⚠ {s.filesCorrupted} corrupted</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-[#a4afb9]">
              No scans recorded yet. Start a scan to begin audit history.
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: INTEGRITY SETTINGS                                           */}
      {/* =================================================================== */}
      {activeTab === 'settings' && settings && (
        <div className="max-w-2xl bg-[#151a21] border border-[#303a45] rounded-xl p-6 space-y-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Media Integrity Monitor Configuration
            </h3>
            <p className="text-xs text-[#a4afb9] mt-0.5">
              Customize scanning priority, concurrency, background scheduling and file hashing strategies
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Strategy */}
            <div className="space-y-1">
              <label className="font-semibold text-white block">Verification Strategy</label>
              <select
                value={settings.verificationStrategy}
                onChange={(e) => setSettings({ ...settings, verificationStrategy: e.target.value as any })}
                className="w-full p-2 rounded-lg bg-[#10151b] border border-[#303a45] text-white focus:outline-none focus:border-accent"
              >
                <option value="SmartIncremental">Smart Incremental (Compare size/mtime; hash on change - Recommended)</option>
                <option value="FullHash">Full SHA-256 (Compute hash for every media file on each scan)</option>
                <option value="ContainerProbeOnly">Container Probe Only (FFprobe container structure check only)</option>
              </select>
            </div>

            {/* Concurrency */}
            <div className="space-y-1">
              <label className="font-semibold text-white block">Maximum Concurrent File Workers</label>
              <select
                value={settings.maxConcurrency}
                onChange={(e) => setSettings({ ...settings, maxConcurrency: parseInt(e.target.value) })}
                className="w-full p-2 rounded-lg bg-[#10151b] border border-[#303a45] text-white focus:outline-none focus:border-accent"
              >
                <option value={1}>1 Worker (Lowest disk utilization)</option>
                <option value={2}>2 Workers (Balanced desktop performance)</option>
                <option value={4}>4 Workers (High-speed NVMe SSDs)</option>
              </select>
            </div>

            {/* Playback Protection */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#10151b] border border-[#303a45]">
              <div>
                <div className="font-semibold text-white">Playback Resource Protection</div>
                <div className="text-[11px] text-[#a4afb9]">
                  Automatically pause or throttle disk verification while watching movies or listening to audio
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.pauseDuringPlayback}
                onChange={(e) => setSettings({ ...settings, pauseDuringPlayback: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>

            {/* Auto Schedule */}
            <div className="space-y-1">
              <label className="font-semibold text-white block">Automated Background Schedule</label>
              <select
                value={settings.autoSchedule}
                onChange={(e) => setSettings({ ...settings, autoSchedule: e.target.value as any })}
                className="w-full p-2 rounded-lg bg-[#10151b] border border-[#303a45] text-white focus:outline-none focus:border-accent"
              >
                <option value="Off">Manual Only (No automated scans)</option>
                <option value="Daily">Daily Background Check</option>
                <option value="Weekly">Weekly Background Check (Recommended)</option>
                <option value="Monthly">Monthly Deep Verification</option>
              </select>
            </div>

            {/* Deep Decode */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#10151b] border border-[#303a45]">
              <div>
                <div className="font-semibold text-white">Deep Video Stream Decoding</div>
                <div className="text-[11px] text-[#a4afb9]">
                  Tests initial 5-second video decode frame buffers via FFmpeg to detect corrupt frames
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.probeDeepDecoding}
                onChange={(e) => setSettings({ ...settings, probeDeepDecoding: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-3 border-t border-[#303a45]">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
            {settingsSaved && (
              <span className="text-xs text-accent font-semibold flex items-center space-x-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Settings updated successfully</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. RECOVERY ASSISTANT MODAL                                         */}
      {/* =================================================================== */}
      {selectedRecoveryFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-[#151a21] border border-[#303a45] rounded-xl shadow-2xl p-6 space-y-4 select-none">
            <div className="flex items-center justify-between border-b border-[#303a45] pb-3">
              <div className="flex items-center space-x-2">
                <LinkIcon className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Media Recovery & Relinking Assistant
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecoveryFile(null)}
                className="text-[#a4afb9] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-[#10151b] border border-[#303a45] space-y-1">
                <div className="font-bold text-white">{selectedRecoveryFile.title}</div>
                <div className="text-[11px] font-mono text-[#a4afb9] truncate">
                  Missing Path: {selectedRecoveryFile.filePath}
                </div>
                <div className="text-[10px] text-[#6b7885] font-mono">
                  Expected Size: {formatBytes(selectedRecoveryFile.fileSizeBytes)}
                </div>
              </div>

              {recoveryError && (
                <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
                  {recoveryError}
                </div>
              )}

              {/* Automatic candidate matches */}
              <div className="space-y-1.5 pt-2">
                <span className="font-semibold text-white block">Discovered Recovery Candidates:</span>
                {recoveryCandidates.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {recoveryCandidates.map((candidate, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-[#1b222b] border border-[#303a45] hover:border-accent flex items-center justify-between gap-3 text-xs transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-white truncate">{candidate.fileName}</div>
                          <div className="text-[10px] font-mono text-[#a4afb9] truncate" title={candidate.path}>
                            {candidate.path}
                          </div>
                          <div className="text-[10px] text-[#6b7885] font-mono">
                            {formatBytes(candidate.fileSizeBytes)} • Confidence: {candidate.confidenceScore}%
                          </div>
                        </div>
                        <button
                          onClick={() => handleRelink(candidate.path)}
                          disabled={relinking}
                          className="px-3 py-1 rounded bg-accent hover:bg-accent-hover text-white text-[11px] font-bold cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                        >
                          Relink
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#a4afb9] text-[11px] italic">
                    No automatic candidate files found in library directories. You can specify the new path manually below:
                  </p>
                )}
              </div>

              {/* Manual path input */}
              <div className="space-y-1 pt-2">
                <label className="font-semibold text-white block">Manual File Path</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Enter full path to replacement media file..."
                    value={customRelinkPath}
                    onChange={(e) => setCustomRelinkPath(e.target.value)}
                    className="flex-1 p-2 rounded-lg bg-[#10151b] border border-[#303a45] text-xs text-white placeholder-[#6b7885] focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => handleRelink(customRelinkPath)}
                    disabled={relinking || !customRelinkPath.trim()}
                    className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {relinking ? 'Relinking...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
