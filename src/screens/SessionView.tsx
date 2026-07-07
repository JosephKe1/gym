import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronsDown, ChevronsUp, Link2, Minus, Pause, Play, Plus, Repeat, SlidersHorizontal, Timer, Trash2, X } from 'lucide-react'
import Menu from '../components/Menu'
import ExerciseImage from '../components/ExerciseImage'
import ExerciseInfoSheet from '../components/ExerciseInfoSheet'
import ExercisePicker from '../components/ExercisePicker'
import EffortModal from '../components/EffortModal'
import ScopeModal from '../components/ScopeModal'
import Sheet from '../components/Sheet'
import { getExercise } from '../data/catalog'
import { actions, lastPerformance, logMode, useAppState } from '../lib/store'
import { suggestSets, type SetSuggestion } from '../lib/suggest'
import type { CatalogExercise, Effort, ExerciseLog, SetLog } from '../types'

const EFFORT_CIRCLE: Record<Effort, string> = {
  easy: 'bg-teal-500 border-teal-500',
  ideal: 'bg-amber-400 border-amber-400',
  max: 'bg-red-500 border-red-500',
}
const EFFORT_DOT: Record<Effort, string> = {
  easy: 'bg-teal-500',
  ideal: 'bg-amber-400',
  max: 'bg-red-500',
}

interface RatingTarget {
  logIndex: number
  setIndex: number
  restSec: number | null
  /** Set was already complete — re-rating only, no rest timer. */
  wasDone: boolean
}

interface Stopwatch {
  logIndex: number
  setIndex: number
  startedAt: number
  baseSec: number
}

interface ScopePrompt {
  title: string
  body: string
  sessionLabel: string
  futureLabel: string
  danger?: boolean
  apply: (alsoPlan: boolean) => void
}

interface TargetsPatch {
  sets: number
  repsMin: number
  repsMax: number
  perSide: boolean
  trackWeight: boolean
}

