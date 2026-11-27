import React, { useEffect, useRef, useState } from 'react'
import { getCharacter } from '../../characters/registry'
import { initCharacterAnimator, type AnimatorControls } from '../../characters/animator'
import { sanitizeSvg } from '../../characters/sanitizer'
import { Sparkles, Eye } from 'lucide-react'

interface CharacterStageProps {
  characterId: string
  greetingText?: string
  ambientMood?: 'normal' | 'sleepy' | 'excited'
}

export const CharacterStage: React.FC<CharacterStageProps> = ({
  characterId,
  greetingText,
  ambientMood = 'normal',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const animatorRef = useRef<AnimatorControls | null>(null)
  const character = getCharacter(characterId)
  const [activeView, setActiveView] = useState<'front' | 'side'>('front')
  const [frontSvgContent, setFrontSvgContent] = useState<string>('')
  const [sideSvgContent, setSideSvgContent] = useState<string>('')

  // Load front SVG content (always sanitize even stored SVGs before rendering)
  useEffect(() => {
    let isMounted = true
    fetch(character.svg)
      .then((res) => res.text())
      .then((text) => {
        if (!isMounted) return
        const safe = sanitizeSvg(text)
        setFrontSvgContent(safe.valid ? safe.cleanSvg : '')
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [character.svg])

  // Load side SVG content if multi-view (always sanitize before rendering)
  useEffect(() => {
    let isMounted = true
    if (character.hasMultiView && character.sideSvg) {
      fetch(character.sideSvg)
        .then((res) => res.text())
        .then((text) => {
          if (!isMounted) return
          const safe = sanitizeSvg(text)
          setSideSvgContent(safe.valid ? safe.cleanSvg : '')
        })
        .catch(() => {})
    } else {
      setSideSvgContent('')
      setActiveView('front')
    }
    return () => {
      isMounted = false
    }
  }, [character.hasMultiView, character.sideSvg])

  const currentSvg = activeView === 'side' && sideSvgContent ? sideSvgContent : frontSvgContent

  useEffect(() => {
    if (!containerRef.current || !currentSvg) return

    animatorRef.current = initCharacterAnimator(containerRef.current, {
      characterId,
      isSideView: activeView === 'side',
      onViewChange: (nextView) => {
        if (character.hasMultiView && sideSvgContent) {
          setActiveView(nextView)
        }
      },
    })

    if (ambientMood === 'sleepy') {
      animatorRef.current.playClip('sleep')
    } else if (ambientMood === 'excited') {
      animatorRef.current.playClip('sparkle')
    }

    return () => {
      if (animatorRef.current) {
        animatorRef.current.destroy()
        animatorRef.current = null
      }
    }
  }, [currentSvg, activeView, characterId, character.hasMultiView, sideSvgContent, ambientMood])

  const handleStageTap = () => {
    if (animatorRef.current) {
      animatorRef.current.handleTap()
    }
  }

  const handleToggleView = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveView((prev) => (prev === 'front' ? 'side' : 'front'))
  }

  return (
    <div
      onClick={handleStageTap}
      className="sticker-card p-5 flex flex-col items-center justify-center min-h-[220px] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-bg)] cursor-pointer select-none relative overflow-hidden"
    >
      {/* Multi-view badge and view switcher button */}
      {character.hasMultiView && sideSvgContent && (
        <button
          type="button"
          onClick={handleToggleView}
          title={`Switch to ${activeView === 'front' ? 'side' : 'front'} view`}
          className="absolute top-2.5 right-2.5 z-10 flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[10px] font-bold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:border-[var(--color-accent)] active:scale-95 transition-all shadow-xs"
        >
          <Eye size={12} className="text-[var(--color-accent)]" />
          <span className="capitalize">{activeView} view</span>
        </button>
      )}

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
      {currentSvg ? (
        <div
          ref={containerRef}
          className="w-28 h-28 flex items-center justify-center transition-transform active:scale-95"
          dangerouslySetInnerHTML={{ __html: currentSvg }}
        />
      ) : (
        <div
          ref={containerRef}
          className="w-28 h-28 flex items-center justify-center transition-transform active:scale-95"
        >
          <img
            src={activeView === 'side' && character.sideSvg ? character.sideSvg : character.svg}
            alt={character.name}
            className="w-24 h-24 object-contain"
          />
        </div>
      )}
    </div>
  )
}
