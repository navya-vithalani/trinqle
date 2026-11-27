import React, { useState, useEffect } from 'react'
import {
  Moon,
  Sun,
  Trash2,
  Download,
  Upload,
  AlertCircle,
  Sparkles,
  Database,
  RefreshCw,
  Sliders,
  FileText,
  User,
  ChevronRight,
  Eye,
  X,
  HardDrive,
  ShieldCheck,
  Clock,
  Bell,
  Send,
  History,
  Activity,
  AlertTriangle,
} from 'lucide-react'
import {
  isPushSupported,
  getNotificationPermission,
  loadNotificationPrefs,
  saveNotificationPrefs,
  getCurrentPushSubscription,
  subscribeDeviceToPush,
  unsubscribeDeviceFromPush,
  syncDevicePrefs,
  sendTestNotification,
  reconcilePushSubscription,
} from '../../core/notifications/client'
import type { NotificationPrefs } from '../../core/notifications/types'
import {
  themeRegistry,
  loadThemePreference,
  applyThemeById,
} from '../../themes/registry'
import {
  CHARACTERS,
  getAllCharacters,
  getCharacterOfTheMonth,
  loadCharacterPreference,
  saveCharacterPreference,
} from '../../characters/registry'
import { CharacterImportDialog } from '../dialogs/CharacterImportDialog'
import {
  BUILTIN_STICKERS,
  loadCustomStickerItems,
  saveCustomStickerFromFile,
  deleteCustomSticker,
  type StickerItem,
} from '../../core/stickers'
import { deleteAllData } from '../../data/reset'
import {
  exportCSVData,
  downloadOrShareFile,
  requestPersistentStorage,
  isStoragePersisted,
} from '../../core/export'
import {
  exportFullBackupZip,
  getBackupStatus,
  type BackupStatusInfo,
} from '../../core/fullBackup'
import { RecoveryModal } from '../components/RecoveryModal'
import { DataHealthModal } from '../components/DataHealthModal'
import { exportFormPack } from '../../data/formPack/exporter'
import { importFormPack } from '../../data/formPack/importer'
import { ImportDialog } from '../dialogs/ImportDialog'
import { FormEditorScreen } from '../editor/FormEditorScreen'
import { generateDemoData } from '../../tools/demoData'
import analyticPackRaw from '../../content/analytic-form-pack.json'
import { isDevToolsEnabled } from '../../core/devFlag'
import { db } from '../../data/db'
import { LIMITS } from '../../core/limits'
import type { FormPack } from '../../data/types'
import {
  SettingsRepository,
  ChapterRepository,
  DayRepository,
} from '../../data/repositories'
import type { Chapter, Day } from '../../data/types'

