import type {
  Section,
  Question,
  Part,
  Answer,
  AnswerValue,
  EntryMode,
  ShowWhenRule,
  TimeRangeValue,
} from '../data/types'

export interface FormSnapshot {
  sections?: Section[]
  questions: Question[]
  parts: Part[]
}

/**
 * Checks whether a single question's own schedule, section scope, and showWhen rule pass.
 * Does not traverse parentId — use isQuestionReachable() for full reachability.
 */
function passesOwnVisibility(
  q: Question,
  snapshot: FormSnapshot,
  answers: Answer[],
  date: string,
  cycleActive: boolean,
  instance = 0
): boolean {
  const section = snapshot.sections?.find((s) => s.id === q.sectionId)
  if (section) {
    if (section.scope === 'chapterEnd') {
      return false
    }
    if (section.scope === 'weekly') {
      const [y, m, d] = date.split('-').map(Number)
      const dayOfWeek = new Date(y, m - 1, d).getDay()
      if (dayOfWeek !== 0) {
        return false
      }
    }
  }

  if (q.schedule?.weekdays && q.schedule.weekdays.length > 0) {
    const [y, m, d] = date.split('-').map(Number)
    const dayOfWeek = new Date(y, m - 1, d).getDay()
    if (!q.schedule.weekdays.includes(dayOfWeek)) {
      return false
    }
  }

  if (q.schedule?.chapterEnd) {
    return false
  }

  if (q.showWhen) {
    const rule: ShowWhenRule = q.showWhen

    if (rule.cycleActive !== undefined) {
      if (rule.cycleActive !== cycleActive) return false
    }

    if (rule.partId) {
      const ans =
        answers.find((a) => a.partId === rule.partId && a.instance === instance) ??
        answers.find((a) => a.partId === rule.partId && a.instance === 0)
      const val = ans ? ans.value : null

      if (rule.op === 'truthy') {
        if (!val) return false
      } else if (rule.op === 'eq') {
        if (val !== rule.value) return false
      } else if (rule.op === 'in' && Array.isArray(rule.value)) {
        if (!rule.value.includes(val)) return false
      }
    }
  }

  return true
}

/**
 * Checks whether a question is reachable through its section scope, schedule, showWhen,
 * and full parentId + parent gate chain.
 */
export function isQuestionVisible(
  q: Question,
  snapshot: FormSnapshot,
  answers: Answer[],
  date: string,
  cycleActive: boolean,
  instance = 0,
  visited = new Set<string>()
): boolean {
  if (visited.has(q.id)) return false
  visited.add(q.id)

  if (!passesOwnVisibility(q, snapshot, answers, date, cycleActive, instance)) {
    return false
  }

  if (q.parentId) {
    const parent = snapshot.questions.find((cand) => cand.id === q.parentId)
    if (!parent) return false
    if (!isQuestionVisible(parent, snapshot, answers, date, cycleActive, instance, visited)) {
      return false
    }
    const parentGates = snapshot.parts.filter((p) => p.questionId === parent.id && p.gate)
    const gateInst = parent.parentId ? instance : 0
    for (const gp of parentGates) {
      const gateAns = answers.find((a) => a.partId === gp.id && a.instance === gateInst)
      if (!gateAns || gateAns.value !== true) {
        return false
      }
    }
  }

  return true
}

/**
 * Single source of truth for whether a specific part is currently reachable in UI & completeness.
 * Reachable means: owning question is visible through its full parent/gate/showWhen/schedule/scope chain,
 * and if the part is not a gate on its question, all gate parts on that question are true.
 */
