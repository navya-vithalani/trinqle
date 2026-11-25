import React, { useState, useEffect } from 'react'
import type { TabId } from './types'
import { Navbar } from './components/Navbar'
import { PWAUpdateBanner } from './components/PWAUpdateBanner'
import { HomeScreen } from './screens/HomeScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { InsightsScreen } from './screens/InsightsScreen'
import { ArchiveScreen } from './screens/ArchiveScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { ArchiveHomeScreen } from './archive/ArchiveHomeScreen'
import { FrozenDashboardView } from './archive/FrozenDashboardView'
import {
  loadThemePreference,
  applyThemeById,
  applyArchiveTheme,
  restoreLiveTheme,
} from '../themes/registry'
import type { Chapter, ChapterAnswer } from '../data/types'
import { ChapterRepository } from '../data/repositories'
import { ArrowLeft, Lock } from 'lucide-react'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [profileInspectDate, setProfileInspectDate] = useState<string | null>(null)

  // Archive Mode State (TRD 12 & PRD 5.6)
  const [archiveViewingChapter, setArchiveViewingChapter] = useState<Chapter | null>(null)
  const [chapterAnswers, setChapterAnswers] = useState<ChapterAnswer[]>([])

  useEffect(() => {
    // Initialize saved theme and dark mode preference
    const { themeId, isDark } = loadThemePreference()
    applyThemeById(themeId, isDark)
  }, [])

  // Manage monochrome archive theme vs full-colour Home in archive mode
  useEffect(() => {
    if (archiveViewingChapter) {
      if (activeTab === 'home') {
        // TRD 12: Archive mode Home stays in full colour!
        applyThemeById(archiveViewingChapter.themeId, false)
      } else {
        // Other tabs switch to monochrome archive variant
        applyArchiveTheme(archiveViewingChapter.themeId)
      }
    } else {
      restoreLiveTheme()
    }
  }, [archiveViewingChapter, activeTab])

  const handleSelectArchiveChapter = async (chapter: Chapter) => {
    setArchiveViewingChapter(chapter)
    setActiveTab('home')

    const chapterRepo = new ChapterRepository()
    const answers = await chapterRepo.getChapterAnswers(chapter.id)
    setChapterAnswers(answers)
  }

  const handleExitArchiveMode = () => {
    setArchiveViewingChapter(null)
    restoreLiveTheme()
  }

  const handleNavigateToProfileBrowse = (date: string) => {
    setProfileInspectDate(date)
    setActiveTab('profile')
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex justify-center">
      {/* Mobile container constraint: phone-only (max 440px wide) */}
      <div className="w-full max-w-[440px] min-h-screen bg-[var(--color-bg)] flex flex-col relative">
        {/* PWA Update Banner (renders if a new service worker / deployment is waiting) */}
        <PWAUpdateBanner />

        {/* Top bar with safe area inset */}
        <header className="sticky top-0 z-20 bg-[var(--color-surface)]/90 backdrop-blur-md border-b-2 border-[var(--color-line)] px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold tracking-tight text-[var(--color-accent)]">
              Trinqle
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-line)] text-[var(--color-ink)] font-medium">
            v0.2
          </span>
        </header>

        {/* Archive Mode Persistent Header Banner */}
        {archiveViewingChapter && (
          <div className="sticky top-[53px] z-20 bg-neutral-900 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-md">
            <div className="flex items-center gap-1.5 truncate max-w-[270px]">
              <Lock size={12} className="text-amber-400 shrink-0" />
              <span className="truncate">Archive: {archiveViewingChapter.title}</span>
            </div>
            <button
              type="button"
              onClick={handleExitArchiveMode}
              className="text-amber-300 hover:underline flex items-center gap-1 font-bold shrink-0"
            >
              <ArrowLeft size={12} />
              <span>Exit</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'home' &&
            (archiveViewingChapter ? (
              <ArchiveHomeScreen
                chapter={archiveViewingChapter}
                chapterAnswers={chapterAnswers}
                onExitArchive={handleExitArchiveMode}
                onNavigateToDay={handleNavigateToProfileBrowse}
              />
            ) : (
              <HomeScreen onNavigateToProfileBrowse={handleNavigateToProfileBrowse} />
            ))}

          {activeTab === 'dashboard' &&
            (archiveViewingChapter ? (
              <FrozenDashboardView
                chapter={archiveViewingChapter}
                onExitArchive={handleExitArchiveMode}
              />
            ) : (
              <DashboardScreen onNavigateToProfileBrowse={handleNavigateToProfileBrowse} />
            ))}

          {activeTab === 'insights' && <InsightsScreen />}

          {activeTab === 'archive' && (
            <ArchiveScreen
              onSelectArchiveChapter={handleSelectArchiveChapter}
              onNavigateToDay={handleNavigateToProfileBrowse}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileScreen
              initialInspectDate={profileInspectDate}
              onClearInspectDate={() => setProfileInspectDate(null)}
            />
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />
      </div>
    </div>
  )
}
