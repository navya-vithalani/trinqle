import type { FormPack, PartKind, PartLevel, SectionScope } from '../types'

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
      }
      if (!Array.isArray(lib.items)) {
        errors.push(`Library '${lib.name || idx}' items must be an array`)
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
