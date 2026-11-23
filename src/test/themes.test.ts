import { describe, it, expect, beforeEach } from 'vitest'
import { clayTheme } from '../themes/clay'
import {
  getTheme,
  themeRegistry,
  saveThemePreference,
  loadThemePreference,
} from '../themes/registry'

// Mock localStorage for Node test environment
const mockStore: Record<string, string> = {}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (key: string) => mockStore[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStore[key] = String(value)
    },
    removeItem: (key: string) => {
      delete mockStore[key]
    },
    clear: () => {
      Object.keys(mockStore).forEach((k) => delete mockStore[k])
    },
    key: (i: number) => Object.keys(mockStore)[i] ?? null,
    length: 0,
  } as unknown as Storage
}

describe('Theme System', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('registers both cutesy and baked clay themes correctly', () => {
    expect(themeRegistry['cutesy']).toBeDefined()
    expect(getTheme('cutesy').name).toBe('Cutesy')

    expect(themeRegistry['clay']).toBeDefined()
    expect(getTheme('clay').name).toBe('Baked Clay')
  })

  it('provides complete light, dark, and archive tokens for baked clay theme', () => {
    const theme = clayTheme

    // Check light colors
    expect(theme.tokens.light.color.bg).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(theme.tokens.light.color.accent).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(theme.tokens.light.color.ink).toMatch(/^#[0-9a-fA-F]{6}$/)

    // Check dark colors
    expect(theme.tokens.dark.color.bg).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(theme.tokens.dark.color.surface).toMatch(/^#[0-9a-fA-F]{6}$/)

    // Check archive tokens (monochrome)
    expect(theme.archive.color.bg).toBeDefined()
    expect(theme.archive.color.ink).toBeDefined()
    expect(theme.archive.color.accent).toBeDefined()

    // Shapes & Depths
    expect(theme.tokens.light.shape.radiusL).toBeDefined()
    expect(theme.tokens.light.shape.radiusPill).toBeDefined()
    expect(theme.tokens.light.depth.shadowCard).toBeDefined()
    expect(theme.tokens.light.depth.shadowButton).toBeDefined()
  })

  it('persists theme and dark mode preferences across reloads', () => {
    expect(loadThemePreference()).toEqual({ themeId: 'cutesy', isDark: false })

    saveThemePreference('clay', true)
    expect(loadThemePreference()).toEqual({ themeId: 'clay', isDark: true })
  })

  it('maps all required semantic icon keys without emojis', () => {
    const iconSet = clayTheme.iconSet
    expect(iconSet.home).toBe('Home')
    expect(iconSet.dashboard).toBe('LayoutDashboard')
    expect(iconSet.insights).toBe('Sparkles')
    expect(iconSet.archive).toBe('BookOpen')
    expect(iconSet.profile).toBe('User')
  })
})
