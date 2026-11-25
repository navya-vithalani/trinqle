import type { Theme, ThemeTokens } from './types'

const royalLightTokens: ThemeTokens = {
  color: {
    bg: '#faf6ee', // royal ivory parchment
    surface: '#ffffff',
    ink: '#29153b', // deep imperial amethyst (> 11:1)
    inkSoft: '#684e7a', // readable soft violet (> 5:1)
    line: '#eadfcb', // gold leaf border tone
    accent: '#b8860b', // burnished antique gold (> 4.6:1 on white)
    accent2: '#5b1b5e', // royal velvet purple
    accent3: '#8b0000', // imperial ruby red
    accent4: '#0e3d59', // sapphire navy
    success: '#1b6338',
    warn: '#b8860b',
    danger: '#8b0000',
    star: '#d4af37', // 24k gold
    chart1: '#b8860b',
    chart2: '#5b1b5e',
    chart3: '#8b0000',
    chart4: '#0e3d59',
    chart5: '#806d20',
    chart6: '#2e5e43',
    chart7: '#753b82',
    chart8: '#4b6584',
  },
  shape: {
    radiusS: '6px',
    radiusM: '12px',
    radiusL: '20px',
    radiusPill: '9999px',
    borderW: '2px',
    buttonShape: 'pill',
  },
  depth: {
    shadowCard: '0 8px 24px rgba(184, 134, 11, 0.12), 0 2px 6px rgba(41, 21, 59, 0.05)',
    shadowButton: '0 4px 14px rgba(184, 134, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    shadowPressed: '0 1px 4px rgba(184, 134, 11, 0.5)',
  },
  type: {
    fontBody: "'Georgia', 'Times New Roman', serif",
    fontDisplay: "'Playfair Display', 'Georgia', serif",
    sizeS: '0.8125rem',
    sizeM: '0.9375rem',
    sizeL: '1.125rem',
    sizeXL: '1.375rem',
    weightNormal: '400',
    weightMedium: '500',
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
    easeBounce: 'cubic-bezier(0.2, 1.2, 0.4, 1)',
    easeSoft: 'cubic-bezier(0.16, 1, 0.3, 1)',
    durFast: '160ms',
    durMed: '320ms',
    durSlow: '640ms',
    entranceStyle: 'regal-fade',
  },
}

const royalDarkTokens: ThemeTokens = {
  ...royalLightTokens,
  color: {
    ...royalLightTokens.color,
    bg: '#12091c', // midnight velvet throne
    surface: '#1e112e',
    ink: '#fbf7ff', // high contrast radiant ivory
    inkSoft: '#c4b1d6',
    line: '#422b5c',
    accent: '#ffd700', // radiant shimmering gold
    accent2: '#e2a4ff',
    accent3: '#ff5e7e',
    accent4: '#70c4ff',
    star: '#ffd700',
  },
  depth: {
    shadowCard: '0 8px 30px rgba(0, 0, 0, 0.6), inset 0 0 1px #ffd700',
    shadowButton: '0 0 20px rgba(255, 215, 0, 0.4), 0 4px 10px rgba(0, 0, 0, 0.5)',
    shadowPressed: '0 0 8px rgba(255, 215, 0, 0.6)',
  },
}

const royalArchiveTokens: ThemeTokens = {
  ...royalLightTokens,
  color: {
    ...royalLightTokens.color,
    bg: '#f3efe8',
    surface: '#faf7f2',
    ink: '#26222a',
    inkSoft: '#6b6672',
    line: '#ded6c7',
    accent: '#7a6a4f',
    accent2: '#685973',
    accent3: '#735050',
    accent4: '#51616e',
    star: '#7a6a4f',
    chart1: '#4a4237',
    chart2: '#685973',
    chart3: '#735050',
    chart4: '#51616e',
    chart5: '#877864',
    chart6: '#637568',
    chart7: '#705c75',
    chart8: '#5c6e80',
  },
}

export const royalTheme: Theme = {
  id: 'royal',
  name: 'Royal Velvet',
  tokens: {
    light: royalLightTokens,
    dark: royalDarkTokens,
  },
  archive: royalArchiveTokens,
  iconSet: {
    home: 'Crown',
    dashboard: 'Gem',
    insights: 'Sparkles',
    archive: 'BookOpen',
    profile: 'Shield',
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
