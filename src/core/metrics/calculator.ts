import type {
  Day,
  Answer,
  AnswerLink,
  Question,
  Part,
  Item,
  TimeRangeValue,
  NumberConfig,
} from '../../data/types'
import type {
  StreakStats,
  ScaleNumberStats,
  TimeRangeStats,
  LibraryItemUsage,
  LibraryStats,
  MemorabilityStats,
  DayMetricPoint,
  JournalTextEntry,
  MetricDefinition,
  DailyMetricRow,
  DailyTableResult,
} from './types'

/**
 * Splits a time range into 24 one-hour bins (0..23).
 * Accurately handles sessions that wrap midnight (e.g. 23:00 to 01:00).
 */
export function splitTimeRangeIntoHourBins(
  startStr: string,
  endStr: string,
  crossesMidnight: boolean
): number[] {
  const bins = new Array(24).fill(0)
  if (!startStr || !endStr) return bins

  const [sH, sM] = startStr.split(':').map(Number)
  const [eH, eM] = endStr.split(':').map(Number)

  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return bins

  const startMinutes = sH * 60 + sM
  const endMinutes = eH * 60 + eM

  const intervals: Array<[number, number]> = []

  if (crossesMidnight || startMinutes > endMinutes) {
    // Crosses midnight: interval 1 is [startMinutes, 1440) on day 1
    // interval 2 is [0, endMinutes) on day 2
    intervals.push([startMinutes, 1440])
    intervals.push([0, endMinutes])
  } else {
    // Normal single-day range
    intervals.push([startMinutes, endMinutes])
  }

  for (const [intStart, intEnd] of intervals) {
    for (let hour = 0; hour < 24; hour++) {
      const hourStart = hour * 60
      const hourEnd = (hour + 1) * 60
      const overlapStart = Math.max(intStart, hourStart)
      const overlapEnd = Math.min(intEnd, hourEnd)
      if (overlapEnd > overlapStart) {
        bins[hour] += overlapEnd - overlapStart
      }
    }
  }

  return bins
}

/**
 * Calculates duration in minutes for a TimeRangeValue.
 */
export function calculateTimeRangeMinutes(val: TimeRangeValue): number {
  if (!val.start || !val.end) return 0
  const [sH, sM] = val.start.split(':').map(Number)
  const [eH, eM] = val.end.split(':').map(Number)
  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0

  const sTotal = sH * 60 + sM
  const eTotal = eH * 60 + eM

  if (val.crossesMidnight || sTotal > eTotal) {
    return 1440 - sTotal + eTotal
  }
  return Math.max(0, eTotal - sTotal)
}

/**
 * Calculates streaks with gap bridging.
 * Skipped days bridge between done days and do not reset the streak.
 * Only explicit 'not done' (0 / false) resets the streak.
 */
export function calculateStreak(
  dateEntries: Array<{ date: string; done?: boolean; isSkipped?: boolean }>
): StreakStats {
  if (dateEntries.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalDone: 0,
      totalEvaluatedDays: 0,
      completionRate: 0,
      history: [],
    }
  }

  // Sort chronological
  const sorted = [...dateEntries].sort((a, b) => a.date.localeCompare(b.date))
  const history: Array<{ date: string; done: boolean | 'skipped' }> = []

  let runningStreak = 0
  let longestStreak = 0
  let totalDone = 0
  let evaluatedDays = 0

  for (const entry of sorted) {
    if (entry.isSkipped) {
      // Skipped day: bridges streak (does not increment, but does not reset)
      history.push({ date: entry.date, done: 'skipped' })
      continue
    }

    evaluatedDays++
    if (entry.done) {
      totalDone++
      runningStreak++
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak
      }
      history.push({ date: entry.date, done: true })
    } else {
      runningStreak = 0
      history.push({ date: entry.date, done: false })
    }
  }

  const completionRate = evaluatedDays > 0 ? Math.round((totalDone / evaluatedDays) * 100) : 0

  return {
    currentStreak: runningStreak,
    longestStreak,
    totalDone,
    totalEvaluatedDays: evaluatedDays,
    completionRate,
    history,
  }
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Calculates scale or number metrics: rolling 7-day average, min, max, mean, weekday averages.
 */
