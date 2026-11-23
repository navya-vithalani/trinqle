import type {
  Question,
  Part,
  Answer,
  AnswerValue,
  EntryMode,
  ShowWhenRule,
  TimeRangeValue,
} from '../data/types'

export interface FormSnapshot {
  questions: Question[]
  parts: Part[]
}

/**
 * Checks whether a single question is visible given the current answers, date, and cycle state.
 */
export function isQuestionVisible(
  q: Question,
  answers: Answer[],
  date: string,
  cycleActive: boolean
): boolean {
  // 1. Cycle-specific question (e.g. Period question)
  if (q.special === 'cycle') {
    // If question is scheduled only while period active, or general cycle question
    if (q.schedule?.weekdays === undefined) {
      // visible anytime, but UI presents start/end period conditionally
      return true
    }
  }

  // 2. Schedule rules: weekdays (0 = Sunday .. 6 = Saturday)
  if (q.schedule?.weekdays && q.schedule.weekdays.length > 0) {
    const [y, m, d] = date.split('-').map(Number)
    const dayOfWeek = new Date(y, m - 1, d).getDay()
    if (!q.schedule.weekdays.includes(dayOfWeek)) {
      return false
    }
  }

  // 3. Conditional visibility (showWhen)
  if (q.showWhen) {
    const rule: ShowWhenRule = q.showWhen

    if (rule.cycleActive !== undefined) {
      if (rule.cycleActive !== cycleActive) return false
    }

    if (rule.partId) {
      // Find the answer for this part (instance 0)
      const ans = answers.find((a) => a.partId === rule.partId && a.instance === 0)
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
 * Returns the list of visible questions for a date and entry mode.
 * In Quick mode: shows questions that have at least one core part (unless expandedMore is true).
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
    // 1. Is question visible by schedule / showWhen?
    if (!isQuestionVisible(q, answers, date, cycleActive)) {
      return false
    }

    // 2. Mode filter:
    if (mode === 'quick' && !expandedMore) {
      // Must contain at least one active core part
      const qParts = snapshot.parts.filter((p) => p.questionId === q.id)
      const hasCorePart = qParts.some((p) => p.level === 'core')
      if (!hasCorePart) return false
    }

    return true
  })
}

/**
 * Checks whether a part has a complete/valid answer.
 * Core yesno parts start at false and count as answered.
 */
export function isPartAnswered(part: Part, value: AnswerValue | undefined): boolean {
  if (part.kind === 'yesno') {
    // false or true counts as answered
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
 * Completeness rule (PRD F4 & TRD 5):
 * - A night saves only when every required core part is answered.
 * - Core yes/no toggles start visibly at "No" and count as answered.
 * - Core parts under a gate are required ONLY when the gate is true.
 * - A repeating question with its gate on needs at least one session where all core parts are filled.
 * - Untouched extras are missing.
 */
export function checkCompleteness(
  snapshot: FormSnapshot,
  date: string,
  mode: EntryMode,
  answers: Answer[],
  cycleActive: boolean
): CompletenessResult {
  const missingPartIds: string[] = []
  const questions = visibleQuestions(snapshot, date, mode, answers, cycleActive, true)

  for (const q of questions) {
    const qParts = snapshot.parts.filter((p) => p.questionId === q.id)
    const gatePart = qParts.find((p) => p.gate)

    if (gatePart) {
      // Find gate value (instance 0)
      const gateAns = answers.find((a) => a.partId === gatePart.id && a.instance === 0)
      const isGateOn = gateAns ? !!gateAns.value : false

      // If gate is core, gate itself must be answered (defaults to false so answered)
      if (gatePart.level === 'core') {
        const hasGateVal = answers.some((a) => a.partId === gatePart.id)
        if (!hasGateVal) {
          missingPartIds.push(gatePart.id)
        }
      }

      // If gate is false, sibling parts are skipped and NOT required!
      if (!isGateOn) {
        continue
      }

      // Gate is true: sibling core parts become required!
      const siblingCoreParts = qParts.filter((p) => !p.gate && p.level === 'core')

      if (q.repeats) {
        // Need at least one complete session
        const instances = Array.from(
          new Set(
            answers
              .filter((a) => a.questionId === q.id && a.partId !== gatePart.id)
              .map((a) => a.instance)
          )
        )

        if (instances.length === 0) {
          // No sessions added yet
          siblingCoreParts.forEach((p) => missingPartIds.push(p.id))
        } else {
          // At least one session must have all sibling core parts answered
          const hasAtLeastOneCompleteSession = instances.some((inst) => {
            return siblingCoreParts.every((p) => {
              const ans = answers.find((a) => a.partId === p.id && a.instance === inst)
              return isPartAnswered(p, ans?.value)
            })
          })

          if (!hasAtLeastOneCompleteSession) {
            siblingCoreParts.forEach((p) => {
              const anyAnswered = answers.some((a) => a.partId === p.id)
              if (!anyAnswered) missingPartIds.push(p.id)
            })
          }
        }
      } else {
        // Non-repeating gated question
        for (const p of siblingCoreParts) {
          const ans = answers.find((a) => a.partId === p.id && a.instance === 0)
          if (!isPartAnswered(p, ans?.value)) {
            missingPartIds.push(p.id)
          }
        }
      }
    } else {
      // Ungated question
      const coreParts = qParts.filter((p) => p.level === 'core')

      if (q.repeats) {
        const instances = Array.from(
          new Set(
            answers
              .filter((a) => a.questionId === q.id)
              .map((a) => a.instance)
          )
        )

        if (instances.length === 0) {
          // If repeating question has core parts, requires at least one session
          if (coreParts.length > 0) {
            coreParts.forEach((p) => missingPartIds.push(p.id))
          }
        } else {
          for (const inst of instances) {
            for (const p of coreParts) {
              const ans = answers.find((a) => a.partId === p.id && a.instance === inst)
              if (!isPartAnswered(p, ans?.value)) {
                if (!missingPartIds.includes(p.id)) missingPartIds.push(p.id)
              }
            }
          }
        }
      } else {
        for (const p of coreParts) {
          const ans = answers.find((a) => a.partId === p.id && a.instance === 0)
          if (!isPartAnswered(p, ans?.value)) {
            missingPartIds.push(p.id)
          }
        }
      }
    }
  }

  return {
    complete: missingPartIds.length === 0,
    missingPartIds,
  }
}

/**
 * Checks for overlapping sessions among time range answers within the same question.
 */
export function checkOverlappingTimeRanges(
  timeAnswers: { start: string; end: string; crossesMidnight: boolean }[]
): boolean {
  if (timeAnswers.length <= 1) return false

  // Convert each to [startMin, endMin]
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

  // Compare each pair
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
