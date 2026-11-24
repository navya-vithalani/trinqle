import type { Theme, ThemeTokens } from './types'

const cutesyLightTokens: ThemeTokens = {
  color: {
    bg: '#fff3f6',
    surface: '#ffffff',
    ink: '#523a48', // high contrast ink (> 8:1)
    inkSoft: '#8c6e80', // readable soft ink (> 4.5:1)
    line: '#f6dfe7',
    accent: '#e0678f', // warm pink (> 4.5:1 on white)
    accent2: '#48a885', // mint
    accent3: '#906fc9', // lavender
    accent4: '#e0833a', // peach
    success: '#3b9e78',
    warn: '#d48d28',
    danger: '#d6475b',
    star: '#e09a24',
    chart1: '#e0678f',
    chart2: '#48a885',
    chart3: '#906fc9',
    chart4: '#e0833a',
    chart5: '#e09a24',
    chart6: '#58a892',
    chart7: '#b58ae0',
    chart8: '#8590e8',
  },
  shape: {
    radiusS: '8px',
    radiusM: '14px',
    radiusL: '24px',
    radiusPill: '9999px',
    borderW: '2px',
    buttonShape: 'pill',
  },
  depth: {
    shadowCard: '0 6px 0 #f6dfe7',
    shadowButton: '0 4px 0 #c44f74',
    shadowPressed: '0 1px 0 #c44f74',
  },
  type: {
    fontBody: "'Fredoka', system-ui, sans-serif",
    fontDisplay: "'Fredoka', system-ui, sans-serif",
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
    easeBounce: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
    easeSoft: 'cubic-bezier(0.25, 1, 0.5, 1)',
    durFast: '150ms',
    durMed: '300ms',
    durSlow: '600ms',
    entranceStyle: 'bouncy-pop',
  },
}

const cutesyDarkTokens: ThemeTokens = {
  ...cutesyLightTokens,
  color: {
    ...cutesyLightTokens.color,
    bg: '#1e1422',
    surface: '#2c1e33',
    ink: '#fdf2f7', // high contrast (> 14:1)
    inkSoft: '#c6a8ba', // readable (> 5.5:1)
    line: '#432f4e',
    accent: '#ff8fb1',
    accent2: '#9fe3c8',
    accent3: '#c9b3f5',
    accent4: '#ffd2b0',
    star: '#ffc166',
  },
  depth: {
    shadowCard: '0 6px 0 #432f4e',
    shadowButton: '0 4px 0 #d45980',
    shadowPressed: '0 1px 0 #d45980',
  },
}

const cutesyArchiveTokens: ThemeTokens = {
  ...cutesyLightTokens,
  color: {
    ...cutesyLightTokens.color,
    bg: '#f8f8fa',
    surface: '#ffffff',
    ink: '#2d2b30',
    inkSoft: '#7a7680',
    line: '#e5e3e8',
    accent: '#595561',
    accent2: '#757080',
    accent3: '#918b9e',
    accent4: '#adabb5',
    star: '#757080',
  },
  depth: {
    shadowCard: '0 6px 0 #e5e3e8',
    shadowButton: '0 4px 0 #3e3b44',
    shadowPressed: '0 1px 0 #3e3b44',
  },
}

export const cutesyTheme: Theme = {
  id: 'cutesy',
  name: 'Cutesy',
  tokens: {
    light: cutesyLightTokens,
    dark: cutesyDarkTokens,
  },
  archive: cutesyArchiveTokens,
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
