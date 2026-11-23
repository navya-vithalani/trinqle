import React from 'react'
import { LayoutDashboard } from 'lucide-react'

export const DashboardScreen: React.FC = () => {
  return (
    <div className="space-y-4 pb-20">
      <div className="sticker-card p-6 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-accent)]">
          <LayoutDashboard size={24} />
        </div>
        <h2 className="text-base font-bold text-[var(--color-ink)]">Dashboard</h2>
        <p className="text-xs text-[var(--color-ink-soft)] max-w-xs mx-auto">
          No entries yet. Graphs, streaks, and category breakdowns will appear here once you fill tonight's form.
        </p>
      </div>
    </div>
  )
}
