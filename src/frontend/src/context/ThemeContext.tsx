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
  { id: 'teal', name: 'Electric Teal', hex: '#35C6B0', hover: '#2ba895', value: '#35C6B0' },
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
    // VISTARA strictly enforces the unified Electric Teal (#35C6B0) accent
    localStorage.setItem('vistara_accent', '#35C6B0');
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
