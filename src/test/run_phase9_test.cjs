require.extensions['.svg'] = (module, filename) => {
  module.exports = filename
}

const jiti = require('jiti')(__filename)
const fs = require('fs')
const path = require('path')

async function run() {
  console.log('Running Phase 9 (Themes, Characters, Sanitizer & Polish) Tests...')

  const {
    CHARACTERS,
    getAllCharacters,
    getCharacter,
    getCharacterOfTheMonth,
    saveCustomCharacter,
    deleteCustomCharacter,
  } = jiti('../characters/registry.ts')

  const { sanitizeSvg } = jiti('../characters/sanitizer.ts')
  const { themeRegistry, getTheme, getAllThemes } = jiti('../themes/registry.ts')
  const { initCharacterAnimator } = jiti('../characters/animator.ts')

  // --- Test 1: Characters Registry & Multi-View Character Assets ---
  console.log('\n--- Test 1: Characters Registry & Multi-View Assets ---')
  if (CHARACTERS.length < 7) {
    throw new Error(`Expected at least 7 built-in characters, found ${CHARACTERS.length}`)
  }

  const expectedIds = ['white-cat', 'cookie-man', 'spider', 'doll', 'mouse', 'unicorn', 'rabbit']
  for (const id of expectedIds) {
    const char = getCharacter(id)
    if (!char) throw new Error(`Missing required character: ${id}`)
    if (!char.name || !char.description) throw new Error(`Incomplete metadata for character: ${id}`)
  }

  // Multi-view check for Unicorn & Rabbit
  const unicorn = getCharacter('unicorn')
  if (!unicorn.hasMultiView || !unicorn.sideSvg) {
    throw new Error('Unicorn character must have hasMultiView: true and sideSvg defined')
  }

  const rabbit = getCharacter('rabbit')
  if (!rabbit.hasMultiView || !rabbit.sideSvg) {
    throw new Error('Rabbit character must have hasMultiView: true and sideSvg defined')
  }

  // Check SVG files on disk
  const charDir = path.resolve(__dirname, '../characters')
  const svgChecks = [
    { name: 'doll front', file: path.join(charDir, 'doll/character.svg') },
    { name: 'mouse front', file: path.join(charDir, 'mouse/character.svg') },
    { name: 'unicorn front', file: path.join(charDir, 'unicorn/character.svg') },
    { name: 'unicorn side', file: path.join(charDir, 'unicorn/side.svg') },
    { name: 'rabbit front', file: path.join(charDir, 'rabbit/character.svg') },
    { name: 'rabbit side', file: path.join(charDir, 'rabbit/side.svg') },
  ]

  for (const item of svgChecks) {
    if (!fs.existsSync(item.file)) {
      throw new Error(`Missing SVG file for ${item.name}: ${item.file}`)
    }
    const content = fs.readFileSync(item.file, 'utf8')
    if (!content.includes('<svg') || !content.includes('</svg>')) {
      throw new Error(`Invalid SVG markup in ${item.file}`)
    }
    if (!content.includes('id="body"') || !content.includes('id="head"')) {
      throw new Error(`SVG ${item.file} missing standard body/head contract IDs`)
    }
  }
  console.log('Pass: All 7 characters registered; unicorn and rabbit have valid front & side SVG assets')

  // --- Test 2: SVG Sanitizer Security Tests ---
  console.log('\n--- Test 2: SVG Sanitizer Neutralization ---')
  const hostileSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <script>alert("hostile script execution!")</script>
      <foreignObject width="100" height="100">
        <body xmlns="http://www.w3.org/1999/xhtml">
          <script>stealLocalStorage()</script>
        </body>
      </foreignObject>
      <g id="head" data-origin="50% 50%">
        <circle id="eye-left" cx="30" cy="40" r="5" onload="badPayload()" onclick="evilClick()" />
        <path d="M10 10 L20 20" />
      </g>
      <a href="javascript:alert('xss')">
        <circle cx="50" cy="50" r="20" fill="red" />
      </a>
      <g id="body"><rect width="40" height="40" /></g>
    </svg>
  `

  const sanitized = sanitizeSvg(hostileSvg)
  if (!sanitized.valid) {
    throw new Error(`Sanitizer rejected valid geometry: ${sanitized.error}`)
  }

  // Security assertions
  if (sanitized.cleanSvg.includes('<script')) {
    throw new Error('FAILED: <script> was not neutralized by sanitizer')
  }
  if (sanitized.cleanSvg.includes('foreignObject') || sanitized.cleanSvg.includes('foreignobject')) {
    throw new Error('FAILED: <foreignObject> was not neutralized by sanitizer')
  }
  if (sanitized.cleanSvg.includes('onload=') || sanitized.cleanSvg.includes('onclick=')) {
    throw new Error('FAILED: Inline on* event handlers were not stripped')
  }
  if (sanitized.cleanSvg.includes('javascript:')) {
    throw new Error('FAILED: javascript: URI was not neutralized')
  }

  // Geometry preservation assertions
  if (!sanitized.cleanSvg.includes('<circle') || !sanitized.cleanSvg.includes('<rect')) {
    throw new Error('FAILED: Geometry was stripped along with hostile tags')
  }
  if (!sanitized.layerIds.includes('head') || !sanitized.layerIds.includes('body')) {
    throw new Error('FAILED: Valid layer IDs head/body were not detected')
  }
  console.log('Pass: Hostile SVG scripts, foreignObjects, on* attributes, and javascript: links 100% neutralized')

  // --- Test 3: Themes Registry & Distinct Characteristics ---
  console.log('\n--- Test 3: All 7 Themes & Distinct Immersive Styling ---')
  const themes = getAllThemes()
  if (themes.length < 7) {
    throw new Error(`Expected at least 7 themes, found ${themes.length}`)
  }

  const expectedThemeIds = ['cutesy', 'clay', 'cyberpunk', 'retro', 'royal', 'newspaper', 'sports']
  for (const tid of expectedThemeIds) {
    const t = getTheme(tid)
    if (!t) throw new Error(`Missing theme in registry: ${tid}`)
    if (!t.tokens.light || !t.tokens.dark || !t.archive) {
      throw new Error(`Theme ${tid} missing light, dark, or archive tokens`)
    }
    if (!t.iconSet || typeof t.iconSet !== 'object') {
      throw new Error(`Theme ${tid} missing iconSet mapping`)
    }
  }

  // Verify Newspaper Theme: zero border radius & line separators
  const newspaper = getTheme('newspaper')
  if (
    newspaper.tokens.light.shape.radiusS !== '0px' ||
    newspaper.tokens.light.shape.radiusL !== '0px' ||
    newspaper.tokens.light.depth.shadowCard !== 'none'
  ) {
    throw new Error('Newspaper theme must use 0px radius and shadowCard: "none" for line-separator styling')
  }

  // Verify Retro Theme: tactile bevels & monospace typography
  const retro = getTheme('retro')
  if (
    !retro.tokens.light.depth.shadowButton.includes('inset') ||
    !retro.tokens.light.type.fontBody.includes('monospace')
  ) {
    throw new Error('Retro theme must use tactile inset bevel button shadows and monospace typography')
  }

  // Verify Royal Theme: serif typography & regal palette
  const royal = getTheme('royal')
  if (
    !royal.tokens.light.type.fontDisplay.includes('serif') ||
    !royal.tokens.light.color.accent.includes('b8860b')
  ) {
    throw new Error('Royal theme must use serif typography and gold accent')
  }

  // Verify Sports Theme: sports equipment icons
  const sports = getTheme('sports')
  if (sports.iconSet.home !== 'Trophy' || sports.iconSet.dashboard !== 'Timer') {
    throw new Error('Sports theme must map sports equipment icons in iconSet')
  }
  console.log('Pass: All 7 themes verified with hyper-distinct visual tokens and custom icon sets')

  // --- Test 4: Multi-View Animator View Switching ---
  console.log('\n--- Test 4: Multi-View Animation View Switching ---')
  let currentActiveView = 'front'
  const mockContainer = {
    querySelector: () => null,
    querySelectorAll: () => [],
    animate: (keyframes, opts) => {
      const anim = {
        cancel: () => {},
        onfinish: null,
      }
      // Simulate animation completion
      setTimeout(() => {
        if (anim.onfinish) anim.onfinish()
      }, 10)
      return anim
    },
  }

  const animator = initCharacterAnimator(mockContainer, {
    characterId: 'unicorn',
    onViewChange: (nextView) => {
      currentActiveView = nextView
    },
  })

  // Trigger gallop clip: should immediately switch to side view
  animator.playClip('gallop')
  if (currentActiveView !== 'side') {
    throw new Error(`Expected view to switch to "side" on gallop, got "${currentActiveView}"`)
  }

  // Wait for animation to finish and switch back to front view
  await new Promise((resolve) => setTimeout(resolve, 50))
  if (currentActiveView !== 'front') {
    throw new Error(`Expected view to return to "front" after gallop, got "${currentActiveView}"`)
  }

  // Trigger hop clip for rabbit
  const rabbitAnimator = initCharacterAnimator(mockContainer, {
    characterId: 'rabbit',
    onViewChange: (nextView) => {
      currentActiveView = nextView
    },
  })

  rabbitAnimator.playClip('hop')
  if (currentActiveView !== 'side') {
    throw new Error(`Expected view to switch to "side" on hop, got "${currentActiveView}"`)
  }

  await new Promise((resolve) => setTimeout(resolve, 50))
  if (currentActiveView !== 'front') {
    throw new Error(`Expected view to return to "front" after hop, got "${currentActiveView}"`)
  }

  animator.destroy()
  rabbitAnimator.destroy()
  console.log('Pass: Multi-view animator cleanly switches between side view for locomotion and front view for idle')

  // --- Test 5: Zero Emoji Compliance Verification ---
  console.log('\n--- Test 5: Zero Emoji Compliance Verification ---')
  const EMOJI_REGEX = /\p{Extended_Pictographic}/u
  const filesToVerify = [
    '../characters/registry.ts',
    '../characters/animator.ts',
    '../characters/sanitizer.ts',
    '../themes/retro.ts',
    '../themes/royal.ts',
    '../themes/newspaper.ts',
    '../themes/sports.ts',
    '../themes/registry.ts',
    '../ui/components/Navbar.tsx',
    '../ui/components/CharacterStage.tsx',
    '../ui/dialogs/CharacterImportDialog.tsx',
  ]

  for (const rel of filesToVerify) {
    const full = path.resolve(__dirname, rel)
    if (!fs.existsSync(full)) continue
    const text = fs.readFileSync(full, 'utf8')
    const match = text.match(EMOJI_REGEX)
    if (match) {
      throw new Error(`Zero-Emoji violation in ${rel}: found "${match[0]}"`)
    }
  }
  console.log('Pass: Zero emoji violations across all Phase 9 source files')

  console.log('\n========================================')
  console.log('   ALL PHASE 9 UNIT TESTS PASSED!      ')
  console.log('========================================')
}

run().catch((err) => {
  console.error('\nPhase 9 Test Failure:', err)
  process.exit(1)
})
