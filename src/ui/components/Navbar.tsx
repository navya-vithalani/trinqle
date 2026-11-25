import React, { useState, useEffect } from 'react'
import {
  Home,
  LayoutDashboard,
  Sparkles,
  BookOpen,
  User,
  // Sports Theme Icons
  Trophy,
  Timer,
  Flame,
  Medal,
  Dumbbell,
  // Royal Theme Icons
  Crown,
  Gem,
  Shield,
  // Newspaper Theme Icons
  Newspaper,
  FileSpreadsheet,
  TrendingUp,
  Archive,
  PenTool,
  // Retro Pixel Theme Icons
  Monitor,
  Terminal,
  Radio,
  HardDrive,
  Cpu,
} from 'lucide-react'
import type { TabId } from '../types'
import { loadThemePreference } from '../../themes/registry'

interface NavbarProps {
  activeTab: TabId
  onSelectTab: (tab: TabId) => void
}

interface NavItemDef {
  id: TabId
  label: string
}

// Order: Archive -> Dashboard -> Home -> Insights -> Profile
const NAV_ITEM_DEFS: NavItemDef[] = [
  { id: 'archive', label: 'Archive' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'home', label: 'Home' },
  { id: 'insights', label: 'Insights' },
  { id: 'profile', label: 'Profile' },
]

function getNavIcon(tabId: TabId, themeId: string): React.ComponentType<{ size?: number; className?: string }> {
  if (themeId === 'sports') {
    switch (tabId) {
      case 'home': return Trophy
      case 'dashboard': return Timer
      case 'insights': return Flame
      case 'archive': return Medal
      case 'profile': return Dumbbell
    }
  }
  if (themeId === 'royal') {
    switch (tabId) {
      case 'home': return Crown
      case 'dashboard': return Gem
      case 'insights': return Sparkles
      case 'archive': return BookOpen
      case 'profile': return Shield
    }
  }
  if (themeId === 'newspaper') {
    switch (tabId) {
      case 'home': return Newspaper
      case 'dashboard': return FileSpreadsheet
      case 'insights': return TrendingUp
      case 'archive': return Archive
      case 'profile': return PenTool
    }
  }
  if (themeId === 'retro') {
    switch (tabId) {
      case 'home': return Monitor
      case 'dashboard': return Terminal
      case 'insights': return Radio
      case 'archive': return HardDrive
      case 'profile': return Cpu
    }
  }
  switch (tabId) {
    case 'home': return Home
    case 'dashboard': return LayoutDashboard
    case 'insights': return Sparkles
    case 'archive': return BookOpen
    case 'profile': return User
  }
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || loadThemePreference().themeId
    }
    return 'cutesy'
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    const updateTheme = () => {
      const t = document.documentElement.getAttribute('data-theme') || loadThemePreference().themeId
      setCurrentTheme(t)
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--color-surface)] border-t-2 border-[var(--color-line)] pb-[env(safe-area-inset-bottom)]"
      style={{
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.03)',
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2 relative">
        {NAV_ITEM_DEFS.map((item) => {
          const Icon = getNavIcon(item.id, currentTheme)
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
