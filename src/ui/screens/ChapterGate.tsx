import React, { useState, useEffect } from 'react'
import {
  ShieldAlert,
  Image as ImageIcon,
  Check,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Upload,
} from 'lucide-react'
import type { Chapter, Question, Part, CustomPrompt } from '../../data/types'
import { ChapterRepository, FormRepository } from '../../data/repositories'
import { compressPhoto, type CompressedPhoto } from '../../core/photoCompression'
import { LIMITS } from '../../core/limits'
import { syncChapterPlannedEndDate } from '../../core/notifications/client'
import { createSafetySnapshot } from '../../core/snapshots'
import { exportFullBackupZip } from '../../core/fullBackup'
import { exportChapterZip, downloadOrShareFile } from '../../core/export'
import { SettingsRepository } from '../../data/repositories'
import { ScaleWidget } from '../widgets/ScaleWidget'
import { TextWidget } from '../widgets/TextWidget'

interface ChapterGateProps {
  isOpen: boolean
  chapter: Chapter
  todayLogicalDate?: string
  onChapterClosed: (nextChapter: Chapter) => void
}

type CeremonyStep = 'reflections' | 'title_summary' | 'photos' | 'confirm'

export const ChapterGate: React.FC<ChapterGateProps> = ({
  isOpen,
  chapter,
  onChapterClosed,
}) => {
  const [step, setStep] = useState<CeremonyStep>('reflections')
  const [title, setTitle] = useState(chapter.title || 'Chapter 1')
  const [summary, setSummary] = useState(chapter.summary || '')
  const [photos, setPhotos] = useState<CompressedPhoto[]>([])
  const [isCompressing, setIsCompressing] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [exportChoice, setExportChoice] = useState<'full' | 'chapter' | 'skip'>('full')

  // Reflections state
  const [questions, setQuestions] = useState<Question[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [answersMap, setAnswersMap] = useState<Record<string, unknown>>({})
  const customPrompts: CustomPrompt[] = chapter.customPrompts || []

  const chapterRepo = new ChapterRepository()
  const formRepo = new FormRepository()
  const settingsRepo = new SettingsRepository()

  useEffect(() => {
    if (!isOpen) return

    const loadReflections = async () => {
      const snapshot = await formRepo.getSnapshot(chapter.startDate)
      const secIds = new Set(
        snapshot.sections.filter((s) => s.scope === 'chapterEnd').map((s) => s.id)
      )
      const qList = snapshot.questions.filter(
        (q) => secIds.has(q.sectionId) || q.schedule?.chapterEnd
      )
      setQuestions(qList)

      const qIds = new Set(qList.map((q) => q.id))
      setParts(snapshot.parts.filter((p) => qIds.has(p.questionId)))

      const existing = await chapterRepo.getChapterAnswers(chapter.id)
      const map: Record<string, unknown> = {}
      existing.forEach((ea) => {
        map[ea.promptId] = ea.value
      })
      setAnswersMap(map)
    }

    loadReflections()
  }, [isOpen, chapter.id])

  if (!isOpen) return null

  const handleReflectChange = async (promptId: string, value: unknown) => {
    setAnswersMap((prev) => ({ ...prev, [promptId]: value }))
    await chapterRepo.saveChapterAnswer(chapter.id, promptId, value as any)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsCompressing(true)
    try {
      const availableSlots = 10 - photos.length
      const filesToProcess = Array.from(files).slice(0, availableSlots)

      for (const file of filesToProcess) {
        const compressed = await compressPhoto(file)
        setPhotos((prev) => [...prev, compressed])
      }
    } catch {
      // Ignore
    } finally {
      setIsCompressing(false)
      e.target.value = ''
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFinalClose = async () => {
    setIsClosing(true)
    try {
      // B5: Always capture an automatic safety snapshot before closing chapter
      await createSafetySnapshot(
        'before_chapter_close',
        `Before closing ${title.trim() || chapter.title || 'Chapter'}`
      ).catch(() => {})

      // B6: Export before freezing (defaults to verified Full Backup)
      if (exportChoice === 'full') {
        const { filename, blob } = await exportFullBackupZip()
        const outcome = await downloadOrShareFile(filename, blob)
        if (outcome !== 'cancelled') {
          await settingsRepo.setSetting('last_backup_timestamp', Date.now())
        }
      } else if (exportChoice === 'chapter') {
        const { filename, blob } = await exportChapterZip(chapter.id)
        await downloadOrShareFile(filename, blob)
      }

      const photoBlobs = photos.map((p) => p.blob)
      const { nextChapter } = await chapterRepo.closeChapterWithCeremony({
        chapterId: chapter.id,
        title: title.trim() || undefined,
        summary: summary.trim() || undefined,
        photos: photoBlobs,
        endDate: chapter.plannedEndDate,
      })
      void syncChapterPlannedEndDate(nextChapter.plannedEndDate)
      onChapterClosed(nextChapter)
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--color-surface)] w-full max-w-lg max-h-[92vh] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl flex flex-col overflow-hidden">
        {/* Hard Lock Gate Banner */}
        <div className="bg-amber-500 text-white p-3 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldAlert size={18} />
            <span className="font-bold text-xs uppercase tracking-wider">
              Chapter Closing Ceremony
            </span>
          </div>
          <span className="text-[11px] font-semibold bg-white/25 px-2 py-0.5 rounded-full">
            {step === 'reflections' && '1 / 4 • Reflections'}
            {step === 'title_summary' && '2 / 4 • Summary'}
            {step === 'photos' && '3 / 4 • Photos'}
            {step === 'confirm' && '4 / 4 • Freeze'}
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* STEP 1: REFLECTIONS */}
          {step === 'reflections' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-[var(--color-ink)]">
                  Review Chapter Reflections
                </h3>
                <p className="text-xs text-[var(--color-ink-soft)] mt-1">
                  Take a moment to reflect back on what mattered during this chapter.
                </p>
              </div>

              {questions.map((q) => {
                const qParts = parts.filter((p) => p.questionId === q.id)
                return (
                  <div
                    key={q.id}
                    className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2.5"
                  >
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-ink)]">
                      {q.label}
                    </h4>
                    {qParts.map((p) => (
                      <div key={p.id}>
                        {p.kind === 'scale' ? (
                          <ScaleWidget
                            label={p.label}
                            value={answersMap[p.id] as number}
                            config={p.config as any}
                            onChange={(v) => handleReflectChange(p.id, v)}
                          />
                        ) : (
                          <TextWidget
                            label={p.label}
                            value={(answersMap[p.id] as string) || ''}
                            onChange={(v) => handleReflectChange(p.id, v)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}

              {customPrompts.length > 0 && (
                <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-ink)]">
                    Custom Prompts
                  </h4>
                  {customPrompts.map((cp) => (
                    <TextWidget
                      key={cp.id}
                      label={cp.label}
                      value={(answersMap[cp.id] as string) || ''}
                      onChange={(v) => handleReflectChange(cp.id, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: TITLE & SUMMARY */}
          {step === 'title_summary' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-[var(--color-ink)]">
                  Name & Summarize Your Chapter
                </h3>
                <p className="text-xs text-[var(--color-ink-soft)] mt-1">
                  Give this stretch of time a title and a memorable summary.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--color-ink)]">
                  Chapter Title
                </label>
                <input
                  type="text"
                  maxLength={LIMITS.CHAPTER_NAME}
                  value={title}
                  placeholder="e.g. Chapter 1: Fresh Start"
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--color-ink)]">
                    Chapter Summary
                  </label>
                  {summary.length >= Math.floor(LIMITS.CHAPTER_SUMMARY * 0.85) && (
                    <span className="text-[10px] text-[var(--color-ink-soft)]">
                      {summary.length}/{LIMITS.CHAPTER_SUMMARY}
                    </span>
                  )}
                </div>
                <textarea
                  rows={4}
                  maxLength={LIMITS.CHAPTER_SUMMARY}
                  value={summary}
                  placeholder="What was this chapter about? Key memories, breakthroughs, or lessons learned..."
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full p-2.5 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs text-[var(--color-ink)] leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* STEP 3: PHOTOS */}
          {step === 'photos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[var(--color-ink)]">
                    Chapter Photos (0-10)
                  </h3>
                  <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">
                    Compressed locally on your phone. {photos.length} of 10 slots filled.
                  </p>
                </div>

                {photos.length < 10 && (
                  <label className="py-2 px-3 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-semibold text-xs flex items-center space-x-1.5 cursor-pointer active:scale-95">
                    <Upload size={14} />
                    <span>{isCompressing ? 'Compressing...' : 'Add Photos'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isCompressing}
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Photo Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {photos.map((p, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-[var(--radius-m)] overflow-hidden border-2 border-[var(--color-line)] group"
                  >
                    <img
                      src={p.dataUrl}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1.5 py-0.5 rounded font-mono">
                      {Math.round(p.sizeBytes / 1024)} KB
                    </span>
                  </div>
                ))}

                {photos.length === 0 && (
                  <div className="col-span-full p-8 border-2 border-dashed border-[var(--color-line)] rounded-[var(--radius-m)] text-center text-xs text-[var(--color-ink-soft)] flex flex-col items-center justify-center space-y-1">
                    <ImageIcon size={24} className="text-[var(--color-line)]" />
                    <p>No photos attached. Photos are completely optional.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: CONFIRM & FREEZE */}
          {step === 'confirm' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Check size={28} />
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-base text-[var(--color-ink)]">
                  Ready to Close {title}?
                </h3>
                <p className="text-xs text-[var(--color-ink-soft)] max-w-sm mx-auto">
                  Once closed, this chapter becomes <strong>write-protected and frozen</strong>. You will always be able to view it in Archive. A brand new chapter will begin immediately.
                </p>
              </div>

              <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-m)] border border-[var(--color-line)] text-left text-xs space-y-1.5 max-w-xs mx-auto">
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Duration:</span>
                  <span className="font-semibold">{chapter.startDate} to {chapter.plannedEndDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Photos:</span>
                  <span className="font-semibold">{photos.length} photos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Status:</span>
                  <span className="font-semibold text-emerald-600">Freezing permanently</span>
                </div>
              </div>

              {/* B6: Export prompt defaulting to Full Backup */}
              <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-m)] border border-[var(--color-line)] text-left text-xs space-y-2 max-w-xs mx-auto">
                <span className="font-bold text-[var(--color-ink)] block">
                  Backup before closing
                </span>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="chapter-close-export"
                      checked={exportChoice === 'full'}
                      onChange={() => setExportChoice('full')}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="font-semibold text-[var(--color-ink)]">
                      Full backup (.zip) — recommended
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="chapter-close-export"
                      checked={exportChoice === 'chapter'}
                      onChange={() => setExportChoice('chapter')}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="text-[var(--color-ink-soft)]">
                      This chapter archive only (.zip)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="chapter-close-export"
                      checked={exportChoice === 'skip'}
                      onChange={() => setExportChoice('skip')}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="text-[var(--color-ink-soft)]">
                      Skip export (snapshot still saved locally)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-3 border-t-2 border-[var(--color-line)] bg-[var(--color-surface)] flex items-center justify-between">
          {step !== 'reflections' ? (
            <button
              type="button"
              onClick={() => {
                if (step === 'title_summary') setStep('reflections')
                else if (step === 'photos') setStep('title_summary')
                else if (step === 'confirm') setStep('photos')
              }}
              className="py-2 px-3 rounded-[var(--radius-pill)] border border-[var(--color-line)] text-xs font-semibold text-[var(--color-ink)] flex items-center space-x-1 active:scale-95"
            >
              <ChevronLeft size={16} />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step !== 'confirm' ? (
            <button
              type="button"
              onClick={() => {
                if (step === 'reflections') setStep('title_summary')
                else if (step === 'title_summary') setStep('photos')
                else if (step === 'photos') setStep('confirm')
              }}
              className="py-2 px-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button flex items-center space-x-1 active:scale-95"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={isClosing}
              onClick={handleFinalClose}
              className="py-2.5 px-6 rounded-[var(--radius-pill)] bg-emerald-600 text-white font-bold text-xs sticker-button flex items-center space-x-1.5 active:scale-95"
            >
              <span>{isClosing ? 'Freezing...' : 'Close & Freeze Chapter'}</span>
              <Check size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
