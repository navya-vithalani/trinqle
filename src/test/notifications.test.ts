import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'
import { EventEmitter } from 'events'
import {
  urlBase64ToUint8Array,
  uint8ArrayToUrlBase64,
  createVapidToken,
  encryptWebPushPayload,
} from '../core/notifications/vapid'
import { evaluateNotificationDue, getLocalDateTimeInZone } from '../core/notifications/scheduler'
import {
  sanitizeNotificationPrefs,
  validatePushEndpoint,
  validatePushKeys,
  validateTimeZone,
} from '../core/notifications/validation'
import { DEFAULT_NOTIFICATION_PREFS, type StoredSubscription } from '../core/notifications/types'
import { extractResponseError } from '../core/notifications/client'
import { subscriptionStore, getKvConfig } from '../../api/kv'
import subscribeHandler from '../../api/subscribe'
import prefsHandler from '../../api/prefs'
import unsubscribeHandler from '../../api/unsubscribe'
import sendHandler from '../../api/send'

function makeTestKeys() {
  const clientEcdh = crypto.createECDH('prime256v1')
  clientEcdh.generateKeys()
  return {
    p256dh: uint8ArrayToUrlBase64(clientEcdh.getPublicKey()),
    auth: uint8ArrayToUrlBase64(crypto.randomBytes(16)),
  }
}

function makeServerVapidKeys() {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  return {
    publicKey: ecdh.getPublicKey().toString('base64url'),
    privateKey: ecdh.getPrivateKey().toString('base64url'),
  }
}

