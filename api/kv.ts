import type { StoredSubscription, NotificationPrefs } from '../src/core/notifications/types'

// In-memory / process-level store for fallback and local execution
const memoryStore = new Map<string, StoredSubscription>()

/**
 * Normalizes an endpoint string to a safe KV key.
 */
function endpointToKey(endpoint: string): string {
  // Hash or base64url the endpoint to avoid special characters
  const encoded = Buffer.from(endpoint).toString('base64url')
  return `sub:${encoded}`
}

export class SubscriptionStore {
  /**
   * Saves or updates a push subscription in the store.
   */
  async save(sub: StoredSubscription): Promise<void> {
    const key = endpointToKey(sub.subscription.endpoint)

    // Check for Vercel / Upstash KV REST API
    const kvUrl = process.env.KV_REST_API_URL
    const kvToken = process.env.KV_REST_API_TOKEN

    if (kvUrl && kvToken) {
      try {
        await fetch(`${kvUrl}/set/${key}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${kvToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sub),
        })

        // Also add key to the set of all subscription keys
        await fetch(`${kvUrl}/sadd/sub_keys/${key}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${kvToken}` },
        })
        return
      } catch (err) {
        console.warn('KV remote write failed, using local store:', err)
      }
    }

    memoryStore.set(key, sub)
  }

  /**
   * Removes a subscription by its endpoint.
   */
  async remove(endpoint: string): Promise<void> {
    const key = endpointToKey(endpoint)

    const kvUrl = process.env.KV_REST_API_URL
    const kvToken = process.env.KV_REST_API_TOKEN

    if (kvUrl && kvToken) {
      try {
        await fetch(`${kvUrl}/del/${key}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${kvToken}` },
        })
        await fetch(`${kvUrl}/srem/sub_keys/${key}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${kvToken}` },
        })
        return
      } catch (err) {
        console.warn('KV remote delete failed:', err)
      }
    }

    memoryStore.delete(key)
  }

  /**
   * Retrieves a single subscription by endpoint.
   */
  async get(endpoint: string): Promise<StoredSubscription | null> {
    const key = endpointToKey(endpoint)

    const kvUrl = process.env.KV_REST_API_URL
    const kvToken = process.env.KV_REST_API_TOKEN

    if (kvUrl && kvToken) {
      try {
        const res = await fetch(`${kvUrl}/get/${key}`, {
          headers: { Authorization: `Bearer ${kvToken}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data && data.result) {
            return typeof data.result === 'string' ? JSON.parse(data.result) : data.result
          }
        }
      } catch {
        // Fallback to local
      }
    }

    return memoryStore.get(key) || null
  }

  /**
   * Retrieves all registered subscriptions.
   */
  async getAll(): Promise<StoredSubscription[]> {
    const kvUrl = process.env.KV_REST_API_URL
    const kvToken = process.env.KV_REST_API_TOKEN

    if (kvUrl && kvToken) {
      try {
        const res = await fetch(`${kvUrl}/smembers/sub_keys`, {
          headers: { Authorization: `Bearer ${kvToken}` },
        })
        if (res.ok) {
          const data = await res.json()
          const keys: string[] = data.result || []
          const fetched = await Promise.all(
            keys.map(async (key) => {
              const subRes = await fetch(`${kvUrl}/get/${key}`, {
                headers: { Authorization: `Bearer ${kvToken}` },
              })
              if (!subRes.ok) return null
              const subData = await subRes.json()
              if (!subData || !subData.result) return null
              return (
                typeof subData.result === 'string'
                  ? JSON.parse(subData.result)
                  : subData.result
              ) as StoredSubscription
            })
          )
          return fetched.filter((s): s is StoredSubscription => s !== null)
        }
      } catch {
        // Fallback to local
      }
    }

    return Array.from(memoryStore.values())
  }

  /**
   * Updates notification preferences and timezone for an endpoint.
   */
  async updatePrefs(endpoint: string, prefs: Partial<NotificationPrefs>, tz?: string): Promise<boolean> {
    const existing = await this.get(endpoint)
    if (!existing) return false

    const updated: StoredSubscription = {
      ...existing,
      prefs: { ...existing.prefs, ...prefs },
      tz: tz || existing.tz,
      updatedAt: Date.now(),
    }
    await this.save(updated)
    return true
  }

  /**
   * Records a successfully dispatched notification date to prevent duplicates.
   */
  async recordSent(
    endpoint: string,
    type: 'daily' | 'monday_insights' | 'chapter_ending',
    dateStr: string
  ): Promise<void> {
    const existing = await this.get(endpoint)
    if (!existing) return

    const lastSent = existing.lastSent || {}
    if (type === 'daily') lastSent.dailyReminder = dateStr
    if (type === 'monday_insights') lastSent.mondayInsights = dateStr
    if (type === 'chapter_ending') lastSent.chapterEnding = dateStr

    const updated: StoredSubscription = {
      ...existing,
      lastSent,
      updatedAt: Date.now(),
    }
    await this.save(updated)
  }

  /**
   * Clears all subscriptions (for testing).
   */
  async clearAll(): Promise<void> {
    memoryStore.clear()
  }

  async clear(): Promise<void> {
    await this.clearAll()
  }
}

export const subscriptionStore = new SubscriptionStore()
