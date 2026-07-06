import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Pencil,
  Plus,
  Play,
  Repeat,
  Trash2,
  SlidersHorizontal,
  Link2,
  ArrowUp,
  ArrowDown,
  History,
} from 'lucide-react'
import Menu from '../components/Menu'
import Sheet from '../components/Sheet'
import ExercisePicker from '../components/ExercisePicker'
import ExerciseImage from '../components/ExerciseImage'
import ExerciseInfoSheet from '../components/ExerciseInfoSheet'
import { getExercise } from '../data/catalog'
import { toGroup, GROUP_BADGE, type MuscleGroup } from '../lib/muscles'
import { actions, activePlan, useAppState } from '../lib/store'
import type { CatalogExercise, PlanExercise, Workout } from '../types'

interface WorkoutDetailProps {
  workoutId: string
  onBack: () => void
  onStart: () => void
  onHistory: () => void
}

type PickerMode = { kind: 'add' } | { kind: 'swap'; slotId: string } | null

export default function WorkoutDetail({ workoutId, onBack, onStart, onHistory }: WorkoutDetailProps) {
  const state = useAppState()
  const plan = activePlan(state)
  const workout = plan.workouts.find((w) => w.id === workoutId)
  const [picker, setPicker] = useState<PickerMode>(null)
  const [editSlot, setEditSlot] = useState<PlanExercise | null>(null)
  const [supersetSlot, setSupersetSlot] = useState<PlanExercise | null>(null)
  const [infoExercise, setInfoExercise] = useState<CatalogExercise | null>(null)

  const dayIndex = workout ? plan.schedule.indexOf(workout.id) : -1
  const muscles = useMemo(() => (workout ? targetMuscles(workout) : []), [workout])

  if (!workout) {
    return (
      <div className="p-5">
        <button type="button" onClick={onBack} className="text-blue-600 font-semibold">
          ← Back
        </button>
        <p className="mt-6 text-slate-500">This workout no longer exists.</p>
      </div>
    )
  }

  const dayName = dayIndex >= 0 ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayIndex] : null

  return (
    <div className="pb-32">
      <header className="px-5 pt-4 flex items-start gap-4 bg-slate-100/80 pb-4 border-b border-slate-200">
        <button type="button" onClick={onBack} aria-label="Back" className="mt-2 p-1 -m-1">
          <ArrowLeft size={26} />
        </button>
        <div className="grow min-w-0">
          {dayName && <p className="text-slate-500">{dayName}'s Workout</p>}
          <button
            type="button"
            className="flex items-center gap-2"
            onClick={() => {
              const name = prompt('Workout name', workout.name)
              if (name?.trim()) actions.renameWorkout(workout.id, name.trim())
            }}
          >
            <h1 className="text-3xl font-bold truncate">{workout.name}</h1>
            <Pencil size={16} className="text-slate-300 shrink-0" />
          </button>
        </div>
        <button
          type="button"
          onClick={onStart}
          aria-label="Start workout"
          className="shrink-0 mt-1 w-12 h-12 rounded-2xl bg-blue-100 border border-blue-300 text-blue-600 flex items-center justify-center active:bg-blue-200"
        >
          <Play size={20} fill="currentColor" />
        </button>
      </header>

      {muscles.length > 0 && (
        <section className="mt-6">
          <h2 className="px-5 text-2xl font-bold">Target Muscles</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 mt-3 pb-1">
            {muscles.map(({ group, pct }) => (
              <div
                key={group}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3 pr-6 shrink-0"
              >
                <span className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold ${GROUP_BADGE[group].classes}`}>
                  {GROUP_BADGE[group].label}
                </span>
                <div>
                  <p className="text-lg font-semibold">{group}</p>
                  <p className="text-slate-500">{pct}%</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">
              {workout.exercises.length} Exercise{workout.exercises.length === 1 ? '' : 's'}
            </h2>
            <button
              type="button"
              aria-label="Add exercise"
              onClick={() => setPicker({ kind: 'add' })}
              className="text-slate-700 p-1"
            >
              <Plus size={26} />
            </button>
          </div>
          <button type="button" aria-label="Workout history" onClick={onHistory} className="text-slate-500 p-1">
            <History size={22} />
          </button>
        </div>

        <ul className="mt-4 space-y-3">
          {workout.exercises.map((slot, idx) => {
            const ex = getExercise(slot.exerciseId)
            if (!ex) return null
            const partner = slot.supersetWith ? workout.exercises.find((e) => e.id === slot.supersetWith) : null
            const partnerEx = partner ? getExercise(partner.exerciseId) : null
            return (
              <li key={slot.id} className="bg-slate-100 rounded-2xl p-3 flex items-center gap-4">
                <button type="button" onClick={() => setInfoExercise(ex)} className="shrink-0">
                  <ExerciseImage exercise={ex} />
                </button>
                <div className="grow min-w-0">
                  <p className="text-lg font-bold leading-snug">{ex.name}</p>
                  <p className="text-slate-600 mt-0.5">
                    <span className="font-semibold">{slot.sets} sets</span> · {slot.repsMin}-{slot.repsMax} reps
                    {slot.perSide ? ' per side' : ''}
                  </p>
                  {partnerEx && (
                    <p className="text-purple-600 text-sm font-semibold mt-1 flex items-center gap-1">
                      <Link2 size={13} /> Superset with {partnerEx.name}
                    </p>
                  )}
                </div>
                <Menu
                  items={[
                    { label: 'Swap', icon: <Repeat size={18} />, onClick: () => setPicker({ kind: 'swap', slotId: slot.id }) },
                    { label: 'Remove', icon: <Trash2 size={18} />, onClick: () => actions.removeExercise(workout.id, slot.id) },
                    { label: 'Edit Sets & Reps', icon: <SlidersHorizontal size={18} />, onClick: () => setEditSlot(slot) },
                    { label: 'Superset with...', icon: <Link2 size={18} />, onClick: () => setSupersetSlot(slot) },
                    ...(idx > 0 ? [{ label: 'Move up', icon: <ArrowUp size={18} />, onClick: () => actions.moveExercise(workout.id, slot.id, -1) }] : []),
                    ...(idx < workout.exercises.length - 1
                      ? [{ label: 'Move down', icon: <ArrowDown size={18} />, onClick: () => actions.moveExercise(workout.id, slot.id, 1) }]
                      : []),
                  ]}
                />
              </li>
            )
          })}
        </ul>

        {workout.exercises.length === 0 && (
          <button
            type="button"
            onClick={() => setPicker({ kind: 'add' })}
            className="mt-4 w-full border-2 border-dashed border-slate-300 rounded-2xl p-8 text-blue-600 font-semibold"
          >
            + Add your first exercise
          </button>
        )}
      </section>

      {workout.exercises.length > 0 && (
        <div className="fixed bottom-20 inset-x-0 px-5 max-w-lg mx-auto">
          <button
            type="button"
            onClick={onStart}
            className="w-full bg-blue-600 text-white text-lg font-bold rounded-full py-4 shadow-lg shadow-blue-600/30 active:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Play size={18} fill="currentColor" /> Start Workout
          </button>
        </div>
      )}

      {picker && (
        <ExercisePicker
          title={picker.kind === 'swap' ? 'Swap Exercise' : 'Select Exercise'}
          onClose={() => setPicker(null)}
          onInfo={(ex) => setInfoExercise(ex)}
          onSelect={(ex) => {
            if (picker.kind === 'add') actions.addExercise(workout.id, ex.id)
            else actions.swapExercise(workout.id, picker.slotId, ex.id)
            setPicker(null)
          }}
        />
      )}

      {editSlot && <EditSetsRepsSheet workout={workout} slot={editSlot} onClose={() => setEditSlot(null)} />}
      {supersetSlot && <SupersetSheet workout={workout} slot={supersetSlot} onClose={() => setSupersetSlot(null)} />}
      {infoExercise && <ExerciseInfoSheet exercise={infoExercise} onClose={() => setInfoExercise(null)} />}
    </div>
  )
}

// ---------- target muscle summary ----------

function targetMuscles(workout: Workout): { group: MuscleGroup; pct: number }[] {
  const points = new Map<MuscleGroup, number>()
  for (const slot of workout.exercises) {
    const ex = getExercise(slot.exerciseId)
    if (!ex) continue
    for (const m of ex.primaryMuscles) {
      const g = toGroup(m)
      if (g) points.set(g, (points.get(g) ?? 0) + 2 * slot.sets)
    }
    for (const m of ex.secondaryMuscles) {
      const g = toGroup(m)
      if (g) points.set(g, (points.get(g) ?? 0) + 1 * slot.sets)
    }
  }
  const total = [...points.values()].reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return [...points.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([group, pts]) => ({ group, pct: Math.round((pts / total) * 100) }))
}

// ---------- edit sets & reps sheet ----------

function EditSetsRepsSheet({ workout, slot, onClose }: { workout: Workout; slot: PlanExercise; onClose: () => void }) {
  const [sets, setSets] = useState(slot.sets)
  const [repsMin, setRepsMin] = useState(slot.repsMin)
  const [repsMax, setRepsMax] = useState(slot.repsMax)
  const [perSide, setPerSide] = useState(slot.perSide ?? false)
  const ex = getExercise(slot.exerciseId)

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <h2 className="text-2xl font-bold">Edit Sets & Reps</h2>
        <p className="text-slate-400 mt-1">{ex?.name}</p>

        <Stepper label="Sets" value={sets} min={1} max={10} onChange={setSets} />
        <Stepper
          label="Min reps"
          value={repsMin}
          min={1}
          max={100}
          onChange={(v) => {
            setRepsMin(v)
            if (v > repsMax) setRepsMax(v)
          }}
        />
        <Stepper
          label="Max reps"
          value={repsMax}
          min={repsMin}
          max={100}
          onChange={setRepsMax}
        />

        <label className="flex items-center justify-between mt-5 py-2">
          <span className="text-lg font-medium">Per side (unilateral)</span>
          <input
            type="checkbox"
            checked={perSide}
            onChange={(e) => setPerSide(e.target.checked)}
            className="w-6 h-6 accent-blue-600"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            actions.editSetsReps(workout.id, slot.id, sets, repsMin, repsMax, perSide)
            onClose()
          }}
          className="mt-6 w-full bg-blue-600 text-white text-lg font-bold rounded-full py-4 active:bg-blue-700"
        >
          Save
        </button>
      </div>
    </Sheet>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
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
}

// ---------- superset sheet ----------

function SupersetSheet({ workout, slot, onClose }: { workout: Workout; slot: PlanExercise; onClose: () => void }) {
  const others = workout.exercises.filter((e) => e.id !== slot.id)
  const ex = getExercise(slot.exerciseId)

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <h2 className="text-2xl font-bold">Superset with...</h2>
        <p className="text-slate-400 mt-1">Pair {ex?.name} with another exercise. Paired sets alternate with no rest between them.</p>
        <ul className="mt-4 space-y-3 max-h-[50dvh] overflow-y-auto">
          {slot.supersetWith && (
            <li>
              <button
                type="button"
                onClick={() => {
                  actions.setSuperset(workout.id, slot.id, null)
                  onClose()
                }}
                className="w-full text-left bg-red-50 text-red-600 font-semibold rounded-2xl p-4"
              >
                Remove current superset
              </button>
            </li>
          )}
          {others.map((o) => {
            const oex = getExercise(o.exerciseId)
            if (!oex) return null
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    actions.setSuperset(workout.id, slot.id, o.id)
                    onClose()
                  }}
                  className={`w-full flex items-center gap-4 rounded-2xl p-3 active:bg-slate-200 ${
                    slot.supersetWith === o.id ? 'bg-purple-50 border border-purple-200' : 'bg-slate-100'
                  }`}
                >
                  <ExerciseImage exercise={oex} size="sm" />
                  <span className="text-base font-medium grow text-left">{oex.name}</span>
                  {slot.supersetWith === o.id && <Link2 size={18} className="text-purple-600" />}
                </button>
              </li>
            )
          })}
          {others.length === 0 && <li className="text-slate-400 py-6 text-center">No other exercises in this workout.</li>}
        </ul>
      </div>
    </Sheet>
  )
}
