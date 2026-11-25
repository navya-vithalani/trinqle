import type { Theme, ThemeTokens } from './types'

const newspaperLightTokens: ThemeTokens = {
  color: {
    bg: '#f5efe4', // morning newsprint paper
    surface: '#faf7f0',
    ink: '#1a1918', // rich printer carbon ink (> 14:1)
    inkSoft: '#5c5750', // editorial subhead ink (> 5.2:1)
    line: '#2b2926', // crisp broadsheet rule lines
    accent: '#8b1e0f', // editorial red headline stamp
    accent2: '#1f4863', // daily press blue
    accent3: '#5a3d28', // sepia archival brown
    accent4: '#4a5240', // typeset olive
    success: '#1d5e37',
    warn: '#8a5200',
    danger: '#8b1e0f',
    star: '#8b1e0f',
    chart1: '#1a1918',
    chart2: '#8b1e0f',
    chart3: '#1f4863',
    chart4: '#5a3d28',
    chart5: '#4a5240',
    chart6: '#5c5750',
    chart7: '#754029',
    chart8: '#2c4b5c',
  },
  shape: {
    radiusS: '0px',
    radiusM: '0px',
    radiusL: '0px', // authentic broadsheet corners
    radiusPill: '0px',
    borderW: '1.5px',
    buttonShape: 'rectangle',
  },
  depth: {
    shadowCard: 'none', // line separators instead of drop shadows
    shadowButton: '2px 2px 0px #1a1918',
    shadowPressed: '0px 0px 0px #1a1918',
  },
  type: {
    fontBody: "'Times New Roman', 'Georgia', serif",
    fontDisplay: "'Times New Roman', 'Georgia', serif",
    sizeS: '0.8125rem',
    sizeM: '0.9375rem',
    sizeL: '1.125rem',
    sizeXL: '1.375rem',
    weightNormal: '400',
    weightMedium: '600',
    weightBold: '700',
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
    easeBounce: 'linear',
    easeSoft: 'ease-out',
    durFast: '100ms',
    durMed: '200ms',
    durSlow: '400ms',
    entranceStyle: 'ink-fade',
  },
}

const newspaperDarkTokens: ThemeTokens = {
  ...newspaperLightTokens,
  color: {
    ...newspaperLightTokens.color,
    bg: '#1a1918', // microfiche dark room
    surface: '#242220',
    ink: '#eae5dc', // newsprint white
    inkSoft: '#a8a39b',
    line: '#4a4641',
    accent: '#ff6b57', // glowing red stamp
    accent2: '#74b3de',
    accent3: '#dfaa7e',
    accent4: '#a8bd97',
    star: '#ff6b57',
  },
  depth: {
    shadowCard: 'none',
    shadowButton: '2px 2px 0px #000000',
    shadowPressed: '0px 0px 0px #000000',
  },
}

const newspaperArchiveTokens: ThemeTokens = {
  ...newspaperLightTokens,
  color: {
    ...newspaperLightTokens.color,
    bg: '#eee8dd',
    surface: '#f5f0e6',
    ink: '#262422',
    inkSoft: '#6b6660',
    line: '#3a3733',
    accent: '#5e4e42',
    accent2: '#47535c',
    accent3: '#61544a',
    accent4: '#51574d',
    star: '#5e4e42',
    chart1: '#262422',
    chart2: '#4a443e',
    chart3: '#6b6660',
    chart4: '#5e4e42',
    chart5: '#47535c',
    chart6: '#61544a',
    chart7: '#756b63',
    chart8: '#51574d',
  },
}

export const newspaperTheme: Theme = {
  id: 'newspaper',
  name: 'Morning Broadsheet',
  tokens: {
    light: newspaperLightTokens,
    dark: newspaperDarkTokens,
  },
  archive: newspaperArchiveTokens,
  iconSet: {
    home: 'Newspaper',
    dashboard: 'FileSpreadsheet',
    insights: 'TrendingUp',
    archive: 'Archive',
    profile: 'PenTool',
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