export default function SessionView({ onDone }: { onDone: () => void }) {
  const state = useAppState()
  const session = state.activeSession
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [infoExercise, setInfoExercise] = useState<CatalogExercise | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [rating, setRating] = useState<RatingTarget | null>(null)
  const [hint, setHint] = useState<{ title: string; body: string } | null>(null)
  const [restPicker, setRestPicker] = useState<number | null>(null) // logIndex
  const [watch, setWatch] = useState<Stopwatch | null>(null)
  const [picker, setPicker] = useState<{ kind: 'add' } | { kind: 'swap'; logIndex: number } | null>(null)
  const [editTargets, setEditTargets] = useState<number | null>(null) // logIndex
  const [scope, setScope] = useState<ScopePrompt | null>(null)

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now())
      if (session) setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
    }, 300)
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

  const stopWatch = (w: Stopwatch) => {
    const total = w.baseSec + Math.round((Date.now() - w.startedAt) / 1000)
    actions.updateSet(w.logIndex, w.setIndex, { timeSec: total })
    setWatch(null)
  }

  const toggleWatch = (logIndex: number, setIndex: number, currentSec: number | null) => {
    if (watch && watch.logIndex === logIndex && watch.setIndex === setIndex) {
      stopWatch(watch)
      return
    }
    if (watch) stopWatch(watch)
    setWatch({ logIndex, setIndex, startedAt: Date.now(), baseSec: currentSec ?? 0 })
  }

  const finish = () => {
    if (doneSets < totalSets && !confirm(`${totalSets - doneSets} sets are not logged yet. Finish anyway?`)) return
    if (watch) stopWatch(watch)
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
            defaultRestSec={state.settings.restSec}
            watch={watch}
            now={now}
            onToggleWatch={toggleWatch}
            onRequestRating={setRating}
            onHint={setHint}
            onOpenRestPicker={() => setRestPicker(li)}
            onInfo={setInfoExercise}
            onSwap={() => setPicker({ kind: 'swap', logIndex: li })}
            onEditTargets={() => setEditTargets(li)}
            onRemove={() => {
              const name = getExercise(log.exerciseId)?.name ?? 'this exercise'
              setScope({
                title: `Remove ${name}?`,
                body: 'Remove it from just this workout, or from future workouts as well?',
                sessionLabel: 'Just this workout',
                futureLabel: 'This + future workouts',
                danger: true,
                apply: (alsoPlan) => actions.sessionRemoveExercise(li, alsoPlan),
              })
            }}
          />
        ))}
      </div>

      <div className="px-5 mt-6">
        <button
          type="button"
          onClick={() => setPicker({ kind: 'add' })}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-2xl py-4 text-blue-600 font-semibold active:bg-slate-100"
        >
          <Plus size={18} /> Add exercise
        </button>
      </div>

      <div className="px-5 mt-4">
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

      {rating && (
        <EffortModal
          onClose={() => setRating(null)}
          allowUncheck={rating.wasDone}
          onUncheck={() => {
            actions.updateSet(rating.logIndex, rating.setIndex, { done: false })
            setRating(null)
          }}
          onPick={(effort) => {
            actions.updateSet(rating.logIndex, rating.setIndex, { effort, done: true })
            if (!rating.wasDone) startRest(rating.restSec)
            setRating(null)
          }}
        />
      )}

      {hint && <HintModal title={hint.title} body={hint.body} onClose={() => setHint(null)} />}

      {restPicker !== null && (
        <RestPickerSheet
          initialSec={session.logs[restPicker]?.restSec ?? state.settings.restSec}
          onClose={() => setRestPicker(null)}
          onSave={(sec) => {
            actions.saveSessionRest(restPicker, sec)
            setRestPicker(null)
          }}
          onStart={(sec) => {
            actions.saveSessionRest(restPicker, sec)
            startRest(sec)
            setRestPicker(null)
          }}
        />
      )}

      {picker && (
        <ExercisePicker
          title={picker.kind === 'swap' ? 'Swap Exercise' : 'Add Exercise'}
          onClose={() => setPicker(null)}
          onInfo={setInfoExercise}
          onSelect={(ex) => {
            const p = picker
            setPicker(null)
            if (p.kind === 'add') {
              setScope({
                title: `Add ${ex.name}?`,
                body: 'Add it to just this workout, or to your plan going forward?',
                sessionLabel: 'Just this workout',
                futureLabel: 'This + future workouts',
                apply: (alsoPlan) => actions.sessionAddExercise(ex.id, alsoPlan),
              })
            } else {
              const oldName = getExercise(session.logs[p.logIndex]?.exerciseId ?? '')?.name ?? 'the current exercise'
              setScope({
                title: `Swap to ${ex.name}?`,
                body: `Replaces ${oldName}. Any completed sets for it in this session are cleared. Swap just this workout, or future ones too?`,
                sessionLabel: 'Just this workout',
                futureLabel: 'This + future workouts',
                apply: (alsoPlan) => actions.sessionSwapExercise(p.logIndex, ex.id, alsoPlan),
              })
            }
          }}
        />
      )}

      {editTargets !== null && session.logs[editTargets] && (
        <SessionEditSheet
          log={session.logs[editTargets]}
          onClose={() => setEditTargets(null)}
          onSave={(patch) => {
            const li = editTargets
            setEditTargets(null)
            setScope({
              title: 'Save changes?',
              body: 'Apply the new sets/reps to just this workout, or to future workouts as well?',
              sessionLabel: 'Just this workout',
              futureLabel: 'This + future workouts',
              apply: (alsoPlan) => actions.sessionEditTargets(li, patch, alsoPlan),
            })
          }}
        />
      )}

      {scope && (
        <ScopeModal
          title={scope.title}
          body={scope.body}
          sessionLabel={scope.sessionLabel}
          futureLabel={scope.futureLabel}
          danger={scope.danger}
          onClose={() => setScope(null)}
          onPick={(choice) => {
            scope.apply(choice === 'future')
            setScope(null)
          }}
        />
      )}
    </div>
  )
}

