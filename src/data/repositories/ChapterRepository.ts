import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type { Chapter, FrozenChapter } from '../types'
import { generateUUIDv7 } from '../../core/ids'
import { addDays } from '../../core/logicalDay'

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
    // A chapter covers startDate .. (endDate || plannedEndDate)
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

  async closeChapter(
    chapterId: string,
    frozen: FrozenChapter,
    title?: string,
    summary?: string
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
      frozen,
      closedAt: now,
      updatedAt: now,
    }

    await this.db.chapters.put(updated)
    return updated
  }
}
