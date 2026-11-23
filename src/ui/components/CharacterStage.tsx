import React, { useEffect, useRef, useState } from 'react'
import { getCharacter } from '../../characters/registry'
import { initCharacterAnimator, type AnimatorControls } from '../../characters/animator'
import { Sparkles } from 'lucide-react'

interface CharacterStageProps {
  characterId: string
  greetingText?: string
}

export const CharacterStage: React.FC<CharacterStageProps> = ({
  characterId,
  greetingText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const animatorRef = useRef<AnimatorControls | null>(null)
  const character = getCharacter(characterId)
  const [svgContent, setSvgContent] = useState<string>('')

  // Load raw SVG content so we can inject inline SVG and animate its internal IDs
  useEffect(() => {
    let isMounted = true
    fetch(character.svg)
      .then((res) => res.text())
      .then((text) => {
        if (isMounted) setSvgContent(text)
      })
      .catch(() => {
        // Fallback handled by img tag if fetch fails
      })
    return () => {
      isMounted = false
    }
  }, [character.svg])

  useEffect(() => {
    if (!containerRef.current || !svgContent) return

    animatorRef.current = initCharacterAnimator(containerRef.current)

    return () => {
      if (animatorRef.current) {
        animatorRef.current.destroy()
        animatorRef.current = null
      }
    }
  }, [svgContent])

  const handleStageTap = () => {
    if (animatorRef.current) {
      animatorRef.current.handleTap()
    }
  }

  return (
    <div
      onClick={handleStageTap}
      className="sticker-card p-5 flex flex-col items-center justify-center min-h-[220px] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-bg)] cursor-pointer select-none relative overflow-hidden"
    >
      {/* Speech Bubble Greeting */}
      {greetingText && (
        <div className="relative mb-3 max-w-[280px] bg-[var(--color-surface)] border-2 border-[var(--color-line)] shadow-sm px-3.5 py-2 rounded-[var(--radius-m)] text-center text-xs font-semibold text-[var(--color-ink)] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-center space-x-1.5 mb-0.5">
            <Sparkles size={11} className="text-[var(--color-accent)] shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-soft)] font-bold">
              Piqsie
            </span>
          </div>
          <p>{greetingText}</p>
          {/* Bubble beak */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--color-surface)] border-r-2 border-b-2 border-[var(--color-line)] rotate-45" />
        </div>
      )}

      {/* Interactive Character SVG */}
      <div
        ref={containerRef}
        className="w-28 h-28 flex items-center justify-center transition-transform active:scale-95"
        dangerouslySetInnerHTML={svgContent ? { __html: svgContent } : undefined}
      >
        {!svgContent && (
          <img
            src={character.svg}
            alt={character.name}
            className="w-24 h-24 object-contain"
          />
        )}
      </div>

      <div className="text-center mt-2">
        <p className="text-xs font-bold text-[var(--color-ink)]">
          Piqsie ({character.name})
        </p>
        <p className="text-[10px] text-[var(--color-ink-soft)] mt-0.5">
          Tap Piqsie to react
        </p>
      </div>
    </div>
  )
}
