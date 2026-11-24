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
} from 'lucide-react'
import {
  themeRegistry,
  loadThemePreference,
  applyThemeById,
} from '../../themes/registry'
import {
  CHARACTERS,
  loadCharacterPreference,
  saveCharacterPreference,
} from '../../characters/registry'
import { deleteAllData } from '../../data/reset'
import { exportFormPack } from '../../data/formPack/exporter'
import { ImportDialog } from '../dialogs/ImportDialog'
import { FormEditorScreen } from '../editor/FormEditorScreen'
import { NightlyFormModal } from '../form/NightlyFormModal'
import { generateDemoData } from '../../tools/demoData'
import { db } from '../../data/db'
import { logicalDate, DEFAULT_WINDOW } from '../../core/logicalDay'
import {
  SettingsRepository,
  ChapterRepository,
  DayRepository,
} from '../../data/repositories'
import type { Chapter, Day } from '../../data/types'

export const ProfileScreen: React.FC = () => {
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
  const [inspectDate, setInspectDate] = useState<string | null>(null)

  // Other modals
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isFormEditorOpen, setIsFormEditorOpen] = useState(false)
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

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
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSaveUserName = async (name: string) => {
    setUserName(name)
    await settingsRepo.setSetting('user_name', name.trim())
  }

  const handleSaveFormWindow = async (start: string, end: string) => {
    setFormWindowStart(start)
    setFormWindowEnd(end)
    await settingsRepo.setSetting('form_window_start', start)
    await settingsRepo.setSetting('form_window_end', end)
    showToast('Form window updated')
  }

  const handleSaveWeekStart = async (val: 'Monday' | 'Sunday') => {
    setWeekStart(val)
    await settingsRepo.setSetting('week_start', val)
    showToast(`Week start set to ${val}`)
  }

  const handleSaveTimeFormat = async (fmt: '12-hour' | '24-hour') => {
    setTimeFormat(fmt)
    await settingsRepo.setSetting('time_format', fmt)
    showToast(`Time format set to ${fmt}`)
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
    try {
      const stats = await generateDemoData(db)
      showToast(
        `Generated ${stats.chaptersCount} chapters, ${stats.daysCount} days, ${stats.cyclesCount} cycles!`
      )
      setTimeout(() => window.location.reload(), 1200)
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate demo data')
    } finally {
      setIsGeneratingDemo(false)
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
        <h2 className="text-base font-bold text-[var(--color-ink)]">Character persona</h2>
        <p className="text-xs text-[var(--color-ink-soft)]">
          Piqsie's visual look changes; the persona and friendly presence stay identical.
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {CHARACTERS.map((char) => {
            const isSelected = selectedCharacterId === char.id
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => handleCharacterChange(char.id)}
                className={`flex flex-col items-center p-2.5 rounded-[var(--radius-m)] border-2 transition-all ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-bg)] shadow-xs font-bold'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-ink-soft)]'
                }`}
              >
                <img src={char.svg} alt={char.name} className="w-12 h-12 object-contain mb-1.5" />
                <span className="text-xs font-semibold text-[var(--color-ink)] text-center line-clamp-1">
                  {char.name}
                </span>
                <span className="text-[9px] text-[var(--color-ink-soft)] text-center">
                  {char.limbs} limbs
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* SECTION 4: DATA & BACKUP TOOLS */}
      <div className="sticker-card p-4 space-y-3">
        <h2 className="text-base font-bold text-[var(--color-ink)]">Backup & Form Pack</h2>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] active:scale-95"
          >
            <Upload size={14} className="text-[var(--color-accent)]" />
            <span>Import pack</span>
          </button>

          <button
            type="button"
            onClick={handleExportFormPack}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] active:scale-95"
          >
            <Download size={14} className="text-[var(--color-accent2)]" />
            <span>Export pack</span>
          </button>
        </div>
      </div>

      {/* Developer / Demo Data Tools */}
      <div className="sticker-card p-4 space-y-3 border-indigo-200 bg-indigo-50/25">
        <div className="flex items-center space-x-2 text-xs font-bold text-indigo-900">
          <Database size={16} className="text-indigo-600" />
          <span>Demo Data Generator</span>
        </div>
        <p className="text-xs text-[var(--color-ink-soft)]">
          Deterministically seeds 75 days of realistic journal history: 2 closed chapters with reflections & photos, 1 open chapter, regular menstrual cycles, and planted lifestyle correlations.
        </p>
        <button
          type="button"
          disabled={isGeneratingDemo}
          onClick={handleGenerateDemoData}
          className="w-full py-2.5 px-4 rounded-[var(--radius-pill)] bg-indigo-600 text-white font-bold text-xs sticker-button flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-95"
        >
          <RefreshCw size={14} className={isGeneratingDemo ? 'animate-spin' : ''} />
          <span>{isGeneratingDemo ? 'Seeding Data...' : 'Generate 75-Day Demo Data'}</span>
        </button>
      </div>

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
                        setInspectDate(d.date)
                        setIsBrowseModalOpen(false)
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

      {/* Inspect Past Form in Locked Browse Mode (Items 4 & 5) */}
      {inspectDate && openChapter && (
        <NightlyFormModal
          isOpen={Boolean(inspectDate)}
          date={inspectDate}
          chapterId={openChapter.id}
          todayLogicalDate={logicalDate(new Date(), undefined, DEFAULT_WINDOW.endHour)}
          readOnly={true} // Default to locked Browse Mode! (Item 4)
          onClose={() => setInspectDate(null)}
          onSaved={() => {
            showToast('Changes saved')
            setInspectDate(null)
            loadProfileData()
          }}
        />
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
          onSuccess={() => showToast('Form pack imported!')}
        />
      )}

      {/* Form Editor Screen */}
      {isFormEditorOpen && (
        <FormEditorScreen
          isOpen={isFormEditorOpen}
          onClose={() => setIsFormEditorOpen(false)}
        />
      )}
    </div>
  )
}
