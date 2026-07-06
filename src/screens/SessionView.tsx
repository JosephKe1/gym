import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Link2, Minus, Plus, Timer, X } from 'lucide-react'
import Menu from '../components/Menu'
import ExerciseImage from '../components/ExerciseImage'
import ExerciseInfoSheet from '../components/ExerciseInfoSheet'
import { getExercise } from '../data/catalog'
import { actions, lastPerformance, logMode, useAppState, EFFORT_LABEL } from '../lib/store'
import type { CatalogExercise, Effort, ExerciseLog, SetLog } from '../types'

const EFFORT_ORDER: (Effort | null)[] = [null, 'easy', 'ideal', 'max']
const EFFORT_STYLE: Record<Effort, string> = {
  easy: 'bg-green-100 text-green-700 border-green-300',
  ideal: 'bg-blue-100 text-blue-700 border-blue-300',
  max: 'bg-red-100 text-red-700 border-red-300',
}

export default function SessionView({ onDone }: { onDone: () => void }) {
  const state = useAppState()
  const session = state.activeSession
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [infoExercise, setInfoExercise] = useState<CatalogExercise | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now())
      if (session) setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
    }, 500)
    return () => clearInterval(t)
  }, [session])

  // buzz when the rest timer finishes
  const buzzedRef = useRef(false)
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : null
  useEffect(() => {
    if (rest && restLeft === 0 && !buzzedRef.current) {
      buzzedRef.current = true
      try {
        navigator.vibrate?.([200, 100, 200])
      } catch {
        // vibration unsupported
      }
    }
    if (restLeft !== 0) buzzedRef.current = false
  }, [rest, restLeft])

  if (!session) return null

  const totalSets = session.logs.reduce((a, l) => a + l.sets.length, 0)
  const doneSets = session.logs.reduce((a, l) => a + l.sets.filter((s) => s.done).length, 0)

  const startRest = (overrideSec: number | null) => {
    const total = overrideSec ?? state.settings.restSec
    setRest({ endsAt: Date.now() + total * 1000, total })
  }

  const finish = () => {
    if (doneSets < totalSets && !confirm(`${totalSets - doneSets} sets are not logged yet. Finish anyway?`)) return
    actions.finishSession()
    onDone()
  }

  return (
    <div className="pb-40">
      <header className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur px-5 pt-4 pb-3 border-b border-slate-200 flex items-center gap-3">
        <div className="grow min-w-0">
          <p className="text-slate-500 text-sm">
            {formatClock(elapsed)} · {doneSets}/{totalSets} sets
          </p>
          <h1 className="text-2xl font-bold truncate">{session.workoutName}</h1>
        </div>
        <button
          type="button"
          onClick={finish}
          className="shrink-0 bg-blue-600 text-white font-bold rounded-full px-5 py-2.5 active:bg-blue-700"
        >
          Finish
        </button>
        <Menu
          items={[
            {
              label: 'Discard workout',
              icon: <X size={18} />,
              danger: true,
              onClick: () => {
                if (confirm('Discard this workout? Logged sets will be lost.')) {
                  actions.discardSession()
                  onDone()
                }
              },
            },
          ]}
        />
      </header>

      <div className="px-4 mt-4 space-y-4">
        {session.logs.map((log, li) => (
          <ExerciseCard
            key={log.slotId}
            log={log}
            logIndex={li}
            unit={state.settings.unit}
            onSetDone={startRest}
            onInfo={setInfoExercise}
          />
        ))}
      </div>

      <div className="px-5 mt-8">
        <button
          type="button"
          onClick={finish}
          className="w-full bg-blue-600 text-white text-lg font-bold rounded-full py-4 shadow-lg shadow-blue-600/30 active:bg-blue-700"
        >
          Finish Workout
        </button>
      </div>

      {rest && restLeft !== null && (
        <RestBar
          left={restLeft}
          total={rest.total}
          onAdjust={(d) => setRest((r) => (r ? { ...r, endsAt: r.endsAt + d * 1000, total: Math.max(1, r.total + d) } : r))}
          onSkip={() => setRest(null)}
        />
      )}

      {infoExercise && <ExerciseInfoSheet exercise={infoExercise} onClose={() => setInfoExercise(null)} />}
    </div>
  )
}

// ---------- one exercise ----------

