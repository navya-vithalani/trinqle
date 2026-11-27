import crypto from 'crypto'
import type { StoredSubscription, NotificationPrefs } from '../src/core/notifications/types.js'

export const MAX_SUBSCRIPTIONS = 500

export class KvUnavailableError extends Error {
  status = 503
  constructor(
    message = 'Subscription storage is not configured on the server: set KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_* / <PREFIX>_KV_REST_API_*).'
  ) {
    super(message)
  }
}

export class SubscriptionLimitError extends Error {
  status = 429
  constructor(message = 'Maximum number of registered push subscriptions reached') {
    super(message)
  }
}

// Explicit test-only memory store (disabled in production / serverless deployments)
const memoryStore = new Map<string, StoredSubscription>()

function isMemoryStoreAllowed(): boolean {
  return (
    process.env.VITEST === 'true' ||
    process.env.TRINQLE_TEST_MEMORY_KV === '1'
  )
}

function resolveEnvPair(urlKey: string, tokenKey: string): { kvUrl: string; kvToken: string } | null {
  const kvUrl = process.env[urlKey]?.trim()
  const kvToken = process.env[tokenKey]?.trim()
  if (kvUrl && kvToken) {
    return { kvUrl: kvUrl.replace(/\/+$/, ''), kvToken }
  }
  return null
}

export function getKvConfig(): { kvUrl: string; kvToken: string } | null {
  const direct =
    resolveEnvPair('KV_REST_API_URL', 'KV_REST_API_TOKEN') ||
    resolveEnvPair('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN') ||
    resolveEnvPair('PUSH_KV_REST_API_URL', 'PUSH_KV_REST_API_TOKEN') ||
    resolveEnvPair('PUSH_UPSTASH_REDIS_REST_URL', 'PUSH_UPSTASH_REDIS_REST_TOKEN')
  if (direct) return direct

  // Support any custom Vercel Storage prefix (e.g. MYSTORE_KV_REST_API_URL + MYSTORE_KV_REST_API_TOKEN)
  for (const key of Object.keys(process.env).sort()) {
    if (key.endsWith('_KV_REST_API_URL')) {
      const prefix = key.slice(0, -'_KV_REST_API_URL'.length)
      const matched = resolveEnvPair(`${prefix}_KV_REST_API_URL`, `${prefix}_KV_REST_API_TOKEN`)
      if (matched) return matched
    }
  }

  if (!isMemoryStoreAllowed()) {
    throw new KvUnavailableError()
  }
  return null
}

