import React, { useState, useEffect } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'

export const PWAUpdateBanner: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateFunction, setUpdateFunction] = useState<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Dynamic import to prevent crash if virtual module is unavailable in dev/test
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          onNeedRefresh() {
            setNeedRefresh(true)
          },
          onOfflineReady() {
            // Service worker ready
          },
        })
        setUpdateFunction(() => async () => {
          await updateSW(true)
        })
      })
      .catch(() => {
        // PWA virtual module not present in dev mode
      })
  }, [])

  if (!needRefresh) return null

  return (
    <div className="sticky top-0 z-50 bg-[var(--color-accent)] text-white px-4 py-2.5 flex items-center justify-between shadow-md text-xs font-semibold animate-bounce-in">
      <div className="flex items-center space-x-2">
        <Sparkles size={16} className="animate-spin text-white" />
        <span>New deployment available!</span>
      </div>
      <button
        type="button"
        onClick={() => updateFunction && updateFunction()}
        className="flex items-center space-x-1.5 px-3 py-1 bg-white text-[var(--color-ink)] rounded-full text-[11px] font-bold active:scale-95 shadow-xs"
      >
        <RefreshCw size={12} className="text-[var(--color-accent)]" />
        <span>Reload app</span>
      </button>
    </div>
  )
}
