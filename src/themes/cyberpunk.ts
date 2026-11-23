import type { Theme, ThemeTokens } from './types'

const cyberpunkLightTokens: ThemeTokens = {
  color: {
    bg: '#090a10', // Dark obsidian void
    surface: '#121420', // Cyber carbon plate
    ink: '#e2f3f5', // Glitch ice white
    inkSoft: '#6e859b', // Cold steel
    line: '#232a40', // Neon circuit line
    accent: '#00f0ff', // Electric cyan
    accent2: '#ff0055', // Hot neon magenta
    accent3: '#ffe600', // Electric hazard yellow
    accent4: '#8a2be2', // Cyber violet
    success: '#00ff9d', // Matrix green
    warn: '#ffaa00', // Cyber amber
    danger: '#ff003c', // Red alert
    star: '#ffe600',
    chart1: '#00f0ff',
    chart2: '#ff0055',
    chart3: '#ffe600',
    chart4: '#8a2be2',
    chart5: '#00ff9d',
    chart6: '#ffaa00',
    chart7: '#00c3ff',
    chart8: '#d600ff',
  },
  shape: {
    radiusS: '2px',
    radiusM: '4px',
    radiusL: '8px',
    radiusPill: '4px', // Tech angular buttons
    borderW: '2px',
    buttonShape: 'sharp',
  },
  depth: {
    shadowCard: '0 0 16px rgba(0, 240, 255, 0.12), inset 0 0 1px #00f0ff',
    shadowButton: '0 0 14px rgba(0, 240, 255, 0.4), 0 3px 0 #008899',
    shadowPressed: '0 0 6px rgba(0, 240, 255, 0.6), inset 0 2px 4px rgba(0, 0, 0, 0.5)',
  },
  type: {
    fontBody: "'Fredoka', monospace, sans-serif",
    fontDisplay: "'Fredoka', monospace, sans-serif",
    sizeS: '0.8125rem',
    sizeM: '0.9375rem',
    sizeL: '1.125rem',
    sizeXL: '1.375rem',
    weightNormal: '400',
    weightMedium: '500',
    weightBold: '600',
  },
  space: {
    s2: '2px',
    s4: '4px',
    s8: '8px',
    s12: '12px',
    s16: '16px',
    s24: '24px',
    s32: '32px',
  },
  motion: {
    easeBounce: 'cubic-bezier(0.1, 1.2, 0.2, 1)',
    easeSoft: 'cubic-bezier(0.16, 1, 0.3, 1)',
    durFast: '120ms',
    durMed: '250ms',
    durSlow: '500ms',
    entranceStyle: 'cyber-snap',
  },
}

const cyberpunkDarkTokens: ThemeTokens = {
  ...cyberpunkLightTokens,
  color: {
    ...cyberpunkLightTokens.color,
    bg: '#050608', // Deepest void
    surface: '#0d0e16',
    line: '#1c2235',
  },
}

const cyberpunkArchiveTokens: ThemeTokens = {
  ...cyberpunkLightTokens,
  color: {
    ...cyberpunkLightTokens.color,
    bg: '#0e1014',
    surface: '#181b22',
    ink: '#c8cbd0',
    inkSoft: '#646a75',
    line: '#282d38',
    accent: '#7f8a96',
    accent2: '#68727d',
    accent3: '#525b65',
    accent4: '#3f454d',
    star: '#7f8a96',
  },
  depth: {
    shadowCard: '0 0 0 1px #282d38',
    shadowButton: '0 2px 0 #282d38',
    shadowPressed: '0 0 0 #282d38',
  },
}

export const cyberpunkTheme: Theme = {
  id: 'cyberpunk',
  name: 'Cyberpunk',
  tokens: {
    light: cyberpunkLightTokens,
    dark: cyberpunkDarkTokens,
  },
  archive: cyberpunkArchiveTokens,
  iconSet: {
    home: 'Home',
    dashboard: 'LayoutDashboard',
    insights: 'Sparkles',
    archive: 'BookOpen',
    profile: 'User',
    plus: 'Plus',
    edit: 'Pencil',
    delete: 'Trash2',
    search: 'Search',
    'chevron-left': 'ChevronLeft',
    'chevron-right': 'ChevronRight',
    settings: 'Settings',
    star: 'Star',
    calendar: 'Calendar',
    check: 'Check',
    x: 'X',
    moon: 'Moon',
    sun: 'Sun',
    sparkles: 'Sparkles',
    'book-open': 'BookOpen',
    'file-text': 'FileText',
    clock: 'Clock',
    heart: 'Heart',
    activity: 'Activity',
    share: 'Share2',
    download: 'Download',
    upload: 'Upload',
  },
}
