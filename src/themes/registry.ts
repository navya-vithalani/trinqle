import { cutesyTheme } from './cutesy'
import { clayTheme } from './clay'
import { cyberpunkTheme } from './cyberpunk'
import { retroTheme } from './retro'
import { royalTheme } from './royal'
import { newspaperTheme } from './newspaper'
import { sportsTheme } from './sports'
import type { Theme, ThemeTokens } from './types'

export const themeRegistry: Record<string, Theme> = {
  cutesy: cutesyTheme,
  clay: clayTheme,
  cyberpunk: cyberpunkTheme,
  retro: retroTheme,
  royal: royalTheme,
  newspaper: newspaperTheme,
  sports: sportsTheme,
}

const STORAGE_THEME_KEY = 'trinqle_theme_id'
const STORAGE_DARK_KEY = 'trinqle_dark_mode'

export function getTheme(themeId: string = 'cutesy'): Theme {
  return themeRegistry[themeId] || cutesyTheme
}

export function getAllThemes(): Theme[] {
  return Object.values(themeRegistry)
}

export function loadThemePreference(): { themeId: string; isDark: boolean } {
  try {
    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) || 'cutesy'
    const savedDark = localStorage.getItem(STORAGE_DARK_KEY) === 'true'
    return {
      themeId: themeRegistry[savedTheme] ? savedTheme : 'cutesy',
      isDark: savedDark,
    }
  } catch {
    return { themeId: 'cutesy', isDark: false }
  }
}

export function saveThemePreference(themeId: string, isDark: boolean): void {
  try {
    localStorage.setItem(STORAGE_THEME_KEY, themeId)
    localStorage.setItem(STORAGE_DARK_KEY, String(isDark))
  } catch {
    // Ignore localStorage errors
  }
}

