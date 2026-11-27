/**
 * Central character limits for all open text fields (S8).
 * Shared by UI inputs, repository writes, and form-pack / ZIP validators.
 */
export const LIMITS = {
  DAY_TITLE: 80,
  DAY_ONELINER: 5000,
  SHORT_TEXT: 500,
  LONG_TEXT: 5000,
  CHAPTER_NAME: 60,
  CHAPTER_SUMMARY: 5000,
  QUESTION_LABEL: 100,
  PART_LABEL: 60,
  SECTION_NAME: 60,
  LIBRARY_NAME: 60,
  LIBRARY_ITEM_NAME: 60,
  USER_NAME: 60,
  CUSTOM_PROMPT_LABEL: 100,
  UNIT_LABEL: 30,
  STICKER_NAME: 32,
} as const

export function clampText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return value.slice(0, maxLength)
}
