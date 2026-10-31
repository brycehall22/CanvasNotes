// src/ui/useTheme.ts
//
// Theme management. Three modes: 'light', 'dark', 'system' (default).
// Applied via data-theme="light|dark" attribute on <html>.

import { useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'nexuscanvas:theme';

function readStored(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

function resolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved);
  // Update theme-color meta for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#1C1D1A' : '#F5F3EE');
  }
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readStored);

  // Apply on mount and whenever mode changes
  useEffect(() => {
    applyTheme(resolvedTheme(mode));
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // If system mode, follow OS changes
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((m) => (m === 'light' ? 'dark' : m === 'dark' ? 'system' : 'light'));
  }, []);

  return { mode, setMode, cycle, resolved: resolvedTheme(mode) };
}
