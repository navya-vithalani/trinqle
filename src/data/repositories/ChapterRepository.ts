import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type {
  Chapter,
  FrozenChapter,
  ChapterAnswer,
  CustomPrompt,
  AnswerValue,
} from '../types'
import { generateUUIDv7 } from '../../core/ids'
import { addDays } from '../../core/logicalDay'
import {
  isPlannedEndDateValid,
  MIN_CHAPTER_DAYS,
  MAX_CHAPTER_DAYS,
} from '../../core/chapters'
import { LIMITS, clampText } from '../../core/limits'
import { buildFrozenChapter } from '../../core/freeze'
import { buildDailyMetricsTable } from '../../core/metrics/calculator'
import { mean, standardDeviation } from '../../core/engine/stats'

export class ChapterRepository {
  constructor(private db: TrinqleDB = defaultDb) {}

  async getOpenChapter(): Promise<Chapter | undefined> {
    return this.db.chapters.where('status').equals('open').first()
  }

  async getChapterById(id: string): Promise<Chapter | undefined> {
    return this.db.chapters.get(id)
  }

  async getAllChapters(): Promise<Chapter[]> {
    return this.db.chapters.orderBy('startDate').toArray()
  }

  async getChapterForDate(date: string): Promise<Chapter | undefined> {
    const chapters = await this.getAllChapters()
    return chapters.find((ch) => {
      const start = ch.startDate
      const end = ch.endDate || ch.plannedEndDate
      return date >= start && date <= end
    })
  }

  async assertDateNotClosed(date: string): Promise<void> {
    const chapter = await this.getChapterForDate(date)
    if (chapter && chapter.status === 'closed') {
      throw new Error('Chapter is closed and write-protected')
    }
  }

  async assertChapterIsOpen(chapterId: string): Promise<void> {
    const chapter = await this.getChapterById(chapterId)
    if (!chapter || chapter.status === 'closed') {
      throw new Error('Chapter is closed and write-protected')
    }
  }

  async createChapter(params: {
    startDate: string
    plannedEndDate?: string
    title?: string
    themeId?: string
    characterId?: string
  }): Promise<Chapter> {
    const now = Date.now()
    const plannedEndDate = params.plannedEndDate || addDays(params.startDate, 27) // 28 days default

    const chapter: Chapter = {
      id: generateUUIDv7(now),
      title: params.title ? clampText(params.title, LIMITS.CHAPTER_NAME) : undefined,
      startDate: params.startDate,
      plannedEndDate,
      status: 'open',
      themeId: params.themeId || 'cutesy',
      characterId: params.characterId || 'white-cat',
      createdAt: now,
      updatedAt: now,
    }

    await this.db.chapters.add(chapter)
    return chapter
  }

  async updateChapter(chapter: Chapter): Promise<Chapter> {
    const existing = await this.getChapterById(chapter.id)
    if (existing && existing.status === 'closed') {
      throw new Error('Chapter is closed and write-protected')
    }
    const sanitized: Chapter = {
      ...chapter,
      title: chapter.title !== undefined ? clampText(chapter.title, LIMITS.CHAPTER_NAME) : undefined,
      summary: chapter.summary !== undefined ? clampText(chapter.summary, LIMITS.CHAPTER_SUMMARY) : undefined,
    }
    await this.db.chapters.put(sanitized)
    return sanitized
  }

  async updatePlannedEndDate(
    chapterId: string,
    plannedEndDate: string,
    todayDate?: string
  ): Promise<Chapter> {
    const chapter = await this.getChapterById(chapterId)
    if (!chapter) throw new Error(`Chapter ${chapterId} not found`)
    if (chapter.status === 'closed') throw new Error('Chapter is closed and write-protected')

    if (!isPlannedEndDateValid(chapter.startDate, plannedEndDate, todayDate)) {
      throw new Error(
        `Planned end date must be ${MIN_CHAPTER_DAYS} to ${MAX_CHAPTER_DAYS} days from start date and at least 3 days from today`
      )
    }

    const updated: Chapter = {
      ...chapter,
      plannedEndDate,
      updatedAt: Date.now(),
    }
    await this.db.chapters.put(updated)
    return updated
  }

