import { useState } from 'react'
import { Check, Plus, Trash2, Pencil, Dumbbell, Sparkles, RotateCw } from 'lucide-react'
import Sheet from './Sheet'
import Menu from './Menu'
import ProgramBuilder from './ProgramBuilder'
import { actions, useAppState } from '../lib/store'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function ProgramsSheet({ onClose }: { onClose: () => void }) {
  const state = useAppState()
  const [creating, setCreating] = useState(false)
  const [building, setBuilding] = useState(false)

  if (building) {
    return <ProgramBuilder onClose={() => setBuilding(false)} onDone={onClose} />
  }
  if (creating) {
    return <CreateProgramSheet onClose={onClose} onBack={() => setCreating(false)} />
  }

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <h2 className="text-3xl font-bold">My Programs</h2>
        <p className="text-slate-400 mt-1">Switch between programs or build a new one.</p>

        <ul className="mt-5 space-y-3 max-h-[44dvh] overflow-y-auto">
          {state.plans.map((plan) => {
            const isActive = plan.id === state.activePlanId
            const scheduleLabel = plan.cycle
              ? `${plan.cycle.days.length}-day rotation`
              : `${plan.schedule.filter(Boolean).length} days/week`
            return (
              <li key={plan.id}>
                <div
                  className={`flex items-center gap-3 rounded-2xl p-4 ${
                    isActive ? 'bg-blue-50 border border-blue-200' : 'bg-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      actions.setActivePlan(plan.id)
                      onClose()
                    }}
                    className="grow text-left min-w-0 flex items-center gap-3"
                  >
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-500'
                      }`}
                    >
                      {isActive ? <Check size={18} strokeWidth={3} /> : <Dumbbell size={16} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold truncate">{plan.name}</span>
                      <span className="block text-slate-400 text-sm">
                        {scheduleLabel} · created {new Date(plan.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </button>
                  <Menu
                    items={[
                      {
                        label: 'Rename',
                        icon: <Pencil size={18} />,
                        onClick: () => {
                          const name = prompt('Program name', plan.name)
                          if (name?.trim()) actions.renamePlanById(plan.id, name.trim())
                        },
                      },
                      ...(plan.cycle
                        ? [
                            {
                              label: 'Shift rotation +1 day',
                              icon: <RotateCw size={18} />,
                              onClick: () => actions.shiftCycle(plan.id, 1),
                            },
                            {
                              label: 'Shift rotation -1 day',
                              icon: <RotateCw size={18} className="scale-x-[-1]" />,
                              onClick: () => actions.shiftCycle(plan.id, -1),
                            },
                          ]
                        : []),
                      ...(state.plans.length > 1
                        ? [
                            {
                              label: 'Delete program',
                              icon: <Trash2 size={18} />,
                              danger: true,
                              onClick: () => {
                                if (confirm(`Delete "${plan.name}"? Its workouts are removed; your logged history is kept.`)) {
                                  actions.deletePlan(plan.id)
                                }
                              },
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={() => setBuilding(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold rounded-2xl p-4 active:bg-blue-700"
        >
          <Sparkles size={18} /> Get a new program
        </button>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-2xl p-4 text-blue-600 font-semibold active:bg-slate-100"
        >
          <Plus size={20} /> Build program from scratch
        </button>
      </div>
    </Sheet>
  )
}

function CreateProgramSheet({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'weekly' | 'cycle'>('weekly')
  const [days, setDays] = useState<number[]>([])
  const [cycleLength, setCycleLength] = useState(7)
  const [cycleTraining, setCycleTraining] = useState<boolean[]>([true, true, true, false, true, true, true])

  const toggleDay = (i: number) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))
  const toggleCycleSlot = (i: number) => setCycleTraining((t) => t.map((x, j) => (j === i ? !x : x)))

  const setLength = (n: number) => {
    setCycleLength(n)
    setCycleTraining((t) => {
      const next = [...t]
      while (next.length < n) next.push(true)
      next.length = n
      return next
    })
  }

  const canCreate =
    name.trim().length > 0 &&
    (mode === 'weekly' ? days.length >= 1 : cycleTraining.some(Boolean))

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8 overflow-y-auto">
        <button type="button" onClick={onBack} className="text-blue-600 font-semibold text-sm">
          ← My Programs
        </button>
        <h2 className="text-3xl font-bold mt-2">New Program</h2>

        <label className="block mt-5 text-sm font-bold text-slate-400">PROGRAM NAME</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 3-Day Full Body"
          className="mt-2 w-full bg-slate-100 rounded-2xl px-4 py-3.5 text-lg outline-none focus:ring-2 focus:ring-blue-400"
        />

        <p className="mt-6 font-bold text-slate-800">Schedule type</p>
        <div className="mt-2 flex bg-slate-100 rounded-full p-1">
          {(
            [
              { key: 'weekly', label: 'Weekly' },
              { key: 'cycle', label: 'Rotating cycle' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMode(t.key)}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold ${
                mode === t.key ? 'bg-white shadow text-slate-900' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'weekly' ? (
          <>
            <p className="mt-5 text-slate-400 text-sm">
              Select your training days. A blank workout is created for each — you fill in the exercises.
            </p>
            <div className="mt-3 space-y-2 max-h-[34dvh] overflow-y-auto">
              {DAY_NAMES.map((day, i) => {
                const on = days.includes(i)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-medium ${
                      on ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center ${
                        on ? 'bg-blue-600 text-white' : 'border-2 border-slate-300 text-transparent'
                      }`}
                    >
                      <Check size={15} strokeWidth={3} />
                    </span>
                    {day}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <p className="mt-5 text-slate-400 text-sm">
              The pattern repeats every {cycleLength} days regardless of weekday (e.g. Push / Pull / Legs / Rest). The
              rotation starts today; you can shift it later if you miss a day.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-lg font-medium">Cycle length</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Decrease cycle length"
                  onClick={() => setLength(Math.max(2, cycleLength - 1))}
                  className="w-10 h-10 rounded-full bg-slate-100 text-xl font-bold active:bg-slate-200"
                >
                  −
                </button>
                <span className="font-bold text-xl w-8 text-center">{cycleLength}</span>
                <button
                  type="button"
                  aria-label="Increase cycle length"
                  onClick={() => setLength(Math.min(10, cycleLength + 1))}
                  className="w-10 h-10 rounded-full bg-slate-100 text-xl font-bold active:bg-slate-200"
                >
                  +
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm font-bold text-slate-400">TAP TO TOGGLE TRAINING / REST</p>
            <div className="mt-2 grid grid-cols-2 gap-2 max-h-[30dvh] overflow-y-auto">
              {cycleTraining.map((training, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleCycleSlot(i)}
                  className={`rounded-2xl border-2 px-3 py-3 text-left ${
                    training ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="block text-xs font-bold text-slate-400">DAY {i + 1}</span>
                  <span className={`block font-semibold ${training ? 'text-blue-700' : 'text-slate-400'}`}>
                    {training ? `Workout ${cycleTraining.slice(0, i + 1).filter(Boolean).length}` : 'Rest'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          disabled={!canCreate}
          onClick={() => {
            if (mode === 'weekly') {
              actions.createPlan(name.trim(), days)
            } else {
              let k = 0
              actions.createCyclePlan(
                name.trim(),
                cycleTraining.map((t) => (t ? `Workout ${++k}` : null)),
              )
            }
            onClose()
          }}
          className="mt-5 w-full bg-blue-600 text-white text-lg font-bold rounded-full py-4 active:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          Create Program
        </button>
      </div>
    </Sheet>
  )
}
