/**
 * Data model types according to TRD Section 3.
 * Every entity (except Day and Setting) contains `{ id: UUID, createdAt, updatedAt, deletedAt? }`.
 */

export interface BaseRecord {
  id: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export type SectionScope = 'daily' | 'weekly' | 'chapterEnd'

export interface Section extends BaseRecord {
  name: string
  icon: string
  order: number
  scope: SectionScope
  validFrom?: string | null
  validTo?: string | null
}

export interface ShowWhenRule {
  partId?: string
  op: 'eq' | 'truthy' | 'in'
  value?: unknown
  cycleActive?: boolean
}

export interface QuestionSchedule {
  weekdays?: number[] // 0 = Sunday .. 6 = Saturday
  chapterEnd?: boolean
}

export interface Question extends BaseRecord {
  sectionId: string
  parentId?: string
  label: string
  icon?: string
  order: number
  repeats: boolean
  special?: 'cycle'
  showWhen?: ShowWhenRule
  schedule?: QuestionSchedule
  validFrom?: string | null
  validTo?: string | null
}

export type PartKind = 'yesno' | 'scale' | 'number' | 'text' | 'timerange' | 'library'
export type PartLevel = 'core' | 'extra'

export interface ScaleConfig {
  min: number
  max: number
  step: number
  display: 'stars' | 'slider'
  icon?: string
}

export interface NumberConfig {
  unit?: string
  min?: number
  max?: number
  step?: number
  aggregate?: 'sum' | 'mean'
}

export interface TextConfig {
  multiline?: boolean
}

export interface TimeRangeConfig {
  snapMinutes?: number
}

export interface LibraryConfig {
  libraryId: string
  multi: boolean
  creatable: boolean
}

export type PartConfig =
  | ScaleConfig
  | NumberConfig
  | TextConfig
  | TimeRangeConfig
  | LibraryConfig
  | Record<string, unknown>

export interface Part extends BaseRecord {
  questionId: string
  kind: PartKind
  label: string
  order: number
  level: PartLevel
  gate?: boolean
  config: PartConfig
  validFrom?: string | null
  validTo?: string | null
}

export interface Library extends BaseRecord {
  name: string
  retired?: boolean
}

export interface Item extends BaseRecord {
  libraryId: string
  name: string
  retired?: boolean
  mergedInto?: string
}

export type Memorability = 0 | 1 | 2 | 3 // normal (0), notable (1), outstanding (2), star (3)
export type EntryMode = 'quick' | 'full'

export interface Day {
  date: string // Primary Key YYYY-MM-DD
  chapterId: string
  title?: string
  oneliner?: string
  stickerId?: string
  overallRating?: number
  memorability: Memorability
  mode: EntryMode
  expandedMore: boolean
  backfilled: boolean
  filledAt: number
  editedAt?: number
  tz: string
  deletedAt?: number
}

export interface TimeRangeValue {
  start: string // HH:mm
  end: string // HH:mm
  crossesMidnight: boolean
  startDayOffset?: number // 0 = current day, -1 = wrapped into previous evening
}

export type AnswerValue =
  | boolean
  | number
  | string
  | TimeRangeValue
  | string[] // Item IDs for library answers
  | null

export interface Answer extends BaseRecord {
  date: string
  questionId: string
  partId: string
  instance: number
  value: AnswerValue
}

export interface AnswerLink extends BaseRecord {
  answerId: string
  date: string
  libraryId: string
  itemId: string
}

export interface Cycle extends BaseRecord {
  startDate: string
  endDate?: string
}

export interface ChapterAnswer extends BaseRecord {
  chapterId: string
  promptId: string // Part ID or custom prompt ID
  value: AnswerValue
}

export interface CustomPrompt {
  id: string
  label: string
  type: 'text' | 'scale'
}

export interface FrozenChartModel {
  chartId: string
  type: string
  series: unknown[]
  axes?: unknown
  labels?: string[]
  rendererVersion: number
}

export interface FrozenChapter {
  formSnapshot: {
    sections: Section[]
    questions: Question[]
    parts: Part[]
    libraries: Library[]
  }
  dashboard: FrozenChartModel[]
  insights: unknown[]
  themeId: string
  characterId: string
  stats?: Record<string, unknown>
  metadata: {
    daysFilled: number
    quickCount: number
    fullCount: number
    memorableCount: number
  }
}

export type ChapterStatus = 'open' | 'closed'

export interface Chapter extends BaseRecord {
  title?: string
  summary?: string
  startDate: string
  plannedEndDate: string
  endDate?: string
  status: ChapterStatus
  themeId: string
  characterId: string
  customPrompts?: CustomPrompt[]
  photos?: Blob[]
  frozen?: FrozenChapter
  closedAt?: number
}

export interface Baseline extends BaseRecord {
  metricKey: string
  weekdayMean: number[]
  weekdaySd: number[]
  n: number
  asOfChapterId: string
}

export interface Run extends BaseRecord {
  at: number
  trigger: 'sunday' | 'manual'
  windowLabel: string
  windowStart: string
  windowEnd: string
  nGenerated: number
  nAboveBar: number
  bar: number
}

export interface Insight extends BaseRecord {
  runId: string
  signature: string
  windows: string[]
  payload: {
    facts: string[]
    evidenceDays: { date: string; title?: string; oneliner?: string }[]
  }
  sureness: number
  surprise: number
  score: number
  rating?: 1 | 2 | 3 | 4 | 5
  status: 'active' | 'discarded'
}

export interface Sticker extends BaseRecord {
  name: string
  mime: string
  blob?: Blob | string
  builtin: boolean
}

export interface Setting {
  key: string
  value: unknown
}

export interface FormPack {
  formatVersion: number
  kind: 'form-pack'
  name: string
  aliases?: Record<string, string>
  libraries: {
    id: string
    name: string
    items: string[]
  }[]
  sections: {
    id: string
    name: string
    icon: string
    order: number
    scope: SectionScope
  }[]
  questions: {
    id: string
    sectionId: string
    parentId?: string
    label: string
    icon?: string
    order: number
    repeats: boolean
    special?: 'cycle'
    showWhen?: ShowWhenRule
    schedule?: QuestionSchedule
    parts: {
      id: string
      kind: PartKind
      label: string
      order: number
      level: PartLevel
      gate?: boolean
      config: PartConfig
    }[]
  }[]
}
