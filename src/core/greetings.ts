import greetingsData from '../content/greetings.json'
import type { TrinqleDB } from '../data/db'
import { db as defaultDb } from '../data/db'
import { addDays, DEFAULT_WINDOW, isWindowOpen, logicalDate } from './logicalDay'
import { calculateChapterDuration } from './chapters'
import { loadAppSettings } from './settings'
import { buildDailyMetricsTable } from './metrics/calculator'

export interface GreetingContext {
  daysOfData: number
  loggingStreak: number
  missedYesterday: boolean
  missedDaysLast3: number
  filledToday: boolean
  formOpen: boolean
  windowEnd: string
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  weekday: number // 0=Sun..6=Sat
  chapterNumber: number
  chapterDay: number
  chapterDaysLeft: number
  periodActive: boolean
  periodDay: number
  memorableDayLast3: boolean
  backupDaysAgo: number
  // Aliases (optional)
  mood3?: number
  moodDelta?: number
  sleep3Hours?: number
  sleepLowDays3?: number
  exerciseDays3?: number
  studyDays3?: number
  studyMinutes3?: number
  water3avg?: number
  [key: string]: unknown
}

export interface GreetingCondition {
  key: string
  op: '<' | '<=' | '>' | '>=' | '==' | '!=' | 'in'
  value: unknown
}

export interface GreetingRule {
  id: string
  priority: number
  when: GreetingCondition[]
  lines: string[]
}

/**
 * Evaluates a single condition against the context.
 */
export function evaluateCondition(cond: GreetingCondition, ctx: GreetingContext): boolean {
  const ctxVal = ctx[cond.key]
  if (ctxVal === undefined) return false

  switch (cond.op) {
    case '==':
      return ctxVal === cond.value
    case '!=':
      return ctxVal !== cond.value
    case '<':
      return (ctxVal as number) < (cond.value as number)
    case '<=':
      return (ctxVal as number) <= (cond.value as number)
    case '>':
      return (ctxVal as number) > (cond.value as number)
    case '>=':
      return (ctxVal as number) >= (cond.value as number)
    case 'in':
      return Array.isArray(cond.value) && cond.value.includes(ctxVal)
    default:
      return false
  }
}

/**
 * Checks whether all conditions of a rule match the context.
 */
export function matchesRule(rule: GreetingRule, ctx: GreetingContext): boolean {
  if (!rule.when || rule.when.length === 0) return true
  return rule.when.every((c) => evaluateCondition(c, ctx))
}

/**
 * Replaces {{key}} tokens with values from the context.
 */
export function interpolateTokens(line: string, ctx: GreetingContext): string {
  return line.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const val = ctx[key]
    return val !== undefined && val !== null ? String(val) : ''
  })
}

/**
 * Deterministic pseudo-random number generator for stable line selection given date + ruleId.
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Evaluates rules from greetings.json against the provided context
 * and returns the best greeting text and matched rule id.
 */
export function evaluateGreetings(
  ctx: GreetingContext,
  dateStr: string,
  rules: GreetingRule[] = greetingsData.rules as GreetingRule[]
): { text: string; ruleId: string } {
  const matched = rules.filter((r) => matchesRule(r, ctx))

  if (matched.length === 0) {
    return { text: 'Welcome back.', ruleId: 'fallback' }
  }

  // Find highest priority tier
  const highestPriority = Math.max(...matched.map((r) => r.priority))
  const topTier = matched.filter((r) => r.priority === highestPriority)

  // Stable pick among top tier and its lines
  const hash = hashString(`${dateStr}-${topTier.length}`)
  const pickedRule = topTier[hash % topTier.length]

  const lineHash = hashString(`${dateStr}-${pickedRule.id}`)
  const pickedLine = pickedRule.lines[lineHash % pickedRule.lines.length]

  return {
    text: interpolateTokens(pickedLine, ctx),
    ruleId: pickedRule.id,
  }
}

