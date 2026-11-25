/**
 * Secure SVG Sanitizer & Layer Extractor for Trinqle.
 * Strips active scripts, hostile tags, foreign objects, and dangerous event handlers.
 * Runs in both browser and Node.js environments.
 * Zero external dependencies; zero emojis.
 */

export interface SanitizedSvgResult {
  valid: boolean
  cleanSvg: string
  error?: string
  layerIds: string[]
  detectedRoles: Record<string, string>
}

// Dangerous elements that must never execute or inject styles/external refs in imported SVGs
const DISALLOWED_TAGS = [
  'script',
  'foreignobject',
  'iframe',
  'embed',
  'object',
  'applet',
  'frame',
  'frameset',
  'audio',
  'video',
  'meta',
  'link',
  'style',
  'base',
]

const ALLOWED_SVG_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line',
  'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern',
  'title', 'desc', 'a', 'text', 'tspan',
])

/**
 * Sanitizes arbitrary user-supplied SVG markup.
 */
export function sanitizeSvg(rawSvg: string): SanitizedSvgResult {
  if (!rawSvg || typeof rawSvg !== 'string') {
    return {
      valid: false,
      cleanSvg: '',
      error: 'Empty or invalid SVG input',
      layerIds: [],
      detectedRoles: {},
    }
  }

  let clean = rawSvg.trim()

  // 1. Strip XML declaration, DOCTYPE, comments, and external entity declarations
  clean = clean.replace(/<\?xml[\s\S]*?\?>/gi, '')
  clean = clean.replace(/<!DOCTYPE[\s\S]*?>/gi, '')
  clean = clean.replace(/<!ENTITY[\s\S]*?>/gi, '')
  clean = clean.replace(/<!--[\s\S]*?-->/g, '')

  // 2. Iteratively strip disallowed hostile tags (defeats nested <scr<script>ipt> bypasses)
  let prevClean = ''
  while (prevClean !== clean) {
    prevClean = clean
    for (const tag of DISALLOWED_TAGS) {
      const pairedRegex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
      clean = clean.replace(pairedRegex, '')
      const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi')
      clean = clean.replace(selfClosingRegex, '')
    }
  }

  // 3. Strip all inline on* event attributes (handles whitespace, '/', or quotes before attribute name)
  clean = clean.replace(/(^|[\s/"'])on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1')

  // 4. Strip dangerous protocols and external references in attributes
  clean = clean.replace(
    /(href|xlink:href|src|action|formaction)\s*=\s*(?:"[\s\S]*?(?:javascript|vbscript|data\s*:|https?:|\/\/)[\s\S]*?"|'[\s\S]*?(?:javascript|vbscript|data\s*:|https?:|\/\/)[\s\S]*?'|[^\s>]*?(?:javascript|vbscript|data\s*:|https?:|\/\/)[^\s>]*)/gi,
    'href="#"'
  )

  // 5. Browser DOMParser allowlist pass when DOM is available
  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(clean, 'image/svg+xml')
      const parserError = doc.querySelector('parsererror')
      if (!parserError && doc.documentElement && doc.documentElement.tagName.toLowerCase() === 'svg') {
        const walk = (el: Element) => {
          const children = Array.from(el.children)
          for (const child of children) {
            const tag = child.tagName.toLowerCase()
            if (!ALLOWED_SVG_TAGS.has(tag)) {
              child.remove()
              continue
            }
            for (const attr of Array.from(child.attributes)) {
              const name = attr.name.toLowerCase()
              const val = attr.value.trim().toLowerCase()
              if (name.startsWith('on')) {
                child.removeAttribute(attr.name)
              } else if (
                (name === 'href' || name === 'xlink:href' || name === 'src') &&
                (val.startsWith('javascript:') ||
                  val.startsWith('vbscript:') ||
                  val.startsWith('data:') ||
                  val.startsWith('http:') ||
                  val.startsWith('https:') ||
                  val.startsWith('//'))
              ) {
                child.setAttribute(attr.name, '#')
              }
            }
            walk(child)
          }
        }
        walk(doc.documentElement)
        clean = new XMLSerializer().serializeToString(doc.documentElement)
      }
    } catch {
      // Fallback to regex-cleaned string
    }
  }

  // 5. Verify root is an <svg> tag
  if (!/<svg\b/i.test(clean) || !/<\/svg>/i.test(clean)) {
    return {
      valid: false,
      cleanSvg: '',
      error: 'Malformed SVG: missing root <svg> wrapper',
      layerIds: [],
      detectedRoles: {},
    }
  }

  // 6. Extract candidate layer IDs (e.g. id="head", id="arm-left", etc.)
  const layerIds: string[] = []
  const idMatches = clean.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)
  for (const m of idMatches) {
    const id = m[1].trim()
    if (id && id !== 'character' && !layerIds.includes(id)) {
      layerIds.push(id)
    }
  }

  // 7. Auto-detect layer roles based on convention
  const detectedRoles: Record<string, string> = {}
  for (const id of layerIds) {
    const lower = id.toLowerCase()
    if (lower.includes('head')) detectedRoles.head = id
    else if (lower.includes('body') || lower.includes('torso')) detectedRoles.body = id
    else if (lower.includes('eye-left') || lower.includes('eye_l') || lower === 'eye1') detectedRoles.eyeLeft = id
    else if (lower.includes('eye-right') || lower.includes('eye_r') || lower === 'eye2') detectedRoles.eyeRight = id
    else if (lower.includes('mouth')) detectedRoles.mouth = id
    else if (lower.includes('tail')) detectedRoles.tail = id
    else if (lower.includes('horn')) detectedRoles.horn = id
    else if (lower.includes('ear-left') || lower.includes('ear_l')) detectedRoles.earLeft = id
    else if (lower.includes('ear-right') || lower.includes('ear_r')) detectedRoles.earRight = id
  }

  return {
    valid: true,
    cleanSvg: clean,
    layerIds,
    detectedRoles,
  }
}
