import React, { useEffect, useState } from 'react';
import { uiSound } from '../utils/uiSound';
import { VistaraLogo } from './VistaraLogo';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Film,
  FolderSync,
  Heart,
  LayoutDashboard,
  ListMusic,
  Music,
  Settings,
  ShieldCheck,
  Tv,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'cinema'
  | 'tv'
  | 'music'
  | 'playlists'
  | 'watchlist'
  | 'favourites'
  | 'integrity'
  | 'libraries'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Universe',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'cinema', label: 'Cinema', icon: <Film className="w-4 h-4" /> },
      { id: 'tv', label: 'TV Shows', icon: <Tv className="w-4 h-4" /> },
      { id: 'music', label: 'Music', icon: <Music className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Collections',
    items: [
      { id: 'playlists', label: 'Playlists', icon: <ListMusic className="w-4 h-4" /> },
      { id: 'watchlist', label: 'Watchlist', icon: <Bookmark className="w-4 h-4" /> },
      { id: 'favourites', label: 'Favourites', icon: <Heart className="w-4 h-4" /> },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'integrity', label: 'Media Health', icon: <ShieldCheck className="w-4 h-4" /> },
      { id: 'libraries', label: 'Libraries', icon: <FolderSync className="w-4 h-4" /> },
      { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('vistara_sidebar_collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('vistara_sidebar_collapsed', next.toString());
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B or '[' to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'b') || (e.key === '[' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName))) {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <aside
      className={`h-full bg-[#0c1017]/80 backdrop-blur-2xl border-r border-white/[0.07] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none relative z-20 ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      {/* Brand logo & collapse toggle */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.06] flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center flex-shrink-0 shadow-sm p-1 backdrop-blur-md">
              <VistaraLogo size={22} withGlow={true} animated={true} />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-[13px] tracking-[0.14em] text-white">VISTARA</div>
              <div className="text-[9px] text-white/50 uppercase tracking-[0.18em] font-semibold">Universe</div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center mx-auto shadow-sm p-1 backdrop-blur-md">
            <VistaraLogo size={22} withGlow={true} animated={true} />
          </div>
        )}

        {!collapsed && (
          <button
            onClick={() => {
              uiSound.play('toggleOn');
              toggleCollapsed();
            }}
            title="Collapse sidebar (Ctrl+B)"
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation items grouped cleanly */}
      <nav className="flex-1 py-4 px-2.5 space-y-4 overflow-y-auto no-scrollbar">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-0.5">
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    uiSound.play('tab');
                    onSelectTab(item.id);
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`nav-item w-full flex items-center rounded-xl py-2 text-[13px] transition-all duration-200 cursor-pointer ${
                    collapsed ? 'justify-center px-0' : 'px-3'
                  } ${
                    isActive
                      ? 'nav-active bg-white/[0.12] text-white font-semibold backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_8px_rgba(0,0,0,0.25)]'
                      : 'text-white/65 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-white/50'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="ml-3 truncate font-medium">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Shortcut hint footer / Expand button when collapsed */}
      <div className="px-3 py-3 border-t border-white/[0.06] flex-shrink-0">
        {!collapsed ? (
          <div className="px-1 text-[11px] text-white/45 flex justify-between items-center">
            <span>Toggle Sidebar</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-white/70">
              Ctrl+B
            </kbd>
          </div>
        ) : (
          <button
            onClick={() => {
              uiSound.play('toggleOn');
              toggleCollapsed();
            }}
            title="Expand sidebar (Ctrl+B)"
            className="w-full py-1.5 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

