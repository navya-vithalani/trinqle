import catSvg from './white-cat/character.svg'
import cookieSvg from './cookie-man/character.svg'
import spiderSvg from './spider/character.svg'

export interface CharacterItem {
  id: string
  name: string
  svg: string
  description: string
  limbs?: number
}

export const CHARACTERS: CharacterItem[] = [
  {
    id: 'white-cat',
    name: 'White fluffy cat',
    svg: catSvg,
    description: 'Soft white cat that stretches and watches',
    limbs: 2,
  },
  {
    id: 'cookie-man',
    name: 'Ginger cookie man',
    svg: cookieSvg,
    description: 'Sweet baked cookie man with stubby arms and legs',
    limbs: 4,
  },
  {
    id: 'spider',
    name: 'Jumpy spider',
    svg: spiderSvg,
    description: 'An eight-legged curious jumping spider that loves watching you write',
    limbs: 8,
  },
]

const STORAGE_CHAR_KEY = 'trinqle_character_id'

export function getCharacter(id = 'white-cat'): CharacterItem {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0]
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
