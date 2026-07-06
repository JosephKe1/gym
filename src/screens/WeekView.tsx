import { useState } from 'react'
import { Pencil, Plus, Dumbbell, AlertTriangle, CheckCircle2, PersonStanding, Play } from 'lucide-react'
import Menu from '../components/Menu'
import Sheet from '../components/Sheet'
import { actions, dayStatusFor, useAppState, weekdayIndex, type DayStatus } from '../lib/store'

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

export default function WeekView({ onOpenWorkout }: { onOpenWorkout: (workoutId: string) => void }) {
  const state = useAppState()
  const { plan } = state
  const [assignDay, setAssignDay] = useState<number | null>(null)

  const today = weekdayIndex()
  const todayWorkoutId = plan.schedule[today]
  const todayWorkout = plan.workouts.find((w) => w.id === todayWorkoutId)
  const todayStatus = dayStatusFor(state, today, todayWorkoutId)

  return (
    <div className="pb-28">
      <header className="px-5 pt-4">
        <p className="text-slate-500 text-sm flex items-center gap-1.5">
          {plan.subtitle}
        </p>
        <button
          type="button"
          className="flex items-center gap-2 mt-0.5"
          onClick={() => {
            const name = prompt('Plan name', plan.name)
            if (name?.trim()) actions.renamePlan(name.trim())
          }}
        >
          <h1 className="text-2xl font-bold">{plan.name}</h1>
          <Pencil size={16} className="text-slate-400" />
        </button>
      </header>

      {todayWorkout && (
        <div className="mx-5 mt-5 bg-blue-50 rounded-3xl p-6 flex items-center justify-between">
          <div>
            <p className={`font-semibold ${todayStatus === 'complete' ? 'text-green-600' : 'text-blue-600'}`}>
              {todayStatus === 'complete' ? 'Workout Complete' : "Today's Workout"}
            </p>
            <p className="text-3xl font-bold mt-1">{todayWorkout.name}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenWorkout(todayWorkout.id)}
            className="bg-blue-600 text-white font-semibold rounded-full px-6 py-3.5 active:bg-blue-700 flex items-center gap-2"
          >
            {todayStatus === 'complete' ? 'View Workout' : <><Play size={16} fill="currentColor" /> Start</>}
          </button>
        </div>
      )}

      <div className="px-5 mt-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold">This Week's Schedule</h2>
      </div>

      <ul className="px-5 mt-4 space-y-3">
        {DAY_LABELS.map((label, i) => {
          const workoutId = plan.schedule[i]
          const workout = plan.workouts.find((w) => w.id === workoutId)
          const status = dayStatusFor(state, i, workoutId)
          return (
            <li key={label} className="flex items-center gap-4">
              <span className={`w-11 shrink-0 font-bold text-sm ${i === today ? 'text-blue-600' : 'text-slate-700'}`}>
                {label}
              </span>
              <DayCard
                status={status}
                workoutName={workout?.name ?? null}
                onOpen={() => workout && onOpenWorkout(workout.id)}
                onAdd={() => setAssignDay(i)}
                menu={
                  <Menu
                    items={[
                      { label: workout ? 'Change workout' : 'Assign workout', onClick: () => setAssignDay(i) },
                      ...(workout
                        ? [{ label: 'Make it a rest day', danger: true, onClick: () => actions.assignWorkoutToDay(i, null) }]
                        : []),
                    ]}
                  />
                }
              />
            </li>
          )
        })}
      </ul>

      {assignDay !== null && (
        <AssignWorkoutSheet
          dayIndex={assignDay}
          onClose={() => setAssignDay(null)}
          onOpenWorkout={onOpenWorkout}
        />
      )}
    </div>
  )
}

function DayCard({
  status,
  workoutName,
  onOpen,
  onAdd,
  menu,
}: {
  status: DayStatus
  workoutName: string | null
  onOpen: () => void
  onAdd: () => void
  menu: React.ReactNode
}) {
  const frame =
    status === 'rest'
      ? 'border border-slate-200 bg-white'
      : status === 'missed'
        ? 'border border-orange-200 bg-orange-50/40'
        : status === 'complete'
          ? 'border border-green-200 bg-green-50/40'
          : 'bg-slate-100'

  const iconFrame =
    status === 'rest'
      ? 'border border-slate-200 text-slate-400'
      : status === 'missed'
        ? 'border border-orange-200 bg-orange-50 text-orange-500'
        : status === 'complete'
          ? 'border border-green-200 bg-green-50 text-green-600'
          : 'border border-blue-200 bg-blue-50 text-blue-600'

  return (
    <div className={`grow flex items-center gap-3 rounded-2xl p-3 min-w-0 ${frame}`}>
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconFrame}`}>
        {status === 'rest' ? <PersonStanding size={24} /> : <Dumbbell size={22} />}
      </span>

      {workoutName ? (
        <button type="button" onClick={onOpen} className="grow text-left min-w-0">
          {status === 'missed' && (
            <p className="text-orange-500 text-sm font-semibold flex items-center gap-1">
              Missed <AlertTriangle size={13} />
            </p>
          )}
          {status === 'complete' && (
            <p className="text-green-600 text-sm font-semibold flex items-center gap-1">
              Complete <CheckCircle2 size={13} />
            </p>
          )}
          <p className="text-lg font-semibold truncate">{workoutName}</p>
        </button>
      ) : (
        <div className="grow flex items-center justify-between min-w-0">
          <span className="text-slate-400 text-lg">Rest</span>
          <button type="button" onClick={onAdd} className="flex items-center gap-1.5 text-blue-600 font-bold">
            <Plus size={18} className="bg-blue-600 text-white rounded-full p-0.5" /> Add Workout
          </button>
        </div>
      )}

      {menu}
    </div>
  )
}

function AssignWorkoutSheet({
  dayIndex,
  onClose,
  onOpenWorkout,
}: {
  dayIndex: number
  onClose: () => void
  onOpenWorkout: (id: string) => void
}) {
  const { plan } = useAppState()
  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <h2 className="text-2xl font-bold">
          {DAY_LABELS[dayIndex]} · Choose a workout
        </h2>
        <ul className="mt-4 space-y-3">
          {plan.workouts.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => {
                  actions.assignWorkoutToDay(dayIndex, w.id)
                  onClose()
                }}
                className="w-full flex items-center gap-4 bg-slate-100 rounded-2xl p-4 active:bg-slate-200"
              >
                <Dumbbell size={20} className="text-blue-600" />
                <span className="text-lg font-medium grow text-left">{w.name}</span>
                <span className="text-slate-400 text-sm">{w.exercises.length} exercises</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                const name = prompt('New workout name', 'New Workout')
                if (!name?.trim()) return
                const id = actions.addWorkout(name.trim(), dayIndex)
                onClose()
                onOpenWorkout(id)
              }}
              className="w-full flex items-center gap-4 border-2 border-dashed border-slate-300 rounded-2xl p-4 text-blue-600 font-semibold active:bg-slate-100"
            >
              <Plus size={20} /> Create new workout
            </button>
          </li>
        </ul>
      </div>
    </Sheet>
  )
}