export function isPartReachable(
  part: Part,
  snapshot: FormSnapshot,
  answers: Answer[],
  date: string,
  cycleActive: boolean,
  instance = 0,
  options?: { mode?: EntryMode; expandedMore?: boolean }
): boolean {
  const q = snapshot.questions.find((cand) => cand.id === part.questionId)
  if (!q) return false

  if (!isQuestionVisible(q, snapshot, answers, date, cycleActive, instance)) {
    return false
  }

  // In quick mode (without expandedMore), non-core parts and questions without core parts are hidden
  if (options?.mode === 'quick' && !options.expandedMore) {
    if (part.level !== 'core') return false
    let root: Question = q
    while (root.parentId) {
      const parent = snapshot.questions.find((cand) => cand.id === root.parentId)
      if (!parent) break
      root = parent
    }
    const rootParts = snapshot.parts.filter((p) => p.questionId === root.id)
    if (!rootParts.some((p) => p.level === 'core')) {
      return false
    }
  }

  if (!part.gate) {
    const qGates = snapshot.parts.filter((p) => p.questionId === q.id && p.gate)
    const gateInst = q.parentId ? instance : 0
    for (const gp of qGates) {
      const gateAns = answers.find((a) => a.partId === gp.id && a.instance === gateInst)
      if (!gateAns || gateAns.value !== true) {
        return false
      }
    }
  }

  return true
}

/**
 * Returns the list of visible questions for a date and entry mode.
 */
export function visibleQuestions(
  snapshot: FormSnapshot,
  date: string,
  mode: EntryMode,
  answers: Answer[],
  cycleActive: boolean,
  expandedMore = false
): Question[] {
  return snapshot.questions.filter((q) => {
    if (!isQuestionVisible(q, snapshot, answers, date, cycleActive)) {
      return false
    }

    if (mode === 'quick' && !expandedMore) {
      const qParts = snapshot.parts.filter((p) => p.questionId === q.id)
      const hasCorePart = qParts.some((p) => p.level === 'core')
      if (!hasCorePart) return false
    }

    return true
  })
}

/**
 * Checks whether a part has a complete/valid answer.
 */
export function isPartAnswered(part: Part, value: AnswerValue | undefined): boolean {
  if (part.kind === 'yesno') {
    return typeof value === 'boolean'
  }

  if (value === null || value === undefined || value === '') {
    return false
  }

  if (part.kind === 'scale' || part.kind === 'number') {
    return typeof value === 'number' && !isNaN(value)
  }

  if (part.kind === 'text') {
    return typeof value === 'string' && value.trim().length > 0
  }

  if (part.kind === 'library') {
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return typeof value === 'string' && value.length > 0
  }

  if (part.kind === 'timerange') {
    const tr = value as TimeRangeValue
    return !!(tr && tr.start && tr.end)
  }

  return true
}

export interface CompletenessResult {
  complete: boolean
  missingPartIds: string[]
}

/**
 * Completeness rule:
 * A part is required if and only if it is `core` AND currently reachable (`isPartReachable`).
 * - Core yes/no gates must be answered (true or false). Leaving unselected (undefined) is missing.
 * - Sibling core parts and sub-question core parts under a gate are required ONLY when the gate is true.
 * - A repeating question with its gate on needs at least one complete session; without a gate, every started session must be complete.
 */
