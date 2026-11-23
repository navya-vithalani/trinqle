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
 * Checks whether a single question is visible given the current answers, date, and cycle state.
 */
export function isQuestionVisible(
  q: Question,
  snapshot: FormSnapshot,
  answers: Answer[],
  date: string,
  cycleActive: boolean
): boolean {
  // Find question's section to verify scope
  const section = snapshot.sections?.find((s) => s.id === q.sectionId)
  if (section) {
    // 1. Chapter reflection section is NEVER part of the nightly form
    if (section.scope === 'chapterEnd') {
      return false
    }

    // 2. Weekly review only appears on Sundays (day 0)
    if (section.scope === 'weekly') {
      const [y, m, d] = date.split('-').map(Number)
      const dayOfWeek = new Date(y, m - 1, d).getDay()
      if (dayOfWeek !== 0) {
        return false
      }
    }
  }

  // 3. Question-level schedule: weekdays (0 = Sunday .. 6 = Saturday)
  if (q.schedule?.weekdays && q.schedule.weekdays.length > 0) {
    const [y, m, d] = date.split('-').map(Number)
    const dayOfWeek = new Date(y, m - 1, d).getDay()
    if (!q.schedule.weekdays.includes(dayOfWeek)) {
      return false
    }
  }

  // 4. Chapter end question schedule
  if (q.schedule?.chapterEnd) {
    return false
  }

  // 5. Conditional visibility (showWhen)
  if (q.showWhen) {
    const rule: ShowWhenRule = q.showWhen

    if (rule.cycleActive !== undefined) {
      if (rule.cycleActive !== cycleActive) return false
    }

    if (rule.partId) {
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
 * Completeness rule (PRD F4 & TRD 5):
 * - Core parts required.
 * - Core yes/no gates must be answered (true or false). Leaving unselected (undefined) is missing.
 * - Core parts under a gate are required ONLY when the gate is true.
 * - A repeating question with its gate on needs at least one session where all core parts are filled.
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
      const gateAns = answers.find((a) => a.partId === gatePart.id && a.instance === 0)
      const isGateAnswered = gateAns && typeof gateAns.value === 'boolean'
      const isGateOn = gateAns ? gateAns.value === true : false

      // Gate must be answered if it is core
      if (gatePart.level === 'core' && !isGateAnswered) {
        missingPartIds.push(gatePart.id)
      }

      // If gate is not turned on (false or unanswered), sibling parts are skipped
      if (!isGateOn) {
        continue
      }

      // Gate is true: sibling core parts become required!
      const siblingCoreParts = qParts.filter((p) => !p.gate && p.level === 'core')

      if (q.repeats) {
        const instances = Array.from(
          new Set(
            answers
              .filter((a) => a.questionId === q.id && a.partId !== gatePart.id)
              .map((a) => a.instance)
          )
        )

        if (instances.length === 0) {
          siblingCoreParts.forEach((p) => missingPartIds.push(p.id))
        } else {
          const hasCompleteSession = instances.some((inst) => {
            return siblingCoreParts.every((p) => {
              const ans = answers.find((a) => a.partId === p.id && a.instance === inst)
              return isPartAnswered(p, ans?.value)
            })
          })

          if (!hasCompleteSession) {
            siblingCoreParts.forEach((p) => {
              const anyAnswered = answers.some((a) => a.partId === p.id)
              if (!anyAnswered) missingPartIds.push(p.id)
            })
          }
        }
      } else {
        for (const p of siblingCoreParts) {
          const ans = answers.find((a) => a.partId === p.id && a.instance === 0)
          if (!isPartAnswered(p, ans?.value)) {
            missingPartIds.push(p.id)
          }
        }
      }
    } else {
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
