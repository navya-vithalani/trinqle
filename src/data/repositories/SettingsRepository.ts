import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'

export class SettingsRepository {
  constructor(private db: TrinqleDB = defaultDb) {}

  async getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const record = await this.db.settings.get(key)
    if (!record) return defaultValue
    return record.value as T
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await this.db.settings.put({ key, value })
  }

  async getAllSettings(): Promise<Record<string, unknown>> {
    const list = await this.db.settings.toArray()
    const result: Record<string, unknown> = {}
    for (const item of list) {
      result[item.key] = item.value
    }
    return result
  }
}
