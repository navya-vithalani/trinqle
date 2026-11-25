import catSvg from './white-cat/character.svg'
import cookieSvg from './cookie-man/character.svg'
import spiderSvg from './spider/character.svg'
import dollSvg from './doll/character.svg'
import mouseSvg from './mouse/character.svg'
import unicornSvg from './unicorn/character.svg'
import unicornSideSvg from './unicorn/side.svg'
import rabbitSvg from './rabbit/character.svg'
import rabbitSideSvg from './rabbit/side.svg'

export interface CharacterItem {
  id: string
  name: string
  svg: string
  sideSvg?: string
  hasMultiView?: boolean
  description: string
  limbs?: number
  featuredMonth?: number // 1..12
  isCustom?: boolean
}

export const CHARACTERS: CharacterItem[] = [
  {
    id: 'white-cat',
    name: 'White fluffy cat',
    svg: catSvg,
    description: 'Soft white cat that stretches and watches',
    limbs: 2,
    featuredMonth: 2,
  },
  {
    id: 'cookie-man',
    name: 'Ginger cookie man',
    svg: cookieSvg,
    description: 'Sweet baked cookie man with stubby arms and legs',
    limbs: 4,
    featuredMonth: 12,
  },
  {
    id: 'spider',
    name: 'Jumpy spider',
    svg: spiderSvg,
    description: 'An eight-legged curious jumping spider that loves watching you write',
    limbs: 8,
    featuredMonth: 10,
  },
  {
    id: 'doll',
    name: 'Porcelain doll',
    svg: dollSvg,
    description: 'Victorian porcelain doll with delicate dress and articulated joints',
    limbs: 4,
    featuredMonth: 1,
  },
  {
    id: 'mouse',
    name: 'Tiny mouse',
    svg: mouseSvg,
    description: 'Chubby field mouse with large translucent ears and curious whiskers',
    limbs: 4,
    featuredMonth: 3,
  },
  {
    id: 'unicorn',
    name: 'Starlight unicorn',
    svg: unicornSvg,
    sideSvg: unicornSideSvg,
    hasMultiView: true,
    description: 'Celestial unicorn with glowing horn and multi-view galloping gait',
    limbs: 4,
    featuredMonth: 11,
  },
  {
    id: 'rabbit',
    name: 'Fluffy rabbit',
    svg: rabbitSvg,
    sideSvg: rabbitSideSvg,
    hasMultiView: true,
    description: 'Cream bunny with twitching ears, cottontail, and multi-view hopping arc',
    limbs: 4,
    featuredMonth: 4,
  },
]

const STORAGE_CHAR_KEY = 'trinqle_character_id'
const STORAGE_CUSTOM_CHARS_KEY = 'trinqle_custom_characters'

export function getCustomCharacters(): CharacterItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_CHARS_KEY)
    if (raw) {
      return JSON.parse(raw) as CharacterItem[]
    }
  } catch {
    // Ignore storage parse errors
  }
  return []
}

export function saveCustomCharacter(char: CharacterItem): void {
  try {
    const list = getCustomCharacters().filter((c) => c.id !== char.id)
    list.push({ ...char, isCustom: true })
    localStorage.setItem(STORAGE_CUSTOM_CHARS_KEY, JSON.stringify(list))
  } catch {
    // Ignore
  }
}

export function deleteCustomCharacter(charId: string): void {
  try {
    const list = getCustomCharacters().filter((c) => c.id !== charId)
    localStorage.setItem(STORAGE_CUSTOM_CHARS_KEY, JSON.stringify(list))
  } catch {
    // Ignore
  }
}

export function getAllCharacters(): CharacterItem[] {
  return [...CHARACTERS, ...getCustomCharacters()]
}

export function getCharacter(id = 'white-cat'): CharacterItem {
  const all = getAllCharacters()
  return all.find((c) => c.id === id) || CHARACTERS[0]
}

export function getCharacterOfTheMonth(): CharacterItem {
  const currentMonth = new Date().getMonth() + 1
  const match = CHARACTERS.find((c) => c.featuredMonth === currentMonth)
  return match || CHARACTERS[0]
}

export function loadCharacterPreference(): string {
  try {
    return localStorage.getItem(STORAGE_CHAR_KEY) || 'white-cat'
  } catch {
    return 'white-cat'
  }
}

export function saveCharacterPreference(id: string): void {
  try {
    localStorage.setItem(STORAGE_CHAR_KEY, id)
  } catch {
    // Ignore
  }
}
