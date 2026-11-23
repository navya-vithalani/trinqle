import React, { useState, useEffect } from 'react'
import type { TabId } from './types'
import { Navbar } from './components/Navbar'
import { HomeScreen } from './screens/HomeScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { InsightsScreen } from './screens/InsightsScreen'
import { ArchiveScreen } from './screens/ArchiveScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { getTheme, applyThemeTokens } from '../themes/registry'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home')

  useEffect(() => {
    // Initialize default theme (Cutesy Light)
    const defaultTheme = getTheme('cutesy')
    applyThemeTokens(defaultTheme.tokens.light, false)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex justify-center">
      {/* Mobile container constraint: phone-only (max 440px wide) */}
      <div className="w-full max-w-[440px] min-h-screen bg-[var(--color-bg)] flex flex-col relative">
        {/* Top bar with safe area inset */}
        <header className="sticky top-0 z-20 bg-[var(--color-surface)]/90 backdrop-blur-md border-b-2 border-[var(--color-line)] px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold tracking-tight text-[var(--color-accent)]">
              Trinqle
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-line)] text-[var(--color-ink)] font-medium">
            v0.1
          </span>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'dashboard' && <DashboardScreen />}
          {activeTab === 'insights' && <InsightsScreen />}
          {activeTab === 'archive' && <ArchiveScreen />}
          {activeTab === 'profile' && <ProfileScreen />}
        </main>

        {/* Bottom Navigation Bar */}
        <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />
      </div>
    </div>
  )
}
