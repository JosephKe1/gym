import { X } from 'lucide-react'

export type EditScope = 'session' | 'future'

interface ScopeModalProps {
  title: string
  body: string
  sessionLabel: string
  futureLabel: string
  danger?: boolean
  onPick: (scope: EditScope) => void
  onClose: () => void
}

/** Asks whether an in-session edit applies to just this workout or future ones too. */
export default function ScopeModal({ title, body, sessionLabel, futureLabel, danger = false, onPick, onClose }: ScopeModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-pop-in">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button type="button" aria-label="Cancel" onClick={onClose} className="p-1 text-slate-500">
            <X size={24} />
          </button>
        </div>
        <p className="mt-2 text-slate-500">{body}</p>
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => onPick('session')}
            className="w-full py-3.5 rounded-2xl border-2 border-slate-300 text-slate-700 font-semibold active:bg-slate-100"
          >
            {sessionLabel}
          </button>
          <button
            type="button"
            onClick={() => onPick('future')}
            className={`w-full py-3.5 rounded-2xl font-semibold text-white ${
              danger ? 'bg-red-600 active:bg-red-700' : 'bg-blue-600 active:bg-blue-700'
            }`}
          >
            {futureLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
