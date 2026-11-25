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
import { isPlannedEndDateValid } from '../../core/chapters'
import { buildFrozenChapter } from '../../core/freeze'

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
      title: params.title || undefined,
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
    await this.db.chapters.put(chapter)
    return chapter
  }

  async updatePlannedEndDate(chapterId: string, plannedEndDate: string): Promise<Chapter> {
    const chapter = await this.getChapterById(chapterId)
    if (!chapter) throw new Error(`Chapter ${chapterId} not found`)
    if (chapter.status === 'closed') throw new Error('Chapter is closed and write-protected')

    if (!isPlannedEndDateValid(chapter.startDate, plannedEndDate)) {
      throw new Error('Planned end date must be up to 45 days from start date')
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

    const currentPrompts = chapter.customPrompts || []
    const updated: Chapter = {
      ...chapter,
      customPrompts: [...currentPrompts, prompt],
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

    const existing = await this.db.chapterAnswers
      .where('[chapterId+promptId]')
      .equals([chapterId, promptId])
      .first()

    if (existing) {
      const updated: ChapterAnswer = {
        ...existing,
        value,
        updatedAt: now,
      }
      await this.db.chapterAnswers.put(updated)
      return updated
    }

    const newRecord: ChapterAnswer = {
      id: generateUUIDv7(now),
      chapterId,
      promptId,
      value,
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
    const updated: Chapter = {
      ...chapter,
      title: title || chapter.title,
      summary: summary || chapter.summary,
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

    // 2. Gather form snapshot & answers
    const sections = await this.db.sections.filter((s) => !s.deletedAt).toArray()
    const questions = await this.db.questions.filter((q) => !q.deletedAt).toArray()
    const parts = await this.db.parts.filter((p) => !p.deletedAt).toArray()
    const libraries = await this.db.libraries.filter((l) => !l.deletedAt).toArray()

    const dayDates = new Set(days.map((d) => d.date))
    const allAnswers = await this.db.answers.filter((a) => !a.deletedAt).toArray()
    const chapterAnswers = allAnswers.filter((a) => dayDates.has(a.date))

    const frozen: FrozenChapter = buildFrozenChapter({
      chapter,
      days,
      answers: chapterAnswers,
      sections,
      questions,
      parts,
      libraries,
      title: params.title,
      summary: params.summary,
      photos: params.photos,
      endDate: params.endDate,
    })

    // 3. Close current chapter
    const closedChapter = await this.closeChapter(
      chapter.id,
      frozen,
      params.title,
      params.summary,
      params.photos,
      params.endDate
    )

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
