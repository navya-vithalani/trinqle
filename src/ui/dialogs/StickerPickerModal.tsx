import React from 'react'
import { X, Check } from 'lucide-react'
import { BUILTIN_STICKERS, type StickerItem } from '../../core/stickers'

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
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] p-4 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[var(--color-ink)]">Choose a sticker</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-bg)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
          {BUILTIN_STICKERS.map((s: StickerItem) => {
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
