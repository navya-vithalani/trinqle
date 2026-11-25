/**
 * VAPID (RFC 8292) and Web Push (RFC 8291) helper for Trinqle.
 * Pure TypeScript implementation using Node's standard crypto module.
 * Zero external dependencies; zero emojis.
 */

import crypto from 'crypto'
import type { PushSubscriptionData, GenericNotificationPayload } from './types'

export interface VapidKeys {
  publicKey: string // Base64URL-encoded uncompressed P-256 public key (65 bytes)
  privateKey: string // Base64URL-encoded P-256 private key (32 bytes)
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function bufferToBase64Url(buffer: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function uint8ArrayToUrlBase64(buffer: Buffer | Uint8Array): string {
  return bufferToBase64Url(buffer)
}

export function generateVapidAuthHeader(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
  expirationSeconds = 12 * 3600
): string {
  const token = createVapidToken(audience, subject, privateKey, expirationSeconds)
  return `vapid t=${token}, k=${publicKey}`
}

export function encryptPushPayload(
  payloadText: string,
  keys: { p256dh: string; auth: string }
): Buffer {
  const { body } = encryptWebPushPayload({ endpoint: '', keys }, payloadText)
  return body
}

export function base64UrlToBuffer(base64Url: string): Buffer {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64')
}

/**
 * Generates a standard RFC 8292 compliant VAPID P-256 keypair.
 */
export function generateVapidKeys(): VapidKeys {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()

  const publicKey = bufferToBase64Url(ecdh.getPublicKey())
  const privateKey = bufferToBase64Url(ecdh.getPrivateKey())

  return { publicKey, privateKey }
}

/**
 * Creates an RFC 8292 VAPID JWT token signed with ECDSA P-256 (ES256).
 */
export function createVapidToken(
  audience: string,
  subject: string,
  privateKeyBase64Url: string,
  expirationSeconds = 12 * 3600 // 12 hours
): string {
  const header = {
    typ: 'JWT',
    alg: 'ES256',
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    aud: audience,
    exp: now + expirationSeconds,
    sub: subject,
  }

  const headerB64 = bufferToBase64Url(Buffer.from(JSON.stringify(header)))
  const payloadB64 = bufferToBase64Url(Buffer.from(JSON.stringify(payload)))
  const unsignedToken = `${headerB64}.${payloadB64}`

  // Derive public coordinates x & y from raw 32-byte private key via ECDH
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.setPrivateKey(base64UrlToBuffer(privateKeyBase64Url))
  const pubKey = ecdh.getPublicKey() // 65 bytes: 0x04 || X (32) || Y (32)
  const pubX = bufferToBase64Url(pubKey.subarray(1, 33))
  const pubY = bufferToBase64Url(pubKey.subarray(33, 65))

  const keyObject = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: privateKeyBase64Url,
      x: pubX,
      y: pubY,
    },
    format: 'jwk',
  })

  const sign = crypto.createSign('SHA256')
  sign.update(unsignedToken)
  sign.end()

  // IEEE P1363 format provides the exact 64-byte raw (r, s) signature required by ES256
  const rawSignature = sign.sign({
    key: keyObject,
    dsaEncoding: 'ieee-p1363',
  })
  const signatureB64 = bufferToBase64Url(rawSignature)

  return `${unsignedToken}.${signatureB64}`
}

/**
 * Encrypts a payload for Web Push (RFC 8291 aes128gcm).
 */
export function encryptWebPushPayload(
  subscription: PushSubscriptionData,
  payloadText: string
): { body: Buffer; headers: Record<string, string> } {
  const userPublicKey = base64UrlToBuffer(subscription.keys.p256dh)
  const userAuth = base64UrlToBuffer(subscription.keys.auth)

  // Local sender ephemeral ECDH keypair
  const localECDH = crypto.createECDH('prime256v1')
  localECDH.generateKeys()
  const localPublicKey = localECDH.getPublicKey() // 65 bytes uncompressed

  // Compute shared ECDH secret
  const sharedSecret = localECDH.computeSecret(userPublicKey)

  // 16 bytes random salt
  const salt = crypto.randomBytes(16)

  // PRK derivation via HKDF (RFC 8291 section 3.2)
  // IKM = sharedSecret, salt = userAuth, info = "WebPush: info\0" || userPublicKey || localPublicKey
  const authInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    userPublicKey,
    localPublicKey,
  ])

  const prk = crypto.hkdfSync('sha256', sharedSecret, userAuth, authInfo, 32)

  // CEK and Nonce derivation from PRK using salt
  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'utf8')
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'utf8')

  const cek = crypto.hkdfSync('sha256', Buffer.from(prk), salt, cekInfo, 16)
  const nonce = crypto.hkdfSync('sha256', Buffer.from(prk), salt, nonceInfo, 12)

  // Plaintext padding: record size = 4096, add delimiter 0x02 (last record)
  const payloadBuf = Buffer.from(payloadText, 'utf8')
  const paddedPayload = Buffer.concat([payloadBuf, Buffer.from([0x02])])

  const cipher = crypto.createCipheriv('aes-128-gcm', Buffer.from(cek), Buffer.from(nonce))
  const ciphertext = cipher.update(paddedPayload)
  const finalCipher = cipher.final()
  const tag = cipher.getAuthTag() // 16 bytes

  // Header format (RFC 8291 section 2):
  // salt (16 bytes) || rs (4 bytes = 4096) || idlen (1 byte = 65) || keyid (65 bytes = localPublicKey)
  const rsBuf = Buffer.alloc(4)
  rsBuf.writeUInt32BE(4096, 0)
  const idLenBuf = Buffer.from([localPublicKey.length])

  const body = Buffer.concat([
    salt,
    rsBuf,
    idLenBuf,
    localPublicKey,
    ciphertext,
    finalCipher,
    tag,
  ])

  return {
    body,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
  }
}

/**
 * Sends a generic Web Push notification to a browser push service endpoint.
 */
export async function sendWebPushNotification(
  subscription: PushSubscriptionData,
  payload: GenericNotificationPayload,
  vapidKeys: VapidKeys,
  vapidSubject = 'mailto:hello@trinqle.app'
): Promise<{ status: number; success: boolean; error?: string }> {
  const url = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`

  const vapidToken = createVapidToken(audience, vapidSubject, vapidKeys.privateKey)
  const payloadJson = JSON.stringify(payload)
  const { body, headers } = encryptWebPushPayload(subscription, payloadJson)

  const requestHeaders: Record<string, string> = {
    ...headers,
    Authorization: `vapid t=${vapidToken}, k=${vapidKeys.publicKey}`,
  }

  try {
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: new Uint8Array(body),
    })

    if (res.status === 201 || res.status === 200 || res.status === 204) {
      return { status: res.status, success: true }
    } else {
      const text = await res.text().catch(() => '')
      return { status: res.status, success: false, error: text || `HTTP ${res.status}` }
    }
  } catch (err: unknown) {
    return {
      status: 500,
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}
