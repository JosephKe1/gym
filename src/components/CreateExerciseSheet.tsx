import { useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import Sheet from './Sheet'
import { actions } from '../lib/store'
import { MUSCLE_GROUPS, type MuscleGroup } from '../lib/muscles'
import { EQUIPMENT_CATEGORIES, EQUIPMENT_ITEMS, equipmentLabel } from '../data/equipment'
import type { CustomExercise, TrackType } from '../types'

const TRACK_TYPES: { key: TrackType; label: string; example: string }[] = [
  { key: 'weight-reps', label: 'Weight + Reps', example: 'e.g. Barbell Squat, Dumbbell Bench Press' },
  { key: 'bodyweight', label: 'Bodyweight Only', example: 'e.g. Push-Ups, Pull-Ups' },
  { key: 'bodyweight-plus', label: 'Bodyweight + Added Weight', example: 'e.g. Weighted Dips, Weighted Pull-Ups' },
  { key: 'duration', label: 'Duration', example: 'e.g. Plank, Jump Rope' },
  { key: 'reps-only', label: 'Reps Only', example: 'e.g. Crunches, Glute Bridges' },
]

const REP_RANGES: [number, number][] = [
  [3, 5],
  [4, 6],
  [6, 8],
  [8, 12],
  [10, 15],
  [10, 20],
  [20, 30],
]

interface CreateExerciseSheetProps {
  initialName?: string
  onCreated: (exercise: CustomExercise) => void
  onClose: () => void
}

export default function CreateExerciseSheet({ initialName = '', onCreated, onClose }: CreateExerciseSheetProps) {
  const [name, setName] = useState(initialName)
  const [equipmentKey, setEquipmentKey] = useState<string | null>(null)
  const [trackType, setTrackType] = useState<TrackType | null>(null)
  const [primary, setPrimary] = useState<MuscleGroup | null>(null)
  const [secondary, setSecondary] = useState<MuscleGroup[]>([])
  const [sets, setSets] = useState(3)
  const [repRange, setRepRange] = useState('8-12')
  const [pickingEquipment, setPickingEquipment] = useState(false)

  const canSave = name.trim().length > 0 && equipmentKey !== null && trackType !== null && primary !== null

  if (pickingEquipment) {
    return (
      <EquipmentSelectSheet
        selected={equipmentKey}
        onSelect={(key) => {
          setEquipmentKey(key)
          setPickingEquipment(false)
        }}
        onClose={() => setPickingEquipment(false)}
      />
    )
  }

  return (
    <Sheet onClose={onClose} tall>
      <div className="px-5 pb-8 overflow-y-auto grow">
        <h2 className="text-3xl font-bold">Create Exercise</h2>

        <label className="block mt-5 text-sm font-bold text-slate-400">EXERCISE NAME</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Bench Press"
          className="mt-2 w-full bg-slate-100 rounded-2xl px-4 py-3.5 text-lg outline-none focus:ring-2 focus:ring-blue-400"
        />

        <label className="block mt-5 text-sm font-bold text-slate-400">EQUIPMENT</label>
        <button
          type="button"
          onClick={() => setPickingEquipment(true)}
          className="mt-2 w-full flex items-center justify-between bg-slate-100 rounded-2xl px-4 py-3.5 text-lg"
        >
          <span className={equipmentKey ? '' : 'text-slate-400'}>
            {equipmentKey ? equipmentLabel(equipmentKey) : 'Select'}
          </span>
          <ChevronDown size={20} className="text-slate-400" />
        </button>

        <label className="block mt-5 text-sm font-bold text-slate-400">
          EXERCISE TYPE <span className="font-normal normal-case">— defines what you record per set</span>
        </label>
        <div className="mt-2 space-y-2">
          {TRACK_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTrackType(t.key)}
              className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left ${
                trackType === t.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="min-w-0 grow">
                <span className="block font-semibold">{t.label}</span>
                <span className="block text-sm text-slate-400">{t.example}</span>
              </span>
              {trackType === t.key && <Check size={20} className="text-blue-600 shrink-0" strokeWidth={3} />}
            </button>
          ))}
        </div>

        <label className="block mt-5 text-sm font-bold text-slate-400">PRIMARY MUSCLE GROUP</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setPrimary(g)
                setSecondary((sec) => sec.filter((x) => x !== g))
              }}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-2 ${
                primary === g ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <label className="block mt-5 text-sm font-bold text-slate-400">SECONDARY MUSCLE GROUPS (OPTIONAL)</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {MUSCLE_GROUPS.filter((g) => g !== primary).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setSecondary((sec) => (sec.includes(g) ? sec.filter((x) => x !== g) : [...sec, g]))}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-2 ${
                secondary.includes(g)
                  ? 'border-purple-400 bg-purple-50 text-purple-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-lg font-medium">Default sets</span>
          <select
            value={sets}
            onChange={(e) => setSets(Number(e.target.value))}
            className="bg-slate-100 rounded-xl px-4 py-2.5 text-lg font-semibold outline-none"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-lg font-medium">Rep range</span>
          <select
            value={repRange}
            onChange={(e) => setRepRange(e.target.value)}
            className="bg-slate-100 rounded-xl px-4 py-2.5 text-lg font-semibold outline-none"
          >
            {REP_RANGES.map(([lo, hi]) => (
              <option key={`${lo}-${hi}`} value={`${lo}-${hi}`}>
                {lo}-{hi}
                {lo === 8 && hi === 12 ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            const [lo, hi] = repRange.split('-').map(Number)
            const ex = actions.createCustomExercise({
              name: name.trim(),
              equipmentKey: equipmentKey!,
              trackType: trackType!,
              primaryGroup: primary!,
              secondaryGroups: secondary,
              defaultSets: sets,
              defaultRepsMin: lo,
              defaultRepsMax: hi,
            })
            onCreated(ex)
          }}
          className="mt-6 w-full bg-blue-600 text-white text-lg font-bold rounded-full py-4 active:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          Save Exercise
        </button>
      </div>
    </Sheet>
  )
}

function EquipmentSelectSheet({
  selected,
  onSelect,
  onClose,
}: {
  selected: string | null
  onSelect: (key: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  return (
    <Sheet onClose={onClose} tall>
      <div className="px-5 pb-2 shrink-0">
        <h2 className="text-3xl font-bold">Select Equipment</h2>
        <p className="text-slate-400 mt-1">Choose the equipment you will be using for this exercise.</p>
        <div className="mt-4 flex items-center gap-3 bg-slate-100 rounded-2xl px-4 py-3.5">
          <Search className="text-blue-500 shrink-0" size={22} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="bg-transparent outline-none w-full text-lg placeholder:text-slate-400"
          />
        </div>
      </div>
      <div className="overflow-y-auto px-5 pb-8 grow">
        {EQUIPMENT_CATEGORIES.map((cat) => {
          const items = EQUIPMENT_ITEMS.filter(
            (i) => i.category === cat && (!q || i.label.toLowerCase().includes(q)),
          )
          if (items.length === 0) return null
          return (
            <section key={cat}>
              <h3 className="font-bold text-lg mt-4 mb-2">{cat}</h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.key)}
                      className={`w-full flex items-center justify-between rounded-2xl px-4 py-3.5 text-lg ${
                        selected === item.key ? 'bg-blue-50 border border-blue-300' : 'bg-slate-100'
                      }`}
                    >
                      {item.label}
                      <span
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selected === item.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-transparent'
                        }`}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Sheet>
  )
}