function ExerciseCard({
  log,
  logIndex,
  unit,
  onSetDone,
  onInfo,
}: {
  log: ExerciseLog
  logIndex: number
  unit: string
  onSetDone: (restSec: number | null) => void
  onInfo: (ex: CatalogExercise) => void
}) {
  const state = useAppState()
  const [collapsed, setCollapsed] = useState(false)
  const ex = getExercise(log.exerciseId)
  if (!ex) return null

  const mode = logMode(log.exerciseId)
  const last = lastPerformance(state, log.exerciseId)
  const partner = log.supersetWith
    ? state.activeSession?.logs.find((l) => l.slotId === log.supersetWith)
    : null
  const partnerEx = partner ? getExercise(partner.exerciseId) : null
  const allDone = log.sets.every((s) => s.done)

  return (
    <section className={`rounded-3xl border p-4 ${allDone ? 'bg-green-50/50 border-green-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onInfo(ex)}>
          <ExerciseImage exercise={ex} size="sm" />
        </button>
        <div className="grow min-w-0">
          <h3 className="font-bold text-lg leading-snug">{ex.name}</h3>
          <p className="text-slate-500 text-sm">
            Target: {log.targetSets} × {log.repsMin}-{log.repsMax}
            {log.perSide ? ' per side' : ''}
            {log.restSec != null && ` · rest ${Math.floor(log.restSec / 60)}:${String(log.restSec % 60).padStart(2, '0')}`}
          </p>
          {partnerEx && (
            <p className="text-purple-600 text-xs font-semibold mt-0.5 flex items-center gap-1">
              <Link2 size={11} /> Superset with {partnerEx.name}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          onClick={() => setCollapsed((c) => !c)}
          className="p-2 text-slate-400"
        >
          <ChevronDown size={20} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>

      {!collapsed && (
        <>
          {last && (
            <p className="text-xs text-slate-400 mt-2">
              Last time ({last.date}):{' '}
              {last.sets
                .map((s) => (mode === 'time' ? formatClock(s.timeSec ?? 0) : `${s.weight ?? '–'}${s.weight != null ? unit : ''}×${s.reps ?? '–'}`))
                .join(', ')}
            </p>
          )}

          <div className="mt-3 grid grid-cols-[2rem_1fr_1fr_4.5rem_2.75rem] gap-2 items-center text-center">
            <span className="text-xs font-bold text-slate-400">SET</span>
            {mode === 'time' ? (
              <span className="text-xs font-bold text-slate-400 col-span-2">TIME (SEC)</span>
            ) : (
              <>
                <span className="text-xs font-bold text-slate-400">{mode === 'weight-reps' ? unit.toUpperCase() : ''}</span>
                <span className="text-xs font-bold text-slate-400">REPS</span>
              </>
            )}
            <span className="text-xs font-bold text-slate-400">EFFORT</span>
            <span />

            {log.sets.map((set, si) => (
              <SetRow key={si} set={set} index={si} logIndex={logIndex} mode={mode} onDone={() => onSetDone(log.restSec)} />
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => actions.addSet(logIndex)}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm active:bg-slate-200"
            >
              <Plus size={15} /> Add set
            </button>
            {log.sets.length > 1 && (
              <button
                type="button"
                onClick={() => actions.removeLastSet(logIndex)}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm active:bg-slate-200"
              >
                <Minus size={15} /> Remove set
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

// ---------- one set row ----------

function SetRow({
  set,
  index,
  logIndex,
  mode,
  onDone,
}: {
  set: SetLog
  index: number
  logIndex: number
  mode: 'weight-reps' | 'reps' | 'time'
  onDone: () => void
}) {
  const cycleEffort = () => {
    const next = EFFORT_ORDER[(EFFORT_ORDER.indexOf(set.effort) + 1) % EFFORT_ORDER.length]
    actions.updateSet(logIndex, index, { effort: next })
  }

  const toggleDone = () => {
    const done = !set.done
    actions.updateSet(logIndex, index, { done })
    if (done) onDone()
  }

  const numInput = (field: 'weight' | 'reps' | 'timeSec', placeholder: string) => (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      placeholder={placeholder}
      value={set[field] ?? ''}
      onChange={(e) => actions.updateSet(logIndex, index, { [field]: e.target.value === '' ? null : Number(e.target.value) })}
      className={`w-full text-center text-lg font-semibold rounded-xl py-2 outline-none focus:ring-2 focus:ring-blue-400 ${
        set.done ? 'bg-green-100/60' : 'bg-slate-100'
      }`}
    />
  )

  return (
    <>
      <span className="font-bold text-slate-500">{index + 1}</span>
      {mode === 'time' ? (
        <div className="col-span-2">{numInput('timeSec', 'sec')}</div>
      ) : (
        <>
          {mode === 'weight-reps' ? numInput('weight', '–') : <span className="text-slate-300">—</span>}
          {numInput('reps', '–')}
        </>
      )}
      <button
        type="button"
        onClick={cycleEffort}
        className={`text-xs font-bold rounded-full py-2 border ${
          set.effort ? EFFORT_STYLE[set.effort] : 'bg-slate-50 text-slate-400 border-slate-200'
        }`}
      >
        {set.effort ? EFFORT_LABEL[set.effort] : '– – –'}
      </button>
      <button
        type="button"
        aria-label={set.done ? 'Mark set incomplete' : 'Mark set complete'}
        onClick={toggleDone}
        className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center border-2 transition-colors ${
          set.done ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-transparent'
        }`}
      >
        <Check size={20} strokeWidth={3} />
      </button>
    </>
  )
}

// ---------- rest timer bar ----------

function RestBar({
  left,
  total,
  onAdjust,
  onSkip,
}: {
  left: number
  total: number
  onAdjust: (deltaSec: number) => void
  onSkip: () => void
}) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0
  const finished = left === 0
  return (
    <div className="fixed bottom-20 inset-x-0 px-4 max-w-lg mx-auto z-40">
      <div className={`rounded-2xl shadow-xl p-3 text-white ${finished ? 'bg-green-600' : 'bg-slate-900'}`}>
        <div className="flex items-center gap-3">
          <Timer size={20} className="shrink-0" />
          <span className="text-2xl font-bold tabular-nums w-16">{formatClock(left)}</span>
          <div className="grow h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <button type="button" onClick={() => onAdjust(-15)} className="px-2 py-1.5 rounded-lg bg-white/10 text-sm font-bold">
            -15
          </button>
          <button type="button" onClick={() => onAdjust(15)} className="px-2 py-1.5 rounded-lg bg-white/10 text-sm font-bold">
            +15
          </button>
          <button type="button" onClick={onSkip} className="px-3 py-1.5 rounded-lg bg-white/20 text-sm font-bold">
            {finished ? 'Done' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