// ---------- in-session targets editor ----------

function SessionEditSheet({
  log,
  onSave,
  onClose,
}: {
  log: ExerciseLog
  onSave: (patch: TargetsPatch) => void
  onClose: () => void
}) {
  const [sets, setSets] = useState(log.sets.length)
  const [repsMin, setRepsMin] = useState(log.repsMin)
  const [repsMax, setRepsMax] = useState(log.repsMax)
  const [perSide, setPerSide] = useState(log.perSide)
  const [trackWeight, setTrackWeight] = useState(log.trackWeight ?? false)
  const ex = getExercise(log.exerciseId)
  const timed = logMode(log.exerciseId) === 'time'

  const stepper = (label: string, value: number, min: number, max: number, onChange: (v: number) => void) => (
    <div className="flex items-center justify-between mt-5">
      <span className="text-lg font-medium">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-11 h-11 rounded-full bg-slate-100 text-2xl font-bold active:bg-slate-200"
        >
          −
        </button>
        <span className="text-2xl font-bold w-10 text-center">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-11 h-11 rounded-full bg-slate-100 text-2xl font-bold active:bg-slate-200"
        >
          +
        </button>
      </div>
    </div>
  )

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <h2 className="text-2xl font-bold">{timed ? 'Edit Sets' : 'Edit Sets & Reps'}</h2>
        <p className="text-slate-400 mt-1">{ex?.name}</p>

        {stepper('Sets', sets, 1, 10, setSets)}
        {!timed && (
          <>
            {stepper('Min reps', repsMin, 1, 100, (v) => {
              setRepsMin(v)
              if (v > repsMax) setRepsMax(v)
            })}
            {stepper('Max reps', repsMax, repsMin, 100, setRepsMax)}
            <label className="flex items-center justify-between mt-5 py-2">
              <span className="text-lg font-medium">Per side (unilateral)</span>
              <input type="checkbox" checked={perSide} onChange={(e) => setPerSide(e.target.checked)} className="w-6 h-6 accent-blue-600" />
            </label>
          </>
        )}
        {timed && (
          <label className="flex items-center justify-between mt-5 py-2">
            <span>
              <span className="block text-lg font-medium">Track weight</span>
              <span className="block text-sm text-slate-400">For weighted holds and loaded carries</span>
            </span>
            <input
              type="checkbox"
              checked={trackWeight}
              onChange={(e) => setTrackWeight(e.target.checked)}
              className="w-6 h-6 accent-blue-600"
            />
          </label>
        )}

        <button
          type="button"
          onClick={() => onSave({ sets, repsMin, repsMax, perSide, trackWeight })}
          className="mt-6 w-full bg-blue-600 text-white text-lg font-bold rounded-full py-4 active:bg-blue-700"
        >
          Save
        </button>
      </div>
    </Sheet>
  )
}

// ---------- one exercise ----------

