import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type { FormPack, Section, Question, Part, Library, Item } from '../types'
import { validateFormPack } from './validator'
import { generateUUIDv7 } from '../../core/ids'

export interface ImportSummary {
  sectionsAdded: number
  questionsAdded: number
  partsAdded: number
  librariesAdded: number
  itemsAdded: number
}

export async function importFormPack(
  pack: FormPack,
  mode: 'merge' | 'replace' = 'replace',
  db: TrinqleDB = defaultDb
): Promise<ImportSummary> {
  const validation = validateFormPack(pack)
  if (!validation.valid) {
    throw new Error(`Invalid form pack:\n${validation.errors.join('\n')}`)
  }

  const now = Date.now()
  const summary: ImportSummary = {
    sectionsAdded: 0,
    questionsAdded: 0,
    partsAdded: 0,
    librariesAdded: 0,
    itemsAdded: 0,
  }

  await db.transaction('rw', [db.sections, db.questions, db.parts, db.libraries, db.items, db.settings], async () => {
    if (mode === 'replace') {
      await db.sections.clear()
      await db.questions.clear()
      await db.parts.clear()
      await db.libraries.clear()
      await db.items.clear()
    }

    // 1. Process Libraries and Items
    for (const libDef of pack.libraries) {
      const existingLib = await db.libraries.get(libDef.id)
      if (!existingLib) {
        const lib: Library = {
          id: libDef.id,
          name: libDef.name,
          createdAt: now,
          updatedAt: now,
        }
        await db.libraries.put(lib)
        summary.librariesAdded++
      }

      for (const itemName of libDef.items) {
        // Find if item exists in this library
        const existingItem = await db.items
          .where('libraryId')
          .equals(libDef.id)
          .and((i) => i.name.toLowerCase() === itemName.toLowerCase() && !i.deletedAt)
          .first()

        if (!existingItem) {
          const item: Item = {
            id: generateUUIDv7(now),
            libraryId: libDef.id,
            name: itemName,
            createdAt: now,
            updatedAt: now,
          }
          await db.items.put(item)
          summary.itemsAdded++
        }
      }
    }

    // 2. Process Sections
    for (const secDef of pack.sections) {
      const existingSec = await db.sections.get(secDef.id)
      if (!existingSec || mode === 'replace') {
        const sec: Section = {
          id: secDef.id,
          name: secDef.name,
          icon: secDef.icon || 'folder',
          order: secDef.order ?? 0,
          scope: secDef.scope || 'daily',
          createdAt: now,
          updatedAt: now,
        }
        await db.sections.put(sec)
        summary.sectionsAdded++
      }
    }

    // 3. Process Questions and Parts
    for (const qDef of pack.questions) {
      const existingQ = await db.questions.get(qDef.id)
      if (!existingQ || mode === 'replace') {
        const q: Question = {
          id: qDef.id,
          sectionId: qDef.sectionId,
          parentId: qDef.parentId,
          label: qDef.label,
          icon: qDef.icon,
          order: qDef.order ?? 0,
          repeats: qDef.repeats ?? false,
          special: qDef.special,
          showWhen: qDef.showWhen,
          schedule: qDef.schedule,
          createdAt: now,
          updatedAt: now,
        }
        await db.questions.put(q)
        summary.questionsAdded++
      }

      for (const pDef of qDef.parts) {
        const existingP = await db.parts.get(pDef.id)
        if (!existingP || mode === 'replace') {
          const p: Part = {
            id: pDef.id,
            questionId: qDef.id,
            kind: pDef.kind,
            label: pDef.label,
            order: pDef.order ?? 0,
            level: pDef.level ?? 'core',
            gate: pDef.gate,
            config: pDef.config ?? {},
            createdAt: now,
            updatedAt: now,
          }
          await db.parts.put(p)
          summary.partsAdded++
        }
      }
    }

    // 4. Store aliases in settings if present
    if (pack.aliases) {
      await db.settings.put({
        key: 'form_aliases',
        value: pack.aliases,
      })
    }
  })

  return summary
}
