/**
 * Pure TypeScript UUIDv7 generator.
 * Format: 8-4-4-4-12 hex characters according to RFC 9562.
 * Combines 48-bit UNIX millisecond timestamp with random bits.
 * Monotonically sortable by creation time.
 */
export function generateUUIDv7(timestampMs?: number): string {
  const time = timestampMs ?? Date.now()

  // 48-bit timestamp
  const timeHex = time.toString(16).padStart(12, '0')

  // Generate 10 random bytes (80 random bits)
  const randomBytes = new Uint8Array(10)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes)
  } else {
    for (let i = 0; i < 10; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256)
    }
  }

  // Version 7: set bits 48..51 to 0111 (0x7)
  const ver = 0x70 | (randomBytes[0] & 0x0f)

  // Variant 2 (RFC 4122 / 9562): set bits 64..65 to 10
  const varByte = 0x80 | (randomBytes[2] & 0x3f)

  const b = (idx: number) => randomBytes[idx].toString(16).padStart(2, '0')

  // Hex representation:
  // timeHex[0..7] - timeHex[8..11] - 7xxx - yxxx - xxxxxxxxxxxx
  const p1 = timeHex.slice(0, 8)
  const p2 = timeHex.slice(8, 12)
  const p3 = ver.toString(16).padStart(2, '0') + b(1)
  const p4 = varByte.toString(16).padStart(2, '0') + b(3)
  const p5 = b(4) + b(5) + b(6) + b(7) + b(8) + b(9)

  return `${p1}-${p2}-${p3}-${p4}-${p5}`
}