interface ProfileScreenProps {
  archiveReadOnly?: boolean
  onExitArchive?: () => void
  onInspectDate?: (date: string) => void
  onSettingsChanged?: () => void
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  archiveReadOnly = false,
  onExitArchive,
  onInspectDate,
  onSettingsChanged,
}) => {
  const [selectedThemeId, setSelectedThemeId] = useState('cutesy')
  const [isDark, setIsDark] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState('white-cat')

  // Core user settings (Item 28)
  const [userName, setUserName] = useState('')
  const [formWindowStart, setFormWindowStart] = useState('21:00')
  const [formWindowEnd, setFormWindowEnd] = useState('03:00')
  const [weekStart, setWeekStart] = useState<'Monday' | 'Sunday'>('Monday')
  const [timeFormat, setTimeFormat] = useState<'12-hour' | '24-hour'>('12-hour')

  // Open chapter forms browsing state (Items 2, 3, 4, 5)
  const [openChapter, setOpenChapter] = useState<Chapter | null>(null)
  const [openChapterDays, setOpenChapterDays] = useState<Day[]>([])
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false)

  // Other modals
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isCharacterImportOpen, setIsCharacterImportOpen] = useState(false)
  const [customStickers, setCustomStickers] = useState<StickerItem[]>([])
  const [isFormEditorOpen, setIsFormEditorOpen] = useState(false)
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false)
  const [demoSeedInput, setDemoSeedInput] = useState('')
  const [demoAlert, setDemoAlert] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isPersisted, setIsPersisted] = useState(false)
  const [backupStatus, setBackupStatus] = useState<BackupStatusInfo | null>(null)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
  const [isHealthCheckOpen, setIsHealthCheckOpen] = useState(false)

  // Notification state (TRD Section 10 / PRD Section 5.9)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [isPushSubscribed, setIsPushSubscribed] = useState(false)
  const [pushPrefs, setPushPrefs] = useState<NotificationPrefs>(loadNotificationPrefs())
  const [isPushLoading, setIsPushLoading] = useState(false)
  const [isTestingPush, setIsTestingPush] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  const settingsRepo = new SettingsRepository()
  const chapterRepo = new ChapterRepository()
  const dayRepo = new DayRepository()

  useEffect(() => {
    const { themeId, isDark: dark } = loadThemePreference()
    setSelectedThemeId(themeId)
    setIsDark(dark)
    setSelectedCharacterId(loadCharacterPreference())
    loadProfileData()
  }, [])

  // Load saved settings & open chapter days
  const loadProfileData = async () => {
    const savedName = await settingsRepo.getSetting<string>('user_name', '')
    const savedStart = await settingsRepo.getSetting<string>('form_window_start', '21:00')
    const savedEnd = await settingsRepo.getSetting<string>('form_window_end', '03:00')
    const savedWeek = await settingsRepo.getSetting<'Monday' | 'Sunday'>('week_start', 'Monday')
    const savedTimeFmt = await settingsRepo.getSetting<'12-hour' | '24-hour'>('time_format', '12-hour')

    setUserName(savedName || '')
    setFormWindowStart(savedStart || '21:00')
    setFormWindowEnd(savedEnd || '03:00')
    setWeekStart(savedWeek || 'Monday')
    setTimeFormat(savedTimeFmt || '12-hour')

    const ch = await chapterRepo.getOpenChapter()
    setOpenChapter(ch || null)
    if (ch) {
      const days = await dayRepo.getDaysInDateRange(ch.startDate, ch.plannedEndDate)
      setOpenChapterDays(days.filter((d) => !d.deletedAt))
    }

    const persisted = await isStoragePersisted()
    setIsPersisted(persisted)

    loadCustomStickerItems().then(setCustomStickers).catch(() => {})

    // Load Push Notification state & reconcile if VAPID key rotated
    const supported = isPushSupported()
    setPushSupported(supported)
    setPushPermission(getNotificationPermission())
    const loadedPrefs = {
      ...loadNotificationPrefs(),
      ...(ch?.plannedEndDate ? { chapterPlannedEndDate: ch.plannedEndDate } : {}),
    }
    setPushPrefs(loadedPrefs)
    if (supported) {
      getCurrentPushSubscription().then(async (sub) => {
        if (!sub) {
          setIsPushSubscribed(false)
          return
        }
        const ok = await reconcilePushSubscription()
        setIsPushSubscribed(ok || Boolean(await getCurrentPushSubscription()))
      })
    }

    const status = await getBackupStatus(db)
    setBackupStatus(status)
  }

  const handleBackupNow = async () => {
    setIsBackingUp(true)
    try {
      const { filename, blob } = await exportFullBackupZip(db)
      const outcome = await downloadOrShareFile(filename, blob)
      if (outcome === 'cancelled') {
        showToast('Backup share cancelled')
        return
      }
      await settingsRepo.setSetting('last_backup_timestamp', Date.now())
      setBackupStatus(await getBackupStatus(db))
      showToast('Verified full backup created successfully')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to create backup')
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const { wideCSV, sessionsCSV } = await exportCSVData()
      const wideBlob = new Blob([wideCSV], { type: 'text/csv' })
      const a1 = document.createElement('a')
      a1.href = URL.createObjectURL(wideBlob)
      a1.download = 'trinqle-daily-table.csv'
      a1.click()
      URL.revokeObjectURL(a1.href)

      const sessionsBlob = new Blob([sessionsCSV], { type: 'text/csv' })
      const a2 = document.createElement('a')
      a2.href = URL.createObjectURL(sessionsBlob)
      a2.download = 'trinqle-sessions.csv'
      a2.click()
      URL.revokeObjectURL(a2.href)

      showToast('Exported daily & session CSV tables')
    } catch {
      showToast('Failed to export CSV')
    }
  }

  const handleRequestPersistence = async () => {
    const ok = await requestPersistentStorage()
    setIsPersisted(ok)
    if (ok) showToast('Persistent storage granted by browser')
    else showToast('Storage permission prompt closed')
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSaveUserName = async (name: string) => {
    setUserName(name)
    await settingsRepo.setSetting('user_name', name.trim())
    onSettingsChanged?.()
  }

  const handleSaveFormWindow = async (start: string, end: string) => {
    setFormWindowStart(start)
    setFormWindowEnd(end)
    await settingsRepo.setSetting('form_window_start', start)
    await settingsRepo.setSetting('form_window_end', end)
    showToast('Form window updated')
    onSettingsChanged?.()
  }

  const handleSaveWeekStart = async (val: 'Monday' | 'Sunday') => {
    setWeekStart(val)
    await settingsRepo.setSetting('week_start', val)
    showToast(`Week start set to ${val}`)
    onSettingsChanged?.()
  }

  const handleSaveTimeFormat = async (fmt: '12-hour' | '24-hour') => {
    setTimeFormat(fmt)
    await settingsRepo.setSetting('time_format', fmt)
    showToast(`Time format set to ${fmt}`)
    onSettingsChanged?.()
  }

  const handleThemeChange = (themeId: string) => {
    setSelectedThemeId(themeId)
    applyThemeById(themeId, isDark)
    showToast(`Switched theme to ${themeRegistry[themeId].name}`)
  }

  const handleDarkToggle = (dark: boolean) => {
    setIsDark(dark)
    applyThemeById(selectedThemeId, dark)
  }

  const handleCharacterChange = (charId: string) => {
    setSelectedCharacterId(charId)
    saveCharacterPreference(charId)
    const char = CHARACTERS.find((c) => c.id === charId)
    showToast(`Selected character: ${char?.name || charId}`)
  }

  // Push Notification handlers (TRD Section 10)
  const handleToggleMasterPush = async () => {
    if (!pushSupported) {
      const msg = 'Push notifications are not supported in this browser'
      setPushError(msg)
      showToast(msg)
      return
    }
    setPushError(null)
    setIsPushLoading(true)
    try {
      if (isPushSubscribed) {
        await unsubscribeDeviceFromPush()
        setIsPushSubscribed(false)
        showToast('Notifications disabled')
      } else {
        const res = await subscribeDeviceToPush(undefined, {
          ...pushPrefs,
          chapterPlannedEndDate: openChapter?.plannedEndDate,
        })
        if (res.success) {
          setIsPushSubscribed(true)
          setPushPermission(getNotificationPermission())
          showToast('Daily reminders enabled')
        } else {
          const msg = res.error || 'Failed to enable notifications'
          setPushError(msg)
          showToast(msg)
          setPushPermission(getNotificationPermission())
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating notification settings'
      setPushError(msg)
      showToast(msg)
    } finally {
      setIsPushLoading(false)
    }
  }

  const handleUpdatePrefs = async (patch: Partial<NotificationPrefs>) => {
    setPushError(null)
    const updated: NotificationPrefs = {
      ...pushPrefs,
      ...patch,
      chapterPlannedEndDate: openChapter?.plannedEndDate ?? pushPrefs.chapterPlannedEndDate,
    }
    setPushPrefs(updated)
    saveNotificationPrefs(updated)
    if (isPushSubscribed) {
      const syncRes = await syncDevicePrefs(updated)
      if (!syncRes.success) {
        const msg = syncRes.error || 'Failed to sync reminder preferences'
        setPushError(msg)
        showToast(msg)
      }
    }
  }

  const handleSendTest = async () => {
    setPushError(null)
    setIsTestingPush(true)
    try {
      const res = await sendTestNotification()
      if (res.success) {
        showToast('Test notification sent!')
      } else {
        const msg = res.error || 'Could not send test notification'
        setPushError(msg)
        showToast(msg)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send test notification'
      setPushError(msg)
      showToast(msg)
    } finally {
      setIsTestingPush(false)
    }
  }

  const handleExportFormPack = async () => {
    try {
      const pack = await exportFormPack()
      const json = JSON.stringify(pack, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'trinqle-form-pack.json'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Form pack exported!')
    } catch {
      showToast('Failed to export form pack')
    }
  }

  const handleGenerateDemoData = async () => {
    setIsGeneratingDemo(true)
    setDemoAlert(null)
    try {
      const parsedSeed = demoSeedInput.trim() ? Number(demoSeedInput.trim()) : undefined
      const stats = await generateDemoData(db, {
        seed: parsedSeed && Number.isFinite(parsedSeed) ? parsedSeed : undefined,
      })
      showToast(
        `Seeded ${stats.chaptersCount} chapters, ${stats.daysCount} days, ${stats.cyclesCount} cycles (seed ${stats.seed})!`
      )
      setTimeout(() => window.location.reload(), 1200)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate demo data'
      setDemoAlert(msg)
      showToast(msg)
    } finally {
      setIsGeneratingDemo(false)
    }
  }

  const handleLoadAnalyticPack = async () => {
    setDemoAlert(null)
    try {
      await importFormPack(analyticPackRaw as unknown as FormPack, 'replace', db)
      showToast('Loaded Analytic Habits & Metrics pack')
      loadProfileData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytic pack'
      setDemoAlert(msg)
      showToast(msg)
    }
  }

  const handleDeleteAll = async () => {
    try {
      await deleteAllData(deleteConfirmation)
      setIsDeleteModalOpen(false)
      setDeleteConfirmation('')
      showToast('All data erased successfully')
      setTimeout(() => window.location.reload(), 1000)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error deleting data')
    }
  }

  return (
    <div className="space-y-4 pb-20">
      {archiveReadOnly && (
        <div className="sticker-card p-4 border-2 border-[var(--color-line)] flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="font-bold text-[var(--color-ink)] block">
              Archive Mode (Read-Only)
            </span>
            <span className="text-[11px] text-[var(--color-ink-soft)]">
              Settings, form editing, and data deletion are locked while viewing a closed chapter.
            </span>
          </div>
          {onExitArchive && (
            <button
              type="button"
              onClick={onExitArchive}
              className="px-3 py-1.5 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold shrink-0"
            >
              Exit Archive
            </button>
          )}
        </div>
      )}

      <fieldset disabled={archiveReadOnly} className={archiveReadOnly ? 'opacity-60 pointer-events-none space-y-4' : 'space-y-4'}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-ink)] text-white text-xs font-semibold py-1.5 px-4 rounded-full shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* SECTION 1: CORE JOURNAL SETTINGS (Item 28) */}
      <div className="sticker-card p-4 space-y-3.5">
        <div className="flex items-center space-x-2 pb-1 border-b border-[var(--color-line)]">
          <User size={18} className="text-[var(--color-accent)]" />
          <h2 className="text-base font-bold text-[var(--color-ink)]">Core Settings</h2>
        </div>

        {/* User Name / Display Name (Item 28) */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[var(--color-ink)] block">
            Your Name / Display Name
          </label>
          <input
            type="text"
            maxLength={LIMITS.USER_NAME}
            placeholder="Add your name..."
            value={userName}
            onChange={(e) => handleSaveUserName(e.target.value)}
            className="w-full p-2.5 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] font-semibold text-xs text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Editable Form Window (Item 28) */}
        <div className="space-y-1 pt-1">
          <label className="text-xs font-bold text-[var(--color-ink)] block">
            Nightly Form Window
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-[var(--color-ink-soft)] block">Opens at</span>
              <input
                type="time"
                value={formWindowStart}
                onChange={(e) => handleSaveFormWindow(e.target.value, formWindowEnd)}
                className="w-full p-2 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] text-center"
              />
            </div>
            <div>
              <span className="text-[10px] text-[var(--color-ink-soft)] block">Closes at</span>
              <input
                type="time"
                value={formWindowEnd}
                onChange={(e) => handleSaveFormWindow(formWindowStart, e.target.value)}
                className="w-full p-2 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] text-center"
              />
            </div>
          </div>
        </div>

        {/* Editable Week Start (Item 28) */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-xs font-bold text-[var(--color-ink)] block">Week Starts On</span>
            <span className="text-[10px] text-[var(--color-ink-soft)]">
              Used in heatmap and weekly review prompt
            </span>
          </div>
          <div className="flex items-center space-x-1">
            {(['Monday', 'Sunday'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => handleSaveWeekStart(w)}
                className={`py-1 px-3 rounded-[var(--radius-pill)] text-[11px] font-bold transition-all ${
                  weekStart === w
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Editable Time Format (Item 28) */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-xs font-bold text-[var(--color-ink)] block">Time Format</span>
            <span className="text-[10px] text-[var(--color-ink-soft)]">
              Display format for clock fields and dials
            </span>
          </div>
          <div className="flex items-center space-x-1">
            {(['12-hour', '24-hour'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => handleSaveTimeFormat(fmt)}
                className={`py-1 px-3 rounded-[var(--radius-pill)] text-[11px] font-bold transition-all ${
                  timeFormat === fmt
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION: NOTIFICATIONS & REMINDERS (TRD Section 10) */}
      <div className="sticker-card p-4 space-y-3.5">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--color-line)]">
          <div className="flex items-center space-x-2">
            <Bell size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-base font-bold text-[var(--color-ink)]">Notifications</h2>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              !pushSupported
                ? 'bg-zinc-100 text-zinc-600'
                : pushPermission === 'denied'
                ? 'bg-red-100 text-red-700'
                : isPushSubscribed
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {!pushSupported
              ? 'Not supported'
              : pushPermission === 'denied'
              ? 'Blocked'
              : isPushSubscribed
              ? 'Active'
              : 'Disabled'}
          </span>
        </div>

        <p className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
          Daily gentle reminders at night, weekly insights notices, and chapter wraps. Payloads are strictly generic; zero journal content ever leaves your device.
        </p>

        {pushError && (
          <div
            role="alert"
            className="rounded-xl border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 px-3 py-2 text-[11px] leading-relaxed text-[var(--color-danger)] break-words"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-bold block">Push notification error</span>
                <span>{pushError}</span>
              </div>
              <button
                type="button"
                onClick={() => setPushError(null)}
                className="text-[10px] font-bold uppercase tracking-wider opacity-80 hover:opacity-100 shrink-0"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Master Push Toggle */}
        <div className="flex items-center justify-between pt-1">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--color-ink)] block">
              Enable Push Notifications
            </span>
            <span className="text-[10px] text-[var(--color-ink-soft)] block">
              {isPushSubscribed
                ? 'Notifications are active on this device'
                : 'Turn on to receive reminders and alerts'}
            </span>
          </div>
          <button
            type="button"
            disabled={!pushSupported || isPushLoading}
            onClick={handleToggleMasterPush}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 ${
              isPushSubscribed ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                isPushSubscribed ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {isPushSubscribed && (
          <div className="space-y-3 pt-2 border-t border-[var(--color-line)]">
            {/* Daily Reminder Toggle & Time */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[var(--color-ink)] block">
                    Daily Journal Reminder
                  </span>
                  <span className="text-[10px] text-[var(--color-ink-soft)]">
                    Nightly nudge when tonight's journal opens
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdatePrefs({ dailyReminder: !pushPrefs.dailyReminder })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    pushPrefs.dailyReminder ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      pushPrefs.dailyReminder ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {pushPrefs.dailyReminder && (
                <div className="flex items-center justify-between pl-2 border-l-2 border-[var(--color-line)]">
                  <span className="text-[11px] text-[var(--color-ink-soft)]">Reminder Time</span>
                  <input
                    type="time"
                    value={pushPrefs.dailyReminderTime || '21:00'}
                    onChange={(e) => handleUpdatePrefs({ dailyReminderTime: e.target.value })}
                    className="w-24 p-1.5 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] text-center"
                  />
                </div>
              )}
            </div>

            {/* Monday Morning Insights */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--color-ink)] block">
                  Monday Morning Insights
                </span>
                <span className="text-[10px] text-[var(--color-ink-soft)]">
                  Weekly summary reminder on Mondays at 9:00 AM
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleUpdatePrefs({ mondayInsights: !pushPrefs.mondayInsights })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  pushPrefs.mondayInsights ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    pushPrefs.mondayInsights ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Chapter Ending Alert */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--color-ink)] block">
                  Chapter Ending Alert
                </span>
                <span className="text-[10px] text-[var(--color-ink-soft)]">
                  Reminder 2 days before the scheduled chapter wrap-up date
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleUpdatePrefs({ chapterEnding: !pushPrefs.chapterEnding })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  pushPrefs.chapterEnding ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    pushPrefs.chapterEnding ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Send Test Notification Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isTestingPush}
                onClick={handleSendTest}
                className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-[var(--radius-pill)] border border-[var(--color-line)] bg-[var(--color-bg)] hover:border-[var(--color-accent)] text-xs font-semibold text-[var(--color-ink)] active:scale-95 transition-all disabled:opacity-50"
              >
                <Send size={13} className="text-[var(--color-accent)]" />
                <span>{isTestingPush ? 'Sending test notification...' : 'Send test notification'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: YOUR FORM (Items 2, 3, 4, 5) */}
      <div className="sticker-card p-4 space-y-3">
        <div className="flex items-center space-x-2 pb-1 border-b border-[var(--color-line)]">
          <FileText size={18} className="text-[var(--color-accent)]" />
          <h2 className="text-base font-bold text-[var(--color-ink)]">Your Form</h2>
        </div>
        <p className="text-xs text-[var(--color-ink-soft)]">
          Manage questions and customize parts, or browse past submitted forms from the currently open chapter.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Action A: Form Editor */}
          <button
            type="button"
            onClick={() => setIsFormEditorOpen(true)}
            className="flex flex-col items-center justify-center p-3 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] hover:border-[var(--color-accent)] active:scale-95 transition-all text-center space-y-1"
          >
            <Sliders size={18} className="text-[var(--color-accent)]" />
            <span className="text-xs font-bold text-[var(--color-ink)]">Form Editor</span>
            <span className="text-[9px] text-[var(--color-ink-soft)]">
              Customize questions & parts
            </span>
          </button>

          {/* Action B: Browse Current Chapter Forms (Item 2 & 3) */}
          <button
            type="button"
            onClick={() => setIsBrowseModalOpen(true)}
            className="flex flex-col items-center justify-center p-3 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] hover:border-[var(--color-accent)] active:scale-95 transition-all text-center space-y-1"
          >
            <Eye size={18} className="text-[var(--color-accent2)]" />
            <span className="text-xs font-bold text-[var(--color-ink)]">Browse Chapter Forms</span>
            <span className="text-[9px] text-[var(--color-ink-soft)]">
              {openChapterDays.length} submitted entries
            </span>
          </button>
        </div>
      </div>

      {/* SECTION 3: APPEARANCE & PERSONA */}
      <div className="sticker-card p-4 space-y-3">
        <h2 className="text-base font-bold text-[var(--color-ink)]">Appearance</h2>
        <p className="text-xs text-[var(--color-ink-soft)]">
          Theme and mode selections persist across reload. No emojis are used anywhere.
        </p>

        {/* Light / Dark selector */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleDarkToggle(false)}
            className={`flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-[var(--radius-pill)] border-2 text-xs font-semibold transition-all ${
              !isDark
                ? 'border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs font-bold'
                : 'border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-soft)]'
            }`}
          >
            <Sun size={16} />
            <span>Light mode</span>
          </button>

          <button
            type="button"
            onClick={() => handleDarkToggle(true)}
            className={`flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-[var(--radius-pill)] border-2 text-xs font-semibold transition-all ${
              isDark
                ? 'border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs font-bold'
                : 'border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-soft)]'
            }`}
          >
            <Moon size={16} />
            <span>Dark mode</span>
          </button>
        </div>

        {/* Visual Themes Grid */}
        <div className="space-y-1.5 pt-2 border-t border-[var(--color-line)]">
          <span className="text-xs font-semibold text-[var(--color-ink)] block">
            Visual Theme
          </span>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(themeRegistry).map((t) => {
              const isSelected = selectedThemeId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleThemeChange(t.id)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-[var(--radius-m)] border-2 transition-all ${
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-bg)] text-[var(--color-accent)] font-bold shadow-xs'
                      : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink-soft)]'
                  }`}
                >
                  <Sparkles size={16} className="mb-1 text-[var(--color-accent)]" />
                  <span className="text-xs">{t.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Character Selection */}
      <div className="sticker-card p-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--color-line)]">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-[var(--color-ink)]">Character persona</h2>
            <p className="text-[11px] text-[var(--color-ink-soft)]">
              Choose your companion. Multi-view characters support dynamic front & side animations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCharacterImportOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[10px] font-bold text-[var(--color-accent)] hover:border-[var(--color-accent)] active:scale-95 transition-all shrink-0"
          >
            <Upload size={12} />
            <span>Import SVG</span>
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
          {getAllCharacters().map((char) => {
            const isSelected = selectedCharacterId === char.id
            const isFeatured = getCharacterOfTheMonth().id === char.id
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => handleCharacterChange(char.id)}
                className={`flex flex-col items-center p-2.5 rounded-[var(--radius-m)] border-2 transition-all relative ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-bg)] shadow-xs font-bold'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-ink-soft)]'
                }`}
              >
                {isFeatured && (
                  <span className="absolute -top-1.5 -right-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[8px] font-extrabold uppercase tracking-tight shadow-xs">
                    Featured
                  </span>
                )}
                {char.hasMultiView && (
                  <span className="absolute -top-1.5 -left-1 px-1.5 py-0.2 rounded-full bg-[var(--color-accent)] text-white text-[8px] font-extrabold uppercase tracking-tight shadow-xs">
                    2 Views
                  </span>
                )}
                <img src={char.svg} alt={char.name} className="w-12 h-12 object-contain mb-1.5" />
                <span className="text-xs font-semibold text-[var(--color-ink)] text-center line-clamp-1">
                  {char.name}
                </span>
                <span className="text-[9px] text-[var(--color-ink-soft)] text-center">
                  {char.hasMultiView ? 'Front + Side' : `${char.limbs} limbs`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Stickers Library Card */}
      <div className="sticker-card p-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--color-line)]">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-[var(--color-ink)]">Stickers</h2>
            <p className="text-[11px] text-[var(--color-ink-soft)]">
              12 built-in SVG stickers + custom SVG or raster uploads (auto-resized to 256px)
            </p>
          </div>
          <label className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[10px] font-bold text-[var(--color-accent)] hover:border-[var(--color-accent)] active:scale-95 transition-all shrink-0 cursor-pointer">
            <Upload size={12} />
            <span>Add Sticker</span>
            <input
              type="file"
              accept=".svg,image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  const created = await saveCustomStickerFromFile(file)
                  setCustomStickers((prev) => [...prev, created])
                  showToast(`Added sticker "${created.name}"`)
                } catch (err: unknown) {
                  showToast(err instanceof Error ? err.message : 'Invalid sticker file')
                }
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
          {BUILTIN_STICKERS.map((st) => (
            <div
              key={st.id}
              className="flex flex-col items-center p-2 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-bg)]/50"
            >
              <img src={st.url} alt={st.name} className="w-8 h-8 object-contain" />
              <span className="text-[9px] text-[var(--color-ink-soft)] mt-1 truncate max-w-full">
                {st.name}
              </span>
            </div>
          ))}
          {customStickers.map((st) => (
            <div
              key={st.id}
              className="flex flex-col items-center p-2 rounded-[var(--radius-m)] border-2 border-[var(--color-accent)]/40 bg-[var(--color-bg)] relative group"
            >
              <button
                type="button"
                onClick={async () => {
                  await deleteCustomSticker(st.id)
                  setCustomStickers((prev) => prev.filter((item) => item.id !== st.id))
                  showToast('Custom sticker removed')
                }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-85 hover:opacity-100"
                title="Remove custom sticker"
              >
                <X size={10} />
              </button>
              <img src={st.url} alt={st.name} className="w-8 h-8 object-contain" />
              <span className="text-[9px] font-semibold text-[var(--color-ink)] mt-1 truncate max-w-full">
                {st.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: DATA & BACKUP TOOLS */}
      <div className="sticker-card p-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--color-line)] gap-2">
          <div className="flex items-center space-x-2">
            <HardDrive size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-base font-bold text-[var(--color-ink)]">Backup & Data Export</h2>
          </div>
          <span className="text-[10px] text-[var(--color-ink-soft)] flex items-center gap-1 text-right">
            <Clock size={11} className="shrink-0" />
            {backupStatus?.lastBackupDate
              ? `Last backup: ${backupStatus.lastBackupDate}, ${backupStatus.nightsSinceBackup} night${backupStatus.nightsSinceBackup === 1 ? '' : 's'} since`
              : `Never backed up (${backupStatus?.totalActiveDays ?? 0} nights)`}
          </span>
        </div>

        {/* Weekly Backup Nudge (B3) */}
        {backupStatus?.shouldNudge && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                <AlertCircle size={13} /> Backup Recommended
              </span>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {backupStatus.lastBackupDate
                  ? `${backupStatus.daysSinceBackup ?? 0} day(s) and ${backupStatus.nightsSinceBackup} night(s) since your last verified full backup.`
                  : 'Create a full backup ZIP so your chapters, photos, and insights are safe off-device.'}
              </p>
            </div>
            <button
              type="button"
              disabled={isBackingUp}
              onClick={handleBackupNow}
              className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold shrink-0 hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {isBackingUp ? 'Verifying...' : 'Back up now'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={isBackingUp}
            onClick={handleBackupNow}
            className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-accent)] bg-[var(--color-bg)] text-xs font-bold text-[var(--color-accent)] active:scale-95 transition-all disabled:opacity-50"
          >
            <Download size={14} />
            <span>{isBackingUp ? 'Verifying...' : 'Full backup'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] active:scale-95 transition-all"
          >
            <FileText size={14} className="text-[var(--color-accent2)]" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] active:scale-95 transition-all"
          >
            <Upload size={14} className="text-[var(--color-accent)]" />
            <span>Restore / Import</span>
          </button>

          <button
            type="button"
            onClick={handleExportFormPack}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] active:scale-95 transition-all"
          >
            <Download size={14} className="text-[var(--color-accent2)]" />
            <span>Export pack</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRecoveryOpen(true)}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] active:scale-95 transition-all"
          >
            <History size={14} className="text-[var(--color-accent)]" />
            <span>Recovery</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHealthCheckOpen(true)}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] active:scale-95 transition-all"
          >
            <Activity size={14} className="text-[var(--color-accent2)]" />
            <span>Health check</span>
          </button>
        </div>

        {/* Persistent Storage Status (B1) */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs pt-2 ${
            isPersisted
              ? 'bg-emerald-500/5 border-emerald-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {isPersisted ? (
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            )}
            <div>
              <span className="font-bold text-[var(--color-ink)] block">
                {isPersisted ? 'Storage: Protected' : 'Storage: Not protected'}
              </span>
              <span className="text-[10px] text-[var(--color-ink-soft)]">
                {isPersisted
                  ? 'Browser granted persistent storage to protect your diary from eviction.'
                  : 'Browser refused or has not granted persistent storage; export backups regularly.'}
              </span>
            </div>
          </div>
          {!isPersisted && (
            <button
              type="button"
              onClick={handleRequestPersistence}
              className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold hover:opacity-90 transition-opacity shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Developer / Demo Data Tools (1E: Gated behind dev flag) */}
      {isDevToolsEnabled() && (
        <div className="sticker-card p-4 space-y-3 border-indigo-200 bg-indigo-50/25">
          <div className="flex items-center space-x-2 text-xs font-bold text-indigo-900">
            <Database size={16} className="text-indigo-600" />
            <span>Demo Data Generator (Dev)</span>
          </div>
          <p className="text-xs text-[var(--color-ink-soft)]">
            Form-driven generator: reads the currently configured form to seed 2 closed chapters with frozen insights & photos, 1 open chapter, cycles, and planted effects.
          </p>
          {demoAlert && (
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{demoAlert}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={demoSeedInput}
              onChange={(e) => setDemoSeedInput(e.target.value)}
              placeholder="Random seed (optional)"
              className="flex-1 p-2 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-surface)] text-xs text-[var(--color-ink)]"
            />
            <button
              type="button"
              onClick={handleLoadAnalyticPack}
              className="py-2 px-3 rounded-[var(--radius-pill)] border border-indigo-300 bg-white text-indigo-700 font-semibold text-xs active:scale-95 shrink-0"
            >
              Load Analytic Form
            </button>
          </div>
          <button
            type="button"
            disabled={isGeneratingDemo}
            onClick={handleGenerateDemoData}
            className="w-full py-2.5 px-4 rounded-[var(--radius-pill)] bg-indigo-600 text-white font-bold text-xs sticker-button flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-95"
          >
            <RefreshCw size={14} className={isGeneratingDemo ? 'animate-spin' : ''} />
            <span>{isGeneratingDemo ? 'Seeding Data...' : 'Generate Demo Data (Current Form)'}</span>
          </button>
        </div>
      )}

      {/* Danger Zone */}
      <div className="sticker-card p-4 space-y-3 border-red-200 bg-red-50/30">
        <div className="flex items-center space-x-2 text-xs font-bold text-red-700">
          <Trash2 size={16} />
          <span>Danger zone</span>
        </div>
        <p className="text-[11px] text-[var(--color-ink-soft)]">
          Irreversibly delete all diary entries, chapters, custom libraries, and settings.
        </p>
        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="w-full py-2 rounded-[var(--radius-pill)] border border-red-300 bg-red-100 text-red-700 font-semibold text-xs active:scale-95"
        >
          Delete all data
        </button>
      </div>

      {/* BROWSE CURRENT CHAPTER FORMS MODAL (Items 2, 3, 4, 5) */}
      {isBrowseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[var(--color-surface)] w-full max-w-sm rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl p-4 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2.5">
              <div className="flex items-center space-x-2">
                <FileText size={16} className="text-[var(--color-accent)]" />
                <h3 className="font-bold text-sm text-[var(--color-ink)]">
                  Browse Current Chapter Forms
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBrowseModalOpen(false)}
                className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-90"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[var(--color-ink-soft)]">
              Showing submitted entries from current open chapter only. Entries open in locked Browse Mode by default.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {openChapterDays.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--color-ink-soft)] border-2 border-dashed border-[var(--color-line)] rounded-[var(--radius-m)]">
                  No forms submitted in the current chapter yet.
                </div>
              ) : (
                openChapterDays
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => {
                        setIsBrowseModalOpen(false)
                        onInspectDate?.(d.date)
                      }}
                      className="w-full p-2.5 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] flex items-center justify-between text-left hover:border-[var(--color-accent)] active:scale-95 transition-all"
                    >
                      <div>
                        <span className="font-bold text-xs text-[var(--color-ink)] block">
                          {d.date}
                        </span>
                        <span className="text-[11px] text-[var(--color-ink-soft)] truncate block max-w-[200px]">
                          {d.title || d.oneliner || 'No headline recorded'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {d.editedAt && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-accent2)]/20 text-[var(--color-accent2)] font-bold">
                            Edited
                          </span>
                        )}
                        <ChevronRight size={14} className="text-[var(--color-ink-soft)]" />
                      </div>
                    </button>
                  ))
              )}
            </div>

            <div className="pt-2 border-t border-[var(--color-line)]">
              <button
                type="button"
                onClick={() => setIsBrowseModalOpen(false)}
                className="w-full py-2 rounded-[var(--radius-pill)] bg-[var(--color-ink)] text-white font-bold text-xs active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] p-5 space-y-4 shadow-xl">
            <div className="flex items-center space-x-2 text-red-600 font-bold text-sm">
              <AlertCircle size={20} />
              <span>Are you absolutely sure?</span>
            </div>
            <p className="text-xs text-[var(--color-ink-soft)]">
              This will completely wipe your local database. Type <strong className="text-red-600">DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              placeholder="Type DELETE"
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="w-full text-xs p-2 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] font-bold text-[var(--color-ink)] focus:outline-none focus:border-red-500"
            />
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setDeleteConfirmation('')
                }}
                className="flex-1 py-2 rounded-[var(--radius-pill)] border border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmation !== 'DELETE'}
                onClick={handleDeleteAll}
                className="flex-1 py-2 rounded-[var(--radius-pill)] bg-red-600 text-white text-xs font-bold disabled:opacity-40"
              >
                Erase forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {isImportOpen && (
        <ImportDialog
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={() => showToast('Imported successfully!')}
        />
      )}

      {/* Form Editor Screen */}
      {isFormEditorOpen && (
        <FormEditorScreen
          isOpen={isFormEditorOpen}
          onClose={() => setIsFormEditorOpen(false)}
        />
      )}

      {/* Character Import Dialog */}
      {isCharacterImportOpen && (
        <CharacterImportDialog
          isOpen={isCharacterImportOpen}
          onClose={() => setIsCharacterImportOpen(false)}
          onSuccess={(newId) => {
            handleCharacterChange(newId)
            showToast('Custom character imported and active!')
          }}
        />
      )}

      {/* Safety Snapshot Recovery Modal (B5) */}
      <RecoveryModal
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
        onRestored={(msg) => showToast(msg)}
      />

      {/* Data Health Check Modal (B7) */}
      <DataHealthModal
        isOpen={isHealthCheckOpen}
        onClose={() => setIsHealthCheckOpen(false)}
        onOpenMissingDay={(date) => onInspectDate?.(date)}
        onFixed={(msg) => showToast(msg)}
      />
      </fieldset>
    </div>
  )
}
