import React, { useState } from 'react'
import { X, Check, Sliders, Hash, Type, Clock, BookOpen, ToggleLeft } from 'lucide-react'
import type { Part, PartKind, PartLevel, PartConfig, Library } from '../../data/types'

interface PartEditorModalProps {
  isOpen: boolean
  part?: Partial<Part>
  questionId: string
  libraries: Library[]
  onSave: (partData: {
    kind: PartKind
    label: string
    level: PartLevel
    gate: boolean
    config: PartConfig
  }) => void
  onClose: () => void
}

const PART_KINDS: { kind: PartKind; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { kind: 'yesno', label: 'Yes / No Checkbox', icon: ToggleLeft },
  { kind: 'scale', label: 'Scale / Rating', icon: Sliders },
  { kind: 'number', label: 'Number with Unit', icon: Hash },
  { kind: 'text', label: 'Text / Journal Note', icon: Type },
  { kind: 'timerange', label: 'Time Range (Hours)', icon: Clock },
  { kind: 'library', label: 'Library Item Tag', icon: BookOpen },
]

export const PartEditorModal: React.FC<PartEditorModalProps> = ({
  isOpen,
  part,
  libraries,
  onSave,
  onClose,
}) => {
  const [kind, setKind] = useState<PartKind>(part?.kind || 'yesno')
  const [label, setLabel] = useState<string>(part?.label || '')
  const [level, setLevel] = useState<PartLevel>(part?.level || 'core')
  const [gate, setGate] = useState<boolean>(part?.gate || false)

  // Config fields
  const [scaleMin, setScaleMin] = useState<number>((part?.config as any)?.min ?? 1)
  const [scaleMax, setScaleMax] = useState<number>((part?.config as any)?.max ?? 10)
  const [scaleStep, setScaleStep] = useState<number>((part?.config as any)?.step ?? 1)
  const [scaleDisplay, setScaleDisplay] = useState<'slider' | 'stars'>((part?.config as any)?.display || 'slider')

  const [numberUnit, setNumberUnit] = useState<string>((part?.config as any)?.unit || '')
  const [numberAggregate, setNumberAggregate] = useState<'sum' | 'mean'>((part?.config as any)?.aggregate || 'sum')

  const [textMultiline, setTextMultiline] = useState<boolean>((part?.config as any)?.multiline ?? false)

  const [libraryId, setLibraryId] = useState<string>(
    (part?.config as any)?.libraryId || libraries[0]?.id || ''
  )
  const [libraryMulti, setLibraryMulti] = useState<boolean>((part?.config as any)?.multi ?? true)
  const [libraryCreatable, setLibraryCreatable] = useState<boolean>((part?.config as any)?.creatable ?? true)

  if (!isOpen) return null

  const handleConfirm = () => {
    if (!label.trim()) return

    let config: PartConfig = {}

    switch (kind) {
      case 'scale':
        config = {
          min: scaleMin,
          max: scaleMax,
          step: scaleStep,
          display: scaleDisplay,
        }
        break
      case 'number':
        config = {
          unit: numberUnit.trim() || undefined,
          aggregate: numberAggregate,
        }
        break
      case 'text':
        config = {
          multiline: textMultiline,
        }
        break
      case 'timerange':
        config = {
          snapMinutes: 15,
        }
        break
      case 'library':
        config = {
          libraryId,
          multi: libraryMulti,
          creatable: libraryCreatable,
        }
        break
      case 'yesno':
      default:
        config = {}
        break
    }

    onSave({
      kind,
      label: label.trim(),
      level,
      gate,
      config,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--color-surface)] w-full max-w-md max-h-[90vh] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b-2 border-[var(--color-line)] flex items-center justify-between shrink-0">
          <h3 className="font-bold text-sm text-[var(--color-ink)]">
            {part?.id ? 'Edit Part' : 'Add New Part'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Label Input */}
          <div className="space-y-1.5">
            <label className="font-bold text-[var(--color-ink)] block">Part Label</label>
            <input
              type="text"
              placeholder="e.g. Mood score, Running distance, Notes..."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full p-2.5 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] font-semibold text-[var(--color-ink)]"
            />
          </div>

          {/* Kind Selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-[var(--color-ink)] block">Input Kind</label>
            <div className="grid grid-cols-2 gap-2">
              {PART_KINDS.map((pk) => {
                const Icon = pk.icon
                const isSelected = kind === pk.kind
                return (
                  <button
                    key={pk.kind}
                    type="button"
                    onClick={() => setKind(pk.kind)}
                    className={`flex items-center space-x-2 p-2.5 rounded-[var(--radius-m)] border-2 text-left transition-all ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-bg)] font-bold text-[var(--color-accent)] shadow-xs'
                        : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]'
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="text-[11px] leading-tight">{pk.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Level: Core vs Extra */}
          <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[var(--color-ink)] block">Requirement Level</span>
                <span className="text-[11px] text-[var(--color-ink-soft)]">
                  Core parts must be filled for day completion.
                </span>
              </div>
              <div className="flex items-center space-x-1 bg-[var(--color-surface)] p-1 rounded-full border border-[var(--color-line)]">
                <button
                  type="button"
                  onClick={() => setLevel('core')}
                  className={`px-3 py-1 rounded-full font-bold text-[10px] transition-all ${
                    level === 'core'
                      ? 'bg-[var(--color-accent)] text-white shadow-xs'
                      : 'text-[var(--color-ink-soft)]'
                  }`}
                >
                  CORE
                </button>
                <button
                  type="button"
                  onClick={() => setLevel('extra')}
                  className={`px-3 py-1 rounded-full font-bold text-[10px] transition-all ${
                    level === 'extra'
                      ? 'bg-[var(--color-ink)] text-white shadow-xs'
                      : 'text-[var(--color-ink-soft)]'
                  }`}
                >
                  EXTRA
                </button>
              </div>
            </div>

            {/* Gate Checkbox */}
            {kind === 'yesno' && (
              <label className="flex items-center space-x-2 pt-2 border-t border-[var(--color-line)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={gate}
                  onChange={(e) => setGate(e.target.checked)}
                  className="rounded text-[var(--color-accent)]"
                />
                <span className="text-[11px] text-[var(--color-ink)] font-semibold">
                  Acts as gate for sibling parts (siblings only required when Yes)
                </span>
              </label>
            )}
          </div>

          {/* Config details based on kind */}
          {kind === 'scale' && (
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2.5">
              <span className="font-bold text-[var(--color-ink)] block">Scale Configuration</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-[var(--color-ink-soft)] block">Min</label>
                  <input
                    type="number"
                    value={scaleMin}
                    onChange={(e) => setScaleMin(Number(e.target.value))}
                    className="w-full p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--color-ink-soft)] block">Max</label>
                  <input
                    type="number"
                    value={scaleMax}
                    onChange={(e) => setScaleMax(Number(e.target.value))}
                    className="w-full p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--color-ink-soft)] block">Step</label>
                  <input
                    type="number"
                    step="0.5"
                    value={scaleStep}
                    onChange={(e) => setScaleStep(Number(e.target.value))}
                    className="w-full p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] text-center font-bold"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3 pt-1">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scaleDisplay"
                    checked={scaleDisplay === 'slider'}
                    onChange={() => setScaleDisplay('slider')}
                  />
                  <span>Slider</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scaleDisplay"
                    checked={scaleDisplay === 'stars'}
                    onChange={() => setScaleDisplay('stars')}
                  />
                  <span>Stars (1-5)</span>
                </label>
              </div>
            </div>
          )}

          {kind === 'number' && (
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2.5">
              <span className="font-bold text-[var(--color-ink)] block">Number Configuration</span>
              <div>
                <label className="text-[10px] text-[var(--color-ink-soft)] block mb-1">
                  Unit (e.g. steps, pages, cups, minutes)
                </label>
                <input
                  type="text"
                  placeholder="e.g. glasses"
                  value={numberUnit}
                  onChange={(e) => setNumberUnit(e.target.value)}
                  className="w-full p-2 rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold"
                />
              </div>
              <div className="flex items-center space-x-4 pt-1">
                <span className="text-[11px] font-semibold text-[var(--color-ink)]">
                  Session Aggregation:
                </span>
                <label className="flex items-center space-x-1 cursor-pointer">
                  <input
                    type="radio"
                    name="numAgg"
                    checked={numberAggregate === 'sum'}
                    onChange={() => setNumberAggregate('sum')}
                  />
                  <span>Sum</span>
                </label>
                <label className="flex items-center space-x-1 cursor-pointer">
                  <input
                    type="radio"
                    name="numAgg"
                    checked={numberAggregate === 'mean'}
                    onChange={() => setNumberAggregate('mean')}
                  />
                  <span>Average</span>
                </label>
              </div>
            </div>
          )}

          {kind === 'text' && (
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)]">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={textMultiline}
                  onChange={(e) => setTextMultiline(e.target.checked)}
                />
                <span className="font-semibold text-[var(--color-ink)]">
                  Allow multi-line paragraph text
                </span>
              </label>
            </div>
          )}

          {kind === 'library' && (
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2.5">
              <span className="font-bold text-[var(--color-ink)] block">Library Tagging</span>
              <div>
                <label className="text-[10px] text-[var(--color-ink-soft)] block mb-1">
                  Select Library
                </label>
                <select
                  value={libraryId}
                  onChange={(e) => setLibraryId(e.target.value)}
                  className="w-full p-2 rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-bold text-[var(--color-ink)]"
                >
                  {libraries.map((lib) => (
                    <option key={lib.id} value={lib.id}>
                      {lib.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={libraryMulti}
                    onChange={(e) => setLibraryMulti(e.target.checked)}
                  />
                  <span>Allow selecting multiple items</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={libraryCreatable}
                    onChange={(e) => setLibraryCreatable(e.target.checked)}
                  />
                  <span>Allow creating new items directly while answering</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-[var(--color-line)] bg-[var(--color-surface)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-[var(--radius-pill)] border border-[var(--color-line)] text-xs font-semibold text-[var(--color-ink-soft)] active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!label.trim()}
            onClick={handleConfirm}
            className="py-2 px-5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button flex items-center space-x-1.5 disabled:opacity-50 active:scale-95"
          >
            <Check size={14} />
            <span>Save Part</span>
          </button>
        </div>
      </div>
    </div>
  )
}
