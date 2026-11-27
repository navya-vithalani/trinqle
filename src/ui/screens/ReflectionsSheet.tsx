import React, { useState, useEffect } from 'react'
import { X, BookOpen, Plus, Check } from 'lucide-react'
import type { Chapter, Question, Part, CustomPrompt } from '../../data/types'
import { ChapterRepository, FormRepository } from '../../data/repositories'
import { LIMITS } from '../../core/limits'
import { ScaleWidget } from '../widgets/ScaleWidget'
import { TextWidget } from '../widgets/TextWidget'

interface ReflectionsSheetProps {
  isOpen: boolean
  chapter: Chapter
  onClose: () => void
}

export const ReflectionsSheet: React.FC<ReflectionsSheetProps> = ({
  isOpen,
  chapter,
  onClose,
}) => {
  const [questions, setQuestions] = useState<Question[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [answersMap, setAnswersMap] = useState<Record<string, unknown>>({})
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>(chapter.customPrompts || [])
  const [newPromptLabel, setNewPromptLabel] = useState('')
  const [isAddingPrompt, setIsAddingPrompt] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)

  const chapterRepo = new ChapterRepository()
  const formRepo = new FormRepository()

  const loadReflections = async () => {
    // 1. Get sections with scope: 'chapterEnd'
    const snapshot = await formRepo.getSnapshot(chapter.startDate)
    const chapterEndSections = snapshot.sections.filter((s) => s.scope === 'chapterEnd')
    const secIds = new Set(chapterEndSections.map((s) => s.id))

    // Chapter end questions
    const qList = snapshot.questions.filter(
      (q) => secIds.has(q.sectionId) || q.schedule?.chapterEnd
    )
    setQuestions(qList)

    const qIds = new Set(qList.map((q) => q.id))
    const pList = snapshot.parts.filter((p) => qIds.has(p.questionId))
    setParts(pList)

    // 2. Load existing chapter answers
    const existing = await chapterRepo.getChapterAnswers(chapter.id)
    const map: Record<string, unknown> = {}
    existing.forEach((ea) => {
      map[ea.promptId] = ea.value
    })
    setAnswersMap(map)

    const refreshedChapter = await chapterRepo.getChapterById(chapter.id)
    if (refreshedChapter?.customPrompts) {
      setCustomPrompts(refreshedChapter.customPrompts)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadReflections()
    }
  }, [isOpen, chapter.id])

  const handleValueChange = async (promptId: string, value: unknown) => {
    setAnswersMap((prev) => ({ ...prev, [promptId]: value }))
    await chapterRepo.saveChapterAnswer(chapter.id, promptId, value as any)
    setSavedBadge(true)
    setTimeout(() => setSavedBadge(false), 1500)
  }

  const handleAddCustomPrompt = async () => {
    if (!newPromptLabel.trim()) return
    const newPrompt: CustomPrompt = {
      id: `custom_${Date.now()}`,
      label: newPromptLabel.trim(),
      type: 'text',
    }
    const updated = await chapterRepo.addCustomPrompt(chapter.id, newPrompt)
    setCustomPrompts(updated.customPrompts || [])
    setNewPromptLabel('')
    setIsAddingPrompt(false)
  }

  if (!isOpen) return null

  // Progress count
  const allPromptIds = [
    ...parts.map((p) => p.id),
    ...customPrompts.map((cp) => cp.id),
  ]
  const answeredCount = allPromptIds.filter((id) => {
    const val = answersMap[id]
    return val !== undefined && val !== null && val !== ''
  }).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[var(--color-surface)] w-full max-w-lg max-h-[90vh] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b-2 border-[var(--color-line)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <BookOpen size={18} className="text-[var(--color-accent)]" />
            <div>
              <h2 className="font-bold text-sm text-[var(--color-ink)]">
                Chapter Reflections
              </h2>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {answeredCount} of {allPromptIds.length} answered • Autosaved
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {savedBadge && (
              <span className="text-[10px] text-emerald-600 font-bold flex items-center space-x-1">
                <Check size={12} />
                <span>Saved</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Prompts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-xs text-[var(--color-ink-soft)]">
            Reflections can be filled gradually throughout this chapter. They will be frozen when the chapter closes.
          </p>

          {/* Standard Chapter Reflections */}
          {questions.map((q) => {
            const qParts = parts.filter((p) => p.questionId === q.id)
            return (
              <div
                key={q.id}
                className="p-3.5 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-3"
              >
                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-ink)]">
                  {q.label}
                </h4>

                <div className="space-y-3">
                  {qParts.map((p) => {
                    const currentVal = answersMap[p.id]

                    if (p.kind === 'scale') {
                      return (
                        <ScaleWidget
                          key={p.id}
                          label={p.label}
                          value={currentVal as number}
                          config={p.config as any}
                          onChange={(v) => handleValueChange(p.id, v)}
                        />
                      )
                    }

                    return (
                      <TextWidget
                        key={p.id}
                        label={p.label}
                        value={(currentVal as string) || ''}
                        onChange={(v) => handleValueChange(p.id, v)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Custom Prompts Section */}
          <div className="p-3.5 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-ink)]">
                Custom Prompts & Notes
              </h4>
              <button
                type="button"
                onClick={() => setIsAddingPrompt(true)}
                className="flex items-center space-x-1 text-[11px] font-semibold text-[var(--color-accent)] active:scale-95"
              >
                <Plus size={13} />
                <span>Add Prompt</span>
              </button>
            </div>

            {/* Custom Prompts List */}
            {customPrompts.map((cp) => (
              <TextWidget
                key={cp.id}
                label={cp.label}
                value={(answersMap[cp.id] as string) || ''}
                onChange={(v) => handleValueChange(cp.id, v)}
              />
            ))}

            {isAddingPrompt && (
              <div className="p-2.5 rounded-[var(--radius-s)] bg-[var(--color-surface)] border border-[var(--color-line)] space-y-2">
                <input
                  type="text"
                  maxLength={LIMITS.CUSTOM_PROMPT_LABEL}
                  placeholder="Enter custom prompt question..."
                  value={newPromptLabel}
                  onChange={(e) => setNewPromptLabel(e.target.value)}
                  className="w-full p-2 text-xs rounded border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)]"
                />
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleAddCustomPrompt}
                    className="py-1 px-3 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white text-xs font-semibold"
                  >
                    Save Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPrompt(false)
                      setNewPromptLabel('')
                    }}
                    className="py-1 px-3 rounded-[var(--radius-pill)] text-xs text-[var(--color-ink-soft)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-[var(--color-line)] bg-[var(--color-surface)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 rounded-[var(--radius-pill)] bg-[var(--color-ink)] text-white font-bold text-xs active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
