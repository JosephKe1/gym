import { X, TrendingUp } from 'lucide-react'
import type { Effort } from '../types'

const OPTIONS: { effort: Effort; label: string; hint: string; card: string; dot: string }[] = [
  {
    effort: 'easy',
    label: 'EASY',
    hint: 'Could have done 3+ more reps',
    card: 'bg-teal-50 border-teal-300',
    dot: 'bg-teal-500 ring-teal-200',
  },
  {
    effort: 'ideal',
    label: 'IDEAL',
    hint: 'Could have done 1–3 more reps',
    card: 'bg-amber-50 border-amber-300',
    dot: 'bg-amber-400 ring-amber-200',
  },
  {
    effort: 'max',
    label: 'MAX EFFORT',
    hint: 'No more reps with good form',
    card: 'bg-red-50 border-red-300',
    dot: 'bg-red-500 ring-red-200',
  },
]

interface EffortModalProps {
  onPick: (effort: Effort) => void
  onClose: () => void
  /** Shown when re-rating an already-completed set. */
  allowUncheck?: boolean
  onUncheck?: () => void
}

/** Centered "Rate Effort Level" dialog shown when completing a set. */
export default function EffortModal({ onPick, onClose, allowUncheck = false, onUncheck }: EffortModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-pop-in">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Rate Effort Level</h2>
            <p className="text-slate-400 mt-0.5">Required to complete the set</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 text-slate-500">
            <X size={26} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {OPTIONS.map((o) => (
            <button
              key={o.effort}
              type="button"
              onClick={() => onPick(o.effort)}
              className={`w-full flex items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left active:scale-[0.99] ${o.card}`}
            >
              <span className={`w-9 h-9 rounded-full ring-4 shrink-0 ${o.dot}`} />
              <span>
                <span className="block font-bold text-lg">{o.label}</span>
                <span className="block text-slate-500">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {allowUncheck && onUncheck && (
          <button
            type="button"
            onClick={onUncheck}
            className="mt-3 w-full py-3 rounded-2xl bg-slate-100 text-slate-600 font-semibold active:bg-slate-200"
          >
            Mark set incomplete
          </button>
        )}

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-3 text-slate-500 text-sm">
          <TrendingUp size={20} className="text-blue-500 shrink-0" />
          <span>Your effort ratings drive next session's suggestions and help you judge when to add weight.</span>
        </div>
      </div>
    </div>
  )
}