  async addCustomPrompt(chapterId: string, prompt: CustomPrompt): Promise<Chapter> {
    const chapter = await this.getChapterById(chapterId)
    if (!chapter) throw new Error(`Chapter ${chapterId} not found`)
    if (chapter.status === 'closed') throw new Error('Chapter is closed and write-protected')

    const sanitizedPrompt: CustomPrompt = {
      ...prompt,
      label: clampText(prompt.label, LIMITS.CUSTOM_PROMPT_LABEL),
    }
    const currentPrompts = chapter.customPrompts || []
    const updated: Chapter = {
      ...chapter,
      customPrompts: [...currentPrompts, sanitizedPrompt],
      updatedAt: Date.now(),
    }
    await this.db.chapters.put(updated)
    return updated
  }

  async saveChapterAnswer(
    chapterId: string,
    promptId: string,
    value: AnswerValue
  ): Promise<ChapterAnswer> {
    await this.assertChapterIsOpen(chapterId)
    const now = Date.now()
    const sanitizedValue =
      typeof value === 'string' ? clampText(value, LIMITS.CHAPTER_SUMMARY) : value

    const existing = await this.db.chapterAnswers
      .where('[chapterId+promptId]')
      .equals([chapterId, promptId])
      .first()

    if (existing) {
      const updated: ChapterAnswer = {
        ...existing,
        value: sanitizedValue,
        updatedAt: now,
      }
      await this.db.chapterAnswers.put(updated)
      return updated
    }

    const newRecord: ChapterAnswer = {
      id: generateUUIDv7(now),
      chapterId,
      promptId,
      value: sanitizedValue,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.chapterAnswers.put(newRecord)
    return newRecord
  }

  async getChapterAnswers(chapterId: string): Promise<ChapterAnswer[]> {
    return this.db.chapterAnswers
      .where('chapterId')
      .equals(chapterId)
      .filter((ca) => !ca.deletedAt)
      .toArray()
  }

  async closeChapter(
    chapterId: string,
    frozen: FrozenChapter,
    title?: string,
    summary?: string,
    photos?: Blob[],
    endDate?: string
  ): Promise<Chapter> {
    const chapter = await this.getChapterById(chapterId)
    if (!chapter) throw new Error(`Chapter ${chapterId} not found`)
    if (chapter.status === 'closed') throw new Error('Chapter is already closed')

    const now = Date.now()
    const cleanTitle = title ? clampText(title, LIMITS.CHAPTER_NAME) : chapter.title
    const cleanSummary = summary ? clampText(summary, LIMITS.CHAPTER_SUMMARY) : chapter.summary
    const updated: Chapter = {
      ...chapter,
      title: cleanTitle,
      summary: cleanSummary,
      status: 'closed',
      endDate: endDate || chapter.plannedEndDate,
      photos: photos || chapter.photos,
      frozen,
      closedAt: now,
      updatedAt: now,
    }

    await this.db.chapters.put(updated)
    return updated
  }

  /**
   * Helper that builds the complete FrozenChapter payload from current DB state
   * and closes the chapter, then auto-creates the next chapter starting the next day.
   */
  async closeChapterWithCeremony(params: {
    chapterId: string
    title?: string
    summary?: string
    photos?: Blob[]
    endDate: string
  }): Promise<{ closedChapter: Chapter; nextChapter: Chapter }> {
    const chapter = await this.getChapterById(params.chapterId)
    if (!chapter) throw new Error(`Chapter ${params.chapterId} not found`)

    // 1. Gather all days belonging to this chapter
    const days = await this.db.days
      .where('chapterId')
      .equals(chapter.id)
      .filter((d) => !d.deletedAt)
      .toArray()

    // 2. Gather form snapshot, answers, links, items & insights
    const sections = await this.db.sections.filter((s) => !s.deletedAt).toArray()
    const questions = await this.db.questions.filter((q) => !q.deletedAt).toArray()
    const parts = await this.db.parts.filter((p) => !p.deletedAt).toArray()
    const libraries = await this.db.libraries.filter((l) => !l.deletedAt).toArray()
    const items = await this.db.items.filter((i) => !i.deletedAt).toArray()

    const dayDates = new Set(days.map((d) => d.date))
    const allAnswers = await this.db.answers.filter((a) => !a.deletedAt).toArray()
    const chapterAnswers = allAnswers.filter((a) => dayDates.has(a.date))
    const allLinks = await this.db.answerLinks.filter((l) => !l.deletedAt).toArray()
    const chapterLinks = allLinks.filter((l) => dayDates.has(l.date))

    // Gather latest run's insights overlapping this chapter (or latest run overall)
    const allRuns = await this.db.runs.filter((r) => !r.deletedAt).toArray()
    allRuns.sort((a, b) => b.at - a.at)
    const latestRun = allRuns[0]
    const chapterInsights = latestRun
      ? await this.db.insights
          .where('runId')
          .equals(latestRun.id)
          .filter((ins) => !ins.deletedAt && ins.status === 'active')
          .toArray()
      : []

    const frozen: FrozenChapter = buildFrozenChapter({
      chapter,
      days,
      answers: chapterAnswers,
      answerLinks: chapterLinks,
      items,
      insights: chapterInsights,
      sections,
      questions,
      parts,
      libraries,
      title: params.title,
      summary: params.summary,
      photos: params.photos,
      endDate: params.endDate,
    })

    // 3. Close current chapter & persist updated weekday baselines
    const closedChapter = await this.closeChapter(
      chapter.id,
      frozen,
      params.title,
      params.summary,
      params.photos,
      params.endDate
    )

    try {
      const table = buildDailyMetricsTable(days, chapterAnswers, questions, parts)
      const now = Date.now()
      const metricBuckets = new Map<string, number[][]>()

      // Overall rating baseline
      const ratingBuckets: number[][] = [[], [], [], [], [], [], []]
      for (const d of days) {
        if (typeof d.overallRating === 'number') {
          const wd = new Date(d.date + 'T00:00:00').getDay()
          ratingBuckets[wd].push(d.overallRating)
        }
      }
      metricBuckets.set('derived.overallRating', ratingBuckets)

      for (const m of table.metrics) {
        if (m.partKind !== 'scale' && m.partKind !== 'number' && m.partKind !== 'timerange') {
          continue
        }
        const buckets: number[][] = [[], [], [], [], [], [], []]
        for (const row of table.rows) {
          const val = row.values[m.key]
          if (typeof val === 'number' && !Number.isNaN(val)) {
            const wd = new Date(row.date + 'T00:00:00').getDay()
            buckets[wd].push(val)
          }
        }
        metricBuckets.set(m.key, buckets)
      }

      for (const [metricKey, buckets] of metricBuckets.entries()) {
        const totalN = buckets.reduce((acc, b) => acc + b.length, 0)
        if (totalN === 0) continue
        const weekdayMean = buckets.map((b) => (b.length > 0 ? Number(mean(b).toFixed(2)) : 0))
        const weekdaySd = buckets.map((b) =>
          b.length > 1 ? Number(standardDeviation(b).toFixed(2)) : 0
        )
        const existing = await this.db.baselines.where('metricKey').equals(metricKey).first()
        await this.db.baselines.put({
          id: existing?.id || generateUUIDv7(now),
          metricKey,
          weekdayMean,
          weekdaySd,
          n: totalN,
          asOfChapterId: closedChapter.id,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        })
      }
    } catch {
      // Non-fatal baseline update failure must not block chapter close
    }

    // 4. Auto-create next chapter starting the day after previous chapter's end date
    const nextStartDate = addDays(params.endDate, 1)
    const nextChapter = await this.createChapter({
      startDate: nextStartDate,
      themeId: chapter.themeId,
      characterId: chapter.characterId,
    })

    return { closedChapter, nextChapter }
  }
}
