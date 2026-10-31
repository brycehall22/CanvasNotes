// src/ui/theme.ts
// Palette tokens pulled straight from the brief.

export const palette = {
  light: {
    surface: '#F5F3EE',
    surfaceRaised: '#FFFFFF',
    textPrimary: '#2C2A26',
    textSecondary: '#6B645C',
    textTertiary: '#A8A39A',
    accentPrimary: '#5C4F4A',   // dark brown
    accentSecondary: '#C9996B', // light brown
    border: 'rgba(92, 79, 74, 0.14)',
    borderHover: 'rgba(92, 79, 74, 0.28)',
    edge: '#C9996B',
    grid: 'rgba(92, 79, 74, 0.12)',
  },
  dark: {
    surface: '#1C1D1A',
    surfaceRaised: '#262724',
    textPrimary: '#ECE9E1',
    textSecondary: '#A8A39A',
    textTertiary: '#6B645C',
    accentPrimary: '#697565',   // green
    accentSecondary: '#3C3D37', // dark grey
    border: 'rgba(236, 233, 225, 0.10)',
    borderHover: 'rgba(236, 233, 225, 0.24)',
    edge: '#697565',
    grid: 'rgba(236, 233, 225, 0.08)',
  },
};

// Konva doesn't read CSS variables, so expose a resolver for canvas shapes.
export function currentPalette() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? palette.dark : palette.light;
}
