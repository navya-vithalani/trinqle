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
  Eye,
  EyeOff,
  AlertCircle,
  Zap,
} from 'lucide-react'
import type {
  Section,
  Question,
  Part,
  Library,
  Item,
  PartKind,
  PartLevel,
  PartConfig,
  ShowWhenRule,
  QuestionSchedule,
  Chapter,
} from '../../data/types'
import {
  FormRepository,
  LibraryRepository,
  ChapterRepository,
} from '../../data/repositories'
import { addDays, formatDate, logicalDate } from '../../core/logicalDay'
import { LIMITS } from '../../core/limits'
import { loadAppSettings } from '../../core/settings'
import { isActiveOnDate } from '../../core/effectiveDating'
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
  const [logicalToday, setLogicalToday] = useState<string>(() =>
    formatDate(new Date())
  )
  const [showRetired, setShowRetired] = useState(false)
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null)
  const [upgradeCandidate, setUpgradeCandidate] = useState<{
    item: Item
    activeDays: number
  } | null>(null)
  const [dismissedItemIds, setDismissedItemIds] = useState<string[]>([])

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
  const [newQuestionIcon, setNewQuestionIcon] = useState('Sparkles')

  // Inline Sub-question creation
  const [addingSubForQuestionId, setAddingSubForQuestionId] = useState<string | null>(null)
  const [newSubLabel, setNewSubLabel] = useState('')

  // Inline Question editing (label, icon, repeats, schedule, showWhen)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editingQuestionLabel, setEditingQuestionLabel] = useState('')
  const [editingQuestionIcon, setEditingQuestionIcon] = useState('Sparkles')
  const [editingQuestionRepeats, setEditingQuestionRepeats] = useState(false)
  const [editingQuestionWeekdays, setEditingQuestionWeekdays] = useState<number[]>([])
  const [editingQuestionShowWhenMode, setEditingQuestionShowWhenMode] = useState<
    'always' | 'truthy' | 'eq' | 'cycleActive'
  >('always')
  const [editingQuestionShowWhenPartId, setEditingQuestionShowWhenPartId] = useState('')
  const [editingQuestionShowWhenValue, setEditingQuestionShowWhenValue] = useState('')

  // Move Question state
  const [movingQuestionId, setMovingQuestionId] = useState<string | null>(null)

  const formRepo = new FormRepository()
  const libRepo = new LibraryRepository()
  const chapterRepo = new ChapterRepository()

  const showNotice = (msg: string) => {
    setNoticeMsg(msg)
    setTimeout(() => setNoticeMsg(null), 4000)
  }

  const loadData = async () => {
    const [appSettings, ch, secList, qList, pList, libList, allItems, allLinks] =
      await Promise.all([
        loadAppSettings(),
        chapterRepo.getOpenChapter(),
        formRepo.getSections(),
        formRepo.getQuestions(),
        formRepo.getParts(),
        libRepo.getLibraries(),
        libRepo.getAllItems(),
        formRepo.getAllAnswerLinks(),
      ])

    const todayStr = logicalDate(new Date(), undefined, appSettings.windowEndHour)
    setLogicalToday(todayStr)
    setActiveChapter(ch || null)
    setSections(secList)
    if (secList.length > 0 && !selectedSectionId) {
      setSelectedSectionId(secList[0].id)
    }
    setQuestions(qList)
    setParts(pList)
    setLibraries(libList)

    // Detect frequent activity (>= 4 days/week across 12 weeks -> >= 48 days in last 84 days)
    const start84 = addDays(todayStr, -84)
    const datesByItem = new Map<string, Set<string>>()
    for (const link of allLinks) {
      if (link.date >= start84 && link.date <= todayStr) {
        if (!datesByItem.has(link.itemId)) datesByItem.set(link.itemId, new Set())
        datesByItem.get(link.itemId)!.add(link.date)
      }
    }
    const existingLabels = new Set(
      qList
        .filter((q) => isActiveOnDate(q, todayStr))
        .map((q) => q.label.toLowerCase())
    )
    let bestCandidate: { item: Item; activeDays: number } | null = null
    for (const item of allItems) {
      if (item.deletedAt || dismissedItemIds.includes(item.id)) continue
      const activeCount = datesByItem.get(item.id)?.size || 0
      const alreadyDedicated = Array.from(existingLabels).some((lbl) =>
        lbl.includes(item.name.toLowerCase())
      )
      if (
        activeCount >= 48 &&
        !alreadyDedicated &&
        (!bestCandidate || activeCount > bestCandidate.activeDays)
      ) {
        bestCandidate = { item, activeDays: activeCount }
      }
    }
    setUpgradeCandidate(bestCandidate)
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  if (!isOpen) return null

  // Helpers for effective dating dates
  // For additions: 'thisChapter' starts from logicalToday (so past filled days remain valid);
  // 'nextChapter' starts the day after activeChapter.plannedEndDate.
  // For retirements: validTo is exclusive (validTo <= date hides item), so 'thisChapter' hides starting logicalToday.
  const getScopeDates = (scope: EditScope, mode: 'add' | 'retire' = 'add') => {
    const nextStart = activeChapter
      ? addDays(activeChapter.plannedEndDate, 1)
      : addDays(logicalToday, 1)

    if (scope === 'nextChapter') {
      return { validFrom: nextStart, retireDate: nextStart }
    }
    if (mode === 'retire') {
      return { validFrom: logicalToday, retireDate: logicalToday }
    }
    return { validFrom: logicalToday, retireDate: logicalToday }
  }

  const startEditingQuestion = (q: Question) => {
    setEditingQuestionId(q.id)
    setEditingQuestionLabel(q.label)
    setEditingQuestionIcon(q.icon || 'Sparkles')
    setEditingQuestionRepeats(Boolean(q.repeats))
    setEditingQuestionWeekdays(q.schedule?.weekdays || [])
    if (q.showWhen?.cycleActive) {
      setEditingQuestionShowWhenMode('cycleActive')
      setEditingQuestionShowWhenPartId('')
      setEditingQuestionShowWhenValue('')
    } else if (q.showWhen?.partId && q.showWhen.op === 'eq' && q.showWhen.value !== undefined) {
      setEditingQuestionShowWhenMode('eq')
      setEditingQuestionShowWhenPartId(q.showWhen.partId)
      setEditingQuestionShowWhenValue(String(q.showWhen.value))
    } else if (q.showWhen?.partId && q.showWhen.op === 'truthy') {
      setEditingQuestionShowWhenMode('truthy')
      setEditingQuestionShowWhenPartId(q.showWhen.partId)
      setEditingQuestionShowWhenValue('')
    } else {
      setEditingQuestionShowWhenMode('always')
      setEditingQuestionShowWhenPartId('')
      setEditingQuestionShowWhenValue('')
    }
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
        const { retireDate } = getScopeDates(scope, 'retire')
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
    const icon = newQuestionIcon
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
          icon,
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

  const handleCreateSubQuestion = async (parentQ: Question) => {
    const label = newSubLabel.trim()
    if (!label) return
    setAddingSubForQuestionId(null)
    setNewSubLabel('')
    setScopeModal({
      isOpen: true,
      title: 'Add Sub-question',
      description: `Add follow-up "${label}" under "${parentQ.label}".`,
      onConfirm: async (scope) => {
        const { validFrom } = getScopeDates(scope, 'add')
        const created = await formRepo.createQuestion({
          sectionId: parentQ.sectionId,
          parentId: parentQ.id,
          label,
          icon: parentQ.icon || 'Sparkles',
          validFrom,
        })
        await formRepo.createPart({
          questionId: created.id,
          kind: 'text',
          label: 'Notes',
          level: 'extra',
          validFrom,
        })
        await loadData()
      },
    })
  }

  const handlePromoteUpgradeCandidate = async () => {
    if (!upgradeCandidate) return
    const item = upgradeCandidate.item
    const targetSection =
      sections.find((s) => s.id === selectedSectionId && s.scope !== 'chapterEnd') ||
      sections.find((s) => s.scope !== 'chapterEnd')
    if (!targetSection) return

    setScopeModal({
      isOpen: true,
      title: `Promote "${item.name}" to Routine`,
      description: `Creates a dedicated daily yes/no question for "${item.name}" in "${targetSection.name}".`,
      onConfirm: async (scope) => {
        const { validFrom } = getScopeDates(scope, 'add')
        const createdQ = await formRepo.createQuestion({
          sectionId: targetSection.id,
          label: item.name,
          icon: 'Activity',
          validFrom,
        })
        await formRepo.createPart({
          questionId: createdQ.id,
          kind: 'yesno',
          label: `Did you do ${item.name} today?`,
          level: 'core',
          gate: true,
          validFrom,
        })
        setDismissedItemIds((prev) => [...prev, item.id])
        setSelectedSectionId(targetSection.id)
        await loadData()
        showNotice(`Promoted "${item.name}" to its own question.`)
      },
    })
  }

  const handleUpdateQuestion = async (qId: string) => {
    if (!editingQuestionLabel.trim()) return
    const q = questions.find((item) => item.id === qId)
    if (!q) return

    const schedule: QuestionSchedule | undefined =
      editingQuestionWeekdays.length > 0 && editingQuestionWeekdays.length < 7
        ? { weekdays: [...editingQuestionWeekdays].sort((a, b) => a - b) }
        : undefined

    let showWhen: ShowWhenRule | undefined
    if (editingQuestionShowWhenMode === 'cycleActive') {
      showWhen = { op: 'truthy', cycleActive: true }
    } else if (editingQuestionShowWhenMode === 'truthy' && editingQuestionShowWhenPartId) {
      showWhen = { partId: editingQuestionShowWhenPartId, op: 'truthy' }
    } else if (editingQuestionShowWhenMode === 'eq' && editingQuestionShowWhenPartId) {
      const raw = editingQuestionShowWhenValue.trim()
      const parsedVal: string | number | boolean =
        raw === 'true'
          ? true
          : raw === 'false'
            ? false
            : raw !== '' && !Number.isNaN(Number(raw))
              ? Number(raw)
              : raw
      showWhen = { partId: editingQuestionShowWhenPartId, op: 'eq', value: parsedVal }
    }

    await formRepo.saveQuestion({
      ...q,
      label: editingQuestionLabel.trim(),
      icon: editingQuestionIcon,
      repeats: editingQuestionRepeats,
      schedule,
      showWhen,
      updatedAt: Date.now(),
    })
    setEditingQuestionId(null)
    await loadData()
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
        const { retireDate } = getScopeDates(scope, 'retire')
        await formRepo.retireQuestion(qId, retireDate)
        await loadData()
      },
    })
  }

  // --- PART ACTIONS ---
  const ensureGateCoreIfNeeded = async (
    qId: string,
    targetLevel: PartLevel,
    excludePartId?: string,
    effectiveFrom?: string | null
  ) => {
    if (targetLevel !== 'core') return
    const extraGate = parts.find(
      (p) =>
        p.questionId === qId &&
        p.id !== excludePartId &&
        !p.deletedAt &&
        isActiveOnDate(p, logicalToday) &&
        p.gate &&
        p.level === 'extra'
    )
    if (extraGate) {
      if (effectiveFrom && effectiveFrom > logicalToday) {
        await formRepo.retirePart(extraGate.id, effectiveFrom)
        await formRepo.createPart({
          questionId: qId,
          kind: extraGate.kind,
          label: extraGate.label,
          level: 'core',
          order: extraGate.order,
          gate: true,
          config: extraGate.config,
          validFrom: effectiveFrom,
        })
      } else {
        await formRepo.savePart({ ...extraGate, level: 'core', updatedAt: Date.now() })
      }
    }
  }

  const handleSavePart = async (partData: {
    questionId: string
    kind: PartKind
    label: string
    level: PartLevel
    gate: boolean
    config: PartConfig
  }) => {
    const qId = partData.questionId || editingPartModal.questionId
    const existingPart = editingPartModal.part

    // Gate invariant: if this part is gate and another active part is Core, this gate must be Core
    let resolvedLevel = partData.level
    const activeSiblings = parts.filter(
      (p) =>
        p.questionId === qId &&
        p.id !== existingPart?.id &&
        !p.deletedAt &&
        isActiveOnDate(p, logicalToday)
    )
    if (partData.gate && resolvedLevel === 'extra' && activeSiblings.some((s) => s.level === 'core')) {
      resolvedLevel = 'core'
      showNotice('Gate part kept Core because this question has other Core parts.')
    }

    if (existingPart?.id) {
      const kindChanged = partData.kind !== existingPart.kind
      const levelChanged = resolvedLevel !== existingPart.level

      if (kindChanged) {
        // Changing input kind retires old part and creates a fresh part so history stays type-safe
        setScopeModal({
          isOpen: true,
          title: 'Change Input Kind',
          description: `Changing "${existingPart.label}" from ${existingPart.kind} to ${partData.kind} retires the old part and starts a new one.`,
          onConfirm: async (scope) => {
            const { validFrom, retireDate } = getScopeDates(scope, 'retire')
            await formRepo.retirePart(existingPart.id!, retireDate)
            await formRepo.createPart({
              questionId: qId,
              kind: partData.kind,
              label: partData.label,
              level: resolvedLevel,
              order: existingPart.order,
              gate: partData.gate,
              config: partData.config,
              validFrom,
            })
            await ensureGateCoreIfNeeded(qId, resolvedLevel, existingPart.id, validFrom)
            await loadData()
          },
        })
        return
      }

      if (levelChanged) {
        setScopeModal({
          isOpen: true,
          title: 'Change Part Priority',
          description: `Apply switching "${partData.label}" to ${resolvedLevel.toUpperCase()}:`,
          onConfirm: async (scope) => {
            if (scope === 'thisChapter') {
              await formRepo.savePart({
                ...(existingPart as Part),
                kind: partData.kind,
                label: partData.label,
                level: resolvedLevel,
                gate: partData.gate,
                config: partData.config,
                updatedAt: Date.now(),
              })
              await ensureGateCoreIfNeeded(qId, resolvedLevel, existingPart.id)
            } else {
              const { validFrom } = getScopeDates('nextChapter', 'add')
              await formRepo.retirePart(existingPart.id!, validFrom)
              await formRepo.createPart({
                questionId: qId,
                kind: partData.kind,
                label: partData.label,
                level: resolvedLevel,
                order: existingPart.order,
                gate: partData.gate,
                config: partData.config,
                validFrom,
              })
              await ensureGateCoreIfNeeded(qId, resolvedLevel, existingPart.id, validFrom)
            }
            await loadData()
          },
        })
        return
      }

      // Label, config, or gate edit in place
      const updated: Part = {
        ...(existingPart as Part),
        kind: partData.kind,
        label: partData.label,
        level: resolvedLevel,
        gate: partData.gate,
        config: partData.config,
        updatedAt: Date.now(),
      }
      await formRepo.savePart(updated)
      await ensureGateCoreIfNeeded(qId, resolvedLevel, existingPart.id)
      await loadData()
    } else {
      setScopeModal({
        isOpen: true,
        title: 'Add Input Part',
        description: `Choose when "${partData.label}" starts appearing:`,
        onConfirm: async (scope) => {
          const { validFrom } = getScopeDates(scope, 'add')
          await formRepo.createPart({
            questionId: qId,
            kind: partData.kind,
            label: partData.label,
            level: resolvedLevel,
            gate: partData.gate,
            config: partData.config,
            validFrom,
          })
          await ensureGateCoreIfNeeded(qId, resolvedLevel, undefined, validFrom)
          await loadData()
        },
      })
    }
  }

  const handleTogglePartLevel = async (part: Part) => {
    const nextLevel: PartLevel = part.level === 'core' ? 'extra' : 'core'
    const activeSiblings = parts.filter(
      (p) =>
        p.questionId === part.questionId &&
        p.id !== part.id &&
        !p.deletedAt &&
        isActiveOnDate(p, logicalToday)
    )
    if (part.gate && nextLevel === 'extra' && activeSiblings.some((s) => s.level === 'core')) {
      showNotice('Gate parts must stay Core while another part in the question is Core.')
      return
    }

    setScopeModal({
      isOpen: true,
      title: `Set Part to ${nextLevel.toUpperCase()}`,
      description: `Switch "${part.label}" to ${nextLevel.toUpperCase()}:`,
      onConfirm: async (scope) => {
        if (scope === 'thisChapter') {
          await formRepo.togglePartLevel(part.id)
          await ensureGateCoreIfNeeded(part.questionId, nextLevel, part.id)
        } else {
          const { validFrom } = getScopeDates('nextChapter', 'add')
          await formRepo.retirePart(part.id, validFrom)
          await formRepo.createPart({
            questionId: part.questionId,
            kind: part.kind,
            label: part.label,
            level: nextLevel,
            order: part.order,
            gate: part.gate,
            config: part.config,
            validFrom,
          })
          await ensureGateCoreIfNeeded(part.questionId, nextLevel, part.id, validFrom)
        }
        await loadData()
      },
    })
  }

  const handleRetirePart = async (partId: string) => {
    setScopeModal({
      isOpen: true,
      title: 'Retire Part',
      description: 'Retiring this part removes it from future forms. Existing answers are preserved.',
      onConfirm: async (scope) => {
        const { retireDate } = getScopeDates(scope, 'retire')
        await formRepo.retirePart(partId, retireDate)
        await loadData()
      },
    })
  }

  const isRetired = (item: { validTo?: string | null }) =>
    Boolean(item.validTo && item.validTo <= logicalToday)

  const visibleSections = showRetired ? sections : sections.filter((s) => !isRetired(s))

  // Compute daily form time-cost estimate
  const dailySectionIds = new Set(
    sections.filter((s) => s.scope !== 'chapterEnd' && isActiveOnDate(s, logicalToday)).map((s) => s.id)
  )
  const activeDailyQIds = new Set(
    questions
      .filter((q) => dailySectionIds.has(q.sectionId) && isActiveOnDate(q, logicalToday))
      .map((q) => q.id)
  )
  const activeDailyParts = parts.filter(
    (p) => activeDailyQIds.has(p.questionId) && isActiveOnDate(p, logicalToday)
  )
  const partSecCost = (kind: PartKind, full: boolean) =>
    kind === 'text' ? (full ? 25 : 20) : kind === 'timerange' ? (full ? 15 : 12) : full ? 7 : 6
  const quickMinutes = Math.max(
    1,
    Math.round(
      activeDailyParts
        .filter((p) => p.level === 'core')
        .reduce((acc, p) => acc + partSecCost(p.kind, false), 0) / 60
    )
  )
  const fullMinutes = Math.max(
    1,
    Math.round(
      activeDailyParts.reduce((acc, p) => acc + partSecCost(p.kind, true), 0) / 60
    )
  )

  // Questions belonging to the selected section
  const currentSection = sections.find((s) => s.id === selectedSectionId)
  const currentQuestions = questions
    .filter((q) => q.sectionId === selectedSectionId && !q.parentId && (showRetired || !isRetired(q)))
    .sort((a, b) => a.order - b.order)

  const allActivePartsForConditions = parts.filter((p) => isActiveOnDate(p, logicalToday))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[var(--color-surface)] w-full max-w-xl h-full sm:h-[94vh] sm:rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Top Header */}
        <div className="p-4 border-b-2 border-[var(--color-line)] flex items-center justify-between gap-2 shrink-0 bg-[var(--color-surface)]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="font-bold text-sm text-[var(--color-ink)]">
                  Journal Form Builder
                </h2>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-accent)]"
                  title="Estimated fill duration based on active daily parts"
                >
                  Quick ~{quickMinutes}m · Full ~{fullMinutes}m
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-soft)] truncate">
                {activeChapter?.title || 'Open Chapter'} · Effective date: {logicalToday}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowRetired((v) => !v)}
              className={`p-2 min-h-[34px] rounded-[var(--radius-pill)] border text-[10px] font-semibold flex items-center gap-1 ${
                showRetired
                  ? 'border-[var(--color-accent)] bg-[var(--color-bg)] text-[var(--color-accent)]'
                  : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-soft)]'
              }`}
              title={showRetired ? 'Hide retired items' : 'Show retired items'}
            >
              {showRetired ? <Eye size={13} /> : <EyeOff size={13} />}
              <span className="hidden sm:inline">Retired</span>
            </button>
            <button
              type="button"
              onClick={() => setIsLibraryManagerOpen(true)}
              className="py-1.5 px-3 min-h-[34px] rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)] font-semibold text-xs flex items-center space-x-1 active:scale-95"
            >
              <BookOpen size={13} className="text-[var(--color-accent)]" />
              <span>Libraries</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Inline Notice Banner */}
        {noticeMsg && (
          <div className="mx-3 mt-2 p-2.5 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[11px] font-semibold text-[var(--color-ink)] flex items-center gap-2">
            <AlertCircle size={14} className="text-[var(--color-accent)] shrink-0" />
            <span>{noticeMsg}</span>
          </div>
        )}

        {/* Activity -> Routine Upgrade Banner */}
        {upgradeCandidate && (
          <div className="mx-3 mt-2 p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-accent)]/40 flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent)]">
                <Zap size={12} />
                <span>Routine Upgrade Suggestion</span>
              </div>
              <p className="text-[11px] text-[var(--color-ink)]">
                You logged <span className="font-bold">{upgradeCandidate.item.name}</span> on{' '}
                {upgradeCandidate.activeDays} of the last 84 days. Make it a dedicated daily question?
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handlePromoteUpgradeCandidate}
                className="px-2.5 py-1.5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold active:scale-95"
              >
                Promote
              </button>
              <button
                type="button"
                onClick={() =>
                  setDismissedItemIds((prev) => [...prev, upgradeCandidate.item.id])
                }
                className="p-1.5 rounded-full text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                title="Dismiss suggestion"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Excel-Style Section Tab Bar */}
        <div className="flex items-center space-x-1 px-3 py-2 bg-[var(--color-bg)] border-b-2 border-[var(--color-line)] overflow-x-auto scrollbar-none shrink-0">
          {visibleSections.map((sec) => {
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
              maxLength={LIMITS.SECTION_NAME}
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
                    maxLength={LIMITS.SECTION_NAME}
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
                .filter((p) => p.questionId === q.id && (showRetired || !isRetired(p)))
                .sort((a, b) => a.order - b.order)
              const subQuestions = questions
                .filter((sq) => sq.parentId === q.id && (showRetired || !isRetired(sq)))
                .sort((a, b) => a.order - b.order)
              const qScheduledFuture = Boolean(q.validFrom && q.validFrom > logicalToday)
              const qRetired = isRetired(q)

              return (
                <div
                  key={q.id}
                  className={`sticker-card p-3.5 space-y-3 border-2 border-[var(--color-line)] ${
                    qRetired ? 'opacity-55' : ''
                  }`}
                >
                  {/* Inline Question Editing or Normal Header */}
                  {editingQuestionId === q.id ? (
                    <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border-2 border-[var(--color-accent)] space-y-2.5">
                      <label className="font-bold text-xs text-[var(--color-ink)] block">
                        Edit Question Label
                      </label>
                      <input
                        type="text"
                        maxLength={LIMITS.QUESTION_LABEL}
                        value={editingQuestionLabel}
                        onChange={(e) => setEditingQuestionLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateQuestion(q.id)}
                        className="w-full p-2 text-xs rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-[var(--color-ink)]"
                      />

                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
                          Question Icon
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {['Sparkles', 'Clock', 'BookOpen', 'Heart', 'Smile', 'Activity', 'FileText', 'Coffee', 'Award', 'Zap', 'Sun', 'Moon'].map((icName) => (
                            <button
                              key={icName}
                              type="button"
                              onClick={() => setEditingQuestionIcon(icName)}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                editingQuestionIcon === icName
                                  ? 'bg-[var(--color-accent)] text-white shadow-xs font-bold'
                                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
                              }`}
                            >
                              {icName}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Repeats Toggle */}
                      {!q.parentId && (
                        <label className="flex items-center justify-between p-2 rounded border border-[var(--color-line)] bg-[var(--color-surface)] cursor-pointer">
                          <div>
                            <span className="text-[11px] font-bold text-[var(--color-ink)] block">
                              Allow multiple sessions per day
                            </span>
                            <span className="text-[10px] text-[var(--color-ink-soft)]">
                              Enable adding repeated entries (e.g. multiple meals or workouts)
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={editingQuestionRepeats}
                            onChange={(e) => setEditingQuestionRepeats(e.target.checked)}
                            className="w-4 h-4 accent-[var(--color-accent)]"
                          />
                        </label>
                      )}

                      {/* Weekday Schedule */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
                          Weekday Schedule (blank = every day)
                        </span>
                        <div className="flex items-center gap-1">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dayLabel, dayIdx) => {
                            const active = editingQuestionWeekdays.includes(dayIdx)
                            return (
                              <button
                                key={dayLabel}
                                type="button"
                                onClick={() =>
                                  setEditingQuestionWeekdays((prev) =>
                                    prev.includes(dayIdx)
                                      ? prev.filter((d) => d !== dayIdx)
                                      : [...prev, dayIdx]
                                  )
                                }
                                className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-colors ${
                                  active
                                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                                    : 'bg-[var(--color-surface)] text-[var(--color-ink-soft)] border-[var(--color-line)]'
                                }`}
                              >
                                {dayLabel}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Visibility Rule (showWhen) */}
                      <div className="space-y-1.5 pt-1 border-t border-[var(--color-line)]">
                        <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
                          Conditional Visibility (showWhen)
                        </span>
                        <select
                          value={editingQuestionShowWhenMode}
                          onChange={(e) =>
                            setEditingQuestionShowWhenMode(
                              e.target.value as 'always' | 'truthy' | 'eq' | 'cycleActive'
                            )
                          }
                          className="w-full p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] text-[11px] font-semibold text-[var(--color-ink)]"
                        >
                          <option value="always">Always visible</option>
                          <option value="cycleActive">Only when a period cycle is active</option>
                          <option value="truthy">Only when a part is answered (truthy)</option>
                          <option value="eq">Only when a part equals a specific value</option>
                        </select>

                        {(editingQuestionShowWhenMode === 'truthy' ||
                          editingQuestionShowWhenMode === 'eq') && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <select
                              value={editingQuestionShowWhenPartId}
                              onChange={(e) => setEditingQuestionShowWhenPartId(e.target.value)}
                              className="w-full p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] text-[11px] text-[var(--color-ink)]"
                            >
                              <option value="">Select trigger part...</option>
                              {allActivePartsForConditions
                                .filter((p) => p.questionId !== q.id)
                                .map((p) => {
                                  const pq = questions.find((item) => item.id === p.questionId)
                                  return (
                                    <option key={p.id} value={p.id}>
                                      {pq ? `${pq.label}: ${p.label}` : p.label}
                                    </option>
                                  )
                                })}
                            </select>

                            {editingQuestionShowWhenMode === 'eq' && (
                              <input
                                type="text"
                                placeholder="Target value (e.g. true, 5)"
                                value={editingQuestionShowWhenValue}
                                onChange={(e) => setEditingQuestionShowWhenValue(e.target.value)}
                                className="w-full p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] text-[11px] text-[var(--color-ink)]"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingQuestionId(null)}
                          className="py-1.5 px-3 text-xs text-[var(--color-ink-soft)] font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!editingQuestionLabel.trim()}
                          onClick={() => handleUpdateQuestion(q.id)}
                          className="py-1.5 px-4 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold disabled:opacity-50"
                        >
                          Save Question
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Question Card Header */
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-xs text-[var(--color-ink)] flex flex-wrap items-center gap-1.5">
                          <span>{q.label}</span>
                          {q.repeats && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                              Repeating
                            </span>
                          )}
                          {q.schedule?.weekdays && q.schedule.weekdays.length > 0 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink-soft)]">
                              {q.schedule.weekdays
                                .map((d) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d])
                                .join(',')}
                            </span>
                          )}
                          {q.showWhen && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink-soft)]">
                              Conditional
                            </span>
                          )}
                          {qScheduledFuture && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
                              From {q.validFrom}
                            </span>
                          )}
                          {qRetired && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700">
                              Retired {q.validTo}
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-[var(--color-ink-soft)]">
                          {qParts.length} input parts {q.icon ? `· Icon: ${q.icon}` : ''}
                        </span>
                      </div>

                      {/* Question Actions */}
                      <div className="flex items-center space-x-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleReorderQuestion(q.id, 'up')}
                          className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-[var(--color-bg)] disabled:opacity-20 active:scale-90"
                          title="Move up"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === currentQuestions.length - 1}
                          onClick={() => handleReorderQuestion(q.id, 'down')}
                          className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-[var(--color-bg)] disabled:opacity-20 active:scale-90"
                          title="Move down"
                        >
                          <ArrowDown size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => startEditingQuestion(q)}
                          className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg)] active:scale-90"
                          title="Edit question, schedule & conditions"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setMovingQuestionId(movingQuestionId === q.id ? null : q.id)
                          }
                          className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg)] active:scale-90"
                          title="Move to another section"
                        >
                          <ArrowRightLeft size={13} />
                        </button>

                        {!qRetired && (
                          <button
                            type="button"
                            onClick={() => handleRetireQuestion(q.id)}
                            className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:text-rose-600 hover:bg-[var(--color-bg)] active:scale-90"
                            title="Retire question"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

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

                          <div className="flex items-center space-x-1">
                            {/* 1-Tap Core / Extra Toggle Chip */}
                            <button
                              type="button"
                              onClick={() => handleTogglePartLevel(p)}
                              className={`py-1 px-2.5 min-h-[28px] rounded-full text-[9px] font-extrabold transition-transform active:scale-90 ${
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
                              className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)] active:scale-90"
                              title="Edit Part"
                            >
                              <Edit2 size={13} />
                            </button>

                            {/* X Retire */}
                            {!isRetired(p) && (
                              <button
                                type="button"
                                onClick={() => handleRetirePart(p.id)}
                                className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:text-rose-600 hover:bg-[var(--color-surface)] active:scale-90"
                                title="Retire Part"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Sub-Questions list & inline authoring */}
                  {subQuestions.length > 0 && (
                    <div className="pl-3 border-l-2 border-[var(--color-line)] space-y-2 mt-2">
                      <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
                        Sub-questions ({subQuestions.length})
                      </span>
                      {subQuestions.map((sq) => {
                        const sqParts = parts
                          .filter((p) => p.questionId === sq.id && (showRetired || !isRetired(p)))
                          .sort((a, b) => a.order - b.order)
                        return (
                          <div
                            key={sq.id}
                            className="p-2.5 rounded-[var(--radius-m)] bg-[var(--color-surface)] border border-[var(--color-line)] space-y-2"
                          >
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-[11px] font-bold text-[var(--color-ink)]">
                                {sq.label}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingPartModal({
                                      isOpen: true,
                                      questionId: sq.id,
                                      part: undefined,
                                    })
                                  }
                                  className="px-2 py-0.5 rounded-full border border-[var(--color-line)] text-[10px] font-semibold text-[var(--color-accent)]"
                                >
                                  + Part
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRetireQuestion(sq.id)}
                                  className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-rose-500 hover:text-rose-700"
                                  title="Retire sub-question"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            {sqParts.length > 0 && (
                              <div className="space-y-1">
                                {sqParts.map((sp) => (
                                  <div
                                    key={sp.id}
                                    className="px-2 py-1 rounded bg-[var(--color-bg)] flex items-center justify-between text-[10px]"
                                  >
                                    <span>
                                      <strong className="text-[var(--color-ink)]">{sp.label}</strong>{' '}
                                      <span className="text-[var(--color-ink-soft)]">({sp.kind})</span>
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingPartModal({
                                            isOpen: true,
                                            questionId: sq.id,
                                            part: sp,
                                          })
                                        }
                                        className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-accent)]"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                      {!isRetired(sp) && (
                                        <button
                                          type="button"
                                          onClick={() => handleRetirePart(sp.id)}
                                          className="p-1 text-[var(--color-ink-soft)] hover:text-rose-600"
                                        >
                                          <X size={11} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Inline Add Sub-Question Input */}
                  {addingSubForQuestionId === q.id && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        maxLength={LIMITS.QUESTION_LABEL}
                        placeholder="Sub-question label (e.g. Workout notes, How hard?)..."
                        value={newSubLabel}
                        onChange={(e) => setNewSubLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateSubQuestion(q)}
                        className="flex-1 p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateSubQuestion(q)}
                        className="py-1.5 px-3 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingSubForQuestionId(null)
                          setNewSubLabel('')
                        }}
                        className="py-1.5 px-2 text-[10px] text-[var(--color-ink-soft)]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Card Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-[var(--color-line)]">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPartModal({
                          isOpen: true,
                          questionId: q.id,
                          part: undefined,
                        })
                      }
                      className="py-1.5 px-3 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-line)] text-[10px] font-semibold text-[var(--color-accent)] flex items-center space-x-1 active:scale-95"
                    >
                      <Plus size={11} />
                      <span>Add Part</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAddingSubForQuestionId(q.id)
                        setNewSubLabel('')
                      }}
                      className="py-1.5 px-3 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-line)] text-[10px] font-semibold text-[var(--color-ink)] flex items-center space-x-1 active:scale-95"
                    >
                      <Plus size={11} />
                      <span>Sub-question</span>
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
                maxLength={LIMITS.QUESTION_LABEL}
                placeholder="e.g. Did you workout today?, Reading time, Creative writing..."
                value={newQuestionLabel}
                onChange={(e) => setNewQuestionLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateQuestion()}
                className="w-full p-2 text-xs rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-[var(--color-ink)]"
              />
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
                  Question Icon
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['Sparkles', 'Clock', 'BookOpen', 'Heart', 'Smile', 'Activity', 'FileText', 'Coffee', 'Award', 'Zap', 'Sun', 'Moon'].map((icName) => (
                    <button
                      key={icName}
                      type="button"
                      onClick={() => setNewQuestionIcon(icName)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                        newQuestionIcon === icName
                          ? 'bg-[var(--color-accent)] text-white shadow-xs font-bold'
                          : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
                      }`}
                    >
                      {icName}
                    </button>
                  ))}
                </div>
              </div>

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
