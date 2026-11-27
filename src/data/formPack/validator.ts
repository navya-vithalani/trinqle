import type { FormPack, PartKind, PartLevel, SectionScope } from '../types'
import { LIMITS } from '../../core/limits'

const VALID_PART_KINDS: PartKind[] = ['yesno', 'scale', 'number', 'text', 'timerange', 'library']
const VALID_PART_LEVELS: PartLevel[] = ['core', 'extra']
const VALID_SECTION_SCOPES: SectionScope[] = ['daily', 'weekly', 'chapterEnd']

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateFormPack(data: unknown): ValidationResult {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Form pack must be an object'] }
  }

  const pack = data as Partial<FormPack>

  if (pack.formatVersion !== 1) {
    errors.push(`Unsupported or missing formatVersion: expected 1, got ${pack.formatVersion}`)
  }

  if (pack.kind !== 'form-pack') {
    errors.push(`Invalid kind: expected 'form-pack', got '${pack.kind}'`)
  }

  if (!pack.name || typeof pack.name !== 'string') {
    errors.push('Form pack requires a non-empty name string')
  }

  // Libraries validation
  if (!Array.isArray(pack.libraries)) {
    errors.push('Form pack "libraries" must be an array')
  } else {
    pack.libraries.forEach((lib, idx) => {
      if (!lib.id || typeof lib.id !== 'string') {
        errors.push(`Library at index ${idx} is missing a valid 'id'`)
      }
      if (!lib.name || typeof lib.name !== 'string') {
        errors.push(`Library at index ${idx} is missing a valid 'name'`)
      } else if (lib.name.length > LIMITS.LIBRARY_NAME) {
        errors.push(`Library '${lib.name.slice(0, 20)}...' exceeds ${LIMITS.LIBRARY_NAME} characters`)
      }
      if (!Array.isArray(lib.items)) {
        errors.push(`Library '${lib.name || idx}' items must be an array`)
      } else {
        lib.items.forEach((itName, itIdx) => {
          if (typeof itName !== 'string' || itName.length > LIMITS.LIBRARY_ITEM_NAME) {
            errors.push(`Library '${lib.name}' item at index ${itIdx} is invalid or exceeds ${LIMITS.LIBRARY_ITEM_NAME} characters`)
          }
        })
      }
    })
  }

  // Sections validation
  if (!Array.isArray(pack.sections)) {
    errors.push('Form pack "sections" must be an array')
  } else {
    pack.sections.forEach((sec, idx) => {
      if (!sec.id || typeof sec.id !== 'string') {
        errors.push(`Section at index ${idx} is missing a valid 'id'`)
      }
      if (!sec.name || typeof sec.name !== 'string') {
        errors.push(`Section at index ${idx} is missing a valid 'name'`)
      } else if (sec.name.length > LIMITS.SECTION_NAME) {
        errors.push(`Section '${sec.name.slice(0, 20)}...' exceeds ${LIMITS.SECTION_NAME} characters`)
      }
      if (sec.scope && !VALID_SECTION_SCOPES.includes(sec.scope)) {
        errors.push(`Section '${sec.name}' has invalid scope '${sec.scope}'`)
      }
    })
  }

  // Questions validation
  if (!Array.isArray(pack.questions)) {
    errors.push('Form pack "questions" must be an array')
  } else {
    pack.questions.forEach((q, idx) => {
      if (!q.id || typeof q.id !== 'string') {
        errors.push(`Question at index ${idx} is missing a valid 'id'`)
      }
      if (!q.label || typeof q.label !== 'string') {
        errors.push(`Question at index ${idx} is missing a valid 'label'`)
      } else if (q.label.length > LIMITS.QUESTION_LABEL) {
        errors.push(`Question '${q.label.slice(0, 20)}...' exceeds ${LIMITS.QUESTION_LABEL} characters`)
      }
      if (!Array.isArray(q.parts) || q.parts.length === 0) {
        errors.push(`Question '${q.label || idx}' must contain at least one part`)
      } else {
        q.parts.forEach((p, pIdx) => {
          if (!p.id || typeof p.id !== 'string') {
            errors.push(`Question '${q.label}' part at index ${pIdx} is missing 'id'`)
          }
          if (!p.label || typeof p.label !== 'string') {
            errors.push(`Question '${q.label}' part at index ${pIdx} is missing 'label'`)
          } else if (p.label.length > LIMITS.PART_LABEL) {
            errors.push(`Question '${q.label}' part '${p.label.slice(0, 20)}...' exceeds ${LIMITS.PART_LABEL} characters`)
          }
          if (!VALID_PART_KINDS.includes(p.kind)) {
            errors.push(`Question '${q.label}' part '${p.label}' has invalid kind '${p.kind}'`)
          }
          if (!VALID_PART_LEVELS.includes(p.level)) {
            errors.push(`Question '${q.label}' part '${p.label}' has invalid level '${p.level}'`)
          }
        })
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
