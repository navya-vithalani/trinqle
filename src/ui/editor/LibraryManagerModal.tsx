import React, { useState, useEffect } from 'react'
import { X, Plus, Edit2, Trash2, GitMerge, BookOpen, Check } from 'lucide-react'
import type { Library, Item } from '../../data/types'
import { LibraryRepository } from '../../data/repositories'
import { LIMITS } from '../../core/limits'

interface LibraryManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

export const LibraryManagerModal: React.FC<LibraryManagerModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [libraries, setLibraries] = useState<Library[]>([])
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])

  // Input states
  const [newItemName, setNewItemName] = useState('')
  const [newLibraryName, setNewLibraryName] = useState('')
  const [isAddingLibrary, setIsAddingLibrary] = useState(false)

  // Edit / Merge states
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemName, setEditingItemName] = useState('')

  const [mergingSourceItem, setMergingSourceItem] = useState<Item | null>(null)
  const [mergeTargetItemId, setMergeTargetItemId] = useState<string>('')

  const libRepo = new LibraryRepository()

  const loadLibraries = async () => {
    const libs = await libRepo.getLibraries()
    setLibraries(libs)
    if (libs.length > 0 && !selectedLibraryId) {
      setSelectedLibraryId(libs[0].id)
    }
  }

  const loadItems = async (libId: string) => {
    if (!libId) return
    const itms = await libRepo.getItems(libId)
    setItems(itms)
  }

  useEffect(() => {
    if (isOpen) {
      loadLibraries()
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedLibraryId) {
      loadItems(selectedLibraryId)
    }
  }, [selectedLibraryId])

  if (!isOpen) return null

  const handleCreateLibrary = async () => {
    if (!newLibraryName.trim()) return
    const created = await libRepo.createLibrary(newLibraryName.trim())
    setNewLibraryName('')
    setIsAddingLibrary(false)
    await loadLibraries()
    setSelectedLibraryId(created.id)
    onUpdated()
  }

  const handleCreateItem = async () => {
    if (!newItemName.trim() || !selectedLibraryId) return
    await libRepo.createItem(selectedLibraryId, newItemName.trim())
    setNewItemName('')
    await loadItems(selectedLibraryId)
    onUpdated()
  }

  const handleRenameItem = async (itemId: string) => {
    if (!editingItemName.trim()) return
    await libRepo.renameItem(itemId, editingItemName.trim())
    setEditingItemId(null)
    setEditingItemName('')
    await loadItems(selectedLibraryId)
    onUpdated()
  }

  const handleRetireItem = async (itemId: string) => {
    await libRepo.retireItem(itemId)
    await loadItems(selectedLibraryId)
    onUpdated()
  }

  const handleConfirmMerge = async () => {
    if (!mergingSourceItem || !mergeTargetItemId || !selectedLibraryId) return
    await libRepo.mergeItems(selectedLibraryId, mergingSourceItem.id, mergeTargetItemId)
    setMergingSourceItem(null)
    setMergeTargetItemId('')
    await loadItems(selectedLibraryId)
    onUpdated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--color-surface)] w-full max-w-lg max-h-[90vh] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="p-4 border-b-2 border-[var(--color-line)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <BookOpen size={18} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">Library Manager</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Library Selector Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--color-ink)] uppercase tracking-wider text-[11px]">
                Libraries
              </span>
              <button
                type="button"
                onClick={() => setIsAddingLibrary(true)}
                className="flex items-center space-x-1 text-[11px] font-bold text-[var(--color-accent)] active:scale-95"
              >
                <Plus size={13} />
                <span>New Library</span>
              </button>
            </div>

            {isAddingLibrary && (
              <div className="flex items-center space-x-2 p-2 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)]">
                <input
                  type="text"
                  maxLength={LIMITS.LIBRARY_NAME}
                  placeholder="Library name (e.g. Topics, Books)..."
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  className="flex-1 p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold"
                />
                <button
                  type="button"
                  onClick={handleCreateLibrary}
                  className="py-1 px-3 rounded-full bg-[var(--color-accent)] text-white font-bold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingLibrary(false)}
                  className="py-1 px-2 text-[var(--color-ink-soft)]"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              {libraries.map((lib) => {
                const isSelected = selectedLibraryId === lib.id
                return (
                  <button
                    key={lib.id}
                    type="button"
                    onClick={() => setSelectedLibraryId(lib.id)}
                    className={`py-1.5 px-3 rounded-full font-bold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-[var(--color-accent)] text-white shadow-xs'
                        : 'bg-[var(--color-bg)] text-[var(--color-ink-soft)] border border-[var(--color-line)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {lib.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Merge Dialog Overlay */}
          {mergingSourceItem && (
            <div className="p-3.5 rounded-[var(--radius-m)] bg-purple-50 border-2 border-purple-200 text-purple-950 space-y-2.5 animate-in fade-in">
              <div className="flex items-center space-x-2 font-bold text-xs">
                <GitMerge size={16} className="text-purple-700" />
                <span>Merge "{mergingSourceItem.name}"</span>
              </div>
              <p className="text-[11px] text-purple-800">
                All historical logs and answer links referencing "{mergingSourceItem.name}" will be rewritten to the chosen target item.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-purple-900 block">
                  Select Target Item to Merge Into:
                </label>
                <select
                  value={mergeTargetItemId}
                  onChange={(e) => setMergeTargetItemId(e.target.value)}
                  className="w-full p-2 rounded border border-purple-300 bg-white font-bold"
                >
                  <option value="">-- Choose item --</option>
                  {items
                    .filter((i) => i.id !== mergingSourceItem.id)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMergingSourceItem(null)}
                  className="py-1 px-3 rounded-full border border-purple-300 bg-white text-purple-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!mergeTargetItemId}
                  onClick={handleConfirmMerge}
                  className="py-1 px-4 rounded-full bg-purple-700 text-white font-bold disabled:opacity-50"
                >
                  Execute Merge
                </button>
              </div>
            </div>
          )}

          {/* Items List in Selected Library */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                maxLength={LIMITS.LIBRARY_ITEM_NAME}
                placeholder="Add new item (e.g. Running, Python, Latte)..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()}
                className="flex-1 p-2 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] font-semibold text-[var(--color-ink)]"
              />
              <button
                type="button"
                disabled={!newItemName.trim()}
                onClick={handleCreateItem}
                className="py-2 px-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold sticker-button flex items-center space-x-1 disabled:opacity-50 active:scale-95 shrink-0"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>

            <div className="divide-y divide-[var(--color-line)] border-2 border-[var(--color-line)] rounded-[var(--radius-m)] bg-[var(--color-surface)] overflow-hidden">
              {items.map((item) => {
                const isEditing = editingItemId === item.id
                return (
                  <div
                    key={item.id}
                    className="p-2.5 flex items-center justify-between hover:bg-[var(--color-bg)]/40 transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex items-center space-x-2 flex-1 mr-2">
                        <input
                          type="text"
                          maxLength={LIMITS.LIBRARY_ITEM_NAME}
                          value={editingItemName}
                          onChange={(e) => setEditingItemName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameItem(item.id)}
                          className="flex-1 p-1 rounded border border-[var(--color-line)] bg-[var(--color-bg)] font-bold text-[var(--color-ink)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameItem(item.id)}
                          className="p-1 rounded bg-[var(--color-accent)] text-white"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="p-1 text-[var(--color-ink-soft)]"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="font-semibold text-[var(--color-ink)] text-xs">
                        {item.name}
                      </span>
                    )}

                    {!isEditing && (
                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Merge */}
                        <button
                          type="button"
                          onClick={() => {
                            setMergingSourceItem(item)
                            setMergeTargetItemId('')
                          }}
                          className="p-1 text-[var(--color-ink-soft)] hover:text-purple-600 active:scale-90"
                          title="Merge into another item..."
                        >
                          <GitMerge size={14} />
                        </button>
                        {/* Edit Rename */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(item.id)
                            setEditingItemName(item.name)
                          }}
                          className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] active:scale-90"
                          title="Rename"
                        >
                          <Edit2 size={14} />
                        </button>
                        {/* Retire */}
                        <button
                          type="button"
                          onClick={() => handleRetireItem(item.id)}
                          className="p-1 text-[var(--color-ink-soft)] hover:text-rose-600 active:scale-90"
                          title="Retire item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {items.length === 0 && (
                <div className="p-6 text-center text-xs text-[var(--color-ink-soft)]">
                  No items in this library yet. Type above to add one.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-[var(--color-line)] bg-[var(--color-surface)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-5 rounded-[var(--radius-pill)] bg-[var(--color-ink)] text-white font-bold text-xs active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
