import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type { Day, Answer, AnswerLink } from '../types'
import { ChapterRepository } from './ChapterRepository'

export class DayRepository {
  private chapterRepo: ChapterRepository

  constructor(private db: TrinqleDB = defaultDb) {
    this.chapterRepo = new ChapterRepository(this.db)
  }

  async getDay(date: string): Promise<Day | undefined> {
    return this.db.days.get(date)
  }

  async getDaysInDateRange(startDate: string, endDate: string): Promise<Day[]> {
    return this.db.days
      .where('date')
      .between(startDate, endDate, true, true)
      .and((d) => !d.deletedAt)
      .toArray()
  }

  async getAnswersForDate(date: string): Promise<Answer[]> {
    return this.db.answers
      .where('date')
      .equals(date)
      .and((a) => !a.deletedAt)
      .toArray()
  }

  async getAnswerLinksForDate(date: string): Promise<AnswerLink[]> {
    return this.db.answerLinks
      .where('date')
      .equals(date)
      .and((l) => !l.deletedAt)
      .toArray()
  }

  /**
   * Saves a day entry along with all its answers and library answer links.
   * Write-protected: throws if the day belongs to a closed chapter.
   */
  async saveDay(
    day: Day,
    answers: Answer[],
    answerLinks: AnswerLink[] = []
  ): Promise<void> {
    // Assert chapter is not closed
    await this.chapterRepo.assertDateNotClosed(day.date)

    await this.db.transaction('rw', [this.db.days, this.db.answers, this.db.answerLinks], async () => {
      // 1. Put Day
      await this.db.days.put(day)

      // 2. Remove old answers for this date
      await this.db.answers.where('date').equals(day.date).delete()

      // 3. Put new answers
      if (answers.length > 0) {
        await this.db.answers.bulkPut(answers)
      }

      // 4. Remove old links for this date
      await this.db.answerLinks.where('date').equals(day.date).delete()

      // 5. Put new links
      if (answerLinks.length > 0) {
        await this.db.answerLinks.bulkPut(answerLinks)
      }
    })
  }

  /**
   * Soft deletes a day and its answers.
   */
  async deleteDay(date: string): Promise<void> {
    await this.chapterRepo.assertDateNotClosed(date)
    const now = Date.now()

    await this.db.transaction('rw', [this.db.days, this.db.answers, this.db.answerLinks], async () => {
      const existingDay = await this.db.days.get(date)
      if (existingDay) {
        await this.db.days.put({ ...existingDay, deletedAt: now })
      }

      const answers = await this.db.answers.where('date').equals(date).toArray()
      for (const a of answers) {
        await this.db.answers.put({ ...a, deletedAt: now })
      }
    })
  }
}