function ExerciseCard({
  log,
  logIndex,
  unit,
  defaultRestSec,
  watch,
  now,
  onToggleWatch,
  onRequestRating,
  onHint,
  onOpenRestPicker,
  onInfo,
  onSwap,
  onEditTargets,
  onRemove,
}: {
  log: ExerciseLog
  logIndex: number
  unit: string
  defaultRestSec: number
  watch: Stopwatch | null
  now: number
  onToggleWatch: (logIndex: number, setIndex: number, currentSec: number | null) => void
  onRequestRating: (target: RatingTarget) => void
  onHint: (hint: { title: string; body: string }) => void
  onOpenRestPicker: () => void
  onInfo: (ex: CatalogExercise) => void
  onSwap: () => void
  onEditTargets: () => void
  onRemove: () => void
}) {
  const state = useAppState()
  const [collapsed, setCollapsed] = useState(false)
  const ex = getExercise(log.exerciseId)
  const mode = logMode(log.exerciseId)

  // suggestions are derived from the previous (finished) session — stable during this one
  const suggestions = useMemo(
    () => suggestSets(mode, Math.max(log.sets.length, log.targetSets), log.repsMax, lastPerformance(state, log.exerciseId)),
    [state, log.exerciseId, log.sets.length, log.targetSets, log.repsMax, mode],
  )

  if (!ex) return null

  const partner = log.supersetWith ? state.activeSession?.logs.find((l) => l.slotId === log.supersetWith) : null
  const partnerEx = partner ? getExercise(partner.exerciseId) : null
  const allDone = log.sets.every((s) => s.done)
  const restLabel = fmtClock(log.restSec ?? defaultRestSec)

  return (
    <section className={`rounded-3xl border p-4 ${allDone ? 'bg-green-50/50 border-green-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onInfo(ex)}>
          <ExerciseImage exercise={ex} size="sm" />
        </button>
        <div className="grow min-w-0">
          <h3 className="font-bold text-lg leading-snug">{ex.name}</h3>
          <p className="text-slate-500 text-sm">
            {mode === 'time' ? 'Timed sets' : `${log.repsMin}-${log.repsMax} reps${log.perSide ? ' per side' : ''}`}
          </p>
          {partnerEx && (
            <p className="text-purple-600 text-xs font-semibold mt-0.5 flex items-center gap-1">
              <Link2 size={11} /> Superset with {partnerEx.name}
            </p>
          )}
        </div>
        <Menu
          items={[
            { label: 'Swap', icon: <Repeat size={18} />, onClick: onSwap },
            { label: 'Edit Sets & Reps', icon: <SlidersHorizontal size={18} />, onClick: onEditTargets },
            { label: 'Remove', icon: <Trash2 size={18} />, danger: true, onClick: onRemove },
          ]}
        />
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
          <div
            className={`mt-3 grid gap-x-2 gap-y-2 items-center text-center ${
              mode === 'time'
                ? log.trackWeight
                  ? 'grid-cols-[1.8rem_0.9fr_1fr_1.4fr_2.75rem]'
                  : 'grid-cols-[1.8rem_1fr_2.5rem_1fr_2.75rem]'
                : 'grid-cols-[1.8rem_1fr_1.15fr_1.15fr_2.75rem]'
            }`}
          >
            <span className="text-xs font-bold text-slate-400">SET</span>
            <span className="text-xs font-bold text-slate-400">PREVIOUS</span>
            {mode === 'time' ? (
              log.trackWeight ? (
                <>
                  <span className="text-xs font-bold text-slate-400">{unit.toUpperCase()}</span>
                  <span className="text-xs font-bold text-slate-400">TIME</span>
                </>
              ) : (
                <span className="text-xs font-bold text-slate-400 col-span-2">TIME</span>
              )
            ) : (
              <>
                <span className="text-xs font-bold text-slate-400">
                  {mode === 'weight-reps' ? unit.toUpperCase() : ''}
                </span>
                <span className="text-xs font-bold text-slate-400">REPS</span>
              </>
            )}
            <span className="text-xs font-bold text-slate-400">EFFORT</span>

            {log.sets.map((set, si) => (
              <SetRow
                key={si}
                set={set}
                index={si}
                logIndex={logIndex}
                mode={mode}
                trackWeight={log.trackWeight ?? false}
                suggestion={suggestions[si] ?? null}
                watch={watch && watch.logIndex === logIndex && watch.setIndex === si ? watch : null}
                now={now}
                onToggleWatch={() => onToggleWatch(logIndex, si, set.timeSec)}
                onHint={onHint}
                onRate={(wasDone) => onRequestRating({ logIndex, setIndex: si, restSec: log.restSec, wasDone })}
              />
            ))}
          </div>

          <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onOpenRestPicker}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm active:bg-slate-200"
            >
              <Timer size={15} /> Rest: {restLabel}
            </button>
            <button
              type="button"
              onClick={() => actions.addSet(logIndex)}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm active:bg-slate-200"
            >
              <Plus size={15} /> Add set
            </button>
            {log.sets.length > 1 && (
              <button
                type="button"
                aria-label="Remove last set"
                onClick={() => actions.removeLastSet(logIndex)}
                className="w-11 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200"
              >
                <Minus size={15} />
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
  trackWeight,
  suggestion,
  watch,
  now,
  onToggleWatch,
  onHint,
  onRate,
}: {
  set: SetLog
  index: number
  logIndex: number
  mode: 'weight-reps' | 'reps' | 'time'
  trackWeight: boolean
  suggestion: SetSuggestion | null
  watch: Stopwatch | null
  now: number
  onToggleWatch: () => void
  onHint: (hint: { title: string; body: string }) => void
  onRate: (wasDone: boolean) => void
}) {
  const prev = suggestion?.prev ?? null
  const prevLabel =
    prev == null
      ? '–'
      : mode === 'time'
        ? prev.timeSec != null
          ? `${trackWeight && prev.weight != null ? `${prev.weight} × ` : ''}${fmtClock(prev.timeSec)}`
          : '–'
        : mode === 'weight-reps'
          ? prev.weight != null || prev.reps != null
            ? `${prev.weight ?? '–'} × ${prev.reps ?? '–'}`
            : '–'
          : prev.reps != null
            ? `${prev.reps} reps`
            : '–'

  const numInput = (field: 'weight' | 'reps', dir: 'up' | 'down' | null) => (
    <div className="flex items-center gap-0.5 min-w-0">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        placeholder="–"
        value={set[field] ?? ''}
        onChange={(e) => actions.updateSet(logIndex, index, { [field]: e.target.value === '' ? null : Number(e.target.value) })}
        className={`w-full min-w-0 text-center text-lg font-semibold rounded-xl py-2 outline-none focus:ring-2 focus:ring-blue-400 ${
          set.done ? 'bg-green-100/60' : 'bg-slate-100'
        }`}
      />
      {dir && suggestion?.title ? (
        <button
          type="button"
          aria-label="Why this suggestion?"
          onClick={() => onHint({ title: suggestion.title!, body: suggestion.body! })}
          className="text-blue-600 shrink-0 animate-pulse"
        >
          {dir === 'up' ? <ChevronsUp size={17} /> : <ChevronsDown size={17} />}
        </button>
      ) : (
        <span className="w-[17px] shrink-0" />
      )}
    </div>
  )

  const running = watch !== null
  const displaySec = running ? (watch!.baseSec + Math.round((now - watch!.startedAt) / 1000)) : set.timeSec

  return (
    <>
      <span className="font-bold text-slate-500">{index + 1}</span>

      <span className="text-sm text-slate-400 flex items-center justify-center gap-1.5 min-w-0 truncate">
        {prevLabel}
        {prev?.effort && <span className={`w-2 h-2 rounded-full shrink-0 ${EFFORT_DOT[prev.effort]}`} />}
      </span>

      {mode === 'time' ? (
        <>
          {trackWeight ? (
            numInput('weight', null)
          ) : (
            <button
              type="button"
              aria-label={running ? 'Stop timer' : 'Start timer'}
              onClick={onToggleWatch}
              className={`w-9 h-9 mx-auto rounded-full flex items-center justify-center ${
                running ? 'bg-blue-600 text-white' : 'text-blue-600 border-2 border-blue-500'
              }`}
            >
              {running ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
          )}
          <div className="flex items-center gap-1 min-w-0">
            {trackWeight && (
              <button
                type="button"
                aria-label={running ? 'Stop timer' : 'Start timer'}
                onClick={onToggleWatch}
                className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                  running ? 'bg-blue-600 text-white' : 'text-blue-600 border-2 border-blue-500'
                }`}
              >
                {running ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
              </button>
            )}
            <input
              type="text"
              inputMode="numeric"
              placeholder="0:00"
              value={displaySec != null ? fmtClock(displaySec) : ''}
              onChange={(e) => {
                const parts = e.target.value.split(':').map((x) => Number(x))
                const sec = parts.length === 2 ? parts[0] * 60 + (parts[1] || 0) : Number(e.target.value) || 0
                actions.updateSet(logIndex, index, { timeSec: Number.isFinite(sec) ? sec : null })
              }}
              className={`w-full min-w-0 text-center text-lg font-semibold rounded-xl py-2 outline-none focus:ring-2 focus:ring-blue-400 tabular-nums ${
                running ? 'bg-blue-50 text-blue-700' : set.done ? 'bg-green-100/60' : 'bg-slate-100'
              }`}
            />
          </div>
        </>
      ) : (
        <>
          {mode === 'weight-reps' ? numInput('weight', suggestion?.weightDir ?? null) : <span className="text-slate-300">—</span>}
          {numInput('reps', suggestion?.repsDir ?? null)}
        </>
      )}

      <button
        type="button"
        aria-label={set.done ? 'Effort rating (tap to change)' : 'Complete set'}
        onClick={() => onRate(set.done)}
        className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center border-[2.5px] transition-colors ${
          set.done && set.effort ? `${EFFORT_CIRCLE[set.effort]} text-white` : 'border-slate-800 text-transparent'
        }`}
      >
        <Check size={20} strokeWidth={3} />
      </button>
    </>
  )
}

// ---------- suggestion hint modal ----------

function HintModal({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-pop-in">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ChevronsUp className="text-blue-600 shrink-0" /> {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 text-slate-500">
            <X size={24} />
          </button>
        </div>
        <p className="mt-3 text-lg text-slate-600">{body}</p>
      </div>
    </div>
  )
}

// ---------- rest picker sheet ----------

const REST_OPTIONS = Array.from({ length: 24 }, (_, i) => 15 + i * 15) // 0:15 .. 6:00

function RestPickerSheet({
  initialSec,
  onClose,
  onSave,
  onStart,
}: {
  initialSec: number
  onClose: () => void
  onSave: (sec: number) => void
  onStart: (sec: number) => void
}) {
  const [sec, setSec] = useState(REST_OPTIONS.includes(initialSec) ? initialSec : 90)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const idx = REST_OPTIONS.indexOf(sec)
    if (idx >= 0 && listRef.current) {
      listRef.current.scrollTop = idx * 52 - listRef.current.clientHeight / 2 + 26
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <h2 className="text-3xl font-bold text-center">Rest Timer</h2>
        <div ref={listRef} className="mt-4 h-64 overflow-y-auto no-scrollbar snap-y snap-mandatory">
          {REST_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSec(s)}
              className={`w-full h-[52px] snap-center flex items-center justify-center text-2xl rounded-2xl ${
                s === sec ? 'bg-slate-100 font-bold' : 'text-slate-400'
              }`}
            >
              {Math.floor(s / 60)}min {s % 60}s
            </button>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => onStart(sec)}
            className="flex-1 border-2 border-blue-500 text-blue-600 text-lg font-bold rounded-full py-3.5 active:bg-blue-50"
          >
            Start
          </button>
          <button
            type="button"
            onClick={() => onSave(sec)}
            className="flex-1 bg-blue-600 text-white text-lg font-bold rounded-full py-3.5 active:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
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
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] inset-x-0 px-4 max-w-lg mx-auto z-40">
      <div className={`rounded-2xl shadow-xl p-3 text-white ${finished ? 'bg-green-600' : 'bg-slate-900'}`}>
        <div className="flex items-center gap-3">
          <Timer size={20} className="shrink-0" />
          <span className="text-2xl font-bold tabular-nums w-16">{fmtClock(left)}</span>
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

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatClock(totalSec: number): string {
  return fmtClock(totalSec)
}
