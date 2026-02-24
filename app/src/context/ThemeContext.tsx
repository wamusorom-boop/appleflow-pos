/**
 * AppleFlow POS - Theme Context
 * Multi-color theme system with background options
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Predefined beautiful themes - NO DARK COLORS that hide text
export const themes = {
  // Default fresh theme
  ocean: {
    name: 'Ocean Breeze',
    primary: '#0ea5e9',
    secondary: '#06b6d4',
    accent: '#f59e0b',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: '#f0f9ff',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    border: '#e2e8f0',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
  },
  // Warm sunset theme
  sunset: {
    name: 'Sunset Glow',
    primary: '#f97316',
    secondary: '#f43f5e',
    accent: '#eab308',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: '#fff7ed',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#431407',
    textSecondary: '#7c2d12',
    textMuted: '#c2410c',
    border: '#fed7aa',
    gradient: 'linear-gradient(135deg, #f97316 0%, #f43f5e 100%)',
  },
  // Fresh garden theme
  garden: {
    name: 'Fresh Garden',
    primary: '#22c55e',
    secondary: '#10b981',
    accent: '#84cc16',
    success: '#22c55e',
    warning: '#eab308',
    error: '#ef4444',
    info: '#3b82f6',
    background: '#f0fdf4',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#14532d',
    textSecondary: '#166534',
    textMuted: '#15803d',
    border: '#bbf7d0',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
  },
  // Royal purple theme
  royal: {
    name: 'Royal Purple',
    primary: '#8b5cf6',
    secondary: '#a855f7',
    accent: '#ec4899',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: '#faf5ff',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#3b0764',
    textSecondary: '#581c87',
    textMuted: '#7e22ce',
    border: '#e9d5ff',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
  },
  // Cherry blossom theme
  sakura: {
    name: 'Cherry Blossom',
    primary: '#ec4899',
    secondary: '#f472b6',
    accent: '#fb7185',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: '#fdf2f8',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#831843',
    textSecondary: '#9d174d',
    textMuted: '#be185d',
    border: '#fbcfe8',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
  },
  // Golden hour theme
  golden: {
    name: 'Golden Hour',
    primary: '#eab308',
    secondary: '#f59e0b',
    accent: '#f97316',
    success: '#22c55e',
    warning: '#ef4444',
    error: '#dc2626',
    info: '#3b82f6',
    background: '#fefce8',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#422006',
    textSecondary: '#713f12',
    textMuted: '#a16207',
    border: '#fde047',
    gradient: 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)',
  },
  // Midnight blue theme (light version)
  midnight: {
    name: 'Midnight Blue',
    primary: '#3b82f6',
    secondary: '#6366f1',
    accent: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#0ea5e9',
    background: '#eff6ff',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#1e3a8a',
    textSecondary: '#1e40af',
    textMuted: '#3b82f6',
    border: '#bfdbfe',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  },
  // Coral reef theme
  coral: {
    name: 'Coral Reef',
    primary: '#f43f5e',
    secondary: '#fb7185',
    accent: '#fdba74',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: '#fff1f2',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#881337',
    textSecondary: '#9f1239',
    textMuted: '#be123c',
    border: '#fecdd3',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
  },
  // Mint fresh theme
  mint: {
    name: 'Mint Fresh',
    primary: '#14b8a6',
    secondary: '#2dd4bf',
    accent: '#34d399',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: '#f0fdfa',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#134e4a',
    textSecondary: '#115e59',
    textMuted: '#0f766e',
    border: '#99f6e4',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)',
  },
  // Berry theme
  berry: {
    name: 'Berry Blast',
    primary: '#7c3aed',
    secondary: '#8b5cf6',
    accent: '#d946ef',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: '#f5f3ff',
    surface: '#ffffff',
    card: '#ffffff',
    textPrimary: '#2e1065',
    textSecondary: '#4c1d95',
    textMuted: '#6d28d9',
    border: '#ddd6fe',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
  },
} as const;

export type ThemeName = keyof typeof themes;
export type Theme = typeof themes[ThemeName];

interface ThemeContextType {
  currentTheme: Theme;
  themeName: ThemeName;
  setTheme: (theme: ThemeName) => void;
  customBackground: string | null;
  setCustomBackground: (background: string | null) => void;
  allThemes: typeof themes;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('appleflow-theme') as ThemeName) || 'ocean';
    }
    return 'ocean';
  });
  
  const [customBackground, setCustomBackgroundState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('appleflow-background');
    }
    return null;
  });

  const currentTheme = themes[themeName];

  useEffect(() => {
    // Apply theme CSS variables
    const root = document.documentElement;
    const theme = currentTheme;
    
    root.style.setProperty('--af-primary', theme.primary);
    root.style.setProperty('--af-secondary', theme.secondary);
    root.style.setProperty('--af-accent', theme.accent);
    root.style.setProperty('--af-success', theme.success);
    root.style.setProperty('--af-warning', theme.warning);
    root.style.setProperty('--af-error', theme.error);
    root.style.setProperty('--af-info', theme.info);
    root.style.setProperty('--af-background', theme.background);
    root.style.setProperty('--af-surface', theme.surface);
    root.style.setProperty('--af-card', theme.card);
    root.style.setProperty('--af-text-primary', theme.textPrimary);
    root.style.setProperty('--af-text-secondary', theme.textSecondary);
    root.style.setProperty('--af-text-muted', theme.textMuted);
    root.style.setProperty('--af-border', theme.border);
    root.style.setProperty('--af-gradient', theme.gradient);
    
    // Apply custom background if set
    if (customBackground) {
      root.style.setProperty('--af-background', customBackground);
    }
    
    // Save to localStorage
    localStorage.setItem('appleflow-theme', themeName);
    if (customBackground) {
      localStorage.setItem('appleflow-background', customBackground);
    }
  }, [themeName, customBackground, currentTheme]);

  const setTheme = (newTheme: ThemeName) => {
    setThemeName(newTheme);
  };

  const setCustomBackground = (background: string | null) => {
    setCustomBackgroundState(background);
    if (background) {
      localStorage.setItem('appleflow-background', background);
    } else {
      localStorage.removeItem('appleflow-background');
    }
  };

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      themeName,
      setTheme,
      customBackground,
      setCustomBackground,
      allThemes: themes,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
