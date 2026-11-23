import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Unicode emoji regex matching extended pictographic symbols
const EMOJI_REGEX = /\p{Extended_Pictographic}/u

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    // Skip git, node_modules, dist, etc.
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === '.vercel'
    ) {
      continue
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, fileList)
    } else if (
      entry.isFile() &&
      /\.(ts|tsx|js|jsx|json|md|html|css|csv)$/i.test(entry.name)
    ) {
      fileList.push(fullPath)
    }
  }

  return fileList
}

describe('Zero Emoji Policy', () => {
  it('strictly forbids any emoji characters in source and content files', () => {
    const rootDir = path.resolve(__dirname, '../..')
    const dirsToScan = [
      path.join(rootDir, 'src'),
      path.join(rootDir, 'docs'),
      path.join(rootDir, 'public'),
    ]

    const filesToTest: string[] = []
    for (const dir of dirsToScan) {
      scanDirectory(dir, filesToTest)
    }

    const violations: { file: string; line: number; character: string; text: string }[] = []

    for (const file of filesToTest) {
      // Don't flag this test file itself for containing regex definition
      if (file.endsWith('zero-emoji.test.ts')) continue

      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      lines.forEach((lineText, idx) => {
        const match = lineText.match(EMOJI_REGEX)
        if (match) {
          violations.push({
            file: path.relative(rootDir, file),
            line: idx + 1,
            character: match[0],
            text: lineText.trim(),
          })
        }
      })
    }

    if (violations.length > 0) {
      console.error('Found emoji violations:', violations)
    }

    expect(violations).toEqual([])
  })
})
