import React, { useState } from 'react'
import {
  X,
  Check,
  Sliders,
  Hash,
  Type,
  Clock,
  BookOpen,
  ToggleLeft,
  Flame,
  Zap,
  Heart,
  Smile,
  Battery,
  Activity,
  Sparkles,
  Star,
  Sun,
  Award,
} from 'lucide-react'
import type { Part, PartKind, PartLevel, PartConfig, Library } from '../../data/types'

interface PartEditorModalProps {
  isOpen: boolean
  part?: Partial<Part>
  questionId: string
  libraries: Library[]
  onSave: (partData: {
    questionId: string
    kind: PartKind
    label: string
    level: PartLevel
    gate: boolean
    config: PartConfig
  }) => void
  onClose: () => void
}

const PART_KINDS: {
  kind: PartKind
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}[] = [
  { kind: 'yesno', label: 'Yes / No Checkbox', icon: ToggleLeft },
  { kind: 'scale', label: 'Scale / Rating', icon: Sliders },
  { kind: 'number', label: 'Number with Unit', icon: Hash },
  { kind: 'text', label: 'Text / Journal Note', icon: Type },
  { kind: 'timerange', label: 'Time Range (Hours)', icon: Clock },
  { kind: 'library', label: 'Library Item Tag', icon: BookOpen },
]

const SCALE_ICONS_LIST = [
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Flame', icon: Flame },
  { name: 'Zap', icon: Zap },
  { name: 'Heart', icon: Heart },
  { name: 'Smile', icon: Smile },
  { name: 'Battery', icon: Battery },
  { name: 'Activity', icon: Activity },
  { name: 'Star', icon: Star },
  { name: 'Sun', icon: Sun },
  { name: 'Award', icon: Award },
]

