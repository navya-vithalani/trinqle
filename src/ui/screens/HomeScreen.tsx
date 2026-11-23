import React from 'react'
import { Sparkles, FileText, PlusCircle, Clock } from 'lucide-react'
import catSvg from '../../characters/white-cat/character.svg'

export const HomeScreen: React.FC = () => {
  return (
    <div className="space-y-4 pb-20">
      {/* Chapter Countdown / Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface)] rounded-[var(--radius-m)] border-2 border-[var(--color-line)] text-xs font-medium text-[var(--color-ink-soft)]">
        <span>Chapter 1</span>
        <span>Day 1 of 28</span>
        <span className="text-[var(--color-accent)] font-semibold">27 days left</span>
      </div>

      {/* Tonight Card Placeholder */}
      <div className="sticker-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock size={18} className="text-[var(--color-accent)]" />
            <h3 className="font-semibold text-sm">Tonight's journal</h3>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--color-bg)] text-[var(--color-ink-soft)] border border-[var(--color-line)]">
            Opens at 9 pm
          </span>
        </div>
        <p className="text-xs text-[var(--color-ink-soft)]">
          Form window is 21:00 to 03:00. Preview or customize in Profile.
        </p>
      </div>

      {/* Character Stage Placeholder */}
      <div className="sticker-card p-6 flex flex-col items-center justify-center min-h-[180px] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-bg)]">
        <div className="w-24 h-24 mb-2 flex items-center justify-center rounded-full bg-[var(--color-line)]/50">
          <img
            src={catSvg}
            alt="Piqsie the Cat"
            className="w-20 h-20 object-contain hover:scale-105 transition-transform"
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Piqsie</p>
          <p className="text-xs text-[var(--color-ink-soft)]">Quietly stretching and watching</p>
        </div>
      </div>

      {/* Empty State / Getting Started Panel */}
      <div className="sticker-card p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-[var(--color-ink)]">Get started</h2>
          <p className="text-xs text-[var(--color-ink-soft)] mt-1">
            Build your personalized journal form or start with our disposable pack.
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium text-sm sticker-button"
          >
            <Sparkles size={16} />
            <span>Use sample starter pack</span>
          </button>

          <button
            type="button"
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-[var(--color-ink)] font-medium text-sm"
          >
            <FileText size={16} className="text-[var(--color-accent3)]" />
            <span>Import a form pack</span>
          </button>

          <button
            type="button"
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-[var(--color-ink)] font-medium text-sm"
          >
            <PlusCircle size={16} className="text-[var(--color-accent2)]" />
            <span>Build one from scratch</span>
          </button>
        </div>
      </div>
    </div>
  )
}
