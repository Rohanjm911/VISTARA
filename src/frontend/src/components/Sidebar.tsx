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
      { id: 'gallery', label: 'Gallery', icon: <Image className="w-4 h-4" /> },
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
      className={`h-full bg-[#12161D] border-r border-[#202733] flex flex-col transition-all duration-200 select-none ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      {/* Brand logo & collapse toggle */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#202733] flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-[#1B222B] border border-[#2A3442] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 3 L12 21 L22 3 L17 3 L12 14 L7 3 Z" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-[13px] tracking-[0.14em] text-[#F4F7F8]">VISTARA</div>
              <div className="text-[9px] text-[#6B7885] uppercase tracking-[0.18em] font-semibold">Media Universe</div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[#1B222B] border border-[#2A3442] flex items-center justify-center mx-auto">
            <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 3 L12 21 L22 3 L17 3 L12 14 L7 3 Z" />
            </svg>
          </div>
        )}

        {!collapsed && (
          <button
            onClick={() => {
              uiSound.play('toggleOn');
              toggleCollapsed();
            }}
            title="Collapse sidebar (Ctrl+B)"
            className="p-1.5 rounded-lg text-[#6B7885] hover:text-[#F4F7F8] hover:bg-[#1B222B] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation items grouped cleanly */}
      <nav className="flex-1 py-4 px-2.5 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5B6775]">
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
                  className={`relative w-full flex items-center rounded-lg py-2 text-[13px] font-medium transition-all duration-150 ${
                    collapsed ? 'justify-center px-0' : 'px-3'
                  } ${
                    isActive
                      ? 'bg-[#1B222B] text-[#F4F7F8] border border-[#2B3544] shadow-sm font-semibold'
                      : 'text-[#8D9AA8] border border-transparent hover:text-[#F4F7F8] hover:bg-[#171C24]'
                  }`}
                >
                  {/* Crisp Electric Teal active indicator bar */}
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />
                  )}
                  <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-accent' : ''}`}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Shortcut hint footer / Expand button when collapsed */}
      <div className="px-3 py-3 border-t border-[#202733] flex-shrink-0">
        {!collapsed ? (
          <div className="px-1 text-[11px] text-[#6B7885] flex justify-between items-center">
            <span>Toggle Sidebar</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#151A21] border border-[#242A36] text-[10px] font-mono text-[#94A3B8]">
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
            className="w-full py-1.5 rounded-lg flex items-center justify-center text-[#6B7885] hover:text-[#F4F7F8] hover:bg-[#1B222B] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

