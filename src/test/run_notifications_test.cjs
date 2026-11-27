const jiti = require('jiti')(__filename)

async function run() {
  console.log('Running Phase 8 Notifications Tests...')

  const {
    urlBase64ToUint8Array,
    uint8ArrayToUrlBase64,
    generateVapidAuthHeader,
    encryptPushPayload,
  } = jiti('../core/notifications/vapid.ts')

  const {
    getLocalDateTimeInZone,
    evaluateNotificationDue,
  } = jiti('../core/notifications/scheduler.ts')

  const {
    DEFAULT_NOTIFICATION_PREFS,
  } = jiti('../core/notifications/types.ts')

  const { subscriptionStore } = jiti('../../api/kv.ts')

  // --- Test 1: VAPID Helpers & Token Generation (RFC 8292) ---
  console.log('\n--- Test 1: VAPID Helpers & Token Generation ---')
  const testStr = 'Hello Trinqle VAPID'
  const encoded = uint8ArrayToUrlBase64(Buffer.from(testStr, 'utf-8'))
  const decoded = Buffer.from(urlBase64ToUint8Array(encoded)).toString('utf-8')
  if (decoded !== testStr) {
    throw new Error(`Base64URL roundtrip mismatch: expected "${testStr}", got "${decoded}"`)
  }

  const crypto = require('crypto')
  const serverEcdh = crypto.createECDH('prime256v1')
  serverEcdh.generateKeys()
  const mockPublic = serverEcdh.getPublicKey().toString('base64url')
  const mockPrivate = serverEcdh.getPrivateKey().toString('base64url')
  const audience = 'https://fcm.googleapis.com'
  const subject = 'mailto:test@example.com'

  const authHeader = generateVapidAuthHeader(audience, subject, mockPublic, mockPrivate)
  if (!authHeader.startsWith('vapid t=') || !authHeader.includes(', k=')) {
    throw new Error(`Malformed VAPID Authorization header: ${authHeader}`)
  }

  // Parse JWT parts
  const tokenMatch = authHeader.match(/vapid t=([^,]+)/)
  if (!tokenMatch) throw new Error('Missing token in auth header')
  const token = tokenMatch[1]
  const [jwtHeaderB64, jwtPayloadB64] = token.split('.')
  const jwtHeader = JSON.parse(Buffer.from(jwtHeaderB64, 'base64url').toString('utf8'))
  const jwtPayload = JSON.parse(Buffer.from(jwtPayloadB64, 'base64url').toString('utf8'))

  if (jwtHeader.alg !== 'ES256' || jwtHeader.typ !== 'JWT') {
    throw new Error(`Unexpected JWT header: ${JSON.stringify(jwtHeader)}`)
  }
  if (jwtPayload.aud !== audience || jwtPayload.sub !== subject) {
    throw new Error(`Unexpected JWT payload: ${JSON.stringify(jwtPayload)}`)
  }
  console.log('Pass: RFC 8292 ES256 VAPID Authorization header generated cleanly')

  // --- Test 2: RFC 8291 aes128gcm Payload Encryption ---
  console.log('\n--- Test 2: RFC 8291 Payload Encryption ---')
  const clientEcdh = crypto.createECDH('prime256v1')
  clientEcdh.generateKeys()
  const mockClientKey = uint8ArrayToUrlBase64(clientEcdh.getPublicKey())
  const mockClientAuth = uint8ArrayToUrlBase64(crypto.randomBytes(16))

  const payloadJson = JSON.stringify({
    title: 'Trinqle',
    body: "Tonight's journal is ready.",
    url: '/',
    tag: 'daily-reminder',
  })

  const encrypted = encryptPushPayload(payloadJson, {
    p256dh: mockClientKey,
    auth: mockClientAuth,
  })

  // RFC 8291: Salt (16 bytes) + record size (4 bytes) + key length (1 byte) + server public key (65 bytes) = 86 bytes header
  if (encrypted.length <= 86) {
    throw new Error(`Encrypted payload too short: length=${encrypted.length}`)
  }
  console.log(`Pass: RFC 8291 aes128gcm payload encrypted cleanly (${encrypted.length} bytes)`)

  // --- Test 3: KV Subscription Store Operations ---
  console.log('\n--- Test 3: KV Subscription Store Operations ---')
  await subscriptionStore.clearAll()

  const sub1 = {
    id: 'sub_test_1',
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-abc-123',
      keys: {
        p256dh: mockClientKey,
        auth: mockClientAuth,
      },
    },
    tz: 'America/New_York',
    prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyReminderTime: '21:00' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  await subscriptionStore.save(sub1)
  let allSubs = await subscriptionStore.getAll()
  if (allSubs.length !== 1 || allSubs[0].subscription.endpoint !== sub1.subscription.endpoint) {
    throw new Error(`Expected 1 subscription, got ${allSubs.length}`)
  }

  // Update prefs
  await subscriptionStore.updatePrefs(sub1.subscription.endpoint, { dailyReminderTime: '22:00' }, 'Europe/Paris')
  allSubs = await subscriptionStore.getAll()
  if (allSubs[0].prefs.dailyReminderTime !== '22:00' || allSubs[0].tz !== 'Europe/Paris') {
    throw new Error('Subscription prefs / timezone update failed')
  }

  // Remove subscription
  await subscriptionStore.remove(sub1.subscription.endpoint)
  allSubs = await subscriptionStore.getAll()
  if (allSubs.length !== 0) {
    throw new Error('Subscription removal failed')
  }
  console.log('Pass: Subscription store handles save, update, and remove')

  // --- Test 4: Scheduler Logic Across Timezones ---
  console.log('\n--- Test 4: Scheduler Logic Across Timezones ---')
  // Fix time: 2026-06-15T21:05:00 in America/New_York (UTC-4 in summer => 2026-06-16T01:05:00Z)
  const utcDate = new Date('2026-06-16T01:05:00.000Z')
  const localNY = getLocalDateTimeInZone(utcDate, 'America/New_York')
  if (localNY.hour !== 21 || localNY.minute !== 5 || localNY.dateStr !== '2026-06-15') {
    throw new Error(`Timezone conversion failed for NY: got ${JSON.stringify(localNY)}`)
  }

  const testSubNY = {
    id: 'sub_ny',
    subscription: {
      endpoint: 'https://push.example.com/sub-ny',
      keys: { p256dh: mockClientKey, auth: mockClientAuth },
    },
    tz: 'America/New_York',
    prefs: {
      dailyReminder: true,
      dailyReminderTime: '21:00',
      mondayInsights: true,
      mondayInsightsTime: '09:00',
      chapterEnding: true,
    },
    createdAt: 1000,
    updatedAt: 1000,
  }

  // Inside 20-minute window for 21:00 (21:05 is between 21:00 and 21:20)
  const dueDaily = evaluateNotificationDue(testSubNY, utcDate)
  if (!dueDaily.due || dueDaily.type !== 'daily') {
    throw new Error(`Expected daily reminder, got ${JSON.stringify(dueDaily)}`)
  }

  // Deduplication test: if already sent on this local date, should return due: false
  const subAlreadySent = {
    ...testSubNY,
    lastSent: { dailyReminder: '2026-06-15' },
  }
  const dueDeduplicated = evaluateNotificationDue(subAlreadySent, utcDate)
  if (dueDeduplicated.due) {
    throw new Error(`Expected deduplication to return due: false, got ${JSON.stringify(dueDeduplicated)}`)
  }

  // Outside cron window test (e.g. 21:30 NY time => 2026-06-16T01:30:00Z)
  const utcLate = new Date('2026-06-16T01:30:00.000Z')
  const dueLate = evaluateNotificationDue(testSubNY, utcLate)
  if (dueLate.due) {
    throw new Error(`Expected due: false outside window, got ${JSON.stringify(dueLate)}`)
  }

  // Monday morning insights test: 2026-06-15 09:05:00 NY time (Monday) => 2026-06-15T13:05:00Z
  const utcMondayMorning = new Date('2026-06-15T13:05:00.000Z')
  const dueMonday = evaluateNotificationDue(testSubNY, utcMondayMorning)
  if (!dueMonday.due || dueMonday.type !== 'monday_insights') {
    throw new Error(`Expected monday_insights, got ${JSON.stringify(dueMonday)}`)
  }

  // Monday insights disabled test
  const subMondayOff = {
    ...testSubNY,
    prefs: { ...testSubNY.prefs, mondayInsights: false },
  }
  const dueMondayOff = evaluateNotificationDue(subMondayOff, utcMondayMorning)
  if (dueMondayOff.due && dueMondayOff.type === 'monday_insights') {
    throw new Error(`Expected not due when mondayInsights is false, got ${JSON.stringify(dueMondayOff)}`)
  }

  // Chapter ending alert test (simulating chapterEndingSoon = true at 18:05 NY time => 22:05:00Z)
  const utcEvening6PM = new Date('2026-06-15T22:05:00.000Z')
  const dueChapter = evaluateNotificationDue(testSubNY, utcEvening6PM, true)
  if (!dueChapter.due || dueChapter.type !== 'chapter_ending') {
    throw new Error(`Expected chapter_ending alert, got ${JSON.stringify(dueChapter)}`)
  }
  console.log('Pass: Scheduler correctly evaluates daily reminders, Monday insights, chapter endings, and deduplication')

  // --- Test 5: Zero Journal Content Privacy Guarantee ---
  console.log('\n--- Test 5: Zero Journal Content Privacy Guarantee ---')
  const payloads = [
    dueDaily?.payload,
    dueMonday?.payload,
    dueChapter?.payload,
  ].filter(Boolean)

  for (const p of payloads) {
    if (!p) continue
    if (!p.title || !p.body || !p.url || !p.tag) {
      throw new Error(`Incomplete notification payload: ${JSON.stringify(p)}`)
    }
    const allowedBodies = [
      "Tonight's journal is ready.",
      'Your weekly insights are ready to view.',
      'Your chapter wraps up soon. Remember to review your reflections.',
      'This is a test notification from Trinqle.',
    ]
    if (!allowedBodies.includes(p.body)) {
      throw new Error(`Payload body violates zero-journal-leak rule: "${p.body}"`)
    }
  }
  console.log('Pass: All notification payloads strictly verified to contain zero user journal data')

  console.log('\n========================================')
  console.log('   ALL PHASE 8 NOTIFICATION TESTS PASSED!')
  console.log('========================================')
}

run().catch((err) => {
  console.error('\nPhase 8 Notifications Test Failed:', err)
  process.exit(1)
})