export function applyThemeTokens(tokens: ThemeTokens, isDark: boolean = false): void {
  const root = document.documentElement

  // Colors
  root.style.setProperty('--color-bg', tokens.color.bg)
  root.style.setProperty('--color-surface', tokens.color.surface)
  root.style.setProperty('--color-ink', tokens.color.ink)
  root.style.setProperty('--color-ink-soft', tokens.color.inkSoft)
  root.style.setProperty('--color-line', tokens.color.line)
  root.style.setProperty('--color-accent', tokens.color.accent)
  root.style.setProperty('--color-accent2', tokens.color.accent2)
  root.style.setProperty('--color-accent3', tokens.color.accent3)
  root.style.setProperty('--color-accent4', tokens.color.accent4)
  root.style.setProperty('--color-success', tokens.color.success)
  root.style.setProperty('--color-warn', tokens.color.warn)
  root.style.setProperty('--color-danger', tokens.color.danger)
  root.style.setProperty('--color-star', tokens.color.star)
  root.style.setProperty('--color-chart1', tokens.color.chart1)
  root.style.setProperty('--color-chart2', tokens.color.chart2)
  root.style.setProperty('--color-chart3', tokens.color.chart3)
  root.style.setProperty('--color-chart4', tokens.color.chart4)
  root.style.setProperty('--color-chart5', tokens.color.chart5)
  root.style.setProperty('--color-chart6', tokens.color.chart6)
  root.style.setProperty('--color-chart7', tokens.color.chart7)
  root.style.setProperty('--color-chart8', tokens.color.chart8)

  // Shape
  root.style.setProperty('--radius-s', tokens.shape.radiusS)
  root.style.setProperty('--radius-m', tokens.shape.radiusM)
  root.style.setProperty('--radius-l', tokens.shape.radiusL)
  root.style.setProperty('--radius-pill', tokens.shape.radiusPill)
  root.style.setProperty('--border-w', tokens.shape.borderW)

  // Depth
  root.style.setProperty('--shadow-card', tokens.depth.shadowCard)
  root.style.setProperty('--shadow-button', tokens.depth.shadowButton)
  root.style.setProperty('--shadow-pressed', tokens.depth.shadowPressed)

  // Typography
  root.style.setProperty('--font-body', tokens.type.fontBody)
  root.style.setProperty('--font-display', tokens.type.fontDisplay)

  // Motion
  root.style.setProperty('--ease-bounce', tokens.motion.easeBounce)
  root.style.setProperty('--ease-soft', tokens.motion.easeSoft)
  root.style.setProperty('--dur-fast', tokens.motion.durFast)
  root.style.setProperty('--dur-med', tokens.motion.durMed)
  root.style.setProperty('--dur-slow', tokens.motion.durSlow)

  // Update theme-color meta tag
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) {
    metaTheme.setAttribute('content', tokens.color.bg)
  }

  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function applyThemeById(themeId: string, isDark: boolean): void {
  const theme = getTheme(themeId)
  const tokens = isDark ? theme.tokens.dark : theme.tokens.light
  applyThemeTokens(tokens, isDark)

  const root = document.documentElement
  root.setAttribute('data-theme', themeId)

  // Theme-specific tab variations
  if (themeId === 'clay') {
    root.style.setProperty('--tab-home-lift', '-6px')
    root.style.setProperty('--tab-home-radius', '18px')
    root.style.setProperty(
      '--tab-home-shadow',
      'inset 0 2px 4px rgba(255, 255, 255, 0.5), 0 4px 12px rgba(90, 50, 30, 0.2)'
    )
    root.style.setProperty('--tab-home-bg', 'transparent')
    root.style.setProperty('--tab-home-active-bg', 'var(--color-bg)')
  } else if (themeId === 'cyberpunk') {
    root.style.setProperty('--tab-home-lift', '-4px')
    root.style.setProperty('--tab-home-radius', '4px')
    root.style.setProperty(
      '--tab-home-shadow',
      '0 0 12px rgba(0, 240, 255, 0.6), inset 0 0 4px #00f0ff'
    )
    root.style.setProperty('--tab-home-bg', 'transparent')
    root.style.setProperty('--tab-home-active-bg', 'var(--color-bg)')
  } else if (themeId === 'royal') {
    // Big Shiny Home Button for Royal Theme
    root.style.setProperty('--tab-home-lift', '-14px')
    root.style.setProperty('--tab-home-radius', '9999px')
    root.style.setProperty(
      '--tab-home-shadow',
      '0 0 24px rgba(255, 215, 0, 0.8), 0 6px 18px rgba(184, 134, 11, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.9)'
    )
    root.style.setProperty(
      '--tab-home-bg',
      'linear-gradient(135deg, #ffd700 0%, #daa520 50%, #fff3a8 100%)'
    )
    root.style.setProperty(
      '--tab-home-active-bg',
      'linear-gradient(135deg, #fff2a3 0%, #ffd700 50%, #b8860b 100%)'
    )
    root.style.setProperty('--tab-home-active-color', '#29153b')
    root.style.setProperty('--tab-home-inactive-color', '#4a154b')
  } else if (themeId === 'retro') {
    // Tactile beveled button
    root.style.setProperty('--tab-home-lift', '-4px')
    root.style.setProperty('--tab-home-radius', '4px')
    root.style.setProperty(
      '--tab-home-shadow',
      'inset 1.5px 1.5px 0px #ffffff, inset -1.5px -1.5px 0px #505050, 2px 2px 0px #000000'
    )
    root.style.setProperty('--tab-home-bg', 'transparent')
    root.style.setProperty('--tab-home-active-bg', 'var(--color-bg)')
  } else if (themeId === 'newspaper') {
    // Broadsheet square framing
    root.style.setProperty('--tab-home-lift', '0px')
    root.style.setProperty('--tab-home-radius', '0px')
    root.style.setProperty('--tab-home-shadow', 'none')
    root.style.setProperty('--tab-home-bg', 'transparent')
    root.style.setProperty('--tab-home-active-bg', 'var(--color-bg)')
  } else if (themeId === 'sports') {
    // Stadium athletic badge
    root.style.setProperty('--tab-home-lift', '-8px')
    root.style.setProperty('--tab-home-radius', '12px')
    root.style.setProperty(
      '--tab-home-shadow',
      '0 4px 14px rgba(0, 135, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
    )
    root.style.setProperty('--tab-home-bg', 'transparent')
    root.style.setProperty('--tab-home-active-bg', 'var(--color-bg)')
  } else {
    root.style.setProperty('--tab-home-lift', '0px')
    root.style.setProperty('--tab-home-radius', '9999px')
    root.style.setProperty('--tab-home-shadow', 'none')
    root.style.setProperty('--tab-home-bg', 'transparent')
    root.style.setProperty('--tab-home-active-bg', 'var(--color-bg)')
  }

  saveThemePreference(themeId, isDark)
}

/**
 * Applies the monochrome archive variant for the chosen chapter theme.
 * Keeps the theme's icons, shapes, depth, and motion, but desaturates colors.
 */
export function applyArchiveTheme(themeId: string): void {
  const theme = getTheme(themeId)
  applyThemeTokens(theme.archive, false)

  const root = document.documentElement
  root.setAttribute('data-theme', themeId)
  root.setAttribute('data-archive', 'true')
}

/**
 * Restores live mode theme tokens and clears archive attribute.
 */
export function restoreLiveTheme(): void {
  const root = document.documentElement
  root.removeAttribute('data-archive')
  const { themeId, isDark } = loadThemePreference()
  applyThemeById(themeId, isDark)
}
