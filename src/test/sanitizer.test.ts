// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { sanitizeSvg } from '../characters/sanitizer'
import { searchArchive, type SearchIndexData } from '../core/search'

describe('SVG Sanitizer & Search XSS Hardening (S6)', () => {
  it('strips or rejects hostile SVG attack corpus without regex-only fallback', () => {
    // 1. <script> injection
    const withScript = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20"/><script>alert(1)</script></svg>'
    )
    expect(withScript.valid).toBe(true)
    expect(withScript.cleanSvg).not.toContain('<script')
    expect(withScript.cleanSvg).not.toContain('alert(')

    // 2. Inline event handler
    const withOnload = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><g id="head" onclick="evil()"><circle cx="10" cy="10" r="5"/></g></svg>'
    )
    expect(withOnload.valid).toBe(true)
    expect(withOnload.cleanSvg).not.toContain('onload')
    expect(withOnload.cleanSvg).not.toContain('onclick')
    expect(withOnload.layerIds).toContain('head')

    // 3a. Well-formed XML <foreignObject> with embedded HTML must strip foreignObject + img
    const withForeign = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></body></foreignObject><path d="M0 0"/></svg>'
    )
    expect(withForeign.valid).toBe(true)
    expect(withForeign.cleanSvg.toLowerCase()).not.toContain('foreignobject')
    expect(withForeign.cleanSvg).not.toContain('<img')

    // 3b. Malformed HTML-inside-SVG must fail closed
    const withMalformedForeign = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body><img src=x onerror=alert(1)></body></foreignObject><path d="M0 0"/></svg>'
    )
    expect(withMalformedForeign.valid).toBe(false)
    expect(withMalformedForeign.cleanSvg).toBe('')

    // 4. <use href> and external refs
    const withUse = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/sprite.svg#x"/><circle cx="1" cy="1" r="1"/></svg>'
    )
    expect(withUse.valid).toBe(true)
    expect(withUse.cleanSvg.toLowerCase()).not.toContain('<use')
    expect(withUse.cleanSvg).not.toContain('evil.example')

    // 5. <style> and style="...url(...)..."
    const withStyle = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>body{background:url(https://evil.example)}</style><rect style="fill:url(javascript:alert(1))" width="10" height="10"/></svg>'
    )
    expect(withStyle.valid).toBe(true)
    expect(withStyle.cleanSvg.toLowerCase()).not.toContain('<style')
    expect(withStyle.cleanSvg).not.toContain('style=')
    expect(withStyle.cleanSvg).not.toContain('evil.example')

    // 6. DOCTYPE / ENTITY expansion tricks must fail closed
    const withDoctype = sanitizeSvg(
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe "evil">]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>'
    )
    expect(withDoctype.valid).toBe(false)
    expect(withDoctype.cleanSvg).toBe('')

    // 7. Malformed XML must fail closed (never fall back)
    const malformed = sanitizeSvg('<svg><circle cx="10"</svg>')
    expect(malformed.valid).toBe(false)
    expect(malformed.cleanSvg).toBe('')

    // 8. Non-SVG / namespace confusion
    const nonSvg = sanitizeSvg('<html xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></html>')
    expect(nonSvg.valid).toBe(false)

    // 9. Preserves safe data-origin pivot attributes on SVG layers
    const withOrigin = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="arm-left" data-origin="40% 50%"><path d="M0 0 L10 10"/></g></svg>'
    )
    expect(withOrigin.valid).toBe(true)
    expect(withOrigin.cleanSvg).toContain('data-origin="40% 50%"')
  })

  it('preserves all built-in character SVGs cleanly', () => {
    const packsDir = path.resolve(process.cwd(), 'src/characters')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.svg')) files.push(full)
      }
    }
    walk(packsDir)
    expect(files.length).toBeGreaterThanOrEqual(9)
    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf8')
      const res = sanitizeSvg(raw)
      expect(res.valid, `Expected ${file} to sanitize cleanly: ${res.error}`).toBe(true)
      expect(res.layerIds.length, `Expected layerIds in ${file}`).toBeGreaterThan(0)
      if (file.endsWith(path.join('white-cat', 'character.svg'))) {
        expect(res.layerIds).toContain('head')
        expect(res.layerIds).toContain('body')
      }
    }
  })

  it('HTML-escapes search highlightedSnippet so stored text cannot inject markup', () => {
    const data: SearchIndexData = {
      days: [
        {
          date: '2026-11-27',
          chapterId: 'ch_1',
          mode: 'full',
          title: '<img src=x onerror="alert(1)"> & alert note',
          memorability: 0,
          expandedMore: false,
          backfilled: false,
          filledAt: 1000,
          tz: 'UTC',
        },
      ],
      answers: [
        {
          id: 'ans_1',
          date: '2026-11-27',
          questionId: 'q_1',
          partId: 'p_1',
          instance: 0,
          value: '<script>alert("xss")</script> note',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      answerLinks: [],
      questions: [],
      parts: [],
      libraries: [],
      items: [],
      chapters: [],
      chapterAnswers: [
        {
          id: 'ca_1',
          chapterId: 'ch_1',
          promptId: 'pr_1',
          value: '<svg onload=alert(1)> reflection',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }

    const hits = searchArchive(data, { query: 'alert' }).flatMap((d) => d.hits)
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) {
      expect(h.highlightedSnippet).not.toContain('<script>')
      expect(h.highlightedSnippet).not.toContain('<img')
      expect(h.highlightedSnippet).not.toContain('<svg')
      expect(h.highlightedSnippet).toContain('&lt;')
    }
  })
})