async function kvFetchJson<T = unknown>(
  kvUrl: string,
  kvToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${kvUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${kvToken}`,
      ...(init.headers || {}),
    },
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`KV request failed (${res.status}) on ${path}${detail ? `: ${detail}` : ''}`)
  }

  return (await res.json()) as T
}

async function kvPipeline(
  kvUrl: string,
  kvToken: string,
  commands: unknown[][]
): Promise<Array<{ result?: unknown; error?: string }>> {
  const results = await kvFetchJson<Array<{ result?: unknown; error?: string }>>(
    kvUrl,
    kvToken,
    '/pipeline',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    }
  )

  for (const item of results) {
    if (item && typeof item === 'object' && item.error) {
      throw new Error(`KV pipeline command failed: ${item.error}`)
    }
  }

  return results
}

/**
 * Computes a collision-resistant SHA-256 Redis key for a push endpoint URL.
 */
export function endpointToKey(endpoint: string): string {
  const digest = crypto.createHash('sha256').update(endpoint, 'utf8').digest('hex')
  return `sub:${digest}`
}

const RECORD_SENT_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then
  return 0
end
local sub = cjson.decode(raw)
if not sub["lastSent"] or type(sub["lastSent"]) ~= "table" then
  sub["lastSent"] = {}
end
sub["lastSent"][ARGV[1]] = ARGV[2]
sub["updatedAt"] = tonumber(ARGV[3])
redis.call("SET", KEYS[1], cjson.encode(sub))
return 1
`

export class SubscriptionStore {
  /**
   * Saves or updates a push subscription in KV (or test memory store).
   */
  async save(sub: StoredSubscription): Promise<void> {
    const key = endpointToKey(sub.subscription.endpoint)
    const cfg = getKvConfig()

    if (cfg) {
      const checkResults = await kvPipeline(cfg.kvUrl, cfg.kvToken, [
        ['SISMEMBER', 'sub_keys', key],
        ['SCARD', 'sub_keys'],
      ])
      const alreadyMember = Number(checkResults[0]?.result || 0) === 1
      const totalCount = Number(checkResults[1]?.result || 0)

      if (!alreadyMember && totalCount >= MAX_SUBSCRIPTIONS) {
        throw new SubscriptionLimitError()
      }

      await kvPipeline(cfg.kvUrl, cfg.kvToken, [
        ['SET', key, JSON.stringify(sub)],
        ['SADD', 'sub_keys', key],
      ])
      return
    }

    if (!memoryStore.has(key) && memoryStore.size >= MAX_SUBSCRIPTIONS) {
      throw new SubscriptionLimitError()
    }
    memoryStore.set(key, sub)
  }

  /**
   * Removes a subscription by its endpoint.
   */
  async remove(endpoint: string): Promise<void> {
    const key = endpointToKey(endpoint)
    const cfg = getKvConfig()

    if (cfg) {
      await kvPipeline(cfg.kvUrl, cfg.kvToken, [
        ['DEL', key],
        ['SREM', 'sub_keys', key],
      ])
      return
    }

    memoryStore.delete(key)
  }

  /**
   * Retrieves a single subscription by endpoint.
   */
  async get(endpoint: string): Promise<StoredSubscription | null> {
    const key = endpointToKey(endpoint)
    const cfg = getKvConfig()

    if (cfg) {
      const data = await kvFetchJson<{ result?: unknown }>(
        cfg.kvUrl,
        cfg.kvToken,
        `/get/${encodeURIComponent(key)}`
      )
      if (!data || data.result === null || data.result === undefined) {
        return null
      }
      return (
        typeof data.result === 'string' ? JSON.parse(data.result) : data.result
      ) as StoredSubscription
    }

    return memoryStore.get(key) || null
  }

  /**
   * Retrieves all registered subscriptions using SMEMBERS + single MGET command.
   */
  async getAll(): Promise<StoredSubscription[]> {
    const cfg = getKvConfig()

    if (cfg) {
      const membersData = await kvFetchJson<{ result?: string[] }>(
        cfg.kvUrl,
        cfg.kvToken,
        '/smembers/sub_keys'
      )
      const keys = membersData.result || []
      if (keys.length === 0) return []

      const [mgetResult] = await kvPipeline(cfg.kvUrl, cfg.kvToken, [['MGET', ...keys]])
      const rawValues = Array.isArray(mgetResult?.result) ? mgetResult.result : []

      const parsed: StoredSubscription[] = []
      for (const raw of rawValues) {
        if (!raw) continue
        try {
          parsed.push((typeof raw === 'string' ? JSON.parse(raw) : raw) as StoredSubscription)
        } catch {
          // Skip corrupted JSON record so other subscribers continue cleanly
        }
      }
      return parsed
    }

    return Array.from(memoryStore.values())
  }

  /**
   * Updates notification preferences and timezone for an endpoint.
   */
  async updatePrefs(
    endpoint: string,
    prefs: Partial<NotificationPrefs>,
    tz?: string
  ): Promise<boolean> {
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
   * Records a successfully dispatched notification date in a single atomic KV operation.
   */
  async recordSent(
    endpoint: string,
    type: 'daily' | 'monday_insights' | 'chapter_ending',
    dateStr: string
  ): Promise<void> {
    const key = endpointToKey(endpoint)
    const field =
      type === 'daily'
        ? 'dailyReminder'
        : type === 'monday_insights'
          ? 'mondayInsights'
          : 'chapterEnding'
    const nowMs = Date.now()
    const cfg = getKvConfig()

    if (cfg) {
      await kvPipeline(cfg.kvUrl, cfg.kvToken, [
        ['EVAL', RECORD_SENT_LUA, 1, key, field, dateStr, String(nowMs)],
      ])
      return
    }

    const existing = memoryStore.get(key)
    if (!existing) return
    const lastSent = { ...(existing.lastSent || {}) }
    lastSent[field] = dateStr
    memoryStore.set(key, {
      ...existing,
      lastSent,
      updatedAt: nowMs,
    })
  }

  /**
   * Clears all test subscriptions (only active in explicit test memory mode).
   */
  async clearAll(): Promise<void> {
    memoryStore.clear()
  }

  async clear(): Promise<void> {
    await this.clearAll()
  }
}

export const subscriptionStore = new SubscriptionStore()
