// src/ui/ThemeToggle.tsx
//
// Three-state toggle: light → dark → system → light...
// Renders a single icon button that reflects the current mode.

import { useTheme, type ThemeMode } from './useTheme';

const labels: Record<ThemeMode, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

export function ThemeToggle() {
  const { mode, cycle } = useTheme();

  return (
    <button
      className="nx-theme-toggle"
      onClick={cycle}
      title={`${labels[mode]} — click to cycle`}
      aria-label={labels[mode]}
    >
      {mode === 'light' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
      {mode === 'dark' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {mode === 'system' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      )}
    </button>
  );
}
