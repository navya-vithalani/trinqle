import type {
  Chapter,
  Day,
  Answer,
  AnswerLink,
  Question,
  Part,
  Library,
  Item,
  Section,
  Insight,
  FrozenChapter,
  FrozenChartModel,
} from '../data/types'
import {
  buildDailyMetricsTable,
  calculateScaleNumberStats,
  calculateTimeRangeStats,
  calculateStreak,
  calculateLibraryStats,
  calculateMemorabilityStats,
} from './metrics'

export interface FreezeChapterOptions {
  chapter: Chapter
  days: Day[]
  answers: Answer[]
  answerLinks?: AnswerLink[]
  items?: Item[]
  insights?: Insight[]
  sections: Section[]
  questions: Question[]
  parts: Part[]
  libraries: Library[]
  title?: string
  summary?: string
  photos?: Blob[]
  endDate?: string
}

export interface MetricChapterStats {
  metricKey: string
  n: number
  mean: number
  median: number
  min: number
  max: number
  fillRate: number
}

/**
 * Computes the frozen chapter payload per TRD Section 8.
 * Generates render-agnostic chart models, per-metric chapter stats,
 * and preserves form snapshot at the time of closing.
 */
export function buildFrozenChapter(options: FreezeChapterOptions): FrozenChapter {
  const {
    chapter,
    days,
    answers,
    answerLinks = [],
    items = [],
    insights = [],
    sections,
    questions,
    parts,
    libraries,
  } = options

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const dailyTable = buildDailyMetricsTable(sortedDays, answers, questions, parts)

  const quickCount = sortedDays.filter((d) => d.mode === 'quick').length
  const fullCount = sortedDays.filter((d) => d.mode === 'full').length
  const memorableCount = sortedDays.filter((d) => d.memorability > 0).length

  // Build render-agnostic chart models with stable chartIds and rendererVersion: 1
  const chartModels: FrozenChartModel[] = []
  const metricStats: Record<string, MetricChapterStats> = {}

  for (const metric of dailyTable.metrics) {
    const points = dailyTable.byMetricKey[metric.key] || []
    const validPoints = points.filter((p) => !p.isMissing)
    const values = validPoints.map((p) => p.value)

    // Calculate statistical metrics
    const n = validPoints.length
    const fillRate = sortedDays.length > 0 ? Math.round((n / sortedDays.length) * 100) : 0
    let mean = 0
    let median = 0
    let min = 0
    let max = 0

    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0)
      mean = Math.round((sum / values.length) * 10) / 10
      const sortedVals = [...values].sort((a, b) => a - b)
      median = sortedVals[Math.floor(sortedVals.length / 2)]
      min = sortedVals[0]
      max = sortedVals[sortedVals.length - 1]
    }

    metricStats[metric.key] = {
      metricKey: metric.key,
      n,
      mean,
      median,
      min,
      max,
      fillRate,
    }

    if (metric.partKind === 'scale' || metric.partKind === 'number') {
      const scaleStats = calculateScaleNumberStats(points)
      chartModels.push({
        chartId: `chart_${metric.key}`,
        type: 'line',
        rendererVersion: 1,
        labels: points.map((p) => p.date),
        series: [
          {
            name: metric.label,
            data: points.map((p) => (p.isMissing ? null : p.value)),
            unit: metric.unit,
            mean: scaleStats.mean,
            min: scaleStats.min,
            max: scaleStats.max,
          },
        ],
        axes: {
          x: 'date',
          y: metric.label,
        },
      })
    } else if (metric.partKind === 'yesno') {
      const streakStats = calculateStreak(
        points.map((p) => ({
          date: p.date,
          done: p.value === 1,
          isSkipped: p.isMissing,
        }))
      )
      chartModels.push({
        chartId: `chart_${metric.key}`,
        type: 'heatmap_streak',
        rendererVersion: 1,
        labels: points.map((p) => p.date),
        series: [
          {
            name: metric.label,
            currentStreak: streakStats.currentStreak,
            longestStreak: streakStats.longestStreak,
            completionRate: streakStats.completionRate,
            totalDone: streakStats.totalDone,
            history: streakStats.history,
          },
        ],
      })
    } else if (metric.partKind === 'timerange') {
      const answersMap = new Map<string, Answer[]>()
      for (const a of answers) {
        if (a.questionId === metric.questionId && a.partId === metric.partId) {
          const list = answersMap.get(a.date) || []
          list.push(a)
          answersMap.set(a.date, list)
        }
      }
      const trStats = calculateTimeRangeStats(answersMap)
      chartModels.push({
        chartId: `chart_${metric.key}`,
        type: 'time_distribution',
        rendererVersion: 1,
        labels: points.map((p) => p.date),
        series: [
          {
            name: metric.label,
            totalMinutes: trStats.totalMinutes,
            avgMinutesPerDay: trStats.avgMinutesPerDay,
            hourBins: trStats.hourBins,
            peakHour: trStats.peakHour,
          },
        ],
      })
    } else if (metric.partKind === 'library') {
      const partAnswerIds = new Set(
        answers
          .filter((a) => a.questionId === metric.questionId && a.partId === metric.partId)
          .map((a) => a.id)
      )
      const partLinks = answerLinks.filter((l) => partAnswerIds.has(l.answerId))
      const libStats = calculateLibraryStats(partLinks, items)
      chartModels.push({
        chartId: `chart_${metric.key}`,
        type: 'library_frequency',
        rendererVersion: 1,
        labels: libStats.topItems.slice(0, 10).map((it) => it.name),
        series: [
          {
            name: metric.label,
            totalUsages: libStats.totalUsages,
            uniqueItemCount: libStats.uniqueItemCount,
            topItems: libStats.topItems.slice(0, 10).map((it) => ({
              name: it.name,
              count: it.count,
              firstUsed: it.firstUsed,
              lastUsed: it.lastUsed,
            })),
          },
        ],
      })
    } else if (metric.partKind === 'text' && metric.metric === 'written') {
      const textStreak = calculateStreak(
        points.map((p) => ({
          date: p.date,
          done: p.value === 1,
          isSkipped: p.isMissing,
        }))
      )
      chartModels.push({
        chartId: `chart_${metric.key}`,
        type: 'text_summary',
        rendererVersion: 1,
        labels: points.map((p) => p.date),
        series: [
          {
            name: `${metric.questionLabel} - ${metric.label}`,
            totalEntries: textStreak.totalDone,
            completionRate: textStreak.completionRate,
            currentStreak: textStreak.currentStreak,
            longestStreak: textStreak.longestStreak,
          },
        ],
      })
    }
  }

  // Freeze Memorability distribution summary
  const memStats = calculateMemorabilityStats(sortedDays)
  if (sortedDays.length > 0) {
    chartModels.push({
      chartId: 'chart_derived.memorability',
      type: 'memorability',
      rendererVersion: 1,
      labels: ['Normal', 'Notable', 'Outstanding', 'Star'],
      series: [
        {
          name: 'Day Memorability & Ratings',
          normalCount: memStats.normalCount,
          notableCount: memStats.notableCount,
          outstandingCount: memStats.outstandingCount,
          starCount: memStats.starCount,
          avgRating: memStats.avgRating,
          totalRatedDays: memStats.totalRatedDays,
        },
      ],
    })
  }

  return {
    formSnapshot: {
      sections,
      questions,
      parts,
      libraries,
    },
    dashboard: chartModels,
    insights,
    themeId: chapter.themeId,
    characterId: chapter.characterId,
    stats: metricStats,
    metadata: {
      daysFilled: sortedDays.length,
      quickCount,
      fullCount,
      memorableCount,
    },
  }
}
