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

// Order: Archive -> Dashboard -> Home -> Insights -> Profile
const NAV_ITEMS: NavItem[] = [
  { id: 'archive', label: 'Archive', icon: BookOpen },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'insights', label: 'Insights', icon: Sparkles },
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
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2 relative">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          const isHome = item.id === 'home'

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-transform duration-150"
              style={{
                color: isActive
                  ? isHome
                    ? 'var(--tab-home-active-color, var(--color-accent))'
                    : 'var(--color-accent)'
                  : isHome
                    ? 'var(--tab-home-inactive-color, var(--color-ink-soft))'
                    : 'var(--color-ink-soft)',
                transform: isHome
                  ? 'translateY(var(--tab-home-lift, 0px))'
                  : isActive
                    ? 'translateY(-2px)'
                    : 'none',
              }}
              aria-label={item.label}
              aria-selected={isActive}
            >
              <div
                className={`p-1 transition-transform duration-200 ${
                  isActive ? 'scale-110' : 'scale-100'
                }`}
                style={{
                  borderRadius: isHome ? 'var(--tab-home-radius, 9999px)' : '9999px',
                  backgroundColor: isHome
                    ? isActive
                      ? 'var(--tab-home-active-bg, var(--color-bg))'
                      : 'var(--tab-home-bg, transparent)'
                    : isActive
                      ? 'var(--color-bg)'
                      : 'transparent',
                  boxShadow: isHome ? 'var(--tab-home-shadow, none)' : 'none',
                }}
              >
                <Icon size={isHome ? 24 : 22} />
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