/**
 * Builds GreetingContext from database state for a given date/time.
 */
export async function buildGreetingContext(
  now: Date,
  db: TrinqleDB = defaultDb
): Promise<{ context: GreetingContext; dateStr: string }> {
  const settings = await loadAppSettings(db).catch(() => ({
    userName: '',
    formWindowStart: '21:00',
    formWindowEnd: '03:00',
    windowStartHour: DEFAULT_WINDOW.startHour,
    windowEndHour: DEFAULT_WINDOW.endHour,
    weekStart: 'Monday' as const,
    timeFormat: '12h' as const,
  }))

  const dateStr = logicalDate(now, undefined, settings.windowEndHour)
  const [year, month, day] = dateStr.split('-').map(Number)
  const weekday = new Date(year, month - 1, day).getDay()

  const currentHour = now.getHours()
  let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning'
  if (currentHour >= 5 && currentHour < 12) timeOfDay = 'morning'
  else if (currentHour >= 12 && currentHour < 17) timeOfDay = 'afternoon'
  else if (currentHour >= 17 && currentHour < 22) timeOfDay = 'evening'
  else timeOfDay = 'night'

  const formOpen = isWindowOpen(now, settings.windowStartHour, settings.windowEndHour)
  const windowEnd = settings.formWindowEnd || '03:00'

  // DB queries
  const allDays = await db.days.filter((d) => !d.deletedAt).toArray()
  const daysOfData = allDays.length

  const todayDay = allDays.find((d) => d.date === dateStr)
  const filledToday = !!todayDay

  // Streak calculation
  let loggingStreak = filledToday ? 1 : 0
  let checkDate = addDays(dateStr, -1)
  while (allDays.some((d) => d.date === checkDate)) {
    loggingStreak++
    checkDate = addDays(checkDate, -1)
  }

  // Missed yesterday / last 3 days
  const yesterdayStr = addDays(dateStr, -1)
  const missedYesterday = !allDays.some((d) => d.date === yesterdayStr)

  let missedDaysLast3 = 0
  let memorableDayLast3 = false
  for (let i = 1; i <= 3; i++) {
    const dStr = addDays(dateStr, -i)
    const found = allDays.find((d) => d.date === dStr)
    if (!found) {
      missedDaysLast3++
    } else if (found.memorability > 0) {
      memorableDayLast3 = true
    }
  }

  // Chapter info
  const allChapters = await db.chapters.orderBy('startDate').toArray()
  const openChapter = allChapters.find((c) => c.status === 'open') || allChapters[allChapters.length - 1]

  let chapterNumber = 1
  let chapterDay = 1
  let chapterDaysLeft = 28
  if (openChapter) {
    chapterNumber = Math.max(1, allChapters.indexOf(openChapter) + 1)
    const [sy, sm, sd] = openChapter.startDate.split('-').map(Number)
    const startMs = Date.UTC(sy, sm - 1, sd)
    const curMs = Date.UTC(year, month - 1, day)
    chapterDay = Math.max(1, Math.round((curMs - startMs) / 86400000) + 1)
    const totalDays = calculateChapterDuration(openChapter.startDate, openChapter.plannedEndDate)
    chapterDaysLeft = Math.max(0, totalDays - chapterDay)
  }

  // Cycle info
  const activeCycle = await db.cycles
    .filter((c) => !c.deletedAt && !c.endDate)
    .first()
  const periodActive = !!activeCycle
  let periodDay = 0
  if (activeCycle) {
    const [cy, cm, cd] = activeCycle.startDate.split('-').map(Number)
    const startCycleMs = Date.UTC(cy, cm - 1, cd)
    const curMs = Date.UTC(year, month - 1, day)
    periodDay = Math.max(1, Math.round((curMs - startCycleMs) / 86400000) + 1)
  }

  // Backup info
  const backupSetting = await db.settings.get('last_backup_timestamp')
  let backupDaysAgo = 999
  if (backupSetting && typeof backupSetting.value === 'number') {
    backupDaysAgo = Math.round((Date.now() - backupSetting.value) / 86400000)
  }

  // Alias-derived 3-day metrics vs baseline (TRD 11a)
  const aliasStats: Record<string, number> = {}
  try {
    const aliasRec = await db.settings.get('form_aliases')
    const aliases = (aliasRec?.value as Record<string, string>) || {}
    if (Object.keys(aliases).length > 0 && allDays.length > 0) {
      const [allAnswers, allQuestions, allParts] = await Promise.all([
        db.answers.filter((a) => !a.deletedAt).toArray(),
        db.questions.filter((q) => !q.deletedAt).toArray(),
        db.parts.filter((p) => !p.deletedAt).toArray(),
      ])
      const table = buildDailyMetricsTable(allDays, allAnswers, allQuestions, allParts)
      const recentDates = new Set([
        dateStr,
        addDays(dateStr, -1),
        addDays(dateStr, -2),
        addDays(dateStr, -3),
      ])
      const recentRows = table.rows.filter((r) => recentDates.has(r.date)).slice(-3)

      const avgKey = (metricKey?: string) => {
        if (!metricKey) return undefined
        const vals = recentRows
          .map((r) => r.values[metricKey])
          .filter((v): v is number => v !== null && v !== undefined && !isNaN(v))
        if (vals.length === 0) return undefined
        return vals.reduce((a, b) => a + b, 0) / vals.length
      }

      const baselineAvgKey = (metricKey?: string) => {
        if (!metricKey) return undefined
        const vals = table.rows
          .map((r) => r.values[metricKey])
          .filter((v): v is number => v !== null && v !== undefined && !isNaN(v))
        if (vals.length === 0) return undefined
        return vals.reduce((a, b) => a + b, 0) / vals.length
      }

      const moodAvg3 = avgKey(aliases.mood)
      const moodBase = baselineAvgKey(aliases.mood)
      if (moodAvg3 !== undefined) {
        aliasStats.mood3 = Number(moodAvg3.toFixed(1))
        if (moodBase !== undefined) {
          aliasStats.moodDelta = Number((moodAvg3 - moodBase).toFixed(1))
        }
      }

      if (aliases.sleepMinutes) {
        const sleepVals = recentRows
          .map((r) => r.values[aliases.sleepMinutes])
          .filter((v): v is number => v !== null && v !== undefined && !isNaN(v))
        if (sleepVals.length > 0) {
          const avgHours = sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length / 60
          aliasStats.sleep3Hours = Number(avgHours.toFixed(1))
          aliasStats.sleepLowDays3 = sleepVals.filter((m) => m < 360).length
        }
      }

      if (aliases.exercise) {
        aliasStats.exerciseDays3 = recentRows.filter((r) => (r.values[aliases.exercise] ?? 0) > 0).length
      }

      if (aliases.study) {
        aliasStats.studyDays3 = recentRows.filter((r) => (r.values[aliases.study] ?? 0) > 0).length
      }

      const studyMinAvg = avgKey(aliases.studyMinutes)
      if (studyMinAvg !== undefined) {
        aliasStats.studyMinutes3 = Math.round(studyMinAvg)
      }

      const waterAvg = avgKey(aliases.water)
      if (waterAvg !== undefined) {
        aliasStats.water3avg = Number(waterAvg.toFixed(1))
      }
    }
  } catch {
    // Ignore optional alias derivation errors
  }

  const context: GreetingContext = {
    daysOfData,
    loggingStreak,
    missedYesterday,
    missedDaysLast3,
    filledToday,
    formOpen,
    windowEnd,
    timeOfDay,
    weekday,
    chapterNumber,
    chapterDay,
    chapterDaysLeft,
    periodActive,
    periodDay,
    memorableDayLast3,
    backupDaysAgo,
    userName: settings.userName || undefined,
    ...aliasStats,
  }

  return { context, dateStr }
}
