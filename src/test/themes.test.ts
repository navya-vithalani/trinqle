import { describe, it, expect, beforeEach } from 'vitest'
import { clayTheme } from '../themes/clay'
import { cyberpunkTheme } from '../themes/cyberpunk'
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

  it('registers cutesy, baked clay, and cyberpunk themes correctly', () => {
    expect(themeRegistry['cutesy']).toBeDefined()
    expect(getTheme('cutesy').name).toBe('Cutesy')

    expect(themeRegistry['clay']).toBeDefined()
    expect(getTheme('clay').name).toBe('Baked Clay')

    expect(themeRegistry['cyberpunk']).toBeDefined()
    expect(getTheme('cyberpunk').name).toBe('Cyberpunk')
  })

  it('provides complete light, dark, and archive tokens for cyberpunk theme with tech typography', () => {
    const theme = cyberpunkTheme

    // Check high contrast colors in light and dark
    expect(theme.tokens.light.color.bg).toBe('#e8ecf2')
    expect(theme.tokens.dark.color.bg).toBe('#07080d')
    expect(theme.tokens.dark.color.accent).toBe('#00f0ff')
    expect(theme.tokens.dark.color.accent2).toBe('#ff0055')

    // Check tech typography
    expect(theme.tokens.light.type.fontDisplay).toContain('Orbitron')
    expect(theme.tokens.light.type.fontBody).toContain('Rajdhani')

    // Check sharp angular shape tokens
    expect(theme.tokens.light.shape.radiusPill).toBe('4px')
    expect(theme.tokens.light.shape.buttonShape).toBe('sharp')

    // Check archive tokens
    expect(theme.archive.color.bg).toBeDefined()
    expect(theme.archive.color.ink).toBeDefined()
  })

  it('provides complete light, dark, and archive tokens for baked clay theme with comfortaa typography', () => {
    const theme = clayTheme

    // Check light colors
    expect(theme.tokens.light.color.bg).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(theme.tokens.light.color.accent).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(theme.tokens.light.color.ink).toMatch(/^#[0-9a-fA-F]{6}$/)

    // Check dark colors
    expect(theme.tokens.dark.color.bg).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(theme.tokens.dark.color.surface).toMatch(/^#[0-9a-fA-F]{6}$/)

    // Check typography
    expect(theme.tokens.light.type.fontDisplay).toContain('Comfortaa')

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

  it('switches multi-view characters between side and front view during locomotion', async () => {
    const { initCharacterAnimator } = await import('../characters/animator')
    let currentView = 'front'
    const mockContainer = {
      querySelector: () => null,
      querySelectorAll: () => [],
    } as unknown as HTMLElement

    const unicornAnimator = initCharacterAnimator(mockContainer, {
      characterId: 'unicorn',
      onViewChange: (next) => {
        currentView = next
      },
    })
    unicornAnimator.playClip('gallop')
    expect(currentView).toBe('side')
    unicornAnimator.destroy()

    const rabbitAnimator = initCharacterAnimator(mockContainer, {
      characterId: 'rabbit',
      onViewChange: (next) => {
        currentView = next
      },
    })
    rabbitAnimator.playClip('hop')
    expect(currentView).toBe('side')
    rabbitAnimator.destroy()
  })
})
