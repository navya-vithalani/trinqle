import React, { useState, useEffect } from 'react'
import { Plus, Check } from 'lucide-react'
import type { LibraryConfig, Item } from '../../data/types'
import { LibraryRepository } from '../../data/repositories'

interface LibraryWidgetProps {
  label: string
  value: string | string[] | undefined
  config?: LibraryConfig
  onChange: (val: string | string[]) => void
  disabled?: boolean
}

export const LibraryWidget: React.FC<LibraryWidgetProps> = ({
  label,
  value,
  config,
  onChange,
  disabled,
}) => {
  const libraryId = config?.libraryId || ''
  const isMulti = config?.multi ?? false
  const isCreatable = config?.creatable ?? true

  const [items, setItems] = useState<Item[]>([])
  const [search, setSearch] = useState('')
  const libRepo = new LibraryRepository()

  useEffect(() => {
    if (!libraryId) return
    libRepo.getItems(libraryId).then(setItems)
  }, [libraryId])

  const selectedList: string[] = Array.isArray(value)
    ? value
    : value
      ? [value]
      : []

  const toggleItem = (name: string) => {
    if (disabled) return

    if (isMulti) {
      if (selectedList.includes(name)) {
        onChange(selectedList.filter((n) => n !== name))
      } else {
        onChange([...selectedList, name])
      }
    } else {
      if (selectedList.includes(name)) {
        onChange('')
      } else {
        onChange(name)
      }
    }
  }

  const handleCreate = async () => {
    const trimmed = search.trim()
    if (!trimmed || !libraryId) return

    const newItem = await libRepo.createItem(libraryId, trimmed)
    setItems((prev) => [...prev, newItem])
    toggleItem(trimmed)
    setSearch('')
  }

  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  const exactMatchExists = items.some(
    (i) => i.name.toLowerCase() === search.trim().toLowerCase()
  )

  return (
    <div className="py-2.5 space-y-2">
      <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>

      {/* Search & Create row */}
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={search}
          disabled={disabled}
          placeholder="Search or add..."
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (!exactMatchExists && search.trim()) {
                handleCreate()
              }
            }
          }}
          className="flex-1 text-xs py-1.5 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        {isCreatable && search.trim() && !exactMatchExists && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleCreate}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-pill)] bg-[var(--color-accent2)] text-[var(--color-ink)] active:scale-95"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Chips Cloud */}
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
        {filteredItems.map((item) => {
          const isSelected = selectedList.includes(item.name)
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => toggleItem(item.name)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-medium border transition-all ${
                isSelected
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white font-semibold'
                  : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink-soft)]'
              }`}
            >
              {isSelected && <Check size={12} />}
              <span>{item.name}</span>
            </button>
          )
        })}
        {filteredItems.length === 0 && !search.trim() && (
          <span className="text-xs text-[var(--color-ink-soft)] italic py-1">
            No items yet. Type to create one.
          </span>
        )}
      </div>
    </div>
  )
}
