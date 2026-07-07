import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react'
import { activePlan, localDate, useAppState, weekdayIndex, workoutIdForDate } from '../lib/store'
import type { AppState } from '../types'

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface CalendarStripProps {
  weekOffset: number
  onSelectWeekOffset: (offset: number) => void
}

/**
 * Dashboard-style calendar: a compact Mon–Sun strip that expands into a full
 * month. Each day shows a progress ring (share of planned sets completed) and
 * a dumbbell badge for scheduled/completed workout days.
 */
export default function CalendarStrip({ weekOffset, onSelectWeekOffset }: CalendarStripProps) {
  const state = useAppState()
  const [expanded, setExpanded] = useState(false)
  // month being browsed while expanded (first of month)
  const [monthCursor, setMonthCursor] = useState<Date | null>(null)

  const today = new Date()
  const viewedMonday = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - weekdayIndex(d) + weekOffset * 7)
    return d
  }, [weekOffset])

  const month = monthCursor ?? new Date(viewedMonday.getFullYear(), viewedMonday.getMonth(), 1)

  const selectDate = (date: Date) => {
    const monday = new Date(date)
    monday.setDate(date.getDate() - weekdayIndex(date))
    const todayMonday = new Date()
    todayMonday.setDate(todayMonday.getDate() - weekdayIndex(todayMonday))
    todayMonday.setHours(0, 0, 0, 0)
    monday.setHours(0, 0, 0, 0)
    const offset = Math.round((monday.getTime() - todayMonday.getTime()) / (7 * 24 * 3600 * 1000))
    onSelectWeekOffset(offset)
    setExpanded(false)
    setMonthCursor(null)
  }

  const navigate = (dir: -1 | 1) => {
    if (expanded) {
      setMonthCursor(new Date(month.getFullYear(), month.getMonth() + dir, 1))
    } else {
      onSelectWeekOffset(weekOffset + dir)
    }
  }

  const label = expanded
    ? month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : weekOffset === 0
      ? 'This Week'
      : `${fmtShort(viewedMonday)} – ${fmtShort(addDays(viewedMonday, 6))}`

  return (
    <div className="bg-white rounded-b-3xl shadow-sm border-b border-slate-100 pb-1">
      <div className="flex items-center justify-between px-5 pt-3">
        <button
          type="button"
          aria-label={expanded ? 'Previous month' : 'Previous week'}
          onClick={() => navigate(-1)}
          className="p-2 text-slate-500 active:bg-slate-100 rounded-full"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => {
            onSelectWeekOffset(0)
            setMonthCursor(null)
          }}
          className="bg-slate-100 rounded-full px-5 py-2 font-semibold text-lg"
        >
          {label}
        </button>
        <button
          type="button"
          aria-label={expanded ? 'Next month' : 'Next week'}
          onClick={() => navigate(1)}
          className="p-2 text-slate-500 active:bg-slate-100 rounded-full"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 px-4 mt-2">
        {DAY_HEADERS.map((h, i) => (
          <span
            key={i}
            className={`text-center text-sm font-bold ${
              !expanded && weekOffset === 0 && i === weekdayIndex(today) ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            {h}
          </span>
        ))}
      </div>

      {expanded ? (
        <MonthGrid month={month} state={state} onPick={selectDate} />
      ) : (
        <div className="grid grid-cols-7 px-4 mt-2 mb-1">
          {Array.from({ length: 7 }, (_, i) => {
            const date = addDays(viewedMonday, i)
            return <DayCircle key={i} date={date} state={state} onPick={selectDate} />
          })}
        </div>
      )}

      <button
        type="button"
        aria-label={expanded ? 'Collapse calendar' : 'Expand calendar'}
        onClick={() => {
          setExpanded((e) => !e)
          setMonthCursor(null)
        }}
        className="w-full flex justify-center py-2"
      >
        <span className="w-12 h-1.5 rounded-full bg-slate-300" />
      </button>
    </div>
  )
}

function MonthGrid({ month, state, onPick }: { month: Date; state: AppState; onPick: (d: Date) => void }) {
  const cells: (Date | null)[] = []
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  for (let i = 0; i < weekdayIndex(first); i++) cells.push(null)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="grid grid-cols-7 gap-y-3 px-4 mt-2 mb-1">
      {cells.map((date, i) =>
        date ? <DayCircle key={i} date={date} state={state} onPick={onPick} /> : <span key={i} />,
      )}
    </div>
  )
}

function DayCircle({ date, state, onPick }: { date: Date; state: AppState; onPick: (d: Date) => void }) {
  const iso = localDate(date)
  const isToday = iso === localDate()
  const plan = activePlan(state)
  const scheduled = workoutIdForDate(plan, iso) !== null

  // completion ring: share of planned sets actually done across that day's finished sessions
  let fraction = 0
  let hasSession = false
  for (const sess of state.sessions) {
    if (sess.date !== iso || sess.finishedAt === null) continue
    hasSession = true
    const total = sess.logs.reduce((a, l) => a + l.sets.length, 0)
    const done = sess.logs.reduce((a, l) => a + l.sets.filter((s) => s.done).length, 0)
    fraction = Math.max(fraction, total > 0 ? done / total : 1)
  }

  const R = 19
  const C = 2 * Math.PI * R

  return (
    <button type="button" onClick={() => onPick(date)} className="relative w-11 h-11 mx-auto" aria-label={iso}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={R} fill={isToday ? '#2563eb' : 'transparent'} stroke="#e2e8f0" strokeWidth="3" />
        {fraction > 0 && (
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke={isToday ? '#93c5fd' : '#475569'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${C * Math.min(1, fraction)} ${C}`}
          />
        )}
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-semibold ${
          isToday ? 'text-white' : 'text-slate-700'
        }`}
      >
        {date.getDate()}
      </span>
      {(scheduled || hasSession) && (
        <span
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${
            hasSession ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
          }`}
        >
          <Dumbbell size={10} />
        </span>
      )}
    </button>
  )
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(d.getDate() + n)
  return out
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
