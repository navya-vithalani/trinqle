import Dexie, { type Table } from 'dexie'
import type {
  Section,
  Question,
  Part,
  Library,
  Item,
  Day,
  Answer,
  AnswerLink,
  Cycle,
  ChapterAnswer,
  Chapter,
  Baseline,
  Run,
  Insight,
  Sticker,
  Setting,
} from './types'

interface ClosedChapterSpan {
  id: string
  startDate: string
  endDate: string
}

export class TrinqleDB extends Dexie {
  sections!: Table<Section, string>
  questions!: Table<Question, string>
  parts!: Table<Part, string>
  libraries!: Table<Library, string>
  items!: Table<Item, string>
  days!: Table<Day, string>
  answers!: Table<Answer, string>
  answerLinks!: Table<AnswerLink, string>
  cycles!: Table<Cycle, string>
  chapterAnswers!: Table<ChapterAnswer, string>
  chapters!: Table<Chapter, string>
  baselines!: Table<Baseline, string>
  runs!: Table<Run, string>
  insights!: Table<Insight, string>
  stickers!: Table<Sticker, string>
  settings!: Table<Setting, string>

  private closedChaptersCache = new Map<string, ClosedChapterSpan>()
  private bypassClosedGuard = false

  constructor(dbName = 'trinqle_db') {
    super(dbName)

    this.version(1).stores({
      sections: 'id, order, scope, validFrom, validTo, deletedAt',
      questions: 'id, sectionId, parentId, order, validFrom, validTo, deletedAt',
      parts: 'id, questionId, order, kind, level, validFrom, validTo, deletedAt',
      libraries: 'id, name, retired, deletedAt',
      items: 'id, libraryId, name, retired, mergedInto, deletedAt',
      days: 'date, chapterId, memorability, mode, backfilled, filledAt, deletedAt',
      answers: 'id, [date+partId+instance], date, questionId, partId, deletedAt',
      answerLinks: 'id, answerId, date, libraryId, itemId, deletedAt',
      cycles: 'id, startDate, endDate, deletedAt',
      chapterAnswers: 'id, [chapterId+promptId], chapterId, promptId, deletedAt',
      chapters: 'id, status, startDate, plannedEndDate, endDate, deletedAt',
      baselines: 'id, metricKey, asOfChapterId, deletedAt',
      runs: 'id, at, trigger, deletedAt',
      insights: 'id, runId, signature, score, status, deletedAt',
      stickers: 'id, name, builtin, deletedAt',
      settings: 'key',
    })

    // Hydrate closed-chapter cache before any query/mutation executes
    this.on('ready', async () => {
      const closed = await this.chapters
        .where('status')
        .equals('closed')
        .toArray()
      this.closedChaptersCache.clear()
      for (const ch of closed) {
        if (!ch.deletedAt) {
          this.closedChaptersCache.set(ch.id, {
            id: ch.id,
            startDate: ch.startDate,
            endDate: ch.endDate || ch.plannedEndDate,
          })
        }
      }
    })

    const assertDateOpen = (date?: string) => {
      if (this.bypassClosedGuard || !date) return
      for (const span of this.closedChaptersCache.values()) {
        if (date >= span.startDate && date <= span.endDate) {
          throw new Error('Chapter is closed and write-protected')
        }
      }
    }

    const assertChapterIdOpen = (chapterId?: string) => {
      if (this.bypassClosedGuard || !chapterId) return
      if (this.closedChaptersCache.has(chapterId)) {
        throw new Error('Chapter is closed and write-protected')
      }
    }

    // Track closed chapter transitions and block mutations on already-closed chapters
    this.chapters.hook('creating', (_primKey, obj) => {
      if (!this.bypassClosedGuard && this.closedChaptersCache.has(obj.id)) {
        throw new Error('Chapter is closed and write-protected')
      }
      if (obj.status === 'closed' && !obj.deletedAt) {
        this.closedChaptersCache.set(obj.id, {
          id: obj.id,
          startDate: obj.startDate,
          endDate: obj.endDate || obj.plannedEndDate,
        })
      }
    })

    this.chapters.hook('updating', (modifications, primKey, obj) => {
      if (!this.bypassClosedGuard && obj.status === 'closed') {
        throw new Error('Chapter is closed and write-protected')
      }
      const next = { ...obj, ...modifications } as Chapter
      if (next.status === 'closed' && !next.deletedAt) {
        this.closedChaptersCache.set(String(primKey), {
          id: String(primKey),
          startDate: next.startDate,
          endDate: next.endDate || next.plannedEndDate,
        })
      } else {
        this.closedChaptersCache.delete(String(primKey))
      }
    })

    this.chapters.hook('deleting', (primKey, obj) => {
      if (!this.bypassClosedGuard && obj?.status === 'closed') {
        throw new Error('Chapter is closed and write-protected')
      }
      this.closedChaptersCache.delete(String(primKey))
    })

    // Database-level backstop for days, answers, answerLinks, chapterAnswers (F10)
    this.days.hook('creating', (_pk, obj) => {
      assertChapterIdOpen(obj.chapterId)
      assertDateOpen(obj.date)
    })
    this.days.hook('updating', (mods, _pk, obj) => {
      assertChapterIdOpen(obj.chapterId)
      assertDateOpen(obj.date)
      const next = mods as Partial<Day>
      if (next.chapterId) assertChapterIdOpen(next.chapterId)
      if (next.date) assertDateOpen(next.date)
    })
    this.days.hook('deleting', (_pk, obj) => {
      assertChapterIdOpen(obj?.chapterId)
      assertDateOpen(obj?.date)
    })

    this.answers.hook('creating', (_pk, obj) => {
      assertDateOpen(obj.date)
    })
    this.answers.hook('updating', (mods, _pk, obj) => {
      assertDateOpen(obj.date)
      const next = mods as Partial<Answer>
      if (next.date) assertDateOpen(next.date)
    })
    this.answers.hook('deleting', (_pk, obj) => {
      assertDateOpen(obj?.date)
    })

    this.answerLinks.hook('creating', (_pk, obj) => {
      assertDateOpen(obj.date)
    })
    this.answerLinks.hook('updating', (mods, _pk, obj) => {
      assertDateOpen(obj.date)
      const next = mods as Partial<AnswerLink>
      if (next.date) assertDateOpen(next.date)
    })
    this.answerLinks.hook('deleting', (_pk, obj) => {
      assertDateOpen(obj?.date)
    })

    this.chapterAnswers.hook('creating', (_pk, obj) => {
      assertChapterIdOpen(obj.chapterId)
    })
    this.chapterAnswers.hook('updating', (mods, _pk, obj) => {
      assertChapterIdOpen(obj.chapterId)
      const next = mods as Partial<ChapterAnswer>
      if (next.chapterId) assertChapterIdOpen(next.chapterId)
    })
    this.chapterAnswers.hook('deleting', (_pk, obj) => {
      assertChapterIdOpen(obj?.chapterId)
    })
  }

  /**
   * Executes an explicit restore/reset operation with closed-chapter hooks temporarily bypassed.
   */
  async runBypassingClosedGuard<T>(fn: () => Promise<T>): Promise<T> {
    this.bypassClosedGuard = true
    try {
      return await fn()
    } finally {
      this.bypassClosedGuard = false
      const closed = await this.chapters
        .where('status')
        .equals('closed')
        .toArray()
      this.closedChaptersCache.clear()
      for (const ch of closed) {
        if (!ch.deletedAt) {
          this.closedChaptersCache.set(ch.id, {
            id: ch.id,
            startDate: ch.startDate,
            endDate: ch.endDate || ch.plannedEndDate,
          })
        }
      }
    }
  }

  /**
   * Completely wipes all data in all tables and cleans up IndexedDB.
   */
  async deleteAllData(): Promise<void> {
    await this.runBypassingClosedGuard(async () => {
      await this.transaction('rw', this.tables, async () => {
        for (const table of this.tables) {
          await table.clear()
        }
      })
    })
  }
}

// Singleton database instance
export const db = new TrinqleDB()
