import catFace from '../assets/stickers/cat-face.svg'
import cloud from '../assets/stickers/cloud.svg'
import droplet from '../assets/stickers/droplet.svg'
import flower from '../assets/stickers/flower.svg'
import heart from '../assets/stickers/heart.svg'
import leaf from '../assets/stickers/leaf.svg'
import moon from '../assets/stickers/moon.svg'
import mushroom from '../assets/stickers/mushroom.svg'
import rainbow from '../assets/stickers/rainbow.svg'
import sparkle from '../assets/stickers/sparkle.svg'
import star from '../assets/stickers/star.svg'
import sun from '../assets/stickers/sun.svg'

import { db as defaultDb, type TrinqleDB } from '../data/db'
import type { Sticker } from '../data/types'
import { sanitizeSvg } from '../characters/sanitizer'
import { compressPhoto } from './photoCompression'
import { generateUUIDv7 } from './ids'

export interface StickerItem {
  id: string
  name: string
  url: string
  builtin: boolean
}

export const BUILTIN_STICKERS: StickerItem[] = [
  { id: 'cat-face', name: 'Cat face', url: catFace, builtin: true },
  { id: 'cloud', name: 'Cloud', url: cloud, builtin: true },
  { id: 'droplet', name: 'Droplet', url: droplet, builtin: true },
  { id: 'flower', name: 'Flower', url: flower, builtin: true },
  { id: 'heart', name: 'Heart', url: heart, builtin: true },
  { id: 'leaf', name: 'Leaf', url: leaf, builtin: true },
  { id: 'moon', name: 'Moon', url: moon, builtin: true },
  { id: 'mushroom', name: 'Mushroom', url: mushroom, builtin: true },
  { id: 'rainbow', name: 'Rainbow', url: rainbow, builtin: true },
  { id: 'sparkle', name: 'Sparkle', url: sparkle, builtin: true },
  { id: 'star', name: 'Star', url: star, builtin: true },
  { id: 'sun', name: 'Sun', url: sun, builtin: true },
]

export function stickerRecordToItem(record: Sticker): StickerItem | null {
  let url = ''
  if (typeof record.blob === 'string') {
    if (record.blob.startsWith('data:')) {
      url = record.blob
    } else if (record.mime.includes('svg') || record.blob.trim().startsWith('<svg')) {
      url = `data:image/svg+xml;utf8,${encodeURIComponent(record.blob)}`
    }
  } else if (record.blob instanceof Blob && typeof URL !== 'undefined') {
    url = URL.createObjectURL(record.blob)
  }
  if (!url) return null
  return {
    id: record.id,
    name: record.name,
    url,
    builtin: Boolean(record.builtin),
  }
}

export async function loadCustomStickerItems(
  db: TrinqleDB = defaultDb
): Promise<StickerItem[]> {
  const rows = await db.stickers
    .filter((s) => !s.deletedAt && !s.builtin)
    .toArray()
  return rows
    .map(stickerRecordToItem)
    .filter((item): item is StickerItem => item !== null)
}

export async function saveCustomStickerFromFile(
  file: File,
  customName?: string,
  db: TrinqleDB = defaultDb
): Promise<StickerItem> {
  const now = Date.now()
  const baseName = (customName || file.name.replace(/\.[^.]+$/, '') || 'Custom Sticker').trim()
  const isSvg =
    file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg')

  let mime = 'image/svg+xml'
  let payload: string

  if (isSvg) {
    const rawSvg = await file.text()
    const sanitized = sanitizeSvg(rawSvg)
    if (!sanitized.valid || !sanitized.cleanSvg.includes('<svg')) {
      throw new Error(sanitized.error || 'Invalid or empty SVG file')
    }
    payload = sanitized.cleanSvg
  } else {
    // Raster sticker downscaled to 256px max dimension
    const compressed = await compressPhoto(file, 256, 0.85)
    mime = 'image/jpeg'
    payload = compressed.dataUrl
  }

  const record: Sticker = {
    id: `custom_${generateUUIDv7(now)}`,
    name: baseName.slice(0, 32),
    mime,
    blob: payload,
    builtin: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.stickers.put(record)
  const item = stickerRecordToItem(record)
  if (!item) throw new Error('Failed to build sticker preview')
  return item
}

export async function deleteCustomSticker(
  id: string,
  db: TrinqleDB = defaultDb
): Promise<void> {
  const existing = await db.stickers.get(id)
  if (existing && !existing.builtin) {
    await db.stickers.put({ ...existing, deletedAt: Date.now(), updatedAt: Date.now() })
  }
}

export function getStickerById(id: string, customStickers: StickerItem[] = []): StickerItem | undefined {
  return (
    BUILTIN_STICKERS.find((s) => s.id === id) ||
    customStickers.find((s) => s.id === id)
  )
}
