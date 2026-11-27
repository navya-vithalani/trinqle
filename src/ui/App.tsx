import React, { useState, useEffect, useCallback } from 'react'
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
import { NightlyFormModal } from './form/NightlyFormModal'
import {
  loadThemePreference,
  applyThemeById,
  applyArchiveTheme,
  restoreLiveTheme,
} from '../themes/registry'
import type { Chapter, ChapterAnswer } from '../data/types'
import { ChapterRepository } from '../data/repositories'
import { migrateLegacyLibraryAnswersIfNeeded } from '../data/migrations'
import { loadAppSettings, type AppSettings } from '../core/settings'
import { requestPersistentStorage } from '../core/export'
import { logicalDate, DEFAULT_WINDOW } from '../core/logicalDay'
import { ArrowLeft, Lock } from 'lucide-react'

const VALID_TABS: TabId[] = ['home', 'dashboard', 'insights', 'archive', 'profile']

function getInitialTabFromUrl(): TabId {
  if (typeof window === 'undefined') return 'home'
  try {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as TabId | null
    if (tab && VALID_TABS.includes(tab)) return tab
  } catch {
    // Ignore URL errors
  }
  return 'home'
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTabFromUrl)
  const [refreshTick, setRefreshTick] = useState(0)

  const [appSettings, setAppSettings] = useState<AppSettings>({
    userName: '',
    formWindowStart: '21:00',
    formWindowEnd: '03:00',
    windowStartHour: DEFAULT_WINDOW.startHour,
    windowEndHour: DEFAULT_WINDOW.endHour,
    weekStart: 'Monday',
    timeFormat: '12h',
  })

  // Global Day Inspector Modal state (opens over any tab without detouring to Profile)
  const [inspectTarget, setInspectTarget] = useState<{
    date: string
    chapterId: string
    lockedClosed: boolean
  } | null>(null)

  // Archive Mode State (TRD 12 & PRD 5.6)
  const [archiveViewingChapter, setArchiveViewingChapter] = useState<Chapter | null>(null)
  const [chapterAnswers, setChapterAnswers] = useState<ChapterAnswer[]>([])

  const refreshSettings = useCallback(async () => {
    try {
      const loaded = await loadAppSettings()
      setAppSettings(loaded)
    } catch {
      // Ignore DB read errors during early boot/SSR
    }
  }, [])

  useEffect(() => {
    const { themeId, isDark } = loadThemePreference()
    applyThemeById(themeId, isDark)
    migrateLegacyLibraryAnswersIfNeeded().catch(() => {})
    requestPersistentStorage().catch(() => {})
    refreshSettings()
  }, [refreshSettings])

  // Manage monochrome archive theme vs full-colour Home in archive mode
  useEffect(() => {
    if (archiveViewingChapter) {
      if (activeTab === 'home') {
        applyThemeById(archiveViewingChapter.themeId, false, false)
      } else {
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

  const handleInspectDay = async (date: string) => {
    const chapterRepo = new ChapterRepository()
    const targetChapter =
      (await chapterRepo.getChapterForDate(date)) || (await chapterRepo.getOpenChapter())
    const isClosed =
      Boolean(archiveViewingChapter) || targetChapter?.status === 'closed'

    setInspectTarget({
      date,
      chapterId: targetChapter?.id || archiveViewingChapter?.id || '',
      lockedClosed: isClosed,
    })
  }

  const todayLogicalStr = logicalDate(new Date(), undefined, appSettings.windowEndHour)

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex justify-center">
      {/* Mobile container constraint: phone-only (max 440px wide) */}
      <div className="w-full max-w-[440px] min-h-screen bg-[var(--color-bg)] flex flex-col relative">
        <PWAUpdateBanner />

        {/* Top bar with safe area inset */}
        <header className="sticky top-0 z-20 bg-[var(--color-surface)]/90 backdrop-blur-md border-b-2 border-[var(--color-line)] px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold tracking-tight text-[var(--color-accent)]">
              Trinqle
            </span>
            {appSettings.userName && (
              <span className="text-xs font-medium text-[var(--color-ink-soft)] truncate max-w-[140px]">
                · {appSettings.userName}
              </span>
            )}
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
                onNavigateToDay={handleInspectDay}
              />
            ) : (
              <HomeScreen
                key={`home-${refreshTick}`}
                appSettings={appSettings}
                onNavigateToDay={handleInspectDay}
                onNavigateToInsights={() => setActiveTab('insights')}
              />
            ))}

          {activeTab === 'dashboard' &&
            (archiveViewingChapter ? (
              <FrozenDashboardView
                chapter={archiveViewingChapter}
                onExitArchive={handleExitArchiveMode}
              />
            ) : (
              <DashboardScreen
                key={`dash-${refreshTick}`}
                windowEndHour={appSettings.windowEndHour}
                onNavigateToProfileBrowse={handleInspectDay}
              />
            ))}

          {activeTab === 'insights' && (
            <InsightsScreen
              key={`ins-${refreshTick}`}
              frozenChapter={archiveViewingChapter || undefined}
              onExitArchive={handleExitArchiveMode}
              onNavigateToProfileBrowse={handleInspectDay}
            />
          )}

          {activeTab === 'archive' && (
            <ArchiveScreen
              key={`arch-${refreshTick}`}
              onSelectArchiveChapter={handleSelectArchiveChapter}
              onNavigateToDay={handleInspectDay}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileScreen
              archiveReadOnly={Boolean(archiveViewingChapter)}
              onExitArchive={handleExitArchiveMode}
              onInspectDate={handleInspectDay}
              onSettingsChanged={refreshSettings}
            />
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Global Day Inspector / Editor Modal */}
        {inspectTarget && (
          <NightlyFormModal
            isOpen={true}
            date={inspectTarget.date}
            chapterId={inspectTarget.chapterId}
            todayLogicalDate={todayLogicalStr}
            readOnly={true}
            lockedClosed={inspectTarget.lockedClosed}
            timeFormat={appSettings.timeFormat}
            onClose={() => setInspectTarget(null)}
            onSaved={() => {
              setInspectTarget(null)
              setRefreshTick((t) => t + 1)
            }}
          />
        )}
      </div>
    </div>
  )
}
