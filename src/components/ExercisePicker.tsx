import { useMemo, useState } from 'react'
import { Search, ChevronRight, ChevronLeft, PersonStanding, Dumbbell, Info } from 'lucide-react'
import Sheet from './Sheet'
import ExerciseImage from './ExerciseImage'
import { searchCatalog } from '../data/catalog'
import { MUSCLE_GROUPS, GROUP_BADGE, type MuscleGroup } from '../lib/muscles'
import type { CatalogExercise } from '../types'

interface ExercisePickerProps {
  title?: string
  onSelect: (exercise: CatalogExercise) => void
  onInfo?: (exercise: CatalogExercise) => void
  onClose: () => void
}

type Tab = 'all' | 'muscle'

export default function ExercisePicker({ title = 'Select Exercise', onSelect, onInfo, onClose }: ExercisePickerProps) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [group, setGroup] = useState<MuscleGroup | null>(null)

  const results = useMemo(() => {
    if (tab === 'muscle' && !group && !query.trim()) return []
    return searchCatalog(query, tab === 'muscle' ? group : null).slice(0, 200)
  }, [query, tab, group])

  const showMuscleList = tab === 'muscle' && !group && !query.trim()

  return (
    <Sheet onClose={onClose} tall>
      <div className="px-5 pb-2 shrink-0">
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="text-slate-400 mt-1">Choose the exercise you'd like to add.</p>

        <div className="mt-4 flex items-center gap-3 bg-slate-100 rounded-2xl px-4 py-3.5">
          <Search className="text-blue-500 shrink-0" size={22} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Exercises (e.g. Squats)"
            className="bg-transparent outline-none w-full text-lg placeholder:text-slate-400"
          />
        </div>

        <div className="mt-3 flex bg-slate-100 rounded-full p-1">
          {(
            [
              { key: 'all', label: 'All', icon: <PersonStanding size={18} /> },
              { key: 'muscle', label: 'Muscle', icon: <Dumbbell size={18} /> },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key)
                setGroup(null)
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-base font-semibold transition-colors ${
                tab === t.key ? 'bg-white shadow text-slate-900' : 'text-slate-500'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto px-5 pb-8 grow">
        {showMuscleList ? (
          <ul className="space-y-3 mt-2">
            {MUSCLE_GROUPS.map((g) => (
              <li key={g}>
                <button
                  type="button"
                  onClick={() => setGroup(g)}
                  className="w-full flex items-center gap-4 bg-slate-100 rounded-2xl p-3 active:bg-slate-200"
                >
                  <span
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${GROUP_BADGE[g].classes}`}
                  >
                    {GROUP_BADGE[g].label}
                  </span>
                  <span className="text-lg font-medium grow text-left">{g}</span>
                  <ChevronRight className="text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div className="flex items-center justify-between mt-2 mb-3">
              {tab === 'muscle' && group ? (
                <button
                  type="button"
                  onClick={() => setGroup(null)}
                  className="flex items-center gap-1 text-blue-600 font-semibold"
                >
                  <ChevronLeft size={18} /> {group}
                </button>
              ) : (
                <span className="font-semibold text-lg">All Exercises</span>
              )}
              <span className="text-slate-400 text-sm">{results.length} results</span>
            </div>
            <ul className="space-y-3">
              {results.map((ex) => (
                <li key={ex.id}>
                  <div className="w-full flex items-center gap-4 bg-slate-100 rounded-2xl p-3 active:bg-slate-200">
                    <button type="button" onClick={() => onSelect(ex)} className="flex items-center gap-4 grow text-left min-w-0">
                      <ExerciseImage exercise={ex} size="sm" />
                      <span className="text-base font-medium truncate">{ex.name}</span>
                    </button>
                    {onInfo && (
                      <button
                        type="button"
                        aria-label={`About ${ex.name}`}
                        onClick={() => onInfo(ex)}
                        className="p-2 text-slate-400 shrink-0"
                      >
                        <Info size={20} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {results.length === 0 && <li className="text-center text-slate-400 py-10">No exercises found.</li>}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  )
}
