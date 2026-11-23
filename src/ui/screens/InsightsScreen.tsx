import React from 'react'
import { Sparkles } from 'lucide-react'

export const InsightsScreen: React.FC = () => {
  return (
    <div className="space-y-4 pb-20">
      <div className="sticker-card p-6 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-accent3)]">
          <Sparkles size={24} />
        </div>
        <h2 className="text-base font-bold text-[var(--color-ink)]">Insights</h2>
        <p className="text-xs text-[var(--color-ink-soft)] max-w-xs mx-auto">
          No runs yet. Fill a few nights and hit Generate to see statistical driver-outcome correlations and streak records.
        </p>
      </div>
    </div>
  )
}
