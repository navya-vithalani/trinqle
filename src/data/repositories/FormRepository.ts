import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type { Section, Question, Part } from '../types'
import { filterActiveItems } from '../../core/effectiveDating'

export class FormRepository {
  constructor(private db: TrinqleDB = defaultDb) {}

  async getSections(date?: string): Promise<Section[]> {
    const all = await this.db.sections
      .orderBy('order')
      .filter((s) => !s.deletedAt)
      .toArray()
    return date ? filterActiveItems(all, date) : all
  }

  async getQuestions(date?: string): Promise<Question[]> {
    const all = await this.db.questions
      .orderBy('order')
      .filter((q) => !q.deletedAt)
      .toArray()
    return date ? filterActiveItems(all, date) : all
  }

  async getParts(date?: string): Promise<Part[]> {
    const all = await this.db.parts
      .orderBy('order')
      .filter((p) => !p.deletedAt)
      .toArray()
    return date ? filterActiveItems(all, date) : all
  }

  async getSnapshot(date?: string): Promise<{ sections: Section[]; questions: Question[]; parts: Part[] }> {
    const [sections, questions, parts] = await Promise.all([
      this.getSections(date),
      this.getQuestions(date),
      this.getParts(date),
    ])
    return { sections, questions, parts }
  }

  async saveSection(section: Section): Promise<void> {
    await this.db.sections.put(section)
  }

  async saveQuestion(question: Question): Promise<void> {
    await this.db.questions.put(question)
  }

  async savePart(part: Part): Promise<void> {
    await this.db.parts.put(part)
  }

  async retireSection(id: string, date: string): Promise<void> {
    const section = await this.db.sections.get(id)
    if (section) {
      await this.db.sections.put({ ...section, validTo: date, updatedAt: Date.now() })
    }
  }

  async retireQuestion(id: string, date: string): Promise<void> {
    const q = await this.db.questions.get(id)
    if (q) {
      await this.db.questions.put({ ...q, validTo: date, updatedAt: Date.now() })
    }
  }

  async retirePart(id: string, date: string): Promise<void> {
    const p = await this.db.parts.get(id)
    if (p) {
      await this.db.parts.put({ ...p, validTo: date, updatedAt: Date.now() })
    }
  }
}
