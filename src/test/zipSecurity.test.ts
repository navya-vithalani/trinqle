// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import zlib from 'zlib'
import { createZipArchive, readZipArchiveAsync } from '../core/zip'
import { importChapterZip, inspectChapterZip } from '../core/export'
import { TrinqleDB } from '../data/db'

function buildMinimalValidArchiveFiles(overrides: Record<string, string | Uint8Array> = {}) {
  const manifest = JSON.stringify({
    formatVersion: 1,
    kind: 'chapter',
    chapterId: 'ch_sec_1',
    exportedAt: 1000,
    filesCount: 4,
  })
  const chapter = JSON.stringify({
    id: 'ch_sec_1',
    title: 'Security Chapter',
    startDate: '2026-11-01',
    plannedEndDate: '2026-11-25',
    closed: true,
    endDate: '2026-11-25',
    photos: [],
    createdAt: 1000,
    updatedAt: 1000,
  })

  const entries: Array<{ name: string; content: string | Uint8Array }> = [
    { name: 'manifest.json', content: overrides['manifest.json'] ?? manifest },
    { name: 'chapter.json', content: overrides['chapter.json'] ?? chapter },
    { name: 'days.json', content: overrides['days.json'] ?? '[]' },
    { name: 'answers.json', content: overrides['answers.json'] ?? '[]' },
  ]

  for (const [k, v] of Object.entries(overrides)) {
    if (!['manifest.json', 'chapter.json', 'days.json', 'answers.json'].includes(k)) {
      entries.push({ name: k, content: v })
    }
  }

  return createZipArchive(entries)
}

function buildDeflatedZip(filename: string, rawBytes: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(filename)
  const compressed = new Uint8Array(zlib.deflateRawSync(rawBytes))

  // Local file header (30 + nameLen)
  const localHeader = new Uint8Array(30 + nameBytes.length)
  const lv = new DataView(localHeader.buffer)
  lv.setUint32(0, 0x04034b50, true)
  lv.setUint16(4, 20, true)
  lv.setUint16(8, 8, true) // Deflate
  lv.setUint32(18, compressed.length, true)
  lv.setUint32(22, rawBytes.length, true)
  lv.setUint16(26, nameBytes.length, true)
  localHeader.set(nameBytes, 30)

  // Central directory header (46 + nameLen)
  const cdHeader = new Uint8Array(46 + nameBytes.length)
  const cv = new DataView(cdHeader.buffer)
  cv.setUint32(0, 0x02014b50, true)
  cv.setUint16(10, 8, true)
  cv.setUint32(20, compressed.length, true)
  cv.setUint32(24, rawBytes.length, true)
  cv.setUint16(28, nameBytes.length, true)
  cv.setUint32(42, 0, true)
  cdHeader.set(nameBytes, 46)

  const cdOffset = localHeader.length + compressed.length
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, 1, true)
  ev.setUint16(10, 1, true)
  ev.setUint32(12, cdHeader.length, true)
  ev.setUint32(16, cdOffset, true)

  const out = new Uint8Array(cdOffset + cdHeader.length + eocd.length)
  out.set(localHeader, 0)
  out.set(compressed, localHeader.length)
  out.set(cdHeader, cdOffset)
  out.set(eocd, cdOffset + cdHeader.length)
  return out
}

describe('ZIP & Import Security Boundaries (S6 & S7)', () => {
  let testDb: TrinqleDB

  beforeEach(async () => {
    testDb = new TrinqleDB()
    await testDb.delete()
    await testDb.open()
  })

  it('rejects zip bomb compression ratios', async () => {
    // 5 MB of zeros compresses to ~5 KB (~1000x ratio, far above 50x guard)
    const fiveMbZeros = new Uint8Array(5 * 1024 * 1024)
    const bombZip = buildDeflatedZip('bomb.json', fiveMbZeros)
    await expect(readZipArchiveAsync(bombZip)).rejects.toThrow(/zip bomb/i)
  })

  it('rejects forged photo magic bytes on archive import', async () => {
    const fakeImageZip = buildMinimalValidArchiveFiles({
      'manifest.json': JSON.stringify({
        formatVersion: 1,
        kind: 'chapter',
        chapterId: 'ch_sec_1',
        exportedAt: 1000,
        filesCount: 5,
        photoMeta: [{ name: 'images/photo_0.jpg', mime: 'image/jpeg' }],
      }),
      'images/photo_0.jpg': new TextEncoder().encode('<svg onload=alert(1)>'),
    })

    await expect(importChapterZip(fakeImageZip, testDb)).rejects.toThrow(/signature/i)
  })

  it('re-sanitizes custom SVG stickers during ZIP import and rejects malformed ones', async () => {
    const withScriptSticker = buildMinimalValidArchiveFiles({
      'stickers.json': JSON.stringify([
        {
          id: 'st_hostile',
          name: 'Evil',
          mime: 'image/svg+xml',
          blob: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/><script>alert(1)</script></svg>',
          builtin: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]),
    })

    await expect(inspectChapterZip(withScriptSticker)).resolves.toBeDefined()
    await importChapterZip(withScriptSticker, testDb)
    const saved = await testDb.stickers.get('st_hostile')
    expect(typeof saved?.blob).toBe('string')
    expect(saved?.blob as string).not.toContain('<script')

    const withMalformedSticker = buildMinimalValidArchiveFiles({
      'stickers.json': JSON.stringify([
        {
          id: 'st_broken',
          name: 'Broken',
          mime: 'image/svg+xml',
          blob: '<!DOCTYPE x><svg><circle</svg>',
          builtin: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]),
    })
    await expect(importChapterZip(withMalformedSticker, testDb)).rejects.toThrow(/SVG sticker/i)
  })
})
