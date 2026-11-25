import React, { useState, useEffect } from 'react'
import { X, Check, Upload } from 'lucide-react'
import {
  BUILTIN_STICKERS,
  loadCustomStickerItems,
  saveCustomStickerFromFile,
  type StickerItem,
} from '../../core/stickers'

interface StickerPickerModalProps {
  isOpen: boolean
  onClose: () => void
  selectedStickerId?: string
  onSelectSticker: (stickerId: string) => void
}

export const StickerPickerModal: React.FC<StickerPickerModalProps> = ({
  isOpen,
  onClose,
  selectedStickerId,
  onSelectSticker,
}) => {
  const [customStickers, setCustomStickers] = useState<StickerItem[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadCustomStickerItems().then(setCustomStickers).catch(() => {})
    }
  }, [isOpen])

  if (!isOpen) return null

  const allStickers = [...BUILTIN_STICKERS, ...customStickers]

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErrorMsg(null)
    try {
      const item = await saveCustomStickerFromFile(file)
      setCustomStickers((prev) => [...prev, item])
      onSelectSticker(item.id)
      onClose()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not import sticker')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] p-4 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[var(--color-ink)]">Choose a sticker</h3>
          <div className="flex items-center gap-1.5">
            <label className="px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[11px] font-semibold text-[var(--color-accent)] flex items-center gap-1 cursor-pointer active:scale-95">
              <Upload size={11} />
              <span>Add</span>
              <input
                type="file"
                accept=".svg,image/*"
                className="hidden"
                onChange={handleUpload}
              />
            </label>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-bg)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <p className="text-[11px] text-rose-600 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
            {errorMsg}
          </p>
        )}

        <div className="grid grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
          {allStickers.map((s: StickerItem) => {
            const isSelected = selectedStickerId === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelectSticker(s.id)
                  onClose()
                }}
                className={`flex flex-col items-center justify-center p-2 rounded-[var(--radius-m)] border-2 transition-transform active:scale-95 relative ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-bg)]'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-ink-soft)]'
                }`}
              >
                <img src={s.url} alt={s.name} className="w-10 h-10 object-contain" />
                <span className="text-[10px] text-[var(--color-ink-soft)] mt-1 truncate max-w-full">
                  {s.name}
                </span>
                {isSelected && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-[10px]">
                    <Check size={10} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
