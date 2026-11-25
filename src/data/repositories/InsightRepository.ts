import { db } from '../db'
import type { Run, Insight } from '../types'
import { generateUUIDv7 } from '../../core/ids'

export class InsightRepository {
  /**
   * Saves a full insight generation run and all its scored insights.
   */
  async saveRun(
    runData: Omit<Run, 'id' | 'createdAt' | 'updatedAt'>,
    insightsData: Array<Omit<Insight, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<{ run: Run; insights: Insight[] }> {
    const now = Date.now()
    const runId = generateUUIDv7(now)

    const newRun: Run = {
      ...runData,
      id: runId,
      createdAt: now,
      updatedAt: now,
    }

    const newInsights: Insight[] = insightsData.map((ins) => ({
      ...ins,
      id: generateUUIDv7(),
      runId,
      createdAt: now,
      updatedAt: now,
    }))

    await db.transaction('rw', [db.runs, db.insights], async () => {
      await db.runs.add(newRun)
      for (const ins of newInsights) {
        await db.insights.add(ins)
      }
    })

    return { run: newRun, insights: newInsights }
  }

  /**
   * Gets the most recent run and its insights.
   */
  async getLatestRun(): Promise<{ run: Run | null; insights: Insight[] }> {
    const allRuns = await db.runs.toArray()
    const validRuns = allRuns.filter((r) => !r.deletedAt)
    if (validRuns.length === 0) {
      return { run: null, insights: [] }
    }

    // Sort newest first
    validRuns.sort((a, b) => b.at - a.at)
    const latestRun = validRuns[0]

    const insights = await this.getInsightsForRun(latestRun.id)
    return { run: latestRun, insights }
  }

  /**
   * Gets all historical runs.
   */
  async getAllRuns(): Promise<Run[]> {
    const runs = await db.runs.toArray()
    return runs.filter((r) => !r.deletedAt).sort((a, b) => b.at - a.at)
  }

  /**
   * Gets all insights for a specific run.
   */
  async getInsightsForRun(runId: string): Promise<Insight[]> {
    const allInsights = await db.insights.where('runId').equals(runId).toArray()
    return allInsights
      .filter((i) => !i.deletedAt)
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Rates an insight from 1 to 5.
   * Ratings are persisted but do not alter objective statistical scores.
   */
  async rateInsight(insightId: string, rating: 1 | 2 | 3 | 4 | 5): Promise<void> {
    const ins = await db.insights.get(insightId)
    if (!ins || ins.deletedAt) return

    await db.insights.update(insightId, {
      rating,
      updatedAt: Date.now(),
    })
  }

  /**
   * Discards an insight. Discarded signatures are suppressed in future runs.
   */
  async discardInsight(insightId: string): Promise<void> {
    const ins = await db.insights.get(insightId)
    if (!ins || ins.deletedAt) return

    await db.insights.update(insightId, {
      status: 'discarded',
      updatedAt: Date.now(),
    })
  }

  /**
   * Restores a previously discarded insight back to active.
   */
  async undoDiscardInsight(insightId: string): Promise<void> {
    const ins = await db.insights.get(insightId)
    if (!ins || ins.deletedAt) return

    await db.insights.update(insightId, {
      status: 'active',
      updatedAt: Date.now(),
    })
  }

  /**
   * Gets all signatures of discarded insights.
   */
  async getDiscardedSignatures(): Promise<string[]> {
    const all = await db.insights.toArray()
    const signatures = new Set<string>()

    for (const ins of all) {
      if (!ins.deletedAt && ins.status === 'discarded') {
        signatures.add(ins.signature)
      }
    }

    return Array.from(signatures)
  }

  /**
   * Gets all signatures that have ever been surfaced.
   */
  async getKnownSignatures(): Promise<string[]> {
    const all = await db.insights.toArray()
    const signatures = new Set<string>()

    for (const ins of all) {
      if (!ins.deletedAt) {
        signatures.add(ins.signature)
      }
    }

    return Array.from(signatures)
  }
}
