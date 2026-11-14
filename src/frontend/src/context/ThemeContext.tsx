import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export interface AccentColorOption {
  id?: string;
  name: string;
  hex: string;
  hover: string;
  value?: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  { id: 'glacier',  name: 'Glacier Blue',  hex: '#38BDF8', hover: '#0EA5E9', value: '#38BDF8' },
  { id: 'violet',   name: 'Violet',        hex: '#A78BFA', hover: '#7C3AED', value: '#A78BFA' },
  { id: 'rose',     name: 'Rose',          hex: '#FB7185', hover: '#E11D48', value: '#FB7185' },
  { id: 'gold',     name: 'Gold',          hex: '#FBBF24', hover: '#D97706', value: '#FBBF24' },
  { id: 'emerald',  name: 'Emerald',       hex: '#34D399', hover: '#059669', value: '#34D399' },
  { id: 'orange',   name: 'Orange',        hex: '#FB923C', hover: '#EA580C', value: '#FB923C' },
  { id: 'coral',    name: 'Coral Pink',    hex: '#F472B6', hover: '#DB2777', value: '#F472B6' },
];

interface ThemeContextType {
  isDark: boolean;
  theme: 'dark' | 'light';
  setTheme: (mode: 'dark' | 'light') => void;
  toggleTheme: () => void;
  accentColor: AccentColorOption;
  setAccentColor: (accent: AccentColorOption | string) => void;
  availableAccents: AccentColorOption[];
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('vistara_theme') !== 'light';
  });

  const [accentColor, setAccent] = useState<AccentColorOption>(() => {
    const saved = localStorage.getItem('vistara_accent');
    if (saved) {
      const found = ACCENT_COLORS.find(a => a.hex.toLowerCase() === saved.toLowerCase() || a.id === saved);
      if (found) return found;
    }
    return ACCENT_COLORS[0];
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }
    root.style.setProperty('--accent-color', accentColor.hex);
    root.style.setProperty('--color-accent', accentColor.hex);
    root.style.setProperty('--accent-hover', accentColor.hover);

    localStorage.setItem('vistara_theme', isDark ? 'dark' : 'light');
    localStorage.setItem('vistara_accent', accentColor.hex);
  }, [isDark, accentColor]);

  const setTheme = (mode: 'dark' | 'light') => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    setIsDark(mode === 'dark');
    setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 350);

    apiRequest('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: 'Appearance.Theme', value: mode }),
    }).catch(() => {});
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const setAccentColor = (accent: AccentColorOption | string) => {
    let chosen: AccentColorOption | undefined;
    if (typeof accent === 'string') {
      chosen = ACCENT_COLORS.find(
        (a) => a.id === accent || a.hex.toLowerCase() === accent.toLowerCase()
      );
    } else {
      chosen = accent;
    }
    if (!chosen) chosen = ACCENT_COLORS[0];
    setAccent(chosen);
    const root = document.documentElement;
    root.style.setProperty('--accent-color', chosen.hex);
    root.style.setProperty('--color-accent', chosen.hex);
    root.style.setProperty('--accent-hover', chosen.hover);
    localStorage.setItem('vistara_accent', chosen.hex);
    apiRequest('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: 'Appearance.AccentColor', value: chosen.hex }),
    }).catch(() => {});
  };

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        theme: isDark ? 'dark' : 'light',
        setTheme,
        toggleTheme,
        accentColor,
        setAccentColor,
        availableAccents: ACCENT_COLORS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
