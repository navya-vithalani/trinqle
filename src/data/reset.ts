import type { TrinqleDB } from './db'
import { db as defaultDb } from './db'

export async function deleteAllData(
  confirmation: string,
  db: TrinqleDB = defaultDb
): Promise<void> {
  if (confirmation !== 'DELETE') {
    throw new Error('Confirmation string must be "DELETE"')
  }

  await db.deleteAllData()

  // Re-seed essential default settings
  await db.settings.bulkPut([
    { key: 'timeFormat', value: '12h' },
    { key: 'weekStart', value: 1 }, // 1 = Monday
    { key: 'windowStartHour', value: 21 },
    { key: 'windowEndHour', value: 3 },
    { key: 'themeId', value: 'cutesy' },
    { key: 'characterName', value: 'Piqsie' },
    { key: 'characterId', value: 'white-cat' },
  ])
}
