import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type { FormPack } from '../types'

export async function exportFormPack(
  name = 'Custom Form Pack',
  db: TrinqleDB = defaultDb
): Promise<FormPack> {
  const sections = await db.sections
    .filter((s) => !s.deletedAt && !s.validTo)
    .sortBy('order')

  const questions = await db.questions
    .filter((q) => !q.deletedAt && !q.validTo)
    .sortBy('order')

  const parts = await db.parts
    .filter((p) => !p.deletedAt && !p.validTo)
    .sortBy('order')

  const libraries = await db.libraries
    .filter((l) => !l.deletedAt && !l.retired)
    .toArray()

  const items = await db.items
    .filter((i) => !i.deletedAt && !i.retired)
    .toArray()

  // Read aliases if stored
  const aliasRecord = await db.settings.get('form_aliases')
  const aliases = (aliasRecord?.value as Record<string, string>) || {}

  // Structure libraries with items
  const exportedLibraries = libraries.map((lib) => ({
    id: lib.id,
    name: lib.name,
    items: items
      .filter((i) => i.libraryId === lib.id)
      .map((i) => i.name),
  }))

  // Structure questions with parts
  const exportedQuestions = questions.map((q) => ({
    id: q.id,
    sectionId: q.sectionId,
    parentId: q.parentId,
    label: q.label,
    icon: q.icon,
    order: q.order,
    repeats: q.repeats,
    special: q.special,
    showWhen: q.showWhen,
    schedule: q.schedule,
    parts: parts
      .filter((p) => p.questionId === q.id)
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        label: p.label,
        order: p.order,
        level: p.level,
        gate: p.gate,
        config: p.config,
      })),
  }))

  const exportedSections = sections.map((sec) => ({
    id: sec.id,
    name: sec.name,
    icon: sec.icon,
    order: sec.order,
    scope: sec.scope,
  }))

  return {
    formatVersion: 1,
    kind: 'form-pack',
    name,
    aliases,
    libraries: exportedLibraries,
    sections: exportedSections,
    questions: exportedQuestions,
  }
}
