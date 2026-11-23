import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type { Library, Item } from '../types'
import { generateUUIDv7 } from '../../core/ids'

export class LibraryRepository {
  constructor(private db: TrinqleDB = defaultDb) {}

  async getLibraries(): Promise<Library[]> {
    return this.db.libraries.filter((l) => !l.deletedAt && !l.retired).toArray()
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

  async createLibrary(name: string, id?: string): Promise<Library> {
    const now = Date.now()
    const lib: Library = {
      id: id || generateUUIDv7(now),
      name,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.libraries.put(lib)
    return lib
  }

  async createItem(libraryId: string, name: string, id?: string): Promise<Item> {
    const now = Date.now()
    const item: Item = {
      id: id || generateUUIDv7(now),
      libraryId,
      name,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.items.put(item)
    return item
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
}