export const PartEditorModal: React.FC<PartEditorModalProps> = ({
  isOpen,
  part,
  questionId,
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
  const [scaleDisplay, setScaleDisplay] = useState<'slider' | 'stars'>(
    (part?.config as any)?.display || 'slider'
  )
  const [scaleIcon, setScaleIcon] = useState<string>(
    (part?.config as any)?.icon || 'Sparkles'
  )

  const [numberUnit, setNumberUnit] = useState<string>((part?.config as any)?.unit || '')
  const [numberAggregate, setNumberAggregate] = useState<'sum' | 'mean'>(
    (part?.config as any)?.aggregate || 'sum'
  )

  const [textMultiline, setTextMultiline] = useState<boolean>(
    (part?.config as any)?.multiline ?? false
  )

  const [libraryId, setLibraryId] = useState<string>(
    (part?.config as any)?.libraryId || libraries[0]?.id || ''
  )
  const [libraryMulti, setLibraryMulti] = useState<boolean>(
    (part?.config as any)?.multi ?? true
  )
  const [libraryCreatable, setLibraryCreatable] = useState<boolean>(
    (part?.config as any)?.creatable ?? true
  )

  React.useEffect(() => {
    if (isOpen) {
      setKind(part?.kind || 'yesno')
      setLabel(part?.label || '')
      setLevel(part?.level || 'core')
      setGate(Boolean(part?.gate))
      setScaleMin((part?.config as any)?.min ?? 1)
      setScaleMax((part?.config as any)?.max ?? 10)
      setScaleStep((part?.config as any)?.step ?? 1)
      setScaleDisplay((part?.config as any)?.display || 'slider')
      setScaleIcon((part?.config as any)?.icon || 'Sparkles')
      setNumberUnit((part?.config as any)?.unit || '')
      setNumberAggregate((part?.config as any)?.aggregate || 'sum')
      setTextMultiline(Boolean((part?.config as any)?.multiline))
      setLibraryId((part?.config as any)?.libraryId || libraries[0]?.id || '')
      setLibraryMulti((part?.config as any)?.multi ?? true)
      setLibraryCreatable((part?.config as any)?.creatable ?? true)
    }
  }, [isOpen, part, libraries])

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
          icon: scaleIcon,
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
          snapMinutes: (part?.config as any)?.snapMinutes ?? 5,
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
      questionId,
      kind,
      label: label.trim(),
      level,
      gate,
      config,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
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
            {part?.id && kind !== part.kind && (
              <p className="text-[10px] text-[var(--color-warn)] font-semibold">
                Changing input kind will retire the old part and create a new part to protect historical data.
              </p>
            )}
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
          <div className="space-y-2 p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)]">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[var(--color-ink)] block">Importance Level</span>
                <span className="text-[10px] text-[var(--color-ink-soft)]">
                  Core parts always show in Quick Mode; Extra parts show in Full Mode.
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setLevel('core')}
                  className={`py-1 px-3 rounded-[var(--radius-pill)] text-[10px] font-extrabold transition-all ${
                    level === 'core'
                      ? 'bg-[var(--color-accent)] text-white shadow-xs'
                      : 'bg-[var(--color-line)] text-[var(--color-ink-soft)]'
                  }`}
                >
                  CORE
                </button>
                <button
                  type="button"
                  onClick={() => setLevel('extra')}
                  className={`py-1 px-3 rounded-[var(--radius-pill)] text-[10px] font-extrabold transition-all ${
                    level === 'extra'
                      ? 'bg-[var(--color-accent)] text-white shadow-xs'
                      : 'bg-[var(--color-line)] text-[var(--color-ink-soft)]'
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
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-3">
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

              {/* Display mode */}
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
                  <span>Stars</span>
                </label>
              </div>

              {/* Custom Scaling Icon Selection */}
              <div className="space-y-1.5 pt-2 border-t border-[var(--color-line)]">
                <label className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
                  Scaling Icon (grows with value)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {SCALE_ICONS_LIST.map((item) => {
                    const Icon = item.icon
                    const isSelected = scaleIcon === item.name
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setScaleIcon(item.name)}
                        className={`flex flex-col items-center justify-center p-2 rounded-[var(--radius-s)] border transition-all ${
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-accent)] font-bold shadow-xs'
                            : 'border-[var(--color-line)] bg-[var(--color-surface)]/50 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="text-[8px] mt-1 leading-none">{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {kind === 'number' && (
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2.5">
              <span className="font-bold text-[var(--color-ink)] block">Number Configuration</span>
              <div>
                <label className="text-[10px] text-[var(--color-ink-soft)] block">Unit Label</label>
                <input
                  type="text"
                  placeholder="e.g. km, mins, cups, glasses, steps"
                  value={numberUnit}
                  onChange={(e) => setNumberUnit(e.target.value)}
                  className="w-full p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-ink-soft)] block">Aggregate in stats</label>
                <div className="flex items-center space-x-3 pt-1">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="numberAgg"
                      checked={numberAggregate === 'sum'}
                      onChange={() => setNumberAggregate('sum')}
                    />
                    <span>Sum (Total accumulated)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="numberAgg"
                      checked={numberAggregate === 'mean'}
                      onChange={() => setNumberAggregate('mean')}
                    />
                    <span>Average (Daily mean)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {kind === 'text' && (
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2">
              <span className="font-bold text-[var(--color-ink)] block">Text Configuration</span>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={textMultiline}
                  onChange={(e) => setTextMultiline(e.target.checked)}
                />
                <span>Multiline journal textarea (allows multi-paragraph reflections)</span>
              </label>
            </div>
          )}

          {kind === 'timerange' && (
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] text-xs text-[var(--color-ink-soft)]">
              Universal time range selector. Uses dual-clock continuous scrub pop-up with dynamic 24-hour summary axis.
            </div>
          )}

          {kind === 'library' && (
            <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2.5">
              <span className="font-bold text-[var(--color-ink)] block">Library Tag Configuration</span>
              <div>
                <label className="text-[10px] text-[var(--color-ink-soft)] block">Target Library</label>
                <select
                  value={libraryId}
                  onChange={(e) => setLibraryId(e.target.value)}
                  className="w-full p-2 rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-xs"
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
