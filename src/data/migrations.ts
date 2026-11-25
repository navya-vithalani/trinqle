import type { TrinqleDB } from './db'
import { db as defaultDb } from './db'
import type { AnswerLink, LibraryConfig } from './types'
import { generateUUIDv7 } from '../core/ids'

const MIGRATION_FLAG_KEY = 'migration_lib_ids_v1'

/**
 * Idempotently migrates legacy library answers that stored item names (or plain strings)
 * instead of Item.id arrays, and ensures corresponding AnswerLink rows exist.
 */
export async function migrateLegacyLibraryAnswersIfNeeded(
  db: TrinqleDB = defaultDb
): Promise<number> {
  const done = await db.settings.get(MIGRATION_FLAG_KEY)
  if (done?.value === true) return 0

  const parts = await db.parts.filter((p) => !p.deletedAt && p.kind === 'library').toArray()
  if (parts.length === 0) {
    await db.settings.put({ key: MIGRATION_FLAG_KEY, value: true })
    return 0
  }

  const partMap = new Map(parts.map((p) => [p.id, p]))
  const allItems = await db.items.filter((i) => !i.deletedAt).toArray()
  const itemById = new Map(allItems.map((i) => [i.id, i]))

  // libraryId -> lowercased name -> Item
  const itemByLibAndName = new Map<string, Map<string, string>>()
  for (const it of allItems) {
    let inner = itemByLibAndName.get(it.libraryId)
    if (!inner) {
      inner = new Map()
      itemByLibAndName.set(it.libraryId, inner)
    }
    if (!inner.has(it.name.toLowerCase())) {
      inner.set(it.name.toLowerCase(), it.id)
    }
  }

  const libAnswers = await db.answers
    .filter((a) => !a.deletedAt && partMap.has(a.partId))
    .toArray()

  let migratedCount = 0
  const now = Date.now()

  await db.transaction('rw', [db.answers, db.answerLinks, db.items, db.settings], async () => {
    for (const ans of libAnswers) {
      const part = partMap.get(ans.partId)
      if (!part) continue
      const libId = (part.config as LibraryConfig)?.libraryId || ''
      const rawList: string[] = Array.isArray(ans.value)
        ? ans.value.map(String)
        : typeof ans.value === 'string' && ans.value.trim()
          ? [ans.value.trim()]
          : []

      if (rawList.length === 0) continue

      const resolvedIds: string[] = []
      let changed = !Array.isArray(ans.value)

      for (const token of rawList) {
        if (itemById.has(token)) {
          resolvedIds.push(token)
          continue
        }
        const byName = libId ? itemByLibAndName.get(libId)?.get(token.toLowerCase()) : undefined
        if (byName) {
          resolvedIds.push(byName)
          changed = true
        } else if (libId) {
          // Create missing item record so historical answer remains intact
          const newId = generateUUIDv7(now)
          await db.items.put({
            id: newId,
            libraryId: libId,
            name: token,
            createdAt: now,
            updatedAt: now,
          })
          itemById.set(newId, {
            id: newId,
            libraryId: libId,
            name: token,
            createdAt: now,
            updatedAt: now,
          })
          let inner = itemByLibAndName.get(libId)
          if (!inner) {
            inner = new Map()
            itemByLibAndName.set(libId, inner)
          }
          inner.set(token.toLowerCase(), newId)
          resolvedIds.push(newId)
          changed = true
        } else {
          resolvedIds.push(token)
        }
      }

      if (changed) {
        await db.answers.put({
          ...ans,
          value: resolvedIds,
          updatedAt: now,
        })
        migratedCount++
      }

      // Ensure AnswerLinks exist and reference resolved IDs
      const existingLinks = await db.answerLinks.where('answerId').equals(ans.id).toArray()
      const validIdsSet = new Set(resolvedIds)
      const needsLinkRewrite =
        existingLinks.length !== resolvedIds.length ||
        existingLinks.some((l) => !validIdsSet.has(l.itemId))

      if (needsLinkRewrite) {
        await db.answerLinks.where('answerId').equals(ans.id).delete()
        const newLinks: AnswerLink[] = resolvedIds.map((itemId) => ({
          id: generateUUIDv7(now),
          answerId: ans.id,
          date: ans.date,
          libraryId: libId,
          itemId,
          createdAt: now,
          updatedAt: now,
        }))
        if (newLinks.length > 0) {
          await db.answerLinks.bulkPut(newLinks)
        }
      }
    }

    await db.settings.put({ key: MIGRATION_FLAG_KEY, value: true })
  })

  return migratedCount
}
