import type { Theme, ThemeTokens } from './types'

const retroLightTokens: ThemeTokens = {
  color: {
    bg: '#e8e4d9', // classic 90s PC putty beige
    surface: '#f4f0e6',
    ink: '#1a1a1a', // mechanical ink (> 12:1)
    inkSoft: '#5a5750', // readable (> 4.8:1)
    line: '#c5c0b4',
    accent: '#008080', // classic Windows 95 teal
    accent2: '#800080', // retro vapor purple
    accent3: '#d96b00', // phosphor amber
    accent4: '#8b4513', // cassette brown
    success: '#008000',
    warn: '#b86200',
    danger: '#c00000',
    star: '#d98b00',
    chart1: '#008080',
    chart2: '#800080',
    chart3: '#d96b00',
    chart4: '#8b4513',
    chart5: '#005580',
    chart6: '#008040',
    chart7: '#993366',
    chart8: '#666699',
  },
  shape: {
    radiusS: '2px',
    radiusM: '4px',
    radiusL: '6px',
    radiusPill: '4px',
    borderW: '2px',
    buttonShape: 'rectangle',
  },
  depth: {
    shadowCard: 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px #808080, 2px 2px 0px #1a1a1a',
    shadowButton: 'inset 1.5px 1.5px 0px #ffffff, inset -1.5px -1.5px 0px #505050, 2px 2px 0px #000000',
    shadowPressed: 'inset 1.5px 1.5px 0px #505050, inset -1.5px -1.5px 0px #ffffff, 0px 0px 0px #000000',
  },
  type: {
    fontBody: "ui-monospace, 'Courier New', Courier, monospace",
    fontDisplay: "ui-monospace, 'Courier New', Courier, monospace",
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
    easeBounce: 'steps(4, jump-end)',
    easeSoft: 'linear',
    durFast: '80ms',
    durMed: '160ms',
    durSlow: '320ms',
    entranceStyle: 'snap',
  },
}

const retroDarkTokens: ThemeTokens = {
  ...retroLightTokens,
  color: {
    ...retroLightTokens.color,
    bg: '#0d1117', // CRT dark
    surface: '#161b22', // terminal window
    ink: '#39ff14', // classic terminal phosphor green (> 10:1)
    inkSoft: '#85e89d', // bright green soft ink
    line: '#30363d',
    accent: '#00ffcc', // cyan terminal
    accent2: '#ff79c6',
    accent3: '#ffb86c',
    accent4: '#f1fa8c',
    star: '#ffd700',
  },
  depth: {
    shadowCard: 'inset 1px 1px 0px #30363d, inset -1px -1px 0px #010409, 2px 2px 0px #000000',
    shadowButton: 'inset 1.5px 1.5px 0px #484f58, inset -1.5px -1.5px 0px #161b22, 2px 2px 0px #000000',
    shadowPressed: 'inset 1.5px 1.5px 0px #161b22, inset -1.5px -1.5px 0px #484f58',
  },
}

const retroArchiveTokens: ThemeTokens = {
  ...retroLightTokens,
  color: {
    ...retroLightTokens.color,
    bg: '#e4e2dd',
    surface: '#efede8',
    ink: '#222222',
    inkSoft: '#666666',
    line: '#b5b2aa',
    accent: '#555555',
    accent2: '#777777',
    accent3: '#888888',
    accent4: '#999999',
    star: '#666666',
    chart1: '#333333',
    chart2: '#555555',
    chart3: '#777777',
    chart4: '#999999',
    chart5: '#444444',
    chart6: '#666666',
    chart7: '#888888',
    chart8: '#aaaaaa',
  },
  depth: {
    shadowCard: 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px #888888, 2px 2px 0px #222222',
    shadowButton: 'inset 1.5px 1.5px 0px #ffffff, inset -1.5px -1.5px 0px #666666, 2px 2px 0px #000000',
    shadowPressed: 'inset 1.5px 1.5px 0px #666666, inset -1.5px -1.5px 0px #ffffff',
  },
}

export const retroTheme: Theme = {
  id: 'retro',
  name: 'Retro Pixel',
  tokens: {
    light: retroLightTokens,
    dark: retroDarkTokens,
  },
  archive: retroArchiveTokens,
  iconSet: {
    home: 'Monitor',
    dashboard: 'Terminal',
    insights: 'Radio',
    archive: 'HardDrive',
    profile: 'Cpu',
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
