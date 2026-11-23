import React from 'react'
import { BookOpen } from 'lucide-react'

export const ArchiveScreen: React.FC = () => {
  return (
    <div className="space-y-4 pb-20">
      <div className="sticker-card p-6 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-accent2)]">
          <BookOpen size={24} />
        </div>
        <h2 className="text-base font-bold text-[var(--color-ink)]">Archive</h2>
        <p className="text-xs text-[var(--color-ink-soft)] max-w-xs mx-auto">
          No closed chapters yet. When chapter 1 closes, it will be frozen and safely preserved here in monochrome archive mode.
        </p>
      </div>
    </div>
  )
}
