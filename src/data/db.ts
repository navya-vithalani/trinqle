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
  }

  /**
   * Completely wipes all data in all tables and cleans up IndexedDB.
   */
  async deleteAllData(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      for (const table of this.tables) {
        await table.clear()
      }
    })
  }
}

// Singleton database instance
export const db = new TrinqleDB()
