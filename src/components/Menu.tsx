import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'

export interface MenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  onClick: () => void
}

/** Kebab-button dropdown menu, like the exercise context menu in the reference app. */
export default function Menu({ items, className = '' }: { items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label="More options"
        onClick={() => setOpen((o) => !o)}
        className="p-2 -m-1 rounded-full text-slate-500 active:bg-slate-200"
      >
        <MoreVertical size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-40 min-w-52 bg-slate-50 rounded-2xl shadow-xl border border-slate-200/60 py-1 animate-pop-in">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={`w-full flex items-center gap-3 text-left px-5 py-3.5 text-lg active:bg-slate-200 ${
                item.danger ? 'text-red-600' : 'text-slate-800'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
