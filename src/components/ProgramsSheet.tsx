import { useState } from 'react'
import { Check, Plus, Trash2, Pencil, Dumbbell } from 'lucide-react'
import Sheet from './Sheet'
import Menu from './Menu'
import { actions, useAppState } from '../lib/store'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function ProgramsSheet({ onClose }: { onClose: () => void }) {
  const state = useAppState()
  const [creating, setCreating] = useState(false)

  if (creating) {
    return <CreateProgramSheet onClose={onClose} onBack={() => setCreating(false)} />
  }

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <h2 className="text-3xl font-bold">My Programs</h2>
        <p className="text-slate-400 mt-1">Switch between programs or build a new one.</p>

        <ul className="mt-5 space-y-3 max-h-[50dvh] overflow-y-auto">
          {state.plans.map((plan) => {
            const isActive = plan.id === state.activePlanId
            const days = plan.schedule.filter(Boolean).length
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
                        {days} day{days === 1 ? '' : 's'}/week · created {new Date(plan.createdAt).toLocaleDateString()}
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
          onClick={() => setCreating(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-2xl p-4 text-blue-600 font-semibold active:bg-slate-100"
        >
          <Plus size={20} /> Build program from scratch
        </button>
      </div>
    </Sheet>
  )
}

function CreateProgramSheet({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [days, setDays] = useState<number[]>([])

  const toggleDay = (i: number) =>
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))

  const canCreate = name.trim().length > 0 && days.length >= 1

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
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

        <p className="mt-6 font-bold text-slate-800">
          Availability
        </p>
        <p className="text-slate-400 text-sm mt-0.5">
          Select the days of the week you'll be able to work out. A blank workout is created for each day — you fill in
          the exercises.
        </p>

        <div className="mt-3 space-y-2 max-h-[38dvh] overflow-y-auto">
          {DAY_NAMES.map((day, i) => {
            const on = days.includes(i)
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(i)}
                className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-lg font-medium ${
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

        <button
          type="button"
          disabled={!canCreate}
          onClick={() => {
            actions.createPlan(name.trim(), days)
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
