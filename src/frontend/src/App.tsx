import React, { useEffect, useState } from 'react';
import { bootstrapSecurity, apiRequest } from './api/client';
import { signalRService } from './api/signalr';
import { ThemeProvider } from './context/ThemeContext';
import { PlayerProvider } from './context/PlayerContext';
import { Sidebar, NavTab } from './components/Sidebar';
import { Titlebar } from './components/Titlebar';
import { MiniPlayer } from './components/MiniPlayer';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { NowPlayingModal } from './components/NowPlayingModal';
import { AudioEqualizerModal } from './components/AudioEqualizerModal';
import { FirstRunWizard } from './components/FirstRunWizard';
import { StartupSplash } from './components/StartupSplash';
import { ambientSound } from './utils/ambientSound';
import { uiSound } from './utils/uiSound';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { CinemaPage } from './pages/CinemaPage';
import { TvShowsPage } from './pages/TvShowsPage';
import { MusicPage } from './pages/MusicPage';
import { GalleryPage } from './pages/GalleryPage';
import { PlaylistsPage } from './pages/PlaylistsPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { FavouritesPage } from './pages/FavouritesPage';
import { IntegrityPage } from './pages/IntegrityPage';
import { LibrariesPage } from './pages/LibrariesPage';
import { SettingsPage } from './pages/SettingsPage';
import { LibraryDto } from './types';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    return (localStorage.getItem('vistara_active_tab') as NavTab) || 'dashboard';
  });
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isAppRevealed, setIsAppRevealed] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('vistara_startup_splash', 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('vistara_active_tab', currentTab);
  }, [currentTab]);

  useEffect(() => {
    const handleReplay = () => {
      ambientSound.stop();
      setIsAppRevealed(false);
      setShowSplash(true);
    };
    window.addEventListener('vistara:replay_intro', handleReplay);
    return () => {
      window.removeEventListener('vistara:replay_intro', handleReplay);
    };
  }, []);

  // Soothing Ambient Soundscape: auto-starts once the app is revealed and on first interaction
  useEffect(() => {
    if (isAppRevealed && !showSplash && ambientSound.isEnabled()) {
      ambientSound.start();
    }
  }, [isAppRevealed, showSplash]);

  useEffect(() => {
    const handleGesture = () => {
      if (isAppRevealed && !showSplash && ambientSound.isEnabled()) {
        ambientSound.start();
      }
    };
    window.addEventListener('pointerdown', handleGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleGesture);
    };
  }, [isAppRevealed, showSplash]);

  // Global interactive tactile UI sounds (clicks, micro-hovers, toggle snaps)
  useEffect(() => {
    const detach = uiSound.attachGlobalListeners();
    return () => {
      detach();
    };
  }, []);

  useEffect(() => {
    // 1. Transparent Zero-Login Security Bootstrap
    bootstrapSecurity();

    // 2. Start persistent SignalR WebSocket connection
    signalRService.start();

    // 3. Check if first run (libraries empty and wizard not explicitly dismissed)
    const wizardDismissed = localStorage.getItem('vistara_wizard_dismissed');
    if (!wizardDismissed) {
      apiRequest<LibraryDto[]>('/api/v1/libraries').then((res) => {
        if (res.success && (!res.data || res.data.length === 0)) {
          setIsWizardOpen(true);
        }
      });
    }

    // 4. Global Keyboard Navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const renderActivePage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentTab} />;
      case 'cinema':
        return <CinemaPage />;
      case 'tv':
        return <TvShowsPage />;
      case 'music':
        return <MusicPage />;
      case 'gallery':
        return <GalleryPage />;
      case 'playlists':
        return <PlaylistsPage />;
      case 'watchlist':
        return <WatchlistPage />;
      case 'favourites':
        return <FavouritesPage />;
      case 'integrity':
        return <IntegrityPage />;
      case 'libraries':
        return <LibrariesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0d11] text-[#f3f4f6] overflow-hidden select-none">
      {/* Title Bar with Search, Status, and Controls */}
      <div
        className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isAppRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <Titlebar onOpenWizard={() => setIsWizardOpen(true)} onNavigate={setCurrentTab} />
      </div>

      {/* Main Body Area: Collapsible Sidebar + Page Content */}
      <div
        className={`flex-1 flex overflow-hidden relative transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isAppRevealed
            ? 'opacity-100 scale-100 filter-none translate-y-0'
            : 'opacity-0 scale-[0.96] blur-[6px] translate-y-3'
        }`}
      >
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

        <main className="flex-1 flex flex-col overflow-hidden bg-[#0b0d11] relative">
          {renderActivePage()}
        </main>
      </div>

      {/* Persistent Bottom MiniPlayer (when music or video is active) */}
      <MiniPlayer />

      {/* Modals & Overlays */}
      {showSplash && (
        <StartupSplash
          onTransitionStart={() => setIsAppRevealed(true)}
          onComplete={() => {
            setIsAppRevealed(true);
            setShowSplash(false);
            if (ambientSound.isEnabled()) {
              ambientSound.start();
            }
          }}
        />
      )}
      <VideoPlayerModal />
      <NowPlayingModal />
      <AudioEqualizerModal />
      <FirstRunWizard
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          localStorage.setItem('vistara_wizard_dismissed', 'true');
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <PlayerProvider>
        <AppContent />
      </PlayerProvider>
    </ThemeProvider>
  );
};

export default App;

