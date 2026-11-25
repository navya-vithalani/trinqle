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

// Dangerous elements that must never execute in imported SVGs
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
]

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

  // 1. Strip XML declaration, DOCTYPE and external entity declarations
  clean = clean.replace(/<\?xml[\s\S]*?\?>/gi, '')
  clean = clean.replace(/<!DOCTYPE[\s\S]*?>/gi, '')
  clean = clean.replace(/<!ENTITY[\s\S]*?>/gi, '')

  // 2. Strip disallowed hostile tags and their entire contents
  for (const tag of DISALLOWED_TAGS) {
    // Both paired <tag>...</tag> and self-closing <tag.../>
    const pairedRegex = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi')
    clean = clean.replace(pairedRegex, '')
    const selfClosingRegex = new RegExp(`<${tag}\\b[\\s\\S]*?\\/>`, 'gi')
    clean = clean.replace(selfClosingRegex, '')
  }

  // 3. Strip all inline on* event attributes (e.g. onload, onclick, onerror, etc.)
  clean = clean.replace(/\son[a-z0-9_-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // 4. Strip dangerous protocols in attributes (href, xlink:href, etc.)
  clean = clean.replace(
    /(href|xlink:href|src|action)\s*=\s*("[\s\S]*?javascript:[\s\S]*?"|'[\s\S]*?javascript:[\s\S]*?'|[^\s>]*javascript:[^\s>]*)/gi,
    'href="#"'
  )
  clean = clean.replace(
    /(href|xlink:href|src|action)\s*=\s*("[\s\S]*?vbscript:[\s\S]*?"|'[\s\S]*?vbscript:[\s\S]*?'|[^\s>]*vbscript:[^\s>]*)/gi,
    'href="#"'
  )
  clean = clean.replace(
    /(href|xlink:href|src|action)\s*=\s*("[\s\S]*?data:text\/html[\s\S]*?"|'[\s\S]*?data:text\/html[\s\S]*?'|[^\s>]*data:text\/html[^\s>]*)/gi,
    'href="#"'
  )

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
