import type { Theme, ThemeTokens } from './types'

const clayLightTokens: ThemeTokens = {
  color: {
    bg: '#f9f4ed', // warm biscuit dough
    surface: '#fffefc',
    ink: '#463328', // baked chocolate
    inkSoft: '#876d5a', // warm mocha
    line: '#e6d6c4', // cookie crumb border
    accent: '#d97443', // warm baked terracotta
    accent2: '#dba874', // toasted almond
    accent3: '#bf8152', // warm caramel
    accent4: '#e8c497', // golden biscuit
    success: '#7ea872', // soft matcha
    warn: '#e8a642', // warm honey
    danger: '#c9544d', // baked berry
    star: '#e09f3e',
    chart1: '#d97443',
    chart2: '#dba874',
    chart3: '#bf8152',
    chart4: '#e8c497',
    chart5: '#e09f3e',
    chart6: '#8fb584',
    chart7: '#a37c63',
    chart8: '#d6a06e',
  },
  shape: {
    radiusS: '10px',
    radiusM: '18px',
    radiusL: '28px',
    radiusPill: '20px',
    borderW: '2.5px',
    buttonShape: 'rounded-2xl',
  },
  depth: {
    shadowCard: 'inset 0 2px 4px rgba(255, 255, 255, 0.7), inset 0 -3px 6px rgba(0, 0, 0, 0.06), 0 8px 18px rgba(70, 45, 30, 0.1)',
    shadowButton: 'inset 0 2px 3px rgba(255, 255, 255, 0.4), inset 0 -3px 4px rgba(0, 0, 0, 0.2), 0 5px 10px rgba(140, 65, 30, 0.25)',
    shadowPressed: 'inset 0 3px 6px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(140, 65, 30, 0.15)',
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

const clayDarkTokens: ThemeTokens = {
  ...clayLightTokens,
  color: {
    ...clayLightTokens.color,
    bg: '#2b201a', // dark roast espresso
    surface: '#382b24',
    ink: '#f5eae0', // oat milk
    inkSoft: '#bfa796',
    line: '#4c3b31',
    accent: '#e08353',
    accent2: '#dba874',
    accent3: '#bf8152',
    accent4: '#e8c497',
    star: '#e8a642',
  },
  depth: {
    shadowCard: '0 6px 0 #4c3b31',
    shadowButton: '0 4px 0 #bf5e2b',
    shadowPressed: '0 1px 0 #bf5e2b',
  },
}

const clayArchiveTokens: ThemeTokens = {
  ...clayLightTokens,
  color: {
    ...clayLightTokens.color,
    bg: '#f5f4f2',
    surface: '#ffffff',
    ink: '#302d2a',
    inkSoft: '#7b7670',
    line: '#dedbd7',
    accent: '#635d56',
    accent2: '#807971',
    accent3: '#9e968d',
    accent4: '#bcbaa3',
    star: '#7b7670',
  },
  depth: {
    shadowCard: '0 6px 0 #dedbd7',
    shadowButton: '0 4px 0 #45403a',
    shadowPressed: '0 1px 0 #45403a',
  },
}

export const clayTheme: Theme = {
  id: 'clay',
  name: 'Baked Clay',
  tokens: {
    light: clayLightTokens,
    dark: clayDarkTokens,
  },
  archive: clayArchiveTokens,
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
