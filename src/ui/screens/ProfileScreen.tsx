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
import { generateDemoData } from '../../tools/demoData'
import { db } from '../../data/db'

export const ProfileScreen: React.FC = () => {
  const [selectedThemeId, setSelectedThemeId] = useState('cutesy')
  const [isDark, setIsDark] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState('white-cat')

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isFormEditorOpen, setIsFormEditorOpen] = useState(false)
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    const { themeId, isDark: dark } = loadThemePreference()
    setSelectedThemeId(themeId)
    setIsDark(dark)
    setSelectedCharacterId(loadCharacterPreference())
  }, [])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
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

      {/* Theme & Appearance (persisted) */}
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
                ? 'border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs'
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
                ? 'border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs'
                : 'border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-soft)]'
            }`}
          >
            <Moon size={16} />
            <span>Dark mode</span>
          </button>
        </div>

        {/* Theme Picker */}
        <div className="space-y-1.5 pt-2 border-t border-[var(--color-line)]">
          <span className="text-xs font-semibold text-[var(--color-ink)] block">
            Visual Theme
          </span>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(themeRegistry).map((t) => {
              const isSelected = selectedThemeId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleThemeChange(t.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-[var(--radius-m)] border-2 transition-all ${
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
                    ? 'border-[var(--color-accent)] bg-[var(--color-bg)] shadow-xs'
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

      {/* Journal Form Designer */}
      <div className="sticker-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--color-ink)]">Journal form editor</h2>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
            Phase 4
          </span>
        </div>
        <p className="text-xs text-[var(--color-ink-soft)]">
          Customize sections, questions, and parts. Full-screen editor with Excel-style tabs, 1-tap core/extra toggling, library management, and effective dating.
        </p>
        <button
          type="button"
          onClick={() => setIsFormEditorOpen(true)}
          className="w-full py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button flex items-center justify-center space-x-2 active:scale-95"
        >
          <Sliders size={15} />
          <span>Open Form & Question Editor</span>
        </button>
      </div>

      {/* Form Pack Management */}
      <div className="sticker-card p-4 space-y-3">
        <h2 className="text-base font-bold text-[var(--color-ink)]">Form pack</h2>
        <p className="text-xs text-[var(--color-ink-soft)]">
          Export your current questions and libraries, or import another pack.
        </p>
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

      {/* Journal Settings */}
      <div className="sticker-card p-4 space-y-3">
        <h2 className="text-base font-bold text-[var(--color-ink)]">Journal settings</h2>
        <div className="divide-y divide-[var(--color-line)] text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[var(--color-ink)]">Character persona</span>
            <span className="font-semibold text-[var(--color-accent)]">Piqsie</span>
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
