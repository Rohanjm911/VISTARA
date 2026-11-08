import React, { useEffect, useState } from 'react';
import { uiSound } from '../utils/uiSound';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Film,
  FolderSync,
  Heart,
  Image,
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
  | 'gallery'
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

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'cinema', label: 'Cinema', icon: <Film className="w-5 h-5" /> },
  { id: 'tv', label: 'TV Shows', icon: <Tv className="w-5 h-5" /> },
  { id: 'music', label: 'Music', icon: <Music className="w-5 h-5" /> },
  { id: 'gallery', label: 'Gallery', icon: <Image className="w-5 h-5" /> },
  { id: 'playlists', label: 'Playlists', icon: <ListMusic className="w-5 h-5" /> },
  { id: 'watchlist', label: 'Watchlist', icon: <Bookmark className="w-5 h-5" /> },
  { id: 'favourites', label: 'Favourites', icon: <Heart className="w-5 h-5" /> },
  { id: 'integrity', label: 'Media Health', icon: <ShieldCheck className="w-5 h-5" /> },
  { id: 'libraries', label: 'Libraries', icon: <FolderSync className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
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
      className={`h-full bg-[#12151b] border-r border-[#242a36] flex flex-col transition-all duration-200 select-none ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand logo & collapse toggle */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#242a36]">
        {!collapsed ? (
          <div className="flex items-center space-x-3 overflow-hidden">
            <svg className="w-6 h-6 text-accent flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 3 L12 21 L22 3 L17 3 L12 14 L7 3 Z" />
            </svg>
            <div className="leading-tight">
              <div className="font-extrabold text-sm tracking-wider text-white">VISTARA</div>
              <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-semibold">Universe</div>
            </div>
          </div>
        ) : (
          <svg className="w-6 h-6 text-accent mx-auto" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 3 L12 21 L22 3 L17 3 L12 14 L7 3 Z" />
          </svg>
        )}

        <button
          onClick={() => {
            uiSound.play('toggleOn');
            toggleCollapsed();
          }}
          title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          className="p-1 rounded text-[#9ca3af] hover:text-white hover:bg-[#1f242f] transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                uiSound.play('tab');
                onSelectTab(item.id);
              }}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-150 ${
                collapsed ? 'justify-center px-0' : 'px-3'
              } ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-[#9ca3af] hover:text-white hover:bg-[#181c24]'
              }`}
            >
              <span className={`flex-shrink-0 ${isActive ? 'text-white' : ''}`}>{item.icon}</span>
              {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Shortcut hint footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-[#242a36] text-[11px] text-[#6b7280] flex justify-between items-center">
          <span>Sidebar Toggle</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#181c24] border border-[#242a36] text-[#9ca3af]">Ctrl+B</kbd>
        </div>
      )}
    </aside>
  );
};

