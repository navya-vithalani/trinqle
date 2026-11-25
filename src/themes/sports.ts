import type { Theme, ThemeTokens } from './types'

const sportsLightTokens: ThemeTokens = {
  color: {
    bg: '#f0f5f1', // stadium concourse
    surface: '#ffffff',
    ink: '#0f2619', // deep stadium varsity dark green (> 12:1)
    inkSoft: '#446352', // readable soft turf green (> 4.8:1)
    line: '#cfe0d5', // yard line
    accent: '#008744', // stadium turf green (> 4.5:1)
    accent2: '#e64a19', // whistle orange
    accent3: '#0066cc', // varsity royal blue
    accent4: '#d98b00', // trophy gold
    success: '#008744',
    warn: '#d98b00',
    danger: '#c62828',
    star: '#d98b00',
    chart1: '#008744',
    chart2: '#e64a19',
    chart3: '#0066cc',
    chart4: '#d98b00',
    chart5: '#1b5e20',
    chart6: '#0277bd',
    chart7: '#e65100',
    chart8: '#4a148c',
  },
  shape: {
    radiusS: '4px',
    radiusM: '8px',
    radiusL: '14px',
    radiusPill: '9999px',
    borderW: '2.5px',
    buttonShape: 'pill',
  },
  depth: {
    shadowCard: '0 5px 0 #cfe0d5',
    shadowButton: '0 4px 0 #0f4f2c',
    shadowPressed: '0 1px 0 #0f4f2c',
  },
  type: {
    fontBody: "'Arial Black', Impact, system-ui, sans-serif",
    fontDisplay: "'Arial Black', Impact, system-ui, sans-serif",
    sizeS: '0.8125rem',
    sizeM: '0.9375rem',
    sizeL: '1.125rem',
    sizeXL: '1.375rem',
    weightNormal: '500',
    weightMedium: '700',
    weightBold: '900',
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
    easeBounce: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    easeSoft: 'ease-out',
    durFast: '120ms',
    durMed: '240ms',
    durSlow: '480ms',
    entranceStyle: 'sprint',
  },
}

const sportsDarkTokens: ThemeTokens = {
  ...sportsLightTokens,
  color: {
    ...sportsLightTokens.color,
    bg: '#0a140f', // night game stadium
    surface: '#13221b', // locker room
    ink: '#f0fff4', // electric bright white
    inkSoft: '#96c2a8',
    line: '#254233',
    accent: '#00e676', // neon turf green
    accent2: '#ff6e40',
    accent3: '#40a9ff',
    accent4: '#ffd600',
    star: '#ffd600',
  },
  depth: {
    shadowCard: '0 5px 0 #000000, inset 0 0 1px #00e676',
    shadowButton: '0 4px 0 #005a2b',
    shadowPressed: '0 1px 0 #005a2b',
  },
}

const sportsArchiveTokens: ThemeTokens = {
  ...sportsLightTokens,
  color: {
    ...sportsLightTokens.color,
    bg: '#e8ebe9',
    surface: '#f5f7f5',
    ink: '#1c211e',
    inkSoft: '#565c58',
    line: '#bcc2be',
    accent: '#47544b',
    accent2: '#69574e',
    accent3: '#46525c',
    accent4: '#635e4e',
    star: '#635e4e',
    chart1: '#1c211e',
    chart2: '#47544b',
    chart3: '#69574e',
    chart4: '#46525c',
    chart5: '#635e4e',
    chart6: '#3d4740',
    chart7: '#5c544d',
    chart8: '#3f474f',
  },
  depth: {
    shadowCard: '0 5px 0 #bcc2be',
    shadowButton: '0 4px 0 #2b332e',
    shadowPressed: '0 1px 0 #2b332e',
  },
}

export const sportsTheme: Theme = {
  id: 'sports',
  name: 'Varsity Sports',
  tokens: {
    light: sportsLightTokens,
    dark: sportsDarkTokens,
  },
  archive: sportsArchiveTokens,
  iconSet: {
    home: 'Trophy',
    dashboard: 'Timer',
    insights: 'Flame',
    archive: 'Medal',
    profile: 'Dumbbell',
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
