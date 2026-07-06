import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface SheetProps {
  onClose: () => void
  children: ReactNode
  /** Fixed tall sheet (e.g. exercise picker) vs. hug-content sheet. */
  tall?: boolean
}

export default function Sheet({ onClose, children, tall = false }: SheetProps) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div
        className={`relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-sheet-up flex flex-col ${
          tall ? 'h-[88dvh]' : 'max-h-[88dvh]'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0" onClick={onClose}>
          <div className="w-10 h-1 rounded-full bg-slate-900" />
        </div>
        {children}
      </div>
    </div>
  )
}
