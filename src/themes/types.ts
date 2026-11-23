export interface ThemeTokens {
  color: {
    bg: string
    surface: string
    ink: string
    inkSoft: string
    line: string
    accent: string
    accent2: string
    accent3: string
    accent4: string
    success: string
    warn: string
    danger: string
    star: string
    chart1: string
    chart2: string
    chart3: string
    chart4: string
    chart5: string
    chart6: string
    chart7: string
    chart8: string
  }
  shape: {
    radiusS: string
    radiusM: string
    radiusL: string
    radiusPill: string
    borderW: string
    buttonShape: string
  }
  depth: {
    shadowCard: string
    shadowButton: string
    shadowPressed: string
  }
  type: {
    fontBody: string
    fontDisplay: string
    sizeS: string
    sizeM: string
    sizeL: string
    sizeXL: string
    weightNormal: string
    weightMedium: string
    weightBold: string
  }
  space: {
    s2: string
    s4: string
    s8: string
    s12: string
    s16: string
    s24: string
    s32: string
  }
  motion: {
    easeBounce: string
    easeSoft: string
    durFast: string
    durMed: string
    durSlow: string
    entranceStyle: string
  }
}

export type IconKey =
  | 'home'
  | 'dashboard'
  | 'insights'
  | 'archive'
  | 'profile'
  | 'plus'
  | 'edit'
  | 'delete'
  | 'search'
  | 'chevron-left'
  | 'chevron-right'
  | 'settings'
  | 'star'
  | 'calendar'
  | 'check'
  | 'x'
  | 'moon'
  | 'sun'
  | 'sparkles'
  | 'book-open'
  | 'file-text'
  | 'clock'
  | 'heart'
  | 'activity'
  | 'share'
  | 'download'
  | 'upload'

export interface Theme {
  id: string
  name: string
  tokens: {
    light: ThemeTokens
    dark: ThemeTokens
  }
  archive: ThemeTokens
  iconSet: Record<IconKey, string>
}
