import React, { useState } from 'react'
import { Folder, Tag, ChevronRight } from 'lucide-react'
import type { Library, Item, AnswerLink, Day, Question, Part } from '../../data/types'
import { ItemHistoryModal } from './ItemHistoryModal'
import type { ItemDayAppearance } from '../../core/metrics/types'

interface LibrariesListViewProps {
  libraries: Library[]
  items: Item[]
  answerLinks: AnswerLink[]
  days: Day[]
  questions: Question[]
  parts: Part[]
  searchQuery: string
  onNavigateToDay?: (date: string) => void
}

export const LibrariesListView: React.FC<LibrariesListViewProps> = ({
  libraries,
  items,
  answerLinks,
  days,
  questions,
  parts,
  searchQuery,
  onNavigateToDay,
}) => {
  const [selectedItem, setSelectedItem] = useState<{
    item: Item
    library: Library
    totalUses: number
    firstUsed: string
    lastUsed: string
    dayAppearances: ItemDayAppearance[]
  } | null>(null)

  const [expandedLibId, setExpandedLibId] = useState<string | null>(null)

  // Quick lookups
  const dayMap = new Map<string, Day>()
  days.forEach((d) => dayMap.set(d.date, d))

  const qMap = new Map<string, Question>()
  questions.forEach((q) => qMap.set(q.id, q))

  const pMap = new Map<string, Part>()
  parts.forEach((p) => pMap.set(p.id, p))

  // Aggregate item usage based on answerLinks
  const linksByItemId = new Map<string, AnswerLink[]>()
  for (const link of answerLinks) {
    if (!link.itemId) continue
    const arr = linksByItemId.get(link.itemId) || []
    arr.push(link)
    linksByItemId.set(link.itemId, arr)
  }

  // Items grouped by library
  const itemsByLibId = new Map<string, Item[]>()
  for (const it of items) {
    if (it.retired || it.mergedInto) continue
    const arr = itemsByLibId.get(it.libraryId) || []
    arr.push(it)
    itemsByLibId.set(it.libraryId, arr)
  }

  const handleOpenItem = (item: Item, lib: Library) => {
    const links = linksByItemId.get(item.id) || []
    const dates = Array.from(new Set(links.map((l) => l.date))).sort()
    const firstUsed = dates[0] || ''
    const lastUsed = dates[dates.length - 1] || ''

    const appearances: ItemDayAppearance[] = []
    const seenDayLink = new Set<string>()

    for (const link of links) {
      const day = dayMap.get(link.date)
      const key = `${link.date}`
      if (seenDayLink.has(key)) continue
      seenDayLink.add(key)

      appearances.push({
        date: link.date,
        dayTitle: day?.title,
        questionLabel: 'Tagged activity',
        partLabel: lib.name,
        mode: day?.mode || 'full',
        rating: day?.overallRating,
      })
    }

    appearances.sort((a, b) => b.date.localeCompare(a.date))

    setSelectedItem({
      item,
      library: lib,
      totalUses: links.length,
      firstUsed,
      lastUsed,
      dayAppearances: appearances,
    })
  }

  const queryClean = searchQuery.toLowerCase().trim()

  return (
    <div className="space-y-4">
      {libraries.map((lib) => {
        let libItems = itemsByLibId.get(lib.id) || []
        if (queryClean) {
          libItems = libItems.filter((i) => i.name.toLowerCase().includes(queryClean))
        }

        // Sort items by usage count descending
        libItems.sort((a, b) => {
          const countA = linksByItemId.get(a.id)?.length || 0
          const countB = linksByItemId.get(b.id)?.length || 0
          return countB - countA
        })

        if (queryClean && libItems.length === 0) {
          return null
        }

        const isExpanded = expandedLibId === null || expandedLibId === lib.id
        const totalLibUses = libItems.reduce(
          (acc, it) => acc + (linksByItemId.get(it.id)?.length || 0),
          0
        )

        return (
          <div key={lib.id} className="sticker-card p-4 space-y-3">
            <div
              onClick={() => setExpandedLibId(isExpanded && expandedLibId === lib.id ? 'NONE' : lib.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-accent)]">
                  <Folder size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-ink)]">{lib.name}</h3>
                  <span className="text-[10px] text-[var(--color-ink-soft)]">
                    {libItems.length} items • {totalLibUses} logged uses
                  </span>
                </div>
              </div>
              <ChevronRight
                size={16}
                className={`text-[var(--color-ink-soft)] transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            </div>

            {/* Items list */}
            {isExpanded && (
              <div className="space-y-1.5 pt-2 border-t border-[var(--color-line)]/50">
                {libItems.length === 0 ? (
                  <div className="text-xs text-[var(--color-ink-soft)] py-2 text-center">
                    No items found in this library.
                  </div>
                ) : (
                  libItems.map((item) => {
                    const links = linksByItemId.get(item.id) || []
                    const dates = Array.from(new Set(links.map((l) => l.date))).sort()
                    const lastUsed = dates[dates.length - 1]

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleOpenItem(item, lib)}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-line)]/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Tag size={13} className="text-[var(--color-accent)]" />
                          <span className="text-xs font-semibold text-[var(--color-ink)]">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <div className="text-[10px]">
                            <span className="font-bold text-[var(--color-ink)]">
                              {links.length} {links.length === 1 ? 'use' : 'uses'}
                            </span>
                            {lastUsed && (
                              <span className="text-[var(--color-ink-soft)] ml-1.5">
                                (last: {lastUsed.slice(5)})
                              </span>
                            )}
                          </div>
                          <ChevronRight size={13} className="text-[var(--color-ink-soft)]" />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Item Day History Modal */}
      {selectedItem && (
        <ItemHistoryModal
          isOpen={true}
          itemName={selectedItem.item.name}
          libraryName={selectedItem.library.name}
          totalUses={selectedItem.totalUses}
          firstUsed={selectedItem.firstUsed}
          lastUsed={selectedItem.lastUsed}
          days={selectedItem.dayAppearances}
          onClose={() => setSelectedItem(null)}
          onNavigateToDay={onNavigateToDay}
        />
      )}
    </div>
  )
}
