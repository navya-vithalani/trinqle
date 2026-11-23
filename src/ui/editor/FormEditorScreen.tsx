import React, { useState, useEffect } from 'react'
import {
  Folder,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Check,
  Sliders,
  Hash,
  Type,
  Clock,
  ToggleLeft,
  Sparkles,
  ArrowRightLeft,
  X,
} from 'lucide-react'
import type {
  Section,
  Question,
  Part,
  Library,
  PartKind,
  PartLevel,
  PartConfig,
  Chapter,
} from '../../data/types'
import {
  FormRepository,
  LibraryRepository,
  ChapterRepository,
} from '../../data/repositories'
import { addDays } from '../../core/logicalDay'
import { ScopePromptModal, type EditScope } from './ScopePromptModal'
import { PartEditorModal } from './PartEditorModal'
import { LibraryManagerModal } from './LibraryManagerModal'

interface FormEditorScreenProps {
  isOpen: boolean
  onClose: () => void
}

const KIND_ICONS: Record<
  PartKind,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  yesno: ToggleLeft,
  scale: Sliders,
  number: Hash,
  text: Type,
  timerange: Clock,
  library: BookOpen,
}

export const FormEditorScreen: React.FC<FormEditorScreenProps> = ({
  isOpen,
  onClose,
}) => {
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [libraries, setLibraries] = useState<Library[]>([])
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null)

  // Modals
  const [isLibraryManagerOpen, setIsLibraryManagerOpen] = useState(false)
  const [editingPartModal, setEditingPartModal] = useState<{
    isOpen: boolean
    questionId: string
    part?: Partial<Part>
  }>({ isOpen: false, questionId: '' })

  const [scopeModal, setScopeModal] = useState<{
    isOpen: boolean
    title: string
    description?: string
    onConfirm: (scope: EditScope) => Promise<void>
  }>({ isOpen: false, title: '', onConfirm: async () => {} })

  // Inline Section creation / renaming
  const [isAddingSection, setIsAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')

  // Inline Question creation
  const [isAddingQuestion, setIsAddingQuestion] = useState(false)
  const [newQuestionLabel, setNewQuestionLabel] = useState('')

  // Move Question state
  const [movingQuestionId, setMovingQuestionId] = useState<string | null>(null)

  const formRepo = new FormRepository()
  const libRepo = new LibraryRepository()
  const chapterRepo = new ChapterRepository()

  const loadData = async () => {
    const [ch, secList, qList, pList, libList] = await Promise.all([
      chapterRepo.getOpenChapter(),
      formRepo.getSections(),
      formRepo.getQuestions(),
      formRepo.getParts(),
      libRepo.getLibraries(),
    ])

    setActiveChapter(ch || null)
    setSections(secList)
    if (secList.length > 0 && !selectedSectionId) {
      setSelectedSectionId(secList[0].id)
    }
    setQuestions(qList)
    setParts(pList)
    setLibraries(libList)
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  if (!isOpen) return null

  // Helpers for effective dating dates
  const getScopeDates = (scope: EditScope) => {
    if (!activeChapter) return { validFrom: null }
    if (scope === 'thisChapter') {
      return { validFrom: activeChapter.startDate }
    }
    // nextChapter: starts day after plannedEndDate
    return { validFrom: addDays(activeChapter.plannedEndDate, 1) }
  }

  // --- SECTION ACTIONS ---
  const handleCreateSection = async () => {
    if (!newSectionName.trim()) return
    const created = await formRepo.createSection({ name: newSectionName.trim() })
    setNewSectionName('')
    setIsAddingSection(false)
    await loadData()
    setSelectedSectionId(created.id)
  }

  const handleRenameSection = async (sec: Section) => {
    if (!editingSectionName.trim()) return
    await formRepo.saveSection({ ...sec, name: editingSectionName.trim(), updatedAt: Date.now() })
    setEditingSectionId(null)
    setEditingSectionName('')
    await loadData()
  }

  const handleRetireSection = async (secId: string) => {
    setScopeModal({
      isOpen: true,
      title: 'Retire Section',
      description: 'Retiring a section hides all its questions from future forms. Historical logs remain fully intact.',
      onConfirm: async (scope) => {
        const { validFrom } = getScopeDates(scope)
        const retireDate = validFrom || new Date().toISOString().slice(0, 10)
        await formRepo.retireSection(secId, retireDate)
        await loadData()
        if (selectedSectionId === secId && sections.length > 1) {
          const remaining = sections.filter((s) => s.id !== secId)
          setSelectedSectionId(remaining[0]?.id || '')
        }
      },
    })
  }

  // --- QUESTION ACTIONS ---
  const handleCreateQuestion = async () => {
    if (!newQuestionLabel.trim() || !selectedSectionId) return
    const label = newQuestionLabel.trim()
    setNewQuestionLabel('')
    setIsAddingQuestion(false)

    setScopeModal({
      isOpen: true,
      title: 'Add New Question',
      description: `Adding "${label}" to the journal form.`,
      onConfirm: async (scope) => {
        const { validFrom } = getScopeDates(scope)
        const createdQ = await formRepo.createQuestion({
          sectionId: selectedSectionId,
          label,
          validFrom,
        })
        // Automatically give it a default primary part
        await formRepo.createPart({
          questionId: createdQ.id,
          kind: 'yesno',
          label: 'Completed today?',
          level: 'core',
          validFrom,
        })
        await loadData()
      },
    })
  }

  const handleMoveQuestion = async (qId: string, targetSecId: string) => {
    await formRepo.moveQuestionToSection(qId, targetSecId)
    setMovingQuestionId(null)
    await loadData()
  }

  const handleReorderQuestion = async (qId: string, direction: 'up' | 'down') => {
    const secQuestions = questions
      .filter((q) => q.sectionId === selectedSectionId && !q.parentId)
      .sort((a, b) => a.order - b.order)

    const index = secQuestions.findIndex((q) => q.id === qId)
    if (index < 0) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === secQuestions.length - 1) return

    const targetIdx = direction === 'up' ? index - 1 : index + 1
    const reordered = [...secQuestions]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIdx, 0, moved)

    await formRepo.reorderQuestions(
      selectedSectionId,
      reordered.map((q) => q.id)
    )
    await loadData()
  }

  const handleRetireQuestion = async (qId: string) => {
    setScopeModal({
      isOpen: true,
      title: 'Retire Question',
      description: 'Hides this question from new daily forms while preserving all historical logs.',
      onConfirm: async (scope) => {
        const { validFrom } = getScopeDates(scope)
        const retireDate = validFrom || new Date().toISOString().slice(0, 10)
        await formRepo.retireQuestion(qId, retireDate)
        await loadData()
      },
    })
  }

  // --- PART ACTIONS ---
  const handleSavePart = async (partData: {
    kind: PartKind
    label: string
    level: PartLevel
    gate: boolean
    config: PartConfig
  }) => {
    const qId = editingPartModal.questionId
    const existingPart = editingPartModal.part

    if (existingPart?.id) {
      // Light edits (label, config, gate) apply immediately
      const updated: Part = {
        ...(existingPart as Part),
        label: partData.label,
        level: partData.level,
        gate: partData.gate,
        config: partData.config,
        updatedAt: Date.now(),
      }
      await formRepo.savePart(updated)
      await loadData()
    } else {
      // Structural addition: prompt scope
      setScopeModal({
        isOpen: true,
        title: 'Add Part',
        description: `Adding part "${partData.label}" to question.`,
        onConfirm: async (scope) => {
          const { validFrom } = getScopeDates(scope)
          await formRepo.createPart({
            questionId: qId,
            kind: partData.kind,
            label: partData.label,
            level: partData.level,
            gate: partData.gate,
            config: partData.config,
            validFrom,
          })
          await loadData()
        },
      })
    }
  }

  const handleTogglePartLevel = async (part: Part) => {
    await formRepo.togglePartLevel(part.id)
    await loadData()
  }

  const handleRetirePart = async (partId: string) => {
    setScopeModal({
      isOpen: true,
      title: 'Retire Part',
      description: 'Retiring this part removes it from future forms. Existing answers are preserved.',
      onConfirm: async (scope) => {
        const { validFrom } = getScopeDates(scope)
        const retireDate = validFrom || new Date().toISOString().slice(0, 10)
        await formRepo.retirePart(partId, retireDate)
        await loadData()
      },
    })
  }

  // Questions belonging to the selected section
  const currentSection = sections.find((s) => s.id === selectedSectionId)
  const currentQuestions = questions
    .filter((q) => q.sectionId === selectedSectionId && !q.parentId)
    .sort((a, b) => a.order - b.order)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[var(--color-surface)] w-full max-w-xl h-full sm:h-[94vh] sm:rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Top Header */}
        <div className="p-4 border-b-2 border-[var(--color-line)] flex items-center justify-between shrink-0 bg-[var(--color-surface)]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[var(--color-ink)]">
                Journal Form Builder
              </h2>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {activeChapter?.title || 'Open Chapter'} • Customize sections, questions, and parts
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsLibraryManagerOpen(true)}
              className="py-1.5 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)] font-semibold text-xs flex items-center space-x-1 active:scale-95"
            >
              <BookOpen size={13} className="text-[var(--color-accent)]" />
              <span>Libraries</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Excel-Style Section Tab Bar */}
        <div className="flex items-center space-x-1 px-3 py-2 bg-[var(--color-bg)] border-b-2 border-[var(--color-line)] overflow-x-auto scrollbar-none shrink-0">
          {sections.map((sec) => {
            const isSelected = selectedSectionId === sec.id
            const isChapterEnd = sec.scope === 'chapterEnd'
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSectionId(sec.id)}
                className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-[var(--radius-m)] font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-[var(--color-surface)] border-2 border-[var(--color-accent)] text-[var(--color-accent)] shadow-xs'
                    : 'bg-transparent border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                }`}
              >
                <Folder size={13} />
                <span>{sec.name}</span>
                {isChapterEnd && (
                  <span className="text-[8px] font-extrabold uppercase px-1 rounded bg-purple-100 text-purple-700">
                    Reflect
                  </span>
                )}
              </button>
            )
          })}

          {/* Add Section Tab Button */}
          <button
            type="button"
            onClick={() => setIsAddingSection(true)}
            className="flex items-center space-x-1 py-1.5 px-2.5 rounded-[var(--radius-m)] border border-dashed border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] font-semibold text-[11px] whitespace-nowrap active:scale-95 shrink-0"
          >
            <Plus size={13} />
            <span>Section</span>
          </button>
        </div>

        {/* Section Management / Adding */}
        {isAddingSection && (
          <div className="p-3 bg-[var(--color-bg)] border-b border-[var(--color-line)] flex items-center space-x-2">
            <input
              type="text"
              placeholder="New section name (e.g. Mind, Nutrition, Creative)..."
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              className="flex-1 p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-xs"
            />
            <button
              type="button"
              onClick={handleCreateSection}
              className="py-1 px-3 rounded-full bg-[var(--color-accent)] text-white font-bold text-xs"
            >
              Add Section
            </button>
            <button
              type="button"
              onClick={() => setIsAddingSection(false)}
              className="py-1 px-2 text-[var(--color-ink-soft)] text-xs"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Main Work Area: Questions in selected section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Section Header Controls */}
          {currentSection && (
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] flex items-center justify-between">
              {editingSectionId === currentSection.id ? (
                <div className="flex items-center space-x-2 flex-1 mr-2">
                  <input
                    type="text"
                    value={editingSectionName}
                    onChange={(e) => setEditingSectionName(e.target.value)}
                    className="flex-1 p-1 rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-bold text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleRenameSection(currentSection)}
                    className="p-1 rounded bg-[var(--color-accent)] text-white"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSectionId(null)}
                    className="p-1 text-[var(--color-ink-soft)]"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm text-[var(--color-ink)]">
                    {currentSection.name}
                  </span>
                  <span className="text-[10px] text-[var(--color-ink-soft)]">
                    ({currentQuestions.length} questions)
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSectionId(currentSection.id)
                    setEditingSectionName(currentSection.name)
                  }}
                  className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-accent)]"
                  title="Rename Section"
                >
                  <Edit2 size={13} />
                </button>
                {sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRetireSection(currentSection.id)}
                    className="p-1 text-[var(--color-ink-soft)] hover:text-rose-600"
                    title="Retire Section"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Questions Cards List */}
          <div className="space-y-3.5">
            {currentQuestions.map((q, idx) => {
              const qParts = parts
                .filter((p) => p.questionId === q.id)
                .sort((a, b) => a.order - b.order)
              const subQuestions = questions.filter((sq) => sq.parentId === q.id)

              return (
                <div
                  key={q.id}
                  className="sticker-card p-3.5 space-y-3 border-2 border-[var(--color-line)]"
                >
                  {/* Question Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-xs text-[var(--color-ink)] flex items-center space-x-1.5">
                        <span>{q.label}</span>
                        {q.repeats && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            Repeating
                          </span>
                        )}
                      </h4>
                      <span className="text-[10px] text-[var(--color-ink-soft)]">
                        {qParts.length} input parts
                      </span>
                    </div>

                    {/* Question Actions */}
                    <div className="flex items-center space-x-1">
                      {/* Move Up / Down */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleReorderQuestion(q.id, 'up')}
                        className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-20 active:scale-90"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === currentQuestions.length - 1}
                        onClick={() => handleReorderQuestion(q.id, 'down')}
                        className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-20 active:scale-90"
                      >
                        <ArrowDown size={13} />
                      </button>

                      {/* Move to another section */}
                      <button
                        type="button"
                        onClick={() =>
                          setMovingQuestionId(movingQuestionId === q.id ? null : q.id)
                        }
                        className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] active:scale-90"
                        title="Move to another section"
                      >
                        <ArrowRightLeft size={13} />
                      </button>

                      {/* Retire Question */}
                      <button
                        type="button"
                        onClick={() => handleRetireQuestion(q.id)}
                        className="p-1 text-[var(--color-ink-soft)] hover:text-rose-600 active:scale-90"
                        title="Retire question"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Move to section dropdown popup */}
                  {movingQuestionId === q.id && (
                    <div className="p-2 rounded-[var(--radius-s)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-1.5 animate-in fade-in">
                      <span className="text-[10px] font-bold text-[var(--color-ink-soft)] block">
                        Move to Section:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {sections
                          .filter((s) => s.id !== selectedSectionId)
                          .map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleMoveQuestion(q.id, s.id)}
                              className="py-0.5 px-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[10px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-accent)] hover:text-white"
                            >
                              {s.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Parts List */}
                  <div className="space-y-2">
                    {qParts.map((p) => {
                      const Icon = KIND_ICONS[p.kind] || ToggleLeft
                      return (
                        <div
                          key={p.id}
                          className="p-2 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-bg)]/60 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)]">
                              <Icon size={12} />
                            </div>
                            <div>
                              <span className="font-bold text-[11px] text-[var(--color-ink)]">
                                {p.label}
                              </span>
                              <div className="flex items-center space-x-1.5 text-[9px] text-[var(--color-ink-soft)]">
                                <span>{p.kind}</span>
                                {p.gate && (
                                  <span className="font-bold text-amber-700 bg-amber-100 px-1 rounded">
                                    Gate
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* 1-Tap Core / Extra Toggle Chip */}
                            <button
                              type="button"
                              onClick={() => handleTogglePartLevel(p)}
                              className={`py-0.5 px-2 rounded-full text-[9px] font-extrabold transition-transform active:scale-90 ${
                                p.level === 'core'
                                  ? 'bg-[var(--color-accent)] text-white shadow-xs'
                                  : 'bg-[var(--color-line)] text-[var(--color-ink-soft)]'
                              }`}
                            >
                              {p.level.toUpperCase()}
                            </button>

                            {/* Pencil Edit */}
                            <button
                              type="button"
                              onClick={() =>
                                setEditingPartModal({
                                  isOpen: true,
                                  questionId: q.id,
                                  part: p,
                                })
                              }
                              className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] active:scale-90"
                              title="Edit Part"
                            >
                              <Edit2 size={13} />
                            </button>

                            {/* X Retire */}
                            <button
                              type="button"
                              onClick={() => handleRetirePart(p.id)}
                              className="p-1 text-[var(--color-ink-soft)] hover:text-rose-600 active:scale-90"
                              title="Retire Part"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Sub-Questions list if any */}
                  {subQuestions.length > 0 && (
                    <div className="pl-3 border-l-2 border-[var(--color-line)] space-y-2 mt-2">
                      <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
                        Sub-questions
                      </span>
                      {subQuestions.map((sq) => (
                        <div
                          key={sq.id}
                          className="p-2 rounded bg-[var(--color-surface)] border border-[var(--color-line)] text-[11px] font-semibold flex justify-between items-center"
                        >
                          <span>{sq.label}</span>
                          <button
                            type="button"
                            onClick={() => handleRetireQuestion(sq.id)}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Card Action Buttons */}
                  <div className="flex items-center space-x-2 pt-1 border-t border-[var(--color-line)]">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPartModal({
                          isOpen: true,
                          questionId: q.id,
                          part: undefined,
                        })
                      }
                      className="py-1 px-2.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-line)] text-[10px] font-semibold text-[var(--color-accent)] flex items-center space-x-1 active:scale-95"
                    >
                      <Plus size={11} />
                      <span>Add Part</span>
                    </button>
                  </div>
                </div>
              )
            })}

            {currentQuestions.length === 0 && (
              <div className="p-8 border-2 border-dashed border-[var(--color-line)] rounded-[var(--radius-m)] text-center text-xs text-[var(--color-ink-soft)]">
                No questions in this section yet. Add your first question below.
              </div>
            )}
          </div>

          {/* Add Question Button / Form */}
          {isAddingQuestion ? (
            <div className="p-3.5 rounded-[var(--radius-m)] bg-[var(--color-bg)] border-2 border-[var(--color-accent)] space-y-2">
              <label className="font-bold text-xs text-[var(--color-ink)] block">
                Question Label
              </label>
              <input
                type="text"
                placeholder="e.g. Did you workout today?, Reading time, Creative writing..."
                value={newQuestionLabel}
                onChange={(e) => setNewQuestionLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateQuestion()}
                className="w-full p-2 text-xs rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-[var(--color-ink)]"
              />
              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingQuestion(false)}
                  className="py-1 px-3 text-xs text-[var(--color-ink-soft)] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newQuestionLabel.trim()}
                  onClick={handleCreateQuestion}
                  className="py-1 px-4 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold disabled:opacity-50"
                >
                  Add Question
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingQuestion(true)}
              className="w-full py-3 rounded-[var(--radius-m)] border-2 border-dashed border-[var(--color-line)] hover:border-[var(--color-accent)] text-[var(--color-ink)] font-bold text-xs flex items-center justify-center space-x-1.5 active:scale-98 transition-all"
            >
              <Plus size={15} className="text-[var(--color-accent)]" />
              <span>Add Question to {currentSection?.name || 'Section'}</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t-2 border-[var(--color-line)] bg-[var(--color-surface)] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[var(--color-ink-soft)]">
            Edits are saved to your local offline database.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-6 rounded-[var(--radius-pill)] bg-[var(--color-ink)] text-white font-bold text-xs active:scale-95"
          >
            Done
          </button>
        </div>
      </div>

      {/* Part Editor Modal */}
      {editingPartModal.isOpen && (
        <PartEditorModal
          isOpen={editingPartModal.isOpen}
          part={editingPartModal.part}
          questionId={editingPartModal.questionId}
          libraries={libraries}
          onSave={handleSavePart}
          onClose={() =>
            setEditingPartModal({ isOpen: false, questionId: '', part: undefined })
          }
        />
      )}

      {/* Library Manager Modal */}
      {isLibraryManagerOpen && (
        <LibraryManagerModal
          isOpen={isLibraryManagerOpen}
          onClose={() => setIsLibraryManagerOpen(false)}
          onUpdated={loadData}
        />
      )}

      {/* Scope Prompt Modal */}
      {scopeModal.isOpen && (
        <ScopePromptModal
          isOpen={scopeModal.isOpen}
          title={scopeModal.title}
          description={scopeModal.description}
          currentChapterTitle={activeChapter?.title || 'Current Chapter'}
          onSelect={async (scope) => {
            const fn = scopeModal.onConfirm
            setScopeModal({ isOpen: false, title: '', onConfirm: async () => {} })
            await fn(scope)
          }}
          onCancel={() =>
            setScopeModal({ isOpen: false, title: '', onConfirm: async () => {} })
          }
        />
      )}
    </div>
  )
}
