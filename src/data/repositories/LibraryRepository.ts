import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type { Library, Item } from '../types'
import { generateUUIDv7 } from '../../core/ids'
import { LIMITS, clampText } from '../../core/limits'

export class LibraryRepository {
  constructor(private db: TrinqleDB = defaultDb) {}

  async getLibraries(): Promise<Library[]> {
    return this.db.libraries.filter((l) => !l.deletedAt && !l.retired).toArray()
  }

  async getAllLibraries(): Promise<Library[]> {
    return this.db.libraries.filter((l) => !l.deletedAt).toArray()
  }

  async getLibraryById(id: string): Promise<Library | undefined> {
    return this.db.libraries.get(id)
  }

  async getItems(libraryId: string): Promise<Item[]> {
    return this.db.items
      .where('libraryId')
      .equals(libraryId)
      .filter((i) => !i.deletedAt && !i.retired)
      .toArray()
  }

  async getAllItems(libraryId?: string): Promise<Item[]> {
    if (libraryId) {
      return this.db.items
        .where('libraryId')
        .equals(libraryId)
        .filter((i) => !i.deletedAt)
        .toArray()
    }
    return this.db.items.filter((i) => !i.deletedAt).toArray()
  }

  async createLibrary(name: string, id?: string): Promise<Library> {
    const now = Date.now()
    const lib: Library = {
      id: id || generateUUIDv7(now),
      name: clampText(name, LIMITS.LIBRARY_NAME),
      createdAt: now,
      updatedAt: now,
    }
    await this.db.libraries.put(lib)
    return lib
  }

  async renameLibrary(libraryId: string, newName: string): Promise<void> {
    const lib = await this.db.libraries.get(libraryId)
    if (lib) {
      await this.db.libraries.put({
        ...lib,
        name: clampText(newName, LIMITS.LIBRARY_NAME),
        updatedAt: Date.now(),
      })
    }
  }

  async retireLibrary(libraryId: string): Promise<void> {
    const lib = await this.db.libraries.get(libraryId)
    if (lib) {
      await this.db.libraries.put({
        ...lib,
        retired: true,
        updatedAt: Date.now(),
      })
    }
  }

  async createItem(libraryId: string, name: string, id?: string): Promise<Item> {
    const now = Date.now()
    const item: Item = {
      id: id || generateUUIDv7(now),
      libraryId,
      name: clampText(name, LIMITS.LIBRARY_ITEM_NAME),
      createdAt: now,
      updatedAt: now,
    }
    await this.db.items.put(item)
    return item
  }

  async renameItem(itemId: string, newName: string): Promise<void> {
    const item = await this.db.items.get(itemId)
    if (item) {
      await this.db.items.put({
        ...item,
        name: clampText(newName, LIMITS.LIBRARY_ITEM_NAME),
        updatedAt: Date.now(),
      })
    }
  }

  /**
   * Merges a source item into a target item.
   * Marks source as mergedInto and updates all AnswerLink rows.
   */
  async mergeItems(
    _libraryId: string,
    sourceItemId: string,
    targetItemId: string
  ): Promise<void> {
    const now = Date.now()
    await this.db.transaction('rw', [this.db.items, this.db.answerLinks], async () => {
      const source = await this.db.items.get(sourceItemId)
      if (source) {
        await this.db.items.put({
          ...source,
          mergedInto: targetItemId,
          retired: true,
          updatedAt: now,
        })
      }

      // Update answer links referencing source item
      const links = await this.db.answerLinks.where('itemId').equals(sourceItemId).toArray()
      for (const link of links) {
        await this.db.answerLinks.put({
          ...link,
          itemId: targetItemId,
          updatedAt: now,
        })
      }
    })
  }

  async retireItem(itemId: string): Promise<void> {
    const item = await this.db.items.get(itemId)
    if (item) {
      await this.db.items.put({
        ...item,
        retired: true,
        updatedAt: Date.now(),
      })
    }
  }

  /**
   * Returns up to `limit` recently used active Item IDs for a given library.
   */
  async getRecentItemIds(libraryId: string, limit = 4): Promise<string[]> {
    const links = await this.db.answerLinks
      .where('libraryId')
      .equals(libraryId)
      .filter((l) => !l.deletedAt)
      .toArray()

    links.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)

    const seen = new Set<string>()
    const recent: string[] = []
    for (const l of links) {
      if (!seen.has(l.itemId)) {
        seen.add(l.itemId)
        recent.push(l.itemId)
        if (recent.length >= limit) break
      }
    }
    return recent
  }
}
