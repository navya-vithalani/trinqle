import React from 'react'
import { Home, LayoutDashboard, Sparkles, BookOpen, User } from 'lucide-react'
import type { TabId } from '../types'

interface NavbarProps {
  activeTab: TabId
  onSelectTab: (tab: TabId) => void
}

interface NavItem {
  id: TabId
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'insights', label: 'Insights', icon: Sparkles },
  { id: 'archive', label: 'Archive', icon: BookOpen },
  { id: 'profile', label: 'Profile', icon: User },
]

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--color-surface)] border-t-2 border-[var(--color-line)] pb-[env(safe-area-inset-bottom)]"
      style={{
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.03)',
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-transform duration-150"
              style={{
                color: isActive ? 'var(--color-accent)' : 'var(--color-ink-soft)',
                transform: isActive ? 'translateY(-2px)' : 'none',
              }}
              aria-label={item.label}
              aria-selected={isActive}
            >
              <div
                className={`p-1 rounded-full transition-transform duration-200 ${
                  isActive ? 'scale-110' : 'scale-100'
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--color-bg)' : 'transparent',
                }}
              >
                <Icon size={22} />
              </div>
              <span
                className={`text-[11px] font-medium tracking-tight mt-0.5 ${
                  isActive ? 'font-semibold' : ''
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
