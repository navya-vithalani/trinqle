import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectSourceFiles(full, out)
    } else if (/\.(ts|tsx|js|jsx|cjs|mjs)$/i.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe('Local Date Policy (F6)', () => {
  it('bans UTC toISOString().slice(0, 10) date slicing in src/', () => {
    const rootDir = path.resolve(__dirname, '../..')
    const srcDir = path.join(rootDir, 'src')
    const files = collectSourceFiles(srcDir)
    const violations: string[] = []

    const pattern = /\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/
    for (const file of files) {
      if (file.endsWith('noUtcDateSlice.test.ts')) continue
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          violations.push(`${path.relative(rootDir, file)}:${idx + 1}`)
        }
      })
    }

    expect(violations).toEqual([])
  })
})