export function calculateScaleNumberStats(
  points: Array<{ date: string; value: number | null }>
): ScaleNumberStats {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))

  const validPoints = sorted.filter((p) => p.value !== null && !isNaN(p.value!)) as Array<{
    date: string
    value: number
  }>

  if (validPoints.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      points: [],
      weekdayAverages: WEEKDAY_NAMES.map((name, i) => ({
        weekday: i,
        dayName: name,
        avg: 0,
        count: 0,
      })),
      bestDays: [],
      worstDays: [],
    }
  }

  const values = validPoints.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const sum = values.reduce((acc, val) => acc + val, 0)
  const mean = Math.round((sum / values.length) * 10) / 10
  const latestValue = validPoints[validPoints.length - 1]?.value

  // Weekday breakdown
  const weekdayTotals = new Array(7).fill(0)
  const weekdayCounts = new Array(7).fill(0)

  for (const pt of validPoints) {
    const d = new Date(pt.date + 'T12:00:00Z')
    const wd = d.getUTCDay()
    weekdayTotals[wd] += pt.value
    weekdayCounts[wd] += 1
  }

  const weekdayAverages = WEEKDAY_NAMES.map((name, i) => ({
    weekday: i,
    dayName: name,
    avg: weekdayCounts[i] > 0 ? Math.round((weekdayTotals[i] / weekdayCounts[i]) * 10) / 10 : 0,
    count: weekdayCounts[i],
  }))

  // Rolling 7-day average
  const pointsWithRolling: DayMetricPoint[] = sorted.map((pt, idx) => {
    if (pt.value === null || isNaN(pt.value)) {
      return { date: pt.date, value: 0, isMissing: true }
    }

    // Look back up to 7 previous sorted points
    let windowSum = 0
    let windowCount = 0
    for (let back = 0; back < 7 && idx - back >= 0; back++) {
      const prev = sorted[idx - back]
      if (prev.value !== null && !isNaN(prev.value)) {
        windowSum += prev.value
        windowCount++
      }
    }

    return {
      date: pt.date,
      value: pt.value,
      rollingAvg: windowCount > 0 ? Math.round((windowSum / windowCount) * 10) / 10 : pt.value,
      isMissing: false,
    }
  })

  // Best & worst days (top 3 and bottom 3)
  const sortedByVal = [...validPoints].sort((a, b) => b.value - a.value)
  const bestDays = sortedByVal.slice(0, 3)
  const worstDays = [...sortedByVal].reverse().slice(0, 3)

  return {
    min,
    max,
    mean,
    latestValue,
    points: pointsWithRolling,
    weekdayAverages,
    bestDays,
    worstDays,
  }
}

/**
 * Calculates TimeRange metrics: total duration, hourly heatmap distribution (00:00 to 23:00).
 */
export function calculateTimeRangeStats(
  answersByDate: Map<string, Answer[]>
): TimeRangeStats {
  const hourBins = new Array(24).fill(0)
  let totalMinutes = 0
  let sessionCount = 0
  let daysWithActivity = 0
  const points: DayMetricPoint[] = []

  const sortedDates = Array.from(answersByDate.keys()).sort()

  for (const date of sortedDates) {
    const answers = answersByDate.get(date) || []
    let dayMinutes = 0

    for (const ans of answers) {
      if (ans.value && typeof ans.value === 'object' && 'start' in ans.value) {
        const trVal = ans.value as TimeRangeValue
        const mins = calculateTimeRangeMinutes(trVal)
        dayMinutes += mins
        totalMinutes += mins
        sessionCount++

        const bins = splitTimeRangeIntoHourBins(trVal.start, trVal.end, !!trVal.crossesMidnight)
        for (let h = 0; h < 24; h++) {
          hourBins[h] += bins[h]
        }
      }
    }

    if (dayMinutes > 0) {
      daysWithActivity++
    }

    points.push({
      date,
      value: dayMinutes,
    })
  }

  const avgMinutesPerDay =
    sortedDates.length > 0 ? Math.round(totalMinutes / sortedDates.length) : 0
  const avgSessionMinutes = sessionCount > 0 ? Math.round(totalMinutes / sessionCount) : 0

  let peakHour = 0
  let maxHourMins = -1
  for (let h = 0; h < 24; h++) {
    if (hourBins[h] > maxHourMins) {
      maxHourMins = hourBins[h]
      peakHour = h
    }
  }

  return {
    totalMinutes,
    avgMinutesPerDay,
    avgSessionMinutes,
    sessionCount,
    hourBins,
    peakHour,
    daysWithActivity,
    points,
  }
}

