import type { Theme, ThemeTokens } from './types'

const cyberpunkLightTokens: ThemeTokens = {
  color: {
    bg: '#e8ecf2', // Sleek cyber platinum / chrome
    surface: '#ffffff', // High-contrast crisp panel
    ink: '#0a0d14', // Deep obsidian black (contrast > 18:1)
    inkSoft: '#475569', // Tech slate steel (contrast > 6.5:1)
    line: '#cbd5e1', // Circuit divider
    accent: '#0066cc', // Sharp electric blue
    accent2: '#e6005c', // Hot neon magenta
    accent3: '#d97706', // Warning hazard amber
    accent4: '#7928ca', // Cyber violet
    success: '#00875a', // Matrix green
    warn: '#d97706', // Cyber amber
    danger: '#dc2626', // Red alert
    star: '#d97706',
    chart1: '#0066cc',
    chart2: '#e6005c',
    chart3: '#d97706',
    chart4: '#7928ca',
    chart5: '#00875a',
    chart6: '#0284c7',
    chart7: '#9333ea',
    chart8: '#2563eb',
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
    shadowCard: '0 2px 8px rgba(0, 102, 204, 0.08), 0 0 1px #0066cc',
    shadowButton: '0 3px 0 #004d99',
    shadowPressed: '0 1px 0 #004d99, inset 0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  type: {
    fontBody: "'Rajdhani', 'Space Grotesk', system-ui, sans-serif",
    fontDisplay: "'Orbitron', 'Rajdhani', system-ui, sans-serif",
    sizeS: '0.8125rem',
    sizeM: '0.9375rem',
    sizeL: '1.125rem',
    sizeXL: '1.375rem',
    weightNormal: '500',
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
    bg: '#07080d', // Deep obsidian void
    surface: '#10131e', // Cyber carbon plate
    ink: '#f0f6fc', // Crisp glitch ice white (contrast > 15:1)
    inkSoft: '#8b9bb4', // Readable cold steel (contrast > 6:1)
    line: '#1e2638', // Neon circuit grid
    accent: '#00f0ff', // Electric cyan
    accent2: '#ff0055', // Hot neon magenta
    accent3: '#ffe600', // Electric hazard yellow
    accent4: '#a855f7', // Cyber violet
    success: '#00ff9d', // Matrix green
    warn: '#ffaa00', // Cyber amber
    danger: '#ff003c', // Red alert
    star: '#ffe600',
    chart1: '#00f0ff',
    chart2: '#ff0055',
    chart3: '#ffe600',
    chart4: '#a855f7',
    chart5: '#00ff9d',
    chart6: '#ffaa00',
    chart7: '#00c3ff',
    chart8: '#d600ff',
  },
  depth: {
    shadowCard: '0 0 16px rgba(0, 240, 255, 0.12), inset 0 0 1px #00f0ff',
    shadowButton: '0 0 14px rgba(0, 240, 255, 0.4), 0 3px 0 #008899',
    shadowPressed: '0 0 6px rgba(0, 240, 255, 0.6), inset 0 2px 4px rgba(0, 0, 0, 0.5)',
  },
}

const cyberpunkArchiveTokens: ThemeTokens = {
  ...cyberpunkLightTokens,
  color: {
    ...cyberpunkLightTokens.color,
    bg: '#0e1014',
    surface: '#181b22',
    ink: '#e2e5eb',
    inkSoft: '#88919e',
    line: '#282d38',
    accent: '#8a95a3',
    accent2: '#68727d',
    accent3: '#525b65',
    accent4: '#3f454d',
    star: '#8a95a3',
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
