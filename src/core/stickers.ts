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

export function getStickerById(id: string, customStickers: StickerItem[] = []): StickerItem | undefined {
  return (
    BUILTIN_STICKERS.find((s) => s.id === id) ||
    customStickers.find((s) => s.id === id)
  )
}