async function invokeHandler(
  handler: (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => Promise<void>,
  options: { method?: string; body?: unknown; headers?: Record<string, string> }
): Promise<{ status: number; json: Record<string, unknown> }> {
  const req = new EventEmitter() as unknown as IncomingMessage & { body?: unknown }
  req.method = options.method || 'POST'
  req.headers = options.headers || {}
  req.body = options.body

  let rawBody = ''
  const headersMap: Record<string, string> = {}
  const res = {
    statusCode: 200,
    headers: headersMap,
    setHeader(name: string, val: string) {
      headersMap[name.toLowerCase()] = val
    },
    end(chunk?: string | Buffer) {
      if (chunk) rawBody += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    },
  } as unknown as ServerResponse

  await handler(req, res)
  return {
    status: res.statusCode,
    json: rawBody ? JSON.parse(rawBody) : {},
  }
}

describe('Notifications & Push API Hardening (S1-S5)', () => {
  const origEnv = { ...process.env }

  beforeEach(async () => {
    process.env = { ...origEnv, VITEST: 'true' }
    await subscriptionStore.clearAll()
  })

  afterEach(async () => {
    process.env = { ...origEnv }
    await subscriptionStore.clearAll()
  })

  it('generates valid ES256 VAPID JWT and aes128gcm encrypted payload', () => {
    const serverKeys = makeServerVapidKeys()
    const clientKeys = makeTestKeys()
    const token = createVapidToken('https://fcm.googleapis.com', 'mailto:test@example.com', serverKeys.privateKey)
    const [headerB64, payloadB64] = token.split('.')
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))

    expect(header.alg).toBe('ES256')
    expect(payload.aud).toBe('https://fcm.googleapis.com')
    expect(payload.sub).toBe('mailto:test@example.com')

    const encrypted = encryptWebPushPayload(
      { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: clientKeys },
      JSON.stringify({ title: 'Trinqle', body: 'Ready', url: '/', tag: 'daily' })
    )
    expect(encrypted.body.length).toBeGreaterThan(86)
    expect(urlBase64ToUint8Array(clientKeys.auth).length).toBe(16)
  })

  it('rejects SSRF / non-allowlisted endpoints, bad keys, invalid tz, and malformed prefs', () => {
    expect(validatePushEndpoint('http://127.0.0.1/hook').ok).toBe(false)
    expect(validatePushEndpoint('https://evil.example.com/push').ok).toBe(false)
    expect(validatePushEndpoint('https://fcm.googleapis.com/fcm/send/xyz').ok).toBe(true)
    expect(validatePushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/xyz').ok).toBe(true)
    expect(validatePushEndpoint('https://web.push.apple.com/Q/xyz').ok).toBe(true)
    expect(validatePushEndpoint('https://wns2-bl2p.notify.windows.com/?token=abc').ok).toBe(true)

    const validKeys = makeTestKeys()
    expect(validatePushKeys(validKeys).ok).toBe(true)
    expect(validatePushKeys({ p256dh: 'short', auth: validKeys.auth }).ok).toBe(false)

    expect(validateTimeZone('Asia/Kolkata').ok).toBe(true)
    expect(validateTimeZone('Mars/Olympus_Mons').ok).toBe(false)

    const clean = sanitizeNotificationPrefs({
      dailyReminder: true,
      dailyReminderTime: '21:30',
      chapterPlannedEndDate: '2026-12-20',
      injectedExtra: 'drop table',
    })
    expect(clean.ok).toBe(true)
    if (clean.ok) {
      expect((clean.value as Record<string, unknown>).injectedExtra).toBeUndefined()
      expect(clean.value.chapterPlannedEndDate).toBe('2026-12-20')
    }

    expect(sanitizeNotificationPrefs({ dailyReminderTime: '25:99' }, { partial: true }).ok).toBe(false)
  })

  it('requires manageToken on prefs, unsubscribe, and test send, and fails closed on CRON_SECRET', async () => {
    const keys = makeTestKeys()
    const endpoint = 'https://fcm.googleapis.com/fcm/send/device-test-1'

    const subRes = await invokeHandler(subscribeHandler, {
      body: {
        subscription: { endpoint, keys },
        tz: 'America/New_York',
        prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyReminderTime: '21:00' },
      },
    })
    expect(subRes.status).toBe(200)
    expect(typeof subRes.json.manageToken).toBe('string')
    const token = subRes.json.manageToken as string

    // Stored record should hold manageTokenHash, NOT plaintext token
    const stored = await subscriptionStore.get(endpoint)
    expect(stored?.manageTokenHash).toBeDefined()
    expect(stored?.manageTokenHash).not.toBe(token)

    // Missing or wrong manageToken -> 401
    expect((await invokeHandler(prefsHandler, { body: { endpoint, prefs: { dailyReminder: false } } })).status).toBe(401)
    expect(
      (
        await invokeHandler(prefsHandler, {
          headers: { authorization: 'Bearer wrong-token' },
          body: { endpoint, prefs: { dailyReminder: false } },
        })
      ).status
    ).toBe(401)

    // Valid manageToken -> 200
    const prefsOk = await invokeHandler(prefsHandler, {
      headers: { authorization: `Bearer ${token}` },
      body: { endpoint, tz: 'Europe/London', prefs: { dailyReminderTime: '22:00' } },
    })
    expect(prefsOk.status).toBe(200)

    // Direct test without token -> 401
    const unauthTest = await invokeHandler(sendHandler, {
      body: { test: true, endpoint },
    })
    expect(unauthTest.status).toBe(401)

    // Cron without CRON_SECRET env -> 500 fail closed
    delete process.env.CRON_SECRET
    const noSecretCron = await invokeHandler(sendHandler, { body: {} })
    expect(noSecretCron.status).toBe(500)

    // Cron with wrong secret -> 401
    process.env.CRON_SECRET = 'super-secret-cron-token'
    const badCron = await invokeHandler(sendHandler, {
      headers: { authorization: 'Bearer wrong-secret' },
      body: {},
    })
    expect(badCron.status).toBe(401)

    // Cron with right secret but missing VAPID keys -> 500 fail closed (no hardcoded fallback)
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_SUBJECT
    const noVapidCron = await invokeHandler(sendHandler, {
      headers: { authorization: 'Bearer super-secret-cron-token' },
      body: {},
    })
    expect(noVapidCron.status).toBe(500)

    // Unsubscribe requires valid manageToken
    expect((await invokeHandler(unsubscribeHandler, { body: { endpoint } })).status).toBe(401)
    const unsubOk = await invokeHandler(unsubscribeHandler, {
      headers: { authorization: `Bearer ${token}` },
      body: { endpoint },
    })
    expect(unsubOk.status).toBe(200)
    expect(await subscriptionStore.get(endpoint)).toBeNull()
  })

  it('throws 503 KvUnavailableError when KV env vars are missing and supports Upstash Marketplace env names', async () => {
    process.env.VITEST = ''
    process.env.TRINQLE_TEST_MEMORY_KV = '0'
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const res = await invokeHandler(sendHandler, {
      headers: { authorization: 'Bearer x' },
      body: { test: true, endpoint: 'https://fcm.googleapis.com/fcm/send/abc' },
    })
    expect(res.status).toBe(503)

    // Verify UPSTASH_REDIS_REST_* Marketplace env vars resolve cleanly
    process.env.UPSTASH_REDIS_REST_URL = 'https://example-upstash.upstash.io/'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token-123'
    expect(getKvConfig()).toEqual({
      kvUrl: 'https://example-upstash.upstash.io',
      kvToken: 'upstash-token-123',
    })

    // Verify custom Vercel Storage prefix (e.g. PUSH_KV_REST_API_*) resolves cleanly
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    process.env.PUSH_KV_REST_API_URL = 'https://push-kv.upstash.io/'
    process.env.PUSH_KV_REST_API_TOKEN = 'push-token-456'
    expect(getKvConfig()).toEqual({
      kvUrl: 'https://push-kv.upstash.io',
      kvToken: 'push-token-456',
    })
  })

  it('extractResponseError surfaces both JSON errors and non-JSON 500 server crash bodies', async () => {
    const jsonRes = new Response(JSON.stringify({ error: 'Subscription store is not configured' }), { status: 503 })
    expect(await extractResponseError(jsonRes)).toBe('HTTP 503: Subscription store is not configured')

    const htmlCrashRes = new Response('<html><body>FUNCTION_INVOCATION_FAILED: Cannot find module api/kv</body></html>', {
      status: 500,
    })
    const formatted = await extractResponseError(htmlCrashRes)
    expect(formatted).toContain('HTTP 500:')
    expect(formatted).toContain('FUNCTION_INVOCATION_FAILED')
  })

  it('evaluates daily, late cron runs (21:12 -> due once), monday insights, and chapterEndingSoon via plannedEndDate', () => {
    const keys = makeTestKeys()
    const sub: StoredSubscription = {
      id: 'sub_sched_1',
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/sched',
        keys,
      },
      tz: 'America/New_York',
      prefs: {
        dailyReminder: true,
        dailyReminderTime: '21:00',
        mondayInsights: true,
        mondayInsightsTime: '09:00',
        chapterEnding: true,
        chapterPlannedEndDate: '2026-06-17',
      },
      createdAt: 1000,
      updatedAt: 1000,
    }

    // 2026-06-15 21:12 in America/New_York (EDT = UTC-4 -> 2026-06-16T01:12:00Z)
    const lateCronUtc = new Date('2026-06-16T01:12:00.000Z')
    const localInfo = getLocalDateTimeInZone(lateCronUtc, 'America/New_York')
    expect(localInfo.dateStr).toBe('2026-06-15')
    expect(localInfo.hour).toBe(21)
    expect(localInfo.minute).toBe(12)

    const dueLate = evaluateNotificationDue(sub, lateCronUtc)
    expect(dueLate.due).toBe(true)
    expect(dueLate.type).toBe('daily')

    // Once recorded for that date, another run in the same window must NOT send twice
    const afterSent: StoredSubscription = {
      ...sub,
      lastSent: { dailyReminder: '2026-06-15' },
    }
    expect(evaluateNotificationDue(afterSent, lateCronUtc).due).toBe(false)

    // Chapter ending reminder at 18:05 local time when chapterPlannedEndDate is T-2 (2026-06-17 vs 2026-06-15)
    const chapterEndUtc = new Date('2026-06-15T22:05:00.000Z') // 18:05 EDT on 2026-06-15
    const dueChapter = evaluateNotificationDue(sub, chapterEndUtc)
    expect(dueChapter.due).toBe(true)
    expect(dueChapter.type).toBe('chapter_ending')

    // Far future chapterPlannedEndDate -> no chapter_ending notification
    const farSub: StoredSubscription = {
      ...sub,
      prefs: { ...sub.prefs, chapterPlannedEndDate: '2026-07-05' },
    }
    expect(evaluateNotificationDue(farSub, chapterEndUtc).due).toBe(false)
  })
})
