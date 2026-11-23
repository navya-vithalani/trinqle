import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@vite-pwa/assets-generator/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getSvgBackgroundColor(svgPath: string, defaultColor = '#c9b3f5'): string {
  try {
    const content = fs.readFileSync(svgPath, 'utf-8')
    // Extract background fill from the first rect or element
    const match = content.match(/<rect[^>]*fill=(?:'|")([^'"]+)(?:'|")/i)
    if (match && match[1] && match[1] !== 'none') {
      return match[1]
    }
  } catch {
    // Fallback to defaultColor if unreadable
  }
  return defaultColor
}

const logoPath = path.resolve(__dirname, 'public/icons/logo.svg')
const bgColor = getSvgBackgroundColor(logoPath)

export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: {
        background: bgColor,
      },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: {
        background: bgColor,
      },
    },
  },
  images: ['public/icons/logo.svg'],
})
