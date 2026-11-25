import type { PartKind } from '../../data/types'

export type MetricKind = 'done' | 'value' | 'minutes' | 'hourBins' | 'written' | 'words' | 'count'

export interface MetricDefinition {
  key: string // e.g. "q_studies.p_studies_did.done"
  questionId: string
  partId: string
  metric: MetricKind
  label: string
  questionLabel: string
  partKind: PartKind
  sectionId?: string
  unit?: string
}

export interface DayMetricPoint {
  date: string
  value: number
  rollingAvg?: number
  isMissing?: boolean
}

export interface StreakStats {
  currentStreak: number
  longestStreak: number
  totalDone: number
  totalEvaluatedDays: number
  completionRate: number // 0 to 100
  history: Array<{ date: string; done: boolean | 'skipped' }>
}

export interface ScaleNumberStats {
  min: number
  max: number
  mean: number
  latestValue?: number
  points: DayMetricPoint[]
  weekdayAverages: Array<{ weekday: number; dayName: string; avg: number; count: number }>
  bestDays: Array<{ date: string; value: number }>
  worstDays: Array<{ date: string; value: number }>
}

export interface TimeRangeStats {
  totalMinutes: number
  avgMinutesPerDay: number
  avgSessionMinutes: number
  sessionCount: number
  hourBins: number[] // 24 values for 00:00 to 23:00
  peakHour: number
  daysWithActivity: number
  points: DayMetricPoint[]
}

export interface JournalTextEntry {
  id: string
  date: string
  dayTitle?: string
  questionId: string
  questionLabel: string
  partId: string
  partLabel: string
  text: string
  wordCount: number
  memorability?: number
  overallRating?: number
}

export interface LibraryItemUsage {
  itemId: string
  name: string
  libraryId: string
  count: number
  firstUsed: string
  lastUsed: string
  dates: string[] // List of distinct dates
}

export interface LibraryStats {
  totalUsages: number
  uniqueItemCount: number
  topItems: LibraryItemUsage[]
}

export interface ItemDayAppearance {
  date: string
  dayTitle?: string
  questionLabel: string
  partLabel: string
  mode: 'quick' | 'full'
  rating?: number
}

export interface MemorabilityStats {
  normalCount: number
  notableCount: number
  outstandingCount: number
  starCount: number
  totalRatedDays: number
  avgRating: number
  starTimeline: Array<{ date: string; title?: string; rating?: number }>
}

export interface DailyMetricRow {
  date: string
  chapterId?: string
  dayTitle?: string
  mode?: 'quick' | 'full'
  overallRating?: number
  memorability?: number
  values: Record<string, number | null> // metricKey -> number or null if missing
  texts: Record<string, string> // metricKey -> text
  hourBins: Record<string, number[]> // metricKey -> 24 bins
}

export interface DailyTableResult {
  dates: string[]
  metrics: MetricDefinition[]
  rows: DailyMetricRow[]
  byMetricKey: Record<string, DayMetricPoint[]>
}

export type DateScope = 'chapter' | '7days' | '30days' | 'all'
export type PartKindFilter = 'all' | 'yesno' | 'scale_number' | 'timerange' | 'text' | 'library'
