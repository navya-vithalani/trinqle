import React, { useState } from 'react'
import { Moon, Sun, Archive, Shield } from 'lucide-react'
import { getTheme, applyThemeTokens } from '../../themes/registry'

export const ProfileScreen: React.FC = () => {
  const [mode, setMode] = useState<'light' | 'dark' | 'archive'>('light')

  const toggleThemeMode = (newMode: 'light' | 'dark' | 'archive') => {
    setMode(newMode)
    const theme = getTheme('cutesy')
    if (newMode === 'archive') {
      applyThemeTokens(theme.archive, false)
    } else if (newMode === 'dark') {
      applyThemeTokens(theme.tokens.dark, true)
    } else {
      applyThemeTokens(theme.tokens.light, false)
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="sticker-card p-4 space-y-3">
        <h2 className="text-base font-bold text-[var(--color-ink)]">Appearance</h2>
        <p className="text-xs text-[var(--color-ink-soft)]">
          Preview themes and archive styles. No emojis are used anywhere in the application.
        </p>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            type="button"
            onClick={() => toggleThemeMode('light')}
            className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-[var(--radius-m)] border-2 text-xs font-medium transition-all ${
              mode === 'light'
                ? 'border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-accent)] font-semibold'
                : 'border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-soft)]'
            }`}
          >
            <Sun size={18} className="mb-1" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => toggleThemeMode('dark')}
            className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-[var(--radius-m)] border-2 text-xs font-medium transition-all ${
              mode === 'dark'
                ? 'border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-accent)] font-semibold'
                : 'border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-soft)]'
            }`}
          >
            <Moon size={18} className="mb-1" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => toggleThemeMode('archive')}
            className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-[var(--radius-m)] border-2 text-xs font-medium transition-all ${
              mode === 'archive'
                ? 'border-[var(--color-ink)] bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold'
                : 'border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-soft)]'
            }`}
          >
            <Archive size={18} className="mb-1" />
            <span>Archive</span>
          </button>
        </div>
      </div>

      <div className="sticker-card p-4 space-y-3">
        <h2 className="text-base font-bold text-[var(--color-ink)]">Journal settings</h2>
        <div className="divide-y divide-[var(--color-line)] text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[var(--color-ink)]">Active character</span>
            <span className="font-semibold text-[var(--color-accent)]">Piqsie (White cat)</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[var(--color-ink)]">Form window</span>
            <span className="text-[var(--color-ink-soft)]">21:00 to 03:00</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[var(--color-ink)]">Week starts on</span>
            <span className="text-[var(--color-ink-soft)]">Monday</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[var(--color-ink)]">Time format</span>
            <span className="text-[var(--color-ink-soft)]">12-hour</span>
          </div>
        </div>
      </div>

      <div className="sticker-card p-4 space-y-2">
        <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--color-ink)]">
          <Shield size={16} className="text-[var(--color-success)]" />
          <span>Local and private</span>
        </div>
        <p className="text-[11px] text-[var(--color-ink-soft)]">
          All data lives securely in your device's IndexedDB. No cloud sync, no tracking, and no external AI services in v1.
        </p>
      </div>
    </div>
  )
}
