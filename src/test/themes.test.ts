import { describe, it, expect } from 'vitest'
import { cutesyTheme } from '../themes/cutesy'
import { getTheme, themeRegistry } from '../themes/registry'

describe('Theme System', () => {
  it('registers the cutesy theme correctly', () => {
    expect(themeRegistry['cutesy']).toBeDefined()
    expect(getTheme('cutesy').name).toBe('Cutesy')
  })

  it('provides complete light, dark, and archive tokens', () => {
    const theme = cutesyTheme

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
    expect(theme.tokens.light.shape.radiusL).toBe('24px')
    expect(theme.tokens.light.shape.radiusPill).toBe('9999px')
    expect(theme.tokens.light.depth.shadowCard).toBeDefined()
    expect(theme.tokens.light.depth.shadowButton).toBeDefined()
  })

  it('maps all required semantic icon keys without emojis', () => {
    const iconSet = cutesyTheme.iconSet
    expect(iconSet.home).toBe('Home')
    expect(iconSet.dashboard).toBe('LayoutDashboard')
    expect(iconSet.insights).toBe('Sparkles')
    expect(iconSet.archive).toBe('BookOpen')
    expect(iconSet.profile).toBe('User')
  })
})