export function checkCompleteness(
  snapshot: FormSnapshot,
  date: string,
  mode: EntryMode,
  answers: Answer[],
  cycleActive: boolean
): CompletenessResult {
  const missingPartIds: string[] = []
  const addMissing = (partId: string) => {
    if (!missingPartIds.includes(partId)) {
      missingPartIds.push(partId)
    }
  }

  const collectMissingForQuestionInstance = (
    q: Question,
    instance: number,
    options?: { mode?: EntryMode; expandedMore?: boolean }
  ): string[] => {
    const missing: string[] = []
    const qParts = snapshot.parts.filter((p) => p.questionId === q.id)
    for (const p of qParts) {
      if (p.level !== 'core') continue
      const inst = p.gate && !q.parentId ? 0 : instance
      if (!isPartReachable(p, snapshot, answers, date, cycleActive, instance, options)) {
        continue
      }
      const ans = answers.find((a) => a.partId === p.id && a.instance === inst)
      if (!isPartAnswered(p, ans?.value)) {
        missing.push(p.id)
      }
    }

    const childQuestions = snapshot.questions.filter((sq) => sq.parentId === q.id)
    for (const sq of childQuestions) {
      missing.push(...collectMissingForQuestionInstance(sq, instance, options))
    }

    return missing
  }

  const checkOptions = { mode, expandedMore: true }
  const topLevelQuestions = snapshot.questions.filter((q) => !q.parentId)

  for (const q of topLevelQuestions) {
    if (!isQuestionVisible(q, snapshot, answers, date, cycleActive, 0)) {
      continue
    }

    const qParts = snapshot.parts.filter((p) => p.questionId === q.id)
    const gateParts = qParts.filter((p) => p.gate)

    if (gateParts.length > 0) {
      let allGatesOn = true
      for (const gp of gateParts) {
        const gateAns = answers.find((a) => a.partId === gp.id && a.instance === 0)
        const isGateAnswered = gateAns && typeof gateAns.value === 'boolean'
        if (gp.level === 'core' && !isGateAnswered) {
          addMissing(gp.id)
        }
        if (!gateAns || gateAns.value !== true) {
          allGatesOn = false
        }
      }

      if (!allGatesOn) {
        continue
      }

      if (q.repeats) {
        const subtreeIds = collectSubtreeQuestionIds(q.id, snapshot.questions)
        const gateIds = new Set(gateParts.map((gp) => gp.id))
        const instances = Array.from(
          new Set(
            answers
              .filter((a) => subtreeIds.has(a.questionId) && !gateIds.has(a.partId))
              .map((a) => a.instance)
          )
        )

        if (instances.length === 0) {
          collectMissingForQuestionInstance(q, 0, checkOptions).forEach(addMissing)
        } else {
          const perInstanceMissing = instances.map((inst) =>
            collectMissingForQuestionInstance(q, inst, checkOptions)
          )
          const hasCompleteSession = perInstanceMissing.some((m) => m.length === 0)
          if (!hasCompleteSession) {
            perInstanceMissing[0].forEach(addMissing)
          }
        }
      } else {
        collectMissingForQuestionInstance(q, 0, checkOptions).forEach(addMissing)
      }
    } else if (q.repeats) {
      const subtreeIds = collectSubtreeQuestionIds(q.id, snapshot.questions)
      const instances = Array.from(
        new Set(
          answers
            .filter((a) => subtreeIds.has(a.questionId))
            .map((a) => a.instance)
        )
      )

      if (instances.length === 0) {
        collectMissingForQuestionInstance(q, 0, checkOptions).forEach(addMissing)
      } else {
        for (const inst of instances) {
          collectMissingForQuestionInstance(q, inst, checkOptions).forEach(addMissing)
        }
      }
    } else {
      collectMissingForQuestionInstance(q, 0, checkOptions).forEach(addMissing)
    }
  }

  return {
    complete: missingPartIds.length === 0,
    missingPartIds,
  }
}

function collectSubtreeQuestionIds(rootId: string, allQuestions: Question[]): Set<string> {
  const result = new Set<string>([rootId])
  let added = true
  while (added) {
    added = false
    for (const q of allQuestions) {
      if (q.parentId && result.has(q.parentId) && !result.has(q.id)) {
        result.add(q.id)
        added = true
      }
    }
  }
  return result
}

/**
 * Checks for overlapping sessions among time range answers within the same question.
 */
export function checkOverlappingTimeRanges(
  timeAnswers: { start: string; end: string; crossesMidnight: boolean }[]
): boolean {
  if (timeAnswers.length <= 1) return false

  const intervals = timeAnswers.map((t) => {
    const [sh, sm] = t.start.split(':').map(Number)
    const [eh, em] = t.end.split(':').map(Number)
    const startMin = sh * 60 + sm
    let endMin = eh * 60 + em
    if (t.crossesMidnight || endMin < startMin) {
      endMin += 24 * 60
    }
    return { startMin, endMin }
  })

  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i]
      const b = intervals[j]
      if (Math.max(a.startMin, b.startMin) < Math.min(a.endMin, b.endMin)) {
        return true
      }
    }
  }

  return false
}
