import { Trash2 } from 'lucide-react'
import Sheet from './Sheet'
import ExerciseImage from './ExerciseImage'
import { groupsOf } from '../lib/muscles'
import { isCustom } from '../data/catalog'
import { equipmentLabel } from '../data/equipment'
import { actions } from '../lib/store'
import type { CatalogExercise, TrackType } from '../types'

const TRACK_LABEL: Record<TrackType, string> = {
  'weight-reps': 'Weight + Reps',
  bodyweight: 'Bodyweight Only',
  'bodyweight-plus': 'Bodyweight + Added Weight',
  duration: 'Duration',
  'reps-only': 'Reps Only',
}

export default function ExerciseInfoSheet({ exercise, onClose }: { exercise: CatalogExercise; onClose: () => void }) {
  const groups = groupsOf(exercise.primaryMuscles, exercise.secondaryMuscles)
  const custom = isCustom(exercise)

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8 overflow-y-auto">
        <div className="flex items-center gap-4">
          <ExerciseImage exercise={exercise} size="lg" />
          <div>
            <h2 className="text-2xl font-bold leading-tight">{exercise.name}</h2>
            <p className="text-slate-400 capitalize mt-1">
              {custom ? equipmentLabel(exercise.equipment) : `${exercise.equipment} · ${exercise.level}`}
            </p>
            {custom && (
              <span className="inline-block mt-1 text-[11px] font-bold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                My exercise · {TRACK_LABEL[exercise.trackType]}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {groups.map((g) => (
            <span key={g} className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold">
              {g}
            </span>
          ))}
        </div>

        {exercise.instructions.length > 0 && (
          <>
            <h3 className="font-bold text-lg mt-6 mb-2">How to perform</h3>
            <ol className="space-y-2 list-decimal list-outside ml-5 text-slate-600">
              {exercise.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </>
        )}

        {custom && (
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `Delete "${exercise.name}"? It's removed from your workouts and the picker; past logs stay in your history.`,
                )
              ) {
                actions.deleteCustomExercise(exercise.id)
                onClose()
              }
            }}
            className="mt-6 w-full flex items-center justify-center gap-2 text-red-600 bg-red-50 rounded-2xl py-3.5 font-semibold active:bg-red-100"
          >
            <Trash2 size={18} /> Delete custom exercise
          </button>
        )}
      </div>
    </Sheet>
  )
}
