import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type {
  Section,
  Question,
  Part,
  SectionScope,
  PartKind,
  PartLevel,
  PartConfig,
  ShowWhenRule,
  QuestionSchedule,
} from '../types'
import { filterActiveItems } from '../../core/effectiveDating'
import { generateUUIDv7 } from '../../core/ids'

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

  async createSection(params: {
    name: string
    icon?: string
    order?: number
    scope?: SectionScope
    validFrom?: string | null
  }): Promise<Section> {
    const now = Date.now()
    const allSections = await this.getSections()
    const order = params.order ?? allSections.length

    const section: Section = {
      id: generateUUIDv7(now),
      name: params.name,
      icon: params.icon || 'Folder',
      order,
      scope: params.scope || 'daily',
      validFrom: params.validFrom ?? null,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.sections.put(section)
    return section
  }

  async reorderSections(orderedIds: string[]): Promise<void> {
    const now = Date.now()
    await this.db.transaction('rw', this.db.sections, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        const sec = await this.db.sections.get(orderedIds[i])
        if (sec) {
          await this.db.sections.put({ ...sec, order: i, updatedAt: now })
        }
      }
    })
  }

  async retireSection(id: string, date: string): Promise<void> {
    const section = await this.db.sections.get(id)
    if (section) {
      await this.db.sections.put({ ...section, validTo: date, updatedAt: Date.now() })
    }
  }

  async saveQuestion(question: Question): Promise<void> {
    await this.db.questions.put(question)
  }

  async createQuestion(params: {
    sectionId: string
    label: string
    icon?: string
    order?: number
    repeats?: boolean
    parentId?: string
    showWhen?: ShowWhenRule
    schedule?: QuestionSchedule
    validFrom?: string | null
  }): Promise<Question> {
    const now = Date.now()
    const existing = await this.db.questions
      .where('sectionId')
      .equals(params.sectionId)
      .filter((q) => !q.deletedAt)
      .toArray()
    const order = params.order ?? existing.length

    const question: Question = {
      id: generateUUIDv7(now),
      sectionId: params.sectionId,
      label: params.label,
      icon: params.icon,
      order,
      repeats: params.repeats ?? false,
      parentId: params.parentId,
      showWhen: params.showWhen,
      schedule: params.schedule,
      validFrom: params.validFrom ?? null,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.questions.put(question)
    return question
  }

  async moveQuestionToSection(questionId: string, targetSectionId: string): Promise<void> {
    const q = await this.db.questions.get(questionId)
    if (q) {
      const existing = await this.db.questions
        .where('sectionId')
        .equals(targetSectionId)
        .filter((item) => !item.deletedAt)
        .toArray()
      await this.db.questions.put({
        ...q,
        sectionId: targetSectionId,
        order: existing.length,
        updatedAt: Date.now(),
      })
    }
  }

  async reorderQuestions(_sectionId: string, orderedIds: string[]): Promise<void> {
    const now = Date.now()
    await this.db.transaction('rw', this.db.questions, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        const q = await this.db.questions.get(orderedIds[i])
        if (q) {
          await this.db.questions.put({ ...q, order: i, updatedAt: now })
        }
      }
    })
  }

  async retireQuestion(id: string, date: string): Promise<void> {
    const q = await this.db.questions.get(id)
    if (q) {
      await this.db.questions.put({ ...q, validTo: date, updatedAt: Date.now() })
    }
  }

  async savePart(part: Part): Promise<void> {
    await this.db.parts.put(part)
  }

  async createPart(params: {
    questionId: string
    kind: PartKind
    label: string
    level?: PartLevel
    order?: number
    gate?: boolean
    config?: PartConfig
    validFrom?: string | null
  }): Promise<Part> {
    const now = Date.now()
    const existing = await this.db.parts
      .where('questionId')
      .equals(params.questionId)
      .filter((p) => !p.deletedAt)
      .toArray()
    const order = params.order ?? existing.length

    const part: Part = {
      id: generateUUIDv7(now),
      questionId: params.questionId,
      kind: params.kind,
      label: params.label,
      level: params.level || 'core',
      order,
      gate: params.gate,
      config: params.config || {},
      validFrom: params.validFrom ?? null,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.parts.put(part)
    return part
  }

  async togglePartLevel(partId: string): Promise<Part> {
    const part = await this.db.parts.get(partId)
    if (!part) throw new Error(`Part ${partId} not found`)
    const nextLevel: PartLevel = part.level === 'core' ? 'extra' : 'core'
    const updated: Part = {
      ...part,
      level: nextLevel,
      updatedAt: Date.now(),
    }
    await this.db.parts.put(updated)
    return updated
  }

  async retirePart(id: string, date: string): Promise<void> {
    const p = await this.db.parts.get(id)
    if (p) {
      await this.db.parts.put({ ...p, validTo: date, updatedAt: Date.now() })
    }
  }
}
