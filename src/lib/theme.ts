import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

export const THEME = {
  light: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(0 0% 3.9%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(0 0% 3.9%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(0 0% 3.9%)',
    primary: 'hsl(270 85% 50%)', // crawl-purple #7f13ec
    primaryForeground: 'hsl(0 0% 98%)',
    secondary: 'hsl(240 33% 14%)', // crawl-surface #16162a
    secondaryForeground: 'hsl(0 0% 98%)',
    muted: 'hsl(0 0% 96.1%)',
    mutedForeground: 'hsl(0 0% 45.1%)',
    accent: 'hsl(270 85% 50%)', // crawl-purple
    accentForeground: 'hsl(0 0% 98%)',
    destructive: 'hsl(0 84.2% 60.2%)',
    border: 'hsl(0 0% 89.8%)',
    input: 'hsl(0 0% 89.8%)',
    ring: 'hsl(270 85% 50%)', // crawl-purple
    radius: '0.625rem',
    chart1: 'hsl(270 85% 50%)',
    chart2: 'hsl(142 71% 45%)',
    chart3: 'hsl(197 37% 24%)',
    chart4: 'hsl(43 74% 66%)',
    chart5: 'hsl(27 87% 67%)',
  },
  dark: {
    background: 'hsl(240 33% 3%)', // crawl-bg #0a0a0f
    foreground: 'hsl(0 0% 98%)',
    card: 'hsl(240 28% 14%)', // crawl-card #1a1a2e
    cardForeground: 'hsl(0 0% 98%)',
    popover: 'hsl(240 28% 14%)', // crawl-card
    popoverForeground: 'hsl(0 0% 98%)',
    primary: 'hsl(270 85% 50%)', // crawl-purple #7f13ec
    primaryForeground: 'hsl(0 0% 98%)',
    secondary: 'hsl(240 33% 12%)', // crawl-surface #16162a
    secondaryForeground: 'hsl(0 0% 98%)',
    muted: 'hsl(240 33% 12%)', // crawl-surface
    mutedForeground: 'hsl(220 9% 64%)', // crawl-text-muted #9ca3af
    accent: 'hsl(270 85% 50%)', // crawl-purple
    accentForeground: 'hsl(0 0% 98%)',
    destructive: 'hsl(0 70.9% 59.4%)',
    border: 'hsl(240 28% 14%)', // crawl-card
    input: 'hsl(240 28% 14%)', // crawl-card
    ring: 'hsl(270 72% 65%)', // crawl-purple-light #a855f7
    radius: '0.625rem',
    chart1: 'hsl(270 85% 50%)',
    chart2: 'hsl(142 71% 45%)',
    chart3: 'hsl(30 80% 55%)',
    chart4: 'hsl(280 65% 60%)',
    chart5: 'hsl(340 75% 55%)',
  },
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
