import Sheet from './Sheet'
import ExerciseImage from './ExerciseImage'
import { groupsOf } from '../lib/muscles'
import type { CatalogExercise } from '../types'

export default function ExerciseInfoSheet({ exercise, onClose }: { exercise: CatalogExercise; onClose: () => void }) {
  const groups = groupsOf(exercise.primaryMuscles, exercise.secondaryMuscles)
  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8 overflow-y-auto">
        <div className="flex items-center gap-4">
          <ExerciseImage exercise={exercise} size="lg" />
          <div>
            <h2 className="text-2xl font-bold leading-tight">{exercise.name}</h2>
            <p className="text-slate-400 capitalize mt-1">
              {exercise.equipment} · {exercise.level}
            </p>
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
      </div>
    </Sheet>
  )
}
