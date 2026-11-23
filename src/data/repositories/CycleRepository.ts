import type { TrinqleDB } from '../db'
import { db as defaultDb } from '../db'
import type { Cycle } from '../types'
import { generateUUIDv7 } from '../../core/ids'

export class CycleRepository {
  constructor(private db: TrinqleDB = defaultDb) {}

  async getActiveCycle(): Promise<Cycle | undefined> {
    const all = await this.db.cycles.filter((c) => !c.deletedAt).toArray()
    return all.find((c) => !c.endDate)
  }

  async getAllCycles(): Promise<Cycle[]> {
    return this.db.cycles
      .filter((c) => !c.deletedAt)
      .sortBy('startDate')
  }

  async startCycle(startDate: string): Promise<Cycle> {
    const existing = await this.getActiveCycle()
    if (existing) return existing

    const now = Date.now()
    const cycle: Cycle = {
      id: generateUUIDv7(now),
      startDate,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.cycles.put(cycle)
    return cycle
  }

  async endCycle(cycleId: string, endDate: string): Promise<Cycle> {
    const cycle = await this.db.cycles.get(cycleId)
    if (!cycle) throw new Error(`Cycle ${cycleId} not found`)

    const updated: Cycle = {
      ...cycle,
      endDate,
      updatedAt: Date.now(),
    }
    await this.db.cycles.put(updated)
    return updated
  }
}
