import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import fs from 'fs'
import path from 'path'
import { TrinqleDB } from '../data/db'
import { validateFormPack } from '../data/formPack/validator'
import { importFormPack } from '../data/formPack/importer'
import { exportFormPack } from '../data/formPack/exporter'
import type { FormPack } from '../data/types'

describe('Form Pack Import & Export', () => {
  let testDb: TrinqleDB

  beforeEach(async () => {
    testDb = new TrinqleDB(`test_formpack_${Date.now()}_${Math.random()}`)
  })

  it('validates bundled starter-form-pack.json successfully', () => {
    const filePath = path.resolve(__dirname, '../content/starter-form-pack.json')
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const result = validateFormPack(content)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects invalid form packs with readable error messages', () => {
    const invalidPack = {
      formatVersion: 2, // invalid
      kind: 'wrong-kind',
      name: '',
      sections: 'not-an-array',
      questions: [],
    }

    const result = validateFormPack(invalidPack)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some((e) => e.includes('formatVersion'))).toBe(true)
    expect(result.errors.some((e) => e.includes('kind'))).toBe(true)
  })

  it('imports starter-form-pack.json and exports it with logical round-trip equality', async () => {
    const filePath = path.resolve(__dirname, '../content/starter-form-pack.json')
    const originalPack: FormPack = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    // 1. Import pack into fresh database
    const summary = await importFormPack(originalPack, 'replace', testDb)
    expect(summary.sectionsAdded).toBe(originalPack.sections.length)
    expect(summary.questionsAdded).toBe(originalPack.questions.length)

    // 2. Export pack back out
    const exportedPack = await exportFormPack(originalPack.name, testDb)

    // 3. Verify format and sections match
    expect(exportedPack.formatVersion).toBe(originalPack.formatVersion)
    expect(exportedPack.kind).toBe(originalPack.kind)
    expect(exportedPack.name).toBe(originalPack.name)
    expect(exportedPack.sections.length).toBe(originalPack.sections.length)
    expect(exportedPack.questions.length).toBe(originalPack.questions.length)

    // Check aliases preserved
    expect(exportedPack.aliases).toEqual(originalPack.aliases)

    // Check first question and its parts match
    const originalFirstQ = originalPack.questions[0]
    const exportedFirstQ = exportedPack.questions.find((q) => q.id === originalFirstQ.id)
    expect(exportedFirstQ).toBeDefined()
    expect(exportedFirstQ?.label).toBe(originalFirstQ.label)
    expect(exportedFirstQ?.parts.length).toBe(originalFirstQ.parts.length)
  })
})