/**
 * Aggregates library item usage and frequencies from AnswerLink records.
 */
export function calculateLibraryStats(
  answerLinks: AnswerLink[],
  items: Item[]
): LibraryStats {
  const itemMap = new Map<string, Item>()
  for (const it of items) {
    itemMap.set(it.id, it)
  }

  const usageByItemId = new Map<string, { count: number; dates: Set<string> }>()

  for (const link of answerLinks) {
    if (!link.itemId) continue
    const curr = usageByItemId.get(link.itemId) || { count: 0, dates: new Set<string>() }
    curr.count++
    if (link.date) curr.dates.add(link.date)
    usageByItemId.set(link.itemId, curr)
  }

  const topItems: LibraryItemUsage[] = []
  let totalUsages = 0

  for (const [itemId, usage] of usageByItemId.entries()) {
    const item = itemMap.get(itemId)
    const name = item ? item.name : 'Unknown item'
    const datesSorted = Array.from(usage.dates).sort()
    totalUsages += usage.count

    topItems.push({
      itemId,
      name,
      libraryId: item?.libraryId || '',
      count: usage.count,
      firstUsed: datesSorted[0] || '',
      lastUsed: datesSorted[datesSorted.length - 1] || '',
      dates: datesSorted,
    })
  }

  topItems.sort((a, b) => b.count - a.count)

  return {
    totalUsages,
    uniqueItemCount: topItems.length,
    topItems,
  }
}

/**
 * Calculates memorability distribution and rating trends.
 */
export function calculateMemorabilityStats(days: Day[]): MemorabilityStats {
  let normalCount = 0
  let notableCount = 0
  let outstandingCount = 0
  let starCount = 0
  let ratingSum = 0
  let ratingCount = 0

  const starTimeline: Array<{ date: string; title?: string; rating?: number }> = []

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))

  for (const day of sortedDays) {
    if (day.memorability === 0) normalCount++
    else if (day.memorability === 1) notableCount++
    else if (day.memorability === 2) outstandingCount++
    else if (day.memorability === 3) {
      starCount++
      starTimeline.push({
        date: day.date,
        title: day.title || 'Memorable day',
        rating: day.overallRating,
      })
    }

    if (day.overallRating !== undefined && day.overallRating !== null) {
      ratingSum += day.overallRating
      ratingCount++
    }
  }

  const avgRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0

  return {
    normalCount,
    notableCount,
    outstandingCount,
    starCount,
    totalRatedDays: ratingCount,
    avgRating,
    starTimeline,
  }
}

/**
 * Extracts all journal text entries across all days.
 */
export function extractJournalEntries(
  days: Day[],
  answers: Answer[],
  questions: Question[],
  parts: Part[]
): JournalTextEntry[] {
  const qMap = new Map<string, Question>()
  questions.forEach((q) => qMap.set(q.id, q))

  const pMap = new Map<string, Part>()
  parts.forEach((p) => pMap.set(p.id, p))

  const dayMap = new Map<string, Day>()
  days.forEach((d) => dayMap.set(d.date, d))

  const entries: JournalTextEntry[] = []

  for (const ans of answers) {
    if (!ans.value || typeof ans.value !== 'string') continue
    const trimmed = ans.value.trim()
    if (!trimmed) continue

    const part = pMap.get(ans.partId)
    if (!part || part.kind !== 'text') continue

    const question = qMap.get(ans.questionId)
    const day = dayMap.get(ans.date)

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length

    entries.push({
      id: ans.id,
      date: ans.date,
      dayTitle: day?.title,
      questionId: ans.questionId,
      questionLabel: question?.label || 'Question',
      partId: ans.partId,
      partLabel: part.label || 'Journal',
      text: trimmed,
      wordCount,
      memorability: day?.memorability,
      overallRating: day?.overallRating,
    })
  }

  // Sort newest first
  entries.sort((a, b) => b.date.localeCompare(a.date))
  return entries
}

/**
 * Builds the Daily Metrics Table per TRD Section 6.
 * Generates rows per date with columns for all active metrics + context.
 */
