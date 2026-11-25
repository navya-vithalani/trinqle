import React, { useState } from 'react'
import {
  Calendar,
  Image as ImageIcon,
  BookOpen,
  ArrowLeft,
  X,
  Palette,
  Sparkles,
} from 'lucide-react'
import type { Chapter, ChapterAnswer } from '../../data/types'
import { CharacterStage } from '../components/CharacterStage'

interface ArchiveHomeScreenProps {
  chapter: Chapter
  chapterAnswers: ChapterAnswer[]
  onExitArchive: () => void
  onNavigateToDay?: (date: string) => void
}

export const ArchiveHomeScreen: React.FC<ArchiveHomeScreenProps> = ({
  chapter,
  chapterAnswers,
  onExitArchive,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)

  const meta = chapter.frozen?.metadata
  const photos = chapter.photos || []

  return (
    <div className="space-y-4 pb-20">
      {/* Return to Live Diary Banner */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--color-surface)] border-2 border-[var(--color-line)] shadow-xs">
        <button
          type="button"
          onClick={onExitArchive}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] hover:underline"
        >
          <ArrowLeft size={16} />
          <span>Exit Archive Mode</span>
        </button>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
          Viewing Closed Chapter
        </span>
      </div>

      {/* Chapter Title & Header */}
      <div className="sticker-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
            Closed Chapter
          </span>
          <span className="text-xs font-bold text-[var(--color-ink-soft)] flex items-center gap-1">
            <Calendar size={13} />
            {chapter.startDate} to {chapter.endDate || chapter.plannedEndDate}
          </span>
        </div>

        <h1 className="text-xl font-black text-[var(--color-ink)] tracking-tight">
          {chapter.title || 'Untitled Chapter'}
        </h1>

        {chapter.summary && (
          <p className="text-xs text-[var(--color-ink)] leading-relaxed bg-[var(--color-bg)] p-3 rounded-xl border border-[var(--color-line)]/60">
            {chapter.summary}
          </p>
        )}
      </div>

      {/* Character Stage with chapter's character */}
      <div className="sticker-card p-4 space-y-2 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-soft)]">
          Chapter Mascot
        </span>
        <CharacterStage characterId={chapter.characterId || 'white-cat'} />
      </div>

      {/* Chapter Metadata Stats */}
      <div className="sticker-card p-4 space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider">
          Chapter Overview
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-[var(--color-bg)]">
            <div className="text-sm font-extrabold text-[var(--color-ink)]">
              {meta?.daysFilled ?? 0}
            </div>
            <div className="text-[9px] text-[var(--color-ink-soft)] font-medium">Days filled</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--color-bg)]">
            <div className="text-sm font-extrabold text-[var(--color-accent)]">
              {meta?.fullCount ?? 0}
            </div>
            <div className="text-[9px] text-[var(--color-ink-soft)] font-medium">Full nights</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--color-bg)]">
            <div className="text-sm font-extrabold text-[var(--color-ink)]">
              {meta?.quickCount ?? 0}
            </div>
            <div className="text-[9px] text-[var(--color-ink-soft)] font-medium">Quick nights</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="text-sm font-extrabold text-amber-500">
              {meta?.memorableCount ?? 0}
            </div>
            <div className="text-[9px] text-amber-600 font-medium">Memorable</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--color-ink-soft)] pt-1 px-1">
          <span className="flex items-center gap-1">
            <Palette size={12} /> Theme: <strong className="text-[var(--color-ink)]">{chapter.themeId}</strong>
          </span>
          <span className="flex items-center gap-1">
            <Sparkles size={12} /> Mascot: <strong className="text-[var(--color-ink)]">{chapter.characterId}</strong>
          </span>
        </div>
      </div>

      {/* Photos Gallery (up to 10 photos) */}
      {photos.length > 0 && (
        <div className="sticker-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon size={14} className="text-[var(--color-accent)]" />
              Chapter Photos ({photos.length})
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {photos.map((photoBlob, idx) => {
              const url = URL.createObjectURL(photoBlob)
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedPhotoIndex(idx)}
                  className="aspect-square rounded-xl overflow-hidden bg-[var(--color-bg)] border border-[var(--color-line)] cursor-pointer hover:border-[var(--color-accent)] transition-all"
                >
                  <img
                    src={url}
                    alt={`Chapter memory ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Chapter Reflection Answers */}
      {chapterAnswers.length > 0 && (
        <div className="sticker-card p-4 space-y-3">
          <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={14} className="text-[var(--color-accent)]" />
            Chapter Reflections
          </h3>
          <div className="space-y-2.5">
            {chapterAnswers.map((ca) => (
              <div
                key={ca.id}
                className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-line)]/60 space-y-1"
              >
                <span className="text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-wider">
                  {ca.promptId.replace(/^(q_|p_)/, '').replace(/_/g, ' ')}
                </span>
                <p className="text-xs text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap">
                  {String(ca.value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-lg w-full max-h-[85vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setSelectedPhotoIndex(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
            >
              <X size={20} />
            </button>
            <img
              src={URL.createObjectURL(photos[selectedPhotoIndex])}
              alt="Full view"
              className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
