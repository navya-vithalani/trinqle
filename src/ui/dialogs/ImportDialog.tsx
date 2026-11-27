import React, { useState } from 'react'
import { X, UploadCloud, CheckCircle, AlertCircle, FolderArchive, Database } from 'lucide-react'
import type { FormPack } from '../../data/types'
import { validateFormPack } from '../../data/formPack/validator'
import { importFormPack } from '../../data/formPack/importer'
import {
  inspectChapterZip,
  importChapterZip,
  type ChapterZipPreview,
} from '../../core/export'
import {
  inspectFullBackupZip,
  importFullBackupZip,
  type FullBackupPreview,
} from '../../core/fullBackup'
import { createSafetySnapshot } from '../../core/snapshots'
import { readZipArchiveAsync } from '../../core/zip'
import { db } from '../../data/db'
import { ChapterRepository } from '../../data/repositories'

interface ImportDialogProps {
  isOpen: boolean
  initialFile?: File | null
  onClose: () => void
  onSuccess: () => void
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  initialFile,
  onClose,
  onSuccess,
}) => {
  const [pack, setPack] = useState<FormPack | null>(null)
  const [zipPreview, setZipPreview] = useState<ChapterZipPreview | null>(null)
  const [fullBackupPreview, setFullBackupPreview] = useState<FullBackupPreview | null>(null)
  const [zipBytes, setZipBytes] = useState<Uint8Array | null>(null)
  const [zipConflictExists, setZipConflictExists] = useState(false)
  const [zipConflictMode, setZipConflictMode] = useState<'replace' | 'skip'>('replace')
  const [fullBackupMode, setFullBackupMode] = useState<'replace' | 'merge'>('replace')
  const [errors, setErrors] = useState<string[]>([])
  const [mode, setMode] = useState<'replace' | 'merge'>('replace')
  const [isImporting, setIsImporting] = useState(false)

  const resetSelection = () => {
    setErrors([])
    setPack(null)
    setZipPreview(null)
    setFullBackupPreview(null)
    setZipBytes(null)
    setZipConflictExists(false)
  }

  const handleFile = async (file: File) => {
    resetSelection()

    if (file.name.toLowerCase().endsWith('.zip')) {
      try {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        const extracted = await readZipArchiveAsync(bytes)
        const manifestFile = extracted.find((f) => f.name === 'manifest.json')
        if (!manifestFile) {
          throw new Error('Invalid archive: manifest.json missing')
        }
        const rawManifest = JSON.parse(manifestFile.text()) as { kind?: string }

        if (rawManifest.kind === 'full_backup') {
          const preview = await inspectFullBackupZip(bytes)
          setFullBackupPreview(preview)
          setZipBytes(bytes)
        } else {
          const preview = await inspectChapterZip(bytes)
          const chapterRepo = new ChapterRepository()
          const existing = await chapterRepo.getChapterById(preview.chapter.id)
          setZipConflictExists(Boolean(existing && !existing.deletedAt))
          setZipPreview(preview)
          setZipBytes(bytes)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to inspect ZIP archive'
        setErrors([msg])
      }
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = JSON.parse(text)
        const validation = validateFormPack(parsed)

        if (!validation.valid) {
          setErrors(validation.errors)
        } else {
          setPack(parsed as FormPack)
        }
      } catch {
        setErrors(['Failed to parse file: expected a valid form-pack .json or Trinqle .zip archive'])
      }
    }
    reader.readAsText(file)
  }

  React.useEffect(() => {
    if (isOpen && initialFile) {
      handleFile(initialFile)
    } else if (!isOpen) {
      resetSelection()
    }
  }, [isOpen, initialFile])

  if (!isOpen) return null

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleCommit = async () => {
    setIsImporting(true)
    try {
      if (pack) {
        await importFormPack(pack, mode)
      } else if (zipBytes && fullBackupPreview) {
        if (fullBackupMode === 'replace') {
          const hasData = (await db.chapters.count()) > 0 || (await db.days.count()) > 0
          if (hasData) {
            await createSafetySnapshot('before_import_replace', 'Before Full Backup Restore', db)
          }
        }
        await importFullBackupZip(zipBytes, db, { mode: fullBackupMode })
      } else if (zipBytes) {
        if (zipConflictExists && zipConflictMode === 'replace') {
          await createSafetySnapshot('before_import_replace', 'Before Chapter Overwrite Import', db)
        }
        await importChapterZip(zipBytes, db, { conflictMode: zipConflictMode })
      } else {
        return
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during import'
      setErrors([msg])
    } finally {
      setIsImporting(false)
    }
  }

  const hasSelection = Boolean(pack || zipPreview || fullBackupPreview)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] p-4 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[var(--color-ink)]">
            Import form pack or backup
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-bg)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        {!hasSelection && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-[var(--color-line)] rounded-[var(--radius-m)] p-6 text-center space-y-2 bg-[var(--color-bg)]/40 hover:bg-[var(--color-bg)] transition-colors"
          >
            <UploadCloud size={32} className="mx-auto text-[var(--color-accent)]" />
            <p className="text-xs font-semibold text-[var(--color-ink)]">
              Drop a form-pack .json, chapter .zip, or full backup .zip here
            </p>
            <label className="inline-block py-1.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-xs font-medium text-[var(--color-ink)] cursor-pointer active:scale-95 shadow-xs">
              <span>Choose file</span>
              <input
                type="file"
                accept=".json,.zip"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0])
                  }
                }}
              />
            </label>
          </div>
        )}

        {/* Errors view */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-[var(--radius-m)] p-3 text-xs text-red-700 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold">
              <AlertCircle size={14} />
              <span>Import error</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Form-Pack Preview & Choice */}
        {pack && (
          <div className="space-y-3">
            <div className="bg-[var(--color-bg)] p-3 rounded-[var(--radius-m)] border border-[var(--color-line)] space-y-1 text-xs">
              <div className="flex items-center space-x-1 font-bold text-[var(--color-ink)]">
                <CheckCircle size={14} className="text-[var(--color-success)]" />
                <span>{pack.name}</span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {pack.sections.length} sections · {pack.questions.length} questions ·{' '}
                {pack.libraries.length} libraries
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-[var(--color-ink-soft)]">
                Import mode:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('replace')}
                  className={`py-2 px-3 text-xs rounded-[var(--radius-pill)] border-2 font-medium transition-all ${
                    mode === 'replace'
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white font-semibold'
                      : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]'
                  }`}
                >
                  Replace current
                </button>
                <button
                  type="button"
                  onClick={() => setMode('merge')}
                  className={`py-2 px-3 text-xs rounded-[var(--radius-pill)] border-2 font-medium transition-all ${
                    mode === 'merge'
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white font-semibold'
                      : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]'
                  }`}
                >
                  Merge additions
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetSelection}
                className="py-2.5 px-3 rounded-[var(--radius-pill)] border border-[var(--color-line)] text-xs font-semibold text-[var(--color-ink-soft)]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isImporting}
                onClick={handleCommit}
                className="flex-1 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-semibold text-xs sticker-button disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : 'Commit import'}
              </button>
            </div>
          </div>
        )}

        {/* Full Database Backup Preview & Replace/Merge Choice */}
        {fullBackupPreview && (
          <div className="space-y-3">
            <div className="bg-[var(--color-bg)] p-3 rounded-[var(--radius-m)] border border-[var(--color-line)] space-y-1 text-xs">
              <div className="flex items-center space-x-1.5 font-bold text-[var(--color-ink)]">
                <Database size={14} className="text-[var(--color-accent)]" />
                <span>Full Trinqle Backup (v{fullBackupPreview.manifest.formatVersion})</span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {fullBackupPreview.manifest.counts.chapters} chapters ·{' '}
                {fullBackupPreview.manifest.counts.days} days ·{' '}
                {fullBackupPreview.manifest.counts.answers} answers ·{' '}
                {fullBackupPreview.photosCount} photos
              </p>
              <p className="text-[10px] text-[var(--color-ink-soft)]">
                Exported {new Date(fullBackupPreview.manifest.exportedAt).toLocaleString()}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-[var(--color-ink-soft)]">
                Restore mode (Replace saves an automatic safety snapshot first):
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFullBackupMode('replace')}
                  className={`py-2 px-3 text-xs rounded-[var(--radius-pill)] border-2 font-medium ${
                    fullBackupMode === 'replace'
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white font-semibold'
                      : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]'
                  }`}
                >
                  Replace all data
                </button>
                <button
                  type="button"
                  onClick={() => setFullBackupMode('merge')}
                  className={`py-2 px-3 text-xs rounded-[var(--radius-pill)] border-2 font-medium ${
                    fullBackupMode === 'merge'
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white font-semibold'
                      : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]'
                  }`}
                >
                  Merge into current
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetSelection}
                className="py-2.5 px-3 rounded-[var(--radius-pill)] border border-[var(--color-line)] text-xs font-semibold text-[var(--color-ink-soft)]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isImporting}
                onClick={handleCommit}
                className="flex-1 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-semibold text-xs sticker-button disabled:opacity-50"
              >
                {isImporting ? 'Restoring...' : 'Restore backup'}
              </button>
            </div>
          </div>
        )}

        {/* Chapter ZIP Preview & Conflict Resolution */}
        {zipPreview && (
          <div className="space-y-3">
            <div className="bg-[var(--color-bg)] p-3 rounded-[var(--radius-m)] border border-[var(--color-line)] space-y-1 text-xs">
              <div className="flex items-center space-x-1.5 font-bold text-[var(--color-ink)]">
                <FolderArchive size={14} className="text-[var(--color-accent)]" />
                <span>{zipPreview.chapter.title || 'Chapter Archive'}</span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {zipPreview.chapter.startDate} to{' '}
                {zipPreview.chapter.endDate || zipPreview.chapter.plannedEndDate} ·{' '}
                {zipPreview.manifest.kind}
              </p>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {zipPreview.daysCount} days · {zipPreview.answersCount} answers ·{' '}
                {zipPreview.photosCount} photos
                {zipPreview.cyclesCount > 0 ? ` · ${zipPreview.cyclesCount} cycles` : ''}
              </p>
            </div>

            {zipConflictExists && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-amber-700 block">
                  A chapter with this ID already exists on this device:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setZipConflictMode('replace')}
                    className={`py-2 px-3 text-xs rounded-[var(--radius-pill)] border-2 font-medium ${
                      zipConflictMode === 'replace'
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white font-semibold'
                        : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]'
                    }`}
                  >
                    Overwrite existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setZipConflictMode('skip')}
                    className={`py-2 px-3 text-xs rounded-[var(--radius-pill)] border-2 font-medium ${
                      zipConflictMode === 'skip'
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white font-semibold'
                        : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]'
                    }`}
                  >
                    Keep existing
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetSelection}
                className="py-2.5 px-3 rounded-[var(--radius-pill)] border border-[var(--color-line)] text-xs font-semibold text-[var(--color-ink-soft)]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isImporting}
                onClick={handleCommit}
                className="flex-1 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-semibold text-xs sticker-button disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : 'Import archive'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