export function buildDailyMetricsTable(
  days: Day[],
  answers: Answer[],
  questions: Question[],
  parts: Part[]
): DailyTableResult {
  const qMap = new Map<string, Question>()
  questions.forEach((q) => qMap.set(q.id, q))

  const metrics: MetricDefinition[] = []

  for (const part of parts) {
    const question = qMap.get(part.questionId)
    const qLabel = question?.label || 'Question'
    const baseKey = `${part.questionId}.${part.id}`

    if (part.kind === 'yesno') {
      metrics.push({
        key: `${baseKey}.done`,
        questionId: part.questionId,
        partId: part.id,
        metric: 'done',
        label: part.label,
        questionLabel: qLabel,
        partKind: 'yesno',
        sectionId: question?.sectionId,
      })
    } else if (part.kind === 'scale' || part.kind === 'number') {
      const numConf = part.config as NumberConfig
      metrics.push({
        key: `${baseKey}.value`,
        questionId: part.questionId,
        partId: part.id,
        metric: 'value',
        label: part.label,
        questionLabel: qLabel,
        partKind: part.kind,
        sectionId: question?.sectionId,
        unit: numConf?.unit,
      })
    } else if (part.kind === 'timerange') {
      metrics.push({
        key: `${baseKey}.minutes`,
        questionId: part.questionId,
        partId: part.id,
        metric: 'minutes',
        label: part.label,
        questionLabel: qLabel,
        partKind: 'timerange',
        sectionId: question?.sectionId,
        unit: 'min',
      })
    } else if (part.kind === 'text') {
      metrics.push({
        key: `${baseKey}.written`,
        questionId: part.questionId,
        partId: part.id,
        metric: 'written',
        label: part.label,
        questionLabel: qLabel,
        partKind: 'text',
        sectionId: question?.sectionId,
      })
      metrics.push({
        key: `${baseKey}.words`,
        questionId: part.questionId,
        partId: part.id,
        metric: 'words',
        label: `${part.label} (words)`,
        questionLabel: qLabel,
        partKind: 'text',
        sectionId: question?.sectionId,
        unit: 'words',
      })
    } else if (part.kind === 'library') {
      metrics.push({
        key: `${baseKey}.count`,
        questionId: part.questionId,
        partId: part.id,
        metric: 'count',
        label: part.label,
        questionLabel: qLabel,
        partKind: 'library',
        sectionId: question?.sectionId,
      })
    }
  }

  // Group answers by `date:questionId:partId`
  const answersLookup = new Map<string, Answer[]>()
  for (const ans of answers) {
    const k = `${ans.date}:${ans.questionId}:${ans.partId}`
    const list = answersLookup.get(k) || []
    list.push(ans)
    answersLookup.set(k, list)
  }

  const daysMap = new Map<string, Day>()
  days.forEach((d) => daysMap.set(d.date, d))

  // Collect all distinct dates
  const dateSet = new Set<string>()
  days.forEach((d) => dateSet.add(d.date))
  answers.forEach((a) => dateSet.add(a.date))
  const dates = Array.from(dateSet).sort()

  const rows: DailyMetricRow[] = []
  const byMetricKey: Record<string, DayMetricPoint[]> = {}
  for (const m of metrics) {
    byMetricKey[m.key] = []
  }

  for (const date of dates) {
    const day = daysMap.get(date)
    const rowValues: Record<string, number | null> = {}
    const rowTexts: Record<string, string> = {}
    const rowHourBins: Record<string, number[]> = {}

    for (const part of parts) {
      // Check effective dating
      const isEffective =
        (!part.validFrom || part.validFrom <= date) &&
        (!part.validTo || part.validTo > date)

      const baseKey = `${part.questionId}.${part.id}`
      const ansList = answersLookup.get(`${date}:${part.questionId}:${part.id}`) || []

      if (!isEffective) {
        // Missing outside validity
        if (part.kind === 'yesno') rowValues[`${baseKey}.done`] = null
        else if (part.kind === 'scale' || part.kind === 'number') rowValues[`${baseKey}.value`] = null
        else if (part.kind === 'timerange') rowValues[`${baseKey}.minutes`] = null
        else if (part.kind === 'text') {
          rowValues[`${baseKey}.written`] = null
          rowValues[`${baseKey}.words`] = null
        } else if (part.kind === 'library') rowValues[`${baseKey}.count`] = null
        continue
      }

      if (part.kind === 'yesno') {
        const k = `${baseKey}.done`
        if (ansList.length > 0) {
          const val = ansList[0].value
          rowValues[k] = val === true || val === 1 ? 1 : 0
        } else if (day) {
          // Core yes/no default is 0 if day was saved
          rowValues[k] = part.level === 'core' ? 0 : null
        } else {
          rowValues[k] = null
        }
      } else if (part.kind === 'scale') {
        const k = `${baseKey}.value`
        if (ansList.length > 0) {
          const vals = ansList
            .map((a) => (typeof a.value === 'number' ? a.value : Number(a.value)))
            .filter((v) => !isNaN(v))
          if (vals.length > 0) {
            const sum = vals.reduce((a, b) => a + b, 0)
            rowValues[k] = Math.round((sum / vals.length) * 10) / 10
          } else {
            rowValues[k] = null
          }
        } else {
          rowValues[k] = null
        }
      } else if (part.kind === 'number') {
        const k = `${baseKey}.value`
        const numConf = part.config as NumberConfig
        if (ansList.length > 0) {
          const vals = ansList
            .map((a) => (typeof a.value === 'number' ? a.value : Number(a.value)))
            .filter((v) => !isNaN(v))
          if (vals.length > 0) {
            if (numConf?.aggregate === 'mean') {
              const sum = vals.reduce((a, b) => a + b, 0)
              rowValues[k] = Math.round((sum / vals.length) * 10) / 10
            } else {
              rowValues[k] = vals.reduce((a, b) => a + b, 0)
            }
          } else {
            rowValues[k] = null
          }
        } else {
          rowValues[k] = null
        }
      } else if (part.kind === 'timerange') {
        const k = `${baseKey}.minutes`
        let totalMins = 0
        const bins = new Array(24).fill(0)
        let hasAny = false

        for (const ans of ansList) {
          if (ans.value && typeof ans.value === 'object' && 'start' in ans.value) {
            const trVal = ans.value as TimeRangeValue
            const mins = calculateTimeRangeMinutes(trVal)
            totalMins += mins
            hasAny = true

            const sessionBins = splitTimeRangeIntoHourBins(
              trVal.start,
              trVal.end,
              !!trVal.crossesMidnight
            )
            for (let h = 0; h < 24; h++) {
              bins[h] += sessionBins[h]
            }
          }
        }

        rowValues[k] = hasAny ? totalMins : null
        rowHourBins[`${baseKey}.hourBins`] = bins
      } else if (part.kind === 'text') {
        const kWritten = `${baseKey}.written`
        const kWords = `${baseKey}.words`
        if (ansList.length > 0) {
          const textVal = ansList
            .map((a) => (typeof a.value === 'string' ? a.value : ''))
            .filter(Boolean)
            .join('\n\n')
          const isWritten = textVal.trim().length > 0 ? 1 : 0
          rowValues[kWritten] = isWritten
          const words = textVal.trim().split(/\s+/).filter(Boolean).length
          rowValues[kWords] = words
          rowTexts[baseKey] = textVal
        } else if (day) {
          // If part was core, and day was filled, written = 0, words = 0
          if (part.level === 'core') {
            rowValues[kWritten] = 0
            rowValues[kWords] = 0
          } else {
            rowValues[kWritten] = null
            rowValues[kWords] = null
          }
        } else {
          rowValues[kWritten] = null
          rowValues[kWords] = null
        }
      } else if (part.kind === 'library') {
        const k = `${baseKey}.count`
        if (ansList.length > 0) {
          let count = 0
          for (const ans of ansList) {
            if (Array.isArray(ans.value)) {
              count += ans.value.length
            } else if (typeof ans.value === 'string' && ans.value.length > 0) {
              count += 1
            }
          }
          rowValues[k] = count
        } else {
          rowValues[k] = day && part.level === 'core' ? 0 : null
        }
      }
    }

    rows.push({
      date,
      chapterId: day?.chapterId,
      dayTitle: day?.title,
      mode: day?.mode,
      overallRating: day?.overallRating,
      memorability: day?.memorability,
      values: rowValues,
      texts: rowTexts,
      hourBins: rowHourBins,
    })

    // Populate byMetricKey series
    for (const m of metrics) {
      const val = rowValues[m.key]
      byMetricKey[m.key].push({
        date,
        value: val ?? 0,
        isMissing: val === null,
      })
    }
  }

  return {
    dates,
    metrics,
    rows,
    byMetricKey,
  }
}
