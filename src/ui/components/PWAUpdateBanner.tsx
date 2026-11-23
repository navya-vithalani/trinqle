import React, { useState, useEffect } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { registerSW } from 'virtual:pwa-register'

export const PWAUpdateBanner: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateFunction, setUpdateFunction] = useState<(() => Promise<void>) | null>(null)

  useEffect(() => {
    try {
      const updateSW = registerSW({
        onNeedRefresh() {
          setNeedRefresh(true)
        },
        onOfflineReady() {
          // Ready offline
        },
      })
      setUpdateFunction(() => async () => {
        await updateSW(true)
      })
    } catch {
      // Ignore if not supported in dev
    }
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
