import React, { useState, useRef } from 'react'
import { X, Upload, ShieldCheck, AlertCircle, Play } from 'lucide-react'
import { sanitizeSvg } from '../../characters/sanitizer'
import { saveCustomCharacter } from '../../characters/registry'
import { initCharacterAnimator, type AnimatorControls } from '../../characters/animator'

interface CharacterImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (charId: string) => void
}

export const CharacterImportDialog: React.FC<CharacterImportDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [characterName, setCharacterName] = useState('')
  const [limbsCount, setLimbsCount] = useState<number>(4)
  const [rawSvgText, setRawSvgText] = useState('')
  const [sanitizedSvg, setSanitizedSvg] = useState('')
  const [detectedLayers, setDetectedLayers] = useState<string[]>([])
  const [sanitizedNotice, setSanitizedNotice] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const previewRef = useRef<HTMLDivElement>(null)
  const animatorRef = useRef<AnimatorControls | null>(null)

  if (!isOpen) return null

  const processSvgInput = (content: string) => {
    setErrorMessage(null)
    setSanitizedNotice(null)
    const result = sanitizeSvg(content)

    if (!result.valid) {
      setErrorMessage(result.error || 'Invalid SVG content')
      setSanitizedSvg('')
      setDetectedLayers([])
      return
    }

    // Check if hostile elements were stripped
    if (
      content.includes('<script') ||
      content.includes('onload=') ||
      content.includes('foreignObject')
    ) {
      setSanitizedNotice('Hostile scripts or foreignObjects were safely neutralized.')
    }

    setSanitizedSvg(result.cleanSvg)
    setDetectedLayers(result.layerIds)
    if (!characterName) {
      setCharacterName('Custom Character')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setRawSvgText(text)
      processSvgInput(text)
    }
    reader.readAsText(file)
  }

  const handleTestAnimation = () => {
    if (!previewRef.current || !sanitizedSvg) return
    if (!animatorRef.current) {
      animatorRef.current = initCharacterAnimator(previewRef.current)
    }
    animatorRef.current.handleTap()
  }

  const handleSave = () => {
    if (!sanitizedSvg) return
    const id = `custom_${Date.now()}`
    const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(sanitizedSvg)}`

    saveCustomCharacter({
      id,
      name: characterName.trim() || 'Custom Character',
      description: 'Custom imported SVG character persona',
      svg: svgDataUrl,
      limbs: limbsCount,
      isCustom: true,
    })

    onSuccess(id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--color-surface)] w-full max-w-md rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
          <div className="flex items-center space-x-2">
            <Upload size={18} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">
              Import Custom SVG Character
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
          <p className="text-[var(--color-ink-soft)] leading-relaxed">
            Upload any custom SVG. Active scripts, external objects, and event handlers are strictly neutralized before animation.
          </p>

          {/* File Picker */}
          <div className="p-4 border-2 border-dashed border-[var(--color-line)] rounded-[var(--radius-m)] flex flex-col items-center justify-center text-center space-y-2 bg-[var(--color-bg)]">
            <Upload size={24} className="text-[var(--color-ink-soft)]" />
            <label className="cursor-pointer px-3 py-1.5 rounded-full bg-[var(--color-accent)] text-white font-bold text-xs shadow-xs hover:opacity-90 active:scale-95">
              <span>Choose SVG file</span>
              <input
                type="file"
                accept=".svg,image/svg+xml"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <span className="text-[10px] text-[var(--color-ink-soft)]">
              Or paste raw SVG code below
            </span>
          </div>

          {/* Raw Text Fallback */}
          <textarea
            placeholder="Paste raw <svg>...</svg> code here..."
            value={rawSvgText}
            onChange={(e) => {
              setRawSvgText(e.target.value)
              processSvgInput(e.target.value)
            }}
            className="w-full h-20 p-2 text-[11px] font-mono rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />

          {/* Error notice */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center space-x-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Neutralization notice */}
          {sanitizedNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-2 font-medium">
              <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
              <span>{sanitizedNotice}</span>
            </div>
          )}

          {/* Live Preview & Layer Detection */}
          {sanitizedSvg && (
            <div className="space-y-3 pt-1 border-t border-[var(--color-line)]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--color-ink)]">Live Preview & Test</span>
                <button
                  type="button"
                  onClick={handleTestAnimation}
                  className="px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[10px] font-bold text-[var(--color-accent)] hover:border-[var(--color-accent)] flex items-center gap-1 active:scale-95"
                >
                  <Play size={10} fill="currentColor" />
                  <span>Test reaction</span>
                </button>
              </div>

              <div className="w-full h-36 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-bg)] flex items-center justify-center p-3">
                <div
                  ref={previewRef}
                  className="w-24 h-24 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
                />
              </div>

              {/* Character Details Form */}
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-bold text-[var(--color-ink)] block mb-1">
                    Character Name
                  </label>
                  <input
                    type="text"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="E.g. Lunar Fox"
                    className="w-full p-2 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-bg)] font-semibold text-xs text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--color-ink)] block mb-1">
                    Number of Limbs
                  </label>
                  <div className="flex items-center space-x-2">
                    {[0, 2, 4, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setLimbsCount(n)}
                        className={`py-1 px-3 rounded-[var(--radius-pill)] font-bold text-xs transition-all ${
                          limbsCount === n
                            ? 'bg-[var(--color-accent)] text-white shadow-xs'
                            : 'bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
                        }`}
                      >
                        {n} {n === 1 ? 'limb' : 'limbs'}
                      </button>
                    ))}
                  </div>
                </div>

                {detectedLayers.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[10px] text-[var(--color-ink-soft)] block mb-1">
                      Detected Layer IDs: {detectedLayers.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-[var(--color-line)] flex items-center space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-[var(--radius-pill)] border border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!sanitizedSvg}
            onClick={handleSave}
            className="flex-1 py-2 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            Save Character
          </button>
        </div>
      </div>
    </div>
  )
}
