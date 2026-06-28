import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // 1. Check localStorage first
    const saved = localStorage.getItem('pf_theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
    // 2. Fallback to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    // Apply to document root so CSS variables activate
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pf_theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return { theme, toggle, isDark: theme === 'dark' };
}
