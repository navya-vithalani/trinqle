import React, { useState, useEffect, useRef } from 'react'
import { Plus, X, ChevronDown, Check } from 'lucide-react'
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
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const libRepo = new LibraryRepository()

  useEffect(() => {
    if (!libraryId) return
    libRepo.getItems(libraryId).then(setItems)
  }, [libraryId])

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

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
      onChange(name)
      setIsOpen(false)
    }
    setSearch('')
  }

  const removeItem = (name: string) => {
    if (disabled) return
    if (isMulti) {
      onChange(selectedList.filter((n) => n !== name))
    } else {
      onChange('')
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
    <div className="py-2.5 space-y-1.5" ref={containerRef}>
      <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>

      {/* Selected Items Chips (only show what is currently picked) */}
      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {selectedList.map((itemName) => (
            <span
              key={itemName}
              className="inline-flex items-center space-x-1 py-1 px-2.5 rounded-full bg-[var(--color-accent)] text-white text-xs font-semibold shadow-xs"
            >
              <span>{itemName}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  removeItem(itemName)
                }}
                className="hover:opacity-80"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input container with dropdown trigger */}
      <div className="relative">
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className="flex items-center border-2 border-[var(--color-line)] rounded-[var(--radius-pill)] bg-[var(--color-bg)] px-3 py-1.5 focus-within:border-[var(--color-accent)] cursor-pointer"
        >
          <input
            type="text"
            value={search}
            disabled={disabled}
            placeholder={selectedList.length === 0 ? 'Select or type to add...' : 'Add more...'}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value)
              setIsOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!exactMatchExists && search.trim() && isCreatable) {
                  handleCreate()
                } else if (filteredItems.length > 0) {
                  toggleItem(filteredItems[0].name)
                }
              }
            }}
            className="flex-1 text-xs bg-transparent text-[var(--color-ink)] focus:outline-none"
          />
          <ChevronDown size={14} className="text-[var(--color-ink-soft)] shrink-0" />
        </div>

        {/* Floating Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[var(--color-surface)] border-2 border-[var(--color-line)] rounded-[var(--radius-m)] shadow-xl max-h-48 overflow-y-auto divide-y divide-[var(--color-line)]">
            {isCreatable && search.trim() && !exactMatchExists && (
              <button
                type="button"
                onClick={handleCreate}
                className="w-full text-left p-2.5 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-bg)] flex items-center space-x-1.5"
              >
                <Plus size={14} />
                <span>Create "{search.trim()}"</span>
              </button>
            )}

            {filteredItems.map((item) => {
              const isSelected = selectedList.includes(item.name)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.name)}
                  className={`w-full text-left p-2.5 text-xs font-medium flex items-center justify-between hover:bg-[var(--color-bg)] transition-colors ${
                    isSelected ? 'font-bold text-[var(--color-accent)]' : 'text-[var(--color-ink)]'
                  }`}
                >
                  <span>{item.name}</span>
                  {isSelected && <Check size={14} />}
                </button>
              )
            })}

            {filteredItems.length === 0 && (!isCreatable || !search.trim()) && (
              <div className="p-3 text-xs text-[var(--color-ink-soft)] text-center italic">
                No items found. Type to add one.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
