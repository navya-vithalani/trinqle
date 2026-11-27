import DOMPurify from 'dompurify'

/**
 * Secure SVG Sanitizer & Layer Extractor for Trinqle.
 * Uses DOMPurify (SVG profile) + strict XML validation and fails closed on
 * malformed markup, DOCTYPE/ENTITY declarations, active elements, or external refs.
 * Zero emojis.
 */

export interface SanitizedSvgResult {
  valid: boolean
  cleanSvg: string
  error?: string
  layerIds: string[]
  detectedRoles: Record<string, string>
}

const MAX_SVG_BYTES = 512 * 1024

const ALLOWED_SVG_TAGS = [
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'polygon',
  'polyline',
  'line',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'title',
  'desc',
  'text',
  'tspan',
  'lineargradient',
  'radialgradient',
  'clippath',
]

const FORBID_SVG_TAGS = [
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
  'use',
  'image',
  'feimage',
  'animate',
  'animatemotion',
  'animatetransform',
  'set',
  'a',
]

const ALLOWED_SVG_ATTRS = [
  'id',
  'class',
  'xmlns',
  'viewBox',
  'viewbox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'opacity',
  'transform',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientunits',
  'gradientTransform',
  'gradienttransform',
  'clip-path',
  'mask',
  'preserveAspectRatio',
  'preserveaspectratio',
  'font-size',
  'font-weight',
  'font-family',
  'text-anchor',
  'data-origin',
]

const DANGEROUS_VALUE_RE = /(?:url\s*\(|javascript\s*:|vbscript\s*:|data\s*:|https?\s*:|\/\/|expression\s*\()/i

function fail(error: string): SanitizedSvgResult {
  return {
    valid: false,
    cleanSvg: '',
    error,
    layerIds: [],
    detectedRoles: {},
  }
}

function getDomPurifyInstance(): typeof DOMPurify {
  if (typeof window !== 'undefined' && typeof DOMPurify === 'function') {
    // Support both default singleton and factory signature depending on bundler/runtime
    const maybeFactory = DOMPurify as unknown as {
      sanitize?: typeof DOMPurify.sanitize
      (w: Window): typeof DOMPurify
    }
    if (typeof maybeFactory.sanitize === 'function') {
      return DOMPurify
    }
    return maybeFactory(window)
  }
  return DOMPurify
}

/**
 * Sanitizes arbitrary user-supplied SVG markup using DOMPurify and strict XML verification.
 */
export function sanitizeSvg(rawSvg: string): SanitizedSvgResult {
  if (!rawSvg || typeof rawSvg !== 'string') {
    return fail('Empty or invalid SVG input')
  }

  const trimmed = rawSvg.trim()
  if (!trimmed) {
    return fail('Empty or invalid SVG input')
  }

  if (trimmed.length > MAX_SVG_BYTES) {
    return fail('SVG exceeds maximum allowed size (512 KB)')
  }

  // Reject XML DOCTYPE / ENTITY tricks before any parser runs
  if (/<!(?:DOCTYPE|ENTITY)\b/i.test(trimmed)) {
    return fail('DOCTYPE and ENTITY declarations are not allowed in SVG files')
  }

  // Fail closed when DOM / XML parser is unavailable (never use regex-only fallback)
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return fail('SVG DOMParser unavailable in current environment')
  }

  // Require valid well-formed XML SVG before sanitization
  let initialDoc: Document
  try {
    initialDoc = new DOMParser().parseFromString(trimmed, 'image/svg+xml')
  } catch {
    return fail('Malformed SVG XML document')
  }

  const initialErr = initialDoc.querySelector('parsererror')
  if (
    initialErr ||
    !initialDoc.documentElement ||
    initialDoc.documentElement.localName.toLowerCase() !== 'svg'
  ) {
    return fail('Malformed SVG: failed strict XML parsing or missing root <svg>')
  }

  const purify = getDomPurifyInstance()
  if (!purify || typeof purify.sanitize !== 'function') {
    return fail('DOMPurify sanitizer unavailable in current environment')
  }

  let purified: string
  try {
    purified = purify.sanitize(trimmed, {
      NAMESPACE: 'http://www.w3.org/2000/svg',
      ALLOWED_TAGS: ALLOWED_SVG_TAGS,
      FORBID_TAGS: FORBID_SVG_TAGS,
      ALLOWED_ATTR: ALLOWED_SVG_ATTRS,
      FORBID_ATTR: ['style', 'href', 'xlink:href', 'src', 'action', 'formaction'],
      ALLOW_DATA_ATTR: false,
      SANITIZE_DOM: false,
      RETURN_TRUSTED_TYPE: false,
    })
  } catch {
    return fail('DOMPurify rejected SVG input')
  }

  if (!purified || typeof purified !== 'string') {
    return fail('SVG sanitization produced empty output')
  }

  // Second strict XML pass after sanitization + attribute value verification
  let verifiedDoc: Document
  try {
    verifiedDoc = new DOMParser().parseFromString(purified, 'image/svg+xml')
  } catch {
    return fail('Sanitized SVG failed XML verification')
  }

  const verifiedErr = verifiedDoc.querySelector('parsererror')
  if (
    verifiedErr ||
    !verifiedDoc.documentElement ||
    verifiedDoc.documentElement.localName.toLowerCase() !== 'svg'
  ) {
    return fail('Sanitized SVG missing valid root <svg> element')
  }

  const cleanAttributesRecursively = (el: Element) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value
      if (name.startsWith('on') || name === 'style') {
        el.removeAttribute(attr.name)
        continue
      }
      if (DANGEROUS_VALUE_RE.test(value)) {
        // Only internal #id allowed for clip-path/mask/fill/stroke gradient refs; strip others
        const internalRef = /^(fill|stroke|clip-path|mask)$/i.test(name) && /^url\(\s*#[a-zA-Z0-9_-]+\s*\)$/.test(value.trim())
        if (!internalRef) {
          el.removeAttribute(attr.name)
        }
      }
    }
    for (const child of Array.from(el.children)) {
      cleanAttributesRecursively(child)
    }
  }
  cleanAttributesRecursively(verifiedDoc.documentElement)

  const clean = new XMLSerializer().serializeToString(verifiedDoc.documentElement)

  // Extract candidate layer IDs (e.g. id="head", id="arm-left", etc.)
  const layerIds: string[] = []
  verifiedDoc.documentElement.querySelectorAll('[id]').forEach((node) => {
    const id = node.getAttribute('id')?.trim()
    if (id && id !== 'character' && !layerIds.includes(id)) {
      layerIds.push(id)
    }
  })

  // Auto-detect layer roles based on convention
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
